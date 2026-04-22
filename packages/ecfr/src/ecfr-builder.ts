/**
 * eCFR AST Builder — converts SAX events from GPO/SGML-derived XML into AST nodes.
 *
 * Follows the same stack-based, emit-at-level pattern as the USLM builder in core,
 * but dispatches on eCFR element names (DIV1-DIV9 with TYPE attributes, HEAD, P, etc.)
 * instead of USLM semantic element names.
 */

import type { Attributes } from "@lexbuild/core";
import { LEVEL_TYPES } from "@lexbuild/core";
import type {
  LevelType,
  LevelNode,
  ContentNode,
  InlineNode,
  InlineType,
  NoteNode,
  SourceCreditNode,
  TableNode,
  ASTNode,
  AncestorInfo,
  DocumentMeta,
  EmitContext,
} from "@lexbuild/core";
import {
  ECFR_DIV_ELEMENTS,
  ECFR_TYPE_TO_LEVEL,
  ECFR_CONTENT_ELEMENTS,
  ECFR_INLINE_ELEMENTS,
  ECFR_EMPHASIS_MAP,
  ECFR_NOTE_ELEMENTS,
  ECFR_HEADING_ELEMENTS,
  ECFR_BLOCK_ELEMENTS,
  ECFR_IGNORE_ELEMENTS,
  ECFR_PASSTHROUGH_ELEMENTS,
  ECFR_SKIP_ELEMENTS,
  ECFR_REF_ELEMENTS,
} from "./ecfr-elements.js";

/** Options for configuring the eCFR AST builder */
export interface EcfrASTBuilderOptions {
  /**
   * Emit completed nodes at these levels instead of accumulating. Accepts a
   * single `LevelType` or a `ReadonlySet<LevelType>`. When multiple levels are
   * specified, deeper levels fire first (e.g. `section` before its ancestor
   * `title`), and emitted nodes remain attached to their parents so a
   * higher-level emission sees the complete subtree.
   */
  emitAt: LevelType | ReadonlySet<LevelType>;
  /** Callback when a completed node is ready */
  onEmit: (node: LevelNode, context: EmitContext) => void | Promise<void>;
}

/** Frame kinds for the stack */
type FrameKind =
  | "level"
  | "content"
  | "inline"
  | "note"
  | "heading"
  | "ignore"
  | "table"
  | "tableRow"
  | "tableCell"
  | "noteContent"
  | "block";

/** A stack frame tracking an in-progress element */
interface StackFrame {
  kind: FrameKind;
  elementName: string;
  node?: ASTNode;
  textBuffer: string;
  /** For table collection */
  headers?: string[][];
  rows?: string[][];
  currentRow?: string[];
  isHeaderRow?: boolean;
}

/**
 * eCFR AST Builder. Consumes SAX events and produces LexBuild AST nodes.
 */
export class EcfrASTBuilder {
  private readonly options: EcfrASTBuilderOptions;
  private readonly stack: StackFrame[] = [];
  private documentMeta: DocumentMeta = {};
  /** Track title number from metadata header */
  private titleNumber = "";
  /** Depth inside CFRTOC or other ignored container */
  private ignoredContainerDepth = 0;
  /** Part-level notes (authority/source) keyed by part identifier */
  private readonly partNotes = new Map<
    string,
    { authority?: string | undefined; regulatorySource?: string | undefined }
  >();

  constructor(options: EcfrASTBuilderOptions) {
    this.options = options;
    // Validate emit configuration up front.
    resolveEmitIndexes(options.emitAt);
  }

  private shouldEmit(levelType: LevelType): boolean {
    const at = this.options.emitAt;
    return typeof at === "string" ? levelType === at : at.has(levelType);
  }

  /**
   * True iff some level frame currently on the stack is itself an emit
   * target. Used by `closeLevel` to decide whether the closing node must be
   * attached to its parent so a higher emission sees the full subtree.
   *
   * This is the correct check for USLM's permissive level nesting (e.g. an
   * `<appendix>` inside a `<part>`) — reasoning via `LEVEL_TYPES` index
   * ordering would drop the appendix because its index is shallower than
   * the containing part's. Live stack membership handles anomalous nesting
   * correctly.
   */
  private hasEmittingAncestorOnStack(): boolean {
    for (const f of this.stack) {
      if (f.kind === "level" && f.node?.type === "level") {
        if (this.shouldEmit((f.node as LevelNode).levelType)) return true;
      }
    }
    return false;
  }

