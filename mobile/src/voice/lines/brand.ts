/** Spoken lines owned by lane "brand" — exact strings passed to say(). No RN imports. */
export const BRAND = {
  /** onboarding page 1 — Əhməd introduces himself */
  hello: 'Salam! Mən Əhmədəm. Bakıda hara getsən, ən az riskli yolu birlikdə tapaq.',
  /** onboarding page 2 — the safer route idea */
  saferRoute: 'Ən qısa yol həmişə ən yaxşısı deyil. Mən işıqforlu keçidi seçirəm.',
  /** onboarding page 3 — "Sadə rejim" switched on */
  simpleOn: 'Sadə rejim açıldı. Yazılar böyükdür, düymələr rahatdır.',
  /** family: grandma arrived */
  neneArrived: 'Nənə evə çatdı. Yolda işıqforsuz keçid olmadı.',
  /** family: SOS sent */
  sosSent: 'Narahat olma. Ailənə canlı yerini göndərdim.',
  /** scooter: calm wind */
  scooterSeafront: 'Külək zəifdir, dənizkənarı velosiped zolağı ilə gedə bilərik.',
  /** scooter: strong wind → inner streets */
  scooterCalm: 'Dənizkənarında güclü qarşı külək var, daxili küçələrlə gedirik.',
  /** scooter: gusts too strong */
  scooterBanned: 'Bu gün külək çox güclüdür. Skuter əvəzinə metro ilə getməyi məsləhət görürəm.',
} as const;

export const BRAND_LINES: string[] = Object.values(BRAND);
