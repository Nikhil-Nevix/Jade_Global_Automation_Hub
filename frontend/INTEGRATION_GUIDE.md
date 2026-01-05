# 🔗 Frontend-Backend Integration Guide

Complete guide for integrating the React frontend with the Flask backend.

---

## 🎯 Overview

This guide covers:
1. Backend requirements and setup
2. CORS configuration
3. API endpoint alignment
4. Authentication flow
5. Testing integration
6. Troubleshooting

---

## 📋 Backend Requirements

### Required Backend Endpoints

The frontend expects these endpoints to be available:

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

#### Servers
- `GET /api/servers` - List servers (with pagination)
- `POST /api/servers` - Create server
- `GET /api/servers/:id` - Get server details
- `PUT /api/servers/:id` - Update server
- `DELETE /api/servers/:id` - Delete server
- `POST /api/servers/:id/test` - Test SSH connection

#### Playbooks
- `GET /api/playbooks` - List playbooks (with pagination)
- `POST /api/playbooks/upload` - Upload playbook (multipart/form-data)
- `GET /api/playbooks/:id` - Get playbook details
- `PUT /api/playbooks/:id` - Update playbook
- `DELETE /api/playbooks/:id` - Delete playbook

#### Jobs
- `GET /api/jobs` - List jobs (with pagination and filters)
- `POST /api/jobs` - Create job
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs/:id/cancel` - Cancel job
- `GET /api/jobs/:id/logs` - Get job logs (with pagination)
- `GET /api/jobs/stats` - Get job statistics

#### Health
- `GET /api/health` - Health check endpoint

---

## ⚙️ Backend Configuration

### 1. CORS Setup

The backend must allow requests from the frontend origin.

**Flask CORS Configuration:**

```python
from flask_cors import CORS

app = Flask(__name__)

# Development
CORS(app, origins=["http://localhost:5173"], 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"])

# Production
# CORS(app, origins=["https://your-frontend-domain.com"], 
#      supports_credentials=True,
#      allow_headers=["Content-Type", "Authorization"])
```

**Add to `app/__init__.py`:**

```python
from flask_cors import CORS

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize CORS
    CORS(app, 
         origins=[app.config.get('FRONTEND_URL', 'http://localhost:5173')],
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"],
         expose_headers=["Content-Type", "Authorization"])
    
    # ... rest of initialization
```

**Add to `config.py`:**

```python
class DevelopmentConfig(Config):
    DEBUG = True
    FRONTEND_URL = 'http://localhost:5173'

class ProductionConfig(Config):
    DEBUG = False
    FRONTEND_URL = 'https://your-frontend-domain.com'
```

### 2. JWT Configuration

Ensure JWT settings are compatible:

```python
# config.py
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key')
JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
```

### 3. API Response Format

The frontend expects this response structure:

**Success Response:**
```json
{
  "id": 1,
  "name": "value",
  ...
}
```

**Paginated Response:**
```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "pages": 5
  }
}
```

**Error Response:**
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

---

## 🔐 Authentication Flow

### Login Process

1. **User submits credentials:**
   ```typescript
   POST /api/auth/login
   {
     "username": "admin",
     "password": "admin123"
   }
   ```

2. **Backend validates and returns tokens:**
   ```json
   {
     "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "user": {
       "id": 1,
       "username": "admin",
       "email": "admin@example.com",
       "role": "admin",
       "is_active": true,
       "created_at": "2024-01-01T00:00:00Z",
       "updated_at": "2024-01-01T00:00:00Z",
       "last_login": "2024-01-01T12:00:00Z"
     }
   }
   ```

3. **Frontend stores tokens in localStorage:**
   ```typescript
   localStorage.setItem('access_token', access_token);
   localStorage.setItem('refresh_token', refresh_token);
   ```

4. **Frontend attaches token to all requests:**
   ```typescript
   headers: {
     'Authorization': `Bearer ${access_token}`
   }
   ```

### Token Refresh

When access token expires (401 response):

1. **Frontend detects 401 error**
2. **Automatically calls refresh endpoint:**
   ```typescript
   POST /api/auth/refresh
   Headers: {
     'Authorization': `Bearer ${refresh_token}`
   }
   ```

3. **Backend returns new access token:**
   ```json
   {
     "access_token": "new_token_here"
   }
   ```

4. **Frontend updates token and retries original request**

---

## 🧪 Testing Integration

### Manual Testing Checklist

#### 1. Backend Health Check
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "development",
  "version": "1.0.0"
}
```

#### 2. Login Test
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Should return access_token, refresh_token, and user object.

#### 3. Protected Endpoint Test
```bash
TOKEN="your_access_token_here"

curl http://localhost:5000/api/servers \
  -H "Authorization: Bearer $TOKEN"
```

Should return paginated server list.

#### 4. CORS Test
```bash
curl -X OPTIONS http://localhost:5000/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

Look for `Access-Control-Allow-Origin: http://localhost:5173` in response headers.

---

## 🔧 Frontend Configuration

### Environment Variables

Create `.env` file in frontend directory:

```env
# Development
VITE_API_URL=http://localhost:5000/api

# Production
# VITE_API_URL=https://api.your-domain.com/api
```

### Vite Proxy (Development Only)

Already configured in `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

This allows frontend to call `/api/...` which gets proxied to `http://localhost:5000/api/...`

