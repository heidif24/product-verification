const API = process.env.PAN_API_URL || "http://localhost:4000/api";
const adminKey = process.env.ADMIN_API_KEY;
const assert = (condition, message) => { if (!condition) throw new Error("PAN smoke test failed: " + message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, { method = "GET", body, token, admin = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (admin) headers["x-pan-admin-key"] = adminKey;
  const response = await fetch(API + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

const suffix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const email = "smoke-" + suffix + "@pan.test";
const registration = await request("/v1/auth/register", {
  method: "POST",
  body: { fullName: "PAN CI Smoke Test", companyName: "PAN Test Manufacturer " + suffix, email, password: "Smoke-test-password-2026!" }
});
assert(registration.status === 201 && registration.data.verificationRequired && registration.data.testVerificationToken, "registration should require email verification");
const verification = await request("/v1/auth/verify-email", { method: "POST", body: { token: registration.data.testVerificationToken } });
assert(verification.status === 201 && verification.data.verified, "email verification should activate the account");
const login = await request("/v1/auth/login", { method: "POST", body: { email, password: "Smoke-test-password-2026!" } });
const token = login.data.accessToken;
const workspace = await request("/v1/manufacturer/me", { token });
const workspaceId = workspace.data.id;
assert(login.status === 201 && token && workspaceId && workspace.data.status === "PENDING", "verified producer should sign in to a pending workspace");

const facility = await request("/v1/manufacturer/facilities", { method: "POST", token, body: { name: "Test production site", facilityType: "MANUFACTURING", address: "1 Test Road", city: "Jos", state: "Plateau", isPrimary: true } });
assert(facility.status === 201 && facility.data.isPrimary, "producer should register a production facility");

const invite = await request("/v1/manufacturer/team/invitations", { method: "POST", token, body: { email: "analyst-" + suffix + "@pan.test", role: "ANALYST" } });
assert(invite.status === 201 && invite.data.testInvitationToken, "owner should send a staff invitation");
const accepted = await request("/v1/manufacturer/invitations/accept", { method: "POST", body: { token: invite.data.testInvitationToken, fullName: "PAN CI Analyst", password: "Analyst-test-password-2026!" } });
assert(accepted.status === 201 && accepted.data.accepted, "invitee should accept the workspace invitation");
const analystLogin = await request("/v1/auth/login", { method: "POST", body: { email: "analyst-" + suffix + "@pan.test", password: "Analyst-test-password-2026!" } });
const analystToken = analystLogin.data.accessToken;
assert(analystLogin.status === 201 && analystLogin.data.workspace.role === "ANALYST", "invited analyst should sign in with read-only role");
const analystWrite = await request("/v1/products", { method: "POST", token: analystToken, body: { name: "Analyst must not create this" } });
assert(analystWrite.status === 403, "analyst must not create products");
const analystRead = await request("/v1/products", { token: analystToken });
assert(analystRead.status === 200, "analyst should be able to read workspace products");

const product = await request("/v1/products", { method: "POST", token, body: { name: "PAN Smoke Test Product", brand: "PAN Test", category: "Test", nafdacRegistrationNumber: "PRODUCER-REFERENCE-123" } });
assert(product.status === 201 && product.data.id, "producer should create a product");

const batch = await request("/v1/products/" + product.data.id + "/batches", { method: "POST", token, body: { batchCode: "SMOKE-" + suffix, quantity: 2, cartonCount: 1, unitsPerCarton: 2 } });
assert(batch.status === 201 && batch.data.id, "producer should create a carton-configured batch");

const pendingCheck = await request("/v1/verify/code/NOT-A-REAL-CODE");
assert(pendingCheck.status === 404, "unknown manual identity should not be recognised");

const pending = await request("/v1/admin/manufacturers?status=PENDING", { admin: true });
assert(pending.status === 200 && pending.data.some(x => x.id === workspaceId), "internal operator endpoint should list pending producer");

const approval = await request("/v1/admin/manufacturers/" + workspaceId + "/approve", {
  method: "POST", admin: true, body: { reason: "Automated smoke test approval for isolated CI workspace" }
});
assert(approval.status === 201 && approval.data.status === "APPROVED", "internal operator should approve producer with a reason");

const job = await request("/v1/manufacturer/batches/" + batch.data.id + "/issuance-jobs", { method: "POST", token, body: { unitQuantity: 2, cartonQuantity: 1 } });
assert(job.status === 201 && job.data.status === "QUEUED", "producer should queue separate carton and unit identities");
let result = null;
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  const poll = await request("/v1/manufacturer/issuance-jobs/" + job.data.id, { token });
  if (poll.status !== 200) throw new Error("PAN smoke test failed: issuance job polling returned " + poll.status);
  if (poll.data.status === "COMPLETED" || poll.data.status === "FAILED") { result = poll.data; break; }
}
assert(result && result.status === "COMPLETED" && result.assets.length === 3, "background worker should complete carton and individual unit issuance");
const carton = result.assets.find(x => x.level === "CARTON");
const units = result.assets.filter(x => x.level === "UNIT");
assert(carton && units.length === 2 && units.every(x => x.parentCode === carton.code), "individual identities should be linked to their carton");

const cartonToken = new URL(carton.verifyUrl).pathname.split("/").filter(Boolean).pop();
const unitToken = new URL(units[0].verifyUrl).pathname.split("/").filter(Boolean).pop();
const cartonCheck = await request("/v1/verify/" + cartonToken);
assert(cartonCheck.status === 200 && cartonCheck.data.status === "VERIFIED" && cartonCheck.data.product.packaging.identityLevel === "CARTON" && cartonCheck.data.product.packaging.containedUnitCount === 2, "carton verification should show linked unit count");
const unitCheck = await request("/v1/verify/" + unitToken);
assert(unitCheck.status === 200 && unitCheck.data.status === "VERIFIED" && unitCheck.data.product.packaging.identityLevel === "UNIT" && unitCheck.data.product.packaging.cartonCode === carton.code, "unit verification should show its parent carton");
assert(unitCheck.data.product.regulatoryReferences.source === "PRODUCER_PROVIDED_NOT_VERIFIED_BY_PAN", "producer regulatory references must be explicitly labelled unverified by PAN");
const repeat = await request("/v1/verify/" + unitToken);
assert(repeat.data.status === "PREVIOUSLY_SCANNED", "repeat scan should be distinguished without claiming counterfeit");
const manual = await request("/v1/verify/code/" + units[1].code);
assert(manual.status === 200 && manual.data.product.packaging.cartonCode === carton.code, "manual unit lookup should preserve carton relationship");

const overIssue = await request("/v1/manufacturer/batches/" + batch.data.id + "/issuance-jobs", { method: "POST", token, body: { unitQuantity: 1, cartonQuantity: 0 } });
assert(overIssue.status === 400, "queued issuance must not exceed production quantity");
const analytics = await request("/v1/analytics/overview", { token });
assert(analytics.data.products === 1 && analytics.data.batches === 1 && analytics.data.identities === 3 && analytics.data.scans >= 4, "manufacturer analytics should reflect unit and carton identities");
const audit = await request("/v1/admin/audit", { admin: true });
assert(audit.status === 200 && audit.data.some(x => x.action === "MANUFACTURER_APPROVED" && x.targetId === workspaceId), "producer approval should be auditable");

const adminLogin = await request("/v1/super-admin/auth/login", { method: "POST", body: { email: process.env.SUPER_ADMIN_EMAIL, password: "PAN-CI-SuperAdmin-2026!" } });
assert(adminLogin.status === 201 && adminLogin.data.accessToken, "separate super administrator login should succeed");
const adminOverview = await request("/v1/super-admin/overview", { token: adminLogin.data.accessToken });
assert(adminOverview.status === 200 && adminOverview.data.companies >= 1, "super administrator should access the network overview");

const forgot = await request("/v1/auth/forgot-password", { method: "POST", body: { email } });
assert(forgot.status === 201 && forgot.data.testResetToken, "password recovery should issue a test-only reset token");
const reset = await request("/v1/auth/reset-password", { method: "POST", body: { token: forgot.data.testResetToken, password: "Smoke-test-new-password-2026!" } });
assert(reset.status === 201 && reset.data.reset, "password reset should succeed");
const oldSession = await request("/v1/products", { token });
assert(oldSession.status === 401, "password reset should revoke previous sessions");
const newLogin = await request("/v1/auth/login", { method: "POST", body: { email, password: "Smoke-test-new-password-2026!" } });
assert(newLogin.status === 201 && newLogin.data.accessToken, "manufacturer should sign in using the new password");

console.log("PAN end-to-end smoke passed: email verification, password recovery/session revocation, facilities, invitations/RBAC, product/batch, carton-unit issuance, secure export retrieval, verification hierarchy, regulatory disclaimers, quantity guards, analytics, audit and super-admin login.");
