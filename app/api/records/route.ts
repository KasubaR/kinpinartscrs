import { database } from '@/db/raw';
import { getChatGPTUser } from '../../chatgpt-auth';
const unauthorized=()=>Response.json({error:'Please sign in.'},{status:401});
const kinds=['customer','deal','quote','invoice','settings'];
const currencies=['ZMW','ZAR','USD','EUR','GBP','AUD'];
async function nextNumber(db:any,kind:string){
const last=await db.prepare("SELECT MAX(CAST(SUBSTR(json_extract(data,'$.docNumber'),3) AS INTEGER)) AS value FROM records WHERE kind=? AND UPPER(SUBSTR(json_extract(data,'$.docNumber'),1,2))='KA' AND LENGTH(SUBSTR(json_extract(data,'$.docNumber'),3))>0 AND SUBSTR(json_extract(data,'$.docNumber'),3) NOT GLOB '*[^0-9]*'").bind(kind).first();
const start=Math.max(kind==='quote'?24:39,Number(last?.value||0)+1);const row=await db.prepare('INSERT INTO counters(kind,value) VALUES(?,?) ON CONFLICT(kind) DO UPDATE SET value=MAX(value+1,excluded.value) RETURNING value').bind(kind,start).first();return 'KA'+String(row.value).padStart(4,'0');}
const amount=(d:any)=>{const sub=d.items.reduce((s:number,x:any)=>s+Math.round(x.qty*x.price*100)/100,0),off=Math.round(sub*d.discount)/100,tax=Math.round((sub-off)*d.tax)/100;return Math.round((sub-off+tax)*100)/100;};
export async function GET(){if(!await getChatGPTUser())return unauthorized();try{const r=await database().prepare('SELECT * FROM records ORDER BY id DESC').all();return Response.json(r.results.map((r:any)=>({...JSON.parse(r.data),id:r.id,kind:r.kind,source:r.source})));}catch(e){console.error(e);return Response.json({error:'Could not load records. Please retry.'},{status:503});}}
export async function POST(req:Request){if(!await getChatGPTUser())return unauthorized();try{
const b:any=await req.json(),db=database();
if(b.action==='convert'){
const q:any=await db.prepare("SELECT * FROM records WHERE id=? AND kind='quote'").bind(b.id).first();if(!q)return Response.json({error:'Quotation not found'},{status:404});
const existing=await db.prepare("SELECT id FROM records WHERE source=?").bind(q.id).first();if(existing)return Response.json({ok:true});
const data={...JSON.parse(q.data),docNumber:await nextNumber(db,'invoice'),notes:'',status:'Unpaid',paid:0,date:new Date().toISOString().slice(0,10),due:new Date(Date.now()+30*86400000).toISOString().slice(0,10)};
await db.prepare("INSERT INTO records(kind,data,source) VALUES('invoice',?,?) ON CONFLICT(source) DO NOTHING").bind(JSON.stringify(data),q.id).run();return Response.json({ok:true});}
const d=b.data;
function invalid(error:string){return Response.json({error},{status:400});}
if(!kinds.includes(b.kind)||!d||typeof d!=='object')return invalid('Invalid record');
if(b.kind==='customer'&&!d.name?.trim())return invalid('Customer name is required.');
if(b.kind==='settings'&&(!d.business?.trim()||!currencies.includes(d.currency)||!Number.isFinite(d.tax)||d.tax<0||d.tax>100))return invalid('Check business name, currency, and tax.');
if(['deal','quote','invoice'].includes(b.kind)){
if(!currencies.includes(d.currency)||!Number.isInteger(Number(d.customer)))return invalid('Choose a customer and currency.');
const customer=await db.prepare("SELECT id FROM records WHERE id=? AND kind='customer'").bind(Number(d.customer)).first();if(!customer)return invalid('Customer not found.');}
if(b.kind==='deal'&&(!d.title?.trim()||!Number.isFinite(d.value)||d.value<0||!['Lead','Qualified','Proposal','Won','Lost'].includes(d.stage)))return invalid('Check opportunity details.');
if(['quote','invoice'].includes(b.kind)){
if(d.docNumber!==undefined&&typeof d.docNumber!=='string')return invalid('Document number must be text.');
d.docNumber=d.docNumber?.trim()||'';
if(d.docNumber&&!/^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$/.test(d.docNumber))return invalid('Use up to 40 letters, numbers, spaces, dots, slashes, underscores, or hyphens for the document number.');
if(b.id&&!d.docNumber)return invalid('Enter a document number.');
if(d.docNumber){const duplicate=await db.prepare("SELECT id FROM records WHERE kind=? AND lower(trim(json_extract(data,'$.docNumber')))=lower(?) AND id<>?").bind(b.kind,d.docNumber,b.id||0).first();if(duplicate)return Response.json({error:`This ${b.kind==='quote'?'quotation':'invoice'} number is already in use. Choose another number.`},{status:409});}
if(!Array.isArray(d.items)||!d.items.length||d.items.length>200||d.items.some((x:any)=>!x.description?.trim()||!Number.isFinite(x.qty)||x.qty<=0||!Number.isFinite(x.price)||x.price<0)||!Number.isFinite(d.tax)||d.tax<0||d.tax>100||!Number.isFinite(d.discount)||d.discount<0||d.discount>100)return invalid('Check items, tax, and discount.');
if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!/^\d{4}-\d{2}-\d{2}$/.test(d.due)||d.due<d.date)return invalid('Check issue and due dates.');
if(b.kind==='quote'&&!['Draft','Sent','Accepted','Declined'].includes(d.status))return invalid('Invalid quotation status.');
if(b.kind==='invoice'){if(!Number.isFinite(d.paid)||d.paid<0||d.paid>amount(d))return invalid('Payment must be between zero and the invoice total.');d.status=d.paid>=amount(d)?'Paid':d.paid>0?'Partially paid':'Unpaid';}}
if(b.id){const result=await db.prepare('UPDATE records SET data=? WHERE id=? AND kind=?').bind(JSON.stringify(d),b.id,b.kind).run();if(!result.meta.changes)return Response.json({error:'Record not found.'},{status:404});}else{if(['quote','invoice'].includes(b.kind)&&!d.docNumber)d.docNumber=await nextNumber(db,b.kind);await db.prepare('INSERT INTO records(kind,data) VALUES(?,?)').bind(b.kind,JSON.stringify(d)).run();}return Response.json({ok:true});
}catch(e){console.error(e);if(String(e).includes('records_kind_document_number_unique'))return Response.json({error:'This document number is already in use. Choose another number.'},{status:409});return Response.json({error:'Could not save. Your input has been kept; please retry.'},{status:503});}}

