/**
 * Federal Register AST Builder — converts SAX events from FR XML into AST nodes.
 *
 * Follows the stack-based pattern from the eCFR builder but adapted for FR's
 * flat, document-centric structure. Each FR document (RULE, NOTICE, PRORULE,
 * PRESDOCU) becomes a single section-level LevelNode emitted via onEmit.
 *
 * FR XML is GPO/SGML-derived with no namespace. It shares inline formatting
 * (E T="nn", SU, FTNT) with eCFR but uses a different document structure:
 * preamble (PREAMB) → supplementary info (SUPLINF) → signature (SIG).
 */

import type { Attributes } from "@lexbuild/core";
import type {
  LevelNode,
  ContentNode,
  InlineNode,
  InlineType,
  NoteNode,
  TableNode,
  ASTNode,
  AncestorInfo,
  EmitContext,
} from "@lexbuild/core";
import {
  FR_DOCUMENT_ELEMENTS,
  FR_SECTION_CONTAINERS,
  FR_DOCUMENT_TYPE_MAP,
  FR_PREAMBLE_SECTIONS,
  FR_PREAMBLE_META_ELEMENTS,
  FR_CONTENT_ELEMENTS,
  FR_HEADING_ELEMENT,
  FR_HD_SOURCE_TO_DEPTH,
  FR_INLINE_ELEMENTS,
  FR_EMPHASIS_MAP,
  FR_REGTEXT_ELEMENTS,
  FR_LSTSUB_ELEMENT,
  FR_SIGNATURE_ELEMENTS,
  FR_PRESIDENTIAL_SUBTYPES,
  FR_PRESIDENTIAL_META_ELEMENTS,
  FR_NOTE_ELEMENTS,
  FR_FTREF_ELEMENT,
  FR_BLOCK_ELEMENTS,
  FR_TABLE_ELEMENTS,
  FR_IGNORE_ELEMENTS,
  FR_SKIP_ELEMENTS,
  FR_PASSTHROUGH_ELEMENTS,
  FR_FRDOC_ELEMENT,
  FR_BILCOD_ELEMENT,
} from "./fr-elements.js";

/** Options for configuring the FR AST builder */
export interface FrASTBuilderOptions {
  /** Callback when a completed document node is ready */
  onEmit: (node: LevelNode, context: EmitContext) => void | Promise<void>;
}

/** Metadata extracted from the FR document XML during parsing */
export interface FrDocumentXmlMeta {
  /** Document type element name (RULE, NOTICE, etc.) */
  documentType: string;
  /** Normalized document type (rule, proposed_rule, etc.) */
  documentTypeNormalized: string;
  /** Agency name from AGENCY element */
  agency?: string | undefined;
  /** Sub-agency name from SUBAGY element */
  subAgency?: string | undefined;
  /** Subject/title from SUBJECT element */
  subject?: string | undefined;
  /** CFR citation from CFR element */
  cfrCitation?: string | undefined;
  /** Regulation Identifier Number from RIN element */
  rin?: string | undefined;
  /** FR document number extracted from FRDOC text */
  documentNumber?: string | undefined;
}

/** Frame kinds for the stack */
type FrameKind =
  | "document"
  | "content"
  | "inline"
  | "heading"
  | "preambleSection"
  | "preambleMeta"
  | "note"
  | "signature"
  | "signatureField"
  | "table"
  | "tableHeader"
  | "tableRow"
  | "tableCell"
  | "block"
  | "regtext"
  | "frdoc"
  | "ignore";

/** A stack frame tracking an in-progress element */
interface StackFrame {
  kind: FrameKind;
  elementName: string;
  node?: ASTNode;
  textBuffer: string;
  /** For GPOTABLE collection */
  headers?: string[][];
  rows?: string[][];
  currentRow?: string[];
  headerLevel?: number;
}

/**
 * Federal Register AST Builder.
 *
 * Consumes SAX events and produces LexBuild AST nodes. Each FR document
 * (RULE, NOTICE, PRORULE, PRESDOCU) is emitted as a single section-level
 * LevelNode via the onEmit callback.
 */
