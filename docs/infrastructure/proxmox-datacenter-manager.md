# Proxmox Datacenter Manager Deployment Options

**Options for managing 4 Proxmox VE nodes + 1 PBS server.**

## Overview

Proxmox Datacenter Manager (PDM) provides centralized management for multiple Proxmox clusters from a single interface. PDM is free with active Enterprise Support and designed for environments with 2+ clusters.

## Deployment Options

### Option 1: Single PDM VM (Recommended)

Deploy PDM as a single virtual machine on one of your nodes.

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│          Proxmox Datacenter Manager (PDM VM)            │
│                    Web Interface                        │
└────────────┬──────────────────────┬─────────────────────┘
             │                      │
    ┌────────┴────────┐    ┌────────┴────────┐
    │  Cluster A      │    │  Cluster B      │
    │  - Node 1-2     │    │  - Node 3-4     │
    └────────┬────────┘    └────────┬────────┘
             │                      │
    ┌────────┴──────────────────────┴────────┐
    │      Proxmox Backup Server            │
    │      - Centralized Backups            │
    │      - Deduplication                   │
    └────────────────────────────────────────┘
```

**Resource Requirements:**
- **CPU:** 2-4 cores
- **RAM:** 4GB minimum (8GB recommended)
- **Storage:** 50GB SSD
- **Network:** Static IP, connectivity to all clusters

**VM Configuration Example:**
```bash
# Create PDM VM (VM 100)
qm create 100 \
  --name pdm \
  --memory 4096 \
  --cores 2 \
  --bios ovmf \
  --scsihw virtio-scsi-pci \
  --virtio0 local-lvm:32 \
  --net0 virtio,bridge=vmbr0
```

**Pros:**
- Simple deployment and management
- Low resource consumption
- Easy to backup/restore PDM configuration
- Single point of management

**Cons:**
- Single point of failure for management interface
- If PDM dies, VMs keep running but management requires recovery

**Recovery Plan:**
```bash
# Backup PDM configuration regularly
pdmctl backup create --output /backup/pdm-config-$(date +%Y%m%d).tar.gz

# If PDM fails, deploy new instance and restore
pdmctl backup restore --input /backup/pdm-config-latest.tar.gz
```

**When to use:**
- Development/test environments
- Small production environments
- When simplicity outweighs management availability requirements
- Most users with 4-node clusters

---

### Option 2: HA Pair (Enterprise)

Run two PDM instances for high availability.

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│   PDM-1 (Active)        PDM-2 (Standby)               │
│   (Same remotes connected)                              │
└────────────┬──────────────────────┬───────────────────┘
             │                      │
    ┌────────┴────────┐    ┌────────┴────────┐
    │  All Clusters   │    │  All Clusters   │
    │  + PBS         │    │  + PBS         │
    └─────────────────┘    └─────────────────┘
```

**Deployment:**
1. Deploy first PDM instance (Option 1 approach)
2. Deploy second PDM instance pointing to same clusters
3. Use DNS round-robin or load balancer for failover

**Pros:**
- Zero downtime if primary PDM fails
- Redundant management layer
- Can also provide load balancing

**Cons:**
- Double resource consumption (2x PDM VMs)
- Double data collection overhead (PDM polls all nodes from both instances)
- More complex configuration and monitoring
- No built-in HA coordination in PDM yet

**When to use:**
- Mission-critical production environments
- Compliance requirements for management availability
- Large MSP environments where PDM downtime is unacceptable

---

## Initial Configuration

### 1. Install PDM

**Method 1: ISO installation (recommended)**
```bash
# Download PDM ISO
wget https://downloads.proxmox.com/iso/proxmox-datacenter-manager_1.0-1.iso \
  -O /var/lib/vz/template/iso/pdm.iso

# Create VM and install via console
# Access at https://<pdm-ip>:8006/
```

### 2. Add Proxmox Clusters

In PDM Web UI: Datacenter → Clusters → Add

```bash
# Via CLI:
pdmctl remote add --type pve --id cluster-a \
  --api-endpoint https://pve1.example.com:8006/api2/json \
  --user root@pam --password 'secret'

pdmctl remote add --type pve --id cluster-b \
  --api-endpoint https://pve2.example.com:8006/api2/json \
  --user root@pam --password 'secret'
```

### 3. Add Proxmox Backup Server

```bash
pdmctl remote add --type pbs --id pbs-primary \
  --api-endpoint https://pbs.example.com:8007/api2/json \
  --user root@pam --password 'secret' \
  --datastore backup-store
```

### 4. Configure PBS Backup for PDM

