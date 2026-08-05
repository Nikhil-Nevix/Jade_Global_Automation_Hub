"""Dev helper: populate servers with random CPU/mem/disk metrics.

Stand-in for real SSH monitoring when target servers aren't reachable in dev.
Usage:  ./venv/bin/python simulate_metrics.py
"""
import random
from datetime import datetime

from app.core.sync_db import get_sync_session
from app.models import Server


def main():
    with get_sync_session() as session:
        servers = session.query(Server).filter(Server.is_active.is_(True)).all()
        for s in servers:
            s.cpu_usage = round(random.uniform(5, 95), 2)
            s.memory_usage = round(random.uniform(20, 90), 2)
            s.disk_usage = round(random.uniform(10, 85), 2)
            s.last_monitored = datetime.utcnow()
        session.commit()
        print(f"Updated {len(servers)} servers with simulated metrics.")


if __name__ == "__main__":
    main()
