#!/bin/bash
# InfraAnsible Merged app — control script
# Usage: sudo bash deploy/merged-app-control.sh [start|stop|restart|status]
#
# Start sequence: postgresql → redis → minio → merged-backend → merged-celery → merged-celery-beat → nginx
# Stop sequence:  nginx → merged-celery-beat → merged-celery → merged-backend
#
# NOTE: This stack is fully independent of the other apps. It uses its own
# database (ansible_merged), Redis DB index (/2), MinIO bucket (merged-reports),
# backend port (8001) and nginx port (9393). It does NOT touch the vuln-* or
# infraansible-* services.

set -euo pipefail

SERVICES_START=(postgresql redis minio merged-backend merged-celery merged-celery-beat nginx)
SERVICES_STOP=(merged-celery-beat merged-celery merged-backend)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}Error: this script must be run as root (sudo).${NC}"; exit 1
    fi
}

print_status() {
    local svc=$1 state
    state=$(systemctl is-active "$svc" 2>/dev/null || true)
    if [[ "$state" == "active" ]]; then
        echo -e "  ${GREEN}[active]${NC}   $svc"
    else
        echo -e "  ${YELLOW}[$state]${NC} $svc"
    fi
}

do_start() {
    for svc in "${SERVICES_START[@]}"; do
        echo "Starting $svc ..."
        systemctl start "$svc" || echo -e "${YELLOW}  (could not start $svc — may be optional)${NC}"
    done
}

do_stop() {
    for svc in "${SERVICES_STOP[@]}"; do
        echo "Stopping $svc ..."
        systemctl stop "$svc" 2>/dev/null || true
    done
}

case "${1:-status}" in
    start)   check_root; do_start ;;
    stop)    check_root; do_stop ;;
    restart) check_root; do_stop; do_start ;;
    status)
        echo "InfraAnsible Merged stack status:"
        for svc in merged-backend merged-celery merged-celery-beat; do print_status "$svc"; done
        ;;
    *)
        echo "Usage: sudo bash deploy/merged-app-control.sh [start|stop|restart|status]"; exit 1 ;;
esac
