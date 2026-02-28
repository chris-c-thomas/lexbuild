/**
 * AST Builder — converts XML parser events into an AST tree.
 *
 * Implements the section-emit pattern: when a section (or other configured level)
 * close tag is encountered, the completed LevelNode is emitted via callback
 * and its subtree is released from memory.
 */

import type { Attributes } from "../xml/parser.js";
import { LEVEL_ELEMENTS, CONTENT_ELEMENTS, INLINE_ELEMENTS } from "../xml/namespace.js";
import { LEVEL_TYPES } from "./types.js";
import type {
  LevelType,
  LevelNode,
  ContentNode,
  ContentVariant,
  InlineNode,
  InlineType,
  NoteNode,
  SourceCreditNode,
  TableNode,
  NotesContainerNode,
  QuotedContentNode,
  ASTNode,
  AncestorInfo,
  DocumentMeta,
  EmitContext,
} from "./types.js";

/** Options for configuring the AST builder */
export interface ASTBuilderOptions {
  /** Emit completed nodes at this level instead of accumulating */
  emitAt: LevelType;
  /** Callback when a completed node is ready */
  onEmit: (node: LevelNode, context: EmitContext) => void | Promise<void>;
}

/** Map from inline XML element names to InlineType discriminators */
const INLINE_TYPE_MAP: Readonly<Record<string, InlineType>> = {
  b: "bold",
  i: "italic",
  sub: "sub",
  sup: "sup",
  ref: "ref",
  date: "date",
  term: "term",
  inline: "text",
  shortTitle: "text",
  del: "text",
  ins: "text",
};

/**
 * Internal representation of a frame on the builder stack.
 * Each open XML element that we care about pushes a frame.
 */
interface StackFrame {
  /** What kind of frame this is */
  kind: "level" | "content" | "inline" | "note" | "sourceCredit" | "notesContainer" | "quotedContent" | "meta" | "ignore";
  /** The AST node being constructed (null for meta/ignore frames) */
  node: ASTNode | null;
  /** The XML element name that opened this frame */
  elementName: string;
  /** Accumulated text for simple text-collecting frames (meta fields, etc.) */
  textBuffer: string;
}

/** State for collecting an XHTML table */
interface TableCollector {
  /** Header rows (from thead) */
  headers: string[][];
  /** Body rows (from tbody or bare tr) */
  rows: string[][];
  /** Current row being built */
  currentRow: string[];
  /** Current cell text accumulator */
  cellText: string;
  /** Whether we're currently inside thead */
  inHead: boolean;
  /** Whether we're currently inside a cell (th or td) */
  inCell: boolean;
  /** Whether this table has colspan or rowspan (complex) */
  isComplex: boolean;
  /** Nesting depth for sub-elements inside cells */
  cellDepth: number;
}

/**
 * Builds an AST from XML parser events, emitting completed subtrees at the configured level.
 */
export class ASTBuilder {
  private readonly options: ASTBuilderOptions;
  private readonly stack: StackFrame[] = [];
  private readonly ancestors: AncestorInfo[] = [];
  private readonly documentMeta: DocumentMeta = {};

  /** Whether we are currently inside the <meta> block */
  private inMeta = false;
  /** Nesting depth inside <quotedContent> — levels inside quotes are not emitted */
  private quotedContentDepth = 0;
  /** Active XHTML table collector (null when not inside a table) */
  private tableCollector: TableCollector | null = null;
  /** Active USLM layout collector (null when not inside a layout) */
  private layoutCollector: TableCollector | null = null;
  /** Nesting depth inside <toc> — elements inside toc are handled by layout collector only */
  private tocDepth = 0;
  /** Current meta field being collected (e.g., "dc:title", "docNumber") */
  private metaField: string | null = null;
  /** Attributes of the current meta property element */
  private metaPropertyAttrs: Attributes | null = null;

  constructor(options: ASTBuilderOptions) {
    this.options = options;
  }

