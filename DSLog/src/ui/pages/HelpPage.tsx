import React from "react";
import { PRODUCT_NAME } from "@shared/constants/brand";

const WORKFLOW_STEPS: { title: string; body: string }[] = [
  { title: "Track", body: "Pick which components (by selection, page, or whole document) and token collections to watch, from the Track tab." },
  { title: "Create a baseline", body: "DSLog scans what you picked and stores it as your starting point — e.g. v1.0.0." },
  { title: "Keep working", body: "Edit components and tokens in Figma as normal. DSLog doesn't watch anything in the background." },
  { title: "Scan for changes", body: "From Overview, click \"Scan for changes\" to compare the current file against your baseline." },
  { title: "Review changes", body: "On the Changes tab, read what changed, mark items reviewed, add notes, and confirm or dismiss any possible renames." },
  { title: "Create a release", body: "On the Releases tab, DSLog recommends a version and flags anything worth checking first. Creating a release bundles everything into a changelog and becomes your new baseline." },
  { title: "Browse History", body: "See what changed release-by-release, per component, or per token — including deprecations, impact, and how tokens depend on each other." },
];

const PAGES: { name: string; body: string }[] = [
  { name: "Overview", body: "A snapshot of where things stand: current release, tracked component/token counts, and what's changed since your last release." },
  { name: "Track", body: "Choose what DSLog watches. You only need to do this once per baseline, or again if you want to change scope." },
  { name: "Changes", body: "The full list of changes detected by your last scan — filterable by category, entity type, review state, and breaking status. Select items and apply a review state in bulk." },
  { name: "Releases", body: "Turn reviewed changes into a versioned release. Shows a recommended version, a readiness checklist (only an invalid or duplicate version actually blocks you — everything else is a heads-up), and any migration notes the release should document. Past releases are listed with their changelog." },
  { name: "History", body: "Five tabs: Releases (browse any past release's full change list), Components and Tokens (a timeline for one entity, including across confirmed renames), Deprecations (everything marked deprecated, with replacement status), and Compare (diff any two releases directly, not just adjacent ones)." },
  { name: "Settings", body: "Appearance, what gets tracked/detected by default, and a reminder of what DSLog does and doesn't do with your data (nothing leaves Figma, ever)." },
];

const GLOSSARY: { term: string; def: string }[] = [
  { term: "Baseline", def: "A stored snapshot of your tracked components/tokens at a point in time. Every scan compares the current file against the current baseline." },
  { term: "Scan", def: "Re-checks the tracked components/tokens against the current baseline and lists what's different." },
  { term: "Breaking / Potentially breaking / Non-breaking / Informational", def: "DSLog's verdict on a change, always one of these four — never a confidence score. You can override any classification by hand." },
  { term: "Deprecated", def: "A component, variant, property, or token you've manually flagged as being phased out, optionally with a replacement and migration note." },
  { term: "Possible rename", def: "When a component or token disappears and another one appears with a matching key or matching structure, DSLog flags it as a likely rename instead of silently merging them — you confirm or dismiss it." },
  { term: "Impact index", def: "An optional, explicit document-wide scan that counts how many places each component is actually used. It's never built automatically — look for \"Build impact index\" wherever instance counts are shown." },
  { term: "Review state", def: "Unreviewed, Reviewed, Accepted, or Rejected — a workflow status you set on each change, independent of its breaking classification." },
];

export function HelpPage() {
  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Help</div>
          <div className="view-subtitle">How to use {PRODUCT_NAME}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Getting started
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {WORKFLOW_STEPS.map((step) => (
              <li key={step.title} style={{ fontSize: 12.5 }}>
                <span style={{ fontWeight: 700 }}>{step.title}</span>
                <span className="text-secondary"> — {step.body}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Pages
          </div>
          <div className="flex flex-col gap-3">
            {PAGES.map((page) => (
              <div key={page.name}>
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>{page.name}</div>
                <div className="text-secondary" style={{ fontSize: 12 }}>
                  {page.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Glossary
          </div>
          <div className="flex flex-col gap-3">
            {GLOSSARY.map((entry) => (
              <div key={entry.term}>
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>{entry.term}</div>
                <div className="text-secondary" style={{ fontSize: 12 }}>
                  {entry.def}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
