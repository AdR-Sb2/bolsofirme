import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Camera, LockKeyhole, UserRound, Save, PiggyBank, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { PALETTE, brl, monthKey, setState, uid, useStore } from "@/lib/store";
import {
  parseSavingsGoals,
  parseSpendingLimits,
  progressPercent,
  type SavingsGoal,
  type SpendingLimit,
} from "@/lib/planning";

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
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimit[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [planningReady, setPlanningReady] = useState(false);
  const [planningBusy, setPlanningBusy] = useState(false);
  const [planningError, setPlanningError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [limitValue, setLimitValue] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [contributions, setContributions] = useState<Record<string, string>>({});
  useEffect(() => { void (async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { data } = await supabase.from("user_profiles").select("display_name,avatar_url").eq("user_id", user.id).maybeSingle(); setProfileName(data?.display_name || user.user_metadata?.["full_name"] || user.user_metadata?.["name"] || ""); setAvatar(data?.avatar_url || user.user_metadata?.["avatar_url"] || user.user_metadata?.["picture"] || ""); setEmail(user.email || ""); })(); }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("No authenticated user.");
        const { data, error } = await supabase
          .from("user_settings")
          .select("spending_limits,savings_goals")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        const limits = parseSpendingLimits(data?.spending_limits);
        const goals = parseSavingsGoals(data?.savings_goals);
        if (active) {
          setSpendingLimits(limits);
          setSavingsGoals(goals);
        }
      } catch (error) {
        console.error("[Planning] Failed to load budgets and savings goals.", error);
        if (active) {
          setPlanningError(true);
          toast.error("Não foi possível carregar o planejamento. Verifique a migration de orçamento e metas no Supabase.");
        }
      } finally {
        if (active) setPlanningReady(true);
      }
    })();
    return () => { active = false; };
  }, []);
  const saveProfile = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { toast.error("Entre novamente na sua conta."); return; } if (profileName.trim().length < 2) { toast.error("Informe um nome com pelo menos 2 caracteres."); return; } setProfileBusy(true); try { const { error } = await supabase.from("user_profiles").upsert({ user_id: user.id, display_name: profileName.trim(), avatar_url: avatar }); if (error) throw error; const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: profileName.trim(), name: profileName.trim() } }); if (metadataError) throw metadataError; toast.success("Perfil atualizado."); window.dispatchEvent(new Event("profile-updated")); } catch (e) { console.error(e); toast.error("Não foi possível salvar seu perfil."); } finally { setProfileBusy(false); } };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensions[file.type];
    if (!extension) {
      toast.error("Selecione uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Entre novamente na sua conta.");
      return;
    }
    setProfileBusy(true);
    const path = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) {
        console.error("[Profile] Failed to upload avatar.", uploadError);
        const message = uploadError.message.toLowerCase();
        if (message.includes("bucket not found")) {
          toast.error("O armazenamento de fotos não está configurado. Aplique a migration 20261110000100_profile_avatars.sql no Supabase.");
        } else if (message.includes("row-level security") || message.includes("unauthorized")) {
          toast.error("O Supabase recusou o envio da foto. Verifique as políticas de acesso do bucket avatars.");
        } else {
          toast.error(`Não foi possível enviar a foto: ${uploadError.message}`);
        }
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: saveError } = await supabase.from("user_profiles").upsert({
        user_id: user.id,
        display_name: profileName.trim() || user.email?.split("@")[0] || "Usuário",
        avatar_url: data.publicUrl,
      });
      if (saveError) {
        console.error("[Profile] Avatar uploaded but profile could not be updated.", saveError);
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([path]);
        if (cleanupError) console.error("[Profile] Failed to remove unlinked avatar.", cleanupError);
        toast.error("A foto foi enviada, mas não foi possível salvá-la no perfil.");
        return;
      }
      setAvatar(data.publicUrl);
      toast.success("Foto de perfil atualizada.");
      window.dispatchEvent(new Event("profile-updated"));
    } catch (e) {
      console.error("[Profile] Unexpected avatar upload error.", e);
      toast.error("Ocorreu um erro inesperado ao enviar a foto.");
    } finally {
      setProfileBusy(false);
    }
  };
  const changePassword = async () => { if (newPassword.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; } if (newPassword !== confirmNewPassword) { toast.error("As senhas não coincidem."); return; } setProfileBusy(true); try { const { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) throw error; setNewPassword(""); setConfirmNewPassword(""); toast.success("Senha atualizada com sucesso."); } catch (e) { console.error(e); toast.error("Não foi possível alterar a senha."); } finally { setProfileBusy(false); } };
  const update = (id: string, patch: Record<string, string>) => setState((st) => ({ ...st, categories: st.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const del = (id: string) => {
    if (s.txs.some((t) => t.categoryId === id)) { toast.error("Categoria em uso por transações."); return; }
    if (spendingLimits.some((limit) => limit.categoryId === id)) { toast.error("Remova o limite mensal antes de excluir a categoria."); return; }
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
  const persistPlanning = async (limits: SpendingLimit[], goals: SavingsGoal[]) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error("No authenticated user.");
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      spending_limits: limits,
      savings_goals: goals,
    });
    if (error) throw error;
    setSpendingLimits(limits);
    setSavingsGoals(goals);
  };
  const savePlanning = async (limits: SpendingLimit[], goals: SavingsGoal[]) => {
    setPlanningBusy(true);
    try {
      await persistPlanning(limits, goals);
      setPlanningError(false);
      return true;
    } catch (error) {
      console.error("[Planning] Failed to save budgets and savings goals.", error);
      toast.error("Não foi possível salvar. Verifique se a migration de orçamento e metas foi aplicada.");
      return false;
    } finally {
      setPlanningBusy(false);
    }
  };
  const saveLimit = () => {
    const amountCents = Math.round(Number(limitValue) * 100);
    if (!selectedCategory || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      toast.error("Selecione uma categoria e informe um limite maior que zero.");
      return;
    }
    const next = [
      ...spendingLimits.filter((limit) => limit.categoryId !== selectedCategory),
      { categoryId: selectedCategory, amountCents },
    ];
    void savePlanning(next, savingsGoals).then((saved) => {
      if (saved) {
        setLimitValue("");
        toast.success("Limite mensal salvo.");
      }
    });
  };
  const saveGoal = () => {
    const targetCents = Math.round(Number(goalTarget) * 100);
    const trimmedName = goalName.trim();
    if (!trimmedName || !Number.isSafeInteger(targetCents) || targetCents <= 0) {
      toast.error("Informe o nome da meta e um valor-alvo maior que zero.");
      return;
    }
    const next = [...savingsGoals, { id: uid(), name: trimmedName, targetCents, savedCents: 0 }];
    void savePlanning(spendingLimits, next).then((saved) => {
      if (saved) {
        setGoalName("");
        setGoalTarget("");
        toast.success("Meta de economia criada.");
      }
    });
  };
  const addContribution = (goal: SavingsGoal) => {
    const amountCents = Math.round(Number(contributions[goal.id]) * 100);
    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      !Number.isSafeInteger(goal.savedCents + amountCents)
    ) {
      toast.error("Informe um valor para adicionar à meta.");
      return;
    }
    const next = savingsGoals.map((item) => item.id === goal.id
      ? { ...item, savedCents: item.savedCents + amountCents }
      : item);
    void savePlanning(spendingLimits, next).then((saved) => {
      if (saved) {
        setContributions((current) => ({ ...current, [goal.id]: "" }));
        toast.success("Progresso da meta atualizado.");
      }
    });
  };
  const currentMonth = monthKey(new Date());
  const monthlyExpenses = s.txs.filter((tx) => tx.type === "despesa" && tx.date.slice(0, 7) === currentMonth);
  const budgetRows = spendingLimits.map((limit) => {
    const category = s.categories.find((item) => item.id === limit.categoryId);
    const spentCents = monthlyExpenses
      .filter((tx) => tx.categoryId === limit.categoryId)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { ...limit, category, spentCents, progress: progressPercent(spentCents, limit.amountCents) };
  });

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
        <div className="mb-4 flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Orçamento e metas</h3>
            <p className="text-sm text-muted-foreground">Limites por categoria neste mês e objetivos de economia.</p>
          </div>
        </div>
        {planningError && (
          <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Planejamento indisponível. Aplique a migration 20261110000700_spending_limits_savings_goals.sql no Supabase e recarregue a página.
          </p>
        )}
        {!planningReady ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando orçamento e metas…</p>
        ) : !planningError && (
          <div className="space-y-6">
            <div>
              <h4 className="mb-3 font-medium">Limites mensais por categoria</h4>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  className="h-9 min-w-0 rounded-md border border-input bg-card px-3 text-sm"
                  aria-label="Categoria do limite"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  disabled={planningBusy || s.categories.length === 0}
                >
                  <option value="">Selecionar categoria</option>
                  {s.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={limitValue}
                  onChange={(event) => setLimitValue(event.target.value)}
                  placeholder="Limite mensal (R$)"
                  aria-label="Valor do limite mensal"
                  disabled={planningBusy}
                />
                <Button onClick={saveLimit} disabled={planningBusy || !selectedCategory}>Salvar limite</Button>
              </div>
              {budgetRows.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nenhum limite definido. Escolha uma categoria e um valor para acompanhar seus gastos.
                </p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {budgetRows.map((budget) => (
                    <div key={budget.categoryId} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {budget.category?.icon} {budget.category?.name ?? "Categoria removida"}
                        </span>
                        <span className={`text-xs font-medium ${budget.progress >= 100 ? "text-destructive" : "text-muted-foreground"}`}>
                          {brl(budget.spentCents)} de {brl(budget.amountCents)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir limite de ${budget.category?.name ?? "categoria"}`}
                          disabled={planningBusy}
                          onClick={() => void savePlanning(
                            spendingLimits.filter((item) => item.categoryId !== budget.categoryId),
                            savingsGoals,
                          )}
                        >
                          <Trash2 className="h-4 w-4 text-expense" />
                        </Button>
                      </div>
                      <Progress value={budget.progress} aria-label={`Orçamento usado: ${Math.round(budget.progress)}%`} />
                      {budget.progress >= 100 && (
                        <p className="mt-2 text-xs text-destructive">Limite mensal atingido ou ultrapassado.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-border pt-5">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Metas de economia</h4>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={goalName}
                  onChange={(event) => setGoalName(event.target.value)}
                  placeholder="Ex.: Viagem ou novo computador"
                  aria-label="Nome da meta"
                  disabled={planningBusy}
                />
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={goalTarget}
                  onChange={(event) => setGoalTarget(event.target.value)}
                  placeholder="Valor-alvo (R$)"
                  aria-label="Valor-alvo da meta"
                  disabled={planningBusy}
                />
                <Button onClick={saveGoal} disabled={planningBusy}>Criar meta</Button>
              </div>
              {savingsGoals.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Crie uma meta para acompanhar o progresso de uma compra ou viagem.
                </p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {savingsGoals.map((goal) => (
                    <div key={goal.id} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{goal.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {brl(goal.savedCents)} de {brl(goal.targetCents)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir meta ${goal.name}`}
                          disabled={planningBusy}
                          onClick={() => void savePlanning(
                            spendingLimits,
                            savingsGoals.filter((item) => item.id !== goal.id),
                          )}
                        >
                          <Trash2 className="h-4 w-4 text-expense" />
                        </Button>
                      </div>
                      <Progress
                        value={progressPercent(goal.savedCents, goal.targetCents)}
                        aria-label={`Meta concluída: ${Math.round(progressPercent(goal.savedCents, goal.targetCents))}%`}
                      />
                      <div className="mt-3 flex gap-2">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={contributions[goal.id] ?? ""}
                          onChange={(event) => setContributions((current) => ({
                            ...current,
                            [goal.id]: event.target.value,
                          }))}
                          placeholder="Adicionar valor (R$)"
                          aria-label={`Valor para adicionar à meta ${goal.name}`}
                          disabled={planningBusy}
                        />
                        <Button variant="outline" onClick={() => addContribution(goal)} disabled={planningBusy}>
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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
