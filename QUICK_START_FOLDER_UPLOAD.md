# 🚀 Quick Start Guide - Folder Upload Feature

## Application Access
**URL**: http://192.168.10.200:5174  
**Login**: testuser / password123

---

## Upload a Folder Playbook (3 Steps)

### Option 1: ZIP Upload (Recommended)

**1. Create ZIP of your Ansible project:**
```bash
zip -r my-playbook.zip my-ansible-folder/
```

**2. Upload in UI:**
- Click "Upload" button
- Select "📦 ZIP Folder"
- Choose your ZIP file
- Enter main playbook path (e.g., `site.yml` or `playbooks/main.yml`)
- Enter playbook name
- Click "Upload Playbook"

**3. Done!**
- See folder icon 📁 with file count
- Green download button appears
- Ready to execute

---

## Download a Folder Playbook

1. Find folder playbook (has 📁 icon)
2. Click green **Download** button
3. ZIP file downloads with current state (including edits)

---

## Features Overview

| Feature | Single File | Folder (ZIP) |
|---------|-------------|--------------|
| Upload | ✅ .yml/.yaml | ✅ ZIP (max 20MB) |
| Max Size | 500 KB | 20 MB |
| Icon | 📄 Blue | 📁 Yellow |
| Download | ❌ | ✅ |
| Execute | ✅ | ✅ |
| Multi-Server | ✅ | ✅ |
| Edit | ✅ | ⏳ (coming soon) |

---

## Supported File Types in ZIP

✅ **Allowed**: `.yml`, `.yaml`, `.j2`, `.py`, `.sh`, `.cfg`, `.ini`, `.json`, `.xml`, `.conf`, `.txt`, `.md`

❌ **Blocked**: `.exe`, `.dll`, `.bin`, `.so`, `.bat`, `.cmd` (security)

---

## Your Data Status

✅ **3 existing playbooks** - All preserved and working  
✅ **Database** - Upgraded successfully  
✅ **No data loss** - Everything intact  

---

## Services Running

- ✅ Backend: http://192.168.10.200:5000
- ✅ Frontend: http://192.168.10.200:5174
- ✅ Celery: Ready
- ✅ Redis: Active

---

## Sample Folder Structure

```
my-ansible-project/
├── site.yml              ← Main playbook
├── roles/
│   └── webserver/
│       ├── tasks/
│       │   └── main.yml
│       ├── templates/
│       │   └── nginx.conf.j2
│       └── vars/
│           └── main.yml
├── inventory/
│   └── hosts
└── group_vars/
    └── all.yml
```

**Main playbook**: `site.yml`  
**Total files**: 6  
**Ready to ZIP and upload!**

---

## Need Help?

- **Full Guide**: [FOLDER_UPLOAD_IMPLEMENTATION.md](FOLDER_UPLOAD_IMPLEMENTATION.md)
- **Deployment Details**: [DEPLOYMENT_SUCCESS.md](DEPLOYMENT_SUCCESS.md)
- **Project Setup**: [Documentation/Quick Startup.md](Documentation/Quick%20Startup.md)

---

**Everything is ready to use! 🎉**
