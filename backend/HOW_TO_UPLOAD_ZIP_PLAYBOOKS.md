# How to Upload ZIP Folder Playbooks

## Overview
The system now automatically detects YAML files in your ZIP and provides a dropdown to select the main playbook file.

## Step-by-Step Guide

### 1. Prepare Your Playbook Folder

Example folder structure:
```
package_installation/
├── group_vars/
│   └── package_list.yml
├── inventory/
│   └── hosts
├── playbook/
│   └── package_installation_upgrade.yml  ← Your main playbook
└── roles/
    └── package_manager/
        ├── defaults/
        │   └── main.yml
        ├── handlers/
        │   └── main.yml
        └── tasks/
            └── main.yml
```

### 2. Create a ZIP File

```bash
# On Linux/Mac
zip -r package_installation.zip package_installation/

# On Windows
# Right-click folder → Send to → Compressed (zipped) folder
```

### 3. Upload via Web Interface

1. **Click "Upload Playbook"** button
2. **Select "ZIP Folder"** upload type
3. **Choose your ZIP file** - The system will:
   - ✅ Automatically analyze the ZIP
   - ✅ Find all YAML files
   - ✅ Show them in a dropdown
   - ✅ Auto-select the most likely main playbook

4. **Select Main Playbook from Dropdown**
   - For your example: Select `playbook/package_installation_upgrade.yml`
   - System shows: "Found X YAML files in ZIP"
   - Recommended file is marked with "(Recommended)"

5. **Enter Playbook Name** (e.g., "Package Installation")
6. **Add Description** (optional)
7. **Click "Upload Playbook"**

## What the System Auto-Detects

The system looks for these files in order of priority:
1. `site.yml` or `site.yaml`
2. `main.yml` or `main.yaml`
3. `playbook.yml` or `playbook.yaml`
4. First YAML file in root directory
5. Any YAML file in the ZIP

## Common Path Formats

✅ **Correct paths** (relative to ZIP root):
- `playbook/package_installation_upgrade.yml`
- `ansible/site.yml`
- `main.yml`
- `roles/deploy/tasks/main.yml`

❌ **Incorrect paths**:
- `/playbook/main.yml` (no leading slash)
- `C:\playbook\main.yml` (no Windows paths)
- `main` (must include .yml or .yaml extension)

## Error Messages You Might See

| Error | Meaning | Solution |
|-------|---------|----------|
| "No YAML files found in ZIP" | ZIP contains no .yml/.yaml files | Ensure your playbook files have .yml or .yaml extension |
| "Main playbook file 'X' not found" | Selected file doesn't exist in ZIP | Choose a file from the dropdown |
| "Invalid ZIP file" | File is corrupted or not a ZIP | Re-create the ZIP file |
| "ZIP too large" | ZIP exceeds 20MB limit | Remove unnecessary files or split playbook |

## Best Practices

1. **Keep playbooks organized** - Use consistent folder structure
2. **Name your main playbook clearly** - Use `site.yml` or `main.yml` for auto-detection
3. **Test locally first** - Run `ansible-playbook` locally before uploading
4. **Include all dependencies** - group_vars, roles, inventory files, etc.
5. **Don't include sensitive data** - Use Ansible Vault or environment variables

## Example: Your Package Installation Playbook

For your structure:
```
package_installation/
└── playbook/
    └── package_installation_upgrade.yml
```

When you upload:
1. System detects: `playbook/package_installation_upgrade.yml`
2. Shows in dropdown
3. You select it (or it's already selected)
4. Upload succeeds!

## Need Help?

If the dropdown doesn't appear or shows wrong files:
1. Check your ZIP file is valid
2. Ensure YAML files have .yml or .yaml extension
3. Try re-creating the ZIP
4. Check browser console for errors
