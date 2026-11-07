const CACHE_NAME = 'shouba-gym-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap'
];

// تثبيت التخزين المؤقت للملفات الأساسية
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// تفعيل الخدمة وتنظيف الكاش القديم عند التحديث
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// التعامل مع الطلبات (التحميل أوفلاين)
self.addEventListener('fetch', (event) => {
    // نتجاوز طلبات الـ API السحابية لكي تذهب للـ localStorage مباشرة عند انقطاع النت
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).catch(() => {
                // إذا كان الطلب عبارة عن صفحة HTML ولم يتوفر نت ولا كاش
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