  /** Get part-level notes (authority/source) captured during parsing */
  getPartNotes(): ReadonlyMap<string, { authority?: string | undefined; regulatorySource?: string | undefined }> {
    return this.partNotes;
  }

  /** Handle SAX open element */
  onOpenElement(name: string, attrs: Attributes): void {
    // Track ignored containers (skip entire subtree)
    if (this.ignoredContainerDepth > 0) {
      this.ignoredContainerDepth++;
      return;
    }

    // Full-subtree ignore elements (e.g., CFRTOC, HEADER)
    if (ECFR_IGNORE_ELEMENTS.has(name)) {
      this.ignoredContainerDepth = 1;
      return;
    }

    // Transparent pass-through elements — no frame needed
    if (ECFR_PASSTHROUGH_ELEMENTS.has(name)) {
      return;
    }

    // Self-contained skip elements — no subtree concerns
    if (ECFR_SKIP_ELEMENTS.has(name)) {
      this.ignoredContainerDepth = 1;
      return;
    }

    // DIV elements → level nodes
    if (ECFR_DIV_ELEMENTS.has(name)) {
      const divType = attrs["TYPE"];
      if (divType) {
        const levelType = ECFR_TYPE_TO_LEVEL[divType];
        if (levelType) {
          this.openLevel(levelType, name, attrs);
          return;
        }
      }
      // DIV without recognized TYPE — treat as structural wrapper, push ignore
      this.stack.push({ kind: "ignore", elementName: name, textBuffer: "" });
      return;
    }

    // HEAD element → collect heading text
    if (name === "HEAD") {
      this.stack.push({ kind: "heading", elementName: name, textBuffer: "" });
      return;
    }

    // HED element (label inside AUTH/SOURCE/etc.) → collect as heading
    if (name === "HED") {
      this.stack.push({ kind: "heading", elementName: name, textBuffer: "" });
      return;
    }

    // PSPACE element (content inside AUTH/SOURCE/etc.) → collect text
    if (name === "PSPACE") {
      this.stack.push({ kind: "noteContent", elementName: name, textBuffer: "" });
      return;
    }

    // Content elements (P, FP, etc.)
    if (ECFR_CONTENT_ELEMENTS.has(name)) {
      this.openContent(name);
      return;
    }

    // Sub-headings within sections (HD1, HD2, HD3)
    if (ECFR_HEADING_ELEMENTS.has(name)) {
      this.openContent(name);
      return;
    }

    // Inline elements
    if (ECFR_INLINE_ELEMENTS.has(name)) {
      this.openInline(name, attrs);
      return;
    }

    // Cross-reference elements
    if (ECFR_REF_ELEMENTS.has(name)) {
      this.openRef(name, attrs);
      return;
    }

    // Note elements (AUTH, SOURCE, CITA, etc.)
    if (ECFR_NOTE_ELEMENTS.has(name)) {
      this.openNote(name, attrs);
      return;
    }

    // Block elements (EXTRACT, EXAMPLE)
    if (ECFR_BLOCK_ELEMENTS.has(name)) {
      this.stack.push({ kind: "block", elementName: name, textBuffer: "" });
      return;
    }

    // Table elements
    if (name === "TABLE") {
      this.stack.push({
        kind: "table",
        elementName: name,
        textBuffer: "",
        headers: [],
        rows: [],
        currentRow: [],
        isHeaderRow: false,
      });
      return;
    }
    if (name === "TR") {
      const tableFrame = this.findTableFrame();
      if (tableFrame) {
        tableFrame.currentRow = [];
        tableFrame.isHeaderRow = false;
        this.stack.push({ kind: "tableRow", elementName: name, textBuffer: "" });
      }
      return;
    }
    if (name === "TH") {
      const tableFrame = this.findTableFrame();
      if (tableFrame) {
        tableFrame.isHeaderRow = true;
        this.stack.push({ kind: "tableCell", elementName: name, textBuffer: "" });
      }
      return;
    }
    if (name === "TD") {
      this.stack.push({ kind: "tableCell", elementName: name, textBuffer: "" });
      return;
    }

    // Lowercase "div" wrapper for tables — ignore the wrapper
    if (name === "DIV" || name === "div") {
      this.stack.push({ kind: "ignore", elementName: name, textBuffer: "" });
      return;
    }

    // img elements — skip
    if (name === "img") {
      return;
    }

    // Unknown elements — push as ignore to maintain stack balance
    this.stack.push({ kind: "ignore", elementName: name, textBuffer: "" });
  }

