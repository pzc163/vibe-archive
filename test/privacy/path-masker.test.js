import test from "node:test";
import assert from "node:assert/strict";
import { PathMasker } from "../../packages/core/src/index.js";

test("PathMasker masks home and workspace paths", () => {
  const masker = new PathMasker({ home: "/Users/alice", workspaceRoot: "/Users/alice/project" });
  const text = masker.mask("/Users/alice/project/src/App.tsx TOKEN=abc123");

  assert.equal(text, "{WORKSPACE}/src/App.tsx TOKEN={REDACTED}");
});

test("PathMasker masks common home path shapes", () => {
  const masker = new PathMasker({ home: "/Users/alice" });
  const text = masker.mask(String.raw`/Users/alice/app.ts /home/bob/app.ts C:\Users\carol\app.ts`);

  assert.equal(text.includes("/Users/alice"), false);
  assert.equal(text.includes("/home/bob"), false);
  assert.equal(text.includes(String.raw`C:\Users\carol`), false);
  assert.equal(text.includes("{HOME}"), true);
});

test("PathMasker redacts sensitive assignments and object values", () => {
  const masker = new PathMasker();
  const text = masker.mask(`TOKEN=abc api_key: "secret" export PASSWORD='pw'`);
  const object = masker.maskObject({
    token: "abc",
    nested: {
      api_key: "secret",
      safe: "keep"
    }
  });

  assert.equal(text.includes("abc"), false);
  assert.equal(text.includes("secret"), false);
  assert.equal(text.includes("pw"), false);
  assert.equal(object.token, "{REDACTED}");
  assert.equal(object.nested.api_key, "{REDACTED}");
  assert.equal(object.nested.safe, "keep");
});

test("PathMasker redacts sensitive file names", () => {
  const masker = new PathMasker({ home: "/Users/alice", workspaceRoot: "/Users/alice/project" });
  const text = masker.mask("/Users/alice/project/.env.local cert.pem ssh.key src/app.ts");

  assert.equal(text.includes(".env.local"), false);
  assert.equal(text.includes("cert.pem"), false);
  assert.equal(text.includes("ssh.key"), false);
  assert.equal(text.includes("src/app.ts"), true);
  assert.equal(text.includes("{SENSITIVE_FILE}"), true);
});