  /** Returns the document metadata collected so far */
  getDocumentMeta(): DocumentMeta {
    return this.documentMeta;
  }

  /**
   * Handle an openElement event from the parser.
   */
  onOpenElement(name: string, attrs: Attributes): void {
    // Handle meta block
    if (name === "meta") {
      this.inMeta = true;
      this.stack.push({ kind: "meta", node: null, elementName: name, textBuffer: "" });
      return;
    }

    if (this.inMeta) {
      this.handleMetaOpen(name, attrs);
      return;
    }

    // Handle uscDoc root — extract identifier
    if (name === "uscDoc") {
      if (attrs["identifier"]) {
        this.documentMeta.identifier = attrs["identifier"];
      }
      return;
    }

    // Skip structural containers that don't produce AST nodes
    if (name === "main") {
      return;
    }

    // --- Collector zones: checked BEFORE normal element handlers ---

    if (name === "xhtml:table") {
      this.tableCollector = {
        headers: [], rows: [], currentRow: [], cellText: "",
        inHead: false, inCell: false, isComplex: false, cellDepth: 0,
      };
      return;
    }
    if (this.tableCollector) {
      this.handleTableOpen(name, attrs);
      return;
    }

    if (name === "layout") {
      this.layoutCollector = {
        headers: [], rows: [], currentRow: [], cellText: "",
        inHead: false, inCell: false, isComplex: false, cellDepth: 0,
      };
      return;
    }
    if (this.layoutCollector) {
      this.handleLayoutOpen(name, attrs);
      return;
    }

    if (name === "toc") {
      this.tocDepth++;
      return;
    }
    if (this.tocDepth > 0) {
      return;
    }

    // --- Normal element handlers ---

    // Handle level elements (title, chapter, section, subsection, etc.)
    if (LEVEL_ELEMENTS.has(name)) {
      this.openLevel(name as LevelType, attrs);
      return;
    }

    // Handle content block elements
    if (CONTENT_ELEMENTS.has(name)) {
      this.openContent(name as ContentVariant, attrs);
      return;
    }

    // Handle inline elements
    if (INLINE_ELEMENTS.has(name)) {
      this.openInline(name, attrs);
      return;
    }

    // Handle note-related elements
    if (name === "notes") {
      this.openNotesContainer(attrs);
      return;
    }

    if (name === "note" || name === "statutoryNote" || name === "editorialNote" || name === "changeNote") {
      this.openNote(name, attrs);
      return;
    }

    if (name === "sourceCredit") {
      this.openSourceCredit();
      return;
    }

    if (name === "quotedContent") {
      this.openQuotedContent(attrs);
      return;
    }

    // Handle elements that collect text within a parent
    if (name === "num") {
      // Immediately set numValue from the value attribute on the parent level
      const parentFrame = this.findParentFrame("level");
      if (parentFrame && attrs["value"]) {
        (parentFrame.node as LevelNode).numValue = attrs["value"];
      }
      this.stack.push({ kind: "ignore", node: null, elementName: name, textBuffer: "" });
      return;
    }

    if (name === "heading") {
      this.stack.push({ kind: "ignore", node: null, elementName: name, textBuffer: "" });
      return;
    }

    // Handle <p> elements — they're content-like within their parent
    if (name === "p") {
      // p elements don't create separate AST nodes; their text flows
      // into the parent content/note node. We push a frame to collect text.
      this.stack.push({ kind: "ignore", node: null, elementName: name, textBuffer: "" });
      return;
    }

    // Remaining unhandled elements — push ignore frame so close events balance
    this.stack.push({ kind: "ignore", node: null, elementName: name, textBuffer: "" });
  }

