import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, CreditCard, Plus, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BANK_CATALOG } from "@/lib/bank-catalog";
import { setState, uid, type Bank, type CardC } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/onboarding")({head:()=>({meta:[{title:"Configurar carteira — BolsoFirme"},{name:"description",content:"Prepare seus bancos e cartões no BolsoFirme."},{property:"og:title",content:"Configurar carteira — BolsoFirme"},{property:"og:description",content:"Prepare seus bancos e cartões no BolsoFirme."},{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }]}), component: Onboarding });

type DraftCard={bank:string;brand:string;limit:string;closing:string;due:string};
const BRANDS=["Visa","Mastercard","Elo","American Express","Hipercard"];
const field="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
function Onboarding(){
 const nav=useNavigate();
 const [step,setStep]=useState(0);
 const [selected,setSelected]=useState<string[]>([]);
 const [cards,setCards]=useState<DraftCard[]>([]);
 const [saving,setSaving]=useState(false);
 const toggle=(name:string)=>setSelected(v=>v.includes(name)?v.filter(x=>x!==name):[...v,name]);
 const addCard=()=>setCards(v=>[...v,{bank:selected[0]??"",brand:"Visa",limit:"",closing:"",due:""}]);
 const updateCard=(i:number,key:keyof DraftCard,value:string)=>setCards(v=>v.map((c,j)=>j===i?{...c,[key]:value}:c));
 const removeCard=(i:number)=>setCards(v=>v.filter((_,j)=>j!==i));
 const finish=async()=>{
  if(!selected.length){toast.error("Selecione pelo menos um banco.");setStep(1);return;}
  if(cards.some(c=>!c.bank||!selected.includes(c.bank)||!c.limit||Number(c.limit)<=0||!c.closing||Number(c.closing)<1||Number(c.closing)>31||!c.due||Number(c.due)<1||Number(c.due)>31)){toast.error("Confira os dados dos cartões. Os dias devem ficar entre 1 e 31.");setStep(2);return;}
  setSaving(true);
  try{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){toast.error("Sua sessão expirou. Entre novamente.");setSaving(false);return;}
   const banks:Bank[]=selected.flatMap(name=>{const b=BANK_CATALOG.find(x=>x.name===name);return b?[{id:uid(),name,color:b.color,logo:b.logo,kind:"Conta Corrente" as const,initial:0}]:[];});
   const bankInsert=banks.map(b=>({id:b.id,user_id:user.id,name:b.name,color:b.color,logo:b.logo??"",kind:b.kind,initial_cents:0}));
   const cardInsert:CardC[]=cards.map(c=>({id:uid(),name:c.bank+" • "+c.brand,bank:c.bank,brand:c.brand,color:"#64748b",limit:Math.round(Number(c.limit)*100),closing:Number(c.closing),due:Number(c.due)}));
   const {error:bankError}=await supabase.from("banks").upsert(bankInsert);
   if(bankError)throw bankError;
   if(cardInsert.length){const {error:cardError}=await supabase.from("cards").upsert(cardInsert.map(c=>({id:c.id,user_id:user.id,name:c.name,bank:c.bank,brand:c.brand??"",color:c.color,limit_cents:c.limit,closing_day:c.closing,due_day:c.due})));if(cardError)throw cardError;}
   const {error:settingsError}=await supabase.from("user_settings").upsert({user_id:user.id,onboarding_complete:true,selected_banks:selected});
   if(settingsError)throw settingsError;
   setState(st=>({...st,banks,cards:cardInsert}));
   toast.success("Tudo pronto! Sua carteira foi criada.");
   nav({to:"/transacoes"});
  }catch(e){console.error(e);toast.error("Ocorreu um erro ao salvar sua carteira.");setSaving(false);}
 };
 const progress=step===0?0:step===1?33:step===2?66:100;
 const next=()=>{if(step===1&&!selected.length){toast.error("Escolha pelo menos um banco para continuar.");return;}setStep(s=>Math.min(3,s+1));};
 return <div className="min-h-screen bg-background">
  <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
   <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Wallet className="h-5 w-5"/></div><div><div className="font-bold leading-tight tracking-tight">BolsoFirme</div><div className="text-xs text-muted-foreground">Sua vida financeira em equilíbrio</div></div></div>
   <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary"/> Configuração segura</div>
  </header>
  <main className="mx-auto grid min-h-[calc(100vh-84px)] w-full max-w-6xl items-center gap-8 px-5 pb-10 pt-2 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
   <section className="mx-auto w-full max-w-3xl">
    <div className="mb-8">
     <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground"><span>{step===0?"SEJA BEM-VINDO":`ETAPA ${step} DE 3`}</span><span>{progress}% concluído</span></div>
     <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{width:progress+"%"}}/></div>
     {step>0&&<div className="mt-4 flex items-center gap-2">{["Bancos","Cartões","Finalização"].map((x,i)=><div key={x} className="flex flex-1 items-center gap-2"><div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${step>i?"bg-primary text-primary-foreground":"bg-secondary text-muted-foreground"}`}>{step>i+1?<Check className="h-3.5 w-3.5"/>:i+1}</div><span className={`hidden text-xs sm:inline ${step===i+1?"font-semibold text-foreground":"text-muted-foreground"}`}>{x}</span>{i<2&&<div className="h-px flex-1 bg-border"/>}</div>)}</div>}
    </div>
    {step===0&&<div className="py-5 sm:py-10">
     <div className="mb-7 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7"/></div>
     <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-primary">Vamos começar</p>
     <h1 className="max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">Organize seu dinheiro. <span className="text-primary">Conquiste seus planos.</span></h1>
     <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Em poucos passos, vamos preparar seu espaço financeiro. Escolha seus bancos e, se quiser, cadastre seus cartões. Você pode ajustar tudo depois.</p>
     <div className="mt-9 grid gap-3 sm:grid-cols-3">{[{icon:Building2,title:"Seus bancos",desc:"Reúna suas contas em um só lugar."},{icon:CreditCard,title:"Seus cartões",desc:"Acompanhe limites e vencimentos."},{icon:ShieldCheck,title:"Seus dados",desc:"Suas informações ficam privadas."}].map(x=><div key={x.title} className="rounded-2xl border border-border bg-card p-4"><x.icon className="mb-3 h-5 w-5 text-primary"/><div className="text-sm font-semibold">{x.title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{x.desc}</p></div>)}</div>
     <Button className="mt-9 h-12 w-full rounded-xl text-sm sm:w-auto sm:min-w-52" onClick={next}>Configurar minha carteira <ArrowRight className="ml-2 h-4 w-4"/></Button>
    </div>}
    {step===1&&<div>
     <div className="mb-6"><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"><Building2 className="h-3.5 w-3.5"/> Etapa 1 · Bancos</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Quais bancos você usa?</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Selecione todas as instituições onde você tem conta. Não precisa conectar suas senhas.</p></div>
     <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium">Instituições disponíveis</span><span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{selected.length} selecionado(s) · mínimo 1</span></div>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{BANK_CATALOG.map(({name,color,logo})=><button type="button" key={name} onClick={()=>toggle(name)} aria-pressed={selected.includes(name)} className={`group flex min-h-[62px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all hover:border-primary/60 hover:bg-accent/60 ${selected.includes(name)?"border-primary bg-primary/10 ring-1 ring-primary/20":"border-border bg-card"}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background"><img src={logo} alt={`Logo ${name}`} className="h-6 w-6 rounded object-contain" onError={e=>{e.currentTarget.style.display="none";const fallback=e.currentTarget.nextElementSibling as HTMLElement|null;if(fallback)fallback.style.display="block";}}/><span className="hidden h-2.5 w-2.5 rounded-full" style={{background:color}}/></span><span className="min-w-0 flex-1 truncate font-medium">{name}</span>{selected.includes(name)&&<CheckCircle2 className="h-4 w-4 shrink-0 text-primary"/>}</button>)}</div>
     <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/60 px-4 py-3"><span className="text-xs text-muted-foreground">Você poderá adicionar ou remover bancos nas configurações.</span><button className="text-xs font-semibold text-primary" onClick={()=>setSelected(BANK_CATALOG.map(({name})=>name))}>Selecionar todos</button></div>
     <div className="mt-8 flex items-center justify-between gap-3"><Button variant="ghost" onClick={()=>setStep(0)}><ArrowLeft className="mr-2 h-4 w-4"/>Voltar</Button><Button className="h-11 min-w-36 rounded-xl" disabled={!selected.length} onClick={next}>Continuar <ArrowRight className="ml-2 h-4 w-4"/></Button></div>
    </div>}
    {step===2&&<div>
     <div className="mb-6"><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"><CreditCard className="h-3.5 w-3.5"/> Etapa 2 · Cartões</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">E seus cartões?</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Cadastre os cartões de crédito para acompanhar limites, fechamentos e vencimentos. Esta etapa é opcional.</p></div>
     <div className="mb-4 flex items-center justify-between gap-3"><span className="text-sm font-medium">Cartões de crédito</span><Button variant="outline" size="sm" className="rounded-lg" onClick={addCard}><Plus className="mr-1 h-4 w-4"/>Adicionar cartão</Button></div>
     {cards.length===0?<div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><CreditCard className="h-6 w-6 text-muted-foreground"/></div><p className="font-semibold">Nenhum cartão por enquanto</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Sem problemas! Você pode cadastrar seus cartões a qualquer momento.</p><Button variant="outline" className="mt-5 rounded-xl" onClick={addCard}><Plus className="mr-2 h-4 w-4"/>Adicionar meu primeiro cartão</Button></div>:<div className="grid gap-3">{cards.map((c,i)=><div key={i} className="relative rounded-2xl border border-border bg-card p-4 sm:p-5"><button type="button" onClick={()=>removeCard(i)} aria-label="Remover cartão" className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4"/></button><div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><CreditCard className="h-5 w-5"/></div><div><p className="text-sm font-semibold">Cartão {i+1}</p><p className="text-xs text-muted-foreground">Informações do cartão</p></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Banco<select className={field} value={c.bank} onChange={e=>updateCard(i,"bank",e.target.value)}><option value="">Selecione o banco</option>{selected.map(b=><option key={b}>{b}</option>)}</select></label><label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Bandeira<select className={field} value={c.brand} onChange={e=>updateCard(i,"brand",e.target.value)}>{BRANDS.map(b=><option key={b}>{b}</option>)}</select></label><label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Limite (R$)<Input className="h-11 rounded-xl" type="number" min="0.01" step="0.01" placeholder="Ex.: 5000,00" value={c.limit} onChange={e=>updateCard(i,"limit",e.target.value)}/></label><div className="grid grid-cols-2 gap-2"><label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Fecha dia<Input className="h-11 rounded-xl" type="number" min="1" max="31" placeholder="Dia" value={c.closing} onChange={e=>updateCard(i,"closing",e.target.value)}/></label><label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Vence dia<Input className="h-11 rounded-xl" type="number" min="1" max="31" placeholder="Dia" value={c.due} onChange={e=>updateCard(i,"due",e.target.value)}/></label></div></div></div>)}</div>}
     <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={()=>setStep(1)}><ArrowLeft className="mr-2 h-4 w-4"/>Voltar</Button><div className="flex items-center gap-2"><Button variant="ghost" onClick={()=>setStep(3)}>Fazer depois</Button><Button className="h-11 min-w-36 rounded-xl" onClick={next}>Continuar <ArrowRight className="ml-2 h-4 w-4"/></Button></div></div>
    </div>}
    {step===3&&<div className="py-4 sm:py-8">
     <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="h-9 w-9"/></div><p className="mb-2 text-sm font-semibold uppercase tracking-[.16em] text-emerald-500">Tudo pronto</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sua carteira está quase pronta!</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Confira seu resumo. Ao concluir, você poderá começar a organizar suas finanças.</p>
     <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-primary"/> Bancos selecionados</div><div className="flex flex-wrap gap-2">{selected.map(name=><span key={name} className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs">{name}</span>)}</div><p className="mt-3 text-xs text-muted-foreground">{selected.length} instituição(ões)</p></div><div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4 text-primary"/> Cartões cadastrados</div><p className="text-3xl font-bold">{cards.length}</p><p className="mt-1 text-xs text-muted-foreground">{cards.length===0?"Você poderá adicionar depois.":cards.length===1?"Cartão de crédito":"Cartões de crédito"}</p></div></div>
     <div className="mt-5 flex items-start gap-3 rounded-xl bg-primary/5 p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><p className="leading-6 text-muted-foreground">Seus dados financeiros são privados. Nada será compartilhado com outras pessoas sem sua autorização.</p></div>
     <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={()=>setStep(2)}><ArrowLeft className="mr-2 h-4 w-4"/>Voltar</Button><Button className="h-12 min-w-48 rounded-xl" disabled={saving} onClick={finish}>{saving?"Preparando sua carteira...":"Concluir e entrar"} <Check className="ml-2 h-4 w-4"/></Button></div>
    </div>}
   </section>
   <aside className="hidden lg:block"><div className="relative overflow-hidden rounded-3xl border border-border bg-card p-7"><div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl"/><div className="relative"><div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Wallet className="h-6 w-6"/></div><p className="text-lg font-bold leading-snug">Clareza hoje. Tranquilidade amanhã.</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Tenha suas contas, cartões e investimentos organizados em um só lugar.</p><div className="my-7 h-px bg-border"/><div className="grid gap-4">{["Acompanhe para onde seu dinheiro vai","Planeje seus próximos objetivos","Tenha controle sem complicação"].map((x,i)=><div key={x} className="flex items-start gap-3"><div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check className="h-3.5 w-3.5"/></div><p className="text-sm text-muted-foreground">{x}</p></div>)}</div></div></div><p className="mt-4 text-center text-xs text-muted-foreground">Leva menos de 2 minutos para configurar.</p></aside>
  </main>
 </div>;
}
