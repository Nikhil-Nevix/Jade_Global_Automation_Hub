#!/bin/bash
# InfraAnsible Vulnerability Update — install / bootstrap helper
# Run as the svc-ansible user (uses sudo for system bits).
#
# This sets up the NEW stack only (FastAPI + PostgreSQL + MinIO + Superset).
# It does not modify the existing deployed application.

set -euo pipefail

APP_DIR=/home/svc-ansible/apps/InfraAnsible_Vulnerability
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo "==> 1. Python venv + backend dependencies"
cd "$BACKEND_DIR"
python3.11 -m venv venv
./venv/bin/python3.11 -m pip install --upgrade pip
./venv/bin/python3.11 -m pip install -r requirements.txt

echo "==> 2. Environment file"
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo "    Created .env from .env.example — EDIT IT (DB URL, secrets, MinIO, Superset)."
fi

echo "==> 3. Storage directories"
sudo mkdir -p /var/lib/infraansible/{playbooks,reports,ansible-runner,keys}
sudo chown -R svc-ansible:svc-ansible /var/lib/infraansible

echo "==> 4. Database migrations (requires PostgreSQL reachable via DATABASE_URL)"
echo "    Run:  cd $BACKEND_DIR && ./venv/bin/alembic revision --autogenerate -m 'init' && ./venv/bin/alembic upgrade head"
echo "    (Or rely on automatic table creation on first FastAPI startup.)"

echo "==> 5. Frontend build"
cd "$FRONTEND_DIR"
npm install
npm run build

echo "==> 6. systemd services"
echo "    sudo cp $APP_DIR/deploy/vuln-backend.service /etc/systemd/system/"
echo "    sudo cp $APP_DIR/deploy/vuln-celery.service /etc/systemd/system/"
echo "    sudo cp $APP_DIR/deploy/vuln-celery-beat.service /etc/systemd/system/"
echo "    sudo cp $APP_DIR/deploy/vuln-infraansible.nginx.conf /etc/nginx/conf.d/"
echo "    sudo systemctl daemon-reload"
echo "    sudo bash $APP_DIR/deploy/vuln-app-control.sh start"

echo ""
echo "Done. Remember to set SUPERSET_DASHBOARD_ID in .env once the Superset dashboard is published."
