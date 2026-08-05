#!/bin/bash
# InfraAnsible Production Install Script
# Run as root: sudo bash deploy/install.sh

set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Installing nginx config..."
cp "$DEPLOY_DIR/infraansible.nginx.conf" /etc/nginx/conf.d/infraansible.conf

echo "==> Testing nginx config..."
nginx -t

echo "==> Installing systemd services..."
cp "$DEPLOY_DIR/infraansible-backend.service" /etc/systemd/system/
cp "$DEPLOY_DIR/infraansible-celery.service"  /etc/systemd/system/

echo "==> Enabling and starting services..."
systemctl daemon-reload
systemctl enable --now mysqld redis
systemctl enable --now infraansible-backend infraansible-celery
systemctl enable --now nginx
systemctl restart nginx

echo ""
echo "==> Status:"
systemctl is-active mysqld redis infraansible-backend infraansible-celery nginx

echo ""
echo "✅ Done. Application is live at: http://$(hostname -I | awk '{print $1}'):9191"
echo "   Logs: journalctl -u infraansible-backend -f"
