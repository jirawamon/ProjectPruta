# Smart City Map - เทศบาลตำบลพลูตาหลวง

ระบบแผนที่เมืองอัจฉริยะสำหรับติดตามอุปกรณ์สาธารณะในพื้นที่ พร้อมหน้ารายละเอียดอุปกรณ์ การเพิ่มตำแหน่งใหม่ และระบบแจ้งซ่อม/ร้องเรียน

## ภาพรวมระบบ

โปรเจกต์นี้พัฒนาด้วย React + TypeScript + Vite โดยใช้ Leaflet แสดงแผนที่ และรองรับการเชื่อมต่อ Supabase สำหรับบันทึกข้อมูลจริง

ความสามารถหลัก

- แผนที่อุปกรณ์สาธารณะ (ไฟส่องสว่าง, Wi-Fi, หัวดับเพลิง)
- แสดง Marker, Popup, และสถานะอุปกรณ์
- เพิ่มตำแหน่งอุปกรณ์ใหม่ผ่านแผนที่
- หน้ารายละเอียดอุปกรณ์แบบรวมศูนย์ด้วยคอมโพเนนต์เดียว
- แจ้งซ่อม/ร้องเรียน และบันทึกเข้า Supabase
- รองรับเส้นทางด้วย React Router (Back button และ deep link)
- มี Vercel Analytics และ Speed Insights

## Tech Stack

- React 18
- TypeScript (strict)
- Vite
- Leaflet
- React Router DOM
- Supabase JS
- Papa Parse (อ่าน CSV)
- Lucide React (icons)
- Vercel Analytics / Speed Insights

## โครงสร้างโปรเจกต์

ไฟล์สำคัญที่ควรรู้

- src/App.tsx: โครงแอปหลัก, routing, data flow
- src/CityMap.tsx: แผนที่ Leaflet, marker, popup, layer logic
- src/DeviceDetail.tsx: หน้ารายละเอียดอุปกรณ์แบบ generic
- src/lib/data.ts: service สำหรับอ่านข้อมูลและบันทึกลงฐานข้อมูล
- src/lib/supabase.ts: Supabase client + types
- src/types.ts: Domain model ทั้งระบบ
- src/status.ts: มาตรฐานสถานะอุปกรณ์และสี
- src/main.tsx: React entrypoint และ global providers

## เริ่มต้นใช้งาน

1. ติดตั้ง dependencies

```bash
npm install
```

2. รันในโหมดพัฒนา

```bash
npm run dev
```

3. เปิด URL ที่ Vite แสดงในเทอร์มินัล (ปกติเป็น http://localhost:5173)

## Environment Variables

สร้างไฟล์ .env ใน root ของโปรเจกต์ (ถ้ายังไม่มี)

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_COMPLAINT_BUCKET=complaint-images
```

หมายเหตุ

- ถ้าไม่ตั้งค่า Supabase ระบบจะแสดงข้อมูลจากแหล่งข้อมูลเดิมได้ตามปกติ
- ฟังก์ชันบันทึกลงฐานข้อมูลจะถูกข้ามโดยอัตโนมัติเมื่อ env ไม่ครบ
- สำหรับระบบแนบรูป complaint สามารถเปลี่ยนชื่อ bucket ได้ด้วย `VITE_SUPABASE_COMPLAINT_BUCKET`

## Supabase Migration (ระบบแนบรูป)

มีไฟล์ migration สำหรับเพิ่มคอลัมน์รูปและตั้งค่า Storage แล้วที่:

- supabase/migrations/20260401_add_complaint_image_and_storage.sql

สิ่งที่ migration นี้ทำ:

- เพิ่มคอลัมน์ `public.complaints.image_url` (ถ้ายังไม่มี)
- สร้าง bucket `complaint-images` (public) ถ้ายังไม่มี
- ตั้งข้อจำกัดไฟล์: ไม่เกิน 5MB และรองรับ `image/jpeg`, `image/png`, `image/webp`
- สร้าง policy สำหรับอัปโหลด/แก้ไข/ลบไฟล์ใน bucket นี้

การรัน migration:

- ผ่าน Supabase SQL Editor: คัดลอก SQL ในไฟล์แล้วรัน
- หรือใช้ Supabase CLI (ถ้าติดตั้ง): `supabase db push`

## คำสั่งที่ใช้บ่อย

```bash
npm run dev        # Development server
npm run typecheck  # ตรวจ TypeScript
npm run lint       # ตรวจ lint
npm run build      # Build production
npm run preview    # Preview build
```

## การ Deploy

แนะนำ deploy บน Vercel

1. Push โค้ดขึ้น repository
2. เชื่อมโปรเจกต์กับ Vercel
3. ตั้งค่า Environment Variables ในหน้า Project Settings
4. Deploy แล้วเปิดใช้งานหน้าเว็บ

หลัง deploy แล้ว ระบบ Analytics และ Speed Insights จะเริ่มเก็บข้อมูลเมื่อมีการเข้าใช้งานจริง

## แนวทางพัฒนาเพิ่มเติม

- เพิ่ม authentication/role-based access
- เพิ่ม table migration และ seed สำหรับ Supabase
- เพิ่ม unit test ให้ data mappers และ integration test ด้าน routing/map
- เพิ่ม error boundary และระบบแจ้งเตือนแบบ toast แทน alert

## License

Internal project for municipal operations and development use.
