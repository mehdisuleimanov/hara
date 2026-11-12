# Hara? — Hakaton demosu: spec + icra planı

## 0. Kontekst
Hara? Bakıda A nöqtəsindən B nöqtəsinə ən sürətli yolu yox, **ən az riskli** yolu göstərən mobil tətbiqdir. Bu tətbiqin hakaton demosu **sabah, 13 noyabr 2026**-da göstəriləcək. Məqsəd funksiyaları münsiflərə inandırıcı şəkildə göstərməkdir. Real məhsul hələ qurulmur: **backend yoxdur, tətbiq yalnız frontend-dən ibarətdir və saxta, amma şişirdilməmiş data ilə işləyir.** Yeganə real AI hissəsi Əhməddir, o da Gemini ilə işləyir. Kodun çoxunu Claude yazır, istifadəçi tətbiqi Android telefonda yoxlayır.

Mənbələr: `Hara 2.0 - final konsepsiya.md` və 13 maket. Maketlər vizual istiqamət verir, amma onları dəqiq köçürmək tələb olunmur.

---

## 1. Spec xülasəsi

### Məhsul və istifadəçilər
- **Kim üçündür:** piyadalar, əlil arabası istifadəçiləri, yaşlılar, uşaq arabalı valideynlər, velosiped və skuter sürənlər, ailələr.
- **Məhsulun özəyi:** "Bakı Təhlükəsizlik Qatı". Hər keçid və küçə üçün gecə və gündüz ayrıca 0–100 bal verilir. Marşrutun balı onun ən zəif nöqtəsinin balına bərabərdir ("zəncirin ən zəif halqası").
- **Demonun ən vacib anları:** (1) Əhmədə səslə sorğu verilir, 3 kart çıxır və Əhməd seçimini izah edir; (2) gecə və gündüz düyməsi basılanda xəritə və marşrut dəyişir; (3) skuter rejimində külək güclənəndə marşrut başqa küçəyə keçir.

### v1-ə daxil olanlar (hamısı demo səviyyəsində)
| Funksiya | Nə real, nə saxta |
|---|---|
| Təhlükəsizlik Qatı xəritəsi (bütün Bakı) | Keçidlər və küçələr OSM-dəki real koordinatlardadır. Bal sadə qaydalarla verilir və saxtadır. |
| Təhlükəsiz marşrut, 3 kart: Ən təhlükəsiz, Ən sərfəli, Ən sürətli | Marşrut xətləri real küçələrlə gedir və əvvəlcədən hazırlanıb. Vaxt, qiymət, bal və CO₂ saxtadır. |
| Tam multimodal: piyada, metro, avtobus, taksi | Metro stansiyalarının koordinatları realdır. Cədvəl, avtobus xətti və taksi tarifi saxtadır. |
| Əhməd (səs və mətn) | **Real Gemini.** Əhməd niyyəti anlayır, hazır ssenarini seçir və izah edir. Cavab gəlməsə, avtomatik ehtiyat ssenari işə düşür. |
| Əhməd danışır | Telefonun öz TTS-i (expo-speech) ilə. Azərbaycan dili səsi yoxdursa, türk səsi istifadə olunur. |
| Əlçatan rejim | Pilləkənsiz marşrutun addımları göstərilir. Lift statusu saxtadır. "Metro müşayiətini sifariş et" düyməsi saxta təsdiq göstərir. |
| Skuter və velosiped rejimi | Külək datası saxtadır və demo sürüşkəni ilə dəyişdirilir. Qasırğa 17 m/s-dən güclü olanda skuter variantı gizlədilir. |
| Canlı naviqasiya | Hərəkət simulyasiya olunur: istifadəçinin nöqtəsi marşrut boyunca sürətlə gedir. Manevr banneri, təhlükə xəbərdarlığı, TTS və vibrasiya var. |
| Bildir və xal sistemi | 6 kateqoriya və səsli bildiriş var. Səsli bildirişi Gemini təsnif edir. "AI yoxlayır" mərhələsi saxtadır, sonra +10 xal verilir və xəritədə marker çıxır. |
| Profil | Xal, səviyyə, statistika, həftəlik qrafik və nişanlar göstərilir. Hamısı saxta datadır, yeni bildirişlər xal sayına əlavə olunur. |
| Ailə paketi (ödənişli) | Ödəniş pəncərəsi saxtadır. Ailə panelində Murad və Nənə var. Nənənin nöqtəsi marşrut boyunca hərəkət edir, çatanda lokal bildiriş gəlir. SOS düyməsi saxta təsdiq göstərir. |

