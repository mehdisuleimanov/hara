/**
 * Spoken lines owned by lane "nav" (results, Son 50 metr, navigation) — the EXACT strings
 * passed to say(). No RN imports (scripts/gen-voice.ts runs in Node).
 */
import routes from '../../data/routes.json';

export const NAV = {
  start: 'Yola düşdük. Ən az riskli yolla gedirik.',
  hazardUnsignalized: '80 metr sonra işıqforsuz keçid var. Səni işıqforlu keçidə yönləndirirəm.',
  hazardUnmarked: '80 metr sonra nişansız keçid var. Səni işıqforlu keçidə yönləndirirəm.',
  turnLeft: 'Növbəti döngədə sola dön.',
  turnRight: 'Növbəti döngədə sağa dön.',
  slightLeft: 'Bir az sola dön.',
  slightRight: 'Bir az sağa dön.',
  straight: 'Düz davam et.',
  uturn: 'Geri dön.',
  metroBoard: 'Metroya min. Stansiyaları sənin üçün sayıram.',
  metroNext: 'Növbəti stansiyada düşürsən.',
  metroExit: 'Metrodan çıx. Yolun qalanı piyadadır.',
  busBoard: 'Avtobusa min. Dayanacaqları sənin üçün sayıram.',
  busNext: 'Növbəti dayanacaqda düşürsən.',
  taxiBoard: 'Taksiyə otur. Düşmə nöqtəsini mən izləyirəm.',
  taxiWrongSide: 'Diqqət, taksi səni qarşı tərəfdə düşürəcək. Birbaşa keçmə, səni ən yaxın yeraltı və ya işıqforlu keçidə aparacağam.',
  almost: 'Az qaldı, demək olar ki, çatdın.',
  dropMoved: 'Düşmə nöqtəsini dəyişdim. İndi giriş elə sənin tərəfindədir.',
  sentToDriver: 'Yeni düşmə nöqtəsini sürücüyə göndərdim.',
  lastMetersFallback: 'Taksi səni yolun qarşı tərəfində düşürür. Birbaşa keçmə, işıqforlu keçiddən keç.',
} as const;

/** Data-driven but fixed sentences: the "Son 50 metr" notes from the generated route data. */
function lastMetersNotes(): string[] {
  try {
    const opts = (routes as unknown as { options?: Record<string, { lastMeters?: { note?: string } }[]> }).options ?? {};
    return Object.values(opts)
      .flat()
      .map((o) => o?.lastMeters?.note)
      .filter((s): s is string => !!s && !!s.trim());
  } catch {
    return [];
  }
}

export const NAV_LINES: string[] = [...Object.values(NAV), ...lastMetersNotes()];
