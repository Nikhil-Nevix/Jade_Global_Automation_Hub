# Folder Uploading Enhancement - Structured Playbook Support

**Status:** 🚧 NOT IMPLEMENTED (Infrastructure exists, feature incomplete)  
**Date:** January 30, 2026  
**Priority:** Future Enhancement

---

## 📚 Overview

This document explains the **Structured Playbook** feature - a capability designed to support complex Ansible projects with multiple files, roles, and directory structures. While the database schema exists, the feature is **not implemented** in the codebase.

---

## 🎯 Understanding Ansible Playbook Structures

### What is a Playbook?

An **Ansible playbook** is a YAML file that defines automation tasks to be executed on remote servers. Think of it as a recipe or script for server configuration.

### Two Types of Playbook Organization:

---

## 📄 Type 1: Single File Playbook (✅ CURRENTLY WORKING)

### Structure:
```
my-playbook.yml    ← Everything in one file
```

### Example Content:
```yaml
---
- name: Install and Configure Web Server
  hosts: all
  become: yes
  
  tasks:
    - name: Install Apache
      yum:
        name: httpd
        state: present
    
    - name: Start Apache
      service:
        name: httpd
        state: started
        enabled: yes
    
    - name: Deploy website
      copy:
        src: /local/index.html
        dest: /var/www/html/index.html
```

### When to Use:
- ✅ Simple automation (10-50 tasks)
- ✅ Quick scripts
- ✅ One-time operations
- ✅ Learning/testing

### Limitations:
- ❌ Hard to reuse code
- ❌ Gets messy with 100+ tasks
- ❌ No organization
- ❌ Difficult to maintain

---

## 📁 Type 2: Structured Playbook (❌ NOT IMPLEMENTED)

### Structure:
```
my-web-project/                    ← Directory (complex project)
├── site.yml                       ← Main playbook (entry point)
├── inventory/
│   ├── production
│   └── staging
├── group_vars/
│   ├── webservers.yml
│   └── databases.yml
├── roles/
│   ├── common/
│   │   ├── tasks/
│   │   │   └── main.yml
│   │   ├── handlers/
│   │   │   └── main.yml
│   │   ├── templates/
│   │   ├── files/
│   │   └── defaults/
│   │       └── main.yml
│   ├── webserver/
│   │   ├── tasks/
│   │   ├── handlers/
│   │   ├── templates/
│   │   └── defaults/
│   └── database/
│       ├── tasks/
│       ├── handlers/
│       └── defaults/
└── vars/
    └── main.yml
```

### Main Playbook (site.yml):
```yaml
---
- name: Configure Web Servers
  hosts: webservers
  roles:
    - common
    - webserver

- name: Configure Database Servers
  hosts: databases
  roles:
    - common
    - database
```

### Role Example (roles/webserver/tasks/main.yml):
```yaml
---
- name: Install Apache
  yum:
    name: httpd
    state: present

- name: Configure Apache
  template:
    src: httpd.conf.j2
    dest: /etc/httpd/conf/httpd.conf
  notify: restart apache

- name: Start Apache
  service:
    name: httpd
    state: started
```

### When to Use:
- ✅ Complex projects (100+ tasks)
- ✅ Multiple server types
- ✅ Reusable code (roles)
- ✅ Team collaboration
- ✅ Production environments
- ✅ CI/CD pipelines

### Advantages:
- ✅ **Modular**: Each role is independent
- ✅ **Reusable**: Share roles across projects
- ✅ **Organized**: Clear directory structure
- ✅ **Maintainable**: Easy to update
- ✅ **Scalable**: Handle thousands of tasks

---

## 🗄️ Database Schema

### Current Table Structure:

```sql
CREATE TABLE playbooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NULL,
    file_path VARCHAR(500) NOT NULL,
    playbook_type ENUM('single', 'structured') NOT NULL DEFAULT 'single',
    main_playbook_file VARCHAR(255) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Column Purposes:

| Column | Type | Purpose |
|--------|------|---------|
| `playbook_type` | ENUM('single', 'structured') | Identifies playbook structure type |
| `file_path` | VARCHAR(500) | For single: file path<br>For structured: directory path |
| `main_playbook_file` | VARCHAR(255) | For single: NULL<br>For structured: entry point file (e.g., 'site.yml') |

### Current Database State:

```sql
SELECT id, name, playbook_type, main_playbook_file FROM playbooks;

