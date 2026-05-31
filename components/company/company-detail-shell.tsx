"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useCompany } from "@/lib/hooks/use-companies";
import { COMPANY_KIND_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

// Shared chrome for /company/* and /customers/[id]/* routes. Owns the
// header + sub-navigation; the section pages slot into `children`.
//
// The page that uses this passes:
//   - companyId — the Company being rendered
//   - baseHref — "/company" or `/customers/${id}`, used to build sub-nav
//   - backHref — where the "back" affordance points (omitted for internal)

interface Props {
  companyId: string;
  baseHref: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
}

export function CompanyDetailShell({
  companyId,
  baseHref,
  backHref,
  backLabel,
  children,
}: Props) {
  const company = useCompany(companyId);
  const pathname = usePathname() ?? "";

  if (!company) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Company not found</h1>
      </div>
    );
  }

  const navItems: NavItem[] = [
    { href: baseHref, label: "Overview" },
    { href: `${baseHref}/people`, label: "People" },
    { href: `${baseHref}/okrs`, label: "OKRs" },
    { href: `${baseHref}/business-units`, label: "Business units" },
  ];

  return (
    <div>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          {backLabel ?? "Back"}
        </Link>
      )}

      <PageHeader
        eyebrow={COMPANY_KIND_LABELS[company.kind]}
        title={
          <span className="inline-flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            {company.name}
          </span>
        }
        meta={
          [company.industry, company.size, company.region]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      <nav className="flex flex-wrap items-center gap-1 mb-6 border-b border-border">
        {navItems.map((item) => {
          const active =
            item.href === baseHref
              ? pathname === baseHref
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 text-[13px] -mb-px border-b-2 transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
