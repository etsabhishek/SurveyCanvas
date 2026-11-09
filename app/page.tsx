"use client";

import { useCallback, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Handle, Position, type NodeProps, type Edge } from "reactflow";
import { parseDecipherXml, type SurveyNode, type SurveyNodeData } from "@/lib/decipher-parser";
import { validateSurvey, type ValidationIssue } from "@/lib/survey-validator";
import { Activity, AlertTriangle, ArrowDownToLine, Braces, CheckCircle2, ChevronRight, Code2, FileCode2, FileUp, GitBranch, Info, Layers3, Search, ShieldCheck, UploadCloud, X } from "lucide-react";

function SurveyCard({ data, selected }: NodeProps<SurveyNodeData>) {
  const styles = {
    start: { icon: "▶", color: "green" },
    question: { icon: "Q", color: "blue" },
    logic: { icon: "IF", color: "purple" },
    control: { icon: "◇", color: "amber" },
    terminate: { icon: "⊘", color: "red" },
    end: { icon: "✓", color: "green" }
  }[data.kind];
  return <div className={`survey-node node-${styles.color} ${selected ? "node-selected" : ""}`}>
    {data.kind !== "start" && <Handle type="target" position={Position.Left}/>}
    <div className="survey-node-head"><span className="node-symbol">{styles.icon}</span><span className="node-tag">&lt;{data.tag}&gt;</span><span className="node-index">#{data.index || "—"}</span></div>
    <div className="survey-node-label">{data.label}</div>
    <div className="survey-node-title">{data.title}</div>
    {data.condition && <div className="node-condition"><GitBranch size={10}/>{data.condition}</div>}
    <div className="survey-node-foot"><span>{data.kind.toUpperCase()}</span><span>{data.detail}</span></div>
    {data.kind !== "end" && <Handle type="source" position={Position.Right}/>}
  </div>;
}
const nodeTypes = { surveyNode: SurveyCard };

