"use client";

import type { Edge, Node } from "reactflow";

export type SurveyNodeData = {
  kind: "start" | "question" | "logic" | "control" | "terminate" | "end";
  tag: string;
  label: string;
  title: string;
  variable: string;
  detail: string;
  condition: string;
  attributes: Record<string, string>;
  source: string;
  depth: number;
  index: number;
};

export type SurveyNode = Node<SurveyNodeData>;

const QUESTION_TAGS = new Set([
  "radio", "checkbox", "select", "text", "textarea", "number", "integer",
  "float", "rating", "scale", "grid", "rank", "date", "datetime",
  "list", "repeater", "upload", "file", "signature", "hidden", "info",
  "comment", "essay", "multi", "combobox", "autocomplete"
]);
const LOGIC_TAGS = new Set(["if", "condition", "branch", "logic", "suspend"]);
const CONTROL_TAGS = new Set(["block", "page", "section", "loop", "looprow", "quota", "exec", "set", "randomize", "group"]);
const IGNORE_TAGS = new Set([
  "survey", "samplesources", "samplesource", "sample", "title", "comment",
  "validate", "insert", "row", "col", "choice", "option", "res", "style",
  "stylevar", "note", "help", "verify", "script", "html", "text", "description"
]);

function clean(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function textOf(el: Element) {
  const title = Array.from(el.children).find(c => c.tagName.toLowerCase() === "title");
  return clean(title?.textContent) || clean(el.getAttribute("label")) || el.tagName;
}
function attrsOf(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  Array.from(el.attributes).forEach(a => { out[a.name] = a.value; });
  return out;
}
function serialize(el: Element) {
  try { return new XMLSerializer().serializeToString(el); }
  catch { return el.outerHTML || ""; }
}
function isQuestion(tag: string) {
  return QUESTION_TAGS.has(tag) && !["text"].includes(tag) ? true : tag === "text" && !!tag;
}
function isSemantic(el: Element) {
  const tag = el.tagName.toLowerCase();
  if (QUESTION_TAGS.has(tag)) return true;
  if (LOGIC_TAGS.has(tag) || CONTROL_TAGS.has(tag) || tag === "term") return true;
  return false;
}

function addMissingDecipherNamespaces(xml: string) {
  // Some Decipher exports use proprietary attribute prefixes without including
  // xmlns declarations. Browsers reject those documents before we can inspect them.
  const rootMatch = /<([A-Za-z_][\w:.-]*)(?=[\s/>])/.exec(xml);
  if (!rootMatch || rootMatch.index === undefined) return xml;

  const rootStart = rootMatch.index;
  let quote = "";
  let rootEnd = -1;
  for (let i = rootStart; i < xml.length; i++) {
    const char = xml[i];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      rootEnd = i;
      break;
    }
  }
  if (rootEnd < 0) return xml;

  const rootTag = xml.slice(rootStart, rootEnd + 1);
  const declared = new Set(
    Array.from(rootTag.matchAll(/\bxmlns:([A-Za-z_][\w.-]*)\s*=/g), match => match[1])
  );
  const used = new Set<string>();

  // Inspect markup names only; prefixes inside CDATA, scripts, and text are not namespaces.
  for (const tagMatch of xml.matchAll(/<[^!?][^>]*>/g)) {
    const tag = tagMatch[0];
    const elementPrefix = /^<\/?([A-Za-z_][\w.-]*):[A-Za-z_][\w.-]*/.exec(tag)?.[1];
    if (elementPrefix) used.add(elementPrefix);
    for (const attributeMatch of tag.matchAll(/\s([A-Za-z_][\w.-]*):[A-Za-z_][\w.-]*\s*=/g)) {
      if (attributeMatch[1] !== "xmlns") used.add(attributeMatch[1]);
    }
  }

  const missing = Array.from(used).filter(prefix => !declared.has(prefix));
  if (!missing.length) return xml;

  const declarations = missing
    .map(prefix => `xmlns:${prefix}="urn:decipher:namespace:${prefix}"`)
    .join(" ");
  return xml.slice(0, rootEnd) + " " + declarations + xml.slice(rootEnd);
}

