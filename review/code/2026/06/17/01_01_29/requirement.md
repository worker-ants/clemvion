# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 1: auth.service.spec.ts — INFO-7 캐스팅 통일

- **[INFO]** `jwtService.sign.mock.invocationCallOrder[0]` 으로 캐스팅 제거 통일
  - 위치: `auth.service.spec.ts` L1056 (패치 기준 `signOrder` 라인)
  - 상세: 기존 `(jwtService.sign as jest.Mock).mock` 을 `jwtService.sign.mock` 으로 교체. `jwtService` 가 `jest.Mocked<JwtService>` 타입으로 선언되어 있으므로(`let jwtService: jest.Mocked<JwtService>`) `.sign` 은 이미 `jest.Mock` 임. 캐스팅 제거는 올바른 방향이며 기능 변경 없음.
  - 제안: 현 변경 유지. spec 충돌 없음.

### 파일 2: totp.service.spec.ts — disable() 테스트 + verifyAndEnable user=null

- **[INFO]** `disable()` 테스트: spec §1.4.1 "TOTP 비활성화 시 NULL" 폐기 동작을 단위 테스트로 커버.
  - 위치: `totp.service.spec.ts` — 신규 `describe('disable')` 블록
  - 상세: spec §1.4.1 표에 "폐기: TOTP 비활성화 시 NULL" 이 명시돼 있으며, 테스트는 `twoFactorEnabled:false`, `twoFactorSecret:null`, `totpRecoveryCodes:null` 세 필드를 단언. `totp.service.ts` 의 `disable()` 구현과 정확히 일치한다.
  - 제안: 현 변경 유지.

- **[INFO]** `verifyAndEnable` user=null 분기 테스트: `usersService.findById` 가 null 반환 시 `BadRequestException` 확인.
  - 위치: `totp.service.spec.ts` — 신규 `it('사용자가 없으면(findById null) BadRequestException')` 케이스
  - 상세: `totp.service.ts` `verifyAndEnable` 의 `if (!user || !user.twoFactorSecret)` 가드 중 `!user` 분기가 테스트되지 않던 문제를 보완. spec §1.4 "TOTP 활성화 흐름" 에서 사용자 미존재 시 예외 처리가 implicit 으로 요구되므로 적절한 보완이다.
  - 제안: 현 변경 유지.

- **[WARNING]** `disable()` 테스트가 **정상 경로만** 단언하며 idempotency(이미 비활성 사용자에 대한 재호출) 케이스를 커버하지 않음.
  - 위치: `totp.service.spec.ts` `describe('disable')` 블록
  - 상세: spec §1.4 "비활성화 시 비밀번호 재확인 + 코드 입력" 은 컨트롤러 레이어 의무이나, `disable()` 자체는 `usersService.update` 를 무조건 호출한다. 이미 `twoFactorEnabled=false` 인 사용자가 `disable()` 를 중복 호출해도 동일 업데이트가 나가는 idempotent 동작이 의도적인지 spec 에서 명시되지 않으며, 테스트에서도 미검증. 실제 서비스 버그는 아니지만 향후 회귀 보호가 약하다.
  - 제안: `twoFactorEnabled:false` 상태로 설정된 사용자에 대해서도 `disable()` 호출 시 `usersService.update` 가 올바른 인자로 호출됨을 단언하는 케이스 추가를 권고. 이는 기능 누락이 아닌 테스트 보완 권고.

### 파일 3: totp.service.ts — W2 OWASP A09 로깅 수정

- **[INFO]** `verifyCode` 의 `logger.warn` 에서 `(err as Error).message` → `(err as Error).name` 변경.
  - 위치: `totp.service.ts` L1427–1429 (패치 내 `+` 라인들)
  - 상세: otplib 내부 에러 메시지(예: 경로 정보, secret 프래그먼트가 포함될 수 있는 문자열)가 로그 집계로 유입되지 않도록 에러 타입명(예: `SecretTooShortError`)만 남김. OWASP A09(보안 로깅 실패) 관점에서 올바른 방향. spec §1.4 "TOTP" 구현 요구사항에 로깅 레벨까지 명시된 부분은 없으므로 spec 충돌 없음.
  - 제안: 현 변경 유지.

### 파일 4: safe-html.test.ts — 빈/공백 입력 경계값

- **[INFO]** 빈 문자열 html 모드: `renderTemplateHtml("", "html")` → throw 없이 빈 string 반환 단언.
  - 위치: `safe-html.test.ts` 신규 `describe('빈/공백 입력 경계값 (ai-review m-4 W5)')` 블록
  - 상세: spec `7-channel-web-chat/4-security.md` §1 입력 sanitize 정책("deny-by-default 화이트리스트 권장, DOMPurify")에서 빈 입력 처리는 명시되지 않으나, `renderTemplateHtml` 이 throw 하지 않고 빈/안전 string 을 반환해야 한다는 동작은 합리적이다. 기존 spec 본문과 충돌 없음.