+----+------------------------+---------------+--------------------+
| id | name                   | playbook_type | main_playbook_file |
+----+------------------------+---------------+--------------------+
|  5 | fetch-basic-details    | single        | NULL               |
|  6 | fetch-server-info      | single        | NULL               |
| 12 | check_security_patches | single        | NULL               |
+----+------------------------+---------------+--------------------+
```

**All values:**
- ✅ `playbook_type` = 'single'
- ❌ `main_playbook_file` = NULL (always)

---

## 🔧 How It SHOULD Work (If Implemented)

### Workflow 1: Single File Playbook (Current System ✅)

#### Step 1: User Upload
```
Frontend Form:
┌─────────────────────────────┐
│ Playbook Name: deploy-app  │
│ Description: Deploy app     │
│ Type: ● Single File         │
│       ○ Structured Project  │
│                             │
│ [Choose File: deploy.yml]   │
│                             │
│     [Upload Playbook]       │
└─────────────────────────────┘
```

#### Step 2: Backend Processing
```python
# playbook_service.py
def create_playbook(name, file_obj, description=None):
    # Generate unique filename
    unique_filename = f"deploy-app_c0351db1.yml"
    
    # Save to disk
    file_path = "/backend/data/playbooks/deploy-app_c0351db1.yml"
    file_obj.save(file_path)
    
    # Create database record
    playbook = Playbook(
        name="deploy-app",
        description="Deploy application",
        file_path=file_path,
        playbook_type='single',  # Default
        main_playbook_file=None
    )
```

#### Step 3: Database Record
```sql
INSERT INTO playbooks (
    name, description, file_path, playbook_type, main_playbook_file
) VALUES (
    'deploy-app',
    'Deploy application',
    '/backend/data/playbooks/deploy-app_c0351db1.yml',
    'single',
    NULL
);
```

#### Step 4: Execution
```python
# tasks.py
def execute_playbook_task(job_id):
    playbook = Playbook.query.get(job.playbook_id)
    
    # For single file:
    playbook_path = playbook.file_path
    # = "/backend/data/playbooks/deploy-app_c0351db1.yml"
    
    runner = ansible_runner.run(
        playbook=playbook_path,
        inventory=inventory,
        ...
    )
```

#### Step 5: Ansible Command
```bash
ansible-playbook /backend/data/playbooks/deploy-app_c0351db1.yml
```

---

### Workflow 2: Structured Playbook (NOT IMPLEMENTED ❌)

#### Step 1: User Upload (MISSING UI)
```
Frontend Form (DOESN'T EXIST):
┌─────────────────────────────────┐
│ Playbook Name: web-infrastructure│
│ Description: Full web stack     │
│ Type: ○ Single File             │
│       ● Structured Project      │
│                                 │
│ Main Playbook File: site.yml   │
│                                 │
│ [Choose Folder or ZIP]          │
│                                 │
│     [Upload Playbook]           │
└─────────────────────────────────┘
```

#### Step 2: Backend SHOULD Receive (NOT IMPLEMENTED)
```javascript
POST /playbooks/upload
Content-Type: multipart/form-data

{
  name: "web-infrastructure",
  description: "Full web stack",
  playbook_type: "structured",
  main_playbook_file: "site.yml",
  file: <web-project.zip binary data>
}
```

#### Step 3: Backend SHOULD Process (NOT IMPLEMENTED)
```python
def create_structured_playbook(name, zip_file, main_file, description=None):
    # Create unique directory
    unique_dirname = f"web-infrastructure_{abc12345}"
    dir_path = f"/backend/data/playbooks/{unique_dirname}/"
    
    # Extract ZIP
    extract_zip(zip_file, dir_path)
    
    # Verify main playbook exists
    main_playbook_path = os.path.join(dir_path, main_file)
    if not os.path.exists(main_playbook_path):
        raise ValueError(f"Main playbook file {main_file} not found")
    
    # Validate directory structure
    validate_ansible_structure(dir_path)
    
    # Create database record
    playbook = Playbook(
        name="web-infrastructure",
        description="Full web stack",
        file_path=dir_path,  # Directory, not file!
        playbook_type="structured",
        main_playbook_file="site.yml"  # Entry point
    )
```

#### Step 4: Database Record SHOULD BE
```sql
INSERT INTO playbooks (
    name, description, file_path, playbook_type, main_playbook_file
) VALUES (
    'web-infrastructure',
    'Full web stack',
    '/backend/data/playbooks/web-infrastructure_abc12345/',
    'structured',
    'site.yml'
);
```

#### Step 5: Execution SHOULD BE (NOT IMPLEMENTED)
```python
def execute_playbook_task(job_id):
    playbook = Playbook.query.get(job.playbook_id)
    
    if playbook.playbook_type == 'structured':
        # Combine directory + main file
        playbook_path = os.path.join(
            playbook.file_path,  # /backend/data/playbooks/web-infrastructure_abc12345/
            playbook.main_playbook_file  # site.yml
        )
        # Result: /backend/data/playbooks/web-infrastructure_abc12345/site.yml
    else:
        playbook_path = playbook.file_path
    
    runner = ansible_runner.run(
        playbook=playbook_path,
        inventory=inventory,
        ...
    )
```

#### Step 6: Ansible SHOULD Execute
```bash
cd /backend/data/playbooks/web-infrastructure_abc12345/
ansible-playbook site.yml
```

Ansible automatically finds and uses all roles, vars, templates from the directory!

---

## 🔍 Technical Deep Dive

### How Ansible Handles Structured Projects

When you run:
```bash
ansible-playbook /path/to/project/site.yml
```

Ansible automatically looks for:
```
/path/to/project/
├── site.yml              ← You execute this
├── roles/                ← Ansible auto-loads roles
│   └── webserver/
│       ├── tasks/        ← Auto-executes tasks/main.yml
│       ├── handlers/     ← Auto-loads handlers/main.yml
│       ├── templates/    ← Auto-finds Jinja2 templates
│       ├── files/        ← Auto-finds static files
│       └── defaults/     ← Auto-loads defaults/main.yml
├── group_vars/           ← Auto-loads variables by group
└── vars/                 ← Auto-loads additional variables
```

**It's automatic!** You just need to:
1. Store the directory structure
2. Execute the main playbook file
3. Ansible handles the rest

---

## 🏗️ Implementation Requirements

### What's Missing (Complete Checklist):

### Backend Changes Needed:

#### 1. Model Update (`app/models.py`)
```python
class Playbook(db.Model):
    """Playbook metadata and file storage"""
    __tablename__ = 'playbooks'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(500), nullable=False)
    
    # ADD THESE MISSING FIELDS:
    playbook_type = db.Column(
        db.Enum('single', 'structured'), 
        default='single', 
        nullable=False
    )
    main_playbook_file = db.Column(db.String(255), nullable=True)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

