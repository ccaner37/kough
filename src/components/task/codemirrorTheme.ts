import { EditorView } from "@codemirror/view";

export const editorTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    lineHeight: "1.6",
    color: "oklch(0.92 0 0)",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    caretColor: "oklch(0.985 0 0)",
    padding: "0",
  },
  ".cm-cursor": {
    borderLeftColor: "oklch(0.985 0 0)",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "oklch(0.4 0.15 250 / 0.3) !important",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "oklch(0.25 0 0 / 0.4)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-focused": {
    outline: "none",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  ".cm-line": {
    padding: "0 2px",
  },
  ".cm-panels": {
    display: "none",
  },
  ".cm-search": {
    display: "none",
  },
  ".cm-tooltip": {
    display: "none",
  },
});
