# Architecture Diagram Megaprompt for InfraAnsible

## Copy this prompt to your image generation AI (e.g., DALL-E, Midjourney, or similar):

---

**PROMPT:**

Create a modern, colorful, professional high-level architecture diagram for "InfraAnsible" - an Infrastructure Automation Platform. Use vibrant colors, clean icons, and clear connecting arrows. The diagram should be visually engaging and easy to understand.

**LAYOUT: Full Stack View (Top-to-Bottom Flow)**

**LAYER 1 - FRONTEND (Top Section - Blue Theme #3B82F6)**
- Large box labeled "FRONTEND - React 18 + TypeScript"
- Sub-components in rounded rectangles:
  * "Dashboard" (chart icon)
  * "Playbook Manager" (file icon)
  * "Server Manager" (server icon)
  * "Job Execution & Monitoring" (play button icon)
  * "Report Viewer with Dropdown" (document icon)
  * "Notifications Panel" (bell icon)
- Tech badges: "Vite", "Tailwind CSS", "Zustand", "React Router"
- Port label: ":5173"

**LAYER 2 - API GATEWAY (Middle-Top - Green Theme #10B981)**
- Large box labeled "BACKEND API - Flask + Flask-SocketIO"
- Sub-components:
  * "REST API Endpoints" (globe icon)
  * "WebSocket Server (Real-time Logs)" (lightning icon)
  * "JWT Authentication" (lock icon)
  * "RBAC Engine (Admin/Operator/Viewer)" (shield icon)
- Tech badges: "Python 3.9+", "Flask 2.x", "SQLAlchemy"
- Port label: ":5000"
- Arrows: Bidirectional between Frontend (HTTP/HTTPS + WebSocket)

**LAYER 3 - TASK QUEUE (Middle-Center - Orange Theme #F59E0B)**
- Large box labeled "CELERY WORKER - Async Task Processing"
- Sub-components:
  * "Job Queue Manager" (queue icon)
  * "Ansible Runner Integration" (gear icon)
  * "SSH Connection Handler" (terminal icon)
  * "File Detection & Parsing" (search icon)
- Tech badge: "Celery"
- Arrows: 
  * From Backend API (Task Submit)
  * To Redis (Job Queue)
  * To Ansible (Execute)

**LAYER 4 - MESSAGE BROKER (Middle-Left - Red Theme #EF4444)**
- Box labeled "REDIS"
- Sub-components:
  * "Task Queue" (list icon)
  * "Result Backend" (check icon)
  * "Session Cache" (database icon)
- Port label: ":6379"
- Arrows: Bidirectional with Celery and Backend

**LAYER 5 - DATABASE (Middle-Right - Purple Theme #8B5CF6)**
- Box labeled "MariaDB / MySQL"
- Tables shown as mini cards:
  * "users" (person icon)
  * "servers" (server icon)
  * "playbooks" (book icon)
  * "jobs" (briefcase icon)
  * "job_logs" (file-text icon)
  * "notifications" (bell icon)
  * "audit_logs" (history icon)
- Port label: ":3306"
- Arrow: From Backend API (SQL Queries)

**LAYER 6 - AUTOMATION ENGINE (Bottom-Left - Teal Theme #14B8A6)**
- Box labeled "ANSIBLE RUNNER"
- Sub-components:
  * "Playbook Executor" (play icon)
  * "Inventory Manager" (list icon)
  * "Module Loader" (puzzle icon)
- Tech badge: "Ansible"
- Arrow: From Celery Worker

**LAYER 7 - TARGET INFRASTRUCTURE (Bottom - Gray Theme #6B7280)**
- Multiple server boxes in a row:
  * "Remote Server 1" (server icon)
  * "Remote Server 2" (server icon)
  * "Remote Server 3" (server icon)
  * "..." (ellipsis)
- Each shows:
  * IP address (e.g., 192.168.x.x)
  * SSH port (22)
  * OS icon (Linux/RHEL/CentOS)
- Arrow: From Ansible Runner (SSH connections)

**WORKFLOW ARROWS (Different Colors for Different Flows):**

1. **User Authentication Flow (Blue)**
   - Frontend → Backend API → MariaDB → Backend API → Frontend
   - Label: "Login / JWT Token"

2. **Job Execution Flow (Green)**
   - Frontend → Backend API → Celery Worker → Redis → Ansible Runner → Remote Servers
   - Label: "Execute Playbook"

3. **Real-time Monitoring (Orange)**
   - Ansible Runner → Celery Worker → Backend API (WebSocket) → Frontend
   - Label: "Live Logs Stream"

4. **Report Generation Flow (Purple)**
   - Remote Servers (generates files) → Ansible Runner → Celery Worker → Backend API → Frontend (Report Viewer)
   - Label: "Generated Files Detection"

5. **Notification Flow (Red)**
   - Backend API → MariaDB (notifications table) → Backend API → Frontend (Notification Panel)
   - Label: "Job Status Alerts"

**KEY FEATURES CALLOUTS (Small badges around diagram):**
- "Real-time WebSocket Logging"
- "Role-Based Access Control (RBAC)"
- "Auto-detect Generated Reports (CSV/PDF/TXT)"
- "Multi-Server SSH Management"
- "Async Job Queue Processing"
- "Interactive Playbook Execution"
- "Audit Trail & History"
- "Notification System"

**TITLE:** 
- At the top: "InfraAnsible - Infrastructure Automation Platform"
- Subtitle: "Full Stack Architecture & Workflow"

**VISUAL STYLE:**
- Use modern, rounded rectangles for all boxes
- Use vibrant, distinct colors for each layer
- Include relevant icons (cloud, server, database, gear, etc.)
- Use different arrow styles:
  * Solid arrows for API calls
  * Dashed arrows for WebSocket
  * Dotted arrows for SSH connections
  * Thick arrows for main workflows
- Add subtle shadows under main components
- Use a clean white or light gray background
- Make technology badges small and rounded
- Ensure text is readable (dark on light, white on dark)

**ASPECT RATIO:** 16:9 (landscape) for presentation use

---

## Alternative Simplified Version (if the above is too complex):

**SIMPLIFIED PROMPT:**

Create a colorful, modern architecture diagram showing a web application infrastructure. At the top: React Frontend (blue) connected to Flask Backend (green) via REST API and WebSocket. Backend connects to: MariaDB database (purple) on the right, Redis cache (red) on the left, and Celery Worker (orange) below. Celery Worker connects to Ansible automation engine (teal) which connects to multiple Linux servers at the bottom (gray). Show arrows for data flow: user actions → API → task queue → automation → servers, with real-time logs flowing back. Include icons: web browser, server, database, gears, terminal. Title: "InfraAnsible - Infrastructure Automation Platform". Modern, vibrant colors, professional style, landscape orientation.

---

## Tips for Best Results:

1. **For AI Image Generators:**
   - Use the full prompt for detailed diagrams
   - Use the simplified version if the AI struggles with complexity
   - You may need to iterate 2-3 times to get the exact layout

2. **For Diagramming Tools (Lucidchart, Draw.io, Mermaid):**
   - Use the structure above as a blueprint
   - Manually create based on the layer descriptions

3. **Color Palette:**
   - Frontend: #3B82F6 (Blue)
   - Backend: #10B981 (Green)
   - Celery: #F59E0B (Orange)
   - Redis: #EF4444 (Red)
   - Database: #8B5CF6 (Purple)
   - Ansible: #14B8A6 (Teal)
   - Servers: #6B7280 (Gray)

---

## Expected Output:

A professional, easy-to-understand diagram that shows:
- All technology components clearly labeled
- Clear data flow and interactions
- Modern, engaging visual style
- Suitable for presentations, documentation, or stakeholder demos
