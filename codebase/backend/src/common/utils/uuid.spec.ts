import {
  type ArgumentMetadata,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { isUuidShaped, isValidUuid } from './uuid';

describe('isValidUuid', () => {
  it('accepts canonical lowercase UUIDs (v1–v5)', () => {
    expect(isValidUuid('11111111-1111-1111-8111-111111111111')).toBe(true); // v1
    expect(isValidUuid('11111111-1111-4111-8111-111111111111')).toBe(true); // v4
    expect(isValidUuid('8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234')).toBe(true);
  });

  it('accepts uppercase (case-insensitive)', () => {
    expect(isValidUuid('AAAAAAAA-1111-4111-8111-AAAAAAAAAAAA')).toBe(true);
  });

  it('rejects empty / non-string-shaped input', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('doc-abc')).toBe(false);
  });

  it('rejects wrong version / variant nibble', () => {
    // version nibble 0 (must be 1–5)
    expect(isValidUuid('11111111-1111-0111-8111-111111111111')).toBe(false);
    // version nibble 6 (out of 1–5)
    expect(isValidUuid('11111111-1111-6111-8111-111111111111')).toBe(false);
    // variant nibble 7 (must be 8/9/a/b)
    expect(isValidUuid('11111111-1111-4111-7111-111111111111')).toBe(false);
  });

  it('rejects malformed structure (length / separators / non-hex)', () => {
    expect(isValidUuid('11111111-1111-4111-8111-11111111111')).toBe(false); // short
    expect(isValidUuid('11111111-1111-4111-8111-1111111111111')).toBe(false); // long
    expect(isValidUuid('111111111111141118111111111111111111')).toBe(false); // no dashes
    expect(isValidUuid('gggggggg-1111-4111-8111-111111111111')).toBe(false); // non-hex
    expect(isValidUuid(' 11111111-1111-4111-8111-111111111111')).toBe(false); // leading space
  });
});

describe('isUuidShaped', () => {
  it('rejects the same garbage isValidUuid rejects', () => {
    expect(isUuidShaped('')).toBe(false);
    expect(isUuidShaped('not-a-uuid')).toBe(false);
    expect(isUuidShaped('11111111-1111-4111-8111-11111111111')).toBe(false); // short
    expect(isUuidShaped('11111111-1111-4111-8111-1111111111111')).toBe(false); // long
    expect(isUuidShaped('111111111111141118111111111111111111')).toBe(false); // no dashes
    expect(isUuidShaped('gggggggg-1111-4111-8111-111111111111')).toBe(false); // non-hex
    expect(isUuidShaped(' 11111111-1111-4111-8111-111111111111')).toBe(false); // leading space
  });

  /**
   * 이 세 값이 **두 술어의 경계**다. 왜 느슨한 술어를 골랐는가(403→400 뒤바뀜)와 앵커
   * 정정 이력은 `uuid.ts` 의 `isUuidShaped` docstring 이 SoT 다.
   *
   * **이 테스트가 그 회귀 캐너리다.** 자매는 `workspace-context.util.spec.ts` 의 nil UUID
   * 통과 테스트이고, 2026-09-12 부터 keyset 커서 쪽 캐너리 둘이 더 있다
   * (`login-history.service.spec.ts` · `background-runs.service.spec.ts` 의 `[대조군]`).
   *
   * > **"호출부는 한 곳뿐" 이라고 적혀 있었다 — `#1328` 후속 배치가 그 문장을 거짓으로
   * > 만들었다**(`review/code/2026/09/12/23_40_57` testing WARNING). 커서 검증이 소비처를
   * > 둘 더 만들었기 때문이다. **개수를 다시 박지 않는다** — 또 낡는다. 세는 법을 적는다:
   * >
   * > ```bash
   * > grep -rn 'isUuidShaped(' --include='*.ts' codebase/backend/src \
   * >   | grep -v '\.spec\.ts' | grep -v 'shared/testing/' | grep -v 'utils/uuid.ts:'
   * > ```
   * >
   * > **마지막 필터가 없으면 함수 *정의부*가 함께 잡혀 4줄이 나온다** — 첫 판본이 그랬고,
   * > *"다음 사람이 이 명령으로 재검증한다"* 는 이 docstring 의 존재 이유가 **첫 실행부터**
   * > 무너져 있었다 (`review/code/2026/09/13/00_13_51` requirement WARNING). 측정 명령
   * > 자체가 틀릴 수 있다는 것을 이 자리가 다시 보여 준다.
   * >
   * > 2026-09-13 실측은 3곳(`workspace-context.util.ts` · `login-history.service.ts` ·
   * > `background-runs.service.ts`)이다. 소비처가 늘면 **그 자리의 캐너리도 함께** 있어야
   * > 이 경계가 지켜진다 — 이 파일만으로는 부족하다.
   *
   * `roles.guard.spec.ts` 도 nil UUID 를 쓰지만 그쪽은 **전역 라우트** 케이스라 같은
   * 단축에 걸려 술어에 닿지 않으므로 이 경계의 방어선으로 세면 안 된다.
   */
  it('accepts UUID-shaped values that isValidUuid rejects (nil / v6+ / 비-RFC variant)', () => {
    const nil = '00000000-0000-0000-0000-000000000000';
    const v7 = '018f3c6b-1a0d-7e4a-9c1d-2f0e5a8b1234';
    const oddVariant = '11111111-1111-4111-7111-111111111111';

    for (const value of [nil, v7, oddVariant]) {
      expect(isUuidShaped(value)).toBe(true);
      expect(isValidUuid(value)).toBe(false);
    }
  });

  it('accepts what isValidUuid accepts (상위집합이다)', () => {
    for (const value of [
      '11111111-1111-1111-8111-111111111111',
      '8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234',
      'AAAAAAAA-1111-4111-8111-AAAAAAAAAAAA',
    ]) {
      expect(isValidUuid(value)).toBe(true);
      expect(isUuidShaped(value)).toBe(true);
    }
  });
});

