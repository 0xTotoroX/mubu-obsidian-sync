import assert from "node:assert/strict";
import test from "node:test";
import { isAuthenticationMessage } from "../src/auth-state";

test("recognizes expired Mubu login responses in Chinese and English", () => {
  assert.equal(isAuthenticationMessage("login expired"), true);
  assert.equal(isAuthenticationMessage("Login Expired"), true);
  assert.equal(isAuthenticationMessage("登录状态已过期"), true);
  assert.equal(isAuthenticationMessage("Jwt-Token invalid"), true);
  assert.equal(isAuthenticationMessage("network timeout"), false);
});