### v1-ə daxil OLMAYANLAR
Backend və verilənlər bazası. Hesab və giriş. Real ödəniş. Real GPS izləmə. Push bildirişləri. WhatsApp və Telegram botu. "AI Analiz Mərkəzi" admin paneli (yalnız slaydda olacaq). iOS-da test. Real avtobus cədvəli və taksi API-si. Görüntülərdən VLM ilə atribut çıxarılması.

### Əsas axınlar
1. **Yol (ana səhifə):** salamlama, axtarış sətri və mikrofon, rejim düymələri (Gündəlik, Əlçatan, Ailə, Skuter), gecə rejimi kartı, hava, son yerlər, yaxınlıqdakı bildirişlər.
2. **Əhməd:** mikrofona basılır və səs yazılır, dalğa animasiyası görünür. Sonra Gemini sorğuya cavab verir və istifadəçinin cümləsi ekranda yazılır. Ardınca Nəticə ekranı açılır və Əhməd izahını səsli oxuyur.
3. **Nəticə:** xəritədə marşrut xətləri, 3 kart (təhlükəsizlik halqası, vaxt, qiymət, CO₂, xəbərdarlıqlar), "Əhmədin tövsiyəsi" və "Yola düş" düyməsi. Bu düymə Canlı naviqasiyanı açır.
4. **Xəritə:** Təhlükəsizlik Qatı, gecə və gündüz düyməsi, bildiriş markerləri. Markerə toxunanda alt panel açılır: "Hələ də var" və ya "Artıq yoxdur" seçilir, hər səs +2 xal verir.
5. **Bildir:** kateqoriya seçilir və ya səslə deyilir. Sonra "AI yoxlayır…" görünür, ardınca "AI təsdiqlədi 94%" və +10 xal verilir. Marker xəritəyə düşür.
6. **Əlçatan, Skuter, Ailə:** ana səhifədəki rejim düymələrindən açılır.
7. **Gizli demo paneli:** "Hara?" loqosuna uzun basanda açılır. Burada gecə və gündüz rejimini məcburi dəyişmək, külək sürüşkəni, AI-ni söndürmək (ehtiyat rejim), naviqasiya sürəti, "Nənə çatdı" bildirişini işə salmaq, vəziyyəti sıfırlamaq və hazır cümləni göndərmək olur.

### Data modeli (TypeScript tipləri, bütün data lokal saxlanılır)
- `Destination {id, name, aliases[], coord, district}`: 6–8 təyinat. Bunlar Hilton Baku, İçərişəhər, Dənizkənarı Bulvar, Gənclik Mall, ADA Universiteti, Nərimanov, Nizami m., Port Baku-dur. Başlanğıc nöqtəsi həmişə "Cari yer = 28 May m."-dir.
- `RouteOption {id, destId, kind: safest|cheapest|fastest, profile, legs: Leg[], durationMin, distanceM, price, co2g, scoreDay, scoreNight, reasons[3], warnings[], steps[]}`
- `Leg {mode: walk|metro|bus|taxi|scooter|bike, polyline, lineName?}`
- `Crossing {id, coord, type, signals, lanes, lit, scoreDay, scoreNight}` və `Segment {id, coords, roadClass, lanes, lit, sidewalk, scoreDay, scoreNight}`
- `Report {id, category, coord, createdAt, aiConfidence, votesYes, votesNo}`
- `UserProfile {name: "Aysel", points, level, stats, badges}` və `FamilyMember {id, name, status, route, progress}`

