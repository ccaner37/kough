import {
  ViewPlugin,
  ViewUpdate,
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.textContent = "•";
    span.className = "cm-lp-bullet";
    return span;
  }
}

class HRWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-lp-hr";
    return hr;
  }
}

class CheckboxWidget extends WidgetType {
  checked: boolean;
  pos: number;

  constructor(checked: boolean, pos: number) {
    super();
    this.checked = checked;
    this.pos = pos;
  }

  toDOM(view: EditorView) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "cm-lp-checkbox";
    input.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const line = view.state.doc.lineAt(this.pos);
      const lineText = line.text;
      let newText: string;
      if (this.checked) {
        newText = lineText.replace(/\[[xX]\]/, "[ ]");
      } else {
        newText = lineText.replace(/\[\s\]/, "[x]");
      }
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
      });
    });
    return input;
  }

  eq(other: CheckboxWidget) {
    return this.checked === other.checked && this.pos === other.pos;
  }

  ignoreEvent() {
    return false;
  }
}

function getActiveLines(view: EditorView): Set<number> {
  const lines = new Set<number>();
  for (const r of view.state.selection.ranges) {
    const fromLine = view.state.doc.lineAt(r.from).number;
    const toLine = view.state.doc.lineAt(r.to).number;
    for (let l = fromLine; l <= toLine; l++) {
      lines.add(l);
    }
  }
  return lines;
}

function spansActiveLine(
  nodeFrom: number,
  nodeTo: number,
  activeLines: Set<number>,
  doc: { lineAt: (pos: number) => { number: number } }
): boolean {
  const fromLine = doc.lineAt(nodeFrom).number;
  const toLine = doc.lineAt(Math.max(nodeFrom, nodeTo - 1)).number;
  for (let l = fromLine; l <= toLine; l++) {
    if (activeLines.has(l)) return true;
  }
  return false;
}

function hideEnd(
  to: number,
  doc: { length: number; sliceString: (from: number, to: number) => string }
): number {
  if (to < doc.length && doc.sliceString(to, to + 1) === " ") {
    return to + 1;
  }
  return to;
}

function buildDecorations(view: EditorView): DecorationSet {
  const activeLines = getActiveLines(view);
  const doc = view.state.doc;
  const decos: ReturnType<Decoration["range"]>[] = [];

  syntaxTree(view.state).iterate({
    enter(node) {
      if (spansActiveLine(node.from, node.to, activeLines, doc)) return;

      const t = node.name;
      const line = doc.lineAt(node.from);

      if (t === "HeaderMark") {
        decos.push(
          Decoration.replace({}).range(node.from, hideEnd(node.to, doc))
        );
      }

      if (t === "ATXHeading1") {
        decos.push(Decoration.line({ class: "cm-lp-h1" }).range(line.from));
      }
      if (t === "ATXHeading2") {
        decos.push(Decoration.line({ class: "cm-lp-h2" }).range(line.from));
      }
      if (t === "ATXHeading3") {
        decos.push(Decoration.line({ class: "cm-lp-h3" }).range(line.from));
      }
      if (t === "ATXHeading4") {
        decos.push(Decoration.line({ class: "cm-lp-h4" }).range(line.from));
      }
      if (t === "ATXHeading5") {
        decos.push(Decoration.line({ class: "cm-lp-h4" }).range(line.from));
      }
      if (t === "ATXHeading6") {
        decos.push(Decoration.line({ class: "cm-lp-h4" }).range(line.from));
      }

      if (t === "StrongEmphasis") {
        decos.push(
          Decoration.mark({ class: "cm-lp-strong" }).range(node.from, node.to)
        );
      }
      if (
        t === "EmphasisMark" &&
        node.node.parent?.name === "StrongEmphasis"
      ) {
        decos.push(Decoration.replace({}).range(node.from, node.to));
      }

      if (t === "Emphasis") {
        decos.push(
          Decoration.mark({ class: "cm-lp-em" }).range(node.from, node.to)
        );
      }
      if (t === "EmphasisMark" && node.node.parent?.name === "Emphasis") {
        decos.push(Decoration.replace({}).range(node.from, node.to));
      }

      if (t === "InlineCode") {
        decos.push(
          Decoration.mark({ class: "cm-lp-code" }).range(node.from, node.to)
        );
      }
      if (t === "CodeMark" && node.node.parent?.name === "InlineCode") {
        decos.push(Decoration.replace({}).range(node.from, node.to));
      }

      if (t === "Strikethrough") {
        decos.push(
          Decoration.mark({ class: "cm-lp-del" }).range(node.from, node.to)
        );
      }
      if (
        t === "StrikethroughMark" &&
        node.node.parent?.name === "Strikethrough"
      ) {
        decos.push(Decoration.replace({}).range(node.from, node.to));
      }

      if (t === "QuoteMark") {
        decos.push(
          Decoration.replace({}).range(node.from, hideEnd(node.to, doc))
        );
        decos.push(
          Decoration.line({ class: "cm-lp-blockquote" }).range(line.from)
        );
      }

      if (t === "ListMark") {
        const listParent = node.node.parent?.parent;
        if (listParent?.name === "BulletList") {
          decos.push(
            Decoration.replace({ widget: new BulletWidget() }).range(
              node.from,
              hideEnd(node.to, doc)
            )
          );
        }
      }

      if (t === "HorizontalRule") {
        decos.push(
          Decoration.replace({ widget: new HRWidget() }).range(
            node.from,
            node.to
          )
        );
      }
    },
  });

  for (let i = 1; i <= doc.lines; i++) {
    if (activeLines.has(i)) continue;
    const ln = doc.line(i);
    const match = ln.text.match(/^(\s*)([-*])\s+\[([xX ])\](\s|$)/);
    if (match) {
      const indent = match[1].length;
      const dashFrom = ln.from + indent;
      const dashTo = dashFrom + match[2].length;
      const bracketFrom = dashTo + 1;
      const bracketTo = bracketFrom + 3;
      const afterBracket = hideEnd(bracketTo, doc);

      decos.push(Decoration.replace({}).range(dashFrom, bracketFrom));

      const isChecked = /[xX]/.test(match[3]);
      decos.push(
        Decoration.replace({
          widget: new CheckboxWidget(isChecked, ln.from),
        }).range(bracketFrom, afterBracket)
      );

      if (isChecked) {
        decos.push(
          Decoration.line({ class: "cm-lp-task-checked" }).range(ln.from)
        );
      }
    }
  }

  return Decoration.set(decos, true);
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
