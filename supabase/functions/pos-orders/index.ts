import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const brands = new Set(["sakura", "mandala"]);
const allowedOrigin = (origin: string) => !origin || origin === "https://ventasonlinesushi.github.io" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[\d.]+(:\d+)?$/.test(origin);
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value)).map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const normalizePhone = (value: unknown) => {
  const digits = clean(value, 40).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin(origin) ? (origin || "null") : "null",
    "Access-Control-Allow-Headers": "content-type,x-pos-token,x-pos-receiver,x-idempotency-key,apikey,authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
  const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return allowedOrigin(origin) ? new Response(null, { status: 204, headers }) : send({ error: "Origen no permitido" }, 403);
  if (request.method !== "POST" || !allowedOrigin(origin)) return send({ error: "No permitido" }, 403);
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return send({ error: "JSON inválido" }, 400); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (body.action === "health") return send({ ok: true, version: "1.2.0" });

  if (body.action === "public.submit") {
    const marca = clean(body.marca, 20).toLowerCase();
    if (!brands.has(marca)) return send({ error: "Restaurante inválido" }, 400);
    if (clean(body.website, 20)) return send({ error: "Solicitud inválida" }, 400);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 80) return send({ error: "El pedido no contiene productos válidos" }, 400);
    const phone = normalizePhone(body.phone);
    if (phone.length !== 10) return send({ error: "Escribe un teléfono válido de 10 dígitos" }, 400);
    const address = clean(body.address, 500);
    if (address.length < 5) return send({ error: "Escribe la dirección de entrega" }, 400);
    const payment = clean(body.payment, 50).toLowerCase().includes("transf") ? "Transferencia" : "Efectivo";
    const items = body.items.map((item: any) => ({
      key: clean(item.key, 100), name: clean(item.name, 180), qty: Math.max(1, Math.min(99, Number(item.qty) || 1)),
      price: Math.max(0, Math.min(10000, Number(item.price) || 0)), desc: clean(item.desc, 500), package_detail: item.package_detail || null,
    }));
    if (items.some((item: any) => !item.name)) return send({ error: "Hay un producto sin nombre" }, 400);
    const total = Number(items.reduce((sum: number, item: any) => sum + item.qty * item.price, 0).toFixed(2));
    if (total <= 0 || total > 100000) return send({ error: "Total de pedido inválido" }, 400);
    const { data: next, error: folioError } = await db.rpc("next_pos_folio", { p_marca: marca });
    if (folioError) return send({ error: "No se pudo generar el folio" }, 500);
    const folio = String(next).padStart(4, "0");
    const customerName = clean(body.name, 150);
    const row = { folio, name: customerName, phone, order_type: "domicilio", address, payment, notes: clean(body.notes, 1000), salsas: clean(body.salsas, 200), palitos: clean(body.palitos, 100), items, total, status: "nuevo", payment_status: "pendiente", marca };
    const { data, error } = await db.from("orders").insert(row).select("id,folio,created_at,total,status,marca").single();
    if (error) return send({ error: "No se pudo registrar el pedido" }, 500);
    const { data: loyaltyRows, error: loyaltyError } = await db.rpc("register_loyalty_visit", { p_marca: marca, p_phone: phone, p_name: customerName });
    if (loyaltyError) {
      await db.from("orders").delete().eq("id", data.id);
      return send({ error: "No se pudo registrar la visita" }, 500);
    }
    const loyalty = Array.isArray(loyaltyRows) ? loyaltyRows[0] : loyaltyRows;
    return send({ data: { ...data, loyalty } }, 201);
  }

  if (body.action === "receiver.list" || body.action === "receiver.update") {
    const rawReceiver = request.headers.get("x-pos-receiver") || "";
    if (!rawReceiver) return send({ error: "Receptor no autorizado" }, 401);
    const { data: receiver } = await db.from("pos_receivers").select("id,marca,activo").eq("token_hash", await sha256(rawReceiver)).eq("activo", true).maybeSingle();
    if (!receiver) return send({ error: "Receptor no autorizado" }, 401);
    await db.from("pos_receivers").update({ last_seen_at: new Date().toISOString() }).eq("id", receiver.id);
    if (body.action === "receiver.list") {
      const limit = Math.max(1, Math.min(100, Number(body.limit) || 50));
      const { data, error } = await db.from("orders").select("*").eq("marca", receiver.marca).eq("status", "nuevo").order("created_at", { ascending: true }).limit(limit);
      return error ? send({ error: error.message }, 500) : send({ data });
    }
    const id = clean(body.id, 60), status = clean(body.status, 30);
    if (!id || !["recibido", "nuevo"].includes(status)) return send({ error: "Actualización inválida" }, 400);
    const { data, error } = await db.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("marca", receiver.marca).eq("status", "nuevo").select("id,status,marca").maybeSingle();
    return error ? send({ error: error.message }, 409) : !data ? send({ error: "Pedido no disponible" }, 404) : send({ data });
  }

  const rawToken = request.headers.get("x-pos-token") || "";
  if (!rawToken) return send({ error: "Sesión requerida" }, 401);
  const { data: session } = await db.from("pos_sessions").select("usuario_id,marca").eq("token_hash", await sha256(rawToken)).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return send({ error: "Sesión vencida" }, 401);
  const { data: user } = await db.from("usuarios").select("username,nombre,rol,activo,marcas").eq("id", session.usuario_id).maybeSingle();
  if (!user?.activo || !(user.marcas || []).includes(session.marca)) return send({ error: "No autorizado" }, 403);
  const marca = session.marca;
  const employee = user.nombre || user.username;

  if (body.action === "list") {
    const limit = Math.max(1, Math.min(2000, Number(body.limit) || 500));
    let query = db.from("orders").select("*").eq("marca", marca).order("created_at", { ascending: false }).limit(limit);
    if (Array.isArray(body.statuses) && body.statuses.length) query = query.in("status", body.statuses.map((x: unknown) => clean(x, 30)));
    if (body.from) query = query.gte("created_at", clean(body.from, 50));
    const { data, error } = await query;
    return error ? send({ error: error.message }, 500) : send({ data });
  }
  if (body.action === "create") {
    const item = body.order || {};
    if (!Array.isArray(item.items) || !item.items.length) return send({ error: "Agrega productos" }, 400);
    const { data: next, error: folioError } = await db.rpc("next_pos_folio", { p_marca: marca });
    if (folioError) return send({ error: folioError.message }, 500);
    const row = { ...item, id: undefined, marca, folio: String(next).padStart(4, "0"), status: clean(item.status, 30) || "nuevo", payment_status: clean(item.payment_status, 30) || "pendiente", updated_at: new Date().toISOString() };
    const { data, error } = await db.from("orders").insert(row).select().single();
    if (!error) await db.from("pos_audit_events").insert({ marca, order_id: data.id, event_type: "pedido_creado_pos", employee, after_data: data });
    return error ? send({ error: error.message }, 400) : send({ data }, 201);
  }
  if (body.action === "update") {
    const id = clean(body.id, 60);
    const allowed = ["name", "phone", "order_type", "address", "payment", "notes", "salsas", "palitos", "items", "total", "status", "payment_status", "print_status", "print_details", "discount_total", "surcharge_total", "tip_total"];
    const changes: Record<string, unknown> = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body.changes || {}, key)) changes[key] = body.changes[key];
    if (!id || !Object.keys(changes).length) return send({ error: "Cambio inválido" }, 400);
    if (changes.status === "cobrado") return send({ error: "Usa la pantalla Cobrar para cerrar la cuenta" }, 400);
    const before = (await db.from("orders").select("*").eq("id", id).eq("marca", marca).maybeSingle()).data;
    if (!before) return send({ error: "Pedido no encontrado en este restaurante" }, 404);
    const { data, error } = await db.from("orders").update({ ...changes, updated_at: new Date().toISOString(), version: Number(before.version || 1) + 1 }).eq("id", id).eq("marca", marca).select().single();
    if (!error) await db.from("pos_audit_events").insert({ marca, order_id: id, event_type: "pedido_actualizado", employee, before_data: before, after_data: data });
    return error ? send({ error: error.message }, 409) : send({ data });
  }
  return send({ error: "Acción no encontrada" }, 404);
});
