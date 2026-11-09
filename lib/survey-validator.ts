import type { SurveyNode } from "@/lib/decipher-parser";

export type ValidationIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  rule: string;
  title: string;
  message: string;
  suggestion: string;
  nodeId?: string;
  qid?: string;
};

const CHOICE_TAGS = new Set(["radio", "checkbox", "select", "scale", "rating", "rank", "multi", "combobox", "autocomplete"]);
const CONDITION_ATTRS = ["cond", "when", "where", "filter", "filterFrom"];

export function validateSurvey(nodes: SurveyNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const questions = nodes.filter(n => n.data.kind === "question");
  const labels = new Map<string, SurveyNode[]>();

  for (const node of questions) {
    const qid = node.data.variable.trim();
    if (qid) labels.set(qid, [...(labels.get(qid) || []), node]);
    if (!qid) issues.push({
      id: "missing-qid-" + node.id, severity: "error", rule: "QID-001",
      title: "Question has no QID", message: `The <${node.data.tag}> element has no label attribute, so it cannot be reliably referenced.`,
      suggestion: "Add a unique label attribute to this question.", nodeId: node.id
    });
    if (!node.data.title || node.data.title === node.data.tag) issues.push({
      id: "missing-title-" + node.id, severity: "warning", rule: "CONTENT-001",
      title: "Question title is missing", message: "No readable title was found for this question.",
      suggestion: "Add a <title> element or a meaningful label for respondent-facing content.", nodeId: node.id, qid: qid || undefined
    });
    if (CHOICE_TAGS.has(node.data.tag)) {
      const optionCount = (node.data.source.match(/<(?:row|col|choice|option)\b/gi) || []).length;
      if (!optionCount) issues.push({
        id: "no-options-" + node.id, severity: "warning", rule: "CHOICE-001",
        title: "Choice question has no detectable options", message: `The <${node.data.tag}> question contains no row, col, choice or option elements in its source snippet.`,
        suggestion: "Check whether options are generated through an insert, loop, or another Decipher construct; if not, define the answer options.", nodeId: node.id, qid: qid || undefined
      });
    }
    const required = node.data.attributes.optional;
    if (required === undefined) issues.push({
      id: "optional-review-" + node.id, severity: "info", rule: "REQUIRED-REVIEW",
      title: "Required status needs review", message: "No optional attribute is present on this question.",
      suggestion: "Confirm the intended required/optional behavior in Decipher; this check does not assume the platform default.", nodeId: node.id, qid: qid || undefined
    });
  }

  for (const [qid, matches] of labels) {
    if (matches.length > 1) matches.forEach(node => issues.push({
      id: "duplicate-" + qid + "-" + node.id, severity: "error", rule: "QID-002",
      title: "Duplicate QID", message: `The label "${qid}" is used by ${matches.length} question elements.`,
      suggestion: "Give each question a unique label and update any dependent references.", nodeId: node.id, qid
    }));
  }

  for (const node of nodes) {
    if (node.data.kind === "logic" && !node.data.condition) issues.push({
      id: "logic-no-condition-" + node.id, severity: "warning", rule: "LOGIC-001",
      title: "Logic marker has no recognized condition", message: `The <${node.data.tag}> element has no cond, when, or where attribute captured by the current parser.`,
      suggestion: "Inspect the original XML for nested or alternate Decipher logic syntax. This marker is not evaluated by the current validator.", nodeId: node.id
    });
    const attrs = node.data.attributes;
    for (const attr of CONDITION_ATTRS) {
      const expression = attrs[attr];
      if (expression && expression.trim()) issues.push({
        id: "condition-review-" + node.id + "-" + attr, severity: "info", rule: "LOGIC-REVIEW",
        title: "Conditional expression requires runtime review",
        message: `Found ${attr}="${expression}" on <${node.data.tag}>. The expression is preserved but not executed.`,
        suggestion: "Verify referenced QIDs, syntax and respondent behavior in a Decipher test environment. SurveyCanvas does not yet interpret this expression.", nodeId: node.id, qid: node.data.variable || undefined
      });
    }
  }

  if (!questions.length) issues.push({
    id: "no-questions", severity: "error", rule: "SURVEY-001",
    title: "No supported questions detected", message: "The parser did not identify any supported question elements.",
    suggestion: "Check the XML export and whether this survey uses question tags not yet supported by SurveyCanvas."
  });
  return issues;
}