export default function Home() {
  const [nodes, setNodes] = useState<SurveyNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [fileName, setFileName] = useState("");
  const [surveyTitle, setSurveyTitle] = useState("SurveyCanvas");
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [dragging, setDragging] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [activeTab, setActiveTab] = useState<"canvas" | "validation">("canvas");
  const [showPaste, setShowPaste] = useState(false);
  const [xmlText, setXmlText] = useState("");
  const selected = nodes.find(n => n.id === selectedId);
  const validationIssues = useMemo(() => validateSurvey(nodes), [nodes]);
  const errorCount = validationIssues.filter(i => i.severity === "error").length;
  const warningCount = validationIssues.filter(i => i.severity === "warning").length;
  const filteredNodes = useMemo(() => nodes.filter(n => {
    const matchesFilter = filter === "all" || n.data.kind === filter;
    const q = query.toLowerCase();
    const matchesQuery = !q || [n.data.label, n.data.title, n.data.tag, n.data.condition, n.data.detail].join(" ").toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  }), [nodes, filter, query]);
  const visibleIds = new Set(filteredNodes.map(n => n.id));
  const visibleNodes = nodes.filter(n => visibleIds.has(n.id));
  const visibleEdges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  const parseAndLoad = (xml: string, sourceName: string) => {
    setError(""); setWarnings([]);
    if (!xml.trim()) { setError("Paste your survey XML before generating the canvas."); return; }
    if (xml.length > 15 * 1024 * 1024) { setError("XML is larger than 15 MB. Please use a smaller file or paste a smaller document."); return; }
    try {
      const result = parseDecipherXml(xml);
      setNodes(result.nodes); setEdges(result.edges); setSummary(result.summary);
      setWarnings(result.warnings); setSurveyTitle(result.title); setFileName(sourceName);
      setSelectedId(result.nodes.find(n => n.data.kind === "question")?.id || result.nodes[0]?.id || "");
      setShowPaste(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to parse this XML.");
    }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml") && file.type !== "text/xml" && file.type !== "application/xml") {
      setError("Please upload a Decipher XML file (.xml)."); return;
    }
    if (file.size > 15 * 1024 * 1024) { setError("File is larger than 15 MB. Please upload a smaller XML file."); return; }
    parseAndLoad(await file.text(), file.name);
  };
  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false); void importFile(event.dataTransfer.files?.[0]);
  }, []);
  const exportMap = () => {
    const payload = { sourceFile: fileName, surveyTitle, summary, warnings, nodes, edges };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "surveycanvas-" + (fileName.replace(/\\.xml$/i, "") || "map") + ".json"; a.click(); URL.revokeObjectURL(url);
  };
  const exportSource = () => {
    if (!selected?.data.source) return;
    const blob = new Blob([selected.data.source], { type: "application/xml" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = (selected.data.variable || selected.data.tag) + ".xml"; a.click(); URL.revokeObjectURL(url);
  };

  return <main className="sc-shell">
    <header className="sc-topbar">
      <div className="sc-brand"><div className="sc-logo">S</div><span>SurveyCanvas</span><span className="sc-product-tag">XML ANALYZER</span></div>
      <div className="sc-top-file">{fileName ? <><FileCode2 size={13}/>{fileName}</> : "Decipher survey logic visualizer"}</div>
      <div className="sc-top-actions">
        {nodes.length > 0 && <><span className="sc-private"><ShieldCheck size={12}/> Parsed locally</span><button className="sc-btn" onClick={() => setShowPaste(true)}><Braces size={13}/> Paste XML</button><button className="sc-btn" onClick={exportMap}><ArrowDownToLine size={13}/> Export map</button></>}
        <label className="sc-btn sc-primary"><FileUp size={14}/> Upload XML<input type="file" accept=".xml,text/xml,application/xml" onChange={e => void importFile(e.target.files?.[0])} hidden/></label>
      </div>
    </header>

    {!nodes.length ? <section className="sc-empty-wrap">
      <div className="sc-empty-copy"><div className="sc-eyebrow"><span/> DECIPHER XML → INTERACTIVE LOGIC MAP</div><h1>See your survey logic.<br/><em>Not just the XML.</em></h1><p>Upload a Decipher survey XML file to map its questions, programming controls and conditional expressions into a navigable visual workspace.</p>
        <div className="sc-capabilities"><span><GitBranch size={14}/> Conditions & routing markers</span><span><Layers3 size={14}/> Questions & survey controls</span><span><Code2 size={14}/> Original XML per node</span></div>
      </div>
      <div className={"sc-dropzone " + (dragging ? "drag-active" : "")} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <div className="sc-upload-icon"><UploadCloud size={25}/></div><h2>Drop your XML file here</h2><p>or choose a file from your computer</p>
        <label className="sc-btn sc-primary sc-upload-btn">Choose XML file<input type="file" accept=".xml,text/xml,application/xml" onChange={e => void importFile(e.target.files?.[0])} hidden/></label>
        <small>XML files · Up to 15 MB · Processed in your browser</small>
      </div>
      <div className="sc-paste-entry">
        <div className="sc-paste-heading"><Braces size={15}/><div><b>Prefer to paste XML?</b><small>Copy the contents of your Decipher XML and paste them directly.</small></div></div>
        <button className="sc-btn" onClick={() => { setShowPaste(true); setError(""); }}>Paste XML instead</button>
      </div>
      <div className="sc-privacy-note"><ShieldCheck size={14}/> Your XML is parsed locally in your browser. The file is not uploaded to a server.</div>
      {error && <div className="sc-error"><AlertTriangle size={14}/>{error}</div>}
      <div className="sc-disclaimer"><Info size={13}/> Initial parser supports common Decipher question and control tags. Routing is shown as a structural map; complex Decipher expressions may require manual review.</div>
    </section> : <>
      <div className="sc-summarybar">
        <div className="sc-survey-name"><span className="sc-file-icon"><FileCode2 size={16}/></span><div><b>{surveyTitle}</b><small>{fileName} · Imported XML</small></div></div>
        <div className="sc-stats">
          <span><b>{summary.questions || 0}</b> Questions</span><span><b>{summary.logic || 0}</b> Logic markers</span><span><b>{summary.controls || 0}</b> Controls</span><span><b>{summary.terminations || 0}</b> Terminations</span>
        </div>
        <button className="sc-btn" onClick={() => { setNodes([]); setEdges([]); setFileName(""); setSelectedId(""); setWarnings([]); setError(""); }}><X size={13}/> Close survey</button>
      </div>
      <div className="sc-view-tabs"><button className={activeTab === "canvas" ? "active" : ""} onClick={() => setActiveTab("canvas")}><Layers3 size={13}/> Survey workspace</button><button className={activeTab === "validation" ? "active" : ""} onClick={() => setActiveTab("validation")}><ShieldCheck size={13}/> Validation center <span className={errorCount ? "tab-count has-errors" : "tab-count"}>{validationIssues.length}</span></button><div className="sc-tab-summary"><b>{errorCount}</b> errors <b>{warningCount}</b> warnings · {validationIssues.length} findings</div></div>
      {activeTab === "validation" ? <section className="sc-validation-view"><div className="sc-validation-heading"><div><span>STATIC XML QUALITY CHECKS</span><h2>Validation center</h2><p>Actionable checks against the imported XML structure. Conditions are flagged for review, not executed.</p></div><div className="sc-validation-score"><b>{validationIssues.length}</b><span>findings</span></div></div><div className="sc-validation-metrics"><div><b>{errorCount}</b><span>Errors</span></div><div><b>{warningCount}</b><span>Warnings</span></div><div><b>{validationIssues.filter(i => i.severity === "info").length}</b><span>Review items</span></div><div><b>{nodes.filter(n => n.data.kind === "question").length}</b><span>Questions checked</span></div></div>{validationIssues.length ? <div className="sc-issue-list">{validationIssues.map(issue => <article className="sc-issue" key={issue.id}><div className={"sc-issue-severity " + issue.severity}>{issue.severity === "error" ? "ERROR" : issue.severity === "warning" ? "WARNING" : "REVIEW"}</div><div className="sc-issue-main"><div className="sc-issue-title"><b>{issue.title}</b><span>{issue.rule}</span></div><p>{issue.message}</p><div className="sc-issue-suggestion"><b>Suggested action</b> {issue.suggestion}</div></div>{issue.nodeId && <button className="sc-issue-jump" onClick={() => { setSelectedId(issue.nodeId!); setActiveTab("canvas"); }}>Inspect element <ChevronRight size={12}/></button>}</article>)}</div> : <div className="sc-validation-clean"><CheckCircle2 size={22}/><b>No static issues detected</b><span>That does not prove runtime routing or all Decipher logic is correct. Continue with platform testing.</span></div>}<div className="sc-validation-note"><Info size={13}/> Scope: duplicate/missing QIDs, missing titles, detectable missing choice options, required-status review and condition review markers. This is a static heuristic scan, not a Decipher runtime interpreter.</div></section> : <div className="sc-workspace">
        <aside className="sc-left-panel">
          <div className="sc-panel-heading">SURVEY EXPLORER <span>{nodes.length}</span></div>
          <div className="sc-search"><Search size={13}/><input placeholder="Find QID, text or logic…" value={query} onChange={e => setQuery(e.target.value)}/></div>
          <div className="sc-filter-list">
            {[["all","All elements"],["question","Questions"],["logic","Logic markers"],["control","Survey controls"],["terminate","Terminations"]].map(([v,l]) => <button key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>{l}<span>{v === "all" ? nodes.length : nodes.filter(n => n.data.kind === v).length}</span></button>)}
          </div>
          <div className="sc-tree-list">{filteredNodes.map(n => <button key={n.id} className={selectedId === n.id ? "selected" : ""} onClick={() => setSelectedId(n.id)}><span className={"tree-kind " + n.data.kind}>{n.data.kind === "question" ? "Q" : n.data.kind === "logic" ? "IF" : n.data.kind === "terminate" ? "T" : n.data.kind === "start" ? "▶" : n.data.kind === "end" ? "✓" : "◇"}</span><span><b>{n.data.label}</b><small>{n.data.title}</small></span><ChevronRight size={12}/></button>)}</div>
          <div className="sc-left-foot"><ShieldCheck size={12}/> Local browser session</div>
        </aside>
        <section className="sc-canvas-section">
          <div className="sc-canvas-toolbar"><div><b>LOGIC CANVAS</b><span> · {visibleNodes.length} visible elements</span></div><div><span className="sc-legend"><i className="q"/> Question</span><span className="sc-legend"><i className="l"/> Logic</span><span className="sc-legend"><i className="c"/> Control</span></div></div>
          <div className="sc-canvas">
            <ReactFlow nodes={visibleNodes} edges={visibleEdges} nodeTypes={nodeTypes} onNodeClick={(_, n) => setSelectedId(n.id)} fitView fitViewOptions={{ padding: .24 }} minZoom={.12} maxZoom={1.4} nodesDraggable nodesConnectable={false} elementsSelectable proOptions={{ hideAttribution: true }}>
              <Background color="#e6e9f0" gap={22} size={1}/><MiniMap pannable zoomable nodeColor={n => ({question:"#6579df",logic:"#8b72dc",control:"#d49a4f",terminate:"#d46b78",start:"#30a17b",end:"#30a17b"} as Record<string,string>)[(n.data as SurveyNodeData).kind] || "#9ba4b5"} maskColor="rgba(247,248,251,.7)"/><Controls showInteractive={false}/>
            </ReactFlow>
            {visibleNodes.length === 0 && <div className="sc-no-results">No elements match this search.</div>}
          </div>
          <div className="sc-canvas-foot"><span><Activity size={12}/> XML structure map</span><span>Connections follow document order, not a verified runtime simulation.</span></div>
        </section>
        <aside className="sc-inspector">
          <div className="sc-inspector-head"><div><span>ELEMENT INSPECTOR</span><b>{selected?.data.label || "Select an element"}</b></div><button onClick={() => setShowSource(v => !v)}><Code2 size={14}/></button></div>
          {selected ? <div className="sc-inspector-body">
            <div className="sc-element-type"><span className={"tree-kind " + selected.data.kind}>{selected.data.tag.slice(0,3).toUpperCase()}</span><div><b>&lt;{selected.data.tag}&gt;</b><small>{selected.data.kind} element · #{selected.data.index}</small></div></div>
            <div className="sc-detail-field"><label>LABEL / QID</label><div>{selected.data.variable || "—"}</div></div>
            <div className="sc-detail-field"><label>QUESTION / ELEMENT TITLE</label><div>{selected.data.title}</div></div>
            {selected.data.condition && <div className="sc-detail-field"><label>CONDITION ATTRIBUTE</label><pre>{selected.data.condition}</pre></div>}
            <div className="sc-detail-field"><label>XML ATTRIBUTES</label><div className="sc-attributes">{Object.entries(selected.data.attributes).length ? Object.entries(selected.data.attributes).map(([k,v]) => <div key={k}><span>{k}</span><b>{v}</b></div>) : <small>No attributes</small>}</div></div>
            {showSource && <div className="sc-source-block"><div><label>ORIGINAL XML</label><button onClick={exportSource}><ArrowDownToLine size={11}/> Save snippet</button></div><pre>{selected.data.source || "No source XML for this structural marker."}</pre></div>}
          </div> : <div className="sc-inspector-empty">Select a node on the canvas or in the explorer to inspect its XML attributes and source snippet.</div>}
          {warnings.length > 0 && <div className="sc-warnings"><div><AlertTriangle size={13}/> PARSER NOTES <b>{warnings.length}</b></div>{warnings.slice(0,8).map((w,i) => <p key={i}>{w}</p>)}{warnings.length > 8 && <small>+ {warnings.length - 8} more notes</small>}</div>}
        </aside>
      </div>}
    </>}
    {showPaste && <div className="sc-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="paste-xml-title">
      <section className="sc-paste-modal">
        <div className="sc-paste-modal-head"><div><span className="sc-modal-icon"><Braces size={17}/></span><div><h2 id="paste-xml-title">Paste survey XML</h2><p>Paste the complete Decipher XML document below.</p></div></div><button aria-label="Close" onClick={() => setShowPaste(false)}><X size={17}/></button></div>
        <textarea autoFocus spellCheck={false} value={xmlText} onChange={e => setXmlText(e.target.value)} placeholder={'<?xml version="1.0"?>\n<survey ...>\n  ...\n</survey>'}/>
        <div className="sc-paste-modal-foot"><span>{xmlText.length.toLocaleString()} characters · 15 MB maximum · Parsed locally</span><div><button className="sc-btn" onClick={() => { setXmlText(""); setError(""); }}>Clear</button><button className="sc-btn sc-primary" onClick={() => parseAndLoad(xmlText, "Pasted XML")}><GitBranch size={13}/> Generate canvas</button></div></div>
        {error && <div className="sc-error"><AlertTriangle size={13}/>{error}</div>}
      </section>
    </div>}
    {error && nodes.length > 0 && !showPaste && <div className="sc-toast-error"><AlertTriangle size={13}/>{error}</div>}
  </main>;
}
