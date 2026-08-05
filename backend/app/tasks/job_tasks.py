"""Celery tasks for Ansible playbook execution (synchronous worker side)."""
import os
import time
from datetime import datetime

from celery.exceptions import Terminated

from app.tasks.celery_app import celery_app
from app.core.sync_db import get_sync_session
from app.core.config import settings
from app.models import Job, Playbook, Server
from app.services.ansible_runner import ansible_runner_instance
from app.utils.log_parser import log_parser
from app.websocket.emitter import emit_job_log, emit_job_status


def _update_status(session, job_id, status, *, error_message=None, celery_task_id=None):
    job = session.get(Job, job_id)
    if job is None:
        return
    job.status = status
    if celery_task_id:
        job.celery_task_id = celery_task_id
    if error_message:
        job.error_message = error_message
    if status == "running" and job.started_at is None:
        job.started_at = datetime.utcnow()
    if status in ("success", "failed", "cancelled"):
        job.completed_at = datetime.utcnow()
    session.commit()


def _add_logs_bulk(session, job_id, logs):
    from app.models import JobLog
    for entry in logs:
        session.add(JobLog(
            job_id=job_id,
            line_number=entry["line_number"],
            content=entry["content"],
            log_level=entry.get("log_level", "INFO"),
        ))
    session.commit()


@celery_app.task(bind=True, name="app.tasks.job_tasks.execute_playbook_task")
def execute_playbook_task(self, job_id: int):
    with get_sync_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            return {"status": "error", "message": f"Job {job_id} not found"}
        playbook = session.get(Playbook, job.playbook_id)
        server = session.get(Server, job.server_id)
        if playbook is None or server is None:
            _update_status(session, job_id, "failed", error_message="Playbook or server not found")
            return {"status": "error", "message": "Playbook or server not found"}

        _update_status(session, job_id, "running", celery_task_id=self.request.id)
        emit_job_status(job_id, "running")

        inventory = ansible_runner_instance.get_inventory_string(
            hostname=server.hostname, ip_address=server.ip_address,
            ssh_user=server.ssh_user, ssh_port=server.ssh_port,
        )
        extra_vars = dict(job.extra_vars or {})
        extra_vars["job_id"] = job.job_id
        extra_vars["backend_url"] = settings.BACKEND_URL

        if playbook.is_folder and playbook.main_playbook_file:
            working_dir = playbook.file_path
            playbook_path = os.path.join(playbook.file_path, playbook.main_playbook_file)
        else:
            working_dir = None
            playbook_path = playbook.file_path

        try:
            thread, runner = ansible_runner_instance.run_playbook(
                playbook_path=playbook_path, inventory=inventory, extra_vars=extra_vars,
                private_key_path=server.ssh_key_path, working_dir=working_dir, async_mode=True,
            )

            processed = 0
            buffer = []
            while thread.is_alive():
                session.expire_all()
                current = session.get(Job, job_id)
                if current and current.status == "cancelled":
                    ansible_runner_instance.cancel_runner(runner)
                    thread.join(timeout=5)
                    raise Terminated("Job cancelled by user")

                try:
                    if runner.stdout and hasattr(runner.stdout, "read"):
                        out = runner.stdout.read()
                        if out:
                            lines = out.split("\n")
                            for i, line in enumerate(lines[processed:]):
                                if line.strip():
                                    entry = log_parser.parse_line(line, processed + i + 1)
                                    buffer.append({"line_number": entry["line_number"],
                                                   "content": entry["content"],
                                                   "log_level": entry["log_level"]})
                                    emit_job_log(job_id, {**buffer[-1], "timestamp": datetime.utcnow().isoformat()})
                            processed = len(lines)
                            if len(buffer) >= 10:
                                _add_logs_bulk(session, job_id, buffer)
                                buffer = []
                except Exception as e:
                    print(f"Log streaming error: {e}")
                time.sleep(0.5)

            thread.join()
            if buffer:
                _add_logs_bulk(session, job_id, buffer)

            parsed = ansible_runner_instance.parse_runner_output(runner)

            if runner.status == "successful":
                final_status, error = "success", None
            else:
                final_status = "failed"
                error = f"Playbook execution failed (rc={runner.rc}, status={runner.status})"

            _update_status(session, job_id, final_status, error_message=error)
            emit_job_status(job_id, final_status, error)

            # Vulnerability pipeline: if the playbook produced a CSV, ingest it.
            try:
                from app.services.vuln_pipeline import ingest_job_csv
                ingest_job_csv(session, job_id, parsed.get("stdout", ""))
            except Exception as e:
                print(f"CSV ingest (non-fatal): {e}")

            # Collect any CSV/patch reports the playbook produced and build a
            # result_summary (compliance %) — ported from InfraAnsible report_service.
            try:
                from app.services.report_service import collect_job_reports
                collect_job_reports(session, job_id)
            except Exception as e:
                print(f"Report collection (non-fatal): {e}")

            # Notify the job owner (honors per-user notification preferences).
            try:
                from app.services.notification_service import create_notification_sync
                if final_status == "success":
                    create_notification_sync(
                        session, user_id=job.user_id, event_type="job_success",
                        title="Job completed",
                        message=f"Job {job.job_id} completed successfully.",
                        related_entity_type="job", related_entity_id=job_id,
                    )
                elif final_status == "failed":
                    create_notification_sync(
                        session, user_id=job.user_id, event_type="job_failure",
                        title="Job failed",
                        message=f"Job {job.job_id} failed: {error}",
                        related_entity_type="job", related_entity_id=job_id,
                    )
                session.commit()
            except Exception as e:
                print(f"Notification (non-fatal): {e}")

            return {"status": final_status, "job_id": job.job_id, "rc": runner.rc}

        except Terminated:
            _update_status(session, job_id, "cancelled", error_message="Cancelled by user")
            emit_job_status(job_id, "cancelled", "Cancelled by user")
            return {"status": "cancelled"}
        except Exception as e:
            _update_status(session, job_id, "failed", error_message=str(e))
            emit_job_status(job_id, "failed", str(e))
            return {"status": "error", "message": str(e)}


