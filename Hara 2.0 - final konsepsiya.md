# Hara? 2.0: final konsepsiya

**Komanda:** Radium
**Trek:** Hərəkətdə şəhər – piyada və dayanıqlı mobillik
**Status:** əsas ideya
**Versiya:** 11 noyabr 2026

> **Bir cümlə:** Hara getmək istədiyini səslə de. AI bütün nəqliyyat növlərini qapıdan qapıya yoxlayır və sənə ən təhlükəsiz, sərfəli və rahat yolu seçir. Arxasında AI ilə qurulmuş "Bakı Təhlükəsizlik Qatı" dayanır. Bu qat Bakının hər keçidini və küçəsini təhlükəsizliyə görə qiymətləndirən ilk xəritədir.
>
> **Şüar:** *"Bakıda hara getsən, ən təhlükəsiz yolla."*

---

## 1. Jüri kimi v1-in təhlili: 12 zəif nöqtə və onların həlli

| # | Zəif nöqtə | Kim soruşacaq | v2-də həlli |
|---|---|---|---|
| 1 | "Google Maps, Yandex, 2GIS və AYNA MaaS-dan nə fərqi var?" | AYNA, İRİA | Məhsulun özəyi marşrut planlayıcısı yox, **Təhlükəsizlik Qatıdır**. Bakıda piyada təhlükəsizlik balı göstərən tətbiq tapılmadı. Waze-in təhlükəli yol xəbərdarlığı yalnız sürücülər üçündür və istifadəçi bildirişlərinə əsaslanır ([Google Waze Help](https://support.google.com/waze/answer/13014546)). |
| 2 | "Təhlükəsizlik balı subyektivdir, ona niyə inanaq?" | AYNA, İRİA | Bal beynəlxalq **iRAP Star Rating** atributlarına əsaslanır. Bu metodologiya piyadalar üçün də reytinq verir. iRAP-a görə hər ulduz artımında ölüm və ağır xəsarət riski təxminən iki dəfə azalır ([iRAP](https://irap.org/?p=2226)). Bal real ölüm yerləri ilə yoxlanılır (bax: 8-ci bölmə). |
| 3 | "Data haradan gəlir? Sakinlər foto çəkməyəcək." | Hamısı | Sakindən heç nə tələb olunmur. Mənbələr: açıq data (OSM), AI-nin küçə görüntülərindən atribut çıxarması (iRAP-ın AiRAP yanaşması, [iRAP](https://irap.org/?p=2226)), tətbiqdən passiv və anonim siqnallar, gələcəkdə tərəfdaş avtomobil parklarının kameraları. |
| 4 | "AI harada? Marşrut hesablamaq AI deyil." | İRİA | AI 6 konkret iş görür (bax: 4-cü bölmə). Hər biri olmadan məhsul işləmir. |
| 5 | "Çox funksiya var, nə qurduğunuz aydın deyil." | Hamısı | Struktur sadələşdirilib: 1 qat (beyin), 1 agent (danışan), 4 rejim (kimin üçün). Demoda yalnız 3 təsirli an göstərilir. |
| 6 | "'5 tətbiq açıram' problemi zəifdir." | Gənclər Fondu, DŞAK | Pitch ölüm statistikası ilə başlayır: Bakıda qəzaların 63%-i piyada vurulmasıdır. Zalda keçiriləcək sorğu da əlavə sübut verir. |
| 7 | "Biznes modeli nədir? Whim iflas edib." | İRİA | Bilet satmırıq. Gəlir mənbələri: "Hara Ailə" abunəsi (Life360-ın 2025-ci ilin sonunda 2.8 milyon ödənişli ailəsi var idi, [Life360](https://investors.life360.com/news-releases/news-release-details/life360-reports-record-q4-2025-results)), yönləndirmə komissiyası, anonim analitika (Moovit həm tətbiq işlədir, həm də 7,500 nəqliyyat qurumuna data verirdi, [TechCrunch](https://techcrunch.com/2020/05/04/confirmed-intel-is-buying-urban-mobility-platform-moovit-in-a-900m-deal)). |
| 8 | "İnklüzivlik sadəcə əlavə funksiyadır." | DŞAK, Gənclər Fondu | İnklüzivlik dizaynın özündədir. Əlçatan rejim ayrıca hissədir, metro müşayiəti bir düymə ilə sifariş olunur, sınaq əlilliyi olan istifadəçilərlə aparılır. |
| 9 | "AI 'təhlükəsizdir' deyəndən sonra qəza baş versə?" | Hamısı | Tətbiq heç vaxt "təhlükəsiz" demir, "daha az riskli" deyir. Data çatışmayanda konservativ qərar verir, data yoxdursa yer riskli sayılır. Tövsiyələr izah edilir. Şəxsi data cihazda qalır. |
| 10 | "Ekoloji təsir haradadır?" | Ekologiya | Hər variantın CO2 miqdarı göstərilir. Vaxt fərqi kiçik olanda tətbiq ictimai nəqliyyatı və ya piyadanı tövsiyə edir. İstifadəçi aylıq "yaşıl hesabat" alır. Kölgəyə görə marşrut isti yay günlərində iqlimə uyğunlaşma alətidir. |
| 11 | "Taksi qiymətlərini haradan alırsınız?" | İRİA | Hazırda tarif modeli ilə təxmin edirik və bunu açıq deyirik. Rəsmi inteqrasiya pilot mərhələsidir. Taksi məhsulun özəyi deyil. |
| 12 | "Azərbaycan dilində səs işləyəcəkmi?" | İRİA | Whisper large-v3 Azərbaycan dilində təxminən 21% WER verir. Kommersiya modellərinin elan etdiyi göstərici ~9% WER-dir, bu rəqəm satıcının özünə aiddir ([HF model kartı](https://huggingface.co/BuzzASR/azerbaijani), [ElevenLabs](https://elevenlabs.io/it/speech-to-text/azerbaijani)). Həll: daha yaxşı STT modeli, Bakı yer adları lüğəti ilə LLM düzəlişi, mətnlə daxiletmə ehtiyat variant kimi. |

---

## 2. Problem

**Kim əziyyət çəkir?** Bakıda piyada olan hər kəs. Hər səfər piyada başlayır və piyada bitir.
- **2026-nın I rübündə Bakıda 68 qəzanın 43-ü piyadanın vurulmasıdır, 21 piyada ölüb** ([NİİM / operativmm.az](https://operativmm.az/en/post/21-pedestrians-killed-in-baku-traffic-accidents-in-q1/71044)). Bu, təxminən 63% edir. Ölkə üzrə bu pay 42%-dir ([DSK](https://stat.gov.az/special_version/news/index.php?id=6683)).
- **Qəzaların 55–62%-i qaranlıq və ya alaqaranlıqda baş verir** ([DSK](https://stat.gov.az/special_version/news/index.php?id=6683)).
- **Qəzaların yeri rəqəmsal qeydə alınmır.** Polis formaları kağız üzərindədir, GPS koordinatı yoxdur ([CAREC/ADB](https://www.carecprogram.org/uploads/AZE-Road-Crash-Data-Review_MAR2025_RUS_web.pdf)). Bakıda heç kim, heç bir tətbiq hansı keçidin təhlükəli olduğunu bilmir.
- **Yeraltı keçidlər:** 46 keçiddə 177 eskalatorun istismar müddəti bitib, sakinlər şikayət edib ([AZƏRTAC](https://azertag.az/xeber/bakida_piyada_kechidlerinde_istismar_muddetini_basa_vurmus_eskalator_ve_bezi_liftler_yenilenecek-4297139)). Əlil arabası istifadəçisi dik pandus əvəzinə maşınların arasından keçir ([JAMnews](https://jam-news.net/ru/городская-инфраструктура-азербайдж/)).
- **Mövcud tətbiqlərin hamısı** (taksi, Google, Yandex, AYNA MaaS) yalnız ən sürətli və ucuz yolu göstərir. **Heç biri ən təhlükəsiz yolu göstərmir.**

**Problem bir cümlə ilə:** *"Bakıda piyadalar ölür, amma telefonumuzdakı heç bir tətbiq bizə yolun təhlükəli olduğunu demir."*

---

## 3. Həll: 3 qatlı arxitektura

### Qat 1: Bakı Təhlükəsizlik Qatı (beyin)
Bakının hər piyada keçidi və hər küçə seqmenti üçün **0–100 arası təhlükəsizlik balı**. Gündüz və gecə üçün ayrıca hesablanır.

**Atributlar** (iRAP-ın piyada modelindən götürülüb, sadələşdirilib):
| Atribut | Mənbə |
|---|---|
| Keçidin növü: işıqforlu, işıqforsuz zebra, yeraltı, yerüstü, keçid yoxdur | OSM, görüntüdən AI |
| Zolaqların sayı və yolun eni | OSM, görüntüdən AI |
| Yolun sinfi və sürət | OSM |
| Ortada təhlükəsizlik adacığının olub-olmaması | Görüntüdən AI |
| İşıqlandırma | OSM `lit` teqi və işıq dirəkləri, gecə görüntüsü |
| Səkinin olub-olmaması, maneələr (park edilmiş maşın) | Görüntüdən AI, OSM |
| Ən yaxın təhlükəsiz keçidə məsafə | Hesablanır |
| Məktəb zonası | OSM |
| Yeraltı keçidin eskalator və lift statusu | Rəsmi data (pilot), demoda simulyasiya |

**Marşrut balı "zəncirin ən zəif halqası" prinsipi ilə hesablanır.** Marşrut ən təhlükəli keçidi qədər təhlükəsizdir. 10 təhlükəsiz küçə 1 ölümcül keçidi kompensasiya etmir.

**Mövcud data (11 noyabr 2026-da OSM-də yoxlanılıb, mərkəzi Bakı):**
- ~3,057 keçid, 547 işıqfor, 1,413 avtobus dayanacağı;
- 11,847 bina, onların 7,662-sində mərtəbə sayı var;
- 341 velosiped zolağı seqmenti;
- yolların yalnız ~2%-də səki teqi var. Bu boşluğu AI görüntülərdən doldurur.

**Passiv öyrənmə:** tətbiq istifadəçilərin əslində harada yolu keçdiyini cihazın özündə analiz edir və yalnız anonim, ümumiləşdirilmiş şəkildə toplayır. Nəticədə "faktiki keçid yerləri xəritəsi" yaranır. Moskvadakı Silk Road qalibi buna bənzər ideya ilə qalib gəlmişdi.

### Qat 2: AI Səfər Agenti (danışan)
- **Kanallar:** mobil tətbiq və **WhatsApp və ya Telegram bot**. Botda heç nə quraşdırmağa ehtiyac yoxdur, səsli mesaj göndərmək kifayətdir. Bu, yaşlılar üçün xüsusilə vacibdir.
- **LLM orkestrator** alətləri çağırır:
  - multimodal marşrut (piyada, metro, avtobus, taksi, skuter, velosiped);
  - Təhlükəsizlik Qatı;
  - hava (Open-Meteo: külək, yağış, temperatur);
  - şəhər hadisələri və bağlanan yollar;
  - taksi qiyməti təxmini;
  - metro müşayiəti sifarişi.
- **Nəticə:** ən çoxu 3 kart: **Ən təhlükəsiz, Ən sərfəli, Ən sürətli**. Bir tövsiyə və "Niyə?" sualına 3 səbəb. Hər kartda təhlükəsizlik balı, qiymət, vaxt və CO2.
- **Fərdiləşdirmə:** agent istifadəçinin seçimlərindən onun prioritetlərini öyrənir. Biri qiymətə, digəri təhlükəsizliyə daha çox önəm verir.

### Qat 3: 4 rejim (kimin üçün)
1. **Gündəlik** (gənc sərnişin):
   - bütün variantların müqayisəsi;
   - **"Son 50 metr" yoxlaması:** *"Taksi səni prospektin qarşı tərəfində düşürəcək, düşmə nöqtəsini dəyişək?"* Düzgün nöqtə linklə sürücüyə göndərilir;
   - yaşıl seçim üçün təşviq.
2. **Əlçatan** (əlil arabası, yaşlı, uşaq arabası, zəif görən, eşitmə qüsurlu):
   - yalnız pilləkənsiz marşrutlar;
   - eskalator və lift statusu;
   - zəif görən üçün səsli idarə, eşitmə qüsurlu üçün vizual və vibrasiya xəbərdarlıqları;
   - "Əlçatan metro" müşayiətinin bir düymə ilə sifarişi. Hazırda müşayiət əvvəlcədən sifariş olunur ([metro.gov.az](https://metro.gov.az/en/page/muddealar/elcatan-metro)), bir ayda cəmi 113 nəfər istifadə edib ([AZƏRTAC](https://azertag.az/xeber/4493352), tarix dəqiqləşdirilməli).
3. **Ailə** (premium):
   - valideyn uşağın məktəb yolunu qurur. Bu marşrutda işıqforsuz keçid olmur;
   - uşaq çatanda bildiriş gəlir;
   - yaşlı valideynin səfəri izlənilir;
   - gecə səfəri ailə ilə paylaşılır;
   - SOS düyməsi.
4. **Skuter və velosiped:**
   - bir rahatlıq və təhlükəsizlik marşrutu: zolaq, qarşı külək, qasırğa, günəş və kölgə, yoxuş;
   - ayrı bildirişlər yoxdur, hamısı bir marşrut seçimində birləşir;
   - güclü qasırğada skuter variantı göstərilmir.

**Hər rejimdə "Canlı Səfər Yoldaşı" var:** piyada hissədə qulaqcıqla səsli və ya vibrasiya ilə xəbərdarlıq verir. Məsələn: *"80 metr sonra işıqforsuz 4 zolaq var. İşıqforlu keçid 120 metr sağdadır."* Avtobus gecikəndə və ya yağış başlayanda marşrutu yenidən qurur.

---

## 4. AI-nin 6 işi (İRİA üçün)

| # | İş | Model və alət | Niyə vacibdir | Demoda |
|---|---|---|---|---|
| 1 | Görüntüdən iRAP atributlarını çıxarmaq | VLM (multimodal LLM) və ya YOLO və segmentasiya | Səki, adacıq, işıqlandırma datası boşluğunu doldurur | Bəli: bir koridorun görüntüləri |
| 2 | Risk modeli | iRAP-a əsaslanan ilkin çəkilər, sonra NİİM datası ilə kalibrləmə (ML) | Təhlükəsizlik balı | Bəli: xəritə |
| 3 | Səsli və mətnli sorğunu anlamaq | STT (Gemini və ya ElevenLabs, ehtiyat: Whisper), LLM və yer adları lüğəti | Azərbaycan dilində, səslə, yaşlılar üçün | Bəli |
| 4 | Agent: alətləri çağırıb qərar vermək və izah etmək | LLM, function calling | "Niyə bu yol?" | Bəli |
| 5 | Şəhər hadisələrini oxumaq | LLM rəsmi elanlardan (yol bağlanması, F1, matçlar) strukturlaşdırılmış data çıxarır | Marşrut canlı vəziyyətə uyğunlaşır | Bəli: 3 nümunə elan |
| 6 | Fərdiləşdirmə və proqnoz | İstifadəçinin seçimlərindən çəkiləri öyrənmək, taksi qiymətinin artmasını proqnozlaşdırmaq | Hər kəsə özünə uyğun tövsiyə | Qismən |

Marşrut alqoritminin özü optimallaşdırmadır, AI deyil. Bunu münsiflərə dürüst deyirik. AI-nin rolu yuxarıdakı 6 işdir.

---

## 5. Fərqimiz

| İmkan | Google, Yandex, 2GIS (Bakıda) | AYNA MaaS | Waze | **Hara?** |
|---|---|---|---|---|
| Multimodal marşrut | Var, bəzən səhvlərlə ([karavan.az](https://karavan.az/blog-eng/the-best-navigation-software-in-azerbaijan/)) | Var | Yalnız maşın | Var |
| Taksi qiymətlərinin müqayisəsi | Yoxlanmayıb | Tapılmadı | Yox | Var (hazırda təxmini) |
| Piyada keçidinin təhlükəsizlik balı | Tapılmadı | Tapılmadı | Yalnız sürücü üçün, istifadəçi bildirişlərinə əsaslanır | **Var, gecə və gündüz üçün ayrıca** |
| Əlçatan rejim və metro müşayiəti | Yoxlanmayıb | Tapılmadı | Yox | Var |
| Külək və kölgəyə görə skuter marşrutu | Tapılmadı | Tapılmadı | Yox | Var |
| Azərbaycan dilində səsli agent | Yoxlanmayıb | Tapılmadı | Yox | Var |
| Ailə rejimi | Yox | Yox | Yox | Var |

**AYNA "MaaS bunu edir" desə:** *"MaaS marşrut verir. Biz marşrutun təhlükəsiz olub-olmadığını deyirik. Təhlükəsizlik Qatı MaaS-a da qoşula bilər. Biz rəqib deyilik, onu gücləndiririk."*

---

## 6. Təhlükəsizlik: üç səviyyə

**Yol təhlükəsizliyi**
- Tətbiq heç vaxt "100% təhlükəsiz" demir, "ən az riskli" deyir.
- Gecə rejimində işıqsız seqmentlərin cəzası artır.
- Uşaq rejimində işıqforsuz keçid ümumiyyətlə olmur.
- Güclü qasırğada skuter variantı göstərilmir. Bu həddi komanda müəyyən edir və münsiflərə izah edir.

**AI təhlükəsizliyi**
- Data yoxdursa, yer riskli sayılır.
- Hər balın yanında data nə vaxt yeniləndiyi göstərilir.
- Hər tövsiyə izah olunur.
- LLM marşrut uydurmur, yalnız alətlərin nəticələrini izah edir.

**Data təhlükəsizliyi**
- Əsas funksiyalar üçün qeydiyyat tələb olunmur.
- Yer məlumatı cihazda emal olunur.
- Passiv siqnallar yalnız anonim və ümumiləşdirilmiş şəkildə toplanır: bir yerdən az adam keçibsə, data göstərilmir.
- Görüntülərdə üzlər və nömrə nişanları avtomatik bulanıqlaşdırılır.
- "Fərdi məlumatlar haqqında" Qanuna uyğunluq. Hüquqşünasla dəqiqləşdirin.

---

## 7. Biznes modeli və davamlılıq

| Gəlir mənbəyi | Necə | Sübut |
|---|---|---|
| Pulsuz nüvə | Bütün istifadəçilər, sürətli yayılmaq üçün | — |
| **Hara Ailə** abunəsi | Uşaq, yaşlı və gecə səfəri üçün təhlükəsizlik funksiyaları | Life360: 2025-ci ilin sonunda 2.8 milyon ödənişli ailə, 489.5 milyon dollar illik gəlir ([Life360](https://investors.life360.com/news-releases/news-release-details/life360-reports-record-q4-2025-results)) |
| Yönləndirmə komissiyası | Taksi və skuter sifarişinə yönləndirmə | Tərəfdaşlıq tələb edir |
| Anonim analitika (B2B2G) | AYNA, BŞİH, sığorta şirkətləri üçün: harada adamlar riskli keçidlərdən qaçır, faktiki keçid yerləri | Moovit həm tətbiq işlədib, həm də 7,500 nəqliyyat qurumuna data verib. Intel onu 900 milyon dollara alıb ([TechCrunch](https://techcrunch.com/2020/05/04/confirmed-intel-is-buying-urban-mobility-platform-moovit-in-a-900m-deal)) |
| Başlanğıcda | Qrant və startap proqramları | — |

**Whim-in səhvini təkrarlamırıq:** bilet satmırıq, abunə ilə nəqliyyat paketi satmırıq. Biz məsləhətçi və təhlükəsizlik xidmətiyik.

---

## 8. Təsir: nəyi necə ölçürük

**Demoda (12 noyabr):**
1. **Təhlükəsizlik qazancı:** test marşrutlarında "ən təhlükəsiz" variant "ən sürətli" variantla müqayisədə neçə işıqforsuz keçidi və neçə metr işıqsız küçəni azaldır, bunun üçün neçə dəqiqə əlavə vaxt lazımdır.
2. **Balın yoxlanması:** 2025–2026-cı illərdə Bakıda piyadanın öldüyü qəzalar barədə 10–20 xəbər toplanır. LLM yeri çıxarır, xəritədə nöqtəyə çevirir. Sonra yoxlanılır: AI-nin "qırmızı" zonaları bu yerlərlə üst-üstə düşürmü? Nümunə kiçikdir, bunu açıq deyin.
3. **Səsin dəqiqliyi:** Bakı yer adları olan 30 cümlə üzrə düzgün tanınan təyinat nöqtələrinin faizi.
4. **Sorğu:** zalda neçə nəfər bir səfər üçün 3-dən çox tətbiq açır, neçəsi özünü piyada kimi təhlükədə hiss edir.

**Pilotda (3 ay):**
- aktiv istifadəçilər və həftəlik qayıdış;
- "özünüzü daha təhlükəsiz hiss etdinizmi?" sorğusu;
- ictimai nəqliyyata və piyadaya yönəldilən səfərlərin payı və qənaət olunan CO2;
- əlçatan rejimdə tamamlanan səfərlər.

**Uzunmüddətdə:** pilot ərazisində piyada qəzaları NİİM datası ilə müqayisə olunur. **"Qəzaları X% azaldacağıq" demirik.**

---

## 9. Pilot plan: 3 ay, Nərimanov rayonu və mərkəz

| Tərəfdaş | Ondan nə lazımdır |
|---|---|
| AYNA | Avtobusların canlı datası, MaaS ilə inteqrasiya imkanı |
| Bakı Metropoliteni | "Əlçatan metro" sifariş kanalı, eskalator və lift statusu |
| NİİM | Balı kalibrləmək üçün anonim qəza koordinatları |
| Bir skuter operatoru | Səfər datası (küləyin təsirini öyrənmək üçün), yönləndirmə |
| Universitetlər və Gənclər Fondu | 1,000 tələbə sınaqçı |
| Əlillər cəmiyyəti | 20 sınaqçı, birgə dizayn |

**Niyə Nərimanov:** noyabr 2026-da orada saatda ~1,000 piyadanın keçdiyi keçidə işıqfor qoyulub ([AZƏRTAC](https://azertag.az/xeber/4490733)). Metro datası var. Rayon İRİA ilə birgə hakaton keçirib.

---

## 10. Demo: 3 təsirli an (90 saniyə)

1. **Səs:** *"Gecədir, uşaq arabası ilə 28 May-dan Hilton-a getmək istəyirəm."* AI 3 kart göstərir, birini seçir və izah edir: *"Taksi səni qarşı tərəfdə düşürərdi. Yeraltı keçidin lifti işləmir. Ona görə metro, sonra 2-ci çıxış, işıqlı küçə və 1 işıqforlu keçid."*
2. **Gecə və gündüz düyməsi:** eyni səfər üçün marşrut dəyişir. Təhlükəsizlik Qatının xəritəsi qırmızı və yaşıl rənglərlə görünür.
3. **Skuter rejimi, külək sürüşkəni:** külək dəyişdikcə marşrut canlı olaraq başqa küçəyə keçir.

**Ehtiyat:** əlçatan metro sifarişi bir düymə ilə, taksinin səhv tərəfdə düşürmə xəbərdarlığı. **Ehtiyat demo videosu mütləq hazırlanmalıdır.**

---

## 11. 12 noyabr üçün iş planı

| Rol | Səhər (09–13) | Günorta (14–18) | Axşam (18–22) |
|---|---|---|---|
| Backend/ML | Demo ərazisi üçün OSM qrafı. Təhlükəsizlik balı funksiyası (iRAP atributları, ən zəif halqa prinsipi). Open-Meteo. | VLM ilə 1 koridorun görüntülərindən atributlar. Külək və kölgə çəkiləri. Xəbərlərdən yoxlama datası. | Agent (function calling), hadisə parseri, metrikaların hesablanması |
| Frontend | Leaflet xəritəsi, təhlükəsizlik qatı, 3 kart | Səs düyməsi, gecə və gündüz düyməsi, külək sürüşkəni, əlçatan rejim | İnteqrasiya, internetsiz demo rejimi |
| Dizayn | Bir koridorun görüntülərini çəkmək (üzləri bulanıqlaşdırmaq), UI | Ekranlar, ikonlar, Azərbaycan dilində mətnlər | Slaydlar, ehtiyat demo videosu |
| Pitch | Sorğu nəticələri, faktların yoxlanması | Pitch mətni, sual-cavab cədvəli | Saat ölçməklə 3 dəfə məşq |

**Texniki stek:**
- Python, osmnx və networkx;
- suncalc və ya pvlib;
- Open-Meteo;
- Leaflet;
- LLM API (function calling);
- STT: Gemini və ya ElevenLabs, ehtiyat Whisper;
- FastAPI;
- Vercel.

---

## 12. Pitch: 5 dəqiqə

| Vaxt | Bölmə | Məzmun |
|---|---|---|
| 0:00–0:50 | **Problem** | "Bu ilin ilk üç ayında Bakıda 21 piyada maşın altında öldü. Paytaxtda hər üç qəzadan ikisi piyada vurulmasıdır, çoxu qaranlıqda. Telefonumuzdakı bütün tətbiqlər ən sürətli yolu göstərir. Heç biri ən təhlükəsiz yolu göstərmir." Ardınca sorğu nəticəsi. |
| 0:50–1:40 | **Həll** | "Hara? Bakının ilk təhlükəsizlik mərkəzli AI səfər köməkçisidir." 3 qat: Təhlükəsizlik Qatı, AI agent, 4 rejim. iRAP metodologiyası. |
| 1:40–3:10 | **Demo** | 3 təsirli an. "OSM və hava datası realdır. Lift statusu və taksi qiyməti demo datasıdır." |
| 3:10–4:10 | **Təsir** | Təhlükəsizlik qazancı (X% az işıqforsuz keçid, Y dəqiqə əlavə vaxt), balın xəbərlərlə yoxlanması, səsin dəqiqliyi. Pilot KPI-ları. Dövlət Proqramının hədəfləri: ölümlərin 50% azalması, ictimai nəqliyyatın 40% payı. |
| 4:10–4:50 | **Növbəti addım** | 3 aylıq Nərimanov pilotu. Tərəfdaşlardan istək: AYNA, Metro, NİİM. Biznes modeli: Ailə abunəsi və analitika. |
| 4:50–5:00 | **Bağlanış** | "Bakıda hara getsən, ən təhlükəsiz yolla." |

---

## 13. Münsiflərin gözlənilən sualları

| Münsif | Sual | Cavab |
|---|---|---|
| AYNA | "MaaS bunu edir." | MaaS marşrut verir, biz təhlükəsizliyi qiymətləndiririk. Təhlükəsizlik Qatı MaaS-a qoşula bilər. |
| AYNA | "Balınız səhv olsa?" | iRAP atributlarına əsaslanır, xəbərlərlə yoxlanılıb, NİİM datası ilə kalibrlənəcək. Tətbiq "təhlükəsiz" demir, "ən az riskli" deyir. |
| DŞAK | "Şəhərsalmaya faydası nədir?" | Anonim faktiki keçid yerləri xəritəsi yeni keçidlərin harada lazım olduğunu göstərir. Piyada infrastrukturu normalarına (8.1.6.1) və səki tədqiqatına (8.1.6.7) data verir. |
| Ekologiya | "Ekoloji təsir?" | Hər variantın CO2 miqdarı, vaxt fərqi kiçik olanda yaşıl seçimin tövsiyəsi, kölgəyə görə marşrut istiyə uyğunlaşma üçün. Ölçü: yönləndirilən səfərlərin payı. |
| İRİA | "AI harada? Startap potensialı?" | AI-nin 6 işi. Data aktivi Təhlükəsizlik Qatıdır. Gəlir: Ailə abunəsi, komissiya, analitika. Life360 və Moovit nümunələri. |
| İRİA | "Azərbaycan dilində səs?" | Ölçülmüş dəqiqlik, yer adları lüğəti, mətn ehtiyat variant kimi. |
| Gənclər Fondu | "Gənclərə faydası?" | Əsas istifadəçi gənclərdir. Pilotda 1,000 tələbə. Komanda gənclərdən ibarətdir. |
| Hamısı | "Şəxsi data?" | Qeydiyyat yoxdur, data cihazda qalır, passiv siqnallar anonim və ümumiləşdirilmiş şəkildə toplanır, görüntülər bulanıqlaşdırılır. |

---

## 14. Business Model Canvas (v2)

| № | Bölmə | Mətn |
|---|---|---|
| 1 | Problem | Bakıda qəzaların 63%-i piyada vurulmasıdır (NİİM, I rüb 2026), çoxu qaranlıqda baş verir. Hansı keçidin təhlükəli olduğunu heç bir tətbiq göstərmir. Qəza yerləri rəqəmsal qeydə alınmır. Bir səfər üçün 4–5 tətbiq açılır. Əlil insan metroda müşayiəti ayrıca sifariş etməlidir. |
| 2 | Hədəf auditoriya | Əsas: gənc gündəlik sərnişinlər (18–35 yaş). Sosial təsir: əlillər, yaşlılar, uşaq arabalı valideynlər. Premium: uşaqlarının və yaşlı valideynlərinin təhlükəsizliyini izləmək istəyən ailələr. Növbəti mərhələ: turistlər. |
| 3 | Dəyər təklifi | Bakının ilk təhlükəsizlik mərkəzli AI səfər köməkçisi: bir cümlə de, AI səfəri qapıdan qapıya yoxlasın, sənə ən təhlükəsiz, sərfəli və rahat yolu seçsin və səbəbini izah etsin. |
| 4 | Təklif olunan həll | Bakı Təhlükəsizlik Qatı (hər keçid və küçə üçün gecə və gündüz balı). Səsli AI agent (tətbiq və WhatsApp/Telegram bot). 4 rejim: Gündəlik, Əlçatan, Ailə, Skuter və velosiped. Canlı Səfər Yoldaşı. |
| 5 | AI və texnologiya | VLM ilə görüntüdən iRAP atributları. Risk modeli. Azərbaycan dilində STT və LLM. Function calling ilə agent. Hadisələri oxuyan LLM. Fərdiləşdirmə. OSM, Open-Meteo, günəşin mövqeyi və kölgə. |
| 6 | Əsas tərəfdaşlar | AYNA, Bakı Metropoliteni, NİİM, taksi və skuter operatorları, universitetlər, əlillər cəmiyyətləri, Gənclər Fondu, İRİA. |
| 7 | Əsas resurslar | Komanda (ML, frontend, dizayn), Təhlükəsizlik Qatı (data aktivi), OSM, hava datası, LLM və STT API-ləri, bulud server. |
| 8 | Xərclər | Tərtibat, LLM və STT API xərcləri, server və xəritə xidmətləri, görüntü toplama, istifadəçi sınaqları, marketinq. |
| 9 | Maliyyələşmə | Pulsuz nüvə. Hara Ailə abunəsi. Taksi və skuter yönləndirmə komissiyası. AYNA, BŞİH və sığorta şirkətləri üçün anonim analitika. Başlanğıcda qrant və startap proqramları. |

---

## 15. Jüri balı: v1 və v2 (subyektiv təxmin)

| Meyar | Maks | v1 | v2 | Fərqi yaradan |
|---|---|---|---|---|
| Problem | 15 | 9 | 13 | Ölüm statistikası mərkəzdədir, qəza datası boşluğu, sorğu |
| İnsanyönümlülük | 20 | 15 | 18 | Əlçatan və Ailə rejimləri, birgə dizayn, səs |
| İnnovativlik | 15 | 9 | 13 | Təhlükəsizlik Qatı, iRAP-a əsaslanan AI, külək və kölgə marşrutu |
| AI | 15 | 11 | 14 | 6 konkret iş, ölçülmüş dəqiqlik |
| Praktiklik | 15 | 8 | 12 | Açıq data, pilot plan, biznes modeli sübutla |
| Prototip | 10 | 8 | 9 | 3 təsirli an, ehtiyat video |
| Pitch | 10 | 7 | 9 | Hekayə və məşqdən asılıdır |
| **Cəmi** | 100 | **~67** | **~88** | |

**Dürüst qeyd:** heç bir ideya 100% qələbəni zəmanət etmir. Nəticə demonun keyfiyyətindən, pitchdən, sual-cavabdan və digər komandalardan asılıdır. v2 isə hər meyarda zəif nöqtələri bağlayır.

---

## 16. Qalan risklər

1. **Çox funksiya:** demoda yalnız 3 an göstərilməlidir. Qalanları slayda qoyun.
2. **Görüntü datası:** Bakıda Mapillary və Street View əhatəsi yoxlanılmayıb. Demoda öz çəkilişinizdən istifadə edin.
3. **Taksi API-si:** təsdiqlənməyib. Qiymətin təxmini olduğunu deyin.
4. **Balın yoxlanması:** nümunə kiçikdir. "İlkin yoxlama" deyin.
5. **Hüquqi tərəf:** fərdi məlumatlar qanununa uyğunluğu hüquqşünasla dəqiqləşdirin.

## 17. Münsiflərə deməzdən əvvəl yoxlanmalı faktlar

- "Əlçatan metro" xidmətindən istifadə edənlərin sayı və xəbərin tarixi.
- iRAP-ın "hər ulduz artımında risk təxminən iki dəfə azalır" iddiası: iRAP-ın öz saytından götürülüb.
- Life360 və Moovit rəqəmləri: şirkətlərin öz açıqlamalarıdır.
- STT dəqiqliyi: model kartları və satıcıların öz rəqəmləridir. Öz testinizi aparın.
- Əlilliyə görə pensiya alanlar: 2024-cü ilin yanvarında 258.7 min nəfər ([JAMnews, DSK-ya istinadla](https://jam-news.net/az/az%C9%99rbaycanda-%C9%99lilliy%C9%99-gor%C9%99-pensiya-alanalar)). Bu, əlilliyi olanların ümumi sayı deyil.
- 2025–2026 tədris ilində ali təhsilə ~75 min tələbə qəbul olunub ([edu.gov.az](https://edu.gov.az/az/news-and-updates/22236-1)). Bu rəqəmin faktiki qəbul, yoxsa proqnoz olduğu aydın deyil.
