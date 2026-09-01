import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedLoginNavigation } from "../src/login-navigation";

test("keeps Mubu and OAuth http(s) navigations inside the login window", () => {
  assert.equal(isAllowedLoginNavigation("https://mubu.com/login"), true);
  assert.equal(isAllowedLoginNavigation("https://mubu.com/login?next=/"), true);
  assert.equal(isAllowedLoginNavigation("http://mubu.io/wxlogin"), true);
  assert.equal(isAllowedLoginNavigation("https://open.weixin.qq.com/connect/qrconnect"), true);
  assert.equal(isAllowedLoginNavigation("https://accounts.google.com/o/oauth2/v2/auth"), true);
  assert.equal(isAllowedLoginNavigation("about:blank"), true);
});

test("blocks non-web schemes that should not leave the login window via openExternal", () => {
  assert.equal(isAllowedLoginNavigation("file:///etc/passwd"), false);
  assert.equal(isAllowedLoginNavigation("app://obsidian.md/index.html"), false);
  assert.equal(isAllowedLoginNavigation("obsidian://open"), false);
  assert.equal(isAllowedLoginNavigation("javascript:alert(1)"), false);
  assert.equal(isAllowedLoginNavigation("not a url"), false);
});