#### 2. Schema Update (`app/schemas.py`)
```python
class PlaybookCreateSchema(Schema):
    """Schema for creating a new playbook"""
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str()
    
    # ADD THESE:
    playbook_type = fields.Str(
        validate=validate.OneOf(['single', 'structured']),
        missing='single'
    )
    main_playbook_file = fields.Str(validate=validate.Length(max=255))
    
    @validates('main_playbook_file')
    def validate_main_file(self, value):
        playbook_type = self.context.get('playbook_type')
        if playbook_type == 'structured' and not value:
            raise ValidationError('main_playbook_file required for structured playbooks')
```

#### 3. Service Update (`app/services/playbook_service.py`)
```python
import zipfile
import shutil

class PlaybookService:
    
    @staticmethod
    def create_playbook(name, file_obj, playbook_type='single', 
                       main_file=None, description=None, user_id=None):
        """
        Create a new playbook - supports single file or structured project
        """
        # Validate
        if playbook_type == 'structured':
            if not main_file:
                raise ValueError("main_playbook_file required for structured playbooks")
            if not PlaybookService._is_zip_file(file_obj.filename):
                raise ValueError("Structured playbooks must be uploaded as ZIP files")
        
        if playbook_type == 'single':
            return PlaybookService._create_single_playbook(
                name, file_obj, description, user_id
            )
        else:
            return PlaybookService._create_structured_playbook(
                name, file_obj, main_file, description, user_id
            )
    
    @staticmethod
    def _create_single_playbook(name, file_obj, description, user_id):
        """Current implementation - handles single YAML files"""
        # ... existing code ...
    
    @staticmethod
    def _create_structured_playbook(name, zip_file, main_file, description, user_id):
        """NEW - Handle structured playbook uploads"""
        # Generate unique directory name
        unique_id = PlaybookService._generate_unique_id()
        dir_name = f"{secure_filename(name)}_{unique_id}"
        
        upload_folder = current_app.config.get('UPLOAD_FOLDER', './data/playbooks')
        dir_path = os.path.join(upload_folder, dir_name)
        
        # Create directory
        os.makedirs(dir_path, exist_ok=True)
        
        try:
            # Extract ZIP
            with zipfile.ZipFile(zip_file) as zip_ref:
                zip_ref.extractall(dir_path)
            
            # Verify main playbook file exists
            main_playbook_path = os.path.join(dir_path, main_file)
            if not os.path.exists(main_playbook_path):
                raise ValueError(f"Main playbook file '{main_file}' not found in ZIP")
            
            # Validate it's a YAML file
            if not main_file.endswith(('.yml', '.yaml')):
                raise ValueError("Main playbook file must be a .yml or .yaml file")
            
            # Set permissions
            os.chmod(dir_path, 0o750)
            
            # Create playbook record
            playbook = Playbook(
                name=name,
                description=description,
                file_path=dir_path + '/',  # Store directory path with trailing slash
                playbook_type='structured',
                main_playbook_file=main_file,
                is_active=True
            )
            
            db.session.add(playbook)
            db.session.commit()
            
            # Create audit log
            PlaybookService._create_playbook_audit_log(
                playbook_id=playbook.id,
                playbook_name=playbook.name,
                user_id=user_id,
                action='uploaded',
                changes_description=f"Structured playbook '{name}' uploaded"
            )
            
            return playbook
            
        except Exception as e:
            # Cleanup on failure
            if os.path.exists(dir_path):
                shutil.rmtree(dir_path)
            raise e
    
    @staticmethod
    def _is_zip_file(filename):
        """Check if filename is a ZIP file"""
        return filename.lower().endswith('.zip')
```

