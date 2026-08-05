#!/bin/bash
# InfraAnsible Application Control Script
# Usage: sudo bash deploy/app-control.sh [start|stop|restart|status]
#
# Start sequence:  mysqld → redis → infraansible-backend → infraansible-celery → nginx
# Stop sequence:   nginx → infraansible-celery → infraansible-backend → redis → mysqld

set -euo pipefail

SERVICES_START=(mysqld redis infraansible-backend infraansible-celery nginx)
SERVICES_STOP=(nginx infraansible-celery infraansible-backend redis mysqld)

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
        echo -e "  ${RED}[$state]${NC}  $svc"
    fi
}

cmd_start() {
    echo "==> Starting InfraAnsible (port 9191)..."
    echo "    Sequence: mysqld → redis → backend → celery → nginx"
    echo ""
    for svc in "${SERVICES_START[@]}"; do
        echo -n "    Starting $svc ... "
        systemctl start "$svc"
        echo -e "${GREEN}ok${NC}"
    done
    echo ""
    echo "==> All services started."
    cmd_status
    echo ""
    echo -e "${GREEN}Application is live at: http://$(hostname -I | awk '{print $1}'):9191${NC}"
}

cmd_stop() {
    echo "==> Stopping InfraAnsible..."
    echo "    Sequence: nginx → celery → backend → redis → mysqld"
    echo ""
    for svc in "${SERVICES_STOP[@]}"; do
        echo -n "    Stopping $svc ... "
        systemctl stop "$svc" || true
        echo -e "${YELLOW}stopped${NC}"
    done
    echo ""
    echo "==> All services stopped."
}

cmd_restart() {
    cmd_stop
    echo ""
    cmd_start
}

cmd_status() {
    echo "==> Service Status:"
    for svc in "${SERVICES_START[@]}"; do
        print_status "$svc"
    done
}

ACTION="${1:-}"

case "$ACTION" in
    start)
        check_root
        cmd_start
        ;;
    stop)
        check_root
        cmd_stop
        ;;
    restart)
        check_root
        cmd_restart
        ;;
    status)
        cmd_status
        ;;
    *)
        echo "Usage: sudo bash deploy/app-control.sh [start|stop|restart|status]"
        echo ""
        echo "  start    — Start all services in the correct order"
        echo "  stop     — Stop all services in reverse order"
        echo "  restart  — Stop then start all services"
        echo "  status   — Show current state of all services"
        exit 1
        ;;
esac
