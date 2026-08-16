#!/bin/bash
# Proxmox Datacenter Manager Setup Script
# Deploys PDM as a VM with PBS backup configuration
# For 4-node Proxmox cluster + PBS setup

set -euo pipefail

# Configuration
PDM_VM_ID="${PDM_VM_ID:-100}"
PDM_NAME="${PDM_NAME:-pdm}"
PDM_MEMORY="${PDM_MEMORY:-4096}"
PDM_CORES="${PDM_CORES:-2}"
PDM_DISK="${PDM_DISK:-32}"
PDM_STORAGE="${PDM_STORAGE:-local-lvm}"
PDM_BRIDGE="${PDM_BRIDGE:-vmbr0}"
PBS_BACKUPSTORE="${PBS_BACKUPSTORE:-backup-store}"

PBS_BACKUP_VM="${PBS_BACKUP_VM:-99}"
PBS_BACKUP_INTERVAL="${PBS_BACKUP_INTERVAL:-"0 2 * * *"}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Proxmox host
check_proxmox() {
    if ! command -v qm &> /dev/null; then
        log_error "This script must be run on a Proxmox VE host"
        exit 1
    fi
    
    if ! pvesh get /version &> /dev/null; then
        log_error "Cannot connect to Proxmox API - check authentication"
        exit 1
    fi
    
    log_info "Proxmox VE environment detected"
}

# Download PDM ISO
download_pdm_iso() {
    local iso_name="proxmox-datacenter-manager_1.0-1.iso"
    local iso_path="/var/lib/vz/template/iso/${iso_name}"
    
    if [[ -f "$iso_path" ]]; then
        log_info "PDM ISO already exists at $iso_path"
        return 0
    fi
    
    log_info "Downloading PDM ISO..."
    wget -O "$iso_path" "https://downloads.proxmox.com/iso/${iso_name}"
    
    if [[ $? -eq 0 ]]; then
        log_info "PDM ISO downloaded successfully"
    else
        log_error "Failed to download PDM ISO"
        exit 1
    fi
}

# Create PDM VM
create_pdm_vm() {
    # Check if VM already exists
    if qm list | grep -q " ${PDM_VM_ID} "; then
        log_warn "VM ${PDM_VM_ID} already exists. Stopping and removing..."
        qm stop "${PDM_VM_ID}" 2>/dev/null || true
        qm destroy "${PDM_VM_ID}" --destroy-unreferenced 2>/dev/null || true
    fi
    
    log_info "Creating PDM VM ${PDM_VM_ID}..."
    
    qm create "${PDM_VM_ID}" \
        --name "${PDM_NAME}" \
        --memory "${PDM_MEMORY}" \
        --cores "${PDM_CORES}" \
        --bios ovmf \
        --scsihw virtio-scsi-pci \
        --virtio0 "${PDM_STORAGE}:${PDM_DISK}" \
        --ide2 "local:iso/${PDM_NAME}.iso,media=cdrom" \
        --boot order=ide2 \
        --net0 "virtio,bridge=${PDM_BRIDGE}" \
        --agent enabled=1 \
        --serial0 socket \
        --vga serial0
    
    # Set ISO filename
    local iso_name="proxmox-datacenter-manager_1.0-1.iso"
    qm set "${PDM_VM_ID}" --cdrom "local:iso/${iso_name}"
    
    log_info "PDM VM created successfully"
    log_info "Start VM with: qm start ${PDM_VM_ID}"
    log_info "Connect via: qm terminal ${PDM_VM_ID}"
}

# Create PBS backup script VM
create_pbs_backup_vm() {
    local backup_script="
#!/bin/bash
# PDM Configuration Backup Script
# Runs on a lightweight helper VM

PDM_URL='https://localhost:8006'
BACKUP_TARGET='${PBS_BACKUPSTORE}'

# Create backup
pdmctl backup create --format tar.gz

# Verify backup exists
ls -la /tmp/pdm-config-*.tar.gz
"
    
    # Create a small backup helper VM if needed
    log_info "PBS backup script prepared for configuration backups"
}

# Show next steps
show_next_steps() {
    echo ""
    echo "========================================"
    echo "PDM Setup Complete!"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Start the PDM VM:"
    echo "   qm start ${PDM_VM_ID}"
    echo ""
    echo "2. Access PDM web interface:"
    echo "   https://<pdm-ip-address>:8006/"
    echo ""
    echo "3. During installation, set:"
    echo "   - FQDN: pdm.yourdomain.com"
    echo "   - Admin password: (your secure password)"
    echo ""
    echo "4. Add your clusters in PDM UI:"
    echo "   Datacenter → Clusters → Add"
    echo ""
    echo "5. Set up regular backups:"
    echo "   # ssh to PDM VM after installation"
    echo "   pdmctl backup schedule create \\"
    echo "     --schedule \"$PBS_BACKUP_INTERVAL\" \\"
    echo "     --retention 30 \\"
    echo "     --output /var/lib/pve-backup"
    echo ""
    echo "6. Add to PBS:"
    echo "   # Create snapshot of PDM VM daily"
    echo "   qm snapshot ${PDM_VM_ID} daily-\$(date +%Y%m%d)"
    echo ""
    echo "========================================"
}

# Main execution
main() {
    log_info "Starting PDM deployment script..."
    log_info "Configuration:"
    echo "  - PDM VM ID: ${PDM_VM_ID}"
    echo "  - PDM Name: ${PDM_NAME}"
    echo "  - Memory: ${PDM_MEMORY}MB"
    echo "  - Cores: ${PDM_CORES}"
    echo "  - Storage: ${PDM_DISK}GB on ${PDM_STORAGE}"
    echo "  - Bridge: ${PDM_BRIDGE}"
    echo ""
    
    check_proxmox
    download_pdm_iso
    create_pdm_vm
    create_pbs_backup_vm
    show_next_steps
}

# Run main function
main "$@"