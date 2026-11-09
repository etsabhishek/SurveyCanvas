"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  addEdge, Background, Controls, Handle, MiniMap, Position,
  useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps
} from "reactflow";
import {
  ArrowDown, ArrowLeft, ArrowRight, Braces, Check, ChevronDown, CircleDot,
  ClipboardList, Copy, Download, Eye, FileText, GitBranch, Grid3X3, Hash,
  Layers3, ListChecks, Plus, Save, Settings2, ShieldCheck, Sparkles, Star,
  Trash2, Type, X
} from "lucide-react";

type QType = "single" | "multi" | "text" | "textarea" | "dropdown" | "number" | "rating" | "matrix";
type Question = { id: string; type: QType; title: string; description: string; required: boolean; options: string[]; variable: string; min?: number; max?: number };
type FlowData = { kind: "start" | "question" | "end"; question?: Question; label?: string };
type FlowNode = Node<FlowData>;
const meta: Record<QType, { label: string; icon: any }> = {
  single: { label: "Single choice", icon: CircleDot }, multi: { label: "Multiple choice", icon: ListChecks },
  text: { label: "Short text", icon: Type }, textarea: { label: "Long text", icon: FileText },
  dropdown: { label: "Dropdown", icon: ChevronDown }, number: { label: "Number", icon: Hash },
  rating: { label: "Rating scale", icon: Star }, matrix: { label: "Matrix", icon: Grid3X3 }
};
const newQuestion = (type: QType, n: number): Question => ({
  id: "q_" + Math.random().toString(36).slice(2, 9), type,
  title: ({ single: "Choose one option", multi: "Select all that apply", text: "Enter your answer", textarea: "Share your thoughts", dropdown: "Choose an option", number: "Enter a number", rating: "Rate your experience", matrix: "Rate each statement" } as Record<QType, string>)[type],
  description: "", required: false, options: type === "matrix" ? ["Statement 1", "Statement 2", "Statement 3"] : ["Option 1", "Option 2", "Option 3"],
  variable: "Q" + n, min: 1, max: 5
});
const initialQuestions: Question[] = [
  { ...newQuestion("single", 1), id: "q1", title: "Which of the following best describes your role?", description: "Select the option that most closely matches your current role.", options: ["Research / Insights", "Survey Programmer", "Project Manager", "Other"], required: true },
  { ...newQuestion("multi", 2), id: "q2", title: "Which tools do you use regularly?", description: "Select all that apply.", options: ["Decipher", "Metaform", "Excel", "Python", "Other"] },
  { ...newQuestion("rating", 3), id: "q3", title: "How confident are you in your current workflow?", description: "1 = Not confident · 5 = Very confident", required: true }
];
function makeInitial() {
  const nodes: FlowNode[] = [
    { id: "start", type: "flowCard", position: { x: 40, y: 245 }, data: { kind: "start", label: "Survey start" }, draggable: false },
    ...initialQuestions.map((q, i) => ({ id: q.id, type: "flowCard", position: { x: 350, y: 65 + i * 185 }, data: { kind: "question" as const, question: q } })),
    { id: "end", type: "flowCard", position: { x: 790, y: 245 }, data: { kind: "end", label: "Survey complete" }, draggable: false }
  ];
  const edges: Edge[] = [
    { id: "e-start-q1", source: "start", target: "q1", animated: true, style: { stroke: "#8b82ee", strokeWidth: 2 } },
    { id: "e-q1-q2", source: "q1", target: "q2", style: { stroke: "#aeb4c4", strokeWidth: 1.7 } },
    { id: "e-q2-q3", source: "q2", target: "q3", style: { stroke: "#aeb4c4", strokeWidth: 1.7 } },
    { id: "e-q3-end", source: "q3", target: "end", style: { stroke: "#aeb4c4", strokeWidth: 1.7 } }
  ];
  return { nodes, edges };
}
function FlowCard({ data, selected }: NodeProps<FlowData>) {
  if (data.kind === "start" || data.kind === "end") return <div className={"flow-terminal " + data.kind}>
    {data.kind === "start" ? <ArrowRight size={15}/> : <Check size={15}/>}
    <span><b>{data.label}</b><small>{data.kind === "start" ? "Entry point" : "End of questionnaire"}</small></span>
    {data.kind === "start" && <Handle type="source" position={Position.Right}/>}
    {data.kind === "end" && <Handle type="target" position={Position.Left}/>}
  </div>;
  const q = data.question!;
  const Icon = meta[q.type].icon;
  return <div className={"flow-question " + (selected ? "is-selected" : "")}>
    <Handle type="target" position={Position.Left}/>
    <div className="flow-node-top"><span className="flow-node-icon"><Icon size={14}/></span><span>{q.variable || "Question"}</span><span className="flow-node-kind">{meta[q.type].label}</span></div>
    <div className="flow-node-title">{q.title || "Untitled question"}</div>
    <div className="flow-node-bottom"><span>{q.required ? <><ShieldCheck size={11}/> Required</> : "Optional"}</span><span>{q.options.length} {q.type === "matrix" ? "rows" : "options"}</span></div>
    <Handle type="source" position={Position.Right}/>
  </div>;
}
const nodeTypes = { flowCard: FlowCard };
const edgeStyle = { stroke: "#aeb4c4", strokeWidth: 1.7 };
export default function Home() {
  const initial = useMemo(makeInitial, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowData>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selected, setSelected] = useState("q1");
  const [tab, setTab] = useState<"settings" | "logic">("settings");
  const [surveyTitle, setSurveyTitle] = useState("Customer Experience Survey");
  const [surveyDescription, setSurveyDescription] = useState("We'd love to hear your thoughts. This survey takes about 3 minutes.");
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [previewStep, setPreviewStep] = useState(0);
  const [branchSource, setBranchSource] = useState("");
  const [branchLabel, setBranchLabel] = useState("If answer is Yes");
  const questions = nodes.filter(n => n.data.kind === "question");
  const activeNode = nodes.find(n => n.id === selected && n.data.kind === "question");
  const active = activeNode?.data.question;
  const notify = (s: string) => { setToast(s); window.setTimeout(() => setToast(""), 2200); };
  useEffect(() => {
    try {
      const raw = localStorage.getItem("surveycanvas-flow");
      if (!raw) return;
      const p = JSON.parse(raw);
      if (Array.isArray(p.nodes) && Array.isArray(p.edges)) { setNodes(p.nodes); setEdges(p.edges); setSelected(p.nodes.find((n: FlowNode) => n.data.kind === "question")?.id || ""); }
      if (p.title) setSurveyTitle(p.title);
      if (p.description) setSurveyDescription(p.description);
    } catch {}
  }, [setEdges, setNodes]);
  useEffect(() => {
    setSaved(false);
    const t = window.setTimeout(() => {
      try { localStorage.setItem("surveycanvas-flow", JSON.stringify({ nodes, edges, title: surveyTitle, description: surveyDescription })); setSaved(true); } catch {}
    }, 450);
    return () => window.clearTimeout(t);
  }, [nodes, edges, surveyTitle, surveyDescription]);
  const onConnect = useCallback((connection: Connection) => setEdges(es => addEdge({ ...connection, id: "edge_" + Math.random().toString(36).slice(2, 9), type: "smoothstep", label: "Next", labelStyle: { fill: "#687187", fontSize: 10 }, labelBgStyle: { fill: "#fff", fillOpacity: 1 }, style: edgeStyle }, es)), [setEdges]);
  const patchQuestion = (patch: Partial<Question>) => {
    if (!active) return;
    setNodes(ns => ns.map(n => n.id === selected && n.data.question ? { ...n, data: { ...n.data, question: { ...n.data.question, ...patch } } } : n));
  };
  const addQuestion = (type: QType) => {
    const q = newQuestion(type, questions.length + 1);
    const y = 70 + questions.length * 185;
    const node: FlowNode = { id: q.id, type: "flowCard", position: { x: 350, y }, data: { kind: "question", question: q } };
    const endEdge = edges.find(e => e.target === "end");
    setNodes(ns => ns.filter(n => n.id !== "end").concat(node, ns.find(n => n.id === "end")!));
    setEdges(es => {
      const base = es.filter(e => e.id !== endEdge?.id);
      const previous = endEdge?.source || "start";
      return [...base, { id: "edge_" + q.id, source: previous, target: q.id, type: "smoothstep", style: edgeStyle }, { id: "edge_" + q.id + "_end", source: q.id, target: "end", type: "smoothstep", style: edgeStyle }];
    });
    setSelected(q.id); setTab("settings"); notify("Question added to flow");
  };
  const deleteSelected = () => {
    if (!active) return;
    const incoming = edges.find(e => e.target === selected && e.source !== "start");
    const outgoing = edges.find(e => e.source === selected && e.target !== "end");
    setNodes(ns => ns.filter(n => n.id !== selected));
    setEdges(es => {
      const next = es.filter(e => e.source !== selected && e.target !== selected);
      if (incoming && outgoing) next.push({ id: "edge_" + incoming.source + "_" + outgoing.target, source: incoming.source, target: outgoing.target, type: "smoothstep", style: edgeStyle });
      return next;
    });
    setSelected(""); notify("Question removed");
  };
  const addBranch = () => {
    if (!active || !branchSource || branchSource === selected) return;
    setEdges(es => [...es.filter(e => !(e.source === branchSource && e.target === selected && e.label)), {
      id: "branch_" + branchSource + "_" + selected + "_" + Date.now(), source: branchSource, target: selected, type: "smoothstep",
      label: branchLabel || "Conditional path", labelStyle: { fill: "#6258d7", fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: "#f2f0ff", fillOpacity: 1 }, style: { stroke: "#7569e8", strokeWidth: 2, strokeDasharray: "5 4" }
    }]);
    notify("Branch connection added");
  };
  const exportJSON = () => {
    const payload = { title: surveyTitle, description: surveyDescription, nodes, edges, questions: questions.map(n => n.data.question) };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })); a.download = "surveycanvas-flow.json"; a.click(); URL.revokeObjectURL(a.href); notify("Survey flow exported");
  };
  const previewQuestions = questions.map(n => n.data.question!).filter(Boolean);
  const current = previewQuestions[previewStep];
  const submitPreview = () => {
    const result = previewQuestions.map(q => ({ variable: q.variable, question: q.title, answer: answers[q.id] ?? null }));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ title: surveyTitle, responses: result }, null, 2)], { type: "application/json" })); a.download = "surveycanvas-test-response.json"; a.click(); setPreview(false); notify("Test response exported");
  };
  return <main className="app-shell flow-app">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">S</div>SurveyCanvas</div>
      <div className="top-meta">Projects <span>/</span> {surveyTitle}</div>
      <div className="top-actions"><span className="save-indicator"><i className={saved ? "saved" : ""}/>{saved ? "All changes saved" : "Saving…"}</span><button className="btn" onClick={exportJSON}><Download size={14}/> Export flow</button><button className="btn btn-primary" onClick={() => { setPreview(true); setPreviewStep(0); setAnswers({}); }}><Eye size={14}/> Test survey</button></div>
    </header>
    <div className="flow-workspace">
      <aside className="flow-library">
        <div className="side-label">BUILD YOUR SURVEY</div>
        <div className="library-section-title">QUESTION NODES</div>
        {(Object.keys(meta) as QType[]).map(type => { const Icon = meta[type].icon; return <button className="library-item" key={type} onClick={() => addQuestion(type)}><span><Icon size={15}/></span>{meta[type].label}<Plus size={13} className="library-plus"/></button>; })}
        <div className="library-divider"/>
        <div className="library-section-title">FLOW ELEMENTS</div>
        <div className="flow-help"><GitBranch size={15}/><div><b>Branching logic</b><p>Select a question, open Logic, and add a conditional connection to another node.</p></div></div>
        <div className="flow-help"><Layers3 size={15}/><div><b>Arrange your flow</b><p>Drag nodes to organize the respondent journey. Connect handles to create paths.</p></div></div>
        <div className="library-footer"><span className="live-dot"/> Autosave enabled <small>Stored in this browser</small></div>
      </aside>
      <section className="canvas-area">
        <div className="canvas-toolbar"><div><div className="canvas-kicker">VISUAL PROGRAMMING WORKSPACE</div><h1>{surveyTitle}</h1><p>{questions.length} questions <span>·</span> {edges.length} connections <span>·</span> Drag nodes to arrange your flow</p></div><div className="canvas-toolbar-actions"><button className="btn" onClick={() => { const { nodes: n, edges: e } = makeInitial(); setNodes(n); setEdges(e); setSelected("q1"); notify("Starter flow restored"); }}><ClipboardList size={13}/> Reset sample</button><button className="btn" onClick={exportJSON}><Braces size={13}/> JSON</button></div></div>
        <div className="flow-canvas">
          <div className="canvas-hint"><span className="hint-dot"/> CONNECTED SURVEY FLOW <span>·</span> Select a node to edit</div>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, n) => { if (n.data.kind === "question") setSelected(n.id); }} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.25} maxZoom={1.5} defaultEdgeOptions={{ type: "smoothstep", style: edgeStyle }} deleteKeyCode={["Backspace", "Delete"]} proOptions={{ hideAttribution: true }}>
            <Background color="#e5e8f0" gap={22} size={1}/>
            <MiniMap nodeColor={n => n.data.kind === "start" ? "#20ad83" : n.data.kind === "end" ? "#aab1c0" : "#776bea"} maskColor="rgba(246,247,251,.72)" />
            <Controls showInteractive={false}/>
          </ReactFlow>
          <div className="canvas-legend"><span><i className="legend-solid"/> Default path</span><span><i className="legend-dashed"/> Conditional branch</span></div>
        </div>
        <div className="canvas-status"><span><GitBranch size={12}/> Visual flow editor</span><span>Drag from a node handle to create a connection</span></div>
      </section>
      <aside className="flow-inspector">
        <div className="inspector-tabs"><button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><Settings2 size={13}/> Question</button><button className={tab === "logic" ? "active" : ""} onClick={() => setTab("logic")}><GitBranch size={13}/> Logic</button></div>
        {!active ? <div className="inspector-empty"><div><Sparkles size={20}/></div><b>Select a question node</b><p>Click any question on the canvas to edit its wording, options, validation and branching.</p></div> : tab === "settings" ? <>
          <div className="inspector-heading"><span className="inspector-overline">SELECTED NODE</span><h2>{active.variable}</h2><p>{meta[active.type].label}</p></div>
          <div className="inspector-field"><label>QUESTION TEXT</label><textarea rows={3} value={active.title} onChange={e => patchQuestion({ title: e.target.value })}/></div>
          <div className="inspector-field"><label>DESCRIPTION / HINT</label><textarea rows={2} value={active.description} onChange={e => patchQuestion({ description: e.target.value })} placeholder="Add context for respondents…"/></div>
          <div className="inspector-field"><label>VARIABLE NAME</label><input value={active.variable} onChange={e => patchQuestion({ variable: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}/></div>
          {["single", "multi", "dropdown", "matrix"].includes(active.type) && <div className="inspector-field"><label>{active.type === "matrix" ? "MATRIX ROWS" : "ANSWER OPTIONS"}</label>{active.options.map((option, i) => <div className="option-row" key={i}><input value={option} onChange={e => patchQuestion({ options: active.options.map((v, j) => j === i ? e.target.value : v) })}/><button onClick={() => patchQuestion({ options: active.options.filter((_, j) => j !== i) })}><X size={13}/></button></div>)}<button className="add-option" onClick={() => patchQuestion({ options: [...active.options, "New option"] })}><Plus size={12}/> Add option</button></div>}
          {active.type === "rating" && <div className="inspector-field"><label>RATING SCALE</label><select value={active.max || 5} onChange={e => patchQuestion({ max: Number(e.target.value) })}><option value="3">1 to 3</option><option value="5">1 to 5</option><option value="7">1 to 7</option><option value="10">1 to 10</option></select></div>}
          {active.type === "number" && <div className="inspector-field"><label>VALIDATION RANGE</label><div className="range-row"><input type="number" placeholder="Minimum" value={active.min ?? ""} onChange={e => patchQuestion({ min: e.target.value === "" ? undefined : Number(e.target.value) })}/><input type="number" placeholder="Maximum" value={active.max ?? ""} onChange={e => patchQuestion({ max: e.target.value === "" ? undefined : Number(e.target.value) })}/></div></div>}
          <div className="required-row"><span><b>Required question</b><small>Respondents must answer this</small></span><button className={"toggle " + (active.required ? "on" : "")} onClick={() => patchQuestion({ required: !active.required })}><i/></button></div>
          <button className="delete-node" onClick={deleteSelected}><Trash2 size={13}/> Delete question node</button>
        </> : <>
          <div className="inspector-heading"><span className="inspector-overline">ROUTING & CONDITIONS</span><h2>Branching logic</h2><p>Connect an answer path to this question.</p></div>
          <div className="logic-callout"><GitBranch size={15}/><span>Conditional paths appear as dashed purple connections on the canvas.</span></div>
          <div className="inspector-field"><label>FROM QUESTION</label><select value={branchSource} onChange={e => setBranchSource(e.target.value)}><option value="">Choose source node…</option>{questions.filter(n => n.id !== selected).map(n => <option key={n.id} value={n.id}>{n.data.question?.variable} — {n.data.question?.title.slice(0, 30)}</option>)}</select></div>
          <div className="inspector-field"><label>CONDITION LABEL</label><input value={branchLabel} onChange={e => setBranchLabel(e.target.value)} placeholder="e.g. If answer is Yes"/></div>
          <button className="btn btn-primary branch-button" onClick={addBranch} disabled={!branchSource}><GitBranch size={13}/> Add conditional connection</button>
          <div className="logic-note"><b>More precise routing</b><p>Use a clear condition label to document which answer should follow this path. You can also draw connections directly between node handles.</p></div>
          <div className="inspector-field"><label>CONNECTIONS TO THIS NODE</label>{edges.filter(e => e.target === selected).length ? edges.filter(e => e.target === selected).map(e => <div className="connection-item" key={e.id}><span className={String(e.id).startsWith("branch") ? "branch-mark" : "default-mark"}/><span>{nodes.find(n => n.id === e.source)?.data.question?.variable || "Survey start"} <small>{String(e.label || "Default path")}</small></span><button onClick={() => setEdges(es => es.filter(x => x.id !== e.id))}><X size={12}/></button></div>) : <p className="no-connections">No incoming connections yet.</p>}</div>
        </>}
      </aside>
    </div>
    {preview && <div className="preview-overlay"><div className="preview-window"><div className="preview-head"><div><b>Respondent test</b><small>Preview the questionnaire experience</small></div><button className="close-preview" onClick={() => setPreview(false)}><X size={17}/></button></div><div className="preview-body"><div className="preview-kicker">SURVEY PREVIEW</div><h2>{surveyTitle}</h2><p>{surveyDescription}</p><div className="preview-progress"><i style={{ width: previewQuestions.length ? ((previewStep + 1) / previewQuestions.length * 100) + "%" : "0%" }}/></div>{current ? <><small className="preview-count">QUESTION {previewStep + 1} OF {previewQuestions.length}</small><h3>{current.title}{current.required && <em> *</em>}</h3>{current.description && <p>{current.description}</p>}{["single", "multi"].includes(current.type) ? current.options.map(o => <label className="respondent-option" key={o}><input type={current.type === "single" ? "radio" : "checkbox"} name={current.id} checked={current.type === "single" ? answers[current.id] === o : (answers[current.id] || []).includes(o)} onChange={e => setAnswers(a => ({ ...a, [current.id]: current.type === "single" ? o : e.target.checked ? [...(a[current.id] || []), o] : (a[current.id] || []).filter((v: string) => v !== o) }))}/>{o}</label>) : current.type === "dropdown" ? <select value={answers[current.id] || ""} onChange={e => setAnswers(a => ({ ...a, [current.id]: e.target.value }))}><option value="">Select an answer</option>{current.options.map(o => <option key={o}>{o}</option>)}</select> : current.type === "rating" ? <div className="rating-answers">{Array.from({ length: current.max || 5 }, (_, i) => <button className={answers[current.id] === i + 1 ? "chosen" : ""} key={i} onClick={() => setAnswers(a => ({ ...a, [current.id]: i + 1 }))}>{i + 1}</button>)}</div> : current.type === "matrix" ? current.options.map(o => <div className="matrix-answer" key={o}>{o}<select value={answers[current.id]?.[o] || ""} onChange={e => setAnswers(a => ({ ...a, [current.id]: { ...(a[current.id] || {}), [o]: e.target.value } }))}><option value="">Rate…</option>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></div>) : <textarea rows={current.type === "textarea" ? 4 : 1} placeholder="Your answer…" value={answers[current.id] || ""} onChange={e => setAnswers(a => ({ ...a, [current.id]: e.target.value }))}/>}</> : <p>No questions in this survey yet.</p>}<div className="preview-actions"><button className="btn" onClick={() => previewStep === 0 ? setPreview(false) : setPreviewStep(s => s - 1)}><ArrowLeft size={13}/> Back</button>{previewStep < previewQuestions.length - 1 ? <button className="btn btn-primary" onClick={() => { if (current?.required && !answers[current.id]) { notify("Please answer this required question"); return; } setPreviewStep(s => s + 1); }} >Next <ArrowRight size={13}/></button> : <button className="btn btn-primary" onClick={() => { if (current?.required && !answers[current.id]) { notify("Please answer this required question"); return; } submitPreview(); }}>Submit test <Check size={13}/></button>}</div></div></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}