```bash
# Schedule daily PDM config backups
pdmctl backup schedule create \
  --schedule "0 2 * * *" \
  --retention 30 \
  --output /backup/pdm-config

# Verify backup schedule
pdmctl backup schedule list
```

## Key Features You'll Use

| Feature | Description |
|---------|-------------|
| Cross-cluster VM migration | Move running VMs between clusters without downtime |
| Update visibility | See all available updates across all nodes in one dashboard |
| Unified task/log view | Filter logs by date, type, user, status across all clusters |
| Capacity planning | Storage/capacity overview across all clusters |
| Custom views | Build tailored dashboards with specific filters |

## Migration Path

Start with **Option 1** (single PDM VM). The management layer is not infrastructure-critical - if PDM goes down, your VMs continue running. Recovery is simply deploying a new PDM instance and restoring from PBS backup.

Only move to **Option 2** (HA pair) if:
- You have compliance requirements for management availability
- You operate as an MSP where PDM downtime is unacceptable
- You've experienced business impact from management interface outages

## Resources

- [Official PDM Overview](https://www.proxmox.com/en/products/proxmox-datacenter-manager/overview)
- [PDM Documentation](https://pdm.proxmox.com/)
- [DevOpsTales Guide](https://devopstales.github.io/virtualization/proxmox-datacenter-manager/)

## Keeping Tool Repositories in Sync

These Proxmox automation scripts are maintained in your Dashboard_Test repository and should be deployed to your Proxmox environment for version control and disaster recovery.

### Repository Structure
```
Dashboard_Test/
├── docs/
│   └── infrastructure/
│       └── proxmox-datacenter-manager.md  ← Main documentation
├── scripts/
│   └── proxmox/
│       ├── setup-pdm.sh                   ← PDM deployment script
│       └── README.md                      ← Script documentation
└── pve-config/                           ← Optional: Proxmox config repo
    ├── scripts/
    │   └── proxmox/
    │       ├── setup-pdm.sh               ← Symlink to ../Dashboard_Test/
    │       └── README.md
    └── README.md                         ← Sync instructions
```

### Sync Method 1: Git Submodules (Recommended)
Maintain the Dashboard_Test repo as a submodule in your Proxmox configuration:

```bash
# On Proxmox host - create config repo
git init /etc/pve-config
cd /etc/pve-config

# Add Dashboard_Test as submodule
git submodule add https://github.com/bgray73/Dashboard_Test.git ../Dashboard_Test
git commit -m "Add Dashboard_Test as submodule"

# Create symlinks for scripts
mkdir -p scripts/proxmox
ln -s ../../Dashboard_Test/scripts/proxmox/*.sh scripts/proxmox/
ln -s ../../Dashboard_Test/scripts/proxmox/*.md scripts/proxmox/
```

### Sync Method 2: Git Worktree
Use git worktree for a single-repo approach:

```bash
# In your Proxmox git repo
git worktree add ../Dashboard_Test-worktree https://github.com/bgray73/Dashboard_Test.git
cd ../Dashboard_Test-worktree/scripts/proxmox
# Scripts are always up-to-date when you pull
```

### Sync Method 3: Rsync Deploys
Automated sync from Dashboard_Test to Proxmox:

```bash
# Create sync script
cat > /usr/local/bin/sync-proxmox-scripts.sh << 'EOF'
#!/bin/bash
set -e
cd /path/to/Dashboard_Test
git pull origin main
rsync -av --delete \
  scripts/proxmox/ \
  root@proxmox-host:/var/lib/pve-storage/scripts/proxmox/
EOF

# Schedule daily sync
echo "0 2 * * * root /usr/local/bin/sync-proxmox-scripts.sh" \
  >> /etc/crontab
```

### Deployment Verification
After syncing, verify sync status:

```bash
# Check script versions match
md5sum scripts/proxmox/setup-pdm.sh
md5sum /var/lib/pve-storage/scripts/proxmox/setup-pdm.sh

# Should be identical - indicates sync successful
```

### Rollback Capability
If a script version causes issues:

```bash
# On Proxmox host
cd /var/lib/pve-storage/scripts/proxmox
git tag PDM_DEPLOY_2025_01_15  # Tag before major change

# If rollback needed:
git checkout PDM_DEPLOY_2025_01_15
# Or restore from your PBS backup if PDM VM existed
```

## Quick Start

Use the automated deployment script:

```bash
# Deploy PDM with defaults (VM 100, 4GB RAM, 2 cores)
./scripts/proxmox/setup-pdm.sh

# Or customize via environment variables
PDM_VM_ID=100 PDM_MEMORY=4096 PDM_CORES=2 ./scripts/proxmox/setup-pdm.sh
```

See [scripts/proxmox/README.md](../scripts/proxmox/README.md) for detailed usage.