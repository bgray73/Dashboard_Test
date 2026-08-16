# Proxmox Datacenter Manager

Automated setup scripts for deploying and managing Proxmox Datacenter Manager.

## Scripts

### setup-pdm.sh

Deploy PDM as a VM with PBS backup configuration.

**Usage:**
```bash
./scripts/proxmox/setup-pdm.sh
```

**Configuration (via environment variables):**
```bash
export PDM_VM_ID=100           # VM ID for PDM
export PDM_NAME=pdm             # VM name
export PDM_MEMORY=4096          # RAM in MB
export PDM_CORES=2              # Number of CPU cores
export PDM_DISK=32              # Disk size in GB
export PDM_STORAGE=local-lvm    # Storage pool name
export PDM_BRIDGE=vmbr0         # Network bridge
export PBS_BACKUPSTORE=backup-store  # PBS datastore name
```

**What the script does:**
1. Verifies Proxmox VE environment
2. Downloads PDM ISO to Proxmox template directory
3. Creates PDM VM with optimized settings
4. Prepares backup configuration guidance
5. Shows next steps for completion

**After running:**
```bash
# Start the PDM VM
qm start ${PDM_VM_ID}

# Connect via serial console for installation
qm terminal ${PDM_VM_ID}

# SSH into PDM VM after installation and set up backups:
pdmctl backup schedule create \
  --schedule "0 2 * * *" \
  --retention 30 \
  --output /var/lib/pve-backup
```

## Quick Reference

### One-liner PDM deployment:
```bash
PDM_VM_ID=100 PDM_MEMORY=4096 PDM_CORES=2 PDM_DISK=32 \
  ./scripts/proxmox/setup-pdm.sh
```

### Add clusters via CLI:
```bash
pdmctl remote add --type pve --id cluster-a \
  --api-endpoint https://pve1.domain.com:8006/api2/json \
  --user root@pam --password 'secret'
```

### Schedule PDM backups:
```bash
# Daily backup at 2 AM
pdmctl backup schedule create \
  --schedule "0 2 * * *" \
  --retention 30 \
  --output /mnt/pbs/backups

# Weekly backup on Sundays
pdmctl backup schedule create \
  --schedule "0 3 * * 0" \
  --retention 90 \
  --output /mnt/pbs/backups
```

## Related Docs

- [Proxmox Datacenter Manager Deployment Options](./infrastructure/proxmox-datacenter-manager.md)