#### 4. Task Execution Update (`app/tasks.py`)
```python
@celery.task(bind=True, name='app.tasks.execute_playbook_task')
def execute_playbook_task(self, job_id):
    """Execute Ansible playbook asynchronously"""
    try:
        # Get job and related objects
        job = Job.query.get(job_id)
        playbook = Playbook.query.get(job.playbook_id)
        server = Server.query.get(job.server_id)
        
        # Determine playbook path based on type
        if playbook.playbook_type == 'structured':
            # Combine directory path + main playbook file
            playbook_path = os.path.join(
                playbook.file_path,
                playbook.main_playbook_file
            )
        else:
            # Use file path directly
            playbook_path = playbook.file_path
        
        # Verify playbook exists
        if not os.path.exists(playbook_path):
            raise ValueError(f"Playbook file not found: {playbook_path}")
        
        # Execute playbook
        runner = ansible_runner_instance.run_playbook(
            playbook_path=playbook_path,
            inventory=inventory,
            extra_vars=extra_vars,
            private_key_path=private_key_path
        )
        
        # ... rest of execution logic ...
```

#### 5. Delete Operation Update (`app/services/playbook_service.py`)
```python
@staticmethod
def hard_delete_playbook(playbook_id, user_id):
    """Permanently delete playbook and files"""
    playbook = Playbook.query.get(playbook_id)
    
    if playbook.playbook_type == 'single':
        # Delete single file
        if os.path.exists(playbook.file_path):
            os.remove(playbook.file_path)
    else:
        # Delete entire directory
        if os.path.exists(playbook.file_path):
            shutil.rmtree(playbook.file_path)
    
    db.session.delete(playbook)
    db.session.commit()
```

### Frontend Changes Needed:

#### 1. Type Selector (`PlaybooksPage.tsx`)
```tsx
const [playbookType, setPlaybookType] = useState<'single' | 'structured'>('single');
const [mainPlaybookFile, setMainPlaybookFile] = useState<string>('site.yml');

// In upload form:
<div>
  <label>Playbook Type</label>
  <select 
    value={playbookType}
    onChange={(e) => setPlaybookType(e.target.value as 'single' | 'structured')}
  >
    <option value="single">📄 Single File</option>
    <option value="structured">📁 Structured Project</option>
  </select>
</div>

{playbookType === 'structured' && (
  <div>
    <label>Main Playbook File</label>
    <input
      type="text"
      placeholder="site.yml"
      value={mainPlaybookFile}
      onChange={(e) => setMainPlaybookFile(e.target.value)}
    />
    <p className="text-sm text-gray-500">
      The entry point file in your playbook directory
    </p>
  </div>
)}

{playbookType === 'single' ? (
  <input 
    type="file" 
    accept=".yml,.yaml"
    onChange={handleFileChange}
  />
) : (
  <input 
    type="file" 
    accept=".zip"
    onChange={handleZipChange}
  />
)}
```

#### 2. Display Type Badges
```tsx
{playbooks.map(playbook => (
  <tr key={playbook.id}>
    <td>{playbook.name}</td>
    <td>
      {playbook.playbook_type === 'structured' ? (
        <span className="badge badge-primary">
          📁 Structured
        </span>
      ) : (
        <span className="badge badge-secondary">
          📄 Single File
        </span>
      )}
    </td>
    {/* ... */}
  </tr>
))}
```