export class FrASTBuilder {
  private readonly options: FrASTBuilderOptions;
  private readonly stack: StackFrame[] = [];
  /** Depth inside fully-ignored elements (CNTNTS, GPH) */
  private ignoredContainerDepth = 0;
  /** Metadata extracted from current document */
  private currentDocMeta: FrDocumentXmlMeta = {
    documentType: "",
    documentTypeNormalized: "",
  };
  /** All document metadata collected during parsing */
  private readonly documentMetas: FrDocumentXmlMeta[] = [];

  constructor(options: FrASTBuilderOptions) {
    this.options = options;
  }

  /** Get metadata for all documents parsed so far */
  getDocumentMetas(): readonly FrDocumentXmlMeta[] {
    return this.documentMetas;
  }

  /** Handle SAX open element */
  onOpenElement(name: string, attrs: Attributes): void {
    // Track ignored containers (skip entire subtree)
    if (this.ignoredContainerDepth > 0) {
      this.ignoredContainerDepth++;
      return;
    }

    // Full-subtree ignore elements (CNTNTS, GPH, GID)
    if (FR_IGNORE_ELEMENTS.has(name)) {
      this.ignoredContainerDepth = 1;
      return;
    }

    // Self-contained skip elements
    if (FR_SKIP_ELEMENTS.has(name)) {
      this.ignoredContainerDepth = 1;
      return;
    }

    // Transparent pass-through wrappers (FEDREG, PREAMB, SUPLINF)
    if (FR_PASSTHROUGH_ELEMENTS.has(name)) {
      return;
    }

    // Section containers (RULES, PRORULES, NOTICES, PRESDOCS) — pass through
    if (FR_SECTION_CONTAINERS.has(name)) {
      return;
    }

    // Document elements (RULE, NOTICE, PRORULE, PRESDOCU) → open document-level node
    if (FR_DOCUMENT_ELEMENTS.has(name)) {
      this.openDocument(name);
      return;
    }

    // Presidential document subtypes (EXECORD, PRMEMO, etc.) — pass through
    if (FR_PRESIDENTIAL_SUBTYPES.has(name)) {
      return;
    }

    // Presidential metadata (PSIG, PLACE, TITLE3, PRES)
    if (FR_PRESIDENTIAL_META_ELEMENTS.has(name)) {
      // PSIG and PLACE contain text we want to capture as content
      if (name === "PSIG" || name === "PLACE") {
        this.openContent(name);
        return;
      }
      // TITLE3, PRES — skip
      this.stack.push({ kind: "ignore", elementName: name, textBuffer: "" });
      return;
    }

    // Preamble metadata elements (AGENCY, SUBAGY, CFR, SUBJECT, RIN, DEPDOC)
    if (FR_PREAMBLE_META_ELEMENTS.has(name)) {
      this.stack.push({ kind: "preambleMeta", elementName: name, textBuffer: "" });
      return;
    }

    // Preamble sections (AGY, ACT, SUM, DATES, EFFDATE, ADD, FURINF)
    if (FR_PREAMBLE_SECTIONS.has(name)) {
      this.stack.push({ kind: "preambleSection", elementName: name, textBuffer: "" });
      return;
    }

    // Heading element (HD) — level from SOURCE attribute
    if (name === FR_HEADING_ELEMENT) {
      this.openHeading(name, attrs);
      return;
    }

    // Content elements (P, FP)
    if (FR_CONTENT_ELEMENTS.has(name)) {
      this.openContent(name);
      return;
    }

    // Inline elements (I, B, E, SU, FR, AC)
    if (FR_INLINE_ELEMENTS.has(name)) {
      this.openInline(name, attrs);
      return;
    }

    // Footnote reference
    if (name === FR_FTREF_ELEMENT) {
      const node: InlineNode = {
        type: "inline",
        inlineType: "footnoteRef",
        idref: attrs["ID"],
      };
      this.stack.push({ kind: "inline", elementName: name, node, textBuffer: "" });
      return;
    }

    // Note elements (FTNT, EDNOTE, OLNOTE1)
    if (FR_NOTE_ELEMENTS.has(name)) {
      this.openNote(name);
      return;
    }

    // REGTEXT and related elements
    if (FR_REGTEXT_ELEMENTS.has(name)) {
      this.openRegtext(name, attrs);
      return;
    }

    // LSTSUB — List of subjects
    if (name === FR_LSTSUB_ELEMENT) {
      this.stack.push({ kind: "block", elementName: name, textBuffer: "" });
      return;
    }

    // Signature block
    if (FR_SIGNATURE_ELEMENTS.has(name)) {
      this.openSignature(name);
      return;
    }

    // Block elements (EXTRACT, EXAMPLE)
    if (FR_BLOCK_ELEMENTS.has(name)) {
      this.stack.push({ kind: "block", elementName: name, textBuffer: "" });
      return;
    }

    // GPOTABLE elements
    if (FR_TABLE_ELEMENTS.has(name)) {
      this.openTableElement(name, attrs);
      return;
    }

    // FRDOC — extract document number
    if (name === FR_FRDOC_ELEMENT) {
      this.stack.push({ kind: "frdoc", elementName: name, textBuffer: "" });
      return;
    }

    // BILCOD — skip
    if (name === FR_BILCOD_ELEMENT) {
      this.ignoredContainerDepth = 1;
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
    if (FR_PASSTHROUGH_ELEMENTS.has(name) || FR_SECTION_CONTAINERS.has(name)) {
      return;
    }

    // Presidential subtypes — pass through
    if (FR_PRESIDENTIAL_SUBTYPES.has(name)) {
      return;
    }

    // Document elements → emit
    if (FR_DOCUMENT_ELEMENTS.has(name)) {
      this.closeDocument(name);
      return;
    }

    // Preamble metadata → extract text
    if (FR_PREAMBLE_META_ELEMENTS.has(name)) {
      this.closePreambleMeta(name);
      return;
    }

    // Preamble sections → just pop the frame
    if (FR_PREAMBLE_SECTIONS.has(name)) {
      this.popFrame(name);
      return;
    }

    // Heading
    if (name === FR_HEADING_ELEMENT) {
      this.closeHeading(name);
      return;
    }

    // Content elements
    if (FR_CONTENT_ELEMENTS.has(name)) {
      this.closeContent(name);
      return;
    }

    // Presidential metadata content (PSIG, PLACE)
    if (name === "PSIG" || name === "PLACE") {
      this.closeContent(name);
      return;
    }

    // Inline elements
    if (FR_INLINE_ELEMENTS.has(name) || name === FR_FTREF_ELEMENT) {
      this.closeInline(name);
      return;
    }

    // Note elements
    if (FR_NOTE_ELEMENTS.has(name)) {
      this.closeNote(name);
      return;
    }

    // REGTEXT elements
    if (FR_REGTEXT_ELEMENTS.has(name)) {
      this.closeRegtext(name);
      return;
    }

    // LSTSUB
    if (name === FR_LSTSUB_ELEMENT) {
      this.popFrame(name);
      return;
    }

    // Signature block
    if (FR_SIGNATURE_ELEMENTS.has(name)) {
      this.closeSignature(name);
      return;
    }

    // Block elements
    if (FR_BLOCK_ELEMENTS.has(name)) {
      this.popFrame(name);
      return;
    }

    // GPOTABLE elements
    if (FR_TABLE_ELEMENTS.has(name)) {
      this.closeTableElement(name);
      return;
    }

    // FRDOC → extract document number
    if (name === FR_FRDOC_ELEMENT) {
      this.closeFrdoc();
      return;
    }

    // Pop any remaining frames (ignore, etc.)
    if (this.stack.length > 0 && this.stack[this.stack.length - 1]?.elementName === name) {
      this.stack.pop();
    }
  }

  /** Handle SAX text content */
  onText(text: string): void {
    if (this.ignoredContainerDepth > 0) return;

    const frame = this.stack[this.stack.length - 1];
    if (!frame) return;

    // Accumulate text in text-collecting frames
    if (
      frame.kind === "heading" ||
      frame.kind === "preambleMeta" ||
      frame.kind === "signatureField" ||
      frame.kind === "tableCell" ||
      frame.kind === "tableHeader" ||
      frame.kind === "frdoc"
    ) {
      frame.textBuffer += text;
      return;
    }

    // Content frames → create inline text node
    if (frame.kind === "content" && frame.node?.type === "content") {
      const contentNode = frame.node as ContentNode;
      if (text) {
        contentNode.children.push({
          type: "inline",
          inlineType: "text",
          text,
        });
      }
      return;
    }

    // Inline frames → set text or add child
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

    // Note frames with direct text
    if (frame.kind === "note" && frame.node?.type === "note") {
      frame.textBuffer += text;
      return;
    }

    // Document-level, preambleSection, block, regtext — ignore stray text
  }

  // ── Private helpers: Document ──

  private openDocument(elementName: string): void {
    this.currentDocMeta = {
      documentType: elementName,
      documentTypeNormalized: FR_DOCUMENT_TYPE_MAP[elementName] ?? elementName.toLowerCase(),
    };

    const node: LevelNode = {
      type: "level",
      levelType: "section",
      children: [],
      sourceElement: elementName,
    };

    this.stack.push({ kind: "document", elementName, node, textBuffer: "" });
  }

  private closeDocument(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || frame.kind !== "document" || !frame.node) return;

    const levelNode = frame.node as LevelNode;

    // Set heading from subject
    if (this.currentDocMeta.subject) {
      levelNode.heading = this.currentDocMeta.subject;
    }

    // Set identifier from document number
    if (this.currentDocMeta.documentNumber) {
      levelNode.identifier = `/us/fr/${this.currentDocMeta.documentNumber}`;
      levelNode.numValue = this.currentDocMeta.documentNumber;
    }

    // Build emit context
    const ancestors: AncestorInfo[] = [];
    for (const f of this.stack) {
      if (f.kind === "document" && f.node?.type === "level") {
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
      documentMeta: {
        dcTitle: this.currentDocMeta.subject,
        dcType: this.currentDocMeta.documentTypeNormalized,
      },
    };

    // Save metadata before emitting
    this.documentMetas.push({ ...this.currentDocMeta });

    this.options.onEmit(levelNode, context);
  }

  // ── Private helpers: Preamble ──

  private closePreambleMeta(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || frame.kind !== "preambleMeta") return;

    const text = frame.textBuffer.trim();
    if (!text) return;

    switch (elementName) {
      case "AGENCY":
        this.currentDocMeta.agency = text;
        break;
      case "SUBAGY":
        this.currentDocMeta.subAgency = text;
        break;
      case "CFR":
        this.currentDocMeta.cfrCitation = text;
        break;
      case "SUBJECT":
        this.currentDocMeta.subject = text;
        break;
      case "RIN":
        this.currentDocMeta.rin = text.replace(/^RIN\s+/i, "").trim();
        break;
      case "DEPDOC":
        // Department document number — store for potential use
        break;
    }
  }