---

## 📊 Data Models Alignment

### User Model
```typescript
// Frontend (types/index.ts)
interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}
```

```python
# Backend (models.py)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
```

### Server Model
```typescript
// Frontend
interface Server {
  id: number;
  hostname: string;
  ip_address: string;
  os_type: string;
  os_version?: string;
  ssh_port: number;
  ssh_user: string;
  ssh_key_path?: string;
  tags?: Record<string, any>;
  environment?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

Must match backend `Server` model exactly.

### Job Model
```typescript
// Frontend
interface Job {
  id: number;
  job_id: string;
  playbook_id: number;
  server_id: number;
  user_id: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  celery_task_id?: string;
  extra_vars?: Record<string, any>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  playbook?: { id: number; name: string };
  server?: { id: number; hostname: string; ip_address: string };
  user?: { id: number; username: string };
}
```

---

## 🚨 Common Issues & Solutions

### Issue 1: CORS Errors

**Symptom:** Console shows CORS policy error

**Solution:**
1. Verify CORS is installed: `pip install flask-cors`
2. Check CORS configuration includes frontend origin
3. Restart backend after CORS changes
4. Clear browser cache

### Issue 2: 401 Unauthorized

**Symptom:** All API calls return 401

**Solution:**
1. Check JWT token exists in localStorage
2. Verify token format: `Bearer <token>`
3. Check token hasn't expired
4. Test login endpoint directly
5. Verify JWT_SECRET_KEY matches in backend

### Issue 3: Token Refresh Loop

**Symptom:** Infinite refresh requests

**Solution:**
1. Check refresh token is valid
2. Verify `/api/auth/refresh` endpoint works
3. Ensure refresh token expiry is longer than access token
4. Check `_retry` flag in axios interceptor

### Issue 4: File Upload Fails

**Symptom:** Playbook upload returns 400/500

**Solution:**
1. Verify backend accepts `multipart/form-data`
2. Check file size limits
3. Ensure playbook directory exists and is writable
4. Check backend logs for specific error

### Issue 5: Real-time Logs Not Updating

**Symptom:** Job logs don't auto-refresh

**Solution:**
1. Check job status is 'running' or 'pending'
2. Verify auto-refresh is enabled (toggle button)
3. Check `/api/jobs/:id/logs` endpoint works
4. Ensure Celery is running for job execution

### Issue 6: Pagination Issues

**Symptom:** "Next page" doesn't work

**Solution:**
1. Verify backend returns pagination metadata
2. Check page/per_page query parameters
3. Test pagination endpoint directly with curl
4. Review backend pagination implementation

---

## 🎯 Integration Testing Script

Create this bash script to test integration:

```bash
#!/bin/bash
# test-integration.sh

BASE_URL="http://localhost:5000/api"
FRONTEND_URL="http://localhost:5173"

echo "Testing Backend Health..."
curl -s $BASE_URL/health | jq

echo "\nTesting CORS..."
curl -s -X OPTIONS $BASE_URL/auth/login \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -I | grep -i "access-control"

echo "\nTesting Login..."
RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo $RESPONSE | jq -r '.access_token')

if [ "$TOKEN" != "null" ]; then
  echo "✅ Login successful"
  
  echo "\nTesting Protected Endpoint (Servers)..."
  curl -s $BASE_URL/servers \
    -H "Authorization: Bearer $TOKEN" | jq
  
  echo "✅ Integration test complete"
else
  echo "❌ Login failed"
  echo $RESPONSE | jq
fi
```

Run with: `bash test-integration.sh`

---

## 📦 Production Deployment

### Frontend Build
```bash
cd frontend
npm run build
```

### Environment Variables
```env
# Production .env
VITE_API_URL=https://api.your-domain.com/api
```

### Backend Configuration
```python
# Production config
class ProductionConfig(Config):
    DEBUG = False
    FRONTEND_URL = 'https://your-frontend-domain.com'
    # ... other production settings
```

### Nginx Configuration (Optional)

Serve both frontend and backend through Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## ✅ Integration Checklist

Before going to production:

- [ ] Backend health endpoint responds
- [ ] CORS configured for production domain
- [ ] All API endpoints working
- [ ] JWT authentication functional
- [ ] Token refresh works
- [ ] File uploads work
- [ ] Real-time features work
- [ ] Error responses formatted correctly
- [ ] Pagination works on all list endpoints
- [ ] Role-based access control enforced
- [ ] SSL/TLS enabled (HTTPS)
- [ ] Environment variables set correctly
- [ ] Database populated with admin user
- [ ] Celery workers running
- [ ] Redis connection working
- [ ] Frontend build optimized
- [ ] Frontend environment variables set

---

## 📞 Support & Debugging

### Enable Debug Logging

**Backend:**
```python
app.config['DEBUG'] = True
logging.basicConfig(level=logging.DEBUG)
```

**Frontend:**
```typescript
// In api.ts, add console logs
axiosInstance.interceptors.request.use(config => {
  console.log('Request:', config);
  return config;
});
```

### Check Network Tab

In browser DevTools (F12):
1. Go to Network tab
2. Filter by "Fetch/XHR"
3. Watch API requests
4. Check status codes
5. Inspect request/response headers and bodies

---

**Integration complete! 🎉**

Follow this guide to ensure smooth communication between frontend and backend.
