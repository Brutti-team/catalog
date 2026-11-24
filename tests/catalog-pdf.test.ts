import {describe,expect,it} from "vitest";
import {IMPACT_FRONT,IMPACT_BACK,planPdfSections,selectPdfProducts} from "../src/lib/catalog-pdf-plan";
import {makeCatalogPdf} from "../src/lib/catalog-pdf-file";
import type {Product} from "../src/lib/types";
const categories=[{id:"cab",name:"Built in Cabinet",description:""},{id:"bed",name:"Beds & Bunk Beds",description:""}];
const item=(id:string,categoryId:string,status:Product["status"]="published",bestSelling=false):Product=>({id,categoryId,status,bestSelling,name:id,sku:id,images:[],materials:"",description:"",width:0,depth:0,height:0,price:null,featured:false,availability:"available",createdAt:"",updatedAt:""});
const products=[item("cabinet","cab"),item("bed","bed","published",true),item("private","bed","draft",true)];
describe("dynamic catalogue PDF",()=>{
  it("keeps original impact report front and back",()=>{expect(IMPACT_FRONT).toContain("page-01.webp");expect(IMPACT_BACK).toContain("page-40.webp");});
  it("uses the original website section order and excludes drafts",()=>{
    const sections=planPdfSections(products,categories,"all","",[]);
    expect(sections.slice(0,4).map(s=>s.name)).toEqual(["Bed & Bunkbed","Built-in Cabinet","Camper Builds","Kiosk"]);
    expect(sections.flatMap(s=>s.products).map(p=>p.id)).toEqual(["bed","cabinet"]);
  });
  it("filters best sellers, category and favourites without exposing drafts",()=>{
    expect(selectPdfProducts(products,"best","",[]).map(p=>p.id)).toEqual(["bed"]);
    expect(selectPdfProducts(products,"category","cab",[]).map(p=>p.id)).toEqual(["cabinet"]);
    expect(selectPdfProducts(products,"favourites","",["private","bed"]).map(p=>p.id)).toEqual(["bed"]);
  });
  it("writes correct page count, link and xref offset",async()=>{
    const page={jpeg:new Uint8Array([255,216,255,217]).buffer,width:1240,height:1754};
    const pdf=await makeCatalogPdf([{...page,links:[{x:0,y:0,w:100,h:50,page:1}]},page]).text();
    expect(pdf).toContain("/Count 2");
    expect(pdf).toContain("/Dest [6 0 R /Fit]");
    expect(pdf).toContain("%%EOF");
  });
});
