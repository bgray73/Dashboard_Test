import { Calculator, Wifi } from "lucide-react";
import { Card, PageTitle } from "@/components/ui";

type ToolCardProps = {
  href: string;
  title: string;
  description: string;
  icon: typeof Calculator;
};

export function ToolCard({ href, title, description, icon: Icon }: ToolCardProps) {
  return (
    <a
      href={href}
      className="group rounded-lg border border-card-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/30"
    >
      <div className="mb-9 grid size-10 place-items-center rounded-md bg-accent text-primary">
        <Icon size={19} />
      </div>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      <span className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-primary">
        Open tool <span className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </a>
  );
}

export function Tools() {
  return (
    <>
      <PageTitle
        eyebrow="Utilities / network"
        title="Network tools"
        description="Small, practical calculators for the work between tickets."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ToolCard
          href="/tools/subnet"
          title="Subnet calculator"
          description="Break down an IPv4 CIDR into network, broadcast, host range, and count."
          icon={Calculator}
        />
        <ToolCard
          href="/tools/ping"
          title="Manual ping"
          description="Check reachability from the LabOps host with an explicit timeout."
          icon={Wifi}
        />
      </div>
    </>
  );
}