- **[INFO]** 빈 문자열 markdown 모드 및 공백 markdown: `<script` 미포함 단언.
  - 위치: 동일 describe 블록
  - 상세: SSR 분기(`typeof window === "undefined"`) 가 `null` 을 반환하는 경로와 달리, 일반 환경에서 빈/공백 입력은 string 반환 경로. 테스트가 SSR 단락과 충돌하지 않음을 확인함.

- **[WARNING]** 빈 html 입력 테스트 `expect(result).toBe("")` 가 DOMPurify 동작에 의존하는 구체적 반환값을 가정함.
  - 위치: `safe-html.test.ts` `it("빈 문자열 html → throw 없이 빈 string")`
  - 상세: DOMPurify 가 빈 string을 인자로 받으면 빈 string을 반환함이 실질적으로 보장되나, DOMPurify 버전 업그레이드 시 이 동작이 바뀔 수 있다. 단순히 `typeof result === 'string'` 단언만 해도 경계값 목적을 달성하며 결합도가 낮아진다. 단, 현재도 기능 충족은 되며 실제 사용 중인 DOMPurify 에서 동작이 확인된 상태이므로 Low 위험.
  - 제안: `expect(result).not.toContain('<script')` 또는 `typeof result === 'string'` 정도로 완화하거나 그대로 유지. 선택 사항.

### Spec Fidelity 점검

#### spec/5-system/1-auth.md §1.4 — TOTP 비활성화 필드 일치

- **[INFO]** spec §1.4.1 표: "폐기: TOTP 비활성화 시 NULL" — 구현 `disable()` 는 `{ twoFactorEnabled: false, twoFactorSecret: null, totpRecoveryCodes: null }` 세 필드를 초기화. spec 본문이 `null` 로 명시하며 구현이 일치. 신규 `disable()` 테스트도 세 필드를 모두 단언. 일치함.

#### spec/5-system/1-auth.md §4.3 — LoginHistory 이벤트 enum

- **[INFO]** `auth.service.spec.ts` 에서 `event: 'login_success'` 및 `event: 'token_reuse_detected'` 를 단언하는 테스트가 있음. spec §4.3 이벤트 표에 두 값이 명시(`login_success`, `token_reuse_detected`)돼 있으며 일치. `forgot-password` 흐름에서 loginHistory.record 미호출을 검증하는 테스트도 spec 주석(`spec/5-system/1-auth.md §4.3 이벤트 enum에 forgot/reset 미포함`)과 정합. 일치함.

#### spec/7-channel-web-chat/4-security.md §1 — 입력 sanitize

- **[INFO] [SPEC-DRIFT]** spec §1 "입력 sanitize" 정책은 "deny-by-default 화이트리스트 권장(DOMPurify `ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP`)" 이라고 기술함. `safe-html.test.ts` 는 `ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_URI_REGEXP` 등의 구체적 화이트리스트 동작(svg/math 제거, iframe/object 제거, `data:` scheme 제거, `blob:` scheme 제거 등)을 이미 광범위하게 커버하며 이번에 빈/공백 경계값 3건이 추가됨. spec 본문에 "빈 입력 동작" 명시가 없어 테스트와 미정합 상태가 있을 수 있으나, 이는 spec 의 누락이지 코드 오류가 아님. spec 갱신 여부는 project-planner 위임.
  - 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md` §1 "입력 sanitize" 행
  - 제안: 코드 유지. spec §1 "입력 sanitize" 행 또는 비고에 "빈 입력(empty/whitespace-only) 은 throw 없이 안전한 string 반환(단, SSR 환경에서는 null)" 동작을 1행 추가 고려.

---

## 요약

이번 변경은 직전 ai-review 의 Warning 4건(W2·W3·W4·W5) 과 INFO-7 에 대한 후속 처분으로, 모두 테스트 커버리지 보완 및 로깅 보안 개선에 해당한다. spec §1.4 TOTP 비활성화 필드 정의, §4.3 LoginHistory 이벤트 enum, §7 입력 sanitize 정책과 코드 구현 간의 주요 요구사항은 충족되어 있다. `disable()` 테스트의 idempotency 케이스 누락 및 빈 html 반환값의 DOMPurify 의존 단언은 낮은 위험의 개선 권고 수준이며, 기능 결함은 아니다. spec 대비 코드에서 기능이 의도적으로 확장된 부분(빈 입력 처리, sanitize 세부 동작)이 spec 본문에 반영되지 않은 SPEC-DRIFT 가 1건 있으나 코드는 합리적이고 되돌릴 이유가 없다.

---

## 위험도

LOW
