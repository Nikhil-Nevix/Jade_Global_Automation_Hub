#!/bin/bash

# Interactive Playbook System Verification Script
# This script checks if all components are properly set up

# Get the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "============================================"
echo "Interactive Playbook System Verification"
echo "============================================"
echo "Working directory: $SCRIPT_DIR"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        return 1
    fi
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Backend checks
echo "Backend Verification:"
echo "--------------------"

# Check Python dependencies
if pip list | grep -q "flask-socketio"; then
    check 0 "flask-socketio is installed"
else
    check 1 "flask-socketio is NOT installed"
    warning "Run: pip install flask-socketio"
fi

if pip list | grep -q "python-socketio"; then
    check 0 "python-socketio is installed"
else
    check 1 "python-socketio is NOT installed"
    warning "Run: pip install python-socketio"
fi

if pip list | grep -q "paramiko"; then
    check 0 "paramiko is installed"
else
    check 1 "paramiko is NOT installed"
    warning "Run: pip install paramiko"
fi

# Check backend files exist
if [ -f "backend/app/api/interactive_playbook.py" ]; then
    check 0 "interactive_playbook.py exists"
else
    check 1 "interactive_playbook.py is missing"
fi

if [ -f "backend/app/services/ssh_service.py" ]; then
    check 0 "ssh_service.py exists"
else
    check 1 "ssh_service.py is missing"
fi

if [ -f "backend/sample_interactive_playbook.yml" ]; then
    check 0 "sample_interactive_playbook.yml exists"
else
    check 1 "sample_interactive_playbook.yml is missing"
fi

# Check extensions.py has socketio
if grep -q "flask_socketio" backend/app/extensions.py; then
    check 0 "extensions.py imports flask_socketio"
else
    check 1 "extensions.py doesn't import flask_socketio"
fi

if grep -q "socketio = SocketIO()" backend/app/extensions.py; then
    check 0 "socketio instance created in extensions.py"
else
    check 1 "socketio instance not created in extensions.py"
fi

# Check __init__.py registers blueprint
if grep -q "interactive_playbook_bp" backend/app/__init__.py; then
    check 0 "interactive_playbook_bp registered in __init__.py"
else
    check 1 "interactive_playbook_bp not registered in __init__.py"
fi

# Check config.py has BACKEND_URL
if grep -q "BACKEND_URL" backend/app/config.py; then
    check 0 "BACKEND_URL configured in config.py"
else
    check 1 "BACKEND_URL not configured in config.py"
fi

# Check tasks.py passes extra_vars
if grep -q "extra_vars\['job_id'\]" backend/app/tasks.py; then
    check 0 "tasks.py passes job_id in extra_vars"
else
    check 1 "tasks.py doesn't pass job_id in extra_vars"
fi

if grep -q "extra_vars\['backend_url'\]" backend/app/tasks.py; then
    check 0 "tasks.py passes backend_url in extra_vars"
else
    check 1 "tasks.py doesn't pass backend_url in extra_vars"
fi

# Check run.py uses socketio.run
if grep -q "socketio.run" backend/run.py; then
    check 0 "run.py uses socketio.run()"
else
    check 1 "run.py doesn't use socketio.run()"
    warning "Update run.py to use socketio.run() instead of app.run()"
fi

echo ""
echo "Frontend Verification:"
echo "--------------------"

# Check Node dependencies
if [ -f "frontend/node_modules/socket.io-client/package.json" ]; then
    check 0 "socket.io-client is installed"
else
    check 1 "socket.io-client is NOT installed"
    warning "Run: cd frontend && npm install socket.io-client"
fi

# Check frontend files exist
if [ -f "frontend/src/services/socket.service.ts" ]; then
    check 0 "socket.service.ts exists"
else
    check 1 "socket.service.ts is missing"
fi

if [ -f "frontend/src/components/InteractivePatchesDialog/InteractivePatchesDialog.tsx" ]; then
    check 0 "InteractivePatchesDialog.tsx exists"
else
    check 1 "InteractivePatchesDialog.tsx is missing"
fi

if [ -f "frontend/src/components/InteractivePatchesDialog/index.ts" ]; then
    check 0 "InteractivePatchesDialog index.ts exists"
else
    check 1 "InteractivePatchesDialog index.ts is missing"
fi

# Check App.tsx imports socketService
if grep -q "socketService" frontend/src/App.tsx; then
    check 0 "App.tsx imports socketService"
else
    check 1 "App.tsx doesn't import socketService"
fi

# Check App.tsx imports InteractivePatchesDialog
if grep -q "InteractivePatchesDialog" frontend/src/App.tsx; then
    check 0 "App.tsx imports InteractivePatchesDialog"
else
    check 1 "App.tsx doesn't import InteractivePatchesDialog"
fi

echo ""
echo "Documentation Verification:"
echo "---------------------------"

if [ -f "INTERACTIVE_PLAYBOOK_SYSTEM.md" ]; then
    check 0 "INTERACTIVE_PLAYBOOK_SYSTEM.md exists"
else
    check 1 "INTERACTIVE_PLAYBOOK_SYSTEM.md is missing"
fi

if [ -f "INTERACTIVE_PLAYBOOK_IMPLEMENTATION_SUMMARY.md" ]; then
    check 0 "INTERACTIVE_PLAYBOOK_IMPLEMENTATION_SUMMARY.md exists"
else
    check 1 "INTERACTIVE_PLAYBOOK_IMPLEMENTATION_SUMMARY.md is missing"
fi

if [ -f "QUICK_START_INTERACTIVE_PLAYBOOK.md" ]; then
    check 0 "QUICK_START_INTERACTIVE_PLAYBOOK.md exists"
else
    check 1 "QUICK_START_INTERACTIVE_PLAYBOOK.md is missing"
fi

echo ""
echo "============================================"
echo "Verification Complete"
echo "============================================"
echo ""
echo "Next Steps:"
echo "1. Start backend: cd backend && python run.py"
echo "2. Start Celery: cd backend && celery -A app.extensions.celery worker --loglevel=info"
echo "3. Start frontend: cd frontend && npm run dev"
echo "4. Test the system following QUICK_START_INTERACTIVE_PLAYBOOK.md"
echo ""