export function parseDecipherXml(xml: string): { nodes: SurveyNode[]; edges: Edge[]; title: string; summary: Record<string, number>; warnings: string[] } {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) throw new Error("XML document types and custom entities are not accepted.");
  // Clipboard content can include a UTF-8 BOM; remove it before XML parsing.
  const normalizedXml = addMissingDecipherNamespaces(xml.replace(/^\uFEFF/, "").trim());
  if (!normalizedXml) throw new Error("The XML input is empty. Paste the complete Decipher XML document.");
  const doc = new DOMParser().parseFromString(normalizedXml, "application/xml");
  const parseError = doc.getElementsByTagName("parsererror")[0] ||
    (doc.documentElement?.localName.toLowerCase() === "parsererror" ? doc.documentElement : null);
  if (parseError) {
    const diagnostic = clean(parseError.textContent || "");
    const location = diagnostic.match(/(?:line|Line)\s*(\d+)(?:,|\s)+(?:column|Column)\s*(\d+)/);
    const detail = diagnostic
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 420);
    const position = location ? ` (line ${location[1]}, column ${location[2]})` : "";
    throw new Error(
      "XML parsing failed" + position + (detail ? ": " + detail : ". Check for unescaped &, mismatched tags, or text outside the root element.")
    );
  }
  const root = doc.documentElement;
  if (!root) throw new Error("The XML file is empty.");
  const title = clean(root.getAttribute("label")) || clean(root.getAttribute("name")) || clean(Array.from(root.getElementsByTagName("title"))[0]?.textContent) || "Imported survey";
  const nodes: SurveyNode[] = [];
  const edges: Edge[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = { questions: 0, logic: 0, controls: 0, terminations: 0 };
  const start: SurveyNode = {
    id: "survey-start", type: "surveyNode", position: { x: 40, y: 120 },
    data: { kind: "start", tag: "start", label: "START", title: "Survey entry", variable: "", detail: "Entry point", condition: "", attributes: {}, source: "", depth: 0, index: 0 },
    draggable: false
  };
  nodes.push(start);
  let sequence = 0;
  let previous = start.id;
  const seenLabels = new Set<string>();

  const add = (el: Element, depth: number) => {
    const tag = el.tagName.toLowerCase();
    const attrs = attrsOf(el);
    const variable = clean(el.getAttribute("label"));
    const condition = clean(el.getAttribute("cond") || el.getAttribute("when") || el.getAttribute("where"));
    let kind: SurveyNodeData["kind"] = "control";
    if (QUESTION_TAGS.has(tag)) kind = "question";
    else if (LOGIC_TAGS.has(tag)) kind = "logic";
    else if (tag === "term") kind = "terminate";
    const label = variable || tag.toUpperCase();
    const titleText = textOf(el);
    const childRows = Array.from(el.children).filter(c => ["row", "col", "choice", "option"].includes(c.tagName.toLowerCase()));
    const detailParts = [
      childRows.length ? childRows.length + " answer / grid items" : "",
      el.getAttribute("optional") === "0" ? "Required" : "",
      el.getAttribute("type") ? "Type: " + el.getAttribute("type") : "",
      condition ? "Condition: " + condition : ""
    ].filter(Boolean);
    const id = "xml-" + sequence++;
    const node: SurveyNode = {
      id, type: "surveyNode",
      position: { x: 330 + Math.min(depth, 2) * 285, y: 50 + (sequence - 1) * 142 },
      data: {
        kind, tag, label, title: titleText, variable,
        detail: detailParts.join(" · ") || (kind === "question" ? "Question element" : "Survey control element"),
        condition, attributes: attrs, source: serialize(el), depth, index: sequence
      }
    };
    nodes.push(node);
    edges.push({
      id: "edge-" + previous + "-" + id, source: previous, target: id, type: "smoothstep",
      animated: kind === "logic", label: condition || undefined,
      labelStyle: { fill: "#687187", fontSize: 10 },
      style: { stroke: kind === "logic" ? "#766bea" : "#aeb6c5", strokeWidth: 1.8, strokeDasharray: kind === "logic" ? "5 4" : undefined }
    });
    previous = id;
    if (kind === "question") {
      counts.questions++;
      if (variable) {
        if (seenLabels.has(variable)) warnings.push("Duplicate question label: " + variable);
        seenLabels.add(variable);
      } else warnings.push("Question <" + tag + "> has no label attribute.");
    } else if (kind === "logic") counts.logic++;
    else if (kind === "terminate") counts.terminations++;
    else counts.controls++;
  };

  const visit = (el: Element, depth: number) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      if (isSemantic(child)) add(child, depth);
      // Survey containers are traversed; question internals (titles, rows, validation)
      // are retained in the parent node's source instead of becoming separate flow nodes.
      if (!QUESTION_TAGS.has(tag)) visit(child, depth + (CONTROL_TAGS.has(tag) || LOGIC_TAGS.has(tag) ? 1 : 0));
    }
  };
  visit(root, 0);

  const end: SurveyNode = {
    id: "survey-end", type: "surveyNode",
    position: { x: 330 + Math.min(2, Math.max(0, nodes[nodes.length - 1]?.data.depth || 0)) * 285, y: 50 + sequence * 142 },
    data: { kind: "end", tag: "end", label: "END", title: "Survey end", variable: "", detail: "End of parsed document flow", condition: "", attributes: {}, source: "", depth: 0, index: sequence + 1 },
    draggable: false
  };
  nodes.push(end);
  edges.push({ id: "edge-" + previous + "-survey-end", source: previous, target: end.id, type: "smoothstep", style: { stroke: "#aeb6c5", strokeWidth: 1.8 } });
  if (!sequence) warnings.push("No recognized question or survey-control elements were found. This may use unsupported Decipher constructs.");
  if (sequence > 350) warnings.push("Large survey detected. The canvas may be easier to inspect using the QID search and node filters.");
  return { nodes, edges, title, summary: counts, warnings };
}
