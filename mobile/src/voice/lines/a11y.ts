/** Spoken lines owned by lane "a11y" — exact strings passed to say(). No RN imports. */
export const A11Y = {
  /** morph transition (A11yMorphHost) */
  seniorOn: 'Sadə rejim açıldı. Mən yanındayam.',
  hcOn: 'Yüksək kontrast açıldı. İndi hər şey daha aydın görünür.',
  standardOn: 'Standart görünüşə qayıtdıq.',
  /** simple home */
  simpleHello: 'Salam! Mən Əhmədəm. Hara getmək istəyirsən? Düyməyə toxun və danış.',
  goHome: 'Evə ən az riskli yolu hazırlayıram.',
  goHilton: 'Hiltona ən az riskli yolu hazırlayıram.',
  goNene: 'Nənənin evinə ən az riskli yolu hazırlayıram.',
  takeHome: 'Yaxşı, səni evə aparıram. Mən yanındayam.',
  whoToCall: 'Kimə zəng edək?',
  whereTo: 'Hara gedirsən?',
  appearance: 'Görünüş. Yazıların ölçüsünü və rəngini seç.',
  tapHint: 'Hər yazıya toxunsan, onu səsli oxuyacağam.',
  /** report */
  reportThanks: 'Sağ ol! Bildirişin yoldan keçənləri qoruyacaq.',
  reportPick: 'Səsini eşitdim. Bunun hansı növ olduğunu seç.',
  /** accessible route */
  escortBooked: 'Müşayiət sifariş edildi. Əməkdaş səni lift qarşısında gözləyəcək.',
} as const;

export const A11Y_LINES: string[] = Object.values(A11Y);