  /**
   * Handle a closeElement event from the parser.
   */
  onCloseElement(name: string): void {
    // Handle meta block close
    if (name === "meta") {
      this.inMeta = false;
      this.popFrame("meta");
      return;
    }

    if (this.inMeta) {
      this.handleMetaClose(name);
      return;
    }

    // Skip structural containers
    if (name === "uscDoc" || name === "main") {
      return;
    }

    // Handle XHTML table close
    if (name === "xhtml:table" && this.tableCollector) {
      this.finishTable();
      return;
    }

    if (this.tableCollector) {
      this.handleTableClose(name);
      return;
    }

    // Handle </toc> close
    if (name === "toc") {
      this.tocDepth = Math.max(0, this.tocDepth - 1);
      return;
    }

    // Handle USLM layout close
    if (name === "layout" && this.layoutCollector) {
      this.finishLayout();
      return;
    }

    if (this.layoutCollector) {
      this.handleLayoutClose(name);
      return;
    }

    // Skip elements inside toc that aren't in a layout
    if (this.tocDepth > 0) {
      return;
    }

    // Handle <num> — set on parent level node
    if (name === "num" || name === "heading") {
      const frame = this.peekFrame();
      if (frame?.elementName === name) {
        this.handleNumOrHeadingClose(name, frame);
        this.stack.pop();
        return;
      }
    }

    // Handle <p> close
    if (name === "p") {
      const frame = this.peekFrame();
      if (frame?.elementName === "p") {
        this.handlePClose(frame);
        this.stack.pop();
        return;
      }
    }

    // Handle level close
    if (LEVEL_ELEMENTS.has(name)) {
      this.closeLevel(name as LevelType);
      return;
    }

    // Handle content block close
    if (CONTENT_ELEMENTS.has(name)) {
      this.closeContent();
      return;
    }

    // Handle inline close
    if (INLINE_ELEMENTS.has(name)) {
      this.closeInline();
      return;
    }

    // Handle notes container close
    if (name === "notes") {
      this.closeNotesContainer();
      return;
    }

    // Handle note close
    if (name === "note" || name === "statutoryNote" || name === "editorialNote" || name === "changeNote") {
      this.closeNote();
      return;
    }

    // Handle sourceCredit close
    if (name === "sourceCredit") {
      this.closeSourceCredit();
      return;
    }

    // Handle quotedContent close
    if (name === "quotedContent") {
      this.closeQuotedContent();
      return;
    }

    // Pop ignore frames
    const frame = this.peekFrame();
    if (frame?.kind === "ignore" && frame.elementName === name) {
      this.stack.pop();
    }
  }

