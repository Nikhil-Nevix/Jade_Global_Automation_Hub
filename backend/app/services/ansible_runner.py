"""Ansible Runner integration — standalone wrapper around ansible-runner."""
import os
import ansible_runner


class AnsibleRunner:
    def get_inventory_string(self, hostname, ip_address, ssh_user, ssh_port=22) -> str:
        host = hostname or ip_address
        return (
            "[target_hosts]\n"
            f"{host} ansible_host={ip_address} ansible_user={ssh_user} ansible_port={ssh_port}\n"
        )

    def run_playbook(self, playbook_path, inventory, extra_vars=None,
                     private_key_path=None, working_dir=None, async_mode=False):
        if working_dir and os.path.exists(working_dir):
            if playbook_path.startswith(working_dir):
                playbook_relative = os.path.relpath(playbook_path, working_dir)
            else:
                playbook_relative = playbook_path
            roles_path = os.path.join(working_dir, "roles")
            runner_params = {
                "playbook": playbook_relative,
                "private_data_dir": working_dir,
                "inventory": inventory,
                "extravars": extra_vars or {},
                "envvars": {
                    "ANSIBLE_ROLES_PATH": f"{roles_path}:~/.ansible/roles:/usr/share/ansible/roles:/etc/ansible/roles"
                },
                "quiet": False,
                "verbosity": 2,
            }
        else:
            runner_params = {
                "playbook": playbook_path,
                "inventory": inventory,
                "extravars": extra_vars or {},
                "quiet": False,
                "verbosity": 2,
            }

        if private_key_path and os.path.exists(private_key_path):
            try:
                with open(private_key_path) as key_file:
                    runner_params["ssh_key"] = key_file.read()
            except OSError as e:
                print(f"Warning: could not read SSH key {private_key_path}: {e}")

        if async_mode:
            return ansible_runner.run_async(**runner_params)
        return ansible_runner.run(**runner_params)

    def parse_runner_output(self, runner) -> dict:
        result = {"stdout": "", "stderr": "", "rc": runner.rc, "status": runner.status, "stats": {}}
        try:
            if runner.stdout:
                result["stdout"] = runner.stdout.read()
        except Exception:
            pass
        try:
            if runner.stderr:
                result["stderr"] = runner.stderr.read()
        except Exception:
            pass
        if runner.stats:
            result["stats"] = runner.stats
        return result

    def cancel_runner(self, runner) -> bool:
        try:
            if runner:
                runner.cancel()
                return True
        except Exception as e:
            print(f"Error cancelling runner: {e}")
        return False


ansible_runner_instance = AnsibleRunner()