  /** Handle SAX close element */
  onCloseElement(name: string): void {
    // Track ignored containers
    if (this.ignoredContainerDepth > 0) {
      this.ignoredContainerDepth--;
      return;
    }

    // Pass-through elements — no frame to pop
    if (ECFR_PASSTHROUGH_ELEMENTS.has(name)) {
      return;
    }

    // HEAD → set heading on parent level node
    if (name === "HEAD") {
      const frame = this.popFrame(name);
      if (frame) {
        const parentLevel = this.findParentLevel();
        if (parentLevel?.node && parentLevel.node.type === "level") {
          const levelNode = parentLevel.node as LevelNode;
          const headText = frame.textBuffer.trim();
          // Strip section number prefix from heading (e.g., "§ 1.1   Definitions." → "Definitions.")
          if (levelNode.levelType === "section" && levelNode.numValue) {
            const prefix = `§ ${levelNode.numValue}`;
            let stripped = headText;
            if (stripped.startsWith(prefix)) {
              stripped = stripped
                .slice(prefix.length)
                .replace(/^[\s.]+/, "")
                .trim();
            }
            levelNode.heading = stripped || headText;
          } else {
            // Strip level type prefixes (CHAPTER I—, PART 1—, SUBCHAPTER A—, etc.)
            levelNode.heading = stripLevelPrefix(headText);
          }
        }
      }
      return;
    }

    // HED (label inside notes) — just drop the text
    if (name === "HED") {
      this.popFrame(name);
      return;
    }

    // PSPACE (content inside notes)
    if (name === "PSPACE") {
      const frame = this.popFrame(name);
      if (frame) {
        const parentNote = this.findParentNote();
        if (parentNote?.node && parentNote.node.type === "note") {
          const noteNode = parentNote.node as NoteNode;
          // Add the text as inline content
          const textNode: InlineNode = {
            type: "inline",
            inlineType: "text",
            text: frame.textBuffer.trim(),
          };
          const contentNode: ContentNode = {
            type: "content",
            variant: "content",
            children: [textNode],
          };
          noteNode.children.push(contentNode);
        }
      }
      return;
    }

    // DIV elements → close level
    if (ECFR_DIV_ELEMENTS.has(name)) {
      this.closeLevel(name);
      return;
    }

    // Content elements
    if (ECFR_CONTENT_ELEMENTS.has(name) || ECFR_HEADING_ELEMENTS.has(name)) {
      this.closeContent(name);
      return;
    }

    // Inline elements
    if (ECFR_INLINE_ELEMENTS.has(name)) {
      this.closeInline(name);
      return;
    }

    // Cross-reference elements
    if (ECFR_REF_ELEMENTS.has(name)) {
      this.closeInline(name);
      return;
    }

    // Note elements
    if (ECFR_NOTE_ELEMENTS.has(name)) {
      this.closeNote(name);
      return;
    }

    // Block elements
    if (ECFR_BLOCK_ELEMENTS.has(name)) {
      this.popFrame(name);
      return;
    }

    // Table elements
    if (name === "TABLE") {
      this.closeTable();
      return;
    }
    if (name === "TR") {
      this.closeTableRow();
      return;
    }
    if (name === "TH" || name === "TD") {
      this.closeTableCell();
      return;
    }

    // img — self-closing, no pop needed
    if (name === "img") {
      return;
    }

    // Pop any remaining frames (ignore, div, etc.)
    if (this.stack.length > 0 && this.stack[this.stack.length - 1]?.elementName === name) {
      this.stack.pop();
    }
  }