  // ── Private helpers: Heading ──

  private openHeading(_elementName: string, attrs: Attributes): void {
    const source = attrs["SOURCE"] ?? "HD1";
    const depth = FR_HD_SOURCE_TO_DEPTH[source] ?? 3;

    this.stack.push({
      kind: "heading",
      elementName: FR_HEADING_ELEMENT,
      textBuffer: "",
      headerLevel: depth,
    });
  }

  private closeHeading(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || frame.kind !== "heading") return;

    const headingText = frame.textBuffer.trim();
    if (!headingText) return;

    // In preamble sections (AGY, ACT, SUM, etc.), the HD contains the label
    // like "AGENCY:", "ACTION:", "SUMMARY:". We render these as bold labels.
    const parentFrame = this.stack[this.stack.length - 1];

    if (parentFrame?.kind === "preambleSection") {
      // Create a bold label content node
      const contentNode: ContentNode = {
        type: "content",
        variant: "content",
        children: [
          {
            type: "inline",
            inlineType: "bold",
            text: headingText,
          },
        ],
      };
      this.addToDocument(contentNode);
      return;
    }

    // Outside preamble: render as a bold heading content node
    // The depth from SOURCE attribute determines visual weight
    const contentNode: ContentNode = {
      type: "content",
      variant: "content",
      children: [
        {
          type: "inline",
          inlineType: "bold",
          text: headingText,
        },
      ],
    };
    this.addToDocument(contentNode);
  }

  // ── Private helpers: Content ──

  private openContent(elementName: string): void {
    const node: ContentNode = {
      type: "content",
      variant: "content",
      children: [],
    };
    this.stack.push({ kind: "content", elementName, node, textBuffer: "" });
  }

  private closeContent(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || !frame.node) return;

    const contentNode = frame.node as ContentNode;

    // Skip empty content nodes
    if (contentNode.children.length === 0) return;

    // Add to parent: document, note, or block
    const parent = this.findParentDocument() ?? this.findParentNote();
    if (parent?.node) {
      if (parent.node.type === "level") {
        (parent.node as LevelNode).children.push(contentNode);
      } else if (parent.node.type === "note") {
        (parent.node as NoteNode).children.push(contentNode);
      }
    }
  }

  // ── Private helpers: Inline ──

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
      inlineType = FR_EMPHASIS_MAP[tValue] ?? "italic";
    }

    const node: InlineNode = {
      type: "inline",
      inlineType,
      children: [],
    };

    this.stack.push({ kind: "inline", elementName, node, textBuffer: "" });
  }

  private closeInline(elementName: string): void {
    const frame = this.popFrame(elementName);
    if (!frame || !frame.node) return;

    const inlineNode = frame.node as InlineNode;

    // For footnoteRef, set text from buffer
    if (inlineNode.inlineType === "footnoteRef" && frame.textBuffer) {
      inlineNode.text = frame.textBuffer.trim();
    }

    // Find parent to attach to
    const parentFrame = this.stack[this.stack.length - 1];
    if (!parentFrame) return;

    if (parentFrame.kind === "content" && parentFrame.node?.type === "content") {
      (parentFrame.node as ContentNode).children.push(inlineNode);
    } else if (parentFrame.kind === "inline" && parentFrame.node?.type === "inline") {
      const parentInline = parentFrame.node as InlineNode;
      if (parentInline.children) {
        parentInline.children.push(inlineNode);
      }
    } else if (parentFrame.kind === "heading" || parentFrame.kind === "preambleMeta") {
      // Inline inside heading or preamble metadata — accumulate text
      if (inlineNode.text) {
        parentFrame.textBuffer += inlineNode.text;
      } else if (inlineNode.children) {
        for (const child of inlineNode.children) {
          if (child.text) parentFrame.textBuffer += child.text;
        }
      }
    }
  }

  // ── Private helpers: Notes ──

  private openNote(elementName: string): void {
    const noteTypeMap: Record<string, string> = {
      FTNT: "footnote",
      EDNOTE: "editorial",
      OLNOTE1: "general",
    };

    const noteType = noteTypeMap[elementName] ?? elementName.toLowerCase();
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

    // If text was collected directly (no child content nodes), create one
    if (frame.textBuffer.trim() && noteNode.children.length === 0) {
      const contentNode: ContentNode = {
        type: "content",
        variant: "content",
        children: [
          {
            type: "inline",
            inlineType: "text",
            text: frame.textBuffer.trim(),
          },
        ],
      };
      noteNode.children.push(contentNode);
    }

    // Add to parent document
    const parentDoc = this.findParentDocument();
    if (parentDoc?.node && parentDoc.node.type === "level") {
      (parentDoc.node as LevelNode).children.push(noteNode);
    }
  }

  // ── Private helpers: Regulatory text ──

  private openRegtext(elementName: string, attrs: Attributes): void {
    if (elementName === "REGTEXT") {
      // REGTEXT container with TITLE and PART attributes
      const title = attrs["TITLE"] ?? "";
      const part = attrs["PART"] ?? "";
      const label = title && part ? `${title} CFR Part ${part}` : "";

      // Create a bold label if we have CFR reference info
      if (label) {
        const labelNode: ContentNode = {
          type: "content",
          variant: "content",
          children: [
            {
              type: "inline",
              inlineType: "bold",
              text: label,
            },
          ],
        };
        this.addToDocument(labelNode);
      }

      this.stack.push({ kind: "regtext", elementName, textBuffer: "" });
      return;
    }

    if (elementName === "AMDPAR") {
      // Amendment instruction paragraph — render as italic content
      this.openContent(elementName);
      return;
    }

    if (elementName === "SECTION") {
      // Section container within REGTEXT — pass through
      this.stack.push({ kind: "block", elementName, textBuffer: "" });
      return;
    }

    if (elementName === "SECTNO") {
      // Section number — collect as content
      this.openContent(elementName);
      return;
    }

    if (elementName === "PART") {
      // Part container within REGTEXT — pass through
      this.stack.push({ kind: "block", elementName, textBuffer: "" });
      return;
    }

    if (elementName === "AUTH") {
      // Authority citation in REGTEXT
      this.openNote(elementName);
      return;
    }
  }

  private closeRegtext(elementName: string): void {
    if (elementName === "REGTEXT") {
      this.popFrame(elementName);
      return;
    }

    if (elementName === "AMDPAR" || elementName === "SECTNO") {
      this.closeContent(elementName);
      return;
    }

    if (elementName === "SECTION" || elementName === "PART") {
      this.popFrame(elementName);
      return;
    }

    if (elementName === "AUTH") {
      this.closeNote(elementName);
      return;
    }
  }

  // ── Private helpers: Signature block ──

  private openSignature(elementName: string): void {
    if (elementName === "SIG") {
      // Signature container
      const node: NoteNode = {
        type: "note",
        noteType: "signature",
        children: [],
      };
      this.stack.push({ kind: "signature", elementName, node, textBuffer: "" });
      return;
    }

    // NAME, TITLE, DATED — collect text
    this.stack.push({ kind: "signatureField", elementName, textBuffer: "" });
  }

  private closeSignature(elementName: string): void {
    if (elementName === "SIG") {
      const frame = this.popFrame(elementName);
      if (!frame || !frame.node) return;

      const sigNode = frame.node as NoteNode;

      // Add signature to parent document
      const parentDoc = this.findParentDocument();
      if (parentDoc?.node && parentDoc.node.type === "level") {
        (parentDoc.node as LevelNode).children.push(sigNode);
      }
      return;
    }

    // NAME, TITLE, DATED fields
    const frame = this.popFrame(elementName);
    if (!frame || frame.kind !== "signatureField") return;

    const text = frame.textBuffer.trim();
    if (!text) return;

    // Add as content to parent signature node
    const sigFrame = this.findFrame("signature");
    if (sigFrame?.node && sigFrame.node.type === "note") {
      const contentNode: ContentNode = {
        type: "content",
        variant: "content",
        children: [
          {
            type: "inline",
            inlineType: "text",
            text,
          },
        ],
      };
      (sigFrame.node as NoteNode).children.push(contentNode);
    }
  }

  // ── Private helpers: GPOTABLE ──

  private openTableElement(elementName: string, _attrs: Attributes): void {
    if (elementName === "GPOTABLE") {
      this.stack.push({
        kind: "table",
        elementName,
        textBuffer: "",
        headers: [],
        rows: [],
        currentRow: [],
      });
      return;
    }

    if (elementName === "TTITLE") {
      // Table title — collect text as heading
      this.stack.push({ kind: "heading", elementName, textBuffer: "" });
      return;
    }

    if (elementName === "BOXHD") {
      // Header container — no frame needed, children (CHED) handle themselves
      return;
    }

    if (elementName === "CHED") {
      // Column header entry
      this.stack.push({ kind: "tableHeader", elementName, textBuffer: "" });
      return;
    }

    if (elementName === "ROW") {
      const tableFrame = this.findTableFrame();
      if (tableFrame) {
        tableFrame.currentRow = [];
      }
      this.stack.push({ kind: "tableRow", elementName, textBuffer: "" });
      return;
    }

    if (elementName === "ENT") {
      // Cell entry
      this.stack.push({ kind: "tableCell", elementName, textBuffer: "" });
      return;
    }
  }

  private closeTableElement(elementName: string): void {
    if (elementName === "GPOTABLE") {
      this.closeGpoTable();
      return;
    }

    if (elementName === "TTITLE") {
      // Table title — drop the heading frame (title is informational)
      this.popFrame(elementName);
      return;
    }

    if (elementName === "BOXHD") {
      // No frame to pop
      return;
    }

    if (elementName === "CHED") {
      this.closeTableHeader();
      return;
    }

    if (elementName === "ROW") {
      this.closeTableRow();
      return;
    }

    if (elementName === "ENT") {
      this.closeTableCell();
      return;
    }
  }

  private closeGpoTable(): void {
    const frame = this.popFrame("GPOTABLE");
    if (!frame || frame.kind !== "table") return;

    const tableNode: TableNode = {
      type: "table",
      variant: "xhtml", // Reuse the same variant for rendering
      headers: frame.headers ?? [],
      rows: frame.rows ?? [],
    };

    // Add to parent document
    const parentDoc = this.findParentDocument();
    if (parentDoc?.node && parentDoc.node.type === "level") {
      (parentDoc.node as LevelNode).children.push(tableNode);
    }
  }

  private closeTableHeader(): void {
    const headerFrame = this.popFrame("CHED");
    if (!headerFrame || headerFrame.kind !== "tableHeader") return;

    const tableFrame = this.findTableFrame();
    if (!tableFrame) return;

    const text = headerFrame.textBuffer.trim();

    // GPOTABLE headers are flat — each CHED is one column header.
    // We build a single header row from all CHED elements.
    if (!tableFrame.headers || tableFrame.headers.length === 0) {
      tableFrame.headers = [[]];
    }
    const headerRow = tableFrame.headers[0];
    if (headerRow) {
      headerRow.push(text);
    }
  }

  private closeTableRow(): void {
    const rowFrame = this.popFrame("ROW");
    if (!rowFrame) return;

    const tableFrame = this.findTableFrame();
    if (tableFrame?.currentRow) {
      tableFrame.rows?.push([...tableFrame.currentRow]);
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

  // ── Private helpers: FRDOC ──

  private closeFrdoc(): void {
    const frame = this.popFrame(FR_FRDOC_ELEMENT);
    if (!frame || frame.kind !== "frdoc") return;

    const text = frame.textBuffer.trim();
    // Extract document number from "[FR Doc. 2026-06029 Filed 3-27-26; 8:45 am]"
    // or "[FR Doc. 2026-06029]"
    const match = /FR\s+Doc\.\s+([\d-]+)/i.exec(text);
    if (match) {
      this.currentDocMeta.documentNumber = match[1];
    }
  }

  // ── Private helpers: Stack navigation ──

  private addToDocument(node: ASTNode): void {
    const docFrame = this.findParentDocument();
    if (docFrame?.node && docFrame.node.type === "level") {
      (docFrame.node as LevelNode).children.push(node);
    }
  }

  private findParentDocument(): StackFrame | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i]?.kind === "document") {
        return this.stack[i];
      }
    }
    return undefined;
  }

  private findParentNote(): StackFrame | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i]?.kind === "note" || this.stack[i]?.kind === "signature") {
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

  private findFrame(kind: FrameKind): StackFrame | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i]?.kind === kind) {
        return this.stack[i];
      }
    }
    return undefined;
  }

  private popFrame(elementName: string): StackFrame | undefined {
    if (this.stack.length === 0) return undefined;

    // Find the matching frame (may not be exactly on top)
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i]?.elementName === elementName) {
        return this.stack.splice(i, 1)[0];
      }
    }

    // No matching frame found — warn rather than popping an unrelated frame
    console.warn(
      `FrASTBuilder: no matching frame for closing element </${elementName}>, ` +
        `stack has: [${this.stack.map((f) => f.elementName).join(", ")}]`,
    );
    return undefined;
  }
}
