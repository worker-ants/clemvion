# 신규 식별자 충돌 검토

## 검토 대상

- **변경 범위**: `spec/5-system/1-auth.md` (1행 수정), `codebase/backend/src/common/filters/http-exception.filter.ts`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`, `codebase/backend/src/modules/hooks/hooks.service.ts` 및 관련 spec 파일
- **검토 모드**: impl-done (diff-base = origin/main)

---

## 발견사항

이번 변경이 도입·노출하는 신규 식별자는 다음 4종이다.

1. **`PublicWebhookReqShape`** — `public-webhook-throttle.guard.ts` 에서 신규 export 된 interface
2. **`UNKNOWN_ERROR_MESSAGE`** — `GlobalExceptionFilter` 의 `private static readonly` 상수 (신규)
3. **`UNHANDLED_ERROR_MESSAGE`** — `GlobalExceptionFilter` 의 `private static readonly` 상수 (신규)
4. **spec §2.3 클라이언트 IP 행** — `extractClientIp(req)` · `extractClientIpFromHeaders` 두 함수명을 spec 본문에 명시적으로 새로 기재

충돌 판정 결과는 아래 각 항목에 정리한다.

---

### 발견사항

- **[INFO]** `PublicWebhookReqShape` — 기존 `ReqShape` 와의 관계 명확화 필요
  - target 신규 식별자: `export interface PublicWebhookReqShape` (`public-webhook-throttle.guard.ts` L160)
  - 기존 사용처: `public-webhook-throttle.guard.spec.ts` 에 `export interface ReqShape`(익명 타입) 가 동일 파일에 존재했고, 이번 변경으로 `type ReqShape = PublicWebhookReqShape` alias 로 교체됨. 현재 코드베이스 내 `ReqShape`(alias 제외) 및 `PublicWebhookReqShape` 는 오직 `hooks` 모듈 두 파일에만 존재하며 다른 모듈에 동명 타입 없음.
  - 상세: 기존에 spec 파일(`.guard.spec.ts`)에서 `export interface ReqShape` 로 정의·export 됐던 타입이 guard 본체로 이동·승격됐다. alias `type ReqShape = PublicWebhookReqShape` 는 spec 파일 내부 전용이라 외부 누출 없음. `PublicWebhookReqShape` 명칭은 다른 영역(auth, execution, channel 등)에 동명 타입 없음. 충돌 없음.
  - 제안: 현행 유지. 필요 시 JSDoc 에 "public-webhook request shape — guard 와 테스트가 공유" 한 줄 추가.

- **[INFO]** `UNKNOWN_ERROR_MESSAGE` / `UNHANDLED_ERROR_MESSAGE` — private 상수, 외부 노출 없음
  - target 신규 식별자: `private static readonly UNKNOWN_ERROR_MESSAGE` · `private static readonly UNHANDLED_ERROR_MESSAGE` (`GlobalExceptionFilter`)
  - 기존 사용처: 전체 코드베이스(spec 포함) 검색 결과 동일 이름의 상수·변수 없음. 이전에는 해당 메시지가 인라인 문자열 리터럴로 사용됐다(`message = 'An unexpected error occurred'`).
  - 상세: `private static readonly` 이므로 클래스 외부에서 접근 불가. 동명 상수가 다른 클래스·모듈에 존재하지 않아 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** spec §2.3 — `extractClientIp` / `extractClientIpFromHeaders` 함수명 명시
  - target 신규 식별자: spec 본문에 `extractClientIp(req)` · `extractClientIpFromHeaders` 두 함수명이 구체적으로 언급됨 (이전 행에는 함수명 없이 행위 설명만 있었음)
  - 기존 사용처: `codebase/backend/src/modules/auth/utils/client-ip.ts` 에 `extractClientIp` (L37) · `extractClientIpFromHeaders` (L62) 로 이미 구현·export 됨. `hooks.service.ts` 에 있던 모듈 내부 래퍼 `function extractClientIp(headers)` 는 이번 PR 에서 제거됐고 직접 `extractClientIpFromHeaders` 를 호출하도록 전환됨.
  - 상세: spec 이 함수명을 직접 인용한 것은 구현과 정합한다. 이전에는 `hooks.service.ts` 에 동명(`extractClientIp`) 의 지역 함수가 있어 `auth/utils/client-ip` 의 `extractClientIp` 와 같은 이름으로 공존했으나, 이번 PR 이 지역 함수를 제거해 이름 혼동이 해소됐다.
  - 제안: 현행 유지. spec 의 함수명 인용은 코드와 일치한다.

---

## 요약

이번 변경이 도입하는 신규 식별자 — `PublicWebhookReqShape`(신규 export), `UNKNOWN_ERROR_MESSAGE`·`UNHANDLED_ERROR_MESSAGE`(클래스 내부 private 상수), spec 본문의 `extractClientIp`·`extractClientIpFromHeaders` 함수명 명시 — 는 모두 기존 코드베이스·spec 에서 다른 의미로 이미 사용 중인 이름과 충돌하지 않는다. 특히 `hooks.service.ts` 의 지역 래퍼 `extractClientIp` 가 이번 PR 에서 제거되어 `auth/utils/client-ip` 의 동명 함수와의 잠재적 혼동이 해소됐다. API 엔드포인트·이벤트명·환경변수·파일 경로 차원의 신규 식별자는 없다. 위험도 수준에서 차단이 필요한 항목은 발견되지 않았다.

## 위험도

NONE