@celery_app.task(bind=True, name="app.tasks.job_tasks.execute_batch_job_task")
def execute_batch_job_task(self, parent_job_id: int):
    """Execute child jobs of a batch. Simple parallel dispatch with concurrency batching."""
    from celery import group
    from celery.result import allow_join_result

    with get_sync_session() as session:
        parent = session.get(Job, parent_job_id)
        if parent is None or not parent.is_batch_job:
            return {"status": "error", "message": "Batch job not found"}

        cfg = parent.batch_config or {}
        concurrent = int(cfg.get("concurrent_limit", 5))
        stop_on_failure = bool(cfg.get("stop_on_failure", False))

        children = session.query(Job).filter(Job.parent_job_id == parent_job_id).all()
        child_ids = [c.id for c in children]
        if not child_ids:
            _update_status(session, parent_job_id, "failed", error_message="No child jobs")
            return {"status": "error", "message": "No child jobs"}

        _update_status(session, parent_job_id, "running", celery_task_id=self.request.id)

    results = []
    for i in range(0, len(child_ids), concurrent):
        batch = child_ids[i:i + concurrent]
        job_group = group(execute_playbook_task.s(cid) for cid in batch)
        async_res = job_group.apply_async()
        with allow_join_result():
            batch_out = async_res.get()
        results.extend(batch_out)
        if stop_on_failure and any(r.get("status") == "failed" for r in batch_out):
            break

    with get_sync_session() as session:
        children = session.query(Job).filter(Job.parent_job_id == parent_job_id).all()
        statuses = {c.status for c in children}
        if "running" in statuses or "pending" in statuses:
            final = "running"
        elif "failed" in statuses:
            final = "failed"
        elif statuses == {"cancelled"}:
            final = "cancelled"
        else:
            final = "success"
        _update_status(session, parent_job_id, final)

    success = sum(1 for r in results if r.get("status") == "success")
    failed = sum(1 for r in results if r.get("status") == "failed")
    return {"status": "completed", "total": len(child_ids), "success": success, "failed": failed}
