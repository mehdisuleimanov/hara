/**
 * Azerbaijani-correct uppercase: i → İ (dotted), ı → I. Hermes has no 'az' locale data,
 * so String.prototype.toLocaleUpperCase('az') can't be trusted on device.
 */
export function upperAz(s: string) {
  return s.replace(/i/g, 'İ').toUpperCase();
}
