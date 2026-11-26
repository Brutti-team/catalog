import { useRef, useState, useLayoutEffect, type KeyboardEvent, type MouseEvent } from "react";
import {
  AlignLeft, List, ListOrdered, Bold, Italic, Underline, Strikethrough,
  Heading2, RemoveFormatting, type LucideIcon,
} from "lucide-react";
import { materialListStyle, type MaterialListStyle } from "../lib/material-list";
import type { InlineMaterialFormat } from "../lib/material-editor-format";
import { materialEditorHtml, serializeMaterialEditor } from "../lib/material-richtext";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  maxLength?: number;
};

const MAX_LENGTH = 2000;
const options: { value: MaterialListStyle; label: string; Icon: LucideIcon }[] = [
  { value: "plain", label: "Plain", Icon: AlignLeft },
  { value: "bullet", label: "Bullets", Icon: List },
  { value: "numbered", label: "Numbering", Icon: ListOrdered },
];
const inlineOptions: { value: InlineMaterialFormat; label: string; shortcut: string; Icon: LucideIcon }[] = [
  { value: "bold", label: "Bold", shortcut: "Ctrl+B", Icon: Bold },
  { value: "italic", label: "Italic", shortcut: "Ctrl+I", Icon: Italic },
  { value: "underline", label: "Underline", shortcut: "Ctrl+U", Icon: Underline },
  { value: "strike", label: "Strikethrough", shortcut: "Ctrl+Shift+X", Icon: Strikethrough },
];

/** Editable rich text, with the existing safe text-based storage format. */
export default function MaterialsEditor({value,onChange,disabled=false,placeholder,label="Materials",maxLength=MAX_LENGTH}:Props) {
  const editorRef=useRef<HTMLDivElement>(null);
  const savedValue=useRef<string|null>(null);
  const selection=useRef<Range|null>(null);
  const [warning,setWarning]=useState("");
  const mode=materialListStyle(value);
  const [active,setActive]=useState<string[]>([]);
  useLayoutEffect(()=>{
    const el=editorRef.current;
    if(el && savedValue.current!==value){
      el.innerHTML=value ? materialEditorHtml(value) : "";
      savedValue.current=value;
      selection.current=null;
    }
  },[value]);
  const remember=()=>{
    const el=editorRef.current, sel=window.getSelection();
    if(el&&sel?.rangeCount&&el.contains(sel.getRangeAt(0).commonAncestorContainer)){
      selection.current=sel.getRangeAt(0).cloneRange();
      setActive(["bold","italic","underline","strikeThrough","insertUnorderedList","insertOrderedList"].filter(cmd=>document.queryCommandState(cmd)));
    }
  };
  const publish=()=>{
    const el=editorRef.current;if(!el)return;
    const next=serializeMaterialEditor(el);
    if(next.length>maxLength){
      setWarning(`${label} cannot exceed ${maxLength.toLocaleString("en-MY")} characters.`);
      el.innerHTML=savedValue.current ? materialEditorHtml(savedValue.current) : "";
      selection.current=null;
      const range=document.createRange();range.selectNodeContents(el);range.collapse(false);
      const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(range);
      return;
    }
    setWarning("");savedValue.current=next;onChange(next);remember();
  };
  const command=(name:string,arg?:string)=>{
    const el=editorRef.current;if(disabled||!el)return;
    el.focus({preventScroll:true});
    const sel=window.getSelection();
    if(selection.current && el.contains(selection.current.commonAncestorContainer)){
      sel?.removeAllRanges();sel?.addRange(selection.current);
    }
    document.execCommand("styleWithCSS",false,"false");
    document.execCommand(name,false,arg);
    publish();
  };
  const chooseStyle=(style:MaterialListStyle)=>{
    if(style==="plain"){
      if(document.queryCommandState("insertUnorderedList"))command("insertUnorderedList");
      else if(document.queryCommandState("insertOrderedList"))command("insertOrderedList");
      else command("formatBlock","div");
    }else command(style==="bullet"?"insertUnorderedList":"insertOrderedList");
  };
  const formatInline=(style:InlineMaterialFormat)=>{
    if(style!=="highlight")command(style==="strike"?"strikeThrough":style);
  };
  const formatHeading=()=>command("formatBlock",document.queryCommandValue("formatBlock")==="h2"?"div":"h2");
  const clearFormat=()=>command("removeFormat");
  const onKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
    const key=event.key.toLowerCase();
    const type:InlineMaterialFormat|null=key==="b"?"bold":key==="i"?"italic":key==="u"?"underline":key==="x"&&event.shiftKey?"strike":null;
    if(type){event.preventDefault();remember();formatInline(type);}
  };
  const preserveSelection=(event:MouseEvent<HTMLDivElement>)=>{
    if(event.target instanceof Element&&event.target.closest("button")){remember();event.preventDefault();}
  };
  const help="Select text or choose a format before typing.";
  return (
    <div className="catalog-materials-editor">
      <div className="catalog-materials-toolbar" role="toolbar" aria-label={`${label} formatting tools`}
        onMouseDown={preserveSelection}>
        <div className="catalog-materials-tool-group catalog-materials-list-tools" role="group" aria-label="List formatting">
          {options.map(({ value: style, label, Icon }) => (
            <button
              key={style}
              type="button"
              aria-label={label === "Plain" ? "Plain text" : label}
              aria-pressed={mode === style}
              title={label === "Plain" ? "Plain text" : label}
              disabled={disabled}
              className={mode === style ? "is-active" : ""}
              onClick={() => chooseStyle(style)}
            >
              <Icon size={15} strokeWidth={1.85} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <span className="catalog-materials-toolbar-divider" aria-hidden="true" />
        <div className="catalog-materials-tool-group catalog-materials-inline-tools" role="group" aria-label="Text formatting">
          {inlineOptions.map(({ value: format, label, shortcut, Icon }) => (
            <button
              key={format}
              type="button"
              aria-label={label}
              title={shortcut ? `${label} (${shortcut})` : label}
              disabled={disabled}
              aria-pressed={active.includes(format === "strike" ? "strikeThrough" : format)}
              className={active.includes(format === "strike" ? "strikeThrough" : format) ? "is-active" : ""}
              onClick={() => formatInline(format)}
            >
              <Icon size={16} strokeWidth={1.85} aria-hidden="true" />
            </button>
          ))}
          <button type="button" title="Section heading" aria-label="Heading"
            disabled={disabled} onClick={formatHeading}>
            <Heading2 size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" title="Clear text formatting" aria-label="Clear formatting"
            disabled={disabled} onClick={clearFormat}>
            <RemoveFormatting size={16} strokeWidth={1.85} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={editorRef}
        className="catalog-materials-live"
        role="textbox" aria-label={label} aria-multiline="true" aria-disabled={disabled}
        contentEditable={!disabled} suppressContentEditableWarning
        data-placeholder={placeholder ?? "Describe materials and finishing…"}
        onInput={publish} onKeyDown={onKeyDown}
        onKeyUp={remember} onMouseUp={remember} onFocus={remember}
        onPaste={event=>{event.preventDefault();document.execCommand("insertText",false,event.clipboardData.getData("text/plain"));publish();}}
        onDrop={event=>event.preventDefault()}
      />
      <div className="catalog-materials-helper">
        <span>{warning || help}</span>
      </div>
    </div>
  );
}
