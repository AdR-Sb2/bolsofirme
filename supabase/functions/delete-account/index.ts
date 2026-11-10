import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function removeUserFiles(
  client: SupabaseClient,
  bucket: string,
  folder: string,
): Promise<void> {
  const files: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(folder, { limit: 1000, offset });
    if (error) {
      if (error.message.toLowerCase().includes("bucket not found")) return;
      throw error;
    }
    for (const entry of data ?? []) {
      const path = `${folder}/${entry.name}`;
      if (entry.id === null) await removeUserFiles(client, bucket, path);
      else files.push(path);
    }
    if (!data || data.length < 1000) break;
    offset += data.length;
  }
  for (let index = 0; index < files.length; index += 100) {
    const { error: removeError } = await client.storage
      .from(bucket)
      .remove(files.slice(index, index + 100));
    if (removeError) throw removeError;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Authentication required." }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[delete-account] Required Supabase environment variables are missing.");
    return Response.json({ error: "Account deletion is not configured." }, { status: 503, headers: corsHeaders });
  }

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "Invalid authentication." }, { status: 401, headers: corsHeaders });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const bucket of ["avatars", "transaction-receipts"]) {
    try {
      await removeUserFiles(adminClient, bucket, user.id);
    } catch (storageError) {
      console.error(`[delete-account] Failed to remove user files from ${bucket}.`, storageError);
      return Response.json(
        { error: "Could not remove account files. The account was not deleted." },
        { status: 500, headers: corsHeaders },
      );
    }
  }
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[delete-account] Failed to delete the authenticated account.", deleteError);
    return Response.json({ error: "Could not delete the account." }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ success: true }, { status: 200, headers: corsHeaders });
});
