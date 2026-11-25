import type { Product, Category } from "./types";
import type { PdfSelection } from "./catalog-pdf-plan";

export async function downloadCustomerCatalogue(products:Product[],categories:Category[],mode:PdfSelection,categoryId:string,favourites:readonly string[],onProgress:(done:number,total:number)=>void){
  let generateCatalogPdf: typeof import("./catalog-pdf").generateCatalogPdf;
  try { ({generateCatalogPdf}=await import("./catalog-pdf")); }
  catch (error) { console.error("[Catalogue PDF] PDF module failed to load",error); throw new Error("The PDF module could not load. Refresh the page (Ctrl+F5) and try again."); }
  const result=await generateCatalogPdf(products,categories,mode,categoryId,[...favourites],onProgress);
  const url=URL.createObjectURL(result.blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=(mode==="favourites"?"Benua-Brutti-My-Favourites-":"Benua-Brutti-Catalogue-")+new Date().toISOString().slice(0,10)+".pdf";
  document.body.appendChild(link);
  try{link.click();}finally{link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);}
  return result;
}
