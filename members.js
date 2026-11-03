
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // تجهيز بيانات المربعات الـ12 للحفظ
    function normalizeMonths(value) {
        const emptyMonths = Array(12).fill(null);

        if (Array.isArray(value)) {
            return JSON.stringify(
                Array.from({ length: 12 }, (_, i) => value[i] ?? null)
            );
        }

        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);

                if (Array.isArray(parsed)) {
                    return JSON.stringify(
                        Array.from({ length: 12 }, (_, i) => parsed[i] ?? null)
                    );
                }
            } catch (error) {
                // إذا كانت البيانات غير صالحة نستخدم مصفوفة فارغة
            }
        }

        return JSON.stringify(emptyMonths);
    }

    // 1. جلب جميع المشتركين
    if (method === "GET") {
        const { results } = await env.DB
            .prepare("SELECT * FROM members")
            .all();

        return Response.json(results);
    }

    // 2. إضافة أو تحديث مشترك
    if (method === "POST") {
        try {
            const data = await request.json();

            const months = normalizeMonths(data.months);

            // إذا لم يوجد تاريخ أساسي، نستخدم تاريخ نهاية الاشتراك
            const attendanceBaseEndDate =
                data.attendanceBaseEndDate || data.endDate;

            await env.DB.prepare(`
                INSERT INTO members (
                    id,
                    name,
                    phone,
                    plan,
                    price,
                    startDate,
                    endDate,
                    notes,
                    months,
                    attendanceBaseEndDate
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    phone = excluded.phone,
                    plan = excluded.plan,
                    price = excluded.price,
                    startDate = excluded.startDate,
                    endDate = excluded.endDate,
                    notes = excluded.notes,
                    months = excluded.months,
                    attendanceBaseEndDate = excluded.attendanceBaseEndDate
            `).bind(
                data.id,
                data.name,
                data.phone,
                data.plan,
                data.price,
                data.startDate,
                data.endDate,
                data.notes || "",
                months,
                attendanceBaseEndDate
            ).run();

            return Response.json({
                success: true,
                message: "تم حفظ بيانات المشترك بنجاح"
            });

        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }
    }

    // 3. حذف مشترك
    if (method === "DELETE") {
        try {
            const id = url.searchParams.get("id");

            if (!id) {
                return Response.json({
                    success: false,
                    error: "معرّف المشترك مطلوب"
                }, { status: 400 });
            }

            await env.DB
                .prepare("DELETE FROM members WHERE id = ?")
                .bind(id)
                .run();

            return Response.json({
                success: true,
                message: "تم حذف المشترك بنجاح"
            });

        } catch (error) {
            return Response.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }
    }

    return new Response("Method not allowed", {
        status: 405
    });
}