#### 3. Upload Handler
```tsx
const handleUpload = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('playbook_type', playbookType);
  
  if (playbookType === 'structured') {
    formData.append('main_playbook_file', mainPlaybookFile);
  }
  
  formData.append('file', file);
  
  await playbooksApi.upload(formData);
};
```

---

## 📊 Real-World Example

### Scenario: Deploy 3-Tier Web Application

#### Current System (Single File):
```yaml
# deploy-app.yml (300 lines - messy!)
---
- name: Deploy Everything
  hosts: all
  tasks:
    # 50 tasks for common setup
    - name: Update system
      yum: name=* state=latest
    # ... 48 more ...
    
    # 100 tasks for web servers
    - name: Install Apache
      yum: name=httpd state=present
    # ... 99 more ...
    
    # 100 tasks for database
    # ... 100 more ...
    
    # 50 tasks for monitoring
    # ...
```

**Problems:**
- 😫 300-line file = hard to read
- 🐛 Difficult to debug
- 🚫 Can't reuse code
- 👥 Team conflicts

#### With Structured Support:
```
deploy-app/
├── site.yml                    ← 20 lines (clean!)
├── roles/
│   ├── common/                 ← 50 tasks
│   ├── webserver/              ← 100 tasks
│   ├── database/               ← 100 tasks
│   └── monitoring/             ← 50 tasks
└── group_vars/
    ├── webservers.yml
    └── databases.yml
```

**site.yml** (just 20 lines!):
```yaml
---
- name: Setup Common
  hosts: all
  roles: [common]

- name: Web Servers
  hosts: webservers
  roles: [webserver, monitoring]

- name: Databases
  hosts: databases
  roles: [database, monitoring]
```

---

## ✅ Benefits of Implementation

1. **Modularity**: Independent, reusable roles
2. **Scalability**: Handle complex multi-tier deployments
3. **Collaboration**: Team members work on different roles
4. **Maintenance**: Easy to update specific components
5. **Best Practices**: Follows Ansible community standards
6. **Professional**: Production-grade playbook organization

---

## 🎯 Current Status Summary

| Component | Single File | Structured |
|-----------|-------------|------------|
| **Database Schema** | ✅ Complete | ⚠️ Columns exist but unused |
| **Model Definition** | ✅ Working | ❌ Fields missing from model |
| **Upload Logic** | ✅ Working | ❌ No ZIP handling |
| **Storage** | ✅ Single file | ❌ No directory support |
| **Execution** | ✅ Direct file | ❌ No path joining logic |
| **Frontend UI** | ✅ File input | ❌ No type selector |
| **Delete Operation** | ✅ File removal | ❌ No directory cleanup |

**Implementation Status:** 0% complete  
**Database Schema:** Ready (columns exist)  
**Effort Required:** Medium (2-3 days of development)

---

## 🚀 Implementation Priority

**Recommendation:** LOW PRIORITY

**Reasons:**
- Current single-file approach works for most use cases
- Most users have simple playbooks
- Requires ZIP file handling complexity
- Directory management overhead
- Testing complexity increases

**When to Implement:**
- Users request complex playbook support
- Team uses Ansible roles extensively
- Managing 10+ playbooks with shared code
- Enterprise-scale deployments

---

## 📝 Testing Checklist (When Implemented)

- [ ] Upload single file playbook (existing functionality)
- [ ] Upload ZIP with valid structure
- [ ] Validate main playbook file exists
- [ ] Execute structured playbook successfully
- [ ] Handle missing main playbook file
- [ ] Validate ZIP structure requirements
- [ ] Delete structured playbook (cleanup directory)
- [ ] Display playbook type correctly in UI
- [ ] Edit structured playbook metadata
- [ ] Security: Prevent directory traversal attacks
- [ ] Security: Validate ZIP contents before extraction
- [ ] Performance: Large ZIP file handling

---

## 🔒 Security Considerations

When implementing structured playbook support:

1. **ZIP Bomb Protection**: Limit extracted size
2. **Path Traversal**: Validate all extracted paths
3. **File Type Validation**: Only allow YAML files in ZIP
4. **Size Limits**: Max ZIP size (e.g., 50MB)
5. **Malicious Content**: Scan for dangerous Ansible modules
6. **Directory Permissions**: Restrict extracted file permissions
7. **Cleanup on Failure**: Remove partially extracted files

---

## 📚 Related Documentation

- [Playbook Management](functionalities/Playbook-Management.md)
- [Database Schema Details](Database_Schema_Details.md)
- [Job Execution and Monitoring](functionalities/Job-Execution-and-Monitoring.md)
- [Ansible Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)

---

**Document Version:** 1.0  
**Last Updated:** January 30, 2026  
**Status:** Future Enhancement Proposal
