import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { loadUserData, useLoaded } from "@/lib/store";
export const Route=createFileRoute("/_authenticated")({ssr:false,beforeLoad:async()=>{const {data}=await supabase.auth.getUser();if(!data.user)throw redirect({to:"/auth"});return{userId:data.user.id};},component:Layout});
function Layout(){
 const {userId}=Route.useRouteContext();const loaded=useLoaded();const [error,setError]=useState(false);const nav=useNavigate();const path=useRouterState({select:s=>s.location.pathname});
 const load=()=>{setError(false);loadUserData(userId).catch(()=>setError(true));};useEffect(load,[userId]);
 useEffect(()=>{if(!loaded)return;let live=true;(async()=>{const db=supabase as any;const {data,error}=await db.from("user_settings").select("onboarding_complete").eq("user_id",userId).maybeSingle();if(!live)return;if(error||!data?.onboarding_complete){if(path!=="/onboarding")nav({to:"/onboarding"});}else if(path==="/onboarding")nav({to:"/transacoes"});})();return()=>{live=false;};},[loaded,userId,path,nav]);
 const content=error?<div className="py-20 text-center"><p className="mb-3 text-muted-foreground">Não foi possível carregar seus dados.</p><Button onClick={load}>Tentar novamente</Button></div>:!loaded?<div className="py-20 text-center text-muted-foreground">Carregando seus dados…</div>:<Outlet/>;
 return path==="/onboarding"?content:<AppShell>{content}</AppShell>;
}
