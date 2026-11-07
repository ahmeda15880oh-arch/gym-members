// Cloudflare Pages Function: /api/members
// Uses the existing D1 binding named DB and the existing members table as-is.

function normalizeMonths(value) {
    let parsed = value;

    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            parsed = [];
        }
    }

    if (!Array.isArray(parsed)) parsed = [];

    return JSON.stringify(
        Array.from({ length: 12 }, (_, index) => parsed[index] ?? "")
    );
}

function jsonError(message, status = 500) {
    return Response.json({ success: false, error: message }, { status });
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (!env.DB) {
        return jsonError("لم يتم العثور على ربط قاعدة البيانات DB في إعدادات Cloudflare.", 500);
    }

    // Read members from the existing D1 table.
    if (method === "GET") {
        try {
            const { results = [] } = await env.DB
                .prepare(`
                    SELECT id, name, phone, durationNum, durationUnit,
                           plan, price, startDate, endDate, months
                    FROM members
                `)
                .all();

            return Response.json(results);
        } catch (error) {
            return jsonError(error?.message || "تعذر جلب بيانات المشتركين.");
        }
    }

    // Insert or update one member. ON CONFLICT makes retries safe (no duplicates).
    if (method === "POST") {
        try {
            const data = await request.json();

            if (!data || data.id === undefined || data.id === null || String(data.id).trim() === "") {
                return jsonError("معرّف المشترك مطلوب.", 400);
            }
            if (!data.name || String(data.name).trim() === "") {
                return jsonError("اسم المشترك مطلوب.", 400);
            }

            const id = String(data.id);
            const durationNum = Number.parseInt(data.durationNum, 10) || 1;
            const durationUnit = String(data.durationUnit || "months");
            const price = Number(data.price) || 0;
            const months = normalizeMonths(data.months);

            await env.DB.prepare(`
                INSERT INTO members (
                    id, name, phone, durationNum, durationUnit,
                    plan, price, startDate, endDate, months
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    phone = excluded.phone,
                    durationNum = excluded.durationNum,
                    durationUnit = excluded.durationUnit,
                    plan = excluded.plan,
                    price = excluded.price,
                    startDate = excluded.startDate,
                    endDate = excluded.endDate,
                    months = excluded.months
            `).bind(
                id,
                String(data.name).trim(),
                data.phone == null ? "" : String(data.phone),
                durationNum,
                durationUnit,
                data.plan == null ? "" : String(data.plan),
                price,
                data.startDate == null ? "" : String(data.startDate),
                data.endDate == null ? "" : String(data.endDate),
                months
            ).run();

            return Response.json({
                success: true,
                id,
                message: "تم حفظ بيانات المشترك بنجاح"
            });
        } catch (error) {
            return jsonError(error?.message || "تعذر حفظ بيانات المشترك.");
        }
    }

    // Delete is idempotent, so retrying a queued deletion is safe.
    if (method === "DELETE") {
        try {
            const id = url.searchParams.get("id");
            if (!id) return jsonError("معرّف المشترك مطلوب.", 400);

            await env.DB
                .prepare("DELETE FROM members WHERE id = ?")
                .bind(String(id))
                .run();

            return Response.json({
                success: true,
                id,
                message: "تم حذف المشترك بنجاح"
            });
        } catch (error) {
            return jsonError(error?.message || "تعذر حذف المشترك.");
        }
    }

    return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, POST, DELETE" }
    });
}
