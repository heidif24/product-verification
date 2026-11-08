const API = process.env.PAN_API_URL || "http://localhost:4000/api";
const assert = (condition, message) => { if (!condition) throw new Error("PAN smoke test failed: " + message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForJob(jobId, token) {
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    const poll = await request("/v1/manufacturer/issuance-jobs/" + jobId, { token });
    if (poll.status !== 200) throw new Error("PAN smoke test failed: issuance job polling returned " + poll.status);
    if (poll.data.status === "COMPLETED" || poll.data.status === "FAILED") return poll.data;
  }
  return null;
}

async function request(path, { method = "GET", body, token, scanSession } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (scanSession) headers["X-PAN-Scan-Session"] = scanSession;
  const response = await fetch(API + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

const suffix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const email = "smoke-" + suffix + "@pan.test";
const longPasswordRegistration = await request("/v1/auth/register", { method: "POST", body: { fullName: "PAN CI Smoke Test", companyName: "PAN Password Boundary " + suffix, email, password: "a".repeat(73) } });
assert(longPasswordRegistration.status === 400, "registration must reject bcrypt passwords longer than 72 bytes");
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
assert((await request("/v1/manufacturer/wallet", { token: analystToken })).status === 403, "analyst must not read finance ledger data");
const financeInvite = await request("/v1/manufacturer/team/invitations", { method: "POST", token, body: { email: "finance-" + suffix + "@pan.test", role: "FINANCE" } });
assert(financeInvite.status === 201, "owner should invite a finance-role member");
const financeAccept = await request("/v1/manufacturer/invitations/accept", { method: "POST", body: { token: financeInvite.data.testInvitationToken, fullName: "PAN CI Finance", password: "Finance-test-password-2026!" } });
assert(financeAccept.status === 201, "finance invite should be accepted");
const financeLogin = await request("/v1/auth/login", { method: "POST", body: { email: "finance-" + suffix + "@pan.test", password: "Finance-test-password-2026!" } });
assert(financeLogin.status === 201 && financeLogin.data.workspace.role === "FINANCE", "finance member should receive the finance role");
assert((await request("/v1/manufacturer/wallet", { token: financeLogin.data.accessToken })).status === 200, "finance member should read the company wallet");
assert((await request("/v1/manufacturer/documents", { token: financeLogin.data.accessToken })).status === 403, "finance member must not read private company documents");
const supportInvite = await request("/v1/manufacturer/team/invitations", { method: "POST", token, body: { email: "support-" + suffix + "@pan.test", role: "SUPPORT" } });
assert(supportInvite.status === 201, "owner should invite a support-role member");
const supportAccept = await request("/v1/manufacturer/invitations/accept", { method: "POST", body: { token: supportInvite.data.testInvitationToken, fullName: "PAN CI Support", password: "Support-test-password-2026!" } });
assert(supportAccept.status === 201, "support invite should be accepted");
const supportLogin = await request("/v1/auth/login", { method: "POST", body: { email: "support-" + suffix + "@pan.test", password: "Support-test-password-2026!" } });
assert(supportLogin.status === 201 && supportLogin.data.workspace.role === "SUPPORT", "support member should receive the support role");
assert((await request("/v1/manufacturer/reports", { token: supportLogin.data.accessToken })).status === 200, "support member should read manufacturer reports");
assert((await request("/v1/manufacturer/wallet", { token: supportLogin.data.accessToken })).status === 403, "support member must not read the wallet");

const product = await request("/v1/products", { method: "POST", token, body: { name: "PAN Smoke Test Product", brand: "PAN Test", category: "Test", nafdacRegistrationNumber: "PRODUCER-REFERENCE-123" } });
assert(product.status === 201 && product.data.id, "producer should create a product");

const batch = await request("/v1/products/" + product.data.id + "/batches", { method: "POST", token, body: { batchCode: "SMOKE-" + suffix, quantity: 2, cartonCount: 1, unitsPerCarton: 2 } });
assert(batch.status === 201 && batch.data.id, "producer should create a carton-configured batch");

const pendingCheck = await request("/v1/verify/code/NOT-A-REAL-CODE");
assert(pendingCheck.status === 404, "unknown manual identity should not be recognised");

const adminLogin = await request("/v1/super-admin/auth/login", { method: "POST", body: { email: process.env.SUPER_ADMIN_EMAIL, password: "PAN-CI-SuperAdmin-2026!" } });
assert(adminLogin.status === 201 && adminLogin.data.accessToken, "separate super administrator login should succeed");
const pending = await request("/v1/super-admin/companies?status=PENDING", { token: adminLogin.data.accessToken });
assert(pending.status === 200 && pending.data.some(x => x.id === workspaceId), "internal operator endpoint should list pending producer");

const approval = await request("/v1/super-admin/companies/" + workspaceId + "/status", {
  method: "POST", token: adminLogin.data.accessToken, body: { status: "APPROVED", reason: "Automated smoke test approval for isolated CI workspace" }
});
assert(approval.status === 201 && approval.data.status === "APPROVED", "internal operator should approve producer with a reason");
const creditPackage = await request("/v1/super-admin/credit-packages", { method: "POST", token: adminLogin.data.accessToken, body: { name: "Smoke 10,000 credits", credits: 10000, amountMinor: 1250000, reason: "Smoke test configures a test credit package" } });
assert(creditPackage.status === 201 && creditPackage.data.credits === 10000, "super admin should configure flexible credit packages");
const promotion = await request("/v1/super-admin/companies/" + workspaceId + "/promotional-credit", { method: "POST", token: adminLogin.data.accessToken, body: { amountCredits: 100000, reason: "Smoke test first-company promotional allocation" } });
assert(promotion.status === 201 && promotion.data.granted === 100000, "approved manufacturer should receive its promotional credit allocation");
const duplicatePromotion = await request("/v1/super-admin/companies/" + workspaceId + "/promotional-credit", { method: "POST", token: adminLogin.data.accessToken, body: { amountCredits: 100000, reason: "Smoke test must reject a duplicate promotional allocation" } });
assert(duplicatePromotion.status === 400, "promotional credits must only be granted once per manufacturer");
const walletBefore = await request("/v1/manufacturer/wallet", { token });
assert(walletBefore.status === 200 && walletBefore.data.balance === 100000 && walletBefore.data.packages.some(x => x.id === creditPackage.data.id), "manufacturer wallet should expose its ledger balance and active packages");

const job = await request("/v1/manufacturer/batches/" + batch.data.id + "/issuance-jobs", { method: "POST", token, body: { unitQuantity: 2, cartonQuantity: 1 } });
assert(job.status === 201 && job.data.status === "QUEUED", "producer should queue separate carton and unit identities");
const walletAfterQueue = await request("/v1/manufacturer/wallet", { token });
assert(walletAfterQueue.data.balance === 99997, "issuance credits must be deducted atomically when a job is queued");
const result = await waitForJob(job.data.id, token);
assert(result && result.status === "COMPLETED" && result.assets.length === 3, "background worker should complete carton and individual unit issuance");
const carton = result.assets.find(x => x.level === "CARTON");
const units = result.assets.filter(x => x.level === "UNIT");
assert(carton && units.length === 2 && units.every(x => x.parentCode === carton.code), "individual identities should be linked to their carton");
const identitySearch = await request("/v1/super-admin/identities?q=" + encodeURIComponent(units[0].code), { token: adminLogin.data.accessToken });
assert(identitySearch.status === 200 && identitySearch.data.length === 1 && !("tokenHash" in identitySearch.data[0]), "super-admin identity search must never expose token digests");

const cartonToken = new URL(carton.verifyUrl).pathname.split("/").filter(Boolean).pop();
const unitToken = new URL(units[0].verifyUrl).pathname.split("/").filter(Boolean).pop();
const unactivated = await request("/v1/verify/" + unitToken);
assert(unactivated.status === 200 && unactivated.data.status === "NOT_ACTIVATED", "newly exported identities must not be publicly active before quality approval");
const activation = await request("/v1/manufacturer/batches/" + batch.data.id + "/activate", { method: "POST", token, body: { qualityChecked: true, reason: "Smoke test confirms printed labels were quality checked" } });
assert(activation.status === 201 && activation.data.activated === 3, "manufacturer should activate exported identities after print quality confirmation");
const cartonCheck = await request("/v1/verify/" + cartonToken);
assert(cartonCheck.status === 200 && cartonCheck.data.status === "VERIFIED" && cartonCheck.data.product.packaging.identityLevel === "CARTON" && cartonCheck.data.product.packaging.containedUnitCount === 2, "carton verification should show linked unit count");
const unitCheck = await request("/v1/verify/" + unitToken);
assert(unitCheck.status === 200 && unitCheck.data.status === "VERIFIED" && unitCheck.data.product.packaging.identityLevel === "UNIT" && unitCheck.data.product.packaging.cartonCode === carton.code, "unit verification should show its parent carton");
assert(unitCheck.data.product.regulatoryReferences.source === "PRODUCER_PROVIDED_NOT_VERIFIED_BY_PAN", "producer regulatory references must be explicitly labelled unverified by PAN");
const repeat = await request("/v1/verify/" + unitToken);
assert(repeat.data.status === "PREVIOUSLY_SCANNED", "repeat scan should be distinguished without claiming counterfeit");
const firstScanSession = "40000000-0000-4000-8000-000000000001";
const firstSessionScan = await request("/v1/verify/" + unitToken, { scanSession: firstScanSession });
const refreshedSessionScan = await request("/v1/verify/" + unitToken, { scanSession: firstScanSession });
assert(refreshedSessionScan.data.duplicateScan && refreshedSessionScan.data.scansRecorded === firstSessionScan.data.scansRecorded, "same-session refreshes must not count as independent scans");
let riskScan;
for (let index = 2; index <= 10; index++) {
  const sessionId = "40000000-0000-4000-8000-" + String(index).padStart(12, "0");
  riskScan = await request("/v1/verify/" + unitToken, { scanSession: sessionId });
}
assert(riskScan.data.status === "SUSPICIOUS_ACTIVITY", "ten distinct scan sessions in one day should raise a non-accusatory risk warning");
const riskQueue = await request("/v1/manufacturer/scan-risk", { token });
assert(riskQueue.status === 200 && riskQueue.data.some(x => x.identity?.publicCode === units[0].code), "manufacturer risk queue should show suspicious identity activity");
const manual = await request("/v1/verify/code/" + units[1].code);
assert(manual.status === 200 && manual.data.product.packaging.cartonCode === carton.code, "manual unit lookup should preserve carton relationship");
const concern = await request("/v1/verify/code/" + units[0].code + "/report", { method: "POST", body: { reason: "PRODUCT_MISMATCH", details: "The printed product details do not match the information shown by the PAN identity check." } });
assert(concern.status === 201 && concern.data.reference, "consumer should be able to report a product concern");
const manufacturerReports = await request("/v1/manufacturer/reports?status=OPEN", { token });
assert(manufacturerReports.status === 200 && manufacturerReports.data.some(x => x.id === concern.data.reference), "manufacturer should receive consumer reports linked to its identities");
const linkedReport = manufacturerReports.data.find(x => x.id === concern.data.reference);
assert(linkedReport.identity && !("tokenHash" in linkedReport.identity) && linkedReport.identity.events.every(x => !("sessionHash" in x)), "manufacturer report details must not expose token or scan-session hashes");
assert(linkedReport.identity.events.some(x => x.isIndependent === false), "manufacturer report timeline should retain duplicate refresh events without counting them independently");
const analystReports = await request("/v1/manufacturer/reports?status=OPEN", { token: analystToken });
assert(analystReports.status === 200 && analystReports.data.some(x => x.id === concern.data.reference), "analyst should be able to review workspace reports");
const analystReportWrite = await request("/v1/manufacturer/reports/" + concern.data.reference + "/status", { method: "POST", token: analystToken, body: { status: "IN_REVIEW", note: "Analyst cannot write report decisions." } });
assert(analystReportWrite.status === 403, "analysts must not change consumer report states");
const manufacturerReportReview = await request("/v1/manufacturer/reports/" + concern.data.reference + "/status", { method: "POST", token, body: { status: "IN_REVIEW", note: "Manufacturer support is investigating the product mismatch." } });
assert(manufacturerReportReview.status === 201 && manufacturerReportReview.data.status === "IN_REVIEW", "manufacturer support should update its own report with an audit note");


const looseBatch = await request("/v1/products/" + product.data.id + "/batches", { method: "POST", token, body: { batchCode: "LOOSE-" + suffix, quantity: 2, cartonCount: 1, unitsPerCarton: 2 } });
assert(looseBatch.status === 201, "producer should create a second carton-configured batch");
const looseJob = await request("/v1/manufacturer/batches/" + looseBatch.data.id + "/issuance-jobs", { method: "POST", token, body: { unitQuantity: 2, cartonQuantity: 0 } });
const looseResult = await waitForJob(looseJob.data.id, token);
assert(looseResult?.status === "COMPLETED" && looseResult.assets.length === 2, "unit-only identities should issue before carton labels");
const cartonOnlyJob = await request("/v1/manufacturer/batches/" + looseBatch.data.id + "/issuance-jobs", { method: "POST", token, body: { unitQuantity: 0, cartonQuantity: 1 } });
assert(cartonOnlyJob.status === 201, "carton-only job should accept existing unassigned unit identities");
const cartonOnlyResult = await waitForJob(cartonOnlyJob.data.id, token);
assert(cartonOnlyResult?.status === "COMPLETED" && cartonOnlyResult.assets.length === 1 && cartonOnlyResult.assets[0].level === "CARTON", "carton-only issuance should link existing individual identities");
const looseActivation = await request("/v1/manufacturer/batches/" + looseBatch.data.id + "/activate", { method: "POST", token, body: { qualityChecked: true, reason: "Smoke test confirms loose batch label quality" } });
assert(looseActivation.status === 201 && looseActivation.data.activated === 3, "unit and carton exports should activate together after quality confirmation");
const linkedCartonToken = new URL(cartonOnlyResult.assets[0].verifyUrl).pathname.split("/").filter(Boolean).pop();
const linkedCartonCheck = await request("/v1/verify/" + linkedCartonToken);
assert(linkedCartonCheck.data.product.packaging.containedUnitCount === 2, "carton-only job should link previously issued units");

const expiredBatch = await request("/v1/products/" + product.data.id + "/batches", { method: "POST", token, body: { batchCode: "EXPIRED-" + suffix, quantity: 1, expiryDate: "2026-01-01T00:00:00.000Z" } });
assert(expiredBatch.status === 201, "producer should create an expiry-dated batch");
const expiredJob = await request("/v1/manufacturer/batches/" + expiredBatch.data.id + "/issuance-jobs", { method: "POST", token, body: { unitQuantity: 1, cartonQuantity: 0 } });
const expiredResult = await waitForJob(expiredJob.data.id, token);
const expiredToken = new URL(expiredResult.assets[0].verifyUrl).pathname.split("/").filter(Boolean).pop();
const expiredActivation = await request("/v1/manufacturer/batches/" + expiredBatch.data.id + "/activate", { method: "POST", token, body: { qualityChecked: true, reason: "Smoke test confirms expiry batch label quality" } });
assert(expiredActivation.status === 201 && expiredActivation.data.activated === 1, "expiry-dated identity should activate after quality confirmation");
const expiredCheck = await request("/v1/verify/" + expiredToken, { scanSession: "50000000-0000-4000-8000-000000000001" });
const expiredRefresh = await request("/v1/verify/" + expiredToken, { scanSession: "50000000-0000-4000-8000-000000000001" });
assert(expiredCheck.data.status === "EXPIRED" && expiredRefresh.data.status === "EXPIRED", "same-session dedupe must preserve expiry and never upgrade a restricted identity");




const overIssue = await request("/v1/manufacturer/batches/" + batch.data.id + "/issuance-jobs", { method: "POST", token, body: { unitQuantity: 1, cartonQuantity: 0 } });
assert(overIssue.status === 400, "queued issuance must not exceed production quantity");
const analytics = await request("/v1/analytics/overview", { token });
assert(analytics.data.products === 1 && analytics.data.batches === 3 && analytics.data.identities === 7 && analytics.data.scans >= 6, "manufacturer analytics should reflect unit and carton identities");
const audit = await request("/v1/super-admin/audit", { token: adminLogin.data.accessToken });
assert(audit.status === 200 && audit.data.some(x => x.action === "COMPANY_STATUS_APPROVED" && x.targetId === workspaceId), "producer approval should be auditable");
assert(typeof audit.data[0]?.sequence === "string", "audit sequences should remain JSON serializable");
const auditIntegrity = await request("/v1/super-admin/audit/integrity", { token: adminLogin.data.accessToken });
assert(auditIntegrity.status === 200 && auditIntegrity.data.valid && auditIntegrity.data.chainedEntries > 0, "audit hash chain should verify after privileged changes");

const adminOverview = await request("/v1/super-admin/overview", { token: adminLogin.data.accessToken });
assert(adminOverview.status === 200 && adminOverview.data.companies >= 1, "super administrator should access the network overview");
const reportQueue = await request("/v1/super-admin/reports", { token: adminLogin.data.accessToken });
assert(reportQueue.status === 200 && reportQueue.data.some(x => x.id === concern.data.reference), "super administrator should review consumer reports");
const reportUpdate = await request("/v1/super-admin/reports/" + concern.data.reference + "/status", { method: "POST", token: adminLogin.data.accessToken, body: { status: "CONFIRMED_ISSUE", note: "Checking the producer batch and label placement confirms a mismatch." } });
assert(reportUpdate.status === 201 && reportUpdate.data.status === "CONFIRMED_ISSUE", "platform report decisions should be auditable and shared with manufacturers");
const syncedReport = await request("/v1/manufacturer/reports?status=CONFIRMED_ISSUE", { token });
assert(syncedReport.status === 200 && syncedReport.data.some(x => x.id === concern.data.reference), "manufacturer and super-admin report queues must share status changes");
const privacyRequest = await request("/v1/privacy/requests", { method: "POST", body: { email: "privacy-" + suffix + "@pan.test", requestType: "ACCESS", details: "Please provide information associated with my PAN account." } });
assert(privacyRequest.status === 201 && privacyRequest.data.reference, "public privacy rights request should be recorded");
const privacyQueue = await request("/v1/super-admin/privacy-requests", { token: adminLogin.data.accessToken });
assert(privacyQueue.status === 200 && privacyQueue.data.some(x => x.id === privacyRequest.data.reference), "super admin should review privacy requests");
const privacyUpdate = await request("/v1/super-admin/privacy-requests/" + privacyRequest.data.reference + "/status", { method: "POST", token: adminLogin.data.accessToken, body: { status: "IN_REVIEW", note: "Identity verification pending." } });
assert(privacyUpdate.status === 201 && privacyUpdate.data.status === "IN_REVIEW", "privacy request review should be audited");

const forgot = await request("/v1/auth/forgot-password", { method: "POST", body: { email } });
assert(forgot.status === 201 && forgot.data.testResetToken, "password recovery should issue a test-only reset token");
const longPasswordReset = await request("/v1/auth/reset-password", { method: "POST", body: { token: forgot.data.testResetToken, password: "a".repeat(73) } });
assert(longPasswordReset.status === 400, "password reset must reject bcrypt passwords longer than 72 bytes");
const reset = await request("/v1/auth/reset-password", { method: "POST", body: { token: forgot.data.testResetToken, password: "Smoke-test-new-password-2026!" } });
assert(reset.status === 201 && reset.data.reset, "password reset should succeed");
const replayReset = await request("/v1/auth/reset-password", { method: "POST", body: { token: forgot.data.testResetToken, password: "Smoke-test-replay-password-2026!" } });
assert(replayReset.status === 400, "password reset tokens must be single-use");
const oldSession = await request("/v1/products", { token });
assert(oldSession.status === 401, "password reset should revoke previous sessions");
const newLogin = await request("/v1/auth/login", { method: "POST", body: { email, password: "Smoke-test-new-password-2026!" } });
assert(newLogin.status === 201 && newLogin.data.accessToken, "manufacturer should sign in using the new password");
const suspension = await request("/v1/super-admin/companies/" + workspaceId + "/status", { method: "POST", token: adminLogin.data.accessToken, body: { status: "SUSPENDED", reason: "Automated smoke test suspension enforcement" } });
assert(suspension.status === 201 && suspension.data.status === "SUSPENDED", "super administrator should suspend a manufacturer workspace");
const suspendedAccess = await request("/v1/products", { token: newLogin.data.accessToken });
assert(suspendedAccess.status === 403, "suspended manufacturer sessions must be denied protected API access");
const restoration = await request("/v1/super-admin/companies/" + workspaceId + "/status", { method: "POST", token: adminLogin.data.accessToken, body: { status: "APPROVED", reason: "Automated smoke test restoration" } });
assert(restoration.status === 201 && restoration.data.status === "APPROVED", "super administrator should restore a manufacturer workspace");
const restoredAccess = await request("/v1/products", { token: newLogin.data.accessToken });
assert(restoredAccess.status === 200, "restored manufacturer sessions should regain protected API access");

console.log("PAN end-to-end smoke passed: email verification, password recovery/session revocation, facilities, invitations/RBAC, product/batch, carton-unit issuance, secure export retrieval, verification hierarchy, regulatory disclaimers, quantity guards, analytics, audit and super-admin login.");
console.log("PAN_MOBILE_SMOKE_CODE=" + units[1].code);