/**
 * 경로 파라미터의 `ParseUUIDPipe`(옵션 없음)가 받는 범위를 고정한다.
 *
 * 이 범위는 Nest 버전을 따라 바뀐다. Nest 11 은 8-4-4-4-12 hex 모양이면 모두 받았고(`isUuidShaped`
 * 와 같았다), Nest 12 는 버전 자리 1~8 과 RFC variant(`8` · `9` · `a` · `b`), nil · max UUID 만
 * 받는다(NERV Task CLE-T-3X627J 에서 확인). 표본은 경계 양쪽(버전 0 · 1 · 8 · 9 · `f`, variant
 * `7` · `8` · `b` · `c`)을 두어 다음 Nest 상향에서 경계가 움직이면 여기서 실패하게 한다.
 *
 * 받는 값은 모두 `isUuidShaped` 도 통과해야 한다. `RolesGuard` 는 파이프보다 먼저 `isUuidShaped`
 * 로 판정하므로 파이프가 그 밖의 값을 받게 되면 가드가 판정하지 않은 값이 핸들러에 닿는다.
 */
describe('ParseUUIDPipe 기본 범위 (경로 파라미터)', () => {
  const pipe = new ParseUUIDPipe();
  const metadata: ArgumentMetadata = { type: 'param', data: 'id' };

  it.each([
    ['비-RFC variant 7', '11111111-1111-4111-7111-111111111111'],
    ['비-RFC variant c', '11111111-1111-4111-c111-111111111111'],
    ['버전 자리 0', '11111111-1111-0111-8111-111111111111'],
    ['버전 자리 9', '11111111-1111-9111-8111-111111111111'],
    ['버전 자리 f', '11111111-1111-f111-8111-111111111111'],
    ['모양만 맞는 값', '11111111-1111-1111-1111-111111111111'],
    ['nil 에서 한 글자 다른 값', '00000000-0000-0000-0000-000000000001'],
  ])('%s 는 400 으로 막는다', async (_label, value) => {
    expect(isUuidShaped(value)).toBe(true);
    await expect(pipe.transform(value, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    ['버전 1', '8f3c6b1a-0d2e-1a7e-8c1d-2f0e5a8b1234'],
    ['버전 4', '8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234'],
    ['버전 7', '018f3c6b-1a0d-7e4a-ac1d-2f0e5a8b1234'],
    ['버전 8', '8f3c6b1a-0d2e-8a7e-bc1d-2f0e5a8b1234'],
    ['nil', '00000000-0000-0000-0000-000000000000'],
    ['max (대문자)', 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'],
    ['max (소문자)', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
  ])('%s 는 받는다', async (_label, value) => {
    expect(isUuidShaped(value)).toBe(true);
    await expect(pipe.transform(value, metadata)).resolves.toBe(value);
  });
});
