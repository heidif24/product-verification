"use client";

import { useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Boxes, Building2, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Download,
  FileCheck2, Fingerprint, LayoutDashboard, LifeBuoy, Package, Plus,
  Search, Settings2, ShieldCheck, Sparkles, TrendingUp, Users, Zap
} from "lucide-react";

const activities = [
  { name: "Sunfield Cereal 500g", batch: "GM-2409-A", code: "PAN-8K2F-91", state: "Verified", time: "2 min ago", tone: "green" },
  { name: "Northstar Milk sachet", batch: "PM-2410-C", code: "PAN-4J7Q-22", state: "Verified", time: "18 min ago", tone: "green" },
  { name: "Cocoa House 80g", batch: "CD-2410-B", code: "PAN-9M3R-08", state: "Review flagged", time: "31 min ago", tone: "amber" },
  { name: "ClearSpring Water 75cl", batch: "PL-2410-F", code: "PAN-2T6W-54", state: "Verified", time: "46 min ago", tone: "green" },
];

const bars = [34, 48, 42, 62, 51, 76, 57, 69, 54, 82, 65, 92, 71, 86, 63, 78, 95, 73, 88, 68, 98, 82, 91, 76, 100, 84, 93, 72];

export default function Dashboard() {
  const [active, setActive] = useState("Overview");
  const [period, setPeriod] = useState("Last 30 days");
  const [showNotice, setShowNotice] = useState(true);
  const [search, setSearch] = useState("");
  const nav = [
    { label: "WORKSPACE", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Products", icon: Package }, { name: "Production batches", icon: Boxes }, { name: "Identity issuance", icon: Fingerprint }] },
    { label: "INTELLIGENCE", items: [{ name: "Verification activity", icon: Activity }, { name: "Risk & alerts", icon: ShieldCheck }, { name: "Reports", icon: FileCheck2 }] },
    { label: "ORGANISATION", items: [{ name: "Team members", icon: Users }, { name: "Company profile", icon: Building2 }, { name: "Settings", icon: Settings2 }] },
  ];

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Fingerprint size={22} strokeWidth={1.8}/></div>
          <div><div className="brand-name">pan<span>.</span></div><div className="brand-caption">PRODUCT AUTHENTICATION</div></div>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">N</div>
          <div className="workspace-copy"><strong>Northstar Foods</strong><span>Manufacturer workspace</span></div>
          <ChevronDown size={15} className="muted"/>
        </div>
        <div className="nav-groups">
          {nav.map(group => <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(item => {
              const Icon = item.icon;
              return <button key={item.name} className={`nav-item ${active === item.name ? "selected" : ""}`} onClick={() => setActive(item.name)}>
                <Icon size={17} strokeWidth={1.8}/><span>{item.name}</span>{item.name === "Risk & alerts" && <i className="nav-dot"/>}
              </button>;
            })}
          </div>)}
        </div>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><LifeBuoy size={17}/></div><strong>Need a hand?</strong><p>Our team is here to help you protect every product.</p><button onClick={() => setActive("Help centre")}>Visit help centre <ArrowUpRight size={13}/></button></div>
          <div className="profile-row"><div className="profile-avatar">FO</div><div className="profile-copy"><strong>Felix Okwa</strong><span>Workspace admin</span></div><button className="icon-button" aria-label="Profile options"><ChevronDown size={15}/></button></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="crumb"><span>Workspace</span><span className="slash">/</span><strong>{active}</strong></div>
          <div className="top-actions"><div className="searchbox"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search anything..." /></div><button className="icon-button notification" aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-divider"/><div className="user-mini">FO</div><a href="/portal" className="button button-primary" style={{height:36,padding:"0 12px",fontSize:11}}>Open live portal ↗</a></div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div><div className="eyebrow"><span className="live-pulse"/> FRIDAY, 30 OCTOBER 2026 · DEMO DATA</div><h1>Good afternoon, Felix <span className="wave">✳</span></h1><p className="subheading">Here’s what’s happening across your product network.</p></div>
            <div className="welcome-actions"><button className="button button-light" onClick={() => setActive("Reports")}><Download size={16}/> Export report</button><button className="button button-primary" onClick={() => setActive("Identity issuance")}><Plus size={17}/> Issue product IDs</button></div>
          </div>

          {showNotice && <div className="notice"><div className="notice-icon"><Sparkles size={17}/></div><div className="notice-copy"><strong>Your workspace is taking shape</strong><span>Complete your company profile to unlock trusted manufacturer verification.</span></div><button className="notice-link" onClick={() => setActive("Company profile")}>Complete profile <ArrowUpRight size={14}/></button><button className="notice-close" onClick={() => setShowNotice(false)} aria-label="Dismiss"><span>×</span></button></div>}

          <div className="section-heading"><div><h2>At a glance</h2><p>Your product identity overview</p></div><button className="period-select" onClick={() => setPeriod(period === "Last 30 days" ? "Last 7 days" : "Last 30 days")}><Clock3 size={15}/>{period}<ChevronDown size={14}/></button></div>
          <div className="stats-grid">
            <article className="stat-card"><div className="stat-top"><span className="stat-label">IDENTITIES ISSUED</span><span className="stat-icon mint"><Fingerprint size={17}/></span></div><div className="stat-value">248,590</div><div className="stat-foot"><span className="trend positive"><ArrowUpRight size={14}/> 12.8%</span><span>vs. previous period</span></div><div className="mini-spark"><svg viewBox="0 0 120 28" preserveAspectRatio="none"><path d="M0 22 C12 20 14 15 24 18 S38 23 48 13 S62 18 72 9 S88 14 98 6 S111 9 120 2" /></svg></div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-label">PRODUCT SCANS</span><span className="stat-icon blue"><Activity size={17}/></span></div><div className="stat-value">186,204</div><div className="stat-foot"><span className="trend positive"><ArrowUpRight size={14}/> 8.4%</span><span>vs. previous period</span></div><div className="mini-spark blue-line"><svg viewBox="0 0 120 28" preserveAspectRatio="none"><path d="M0 24 C14 19 16 23 28 13 S42 18 52 11 S68 16 78 8 S91 12 101 4 S112 8 120 2"/></svg></div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-label">VERIFICATION RATE</span><span className="stat-icon gold"><ShieldCheck size={17}/></span></div><div className="stat-value">98.6<span className="value-unit">%</span></div><div className="stat-foot"><span className="trend positive"><ArrowUpRight size={14}/> 1.2%</span><span>vs. previous period</span></div><div className="mini-spark gold-line"><svg viewBox="0 0 120 28" preserveAspectRatio="none"><path d="M0 18 C13 20 18 12 29 16 S43 9 55 12 S67 7 79 9 S91 4 102 6 S112 3 120 2"/></svg></div></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-label">NEEDS ATTENTION</span><span className="stat-icon coral"><ShieldCheck size={17}/></span></div><div className="stat-value">07</div><div className="stat-foot"><span className="trend warning"><span className="tiny-dot"/> 3 new</span><span>unreviewed alerts</span></div><div className="attention-link" onClick={() => setActive("Risk & alerts")}>Review alerts <ArrowUpRight size={13}/></div></article>
          </div>

          <div className="insights-grid">
            <section className="panel chart-panel"><div className="panel-heading"><div><h3>Verification activity</h3><p>Product scans across your network</p></div><button className="more-button" onClick={() => setActive("Verification activity")}>View analytics <ArrowUpRight size={14}/></button></div><div className="chart-summary"><strong>186,204</strong><span className="chart-change"><ArrowUpRight size={14}/> 8.4%</span><span className="chart-caption">scans this month</span></div><div className="chart"><div className="y-labels"><span>12k</span><span>9k</span><span>6k</span><span>3k</span><span>0</span></div><div className="chart-plot"><div className="grid-lines"><i/><i/><i/><i/><i/></div><div className="bars">{bars.map((height, i) => <div key={i} className="bar-wrap"><div className={`bar ${i === 24 ? "bar-highlight" : ""}`} style={{height: `${height}%`}} /></div>)}</div><div className="x-labels"><span>01 Oct</span><span>07 Oct</span><span>14 Oct</span><span>21 Oct</span><span>30 Oct</span></div></div></div><div className="chart-legend"><span><i className="legend-dot"/> Verified scans</span><span><i className="legend-dot soft"/> Flagged for review</span></div></section>

            <section className="panel network-panel"><div className="panel-heading"><div><h3>Network health</h3><p>Identity status distribution</p></div><button className="icon-button" aria-label="Network options"><ChevronDown size={15}/></button></div><div className="donut-wrap"><div className="donut"><div className="donut-inner"><strong>98.6<span>%</span></strong><small>Healthy</small></div></div></div><div className="health-legend"><div><span><i className="health-dot healthy"/> Active identities</span><strong>245,108</strong></div><div><span><i className="health-dot review"/> Under review</span><strong>2,914</strong></div><div><span><i className="health-dot revoked"/> Revoked</span><strong>568</strong></div></div><div className="network-foot"><span><Check size={14}/> Network operating normally</span></div></section>
          </div>

          <section className="panel activity-panel"><div className="panel-heading activity-heading"><div><h3>Recent verification activity</h3><p>The latest product checks from your network</p></div><button className="more-button" onClick={() => setActive("Verification activity")}>See all activity <ArrowUpRight size={14}/></button></div><div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>BATCH REFERENCE</th><th>IDENTITY CODE</th><th>RESULT</th><th>WHEN</th><th/></tr></thead><tbody>{activities.filter(a => (a.name + a.batch + a.code).toLowerCase().includes(search.toLowerCase())).map(a => <tr key={a.code}><td><div className="product-cell"><div className="product-thumb"><Package size={17}/></div><strong>{a.name}</strong></div></td><td className="mono">{a.batch}</td><td className="mono code">{a.code}</td><td><span className={`status-pill ${a.tone}`}><i/>{a.state}</span></td><td className="time-cell">{a.time}</td><td><button className="row-arrow" aria-label={`Open ${a.code}`}><ChevronRight size={16}/></button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing <strong>{activities.filter(a => (a.name + a.batch + a.code).toLowerCase().includes(search.toLowerCase())).length}</strong> recent records</span><div className="pagination"><button aria-label="Previous page"><ChevronLeft size={15}/></button><button className="page-current">1</button><button>2</button><button>3</button><span>…</span><button>12</button><button aria-label="Next page"><ChevronRight size={15}/></button></div></div></section>
          <footer className="footer"><span>© 2026 Product Authentication Network</span><span><span className="footer-status"/> All systems operational</span><span>Built for trust. Designed for everyone.</span></footer>
        </div>
      </section>
    </main>
  );
}
