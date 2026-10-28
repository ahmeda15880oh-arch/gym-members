export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // التحقق من أن ربط قاعدة البيانات موجود
    if (!env || !env.DB) {
        return new Response(JSON.stringify({ error: "Database binding 'DB' is missing" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        if (method === 'GET') {
            const { results } = await env.DB.prepare("SELECT * FROM members").all();
            return Response.json(results || []);
        }

        if (method === 'POST') {
            const data = await request.json();
            
            // محاولة إضافة الأعمدة تلقائياً إن لم تكن موجودة لتجنب أي انهيار
            try { await env.DB.prepare("ALTER TABLE members ADD COLUMN months TEXT").run(); } catch (e) {}
            try { await env.DB.prepare("ALTER TABLE members ADD COLUMN durationNum INTEGER").run(); } catch (e) {}
            try { await env.DB.prepare("ALTER TABLE members ADD COLUMN durationUnit TEXT").run(); } catch (e) {}

            await env.DB.prepare(`
                INSERT INTO members (id, name, phone, durationNum, durationUnit, plan, price, startDate, endDate, months)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    phone=excluded.phone,
                    durationNum=excluded.durationNum,
                    durationUnit=excluded.durationUnit,
                    plan=excluded.plan,
                    price=excluded.price,
                    startDate=excluded.startDate,
                    endDate=excluded.endDate,
                    months=excluded.months
            `).bind(
                data.id || String(Date.now()),
                data.name || '',
                data.phone || '',
                data.durationNum || 1,
                data.durationUnit || 'months',
                data.plan || '',
                data.price || 0,
                data.startDate || '',
                data.endDate || '',
                typeof data.months === 'string' ? data.months : JSON.stringify(data.months || Array(12).fill(''))
            ).run();

            return Response.json({ success: true });
        }

        if (method === 'DELETE') {
            const id = url.searchParams.get('id');
            if (id) {
                await env.DB.prepare("DELETE FROM members WHERE id = ?").bind(id).run();
            }
            return Response.json({ success: true });
        }

        return new Response('Method not allowed', { status: 405 });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
