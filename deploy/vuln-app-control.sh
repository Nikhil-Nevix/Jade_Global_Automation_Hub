#!/bin/bash
# InfraAnsible Vulnerability Update — Application Control Script
# Usage: sudo bash deploy/vuln-app-control.sh [start|stop|restart|status]
#
# Start sequence: postgresql → redis → minio → vuln-backend → vuln-celery → vuln-celery-beat → nginx
# Stop sequence:  nginx → vuln-celery-beat → vuln-celery → vuln-backend → minio → redis → postgresql
#
# NOTE: This stack is fully independent of the existing app (different services,
# ports, database). It does NOT touch infraansible-backend / infraansible-celery / mysqld.

set -euo pipefail

SERVICES_START=(postgresql redis minio vuln-backend vuln-celery vuln-celery-beat nginx)
SERVICES_STOP=(nginx vuln-celery-beat vuln-celery vuln-backend minio redis postgresql)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}Error: this script must be run as root (sudo).${NC}"
        exit 1
    fi
}

print_status() {
    local svc=$1
    local state
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
        echo "InfraAnsible Vulnerability stack status:"
        for svc in "${SERVICES_START[@]}"; do print_status "$svc"; done
        ;;
    *)
        echo "Usage: sudo bash deploy/vuln-app-control.sh [start|stop|restart|status]"
        exit 1
        ;;
esac
