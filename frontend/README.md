# Infrastructure Automation Platform - Frontend

A production-ready React TypeScript dashboard for managing infrastructure automation with Ansible.

## 🚀 Technology Stack

- **React 18.2** - UI framework
- **TypeScript 5.3** - Type safety (strict mode)
- **Vite 5.0** - Build tool and dev server
- **Zustand 4.4** - State management
- **TailwindCSS 3.3** - Utility-first CSS
- **Axios 1.6** - HTTP client
- **React Router 6.21** - Routing
- **Lucide React** - Icon library

## 📁 Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── api.ts                # Centralized Axios API client
│   ├── components/
│   │   ├── Navbar/
│   │   │   └── Navbar.tsx        # Top navigation bar
│   │   ├── Sidebar/
│   │   │   └── Sidebar.tsx       # Side navigation with role-based menu
│   │   └── StatusBadge/
│   │       └── StatusBadge.tsx   # Job status badge component
│   ├── pages/
│   │   ├── Dashboard/
│   │   │   └── Dashboard.tsx     # Main dashboard with statistics
│   │   ├── LoginPage/
│   │   │   └── LoginPage.tsx     # Authentication page
│   │   ├── ServersPage/
│   │   │   └── ServersPage.tsx   # Server management CRUD
│   │   ├── PlaybooksPage/
│   │   │   └── PlaybooksPage.tsx # Playbook upload and execution
│   │   └── JobDetailsPage/
│   │       └── JobDetailsPage.tsx # Job details with real-time logs
│   ├── store/
│   │   ├── authStore.ts          # Authentication state (Zustand)
│   │   └── uiStore.ts            # UI state management (Zustand)
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   ├── App.tsx                   # Main app with routing
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global styles + Tailwind
│   └── vite-env.d.ts             # Vite type definitions
├── index.html                    # HTML entry point
├── vite.config.ts                # Vite configuration
├── tailwind.config.js            # TailwindCSS configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies
└── .env                          # Environment variables
```

## 🎨 Features

### Authentication
- JWT-based authentication with automatic token refresh
- Protected routes with role-based access control
- Persistent login state via localStorage

### Dashboard
- Real-time statistics (servers, playbooks, jobs, success rate)
- Job status breakdown visualization
- Recent jobs table with quick navigation

### Server Management
- Create, read, update, delete servers
- Test SSH connections
- Filter by environment (dev/staging/production)
- Search functionality
- Role-based permissions (admin/operator can edit)

### Playbook Management
- Upload Ansible playbooks (YAML files)
- View playbook metadata
- Execute playbooks on target servers
- Delete playbooks (admin only)

### Job Execution & Monitoring
- Trigger automation jobs
- Real-time log streaming (auto-refresh every 2 seconds)
- Cancel running jobs
- Download execution logs
- Job status tracking (pending/running/success/failed/cancelled)

### UI/UX
- Responsive design (mobile, tablet, desktop)
- Dark terminal-style log viewer
- Toast notifications for user feedback
- Loading states and error handling
- Role-based UI rendering

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- Backend API running on `http://localhost:5000`

### Installation Steps

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment:**
   ```bash
   # .env file (already created)
   VITE_API_URL=http://localhost:5000/api
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

   Application will be available at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```

   Production files will be in `dist/` directory

5. **Preview production build:**
   ```bash
   npm run preview
   ```

## 🔐 Default Credentials

```
Username: admin
Password: admin123
```

## 🎯 API Integration

The frontend uses Axios with the following features:

- **Base URL:** `/api` (proxied to `http://localhost:5000/api` by Vite)
- **Request Interceptor:** Automatically attaches JWT token from localStorage
- **Response Interceptor:** Handles 401 errors and refreshes tokens automatically
- **Error Handling:** Centralized error handling with user-friendly notifications

