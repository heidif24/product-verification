"use client";
import { useState, type FormEvent } from "react";
import "./report-form.css";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";

export default function ReportForm({ code, token }: { code?: string; token?: string }) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("SUSPECTED_COUNTERFEIT");
	const [details, setDetails] = useState("");
	const [email, setEmail] = useState("");
	const [storeName, setStoreName] = useState("");
	const [city, setCity] = useState("");
	const [state, setState] = useState("");
	const [purchaseDate, setPurchaseDate] = useState("");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [reference, setReference] = useState("");

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setMessage("");
		try {
			const path = token ? "/v1/verify/" + encodeURIComponent(token) + "/report" : "/v1/verify/code/" + encodeURIComponent(code || "") + "/report";
			const response = await fetch(API + path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason, details, contactEmail: email || undefined, storeName: storeName || undefined, city: city || undefined, state: state || undefined, purchaseDate: purchaseDate || undefined })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.message || "Your report could not be submitted.");
			setMessage(data.message);
			setReference(data.reference);
			setDetails("");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Your report could not be submitted.");
		} finally {
			setBusy(false);
		}
	}

	return <section className="report-panel">
		<button className="report-toggle" onClick={() => setOpen(!open)}>{open ? "Close report form" : "Something doesn't look right? Report a concern ↗"}</button>
		{open && <form className="report-form" onSubmit={submit}>
			<p>Reports help the manufacturer investigate. A report is not, by itself, proof that a product is counterfeit.</p>
			<label>What is the concern?<select value={reason} onChange={event => setReason(event.target.value)}><option value="SUSPECTED_COUNTERFEIT">I suspect this product may be counterfeit</option><option value="PRODUCT_MISMATCH">The product details do not match the packaging</option><option value="DAMAGED_PACKAGING">The packaging or seal appears damaged</option><option value="DUPLICATE_OR_UNEXPECTED_SCAN">I received an unexpected or repeated scan result</option><option value="OTHER">Other concern</option></select></label>
			<label>What happened?<textarea required minLength={10} maxLength={1500} value={details} onChange={event => setDetails(event.target.value)} placeholder="Describe what you noticed. Do not include sensitive personal information." /></label>
			<div className="report-location-grid"><label>Store or seller (optional)<input maxLength={120} value={storeName} onChange={event => setStoreName(event.target.value)} /></label><label>City<input maxLength={120} value={city} onChange={event => setCity(event.target.value)} /></label><label>State or region<input maxLength={120} value={state} onChange={event => setState(event.target.value)} /></label><label>Purchase date<input type="date" value={purchaseDate} onChange={event => setPurchaseDate(event.target.value)} /></label></div>
			<label>Contact email (optional)<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
			<button className="report-submit" disabled={busy}>{busy ? "Sending…" : "Submit concern"}</button>
			{message && <div className="report-feedback">{message}{reference && <b>Reference: {reference}</b>}</div>}
		</form>}
	</section>;
}
