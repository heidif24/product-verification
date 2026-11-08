import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, AppWindow, BadgeCheck, ClipboardList, UsersRound, WalletCards } from "lucide-react";
import "./workspace-tools.css";

const consumerDownloadUrl = (process.env.NEXT_PUBLIC_PAN_VERIFY_URL || "https://www.pan.ng").replace(/\/$/, "") + "/download";

export default function ManufacturerPortalLayout({ children }: { children: ReactNode }) {
  return <>
    <nav className="workspace-tools" aria-label="Manufacturer tools">
      <span>MANUFACTURER TOOLS</span>
      <div>
        <Link href="/portal/wallet"><WalletCards size={14} /> Wallet</Link>
        <Link href="/portal/reports"><ClipboardList size={14} /> Consumer reports</Link>
        <Link href="/portal/scans"><Activity size={14} /> Scan intelligence</Link>
        <Link href="/portal/team-access"><UsersRound size={14} /> Team &amp; roles</Link>
        <Link href="/portal/activation"><BadgeCheck size={14} /> Activate identities</Link>
        <a href={consumerDownloadUrl} target="_blank" rel="noreferrer"><AppWindow size={14} /> Consumer app</a>
      </div>
    </nav>
    {children}
  </>;
}