### API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | User authentication |
| `/auth/logout` | POST | User logout |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/me` | GET | Get current user |
| `/servers` | GET | List servers |
| `/servers` | POST | Create server |
| `/servers/:id` | GET/PUT/DELETE | Manage server |
| `/servers/:id/test` | POST | Test SSH connection |
| `/playbooks` | GET | List playbooks |
| `/playbooks/upload` | POST | Upload playbook |
| `/playbooks/:id` | GET/PUT/DELETE | Manage playbook |
| `/jobs` | GET/POST | List/create jobs |
| `/jobs/:id` | GET | Get job details |
| `/jobs/:id/cancel` | POST | Cancel job |
| `/jobs/:id/logs` | GET | Get job logs |
| `/jobs/stats` | GET | Get job statistics |

## 🎨 Custom Styling

TailwindCSS configured with custom color palette:

```javascript
colors: {
  primary: { 50-900 },  // Blue shades
  success: { 50-900 },  // Green shades
  warning: { 50-900 },  // Amber shades
  error: { 50-900 },    // Red shades
}
```

## 🔄 State Management

### Auth Store (authStore.ts)
```typescript
- user: User | null
- accessToken: string | null
- isAuthenticated: boolean
- login(credentials)
- logout()
- loadUser()
```

### UI Store (uiStore.ts)
```typescript
- sidebarOpen: boolean
- notifications: Notification[]
- selectedServer/Playbook/Job
- modal states
- addNotification(type, message)
```

## 🚦 Routing

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | LoginPage | Public |
| `/` | Dashboard | Protected |
| `/servers` | ServersPage | Protected |
| `/playbooks` | PlaybooksPage | Protected |
| `/jobs` | Dashboard | Protected |
| `/jobs/:id` | JobDetailsPage | Protected |

## 📱 Responsive Breakpoints

- **Mobile:** < 768px
- **Tablet:** 768px - 1024px
- **Desktop:** > 1024px

## 🧪 Development

### Available Scripts

```bash
npm run dev        # Start dev server (port 5173)
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### TypeScript Strict Mode

All TypeScript files are compiled with strict mode:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

## 🔗 Integration with Backend

1. **Backend must be running** on `http://localhost:5000`
2. **CORS configured** to allow requests from `http://localhost:5173`
3. **JWT tokens** stored in localStorage
4. **Token refresh** handled automatically on 401 responses

## 🎯 Role-Based Access Control

| Feature | Admin | Operator | Viewer |
|---------|-------|----------|--------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Servers | ✅ | ✅ | ✅ |
| Create/Edit Servers | ✅ | ✅ | ❌ |
| Delete Servers | ✅ | ❌ | ❌ |
| Upload Playbooks | ✅ | ✅ | ❌ |
| Execute Jobs | ✅ | ✅ | ❌ |
| View Job Logs | ✅ | ✅ | ✅ |
| Cancel Jobs | ✅ | ✅ | ❌ |

## 🐛 Troubleshooting

### Issue: API calls failing with CORS errors
**Solution:** Ensure backend has CORS enabled for `http://localhost:5173`

### Issue: Token expired errors
**Solution:** Token refresh is automatic. Check backend `/auth/refresh` endpoint

### Issue: Build errors with TypeScript
**Solution:** Run `npm run build` to see detailed errors. All types must be properly defined.

### Issue: Vite proxy not working
**Solution:** Restart dev server after changing `vite.config.ts`

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Vite Documentation](https://vitejs.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## 🔒 Security Best Practices

1. JWT tokens stored in localStorage (consider httpOnly cookies for production)
2. All API calls require authentication
3. Role-based UI rendering
4. Input validation on forms
5. XSS protection via React's built-in escaping
6. CSRF protection via JWT tokens

## 📦 Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Serve the `dist/` directory using:
   - Nginx
   - Apache
   - Node.js (serve-static)
   - Vercel/Netlify

3. Configure environment variable:
   ```
   VITE_API_URL=https://your-api-domain.com/api
   ```

4. Ensure proper CORS configuration on backend

---

**Built with ❤️ for Infrastructure Automation**
