import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { FileDown, Clipboard, RefreshCw, Save } from 'lucide-react';
import { api, type SavedConfiguration } from '@/lib/api';
import { Card } from '@/components/Card';
import { Loading } from '@/components/Loading';
import { cls } from '@/lib/utils';

type FormState = {
  username: string;
  authPassword: string;
  privPassword: string;
  group: string;
  access: string;
  syslogServer: string;
  severity: string;
  ntpServers: string;
  collectorIp: string;
  udpPort: string;
  sourceInterface: string;
  monitorName: string;
  recordName: string;
  exporterName: string;
  direction: string;
};

const CONFIG_VENDORS = ['Cisco IOS / IOS-XE', 'Cisco NX-OS', 'Juniper Junos', 'Arista EOS'];
const CONFIG_TYPES = ['SNMPv3', 'Syslog', 'NTP', 'NetFlow / IPFIX'];

export function ConfigGenerator() {
  const [vendor, setVendor] = useState(CONFIG_VENDORS[0]);
  const [type, setType] = useState(CONFIG_TYPES[0]);
  const [form, setForm] = useState<FormState>({
    username: 'labops-monitor',
    authPassword: '',
    privPassword: '',
    group: 'LABOPS-GROUP',
    access: 'read-only',
    syslogServer: '192.168.1.50',
    severity: 'informational',
    ntpServers: '192.168.1.50',
    collectorIp: '192.168.1.50',
    udpPort: '2055',
    sourceInterface: 'Loopback0',
    monitorName: 'LABOPS-MONITOR',
    recordName: 'LABOPS-RECORD',
    exporterName: 'LABOPS-EXPORTER',
    direction: 'ingress',
  });
  const [savedConfigs, setSavedConfigs] = useState<SavedConfiguration[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [associatedDeviceId, setAssociatedDeviceId] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    try {
      const [devicesRes, configsRes] = await Promise.all([api.devices(), api.saved()]);
      setDevices(devicesRes || []);
      setSavedConfigs(configsRes || []);
      const settings = await api.settings();
      if (CONFIG_VENDORS.includes(settings.defaultConfigVendor)) {
        setVendor(settings.defaultConfigVendor);
      }
    } catch (error) {
      console.error('Failed to load page data:', error);
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [key]: e.target.value });
  };

  const clear = () => {
    setForm({
      username: 'labops-monitor',
      authPassword: '',
      privPassword: '',
      group: 'LABOPS-GROUP',
      access: 'read-only',
      syslogServer: '192.168.1.50',
      severity: 'informational',
      ntpServers: '192.168.1.50',
      collectorIp: '192.168.1.50',
      udpPort: '2055',
      sourceInterface: 'Loopback0',
      monitorName: 'LABOPS-MONITOR',
      recordName: 'LABOPS-RECORD',
      exporterName: 'LABOPS-EXPORTER',
      direction: 'ingress',
    });
  };

  const config = useMemo(() => generateConfig(vendor, type, form), [vendor, type, form]);

  const save = async () => {
    try {
      await api.saveConfig({
        name: name || `${vendor} ${type}`,
        vendor,
        configurationType: type,
        generatedConfiguration: config,
        notes,
        associatedDeviceId: associatedDeviceId ? Number(associatedDeviceId) : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadPage();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const deleteConfig = async (id: number) => {
    try {
      await api.deleteConfig(id);
      loadPage();
    } catch (error) {
      console.error('Failed to delete config:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isSnmp = type === 'SNMPv3';
  const isSyslog = type === 'Syslog';
  const isNtp = type === 'NTP';

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Build / configuration"
        title="Configuration generator"
        description="Generate configuration for SNMPv3, syslog, NTP, and flow export."
        action={
          <Link href="/config-generator/saved" className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110">
            <Clipboard size={14} />
            Saved configurations
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <ConfigInputCard
          vendor={vendor}
          type={type}
          form={form}
          devices={devices}
          isSnmp={isSnmp}
          isSyslog={isSyslog}
          isNtp={isNtp}
          update={update}
          clear={clear}
        />

        <div className="space-y-6">
          <OutputCard
            config={config}
            name={name}
            setName={setName}
            notes={notes}
            setNotes={setNotes}
            associatedDeviceId={associatedDeviceId}
            setAssociatedDeviceId={setAssociatedDeviceId}
            devices={devices}
            save={save}
            clear={clear}
            saved={saved}
          />

          {savedConfigs.length > 0 && (
            <Card className="p-5">
              <h2 className="font-bold mb-4">Saved configurations</h2>
              <div className="divide-y divide-card-border">
                {savedConfigs.map((item) => (
                  <div key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold">{item.name}</h3>
                      <span className="rounded bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">
                        {item.vendor} {item.configurationType}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(item.generatedConfiguration)}
                        className="rounded-md border border-input bg-background px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-secondary/20"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => deleteConfig(item.id)}
                        className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive hover:bg-destructive/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PageTitle({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <p className="mono mb-2 text-[10px] uppercase tracking-[.08em] text-primary">{eyebrow}</p>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ConfigInputCard({
  vendor,
  type,
  form,
  devices,
  isSnmp,
  isSyslog,
  isNtp,
  update,
  clear,
}: {
  vendor: string;
  type: string;
  form: FormState;
  devices: any[];
  isSnmp: boolean;
  isSyslog: boolean;
  isNtp: boolean;
  update: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  clear: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-5">
        <p className="mono text-[10px] uppercase tracking-[.18em] text-primary">01 / Parameters</p>
        <h2 className="mt-2 font-bold">Choose a platform</h2>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground">Vendor</label>
          <select value={vendor} onChange={update('vendor')} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {CONFIG_VENDORS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Configuration type</label>
          <select value={type} onChange={update('type')} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {CONFIG_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        {isSnmp && (
          <>
            <div>
              <label className="text-xs text-muted-foreground">Username</label>
              <input type="text" value={form.username} onChange={update('username')} className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Auth password</label>
              <input type="password" value={form.authPassword} onChange={update('authPassword')} className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Privacy password</label>
              <input type="password" value={form.privPassword} onChange={update('privPassword')} className="mt-1 w-full" />
            </div>
          </>
        )}

        {isSyslog && (
          <div>
            <label className="text-xs text-muted-foreground">Syslog server</label>
            <input type="text" value={form.syslogServer} onChange={update('syslogServer')} className="mt-1 w-full" />
          </div>
        )}

        {isNtp && (
          <div>
            <label className="text-xs text-muted-foreground">NTP servers</label>
            <input type="text" value={form.ntpServers} onChange={update('ntpServers')} className="mt-1 w-full" />
          </div>
        )}
      </div>
    </Card>
  );
}

function OutputCard({
  config,
  name,
  setName,
  notes,
  setNotes,
  associatedDeviceId,
  setAssociatedDeviceId,
  devices,
  save,
  clear,
  saved,
}: {
  config: string;
  name: string;
  setName: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  associatedDeviceId: string;
  setAssociatedDeviceId: (v: string) => void;
  devices: any[];
  save: () => void;
  clear: () => void;
  saved: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="mb-5">
        <p className="mono text-[10px] uppercase tracking-[.18em] text-primary">02 / Output</p>
        <h2 className="mt-2 font-bold">Configuration preview</h2>
      </div>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full mb-2 border p-2" />
      <textarea value={config} readOnly className="w-full h-32 mb-2 border p-2 font-mono text-xs" />
      <div className="flex gap-2">
        <button onClick={clear} className="px-3 py-1 border rounded">Clear</button>
        <button onClick={save} disabled={!config.trim()} className="px-3 py-1 bg-primary text-white rounded">{saved ? 'Saved!' : 'Save'}</button>
      </div>
    </Card>
  );
}

function generateConfig(vendor: string, type: string, form: FormState): string {
  const auth = form.authPassword || '<AUTH_PASSWORD>';
  const priv = form.privPassword || '<PRIV_PASSWORD>';
  const group = form.group || 'LABOPS-GROUP';
  const access = form.access || 'read-only';
  const collector = form.collectorIp || '192.168.1.50';
  const port = form.udpPort || '2055';
  const source = form.sourceInterface || 'Loopback0';
  const record = form.recordName || 'LABOPS-RECORD';
  const exporter = form.exporterName || 'LABOPS-EXPORTER';
  const monitor = form.monitorName || 'LABOPS-MONITOR';
  const direction = form.direction || 'ingress';

  if (type === 'SNMPv3') {
    if (vendor === 'Cisco NX-OS') {
      return `snmp-server group ${group} v3 ${access}\nsnmp-server user ${form.username} ${group} auth sha ${auth} priv aes 128 ${priv}`;
    }
    return `snmp-server group ${group} v3 priv\nsnmp-server user ${form.username} ${group} v3 auth sha ${auth} priv aes 128 ${priv}`;
  }

  if (type === 'Syslog') {
    return `logging host ${collector} transport udp port 514\nlogging trap ${form.severity || 'informational'}`;
  }

  if (type === 'NTP') {
    const servers = (form.ntpServers || collector).split(',');
    return servers.map((s) => `ntp server ${s.trim()}`).join('\n');
  }

  // NetFlow / IPFIX
  const ifaceDir = direction === 'ingress' ? 'input' : 'output';
  return `flow record ${record}\n` +
    `  match ipv4 source address\n` +
    `  match ipv4 destination address\n` +
    `flow exporter ${exporter}\n` +
    `destination ${collector}\n` +
    `source ${source}\n` +
    `transport udp ${port}\n` +
    `flow monitor ${monitor}\n` +
    `  record ${record}\n` +
    `interface ${source}\n` +
    `  ip flow monitor ${monitor} ${ifaceDir}`;
}