  /**
   * Handle a text event from the parser.
   */
  onText(text: string): void {
    // Collect text inside XHTML table cells
    if (this.tableCollector?.inCell) {
      this.tableCollector.cellText += text;
      return;
    }

    // Skip all text inside tables but outside cells (whitespace between elements)
    if (this.tableCollector) {
      return;
    }

    // Collect text inside layout cells
    if (this.layoutCollector?.inCell) {
      this.layoutCollector.cellText += text;
      return;
    }

    // Skip text inside layout but outside cells
    if (this.layoutCollector) {
      return;
    }

    // Skip text inside toc but outside layout
    if (this.tocDepth > 0) {
      return;
    }

    if (this.inMeta) {
      // Accumulate text for meta fields
      const frame = this.peekFrame();
      if (frame) {
        frame.textBuffer += text;
      }
      return;
    }

    // Find the nearest frame that can accept text
    const frame = this.peekFrame();
    if (!frame) return;

    if (frame.kind === "ignore") {
      // Accumulate in text buffer (for num, heading, p)
      frame.textBuffer += text;
      return;
    }

    if (frame.kind === "inline") {
      // Append text to the inline node
      const inlineNode = frame.node as InlineNode;
      const textChild: InlineNode = { type: "inline", inlineType: "text", text };
      if (!inlineNode.children) {
        inlineNode.children = [];
      }
      inlineNode.children.push(textChild);

      // Also bubble text up to any heading/num ignore frame below this inline
      // (handles <heading><b>Editorial Notes</b></heading> pattern)
      this.bubbleTextToCollector(text);
      return;
    }

    if (frame.kind === "content" || frame.kind === "sourceCredit") {
      // Skip whitespace-only text between <p> elements (XML formatting noise)
      if (!text.trim()) return;
      // Create a text inline node and append to parent
      const textNode: InlineNode = { type: "inline", inlineType: "text", text };
      const parent = frame.node;
      if (parent && "children" in parent && Array.isArray(parent.children)) {
        (parent.children as InlineNode[]).push(textNode);
      }
      return;
    }

    if (frame.kind === "note" || frame.kind === "quotedContent") {
      // Text directly inside a note or quotedContent — wrap in a content node
      const trimmed = text.trim();
      if (trimmed) {
        const textNode: InlineNode = { type: "inline", inlineType: "text", text };
        const contentNode: ContentNode = { type: "content", variant: "content", children: [textNode] };
        const parent = frame.node;
        if (parent && "children" in parent && Array.isArray(parent.children)) {
          (parent.children as ASTNode[]).push(contentNode);
        }
      }
      return;
    }

    if (frame.kind === "level") {
      // Text directly inside a level (unusual but possible) — same as note
      const trimmed = text.trim();
      if (trimmed) {
        const textNode: InlineNode = { type: "inline", inlineType: "text", text };
        const contentNode: ContentNode = { type: "content", variant: "content", children: [textNode] };
        (frame.node as LevelNode).children.push(contentNode);
      }
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Meta handling
  // ---------------------------------------------------------------------------

  private handleMetaOpen(name: string, attrs: Attributes): void {
    this.metaField = name;
    this.metaPropertyAttrs = attrs;
    this.stack.push({ kind: "ignore", node: null, elementName: name, textBuffer: "" });
  }

  private handleMetaClose(name: string): void {
    const frame = this.peekFrame();
    if (frame?.elementName !== name) return;

    const text = frame.textBuffer.trim();
    this.stack.pop();

    switch (this.metaField) {
      case "dc:title":
        this.documentMeta.dcTitle = text;
        break;
      case "dc:type":
        this.documentMeta.dcType = text;
        break;
      case "docNumber":
        this.documentMeta.docNumber = text;
        break;
      case "docPublicationName":
        this.documentMeta.docPublicationName = text;
        break;
      case "docReleasePoint":
        this.documentMeta.releasePoint = text;
        break;
      case "dc:publisher":
        this.documentMeta.publisher = text;
        break;
      case "dcterms:created":
        this.documentMeta.created = text;
        break;
      case "dc:creator":
        this.documentMeta.creator = text;
        break;
      case "property":
        if (this.metaPropertyAttrs?.["role"] === "is-positive-law") {
          this.documentMeta.positivelaw = text.toLowerCase() === "yes";
        }
        break;
    }

    this.metaField = null;
    this.metaPropertyAttrs = null;
  }

  // ---------------------------------------------------------------------------
  // Level handling
  // ---------------------------------------------------------------------------

  private openLevel(levelType: LevelType, attrs: Attributes): void {
    const node: LevelNode = {
      type: "level",
      levelType,
      identifier: attrs["identifier"],
      status: attrs["status"],
      sourceElement: levelType,
      children: [],
    };

    // If this is a big level (above the emit level) and we're NOT inside quotedContent,
    // push an ancestor placeholder. The heading and numValue will be filled in later.
    const emitIndex = LEVEL_TYPES_ARRAY.indexOf(this.options.emitAt);
    const thisIndex = LEVEL_TYPES_ARRAY.indexOf(levelType);
    if (thisIndex >= 0 && thisIndex < emitIndex && this.quotedContentDepth === 0) {
      this.ancestors.push({
        levelType,
        identifier: attrs["identifier"],
      });
    }

    this.stack.push({ kind: "level", node, elementName: levelType, textBuffer: "" });
  }

  private closeLevel(levelType: LevelType): void {
    const frame = this.popFrame("level");
    if (!frame) return;

    const node = frame.node as LevelNode;

    // If we're inside a quotedContent, don't emit — treat as a child node
    if (this.quotedContentDepth > 0) {
      this.addToParent(node);
      return;
    }

    // Should we emit this node?
    if (levelType === this.options.emitAt) {
      const context: EmitContext = {
        ancestors: [...this.ancestors],
        documentMeta: { ...this.documentMeta },
      };
      this.options.onEmit(node, context);
      return;
    }

    // Is this an ancestor level above the emit level?
    // If so, track it in the ancestors array but don't add to parent
    const emitIndex = LEVEL_TYPES_ARRAY.indexOf(this.options.emitAt);
    const thisIndex = LEVEL_TYPES_ARRAY.indexOf(levelType);

    if (thisIndex < emitIndex) {
      // Closing a big level — remove from ancestors
      this.ancestors.pop();
      return;
    }

    // Small level below emit level — add to parent as a child
    this.addToParent(node);
  }

  // ---------------------------------------------------------------------------
  // Content handling
  // ---------------------------------------------------------------------------

  private openContent(variant: ContentVariant, _attrs: Attributes): void {
    const node: ContentNode = {
      type: "content",
      variant,
      sourceElement: variant,
      children: [],
    };
    this.stack.push({ kind: "content", node, elementName: variant, textBuffer: "" });
  }

  private closeContent(): void {
    const frame = this.popFrame("content");
    if (!frame) return;
    if (frame.node) this.addToParent(frame.node);
  }

  // ---------------------------------------------------------------------------
  // Inline handling
  // ---------------------------------------------------------------------------

  private openInline(name: string, attrs: Attributes): void {
    const inlineType = INLINE_TYPE_MAP[name] ?? "text";

    const node: InlineNode = {
      type: "inline",
      inlineType,
      sourceElement: name,
    };

    // Handle ref-specific attributes
    if (name === "ref") {
      if (attrs["href"]) {
        node.href = attrs["href"];
      }
      if (attrs["class"] === "footnoteRef") {
        node.inlineType = "footnoteRef";
        node.idref = attrs["idref"];
      }
    }

    // Handle date attribute
    if (name === "date" && attrs["date"]) {
      node.href = attrs["date"]; // Store ISO date in href for convenience
    }

    this.stack.push({ kind: "inline", node, elementName: name, textBuffer: "" });
  }

  private closeInline(): void {
    const frame = this.popFrame("inline");
    if (!frame) return;

    const node = frame.node as InlineNode;

    // If this inline has no children but has accumulated text in parent, that's fine
    // The text was added as children by onText

    // If there's only one text child, flatten it
    const firstChild = node.children?.[0];
    if (node.children?.length === 1 && firstChild?.inlineType === "text" && !firstChild.children) {
      node.text = firstChild.text;
      node.children = undefined;
    }

    this.addInlineToParent(node);
  }

  // ---------------------------------------------------------------------------
  // Note handling
  // ---------------------------------------------------------------------------

  private openNotesContainer(attrs: Attributes): void {
    const node: NotesContainerNode = {
      type: "notesContainer",
      notesType: attrs["type"],
      children: [],
    };
    this.stack.push({ kind: "notesContainer", node, elementName: "notes", textBuffer: "" });
  }

  private closeNotesContainer(): void {
    const frame = this.popFrame("notesContainer");
    if (!frame) return;
    if (frame.node) this.addToParent(frame.node);
  }

  private openNote(name: string, attrs: Attributes): void {
    const node: NoteNode = {
      type: "note",
      topic: attrs["topic"],
      role: attrs["role"],
      sourceElement: name,
      children: [],
    };
    this.stack.push({ kind: "note", node, elementName: name, textBuffer: "" });
  }

  private closeNote(): void {
    const frame = this.popFrame("note");
    if (!frame) return;
    if (frame.node) this.addToParent(frame.node);
  }

  // ---------------------------------------------------------------------------
  // SourceCredit handling
  // ---------------------------------------------------------------------------

  private openSourceCredit(): void {
    const node: SourceCreditNode = {
      type: "sourceCredit",
      children: [],
    };
    this.stack.push({ kind: "sourceCredit", node, elementName: "sourceCredit", textBuffer: "" });
  }

  private closeSourceCredit(): void {
    const frame = this.popFrame("sourceCredit");
    if (!frame) return;
    if (frame.node) this.addToParent(frame.node);
  }

  // ---------------------------------------------------------------------------
  // QuotedContent handling
  // ---------------------------------------------------------------------------

  private openQuotedContent(attrs: Attributes): void {
    this.quotedContentDepth++;
    const node: QuotedContentNode = {
      type: "quotedContent",
      origin: attrs["origin"],
      children: [],
    };
    this.stack.push({ kind: "quotedContent", node, elementName: "quotedContent", textBuffer: "" });
  }

  private closeQuotedContent(): void {
    this.quotedContentDepth--;
    const frame = this.popFrame("quotedContent");
    if (!frame) return;

    // Add as inline "quoted" node if parent is content/inline,
    // or as block node if parent is note/level
    const parentFrame = this.peekFrame();
    if (parentFrame && (parentFrame.kind === "content" || parentFrame.kind === "inline" || parentFrame.kind === "sourceCredit")) {
      // Flatten to inline quoted text
      const qNode: InlineNode = {
        type: "inline",
        inlineType: "quoted",
        text: this.extractText(frame.node as QuotedContentNode),
      };
      this.addInlineToParent(qNode);
    } else {
      if (frame.node) this.addToParent(frame.node);
    }
  }

  // ---------------------------------------------------------------------------
  // Num/Heading/P helpers
  // ---------------------------------------------------------------------------

  private handleNumOrHeadingClose(name: string, frame: StackFrame): void {
    const text = frame.textBuffer.trim();

    // First check if parent is a note (heading inside note)
    const noteFrame = this.findParentFrame("note");
    const levelFrame = this.findParentFrame("level");

    // Heading inside a note takes priority
    if (name === "heading" && noteFrame && (!levelFrame || this.stack.indexOf(noteFrame) > this.stack.indexOf(levelFrame))) {
      (noteFrame.node as NoteNode).heading = text;
      return;
    }

    // Otherwise, apply to parent level
    if (!levelFrame) return;
    const levelNode = levelFrame.node as LevelNode;

    if (name === "num") {
      levelNode.num = text;
      // numValue was already set from the value attribute in onOpenElement
    } else if (name === "heading") {
      levelNode.heading = text;
    }

    // Update ancestor entry if this is a big level
    const ancestor = this.ancestors.find((a) => a.levelType === levelNode.levelType && a.identifier === levelNode.identifier);
    if (ancestor) {
      if (name === "num") {
        ancestor.numValue = levelNode.numValue;
      } else if (name === "heading") {
        ancestor.heading = text;
      }
    }
  }

  private handlePClose(frame: StackFrame): void {
    const text = frame.textBuffer;
    if (!text) return;

    // Find the nearest parent that accepts content
    const parentFrame = this.peekFrameAbove(frame);
    if (!parentFrame) return;

    if (parentFrame.kind === "content" || parentFrame.kind === "sourceCredit") {
      const textNode: InlineNode = { type: "inline", inlineType: "text", text };
      const parent = parentFrame.node;
      if (parent && "children" in parent && Array.isArray(parent.children)) {
        const children = parent.children as InlineNode[];
        // Add paragraph break before this <p>'s text if there are prior children
        if (children.length > 0) {
          children.push({ type: "inline", inlineType: "text", text: "\n\n" });
        }
        children.push(textNode);
      }
    } else if (parentFrame.kind === "note" || parentFrame.kind === "level" || parentFrame.kind === "quotedContent") {
      // Wrap in a ContentNode
      const textNode: InlineNode = { type: "inline", inlineType: "text", text };
      const contentNode: ContentNode = { type: "content", variant: "content", children: [textNode] };
      const parent = parentFrame.node;
      if (parent && "children" in parent && Array.isArray(parent.children)) {
        (parent.children as ASTNode[]).push(contentNode);
      }
    }
  }

  /**
   * Bubble text content up to the nearest heading/num ignore frame on the stack.
   * This handles patterns like <heading><b>Editorial Notes</b></heading>
   * where the text is inside an inline child but needs to be collected by the heading frame.
   */
  // ---------------------------------------------------------------------------
  // XHTML table handling
  // ---------------------------------------------------------------------------

  private handleTableOpen(name: string, attrs: Attributes): void {
    const tc = this.tableCollector;
    if (!tc) return;

    switch (name) {
      case "xhtml:thead":
        tc.inHead = true;
        break;
      case "xhtml:tbody":
        tc.inHead = false;
        break;
      case "xhtml:tr":
        tc.currentRow = [];
        break;
      case "xhtml:th":
      case "xhtml:td":
        tc.inCell = true;
        tc.cellText = "";
        tc.cellDepth = 0;
        // Detect complex tables
        if (attrs["colspan"] && attrs["colspan"] !== "1") {
          tc.isComplex = true;
        }
        if (attrs["rowspan"] && attrs["rowspan"] !== "1") {
          tc.isComplex = true;
        }
        break;
      // Sub-elements inside cells (p, span, i, a, etc.) — track depth
      default:
        if (tc.inCell) {
          tc.cellDepth++;
        }
        break;
    }
  }

  private handleTableClose(name: string): void {
    const tc = this.tableCollector;
    if (!tc) return;

    switch (name) {
      case "xhtml:thead":
        tc.inHead = false;
        break;
      case "xhtml:tbody":
        break;
      case "xhtml:tr":
        if (tc.inHead) {
          tc.headers.push(tc.currentRow);
        } else {
          tc.rows.push(tc.currentRow);
        }
        tc.currentRow = [];
        break;
      case "xhtml:th":
      case "xhtml:td":
        tc.currentRow.push(tc.cellText.trim());
        tc.inCell = false;
        tc.cellText = "";
        break;
      default:
        if (tc.inCell) {
          tc.cellDepth = Math.max(0, tc.cellDepth - 1);
        }
        break;
    }
  }

  private finishTable(): void {
    const tc = this.tableCollector;
    if (!tc) return;

    this.tableCollector = null;

    const node: TableNode = {
      type: "table",
      variant: "xhtml",
      headers: tc.headers,
      rows: tc.rows,
    };

    this.addToParent(node);
  }

  // ---------------------------------------------------------------------------
  // USLM layout handling
  // ---------------------------------------------------------------------------

  private handleLayoutOpen(name: string, _attrs: Attributes): void {
    const lc = this.layoutCollector;
    if (!lc) return;

    switch (name) {
      case "header":
        lc.inHead = true;
        lc.currentRow = [];
        break;
      case "tocItem":
      case "row":
        lc.currentRow = [];
        break;
      case "column":
        lc.inCell = true;
        lc.cellText = "";
        break;
      default:
        // Sub-elements inside column (ref, etc.) — just collect text
        break;
    }
  }

  private handleLayoutClose(name: string): void {
    const lc = this.layoutCollector;
    if (!lc) return;

    switch (name) {
      case "header":
        lc.headers.push(lc.currentRow);
        lc.currentRow = [];
        lc.inHead = false;
        break;
      case "tocItem":
      case "row":
        lc.rows.push(lc.currentRow);
        lc.currentRow = [];
        break;
      case "column":
        lc.currentRow.push(lc.cellText.trim());
        lc.inCell = false;
        lc.cellText = "";
        break;
      default:
        break;
    }
  }

  private finishLayout(): void {
    const lc = this.layoutCollector;
    if (!lc) return;

    this.layoutCollector = null;

    // Only emit a table if there are actual data rows
    if (lc.rows.length === 0 && lc.headers.length === 0) return;

    const node: TableNode = {
      type: "table",
      variant: "layout",
      headers: lc.headers,
      rows: lc.rows,
    };

    this.addToParent(node);
  }

  private bubbleTextToCollector(text: string): void {
    for (let i = this.stack.length - 2; i >= 0; i--) {
      const f = this.stack[i];
      if (f?.kind === "ignore" && (f.elementName === "heading" || f.elementName === "num")) {
        f.textBuffer += text;
        return;
      }
      // Stop bubbling if we hit a non-inline, non-ignore frame
      if (f && f.kind !== "inline" && f.kind !== "ignore") {
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Stack utilities
  // ---------------------------------------------------------------------------

  private peekFrame(): StackFrame | undefined {
    return this.stack[this.stack.length - 1];
  }

  private peekFrameAbove(belowFrame: StackFrame): StackFrame | undefined {
    const idx = this.stack.lastIndexOf(belowFrame);
    if (idx > 0) {
      return this.stack[idx - 1];
    }
    return undefined;
  }

  private popFrame(expectedKind: string): StackFrame | undefined {
    const frame = this.stack[this.stack.length - 1];
    if (frame?.kind === expectedKind) {
      this.stack.pop();
      return frame;
    }
    // Try to find and remove the frame (in case of nesting mismatches)
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const f = this.stack[i];
      if (f?.kind === expectedKind) {
        return this.stack.splice(i, 1)[0];
      }
    }
    return undefined;
  }

  private findParentFrame(kind: string): StackFrame | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const f = this.stack[i];
      if (f?.kind === kind) {
        return f;
      }
    }
    return undefined;
  }

  /**
   * Add a block-level AST node to the nearest parent that accepts children.
   */
  private addToParent(node: ASTNode): void {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (!frame) continue;
      if (frame.kind === "level") {
        (frame.node as LevelNode).children.push(node);
        return;
      }
      if (frame.kind === "note") {
        (frame.node as NoteNode).children.push(node);
        return;
      }
      if (frame.kind === "notesContainer") {
        (frame.node as NotesContainerNode).children.push(node);
        return;
      }
      if (frame.kind === "quotedContent") {
        (frame.node as QuotedContentNode).children.push(node);
        return;
      }
    }
  }

  /**
   * Add an inline AST node to the nearest parent that accepts inline children.
   */
  private addInlineToParent(node: InlineNode): void {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (!frame) continue;
      if (frame.kind === "inline") {
        const parent = frame.node as InlineNode;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
        return;
      }
      if (frame.kind === "content" || frame.kind === "sourceCredit") {
        const parent = frame.node;
        if (parent && "children" in parent && Array.isArray(parent.children)) {
          (parent.children as InlineNode[]).push(node);
        }
        return;
      }
    }
  }

  /**
   * Extract plain text from a node tree (for flattening quotedContent).
   */
  private extractText(node: QuotedContentNode): string {
    let result = "";
    for (const child of node.children) {
      if (child.type === "inline") {
        result += this.extractInlineText(child);
      } else if (child.type === "content") {
        for (const inline of child.children) {
          result += this.extractInlineText(inline);
        }
      }
    }
    return result;
  }

  private extractInlineText(node: InlineNode): string {
    if (node.text) return node.text;
    if (node.children) {
      return node.children.map((c) => this.extractInlineText(c)).join("");
    }
    return "";
  }
}

// Re-use LEVEL_TYPES for index lookups (cast to string[] for indexOf)
const LEVEL_TYPES_ARRAY: readonly string[] = LEVEL_TYPES;