### Arxitektura
- **Expo SDK 58** (React Native 0.88), TypeScript və expo-router ilə 4 tab: Yol, Xəritə, Bildir, Profil. Digər ekranlar modal və ya stack kimi açılır.
- Hamısı **Expo Go**-da işləyir, build lazım deyil. Kitabxanalar `npx expo install` ilə quraşdırılır ki, versiyaları SDK 58-ə uyğun olsun: `react-native-maps` (~1.29.11, Google provider, qaranlıq `customMapStyle`), `expo-audio`, `expo-speech`, `expo-haptics`, `expo-notifications` (yalnız lokal), `expo-file-system`, `react-native-svg`, `zustand`.
- **Data hazırlama skriptləri.** Bunlar backend deyil: hər skript bir dəfə işə salınır və nəticəni JSON faylı kimi tətbiqə yazır.
  - `scripts/fetch-osm.mjs`: Overpass API-dən Bakı ərazisinin (təxminən 40.33–40.48 N, 49.75–50.00 E) keçidlərini, işıqforlarını, əsas küçələrini və metro stansiyalarını yükləyir. Sorğu kiçik hissələrə (tile) bölünür.
  - `scripts/build-safety-layer.mjs`: qaydalarla bal verir. İşıqfor 80–95, işıqforsuz zebra 50–70 (çox zolaq olduqca bal azalır), keçid yoxdursa 20–40. Gecə işıqsız yerlərin balı azalır. Datası olmayan yer riskli sayılır. Hər obyektin id-sinə görə kiçik sabit səpələnmə əlavə olunur ki, ballar eyni görünməsin. Nəticə `src/data/safety-layer.json` faylıdır, koordinatlar yuvarlaqlaşdırılır və şəbəkə indeksi əlavə olunur.
  - `scripts/build-routes.mjs`: FOSSGIS OSRM serverindən (foot, bike və car profilləri, alternativ marşrutlarla) real xətlər və addımlar alır. Hər alternativin balı Təhlükəsizlik Qatı ilə hesablanır. Nəticə `src/data/routes.json` faylıdır.
- **Xəritənin performansı:** uzaq miqyasda risk istilik xəritəsi (`Heatmap`) göstərilir. Yaxın miqyasda yalnız ekranda görünən hissədəki xətlər və dairələr çəkilir, ən çoxu təxminən 300 obyekt.
- **Əhməd (`src/ai/`):** Gemini-yə `fetch` ilə REST sorğusu göndərilir. Audio m4a formatında base64 kimi gedir. Bir sorğuda həm cümlə mətnə çevrilir, həm də struktur JSON alınır: `{transcript, destinationId|null, timeOfDay, profile, preference, companions, reply}`. Sistem promptunda təyinat kataloqu və hər ssenarinin faktları olur, ona görə `reply` yalnız bu faktlara əsaslanır. Model ID və API açarı `.env` faylından oxunur (`EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_GEMINI_MODEL`). Cavab 8 saniyədə gəlməsə, internet olmasa və ya JSON düzgün olmasa, `fallback.ts` işə düşür: açar sözlərlə uyğunlaşdırma edir, nəticə tapılmasa hazır demo cümləsi işləyir.
- **State:** `zustand` ilə yaddaşda saxlanılır və başlanğıc datası əvvəlcədən doldurulur. Demo panelindəki "Sıfırla" düyməsi hər şeyi başlanğıc vəziyyətə qaytarır.
- **Vizual (12 noyabr axşam DƏYİŞDİ):** açıq mövzu, rənglər **ağ + #FF6203**. Tətbiq istifadəçinin göndərdiyi 1-ci referans kimi qurulur: açıq boz fon, iri qalın başlıqlar, tam yuvarlaq çiplər və düymələr, böyük yuvarlaq kartlar, qara düymələr, açıq xəritə və narıncı marşrut. Əhmədlə səsli danışıq 3-cü referans kimidir: narıncı nöqtəli kürə, "Dinləyirəm…" yazısı, × / taymer / ✓ düymələri. **Widget** 2-ci referans kimidir. Real hissəsi naviqasiya zamanı sabit qalan və canlı yenilənən lokal bildirişdir, bildiriş panelində və kilid ekranında görünür. Bundan əlavə tətbiqin içində "Kilid ekranı" simulyasiyası olur. Əsl home və lock screen widget-i dev build tələb edir, ona görə demoya daxil deyil. Təhlükəsizlik rəngləri (yaşıl, sarı, qırmızı) yalnız bal göstərmək üçün istifadə olunur. Əvvəlki tünd göy və firuzəyi mövzudan imtina edildi. Bütün mətnlər Azərbaycan dilindədir və bir faylda toplanır (`src/i18n/az.ts`). Əhmədin şəkli və loqo indilik sadə SVG ilə çəkilir. Sonra `assets/brand/` qovluğuna qoyulan PNG fayllarla əvəz olunacaq.

