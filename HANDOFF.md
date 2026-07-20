# Election Calendar — تعليمات التسليم

مشروع Next.js (App Router) جاهز، بيحقق Phase 1 Scope بالظبط زي ما اتفقنا مع لانس. مفيش أي AI Vision في الكود.

## ✅ سؤال لازم تسأليه للانس قبل الخطوة الأولى
هل نستخدم **مشروع Supabase منفصل** لكالندر الأرشيف ده، ولا **نفس مشروع Supabase** الموجود في الموقع الرئيسي؟
- الأفضل تقنيًا: مشروع منفصل — نظافة وفصل واضح، ومفيش خطر إن upload كتير على bucket جديد يأثر على أي حاجة تانية شغالة على الموقع الأصلي.
- لو قال يستخدم نفس المشروع، الخطوات تحت لسه صالحة، بس هتضيفي الجدول والـ bucket على نفس المشروع الموجود بدل ما تعملي واحد جديد.

## 1) إعداد Supabase
1. من [supabase.com](https://supabase.com) اعملي مشروع جديد (أو افتحي الموجود لو القرار كان نفس المشروع).
2. من **SQL Editor** شغّلي المحتوى اللي في `supabase/setup.sql` — بيعمل جدول `archive_entries` بس (day, place, image_url).
3. من **Storage → New bucket** اعملي bucket اسمه بالظبط: `kalshi-screenshots`، وحطيه **Public**.
   - لو الصور دي حساسة ومش عايزة تبقى متاحة لأي حد معاه اللينك، قوليلي وأنا أحول الكود لـ signed URLs بدل public.
4. من **Project Settings → API** هتلاقي:
   - `Project URL` → ده `SUPABASE_URL`
   - `service_role` key (تحت "Project API keys", مش الـ anon key) → ده `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ الـ service_role key ده سري جدًا (بيتخطى كل الـ RLS)، متحطيهوش أبدًا في كود بيتبعت للمتصفح — هو مستخدم بس جوه API routes على السيرفر، وده بالظبط اللي الكود عامله.

## 2) تشغيل محلي (اختياري، للتجربة قبل النشر)
```bash
cp .env.example .env.local
# افتحي .env.local وحطي القيم اللي جبتيها من Supabase
npm install
npm run dev
```

## 3) رفع الكود على GitHub (`blueloodtech/election-calendar`)
```bash
cd election-calendar
git init
git add .
git commit -m "Phase 1: calendar grid, manual upload, Supabase storage"
git branch -M main
git remote add origin https://github.com/blueloodtech/election-calendar.git
git push -u origin main
```
ملحوظة: `.gitignore` جاهز أصلاً بيستبعد `node_modules` و `.env*.local`، فمفيش خطر إنك تسربي المفاتيح بالغلط.

## 4) إعداد Vercel
1. Vercel هيكتشف إنه Next.js أوتوماتيك بعد أول push (زي ما هو متوقع في الـ setup الحالي).
2. قبل الـ deploy، روحي على **Project Settings → Environment Variables** وضيفي:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. اعملي Deploy.

## 5) ربط الـ subdomain `calendar.electionnightclub.com`
1. في Vercel: **Project Settings → Domains** → ضيفي `calendar.electionnightclub.com`.
2. Vercel هيديكي CNAME record (غالبًا `cname.vercel-dns.com`).
3. في Cloudflare (على الدومين الرئيسي `electionnightclub.com`): ضيفي CNAME record:
   - Name: `calendar`
   - Target: القيمة اللي Vercel اديها
   - Proxy status: **DNS only** (السحابة الرمادية مش البرتقالي) — مهم عشان Vercel يقدر يصدر SSL certificate صح.
4. استني كام دقيقة للـ DNS propagation، وVercel هيتحقق تلقائي ويفعّل الـ SSL.

## حدود مهمة اتحطت عمدًا داخل السكوب
- الرفع يدوي بس (drag-drop أو ضغط) — مفيش أي قراءة تلقائية لمحتوى الصورة.
- حجم أقصى للصورة **4MB** — ده حد Vercel نفسه لـ request body على باقة Hobby (4.5MB)، مش قرار مننا.
- الصورة بتتحفظ باسم `{day}/{place}-{timestamp}.{ext}` جوه الـ bucket، والجدول بيحفظ اليوم + المكان (1st / 2nd&3rd) + رابط الصورة، بـ unique constraint على (day, place) — يعني لو رفعتي صورة جديدة لنفس اليوم ونفس المكان، بتتسجل صف جديد لكن القديم مش بيتمسح تلقائيًا من الـ Storage (ده حاجة نضيفها لو حبيت تنضيف تلقائي لاحقًا).
