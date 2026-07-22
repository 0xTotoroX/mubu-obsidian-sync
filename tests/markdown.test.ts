import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  createInitialFile,
  htmlToMarkdown,
  renderMubuDocument,
  replaceManagedBlock
} from "../src/markdown";
import type { MubuDocumentSummary } from "../src/types";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  DOMParser: dom.window.DOMParser,
  Node: dom.window.Node,
  HTMLElement: dom.window.HTMLElement
});

const summary: MubuDocumentSummary = {
  id: "doc-123",
  title: "测试文档",
  folderId: "folder-1",
  folderPath: "工作/项目"
};

test("converts representative Mubu rich text to Markdown", () => {
  const markdown = htmlToMarkdown([
    '<span class="bold">加粗</span>',
    '<span class="formula" data-raw="x%5E2%2By%5E2"></span>',
    "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>"
  ].join(""));

  assert.match(markdown, /\*\*加粗\*\*/);
  assert.match(markdown, /\$x\^2\+y\^2\$/);
  assert.match(markdown, /\| A \| B \|/);
  assert.match(markdown, /\| 1 \| 2 \|/);
});

test("renders nested nodes, tasks, notes and deadlines", () => {
  const managed = renderMubuDocument(summary, [{
    text: "父节点",
    taskStatus: 1,
    deadline: 1_787_059_200,
    note: "<strong>备注</strong>",
    children: [{ text: "子节点", taskStatus: 0 }]
  }]);

  assert.match(managed, /- \[ \] 父节点/);
  assert.match(managed, /> \*\*备注\*\*/);
  assert.match(managed, /  - \[x\] 子节点/);
  assert.match(managed, /📅 2026-/);
});

test("does not double-wrap heading text that is already bold", () => {
  const managed = renderMubuDocument(summary, [{
    text: '<span class="bold">标题</span>',
    heading: 1
  }]);

  assert.match(managed, /- \*\*标题\*\*/);
  assert.doesNotMatch(managed, /\*\*\*\*标题\*\*\*\*/);
});

test("does not wrap a heading around existing inline bold fragments", () => {
  const managed = renderMubuDocument(summary, [{
    text: '前缀<span class="bold">加粗结尾</span>',
    heading: 1
  }]);

  assert.match(managed, /- 前缀\*\*加粗结尾\*\*/);
  assert.doesNotMatch(managed, /\*{4,}/);
});

test("collapses duplicate bold markers from nested rich-text spans", () => {
  const markdown = htmlToMarkdown('<span class="bold"><strong>嵌套加粗</strong></span>');
  assert.equal(markdown, "**嵌套加粗**");
});

test("updates only the managed block and preserves local notes", () => {
  const originalManaged = renderMubuDocument(summary, [{ text: "旧内容" }]);
  const initial = `${createInitialFile(summary, originalManaged)}本地内容\n`;
  const nextManaged = renderMubuDocument(summary, [{ text: "新内容" }]);
  const updated = replaceManagedBlock(initial, nextManaged);

  assert.ok(updated);
  assert.doesNotMatch(updated, /旧内容/);
  assert.match(updated, /新内容/);
  assert.match(updated, /本地内容/);
});

test("refuses to overwrite files whose management markers were removed", () => {
  const managed = renderMubuDocument(summary, [{ text: "内容" }]);
  assert.equal(replaceManagedBlock("用户自己的文件", managed), null);
});