### Xarici xidmətlər
- **Gemini API** demo zamanı işləyir. Bunun üçün internet və API açarı lazımdır.
- **Google Maps xəritəsi** Expo Go-nun öz açarı ilə işləyir, amma internet tələb edir.
- **Overpass və FOSSGIS OSRM** yalnız data hazırlanarkən bir dəfə çağırılır, demo zamanı lazım deyil.

---

## 2. FƏRZİYYƏLƏR (dəqiq cavab verilməyən mövzular)
1. Hesab yoxdur. Tətbiqdə maketlərdəki kimi tək bir saxta istifadəçi var: "Aysel".
2. Ailə abunəsinin qiyməti **3.99 ₼/ay**-dır. Bu, yer tutan rəqəmdir və komanda dəyişə bilər.
3. Cari yer həmişə **28 May m.** kimi sabitdir, real GPS istifadə olunmur. Bu, səhnədə etibarlılıq üçündür.
4. Hava real deyil (Open-Meteo istifadə olunmur). Külək demo sürüşkəni ilə idarə olunur.
5. Gecə və ya gündüz telefonun saatına görə avtomatik seçilir: 18:00-dan sonra gecədir. Demo paneli bunu məcburi dəyişə bilər.
6. Avtobus nömrələri, metro gediş haqqı (0.60 ₼) və taksi tarifi inandırıcı saxta rəqəmlərdir. **Komanda bunları yoxlamalıdır.**
7. "Bütün Bakı" yuxarıda göstərilən koordinat çərçivəsini əhatə edir. Abşeron qəsəbələri daxil deyil.
8. Dizayn maketlərin vizual dilinə uyğun qurulur, çünki bu, vaxta qənaət edir.
9. Admin paneli və WhatsApp/Telegram botu v1-ə daxil deyil, çünki qeyd kimi istənilmədi.
10. Tətbiq yalnız Azərbaycan dilindədir. Demo yalnız Android-də göstərilir, amma kod iOS-a da uyğundur.
11. Gemini açarı tətbiqin içində qalır və bu, demo üçün qəbul olunur. Açarda xərc limiti qoyulmalı, demodan sonra isə açar dəyişdirilməlidir.

## 3. Açıq risklər
1. **Vaxt:** təxminən 1 gün ərzində 9 funksiya qurulmalıdır. Mərhələlər demo dəyərinə görə sıralanıb. P2 funksiyaları sadə versiyada qala bilər.
2. **Səhnədə internet:** Gemini və xəritə plitələri internetsiz işləmir. Həll: telefonun mobil interneti, AI üçün ehtiyat rejim, ehtiyat demo videosu və demodan əvvəl ərazini xəritədə açıb plitələri keşə yükləmək.
3. **Gemini model ID-si, audio dəstəyi və gecikmə:** sənədlərdə model adları tez-tez dəyişir (3.8 Flash, 4 Hydrogen, Interactions API). Həll: 1-ci mərhələdə smoke test aparılır və model ID-si `.env` faylında saxlanılır.
4. **Azərbaycan dilində səs tanıma:** səs-küylü zalda səhvlər ola bilər. Həll: gizli demo düyməsi hazır cümləni göndərir.
5. **Telefonda TTS səsi:** Azərbaycan dili səsi olmaya bilər, türk səsi isə aksentlə oxuyacaq. Həll: bu, ilk gün demo telefonunda yoxlanılır. Pis səslənərsə, yalnız mətn və vibrasiya qalır.
6. **Xəritənin performansı:** minlərlə xətt xəritəni yavaşlada bilər. Həll: yalnız ekranda görünən hissə çəkilir, uzaq miqyasda istilik xəritəsi göstərilir.
7. **Overpass və OSRM ictimai serverləri:** müvəqqəti limit və ya kəsinti ola bilər. Həll: sorğular hissələrə bölünür, nəticə bir dəfə yaradılıb fayl kimi saxlanılır. Server cavab verməsə, aralıq nöqtələr əl ilə verilir.
8. **Münsiflərə dürüstlük:** ballar prototip qaydaları ilə hesablanır. Ekranda kiçik "Demo data" nişanı olacaq. Pitch-də bunu açıq demək lazımdır.
9. **Expo Go versiyası:** telefondakı Expo Go SDK 58-i dəstəkləməlidir. Bu, 1-ci mərhələdə yoxlanılır.

