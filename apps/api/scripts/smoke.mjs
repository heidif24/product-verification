const API = process.env.PAN_API_URL || "http://localhost:4000/api";
const adminKey = process.env.ADMIN_API_KEY;
const assert = (condition, message) => { if (!condition) throw new Error("PAN smoke test failed: " + message); };

async function request(path, { method = "GET", body, token, admin = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (admin) headers["x-pan-admin-key"] = adminKey;
  const response = await fetch(API + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

const suffix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const registration = await request("/v1/auth/register", {
  method: "POST",
  body: { fullName: "PAN CI Smoke Test", companyName: "PAN Test Manufacturer " + suffix, email: "smoke-" + suffix + "@pan.test", password: "Smoke-test-password-2026!" }
});
assert(registration.status >= 200 && registration.status < 300, "manufacturer registration should succeed");
const token = registration.data.accessToken;
const workspaceId = registration.data.workspace?.id;
assert(token && workspaceId, "registration should return an authenticated workspace");

const profile = await request("/v1/manufacturer/me", { token });
assert(profile.data.status === "PENDING", "new manufacturer should start pending");

const pending = await request("/v1/admin/manufacturers?status=PENDING", { admin: true });
assert(pending.status === 200 && pending.data.some(x => x.id === workspaceId), "admin should see pending manufacturer");

const product = await request("/v1/products", { method: "POST", token, body: { name: "PAN Smoke Test Product", brand: "PAN Test", category: "Test" } });
assert(product.status >= 200 && product.status < 300 && product.data.id, "manufacturer should create a product");

const batch = await request("/v1/products/" + product.data.id + "/batches", { method: "POST", token, body: { batchCode: "SMOKE-" + suffix, quantity: 1 } });
assert(batch.status >= 200 && batch.status < 300 && batch.data.id, "manufacturer should create a production batch");

const issued = await request("/v1/batches/" + batch.data.id + "/identities", { method: "POST", token, body: { quantity: 1 } });
assert(issued.status >= 200 && issued.status < 300 && issued.data.identities?.length === 1, "manufacturer should issue one QR identity");
const identity = issued.data.identities[0];
const url = new URL(identity.verifyUrl);
const rawToken = url.pathname.split("/").filter(Boolean).pop();
assert(rawToken && identity.code.startsWith("PAN-"), "identity should contain a verification token and manual code");

const pendingCheck = await request("/v1/verify/" + rawToken);
assert(pendingCheck.data.status === "MANUFACTURER_PENDING", "pending manufacturer identity must not be represented as approved");

const approval = await request("/v1/admin/manufacturers/" + workspaceId + "/approve", {
  method: "POST", admin: true, body: { reason: "Automated smoke test approval for isolated CI workspace" }
});
assert(approval.status >= 200 && approval.status < 300 && approval.data.status === "APPROVED", "admin should approve manufacturer with a reason");

const firstVerified = await request("/v1/verify/" + rawToken);
assert(firstVerified.data.status === "VERIFIED", "approved identity should verify");
const repeat = await request("/v1/verify/" + rawToken);
assert(repeat.data.status === "PREVIOUSLY_SCANNED", "repeat scan should be distinguished without claiming counterfeit");
const manual = await request("/v1/verify/code/" + identity.code);
assert(manual.data.status === "PREVIOUSLY_SCANNED", "manual product ID should use the same verification record");

const overIssue = await request("/v1/batches/" + batch.data.id + "/identities", { method: "POST", token, body: { quantity: 1 } });
assert(overIssue.status === 400, "system must prevent issuing more identities than batch quantity");

const analytics = await request("/v1/analytics/overview", { token });
assert(analytics.data.products === 1 && analytics.data.batches === 1 && analytics.data.identities === 1 && analytics.data.scans >= 4, "manufacturer analytics should reflect persisted records and scans");

const audit = await request("/v1/admin/audit", { admin: true });
assert(audit.status === 200 && audit.data.some(x => x.action === "MANUFACTURER_APPROVED" && x.targetId === workspaceId), "administrator approval should be auditable");

const login = await request("/v1/auth/login", { method: "POST", body: { email: "smoke-" + suffix + "@pan.test", password: "Smoke-test-password-2026!" } });
assert(login.status >= 200 && login.status < 300 && login.data.accessToken, "manufacturer should be able to sign in");

console.log("PAN end-to-end API smoke test passed: registration, login, product, batch, issuance, pending/approved verification, repeat scan, manual lookup, quantity guard, analytics and audit log.");
