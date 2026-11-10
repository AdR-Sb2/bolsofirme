import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Search, UserPlus, X, Users, ShieldCheck, Wallet, ReceiptText, TrendingUp, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

type Summary = { banks:number; transactions:number; investments:number; income:number; expense:number; assets:number };
type Profile = { user_id:string; display_name:string; avatar_url:string; created_at?:string };
type Request = { id:string; sender_id:string; recipient_id:string; status:string; created_at?:string };
type Permission = { share_balances:boolean; share_transactions:boolean; share_investments:boolean };
const emptyPermission:Permission={share_balances:false,share_transactions:false,share_investments:false};
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value/100);
function Person({profile,size="md"}:{profile?:Profile;size?:"sm"|"md"|"lg"}) {
 const dimension=size==="lg"?"h-16 w-16 text-lg":size==="sm"?"h-9 w-9 text-xs":"h-12 w-12 text-sm";
 const initials=(profile?.display_name||"BF").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
 return <div className={`grid ${dimension} shrink-0 place-items-center overflow-hidden rounded-full border bg-primary/10 font-semibold text-primary`}>{profile?.avatar_url?<img src={profile.avatar_url} alt={profile.display_name} className="h-full w-full object-cover"/>:initials}</div>;
}
export const Route=createFileRoute("/_authenticated/conexoes")({head:()=>({meta:[{title:"Conexões — BolsoFirme"},{name:"description",content:"Gerencie conexões e compartilhamento no BolsoFirme."}]}),component:Conexoes});
function Conexoes(){
 const [me,setMe]=useState("");
 const [profiles,setProfiles]=useState<Profile[]>([]);
 const [requests,setRequests]=useState<Request[]>([]);
 const [permissions,setPermissions]=useState<Record<string,Permission>>({});
 const [query,setQuery]=useState("");
 const [shared,setShared]=useState<Record<string,Summary>>({});
 const [loading,setLoading]=useState(true);
 const db=supabase as any;
 const profileById=useMemo(()=>Object.fromEntries(profiles.map(p=>[p.user_id,p])),[profiles]);
 const load=async()=>{
  setLoading(true);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setLoading(false);return;}
  setMe(user.id);
  const [p,r,perms]=await Promise.all([
   db.from("user_profiles").select("user_id,display_name,avatar_url,created_at").neq("user_id",user.id).order("display_name"),
   db.from("connection_requests").select("id,sender_id,recipient_id,status,created_at").or("sender_id.eq."+user.id+",recipient_id.eq."+user.id).order("created_at",{ascending:false}),
   db.from("connection_permissions").select("*").eq("owner_id",user.id)
  ]);
  if(p.error||r.error){toast.error("Não foi possível carregar as conexões. Verifique se a migração de conexões foi aplicada.");setLoading(false);return;}
  setProfiles(p.data??[]);
  const rows:Request[]=r.data??[];
  setRequests(rows);
  setPermissions(Object.fromEntries((perms.data??[]).map((x:any)=>[x.viewer_id,x])));
  const {data:summaryRows,error:summaryError}=await supabase.rpc("shared_finance_summary");
  if(!summaryError)setShared(Object.fromEntries((summaryRows??[]).map((x:any)=>[x.user_id,{banks:Number(x.banks),transactions:Number(x.transactions),investments:Number(x.investments),income:Number(x.income),expense:Number(x.expense),assets:Number(x.assets)}])));
  setLoading(false);
 };
 useEffect(()=>{void load();},[]);
 const incoming=requests.filter(r=>r.recipient_id===me&&r.status==="pending");
 const outgoing=requests.filter(r=>r.sender_id===me&&r.status==="pending");
 const accepted=requests.filter(r=>r.status==="accepted");
 const filtered=profiles.filter(p=>p.display_name.toLowerCase().includes(query.toLowerCase()));
 const send=async(id:string)=>{
  const {error}=await db.from("connection_requests").insert({sender_id:me,recipient_id:id});
  if(error)toast.error("Não foi possível enviar. Talvez já exista uma solicitação.");
  else{toast.success("Convite enviado!");await load();}
 };
 const respond=async(r:Request,status:"accepted"|"rejected")=>{
  const {error}=await db.from("connection_requests").update({status,updated_at:new Date().toISOString()}).eq("id",r.id);
  if(error)toast.error("Não foi possível atualizar o convite.");
  else{
   if(status==="accepted"){
    const {error:permissionError}=await db.from("connection_permissions").upsert({owner_id:me,viewer_id:r.sender_id,...emptyPermission});
    if(permissionError)toast.error("Convite aceito, mas não foi possível configurar as permissões.");
   }
   toast.success(status==="accepted"?"Conexão aceita!":"Convite recusado.");
   await load();
  }
 };
 const updatePermission=async(viewer:string,key:keyof Permission,value:boolean)=>{
  const next={...(permissions[viewer]??emptyPermission),[key]:value};
  setPermissions(v=>({...v,[viewer]:next}));
  const {error}=await db.from("connection_permissions").upsert({owner_id:me,viewer_id:viewer,...next});
  if(error){toast.error("Não foi possível salvar as permissões.");await load();}
 };
 const sectionTitle=(title:string,count:number)=><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">{count}</span></div>;
 return <div className="space-y-5">
  <PageTitle title="Conexões" sub="Encontre pessoas, acompanhe convites e escolha o que compartilhar."/>
  <div className="grid gap-3 sm:grid-cols-3">
   <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4"/>Conexões</div><p className="mt-2 text-2xl font-bold">{accepted.length}</p></div>
   <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4"/>Convites recebidos</div><p className="mt-2 text-2xl font-bold">{incoming.length}</p></div>
   <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><UserPlus className="h-4 w-4"/>Convites enviados</div><p className="mt-2 text-2xl font-bold">{outgoing.length}</p></div>
  </div>
  <section id="recebidos" className="scroll-mt-20 rounded-xl border bg-card p-5">
   {sectionTitle("Convites recebidos",incoming.length)}
   {loading?<div className="h-16 animate-pulse rounded-lg bg-muted"/>:incoming.length?incoming.map(r=>{const p=profileById[r.sender_id];return <div key={r.id} className="flex flex-wrap items-center gap-3 border-t py-3"><Person profile={p}/><div className="min-w-0 flex-1"><p className="font-medium">{p?.display_name??"Pessoa usuária"}</p><p className="text-xs text-muted-foreground">Quer se conectar com você</p></div><Button size="sm" onClick={()=>void respond(r,"accepted")}><Check className="mr-1 h-4 w-4"/>Aceitar</Button><Button size="sm" variant="outline" onClick={()=>void respond(r,"rejected")}><X className="mr-1 h-4 w-4"/>Recusar</Button></div>}):<p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Você está em dia! Quando alguém enviar um convite, ele aparecerá aqui.</p>}
  </section>
  <section className="rounded-xl border bg-card p-5">
   {sectionTitle("Encontrar pessoas",profiles.length)}
   <div className="mb-3 flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground"/><Input placeholder="Buscar pelo nome" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   {loading?<div className="space-y-2"><div className="h-14 animate-pulse rounded-lg bg-muted"/><div className="h-14 animate-pulse rounded-lg bg-muted"/></div>:filtered.length?filtered.map(p=>{
    const existing=requests.find(r=>(r.sender_id===me&&r.recipient_id===p.user_id)||(r.recipient_id===me&&r.sender_id===p.user_id));
    return <div key={p.user_id} className="flex items-center gap-3 border-t py-3"><Person profile={p}/><div className="min-w-0 flex-1"><p className="truncate font-medium">{p.display_name}</p><p className="text-xs text-muted-foreground">Membro do BolsoFirme</p></div>{existing?.status==="accepted"?<span className="text-xs font-medium text-emerald-600">Conectado</span>:existing?.status==="pending"?<span className="text-xs text-muted-foreground">{existing.sender_id===me?"Convite enviado":"Convite recebido"}</span>:existing?.status==="rejected"?<Button size="sm" variant="outline" onClick={()=>send(p.user_id)}>Enviar novamente</Button>:<Button size="sm" onClick={()=>send(p.user_id)}><UserPlus className="mr-1 h-4 w-4"/>Conectar</Button>}</div>;
   }):<p className="py-4 text-center text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>}
  </section>
  <section className="rounded-xl border bg-card p-5">
   {sectionTitle("Minhas conexões",accepted.length)}
   {accepted.length?accepted.map(r=>{
    const other=r.sender_id===me?r.recipient_id:r.sender_id;
    const p=profileById[other];
    const info=shared[other];
    return <article key={r.id} className="mb-3 rounded-xl border p-4 last:mb-0">
     <div className="flex items-center gap-3"><Person profile={p} size="lg"/><div className="min-w-0 flex-1"><p className="font-semibold">{p?.display_name??"Pessoa conectada"}</p><p className="text-xs text-muted-foreground">Conexão confirmada</p></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700"><ShieldCheck className="h-3.5 w-3.5"/>Conectado</span></div>
     <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg bg-muted/50 p-3"><Wallet className="mb-1 h-4 w-4 text-muted-foreground"/><p className="text-lg font-semibold">{info?.banks??"—"}</p><p className="text-xs text-muted-foreground">Bancos visíveis</p></div>
      <div className="rounded-lg bg-muted/50 p-3"><ReceiptText className="mb-1 h-4 w-4 text-muted-foreground"/><p className="text-lg font-semibold">{info?.transactions??"—"}</p><p className="text-xs text-muted-foreground">Transações</p></div>
      <div className="rounded-lg bg-muted/50 p-3"><TrendingUp className="mb-1 h-4 w-4 text-muted-foreground"/><p className="text-sm font-semibold">{info?money(info.income):"—"}</p><p className="text-xs text-muted-foreground">Receitas compartilhadas</p></div>
      <div className="rounded-lg bg-muted/50 p-3"><TrendingUp className="mb-1 h-4 w-4 text-muted-foreground"/><p className="text-sm font-semibold">{info?money(info.expense):"—"}</p><p className="text-xs text-muted-foreground">Despesas compartilhadas</p></div>
     </div>
     <div className="mt-4 border-t pt-3"><p className="mb-2 text-sm font-medium">O que esta pessoa pode ver</p>{([[ "share_balances","Saldos de bancos e cartões"],["share_transactions","Transações financeiras"],["share_investments","Investimentos"]] as [keyof Permission,string][]).map(([key,label])=><label key={key} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm"><input type="checkbox" checked={(permissions[other]??emptyPermission)[key]} onChange={e=>void updatePermission(other,key,e.target.checked)}/>{label}</label>)}</div>
    </article>;
   }):<p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Suas conexões aceitas aparecerão aqui. Você controla individualmente quais informações cada pessoa pode visualizar.</p>}
  </section>
  <section className="rounded-xl border bg-card p-5">
   {sectionTitle("Convites enviados",outgoing.length)}
   {outgoing.length?outgoing.map(r=>{const p=profileById[r.recipient_id];return <div key={r.id} className="flex items-center gap-3 border-t py-3"><Person profile={p}/><div className="flex-1"><p className="text-sm font-medium">{p?.display_name??"Pessoa usuária"}</p><p className="text-xs text-muted-foreground">Aguardando resposta</p></div><Clock3 className="h-4 w-4 text-muted-foreground"/></div>}):<p className="text-sm text-muted-foreground">Nenhum convite aguardando resposta.</p>}
  </section>
 </div>;
}