---

## 4. İcra planı (sıra demo dəyərinə görədir)
Hər mərhələnin sonunda telefonda yoxlama nöqtəsi var: istifadəçi QR kodu oxudur və nəticəyə baxır.

**Hazırlıq (istifadəçi, təxminən 15 dəqiqə):** Android telefona Play Store-dan Expo Go quraşdırılır. Windows-a scrcpy quraşdırılır (adb onunla birlikdə gəlir). Gemini API açarı alınır və `.env` faylına yazılır.

| # | Mərhələ | Prioritet |
|---|---|---|
| 1 | `npx create-expo-app@latest` (SDK 58, TS, router), mövzu tokenləri, tab bar, SVG ilə müvəqqəti loqo və Əhməd. Gemini smoke testi (`scripts/smoke-gemini.mjs`): mətn və qısa m4a göndərilir, JSON forması və gecikmə ölçülür. | P0 |
| 2 | Data skriptləri: OSM məlumatları, `safety-layer.json` və `routes.json` faylları. Obyektlərin sayı və faylların ölçüsü yoxlanılır (məqsəd: 5 MB-dan az). | P0 |
| 3 | Xəritə tabı: qaranlıq xəritə, Təhlükəsizlik Qatı, gecə və gündüz düyməsi, markerlər, alt panel. | P0 |
| 4 | Yol ana səhifəsi, Nəticə ekranı (3 kart və marşrut xətləri), Əhmədin tövsiyəsi. | P0 |
| 5 | Əhməd ekranı: səs yazma, Gemini, ssenarinin seçilməsi, TTS, mətnlə daxiletmə, ehtiyat rejim. | P0 |
| 6 | Gizli demo paneli. | P0 |
| 7 | Skuter rejimi (külək sürüşkəni və marşrutun dəyişməsi), Əlçatan rejim. | P1 |
| 8 | Canlı naviqasiya simulyasiyası (banner, xəbərdarlıq, TTS, vibrasiya). | P1 |
| 9 | Bildir, xal sistemi və Profil. | P2 |
| 10 | Ailə: ödəniş pəncərəsi, ailə paneli, Nənənin hərəkət simulyasiyası, lokal bildiriş, SOS. | P2 |
| 11 | Son cilalama, təyyarə rejimində test, ehtiyat video (`scrcpy --record demo.mp4`). | P0 |

### Fayl strukturu
```
app/                 _layout.tsx, (tabs)/{index,map,report,profile}.tsx,
                     ahmed.tsx, results/[destId].tsx, navigate.tsx,
                     accessible.tsx, scooter.tsx, family/{index,paywall}.tsx
src/components/      SafetyRing, RouteCard, SafetyLayer, AhmedAvatar, Logo, BottomPanel, DemoPanel
src/data/            safety-layer.json, routes.json (yaradılan), destinations.ts, reports-seed.ts, family.ts
src/ai/              gemini.ts, prompt.ts, fallback.ts
src/store/           useAppStore.ts
src/sim/             navigationSim.ts, familySim.ts
src/utils/           geo.ts, tts.ts
src/i18n/az.ts       src/theme.ts
scripts/             fetch-osm.mjs, build-safety-layer.mjs, build-routes.mjs, smoke-gemini.mjs
.env                 (gitignore-a əlavə olunur)
```

## 5. Yoxlama
- `npx tsc --noEmit`: hər mərhələdən sonra tip yoxlaması aparılır.
- `npx expo start`: tətbiq Android telefonda Expo Go ilə açılır. Hər mərhələdə ekran görüntüsü və ya scrcpy ilə yoxlanılır.
- Gemini smoke testi: 5 nümunə cümlə (mətn) və 1 səs yazısı göndərilir. Hər birində düzgün `destinationId` qayıtmalı və cavab 5 saniyədən tez gəlməlidir.
- Ehtiyat rejimi: telefon təyyarə rejimində ikən Əhmədə sorğu verilir. 8 saniyə sonra hazır ssenari işə düşməlidir.
- Demo ssenarisi saatla 3 dəfə tam keçilir və ehtiyat video yazılır.
