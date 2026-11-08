import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, Building2, WalletCards } from "lucide-react";
import "./finance-nav.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>
    <nav className="admin-tools" aria-label="Super administrator tools">
      <span>PAN NETWORK CONTROL</span>
      <div><Link href="/admin"><Building2 size={14} /> Company operations</Link><Link href="/admin/finance"><WalletCards size={14} /> Credits &amp; pricing</Link><Link href="/admin/scan-risk"><Activity size={14} /> Global scan risk</Link></div>
    </nav>
    {children}
  </>;
}
