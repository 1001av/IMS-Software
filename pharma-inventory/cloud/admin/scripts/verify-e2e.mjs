import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3001";

async function runTests() {
  console.log("==================================================");
  console.log("STARTING FULL END-TO-END VERIFICATION SUITE");
  console.log("==================================================");

  // --- Reset/Clean Test Customer Devices & Vault for Idempotency ---
  try {
    const custVaultDir = path.join(process.cwd(), "data", "vault", "cust-agro-001");
    if (fs.existsSync(custVaultDir)) {
      fs.rmSync(custVaultDir, { recursive: true, force: true });
    }
    const checkDevs = await fetch(`${BASE_URL}/api/auth/devices?customerId=cust-agro-001`);
    if (checkDevs.ok) {
      const dData = await checkDevs.json();
      for (const d of dData.registeredDevices || []) {
        await fetch(`${BASE_URL}/api/auth/devices`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: "cust-agro-001", deviceId: d.deviceId }),
        });
      }
    }
  } catch (e) {}

  // --- 1. Test Login & Cross-Vertical Isolation ---
  console.log("\n[TEST 1] Testing Cross-Vertical Isolation...");
  // Ramesh Patel is an 'agro' customer
  const crossVerticalRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "kisan.kendra@example.com",
      password: "admin123",
      productVertical: "pharma", // Deliberately mismatching!
      deviceId: "test-device-cross",
      deviceName: "Hacker Laptop",
    }),
  });

  assert.strictEqual(crossVerticalRes.status, 403, "Should reject cross-vertical login with 403");
  const crossData = await crossVerticalRes.json();
  console.log("✓ Cross-vertical correctly rejected:", crossData.error);

  // --- 2. Test Invalid Password ---
  console.log("\n[TEST 2] Testing Invalid Password Handling...");
  const badPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "kisan.kendra@example.com",
      password: "wrongpassword",
      productVertical: "agro",
      deviceId: "test-device-badpwd",
      deviceName: "Dev Laptop",
    }),
  });
  assert.strictEqual(badPassRes.status, 401, "Should reject bad password with 401");
  const badPassData = await badPassRes.json();
  console.log("✓ Bad password rejected:", badPassData.error);

  // --- 3. Test Device 1 Registration & Device Quota Enforcement ---
  console.log("\n[TEST 3] Testing Multi-Device Quota (Limit: 2 Authorized Computers)...");

  // Device 1: Counter PC
  const dev1Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "kisan.kendra@example.com",
      password: "admin123",
      productVertical: "agro",
      deviceId: "device-counter-pc-01",
      deviceName: "Shop Counter PC",
    }),
  });
  assert.strictEqual(dev1Res.status, 200, "Device 1 login should succeed");
  const dev1Data = await dev1Res.json();
  assert.strictEqual(dev1Data.device.devicePrefix, "A", "First device must be assigned Prefix A");
  console.log(`✓ Device 1 Registered: "${dev1Data.storeName}", Device: ${dev1Data.device.devicePrefix} (${dev1Data.registeredDevices.length}/2 devices used)`);

  // Device 2: Owner Laptop
  const dev2Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "kisan.kendra@example.com",
      password: "admin123",
      productVertical: "agro",
      deviceId: "device-owner-laptop-02",
      deviceName: "Owner Laptop",
    }),
  });
  assert.strictEqual(dev2Res.status, 200, "Device 2 login should succeed");
  const dev2Data = await dev2Res.json();
  assert.strictEqual(dev2Data.device.devicePrefix, "B", "Second device must be assigned Prefix B");
  console.log(`✓ Device 2 Registered: Device: ${dev2Data.device.devicePrefix} (${dev2Data.registeredDevices.length}/2 devices used)`);

  // Device 3: Unauthorized 3rd PC
  const dev3Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "kisan.kendra@example.com",
      password: "admin123",
      productVertical: "agro",
      deviceId: "device-intruder-pc-03",
      deviceName: "Third PC Extra",
    }),
  });
  assert.strictEqual(dev3Res.status, 403, "Third device MUST be rejected with 403 quota exceeded");
  const dev3Data = await dev3Res.json();
  console.log("✓ 3rd device quota strictly blocked:", dev3Data.error);

  // --- 4. Test Device Listing & Revocation ---
  console.log("\n[TEST 4] Testing Device Revocation (Hardware Replacement)...");
  const listDevRes = await fetch(`${BASE_URL}/api/auth/devices?customerId=${dev1Data.customerId}`);
  const listDevData = await listDevRes.json();
  assert.strictEqual(listDevData.registeredDevices.length, 2, "Customer should have 2 registered devices");

  // Revoke Device 1
  const revokeRes = await fetch(`${BASE_URL}/api/auth/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: dev1Data.customerId,
      deviceId: "device-counter-pc-01",
    }),
  });
  assert.strictEqual(revokeRes.status, 200, "Device revocation should succeed");
  console.log("✓ Device 1 revoked successfully. Quota slot released.");

  // Now Device 3 should be able to register in the vacant slot
  const dev3RetryRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "kisan.kendra@example.com",
      password: "admin123",
      productVertical: "agro",
      deviceId: "device-intruder-pc-03",
      deviceName: "New Shop Counter PC",
    }),
  });
  assert.strictEqual(dev3RetryRes.status, 200, "Device 3 should now register into slot A");
  const dev3RetryData = await dev3RetryRes.json();
  assert.strictEqual(dev3RetryData.device.devicePrefix, "A", "Vacated Prefix A reassigned");
  console.log(`✓ Replacement device registered cleanly with Prefix ${dev3RetryData.device.devicePrefix}`);

  // --- 5. Test Cloud Vault Push & Conflict Detection ---
  console.log("\n[TEST 5] Testing Cloud Vault E2EE Push & Conflict Detection...");
  
  // Device A pushes Snapshot Version 1
  const dummyEncryptedData1 = Buffer.from("ENCRYPTED_SQLITE_PAYLOAD_V1").toString("base64");
  const pushRes1 = await fetch(`${BASE_URL}/api/vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: dev1Data.customerId,
      deviceId: "device-intruder-pc-03",
      deviceName: "New Shop Counter PC",
      devicePrefix: "A",
      baseVersion: 0,
      dataBase64: dummyEncryptedData1,
      checksumSha256: "dummy-sha256-v1",
      sizeBytes: 1024,
    }),
  });

  assert.strictEqual(pushRes1.status, 200, "First vault push should succeed");
  const pushData1 = await pushRes1.json();
  assert.strictEqual(pushData1.metadata.version, 1, "Cloud version should be 1");
  console.log(`✓ Snapshot Version 1 pushed by ${pushData1.metadata.uploadedByDeviceName}`);

  // Device B tries to push based on baseVersion: 0 (STALE!)
  const dummyEncryptedDataStale = Buffer.from("STALE_DATA").toString("base64");
  const pushConflictRes = await fetch(`${BASE_URL}/api/vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: dev1Data.customerId,
      deviceId: "device-owner-laptop-02",
      deviceName: "Owner Laptop",
      devicePrefix: "B",
      baseVersion: 0, // Out of date! Cloud is at Version 1
      dataBase64: dummyEncryptedDataStale,
      checksumSha256: "dummy-sha256-stale",
      sizeBytes: 1024,
    }),
  });

  assert.strictEqual(pushConflictRes.status, 409, "Stale push must trigger 409 Conflict");
  const conflictData = await pushConflictRes.json();
  console.log("✓ Cloud concurrency conflict detected:", conflictData.error);
  assert.strictEqual(conflictData.cloudVersion, 1);

  // Device B pulls the latest snapshot
  console.log("\n[TEST 6] Testing Cloud Vault Pull & Metadata Inspection...");
  const pullRes = await fetch(`${BASE_URL}/api/vault?customerId=${dev1Data.customerId}&action=download`);
  assert.strictEqual(pullRes.status, 200, "Vault pull should succeed");
  const pullData = await pullRes.json();
  assert.strictEqual(pullData.metadata.version, 1, "Latest pulled version is 1");
  assert.strictEqual(pullData.dataBase64, dummyEncryptedData1, "Payload matched byte-for-byte");
  console.log(`✓ Vault snapshot pulled successfully: Version ${pullData.metadata.version} from "${pullData.metadata.uploadedByDeviceName}"`);

  // --- 7. Test Software Updater Endpoint ---
  console.log("\n[TEST 7] Testing Tauri v2 Software Update API...");
  // Check when client is on older version (v1.0.0) -> should return update manifest
  const updateAvailableRes = await fetch(`${BASE_URL}/api/updates/pharma/windows-x86_64/1.0.0`);
  assert.strictEqual(updateAvailableRes.status, 200, "Should return 200 when update is available");
  const updateManifest = await updateAvailableRes.json();
  console.log(`✓ Update available manifest received: v${updateManifest.version}, download URL: ${updateManifest.url}`);
  assert.ok(updateManifest.url, "Update manifest must contain download url");
  assert.ok(updateManifest.notes, "Update manifest must contain release notes");

  // Check when client is on latest version (v1.2.0) -> should return 204 No Content
  const upToDateRes = await fetch(`${BASE_URL}/api/updates/pharma/windows-x86_64/1.2.0`);
  assert.strictEqual(upToDateRes.status, 204, "Should return 204 No Content when already up to date");
  console.log("✓ Up-to-date client received 204 No Content (No unnecessary downloads)");

  console.log("\n==================================================");
  console.log("ALL VERIFICATION SUITES PASSED SUCCESSFULLY (7/7)!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("❌ VERIFICATION TEST FAILED:", err);
  process.exit(1);
});