  /** Handle SAX text content */
  onText(text: string): void {
    if (this.ignoredContainerDepth > 0) return;

    const frame = this.stack[this.stack.length - 1];
    if (!frame) return;

    // Accumulate text in the current frame
    if (frame.kind === "heading" || frame.kind === "noteContent" || frame.kind === "tableCell") {
      frame.textBuffer += text;
      return;
    }

    // For content frames, create text inline node
    if (frame.kind === "content" && frame.node?.type === "content") {
      const contentNode = frame.node as ContentNode;
      const trimmed = text;
      if (trimmed) {
        contentNode.children.push({
          type: "inline",
          inlineType: "text",
          text: trimmed,
        });
      }
      return;
    }

    // For inline frames, set text
    if (frame.kind === "inline" && frame.node?.type === "inline") {
      const inlineNode = frame.node as InlineNode;
      if (inlineNode.children) {
        inlineNode.children.push({
          type: "inline",
          inlineType: "text",
          text,
        });
      } else {
        inlineNode.text = (inlineNode.text ?? "") + text;
      }
      return;
    }

    // For note frames with direct text content (CITA, APPRO, SECAUTH)
    if (frame.kind === "note" && frame.node?.type === "note") {
      frame.textBuffer += text;
      return;
    }

    // For level frames (text directly in a DIV, outside P elements — rare but possible)
    if (frame.kind === "level") {
      // Don't accumulate whitespace-only text at level
      return;
    }
  }

  // ---- Private helpers ----

  private openLevel(levelType: LevelType, elementName: string, attrs: Attributes): void {
    const nAttr = attrs["N"] ?? "";
    const nodeAttr = attrs["NODE"] ?? "";

    // Parse num and numValue from N attribute
    let numValue = nAttr.replace(/^§\s*/, "").trim();
    const num = nAttr.trim();

    // For title-level DIVs, the N attribute is the VOLUME number (not the title number).
    // Multi-volume titles (e.g., Title 17) have multiple DIV1 elements: N="1", N="2", etc.
    // The actual title number is the prefix of the NODE attribute (e.g., NODE="17:1" → 17).
    if (levelType === "title") {
      const titleFromNode = nodeAttr.split(":")[0];
      if (titleFromNode) {
        numValue = titleFromNode;
      }
    }

    // Build identifier from title number and section number
    let identifier: string | undefined;
    if (levelType === "title") {
      identifier = `/us/cfr/t${numValue}`;
      this.titleNumber = numValue;
    } else if (levelType === "section") {
      identifier = `/us/cfr/t${this.titleNumber}/s${numValue}`;
    } else if (levelType === "part") {
      identifier = `/us/cfr/t${this.titleNumber}/pt${numValue}`;
    } else if (levelType === "chapter") {
      identifier = `/us/cfr/t${this.titleNumber}/ch${numValue}`;
    }

    const node: LevelNode = {
      type: "level",
      levelType,
      num: num || undefined,
      numValue: numValue || undefined,
      identifier,
      children: [],
      sourceElement: elementName,
    };

    this.stack.push({ kind: "level", elementName, node, textBuffer: "" });
  }

  private closeLevel(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || frame.kind !== "level" || !frame.node) return;

    const levelNode = frame.node as LevelNode;

    // Capture part-level authority/source notes before the node is emitted or released
    if (levelNode.levelType === "part" && levelNode.identifier) {
      let authority: string | undefined;
      let regulatorySource: string | undefined;
      for (const child of levelNode.children) {
        if (child.type === "note") {
          const noteNode = child as NoteNode;
          if (noteNode.noteType === "authority" && !authority) {
            authority = this.extractNoteText(noteNode);
          }
          if (noteNode.noteType === "regulatorySource" && !regulatorySource) {
            regulatorySource = this.extractNoteText(noteNode);
          }
        }
      }
      if (authority || regulatorySource) {
        this.partNotes.set(levelNode.identifier, { authority, regulatorySource });
      }
    }

