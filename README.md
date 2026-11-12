# Hara?

**Bakıda hara getsən, ən təhlükəsiz yolla.**

Hara? ən sürətli yolu yox, **ən az riskli** yolu göstərən mobil tətbiqdir. Piyadalar, əlil arabası istifadəçiləri, uşaq arabalı valideynlər, yaşlılar, velosiped və skuter sürənlər üçündür. AI bələdçisinin adı **Əhməd**dir: Azərbaycan dilində səslə və ya yazı ilə danışır.

> Bu repo **hakaton demosudur** (13 noyabr 2026). Backend yoxdur. Tətbiq yalnız frontend-dən ibarətdir və saxta, amma şişirdilməmiş data ilə işləyir. Yeganə real AI hissəsi Əhməddir, o da Gemini ilə işləyir. Konsepsiya: [`Hara 2.0 - final konsepsiya.md`](Hara%202.0%20-%20final%20konsepsiya.md).

## Nə real, nə demo

| Hissə | Status |
|---|---|
| Keçid və küçə koordinatları (bütün Bakı, OSM) | **Real.** 3,223 keçid, 19,663 küçə seqmenti, 33 metro stansiyası |
| Təhlükəsizlik balı (gecə və gündüz) | **Prototip qaydası.** iRAP atributlarına əsaslanır: işıqfor, zolaq, işıqlandırma, səki |
| Marşrut xətləri | **Real küçə həndəsəsi.** FOSSGIS OSRM ilə əvvəlcədən hazırlanıb |
| Vaxt, qiymət, CO₂, avtobus nömrəsi, taksi tarifi | Demo data |
| Əhməd (səs və mətn) | **Real Gemini.** Cavab gəlməsə, offline ssenari işə düşür |
| Lift statusu, metro müşayiəti, Ailə ödənişi, SOS | Simulyasiya |

## İşə salmaq

```bash
cd mobile
npm install
cp .env.example .env          # sonra EXPO_PUBLIC_GEMINI_API_KEY dəyərini yaz
npx expo start
```

Android telefonda **Expo Go** (SDK 58) ilə QR kodu oxut. Proyektora yaymaq üçün `scrcpy` istifadə olunur.

## Demo ssenarisi (3 təsirli an)

1. **Səs:** Ana səhifədə "Əhmədə de" düyməsinə toxun, sonra mikrofona bas və bu cümləni de: *"Gecədir, uşaq arabası ilə 28 May-dan Hilton-a getmək istəyirəm"*. Əhməd 3 marşrut kartı göstərir və seçimini izah edir.
2. **Gecə və gündüz:** Xəritə tabında Təhlükəsizlik Qatı var. Gündüz/Gecə düyməsi basılanda keçidlərin və küçələrin rəngi dəyişir.
3. **Skuter və külək:** Skuter rejimində külək sürüşkənini sürüşdür. Külək 8 m/s-dən güclü olanda marşrut dənizkənarından daxili küçələrə keçir. Qasırğa 17 m/s-dən güclü olanda skuter variantı gizlədilir.

Bundan əlavə: canlı naviqasiya ("Yola düş" düyməsi). Naviqasiya zamanı bildiriş panelində və kilid ekranında sabit bildiriş görünür. Digər ekranlar: Bildir və xal, Profil, Əlçatan rejim, Hara Ailə, Kilid ekranı widget simulyasiyası.

**Gizli demo paneli:** ana səhifədə sol yuxarıdakı menyu düyməsinə uzun bas. Orada bunlar var: gecə/gündüz rejimi, külək, AI-ni söndürmək, naviqasiya sürəti, hazır cümlə, "Nənə çatdı" bildirişi və sıfırlama.

## Data

```bash
cd mobile
npm run data:osm      # Overpass-dan Bakı OSM datasını yükləyir (scripts/.cache)
npm run data:layer    # src/data/safety-layer.json faylını yaradır
npm run data:routes   # src/data/routes.json faylını yaradır (FOSSGIS OSRM)
npm run smoke:gemini  # Gemini açarını və modelini yoxlayır
```

Xam OSM və OSRM cavabları `mobile/scripts/.cache/` qovluğunda saxlanılır (12 noyabr 2026 tarixli snapshot). Ona görə `data:layer` və `data:routes` əmrləri internet olmadan da eyni nəticəni verir.

## APK

`.github/workflows/android-apk.yml` workflow-u Expo hesabı olmadan APK yığır: `expo prebuild` → Gradle `assembleRelease` (arm64). Workflow-u Actions → "Android APK" → Run workflow ilə işə salmaq olar. Lazım olan secret-lər: `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`.

## Sənədlər

- [`docs/spec-plan.md`](docs/spec-plan.md): spec müsahibəsinin nəticəsi, qəbul olunan fərziyyələr, risklər və icra planı.
- [`docs/design/mockups-v1/`](docs/design/mockups-v1/): ilkin konsepsiya maketləri (qaranlıq mövzu). Sonradan dizayn ağ və #FF6203 rənglərinə keçirildi.

## Qeydlər

- Gemini açarı demo üçün tətbiqin içinə yığılır (`EXPO_PUBLIC_`). Açarda xərc limiti qoy və **demodan sonra açarı dəyiş**.
- Əsas model `gemini-3.1-flash-lite`-dır: 12 noyabrda mətn və səs üçün 1–2 saniyə cavab verdi. Ehtiyat modellər zənciri və offline ssenari də var.
- Əsl home və lock screen widget-i dev build tələb edir. Expo Go-da widget-in canlı hissəsi sabit lokal bildirişdir.
- Data © OpenStreetMap töhfəçiləri (ODbL).
