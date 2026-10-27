export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // 1. جلب جميع المشتركين (GET) عند فتح الصفحة
    if (method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM members").all();
        return Response.json(results);
    }

    // 2. إضافة أو تحديث مشترك (POST) عند الحفظ أو التجديد
    if (method === 'POST') {
        const data = await request.json();
        await env.DB.prepare(`
            INSERT INTO members (id, name, phone, plan, price, startDate, endDate, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                phone=excluded.phone,
                plan=excluded.plan,
                price=excluded.price,
                startDate=excluded.startDate,
                endDate=excluded.endDate,
                notes=excluded.notes
        `).bind(
            data.id, data.name, data.phone, data.plan, 
            data.price, data.startDate, data.endDate, data.notes
        ).run();

        return Response.json({ success: true });
    }

    // 3. حذف مشترك (DELETE) عند الضغط على زر الحذف
    if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        await env.DB.prepare("DELETE FROM members WHERE id = ?").bind(id).run();
        return Response.json({ success: true });
    }

    return new Response('Method not allowed', { status: 405 });
}
