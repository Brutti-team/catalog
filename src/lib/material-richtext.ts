/** Safe conversion between the existing text markers and the editable DOM.
 * Only the supported formatting is serialized; pasted HTML is never trusted. */
const marks = [
  ["***","strong-em"], ["**","strong"], ["~~","s"], ["++","u"], ["==","mark"], ["*","em"],
] as const;
function escapeText(text:string):string {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
export function materialInlineHtml(text:string):string {
  let html="", i=0;
  while(i<text.length) {
    const found=marks.find(([mark])=>{
      if(!text.startsWith(mark,i)) return false;
      const from=i+mark.length, close=text.indexOf(mark,from);
      return close>from && !/\s/.test(text[from]) && !/\s/.test(text[close-1]);
    });
    if(!found){html+=escapeText(text[i++]);continue;}
    const [mark,tag]=found, from=i+mark.length, end=text.indexOf(mark,from);
    const inner=materialInlineHtml(text.slice(from,end));
    html+=tag==="strong-em" ? "<strong><em>"+inner+"</em></strong>" : "<"+tag+">"+inner+"</"+tag+">";
    i=end+mark.length;
  }
  return html;
}
export function materialEditorHtml(value:string):string {
  let html="", list:"ul"|"ol"|null=null;
  const close=()=>{if(list){html+="</"+list+">";list=null;}};
  for(const line of value.split(/\r?\n/)){
    const bullet=line.match(/^(?:•|[-*])\s+(.*)$/), number=line.match(/^\d{1,3}[.)]\s+(.*)$/), heading=line.match(/^##\s+(.*)$/);
    const kind=bullet?"ul":number?"ol":null;
    if(kind){
      if(list!==kind){close();list=kind;html+="<"+kind+">";}
      html+="<li>"+(materialInlineHtml((bullet??number)![1])||"<br>")+"</li>";
    }else{
      close();
      const tag=heading?"h2":"div";
      html+="<"+tag+">"+(materialInlineHtml(heading?heading[1]:line)||"<br>")+"</"+tag+">";
    }
  }
  close();return html;
}

type Format={bold:boolean;italic:boolean;underline:boolean;strike:boolean;highlight:boolean};
const emptyFormat:Format={bold:false,italic:false,underline:false,strike:false,highlight:false};
function inherited(el:HTMLElement, parent:Format):Format {
  const tag=el.tagName, style=el.style, decoration=style.textDecoration+" "+style.textDecorationLine;
  return {
    bold:parent.bold||tag==="B"||tag==="STRONG"||style.fontWeight==="bold"||Number(style.fontWeight)>=600,
    italic:parent.italic||tag==="I"||tag==="EM"||style.fontStyle==="italic",
    underline:parent.underline||tag==="U"||decoration.includes("underline"),
    strike:parent.strike||tag==="S"||tag==="STRIKE"||tag==="DEL"||decoration.includes("line-through"),
    highlight:parent.highlight||tag==="MARK"||Boolean(style.backgroundColor && !["transparent","rgba(0, 0, 0, 0)","rgb(255, 255, 255)","white"].includes(style.backgroundColor)),
  };
}
function formatText(text:string, f:Format):string {
  return text.replace(/\u00a0/g," ").split("\n").map(line=>{
    const core=line.trim();if(!core)return line;
    const start=line.indexOf(core), end=start+core.length;
    let result=core;
    const wrap=(mark:string)=>{result=mark+result+mark;};
    if(f.bold&&f.italic)wrap("***");else if(f.bold)wrap("**");else if(f.italic)wrap("*");
    if(f.underline)wrap("++");if(f.strike)wrap("~~");if(f.highlight)wrap("==");
    return line.slice(0,start)+result+line.slice(end);
  }).join("\n");
}
export function serializeMaterialEditor(root:HTMLElement):string {
  const lines:string[]=[];let pending="";
  const flush=(force=false)=>{if(pending||force){lines.push(pending);pending="";}};
  const walk=(node:Node, f:Format, prefix="")=>{
    if(node.nodeType===Node.TEXT_NODE){pending+=formatText(node.textContent??"",f);return;}
    if(!(node instanceof HTMLElement))return;
    const tag=node.tagName, next=inherited(node,f);
    if(tag==="BR"){if(pending)flush();return;}
    if(tag==="UL"||tag==="OL"){
      flush();let n=0;
      for(const child of node.children){
        if(child.tagName!=="LI")continue;
        walk(child,next,tag==="UL"?"• ":String(++n)+". ");
      }
      return;
    }
    const block=["DIV","P","LI","H1","H2","H3","H4","H5","H6"].includes(tag);
    if(block)flush();
    if(prefix)pending=prefix;
    else if(/^H[1-6]$/.test(tag))pending="## ";
    for(const child of node.childNodes)walk(child,next);
    if(block)flush(true);
  };
  for(const child of root.childNodes)walk(child,emptyFormat);
  flush();
  return lines.join("\n").replace(/\n+$/,"");
}
