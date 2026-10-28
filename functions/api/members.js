export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM members").all();
        return Response.json(results);
    }

    if (method === 'POST') {
        const data = await request.json();
        
        // التحقق من وجود جدول قاعدة البيانات وتحديثه إن لم يكن يحتوي على حقل months
        try {
            await env.DB.prepare("ALTER TABLE members ADD COLUMN months TEXT").run();
        } catch (e) {
            // الحقل موجود مسبقاً
        }

        await env.DB.prepare(`
            INSERT INTO members (id, name, phone, plan, price, startDate, endDate, months)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                phone=excluded.phone,
                plan=excluded.plan,
                price=excluded.price,
                startDate=excluded.startDate,
                endDate=excluded.endDate,
                months=excluded.months
        `).bind(
            data.id, data.name, data.phone, data.plan, 
            data.price, data.startDate, data.endDate, data.months
        ).run();

        return Response.json({ success: true });
    }

    if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        await env.DB.prepare("DELETE FROM members WHERE id = ?").bind(id).run();
        return Response.json({ success: true });
    }

    return new Response('Method not allowed', { status: 405 });
}
