/**
 * 자리마다 글자가 다른 테스트용 문자열을 만든다. 조각을 이어 붙였을 때 위치가 어긋나면 원문과 달라지므로
 * 조각 분할 테스트(NERV Task CLE-T-ZEWGJP)에서 쓴다. `seed` 를 바꾸면 같은 길이로 다른 문자열이 나온다.
 */
export function distinct(length: number, seed = 0): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1)
    out += alphabet[(i * 7 + seed) % alphabet.length];
  return out;
}
