import uuid
from typing import Optional, List
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Job, JobLog, Playbook, Server


async def create_jobs(
    db: AsyncSession, *, playbook_id: int, server_ids: List[int], user_id: int,
    extra_vars: Optional[dict] = None, batch_config: Optional[dict] = None,
) -> Job:
    """
    Create a single job (one server) or a batch parent + child jobs (multiple servers).
    Returns the job to dispatch (single job, or the batch parent).
    """
    playbook = (await db.execute(select(Playbook).where(Playbook.id == playbook_id))).scalar_one_or_none()
    if playbook is None or not playbook.is_active:
        raise ValueError("Playbook not found or inactive")

    servers = (await db.execute(
        select(Server).where(Server.id.in_(server_ids), Server.is_active == True)  # noqa: E712
    )).scalars().all()
    if not servers:
        raise ValueError("No valid active servers selected")

    if len(servers) == 1:
        job = Job(
            job_id=str(uuid.uuid4()),
            playbook_id=playbook_id,
            server_id=servers[0].id,
            user_id=user_id,
            status="pending",
            extra_vars=extra_vars or {},
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return job

    # Batch: parent + children
    parent = Job(
        job_id=str(uuid.uuid4()),
        playbook_id=playbook_id,
        server_id=servers[0].id,  # nominal; parent represents the batch
        user_id=user_id,
        status="pending",
        is_batch_job=True,
        batch_config=batch_config or {"execution_strategy": "parallel", "concurrent_limit": 5, "stop_on_failure": False},
        extra_vars=extra_vars or {},
    )
    db.add(parent)
    await db.flush()

    for server in servers:
        db.add(Job(
            job_id=str(uuid.uuid4()),
            parent_job_id=parent.id,
            playbook_id=playbook_id,
            server_id=server.id,
            user_id=user_id,
            status="pending",
            extra_vars=extra_vars or {},
        ))
    await db.commit()
    await db.refresh(parent)
    return parent


async def list_jobs(
    db: AsyncSession, *, status: Optional[str] = None, playbook_id: Optional[int] = None,
    server_id: Optional[int] = None, user_id: Optional[int] = None,
    parent_only: bool = True, page: int = 1, per_page: int = 20,
):
    stmt = select(Job)
    count_stmt = select(func.count(Job.id))
    if parent_only:
        stmt = stmt.where(Job.parent_job_id.is_(None))
        count_stmt = count_stmt.where(Job.parent_job_id.is_(None))
    if status:
        stmt = stmt.where(Job.status == status)
        count_stmt = count_stmt.where(Job.status == status)
    if playbook_id:
        stmt = stmt.where(Job.playbook_id == playbook_id)
        count_stmt = count_stmt.where(Job.playbook_id == playbook_id)
    if server_id:
        stmt = stmt.where(Job.server_id == server_id)
        count_stmt = count_stmt.where(Job.server_id == server_id)
    if user_id:
        stmt = stmt.where(Job.user_id == user_id)
        count_stmt = count_stmt.where(Job.user_id == user_id)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Job.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    jobs = (await db.execute(stmt)).scalars().all()
    return jobs, total


async def get_job(db: AsyncSession, job_id: int) -> Optional[Job]:
    return (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()


async def get_job_by_uuid(db: AsyncSession, job_uuid: str) -> Optional[Job]:
    return (await db.execute(select(Job).where(Job.job_id == job_uuid))).scalar_one_or_none()


async def get_job_logs(db: AsyncSession, job_id: int, after_line: int = 0) -> List[JobLog]:
    stmt = (
        select(JobLog)
        .where(JobLog.job_id == job_id, JobLog.line_number > after_line)
        .order_by(JobLog.line_number)
    )
    return list((await db.execute(stmt)).scalars().all())