    // Emit at any level named in the configured emit set. Ancestors are
    // computed from the live stack (already popped by popFrame above), so an
    // emitted level never lists itself as its own ancestor.
    if (this.shouldEmit(levelNode.levelType)) {
      const ancestors: AncestorInfo[] = [];
      for (const f of this.stack) {
        if (f.kind === "level" && f.node?.type === "level") {
          const ln = f.node as LevelNode;
          ancestors.push({
            levelType: ln.levelType,
            numValue: ln.numValue,
            heading: ln.heading,
            identifier: ln.identifier,
          });
        }
      }

      const context: EmitContext = {
        ancestors,
        documentMeta: { ...this.documentMeta },
      };

      this.options.onEmit(levelNode, context);
    }

    // Attach to parent iff some enclosing frame is itself an emit target, so
    // descendants bubble up into that higher emission. When no emitting
    // ancestor remains on the stack, the node has nothing further to feed
    // into and is dropped, matching prior memory behavior for single-level
    // emit. This check uses live stack membership (not hierarchy indexes) so
    // it stays correct for USLM's permissive level nesting (e.g. an appendix
    // inside a part).
    if (this.hasEmittingAncestorOnStack()) {
      const parentLevel = this.findParentLevel();
      if (parentLevel?.node && parentLevel.node.type === "level") {
        (parentLevel.node as LevelNode).children.push(levelNode);
      }
    }
  }

  private openContent(elementName: string): void {
    // Determine variant based on element type
    const variant: "content" | "chapeau" | "continuation" | "proviso" = "content";

    // HD elements become bold content to act as sub-headings
    const isSubHeading = ECFR_HEADING_ELEMENTS.has(elementName);

    const node: ContentNode = {
      type: "content",
      variant,
      children: [],
    };

    // For sub-headings, wrap content in bold
    if (isSubHeading) {
      node.children.push({
        type: "inline",
        inlineType: "bold",
        children: [],
      });
    }

    this.stack.push({ kind: "content", elementName, node, textBuffer: "" });
  }

  private closeContent(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || !frame.node) return;

    const contentNode = frame.node as ContentNode;

    // For sub-headings, check if the bold wrapper has text
    if (ECFR_HEADING_ELEMENTS.has(elementName)) {
      const boldNode = contentNode.children[0];
      if (boldNode && boldNode.type === "inline" && boldNode.inlineType === "bold") {
        // If the bold node got text via inline child accumulation, good.
        // If text was added directly to content children (after bold), also good.
        // If neither, the bold node has no text — skip empty heading.
        if (
          !boldNode.text &&
          (!boldNode.children || boldNode.children.length === 0) &&
          contentNode.children.length <= 1
        ) {
          return;
        }
      }
    }

    // Add to parent level or note
    const parent = this.findParentLevel() ?? this.findParentNote();
    if (parent?.node) {
      if (parent.node.type === "level") {
        (parent.node as LevelNode).children.push(contentNode);
      } else if (parent.node.type === "note") {
        (parent.node as NoteNode).children.push(contentNode);
      }
    }
  }

  private openInline(elementName: string, attrs: Attributes): void {
    let inlineType: InlineType = "text";

    if (elementName === "I") {
      inlineType = "italic";
    } else if (elementName === "B") {
      inlineType = "bold";
    } else if (elementName === "SU") {
      inlineType = "sup";
    } else if (elementName === "FR") {
      inlineType = "text"; // Fractions render as text
    } else if (elementName === "E") {
      const tValue = attrs["T"] ?? "";
      inlineType = ECFR_EMPHASIS_MAP[tValue] ?? "italic";
    }

    const node: InlineNode = {
      type: "inline",
      inlineType,
      children: [],
    };

    this.stack.push({ kind: "inline", elementName, node, textBuffer: "" });
  }

  private openRef(elementName: string, attrs: Attributes): void {
    if (elementName === "FTREF") {
      // Footnote reference — will get text like "1"
      const node: InlineNode = {
        type: "inline",
        inlineType: "footnoteRef",
        idref: attrs["ID"],
      };
      this.stack.push({ kind: "inline", elementName, node, textBuffer: "" });
    } else {
      // XREF — cross-reference
      const node: InlineNode = {
        type: "inline",
        inlineType: "ref",
        href: attrs["ID"],
        children: [],
      };
      this.stack.push({ kind: "inline", elementName, node, textBuffer: "" });
    }
  }

  private closeInline(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || !frame.node) return;

    const inlineNode = frame.node as InlineNode;

    // For footnoteRef, set text from buffer if no children
    if (inlineNode.inlineType === "footnoteRef" && frame.textBuffer) {
      inlineNode.text = frame.textBuffer.trim();
    }

    // Find parent content or inline to attach to
    const parentFrame = this.stack[this.stack.length - 1];
    if (!parentFrame) return;

    if (parentFrame.kind === "content" && parentFrame.node?.type === "content") {
      const parentContent = parentFrame.node as ContentNode;
      // If parent is a sub-heading with a bold wrapper, add to the bold node
      if (
        ECFR_HEADING_ELEMENTS.has(parentFrame.elementName) &&
        parentContent.children.length > 0 &&
        parentContent.children[0]?.type === "inline" &&
        (parentContent.children[0] as InlineNode).inlineType === "bold"
      ) {
        const boldNode = parentContent.children[0] as InlineNode;
        if (boldNode.children) {
          boldNode.children.push(inlineNode);
        }
      } else {
        parentContent.children.push(inlineNode);
      }
    } else if (parentFrame.kind === "inline" && parentFrame.node?.type === "inline") {
      const parentInline = parentFrame.node as InlineNode;
      if (parentInline.children) {
        parentInline.children.push(inlineNode);
      }
    } else if (parentFrame.kind === "note") {
      // Text directly in a note element
      frame.textBuffer = "";
    }
  }

  private openNote(elementName: string, _attrs: Attributes): void {
    // Map element name to a noteType
    const noteTypeMap: Record<string, string> = {
      AUTH: "authority",
      SOURCE: "regulatorySource",
      EDNOTE: "editorial",
      EFFDNOT: "effectiveDate",
      CITA: "citation",
      APPRO: "approval",
      NOTE: "general",
      CROSSREF: "crossReference",
      SECAUTH: "sectionAuthority",
      FTNT: "footnote",
    };

    const noteType = noteTypeMap[elementName] ?? elementName.toLowerCase();

    // For SOURCE, also create a SourceCreditNode
    const node: NoteNode = {
      type: "note",
      noteType,
      children: [],
    };

    this.stack.push({ kind: "note", elementName, node, textBuffer: "" });
  }

  private closeNote(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || !frame.node) return;

    const noteNode = frame.node as NoteNode;

    // For CITA, APPRO, SECAUTH — text was collected in textBuffer
    if (frame.textBuffer.trim() && noteNode.children.length === 0) {
      const textNode: InlineNode = {
        type: "inline",
        inlineType: "text",
        text: frame.textBuffer.trim(),
      };
      const contentNode: ContentNode = {
        type: "content",
        variant: "content",
        children: [textNode],
      };
      noteNode.children.push(contentNode);
    }

    // Add to parent level
    const parentLevel = this.findParentLevel();
    if (parentLevel?.node && parentLevel.node.type === "level") {
      const levelNode = parentLevel.node as LevelNode;

      // SOURCE notes also create a SourceCreditNode for compatibility
      if (noteNode.noteType === "regulatorySource") {
        const sourceText = this.extractNoteText(noteNode);
        if (sourceText) {
          const sourceCreditNode: SourceCreditNode = {
            type: "sourceCredit",
            children: [{ type: "inline", inlineType: "text", text: sourceText }],
          };
          levelNode.children.push(sourceCreditNode);
        }
      }

      levelNode.children.push(noteNode);
    }
  }

  private closeTable(): void {
    const frame = this.popFrame("TABLE");
    if (!frame || frame.kind !== "table") return;

    const tableNode: TableNode = {
      type: "table",
      variant: "xhtml",
      headers: frame.headers ?? [],
      rows: frame.rows ?? [],
    };

    // Add to parent level
    const parentLevel = this.findParentLevel();
    if (parentLevel?.node && parentLevel.node.type === "level") {
      (parentLevel.node as LevelNode).children.push(tableNode);
    }
  }

  private closeTableRow(): void {
    const rowFrame = this.popFrame("TR");
    if (!rowFrame) return;

    const tableFrame = this.findTableFrame();
    if (tableFrame && tableFrame.currentRow) {
      if (tableFrame.isHeaderRow) {
        tableFrame.headers?.push([...tableFrame.currentRow]);
      } else {
        tableFrame.rows?.push([...tableFrame.currentRow]);
      }
      tableFrame.currentRow = [];
    }
  }

  private closeTableCell(): void {
    const cellFrame = this.stack.pop();
    if (!cellFrame || cellFrame.kind !== "tableCell") return;

    const tableFrame = this.findTableFrame();
    if (tableFrame?.currentRow) {
      tableFrame.currentRow.push(cellFrame.textBuffer.trim());
    }
  }

  private popFrame(elementName: string): StackFrame | undefined {
    if (this.stack.length === 0) return undefined;

    // Find the matching frame (may not be exactly on top due to self-closing elements)
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i]?.elementName === elementName) {
        return this.stack.splice(i, 1)[0];
      }
    }

    // If no exact match, pop top frame
    return this.stack.pop();
  }

  private findParentLevel(): StackFrame | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i]?.kind === "level") {
        return this.stack[i];
      }
    }
    return undefined;
  }

  private findParentNote(): StackFrame | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i]?.kind === "note") {
        return this.stack[i];
      }
    }
    return undefined;
  }

  private findTableFrame(): StackFrame | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i]?.kind === "table") {
        return this.stack[i];
      }
    }
    return undefined;
  }

  private extractNoteText(noteNode: NoteNode): string {
    const parts: string[] = [];
    for (const child of noteNode.children) {
      if (child.type === "content") {
        for (const inline of (child as ContentNode).children) {
          if (inline.text) parts.push(inline.text);
        }
      }
    }
    return parts.join("").trim();
  }
}

