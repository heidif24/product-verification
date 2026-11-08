import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import "./activation-shortcut.css";

export default function IssuanceLayout({ children }: { children: ReactNode }) {
  return <>
    <nav className="issuance-activation-shortcut" aria-label="Identity lifecycle">
      <span>Printed labels passed quality inspection?</span>
      <Link href="/portal/activation">Activate exported identities <ArrowRight size={15} /></Link>
    </nav>
    {children}
  </>;
}
