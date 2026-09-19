import assert from "node:assert/strict";
import test from "node:test";
import { isPublicIp, validatePublicUrl } from "../src/network.ts";

const blocked = [
  "127.0.0.1",
  "10.0.0.1",
  "172.16.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "100.64.0.1",
  "::1",
  "fc00::1",
  "fe80::1",
  "::ffff:127.0.0.1",
];

for (const address of blocked) {
  test(`blocks non-public address ${address}`, () => {
    assert.equal(isPublicIp(address), false);
  });
}

test("allows public addresses", () => {
  assert.equal(isPublicIp("1.1.1.1"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});

test("rejects localhost URLs", async () => {
  await assert.rejects(validatePublicUrl("http://localhost/admin"), /Blocked hostname/);
  await assert.rejects(validatePublicUrl("http://127.0.0.1/admin"), /Blocked non-public address/);
});

test("rejects non-HTTP URLs and URL credentials", async () => {
  await assert.rejects(validatePublicUrl("file:///etc/passwd"), /only supports HTTP and HTTPS/);
  await assert.rejects(validatePublicUrl("https://user:password@example.com"), /credentials/);
});