const LEVEL_TYPES_ARRAY: readonly string[] = LEVEL_TYPES;

function resolveEmitIndexes(emitAt: LevelType | ReadonlySet<LevelType>): number[] {
  const levels = typeof emitAt === "string" ? [emitAt] : [...emitAt];
  if (levels.length === 0) {
    throw new Error("EcfrASTBuilder: emitAt must contain at least one LevelType");
  }
  return levels.map((lt) => {
    const idx = LEVEL_TYPES_ARRAY.indexOf(lt);
    if (idx < 0) throw new Error(`EcfrASTBuilder: unknown LevelType "${lt}" in emitAt`);
    return idx;
  });
}

/**
 * Strip common level-type prefixes from headings.
 * E.g., "CHAPTER I—ADMINISTRATIVE COMMITTEE" → "ADMINISTRATIVE COMMITTEE"
 * E.g., "PART 1—DEFINITIONS" → "DEFINITIONS"
 * E.g., "SUBCHAPTER A—GENERAL" → "GENERAL"
 */
function stripLevelPrefix(heading: string): string {
  // Match: CHAPTER I—text, PART 1—text, SUBCHAPTER A—text, SUBTITLE A—text
  const match = /^(?:CHAPTER|PART|SUBCHAPTER|SUBPART|SUBTITLE|DIVISION|ARTICLE)\s+[A-Za-z0-9]+\s*[—–-]\s*/i.exec(
    heading,
  );
  if (match) {
    const stripped = heading.slice(match[0].length).trim();
    return stripped || heading.trim();
  }

  // Handle "Title N—text" format
  const titleMatch = /^Title\s+\d+\s*[—–-]\s*/i.exec(heading);
  if (titleMatch) {
    let stripped = heading.slice(titleMatch[0].length).trim();
    // Strip volume suffix like "--Volume 1"
    const volIdx = stripped.search(/--Volume\s/i);
    if (volIdx !== -1) {
      stripped = stripped.slice(0, volIdx).trim();
    }
    return stripped || heading.trim();
  }

  return heading.trim();
}
