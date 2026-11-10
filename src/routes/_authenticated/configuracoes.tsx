import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Camera, LockKeyhole, UserRound, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { PALETTE, setState, uid, useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — BolsoFirme" },
      { name: "description", content: "Categorias, preferências e exportação de dados." },
      { property: "og:title", content: "Configurações — BolsoFirme" },
      { property: "og:description", content: "Categorias, preferências e exportação de dados." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: Config,
});

function download(name: string, content: string, type: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
}

function Config() {
  const s = useStore();
  const [name, setName] = useState(""); const [icon, setIcon] = useState("🏷️");
  const [profileName, setProfileName] = useState(""); const [email, setEmail] = useState(""); const [avatar, setAvatar] = useState("");
  const [newPassword, setNewPassword] = useState(""); const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  useEffect(() => { void (async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { data } = await supabase.from("user_profiles").select("display_name,avatar_url").eq("user_id", user.id).maybeSingle(); setProfileName(data?.display_name || user.user_metadata?.["full_name"] || user.user_metadata?.["name"] || ""); setAvatar(data?.avatar_url || user.user_metadata?.["avatar_url"] || user.user_metadata?.["picture"] || ""); setEmail(user.email || ""); })(); }, []);
  const saveProfile = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { toast.error("Entre novamente na sua conta."); return; } if (profileName.trim().length < 2) { toast.error("Informe um nome com pelo menos 2 caracteres."); return; } setProfileBusy(true); try { const { error } = await supabase.from("user_profiles").upsert({ user_id: user.id, display_name: profileName.trim(), avatar_url: avatar }); if (error) throw error; const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: profileName.trim(), name: profileName.trim() } }); if (metadataError) throw metadataError; toast.success("Perfil atualizado."); window.dispatchEvent(new Event("profile-updated")); } catch (e) { console.error(e); toast.error("Não foi possível salvar seu perfil."); } finally { setProfileBusy(false); } };
  const uploadAvatar = async (file?: File) => { if (!file) return; if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem."); return; } if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 5 MB."); return; } const { data: { user } } = await supabase.auth.getUser(); if (!user) return; setProfileBusy(true); try { const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"; const path = `${user.id}/avatar-${Date.now()}.${ext}`; const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type }); if (error) throw error; const { data } = supabase.storage.from("avatars").getPublicUrl(path); setAvatar(data.publicUrl); const { error: saveError } = await supabase.from("user_profiles").upsert({ user_id: user.id, display_name: profileName.trim() || user.email?.split("@")[0] || "Usuário", avatar_url: data.publicUrl }); if (saveError) throw saveError; toast.success("Foto de perfil atualizada."); window.dispatchEvent(new Event("profile-updated")); } catch (e) { console.error(e); toast.error("Não foi possível enviar a foto. Verifique o armazenamento do Supabase."); } finally { setProfileBusy(false); } };
  const changePassword = async () => { if (newPassword.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; } if (newPassword !== confirmNewPassword) { toast.error("As senhas não coincidem."); return; } setProfileBusy(true); try { const { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) throw error; setNewPassword(""); setConfirmNewPassword(""); toast.success("Senha atualizada com sucesso."); } catch (e) { console.error(e); toast.error("Não foi possível alterar a senha."); } finally { setProfileBusy(false); } };
  const update = (id: string, patch: Record<string, string>) => setState((st) => ({ ...st, categories: st.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const del = (id: string) => {
    if (s.txs.some((t) => t.categoryId === id)) { toast.error("Categoria em uso por transações."); return; }
    if (!confirm("Excluir categoria?")) return;
    setState((st) => ({ ...st, categories: st.categories.filter((c) => c.id !== id) })); toast.success("Categoria excluída");
  };
  const add = () => {
    if (!name.trim()) return;
    setState((st) => ({ ...st, categories: [...st.categories, { id: uid(), name: name.trim(), icon, color: PALETTE[st.categories.length % PALETTE.length] as string }] }));
    setName(""); toast.success("Categoria criada");
  };
  const csv = () => {
    const lines = [["Data", "Descrição", "Valor", "Tipo", "Categoria"], ...s.txs.map((t) => [t.date, t.description, (t.amount / 100).toFixed(2), t.type, s.categories.find((c) => c.id === t.categoryId)?.name ?? ""])];
    download("bolsofirme.csv", lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };

  return (
    <div className="max-w-3xl space-y-5">
      <PageTitle title="Configurações" sub="Personalize categorias, preferências e seus dados" />
      <section id="perfil" className="scroll-mt-20 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2"><UserRound className="h-5 w-5 text-primary"/><h3 className="font-semibold">Meu perfil</h3></div>
        <div className="flex flex-wrap items-center gap-4"><div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border bg-secondary text-xl font-bold text-primary">{avatar ? <img src={avatar} alt="Foto do perfil" className="h-full w-full object-cover"/> : (profileName.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "BF")}</div><div className="grid gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"><Camera className="h-4 w-4"/>Alterar foto<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={profileBusy} onChange={e=>{void uploadAvatar(e.target.files?.[0]);e.currentTarget.value="";}}/></label><p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máximo 5 MB</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">Nome de exibição</label><Input value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Seu nome"/></div><div><label className="mb-1 block text-sm font-medium">E-mail da conta</label><Input value={email} disabled/></div></div><Button className="mt-3" onClick={()=>void saveProfile()} disabled={profileBusy}><Save className="mr-2 h-4 w-4"/>Salvar perfil</Button>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary"/><h3 className="font-semibold">Segurança e senha</h3></div><p className="mb-3 text-sm text-muted-foreground">Defina uma senha para entrar também com e-mail e senha. Para contas Google, isso não altera a senha da sua conta Google.</p><div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">Nova senha</label><Input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/></div><div><label className="mb-1 block text-sm font-medium">Confirmar nova senha</label><Input type="password" autoComplete="new-password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Repita a senha"/></div></div><Button variant="outline" className="mt-3" onClick={()=>void changePassword()} disabled={profileBusy}>Atualizar senha</Button>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Categorias</h3>
        <div className="mb-4 flex gap-2"><Input className="w-16" value={icon} onChange={(e) => setIcon(e.target.value)} /><Input placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={add}>Adicionar</Button></div>
        <div className="grid gap-2">
          {s.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <input type="color" aria-label="Cor" className="h-9 w-9 shrink-0 rounded bg-transparent" value={c.color} onChange={(e) => update(c.id, { color: e.target.value })} />
              <Input className="w-16" value={c.icon} onChange={(e) => update(c.id, { icon: e.target.value })} />
              <Input value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
              <Button variant="outline" size="icon" aria-label="Excluir" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-expense" /></Button>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 font-semibold">Privacidade e conexões</h3><p className="mb-3 text-sm text-muted-foreground">Gerencie convites e escolha quais informações financeiras compartilha.</p><Button variant="outline" onClick={()=>window.location.assign("/conexoes")}>Gerenciar conexões e compartilhamento</Button><h3 className="mb-2 mt-5 font-semibold">Preferências</h3>
        <p className="text-sm text-muted-foreground">Tema: Escuro · Moeda: Real brasileiro (R$)</p>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">Dados</h3>
        <div className="flex gap-2"><Button variant="outline" onClick={() => download("bolsofirme.json", JSON.stringify(s, null, 2), "application/json")}>Exportar JSON</Button><Button variant="outline" onClick={csv}>Exportar CSV</Button></div>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 font-semibold">Conta</h3>
        <p className="text-sm text-muted-foreground">Sua conta está conectada com o Google. Seus dados financeiros ficam protegidos por usuário.</p>
      </section>
    </div>
  );
}
