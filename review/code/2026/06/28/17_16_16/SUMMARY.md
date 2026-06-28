# Code Review 통합 보고서

리뷰 대상: codebase/backend — http-exception filter CWE-209 fix 후속 테스트 보강, client-ip 엣지 케이스 테스트, PublicWebhookThrottleGuard fail-open 로그 격상 및 extractClientIp 이관, 이전 리뷰 산출물
리뷰 일시: 2026-06-28 17:16:16

---

## 전체 위험도

**LOW** — Critical/Warning 발견 없음. 전 reviewer PASS. 잔여 항목은 모두 INFO 수준이며 코드 품질 개선 기회에 해당한다. 이전 리뷰(17_00_25)의 WARNING 1건(W1: 비-413 4xx 분기 테스트 미존재) 및 INFO 다수가 이번 변경에서 완전히 해소됐다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

해당 없음.

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` whitespace 헤더 폴백 동작 — `spec/5-system/1-auth.md §2.3` 미기술. 구현(`pickFirst`가 trim 후 빈 문자열이면 다음 우선순위로 폴백)은 방어적으로 정확하고 코드 유지가 맞으나, spec 에 "헤더가 빈 문자열/공백만일 경우 미존재로 취급해 다음 우선순위로 폴백" 추가가 선택적으로 권장됨 | `spec/5-system/1-auth.md §2.3`, `client-ip.spec.ts` L43–55 | spec 갱신 선택적 — 코드 변경 불요 |
| 2 | Side Effect | `hooks.service.ts`에 `extractClientIp` 로컬 래퍼 함수가 잔존(guard 의 래퍼는 제거됐으나 service 측 동일 역할 래퍼 미정리). 단일 구현 통합이 반만 달성된 상태이나 동작 차이 없음 | `codebase/backend/src/modules/hooks/hooks.service.ts` L1002–1004 | 후속 PR 에서 `extractClientIp` 래퍼 제거 후 `extractClientIpFromHeaders` 직접 호출로 전환 |
| 3 | Side Effect | `logger.warn → logger.error` 레벨 상향으로 DB 일시 장애 시 alert storm 가능성. 코드 부작용 아님, 운영 절차 사안 | `public-webhook-throttle.guard.ts` catch 블록 | 모니터링 시스템에서 해당 패턴에 rate-limit 또는 flapping 억제 정책 설정 권장 |
| 4 | Side Effect | `mapHttpErrorLike` 반환 메시지 변경(`'request entity too large'` → 고정 문구)으로 메시지 문자열에 의존하는 외부 e2e/통합 테스트 유무 미검증. diff 외부 파일에서 직접 기댓값 사용 케이스는 미탐지 가능성 있음 | `http-exception.filter.ts` L108–110 | `'request entity too large'` 문자열 expect 케이스가 있는지 e2e/통합 테스트 grep 확인 |
| 5 | Maintainability | `mapHttpErrorLike` 내 숫자 리터럴 `413` 인라인 사용. `HttpStatus.PAYLOAD_TOO_LARGE` 상수가 이미 import 되어 있음. 주석에 lint 회피 이유 설명은 있으나 상태 코드 분기 증가 시 리터럴 누적 가능 | `http-exception.filter.ts` L119 | lint 규칙 충돌 해소 시 상수 치환, 분기 2개 초과 시 `STATUS_MESSAGES` 맵 선언 검토 |
| 6 | Maintainability | 기본 에러 메시지 문자열 두 버전 공존 — `'An unexpected error occurred'`(L36) vs `'An unexpected error occurred. Please try again later.'`(L82). L36은 외부 노출 경로 없어 사실상 dead code이나 향후 메시지 변경 시 누락 위험 | `http-exception.filter.ts` L36, L82 | 클래스 최상단에 `private static readonly DEFAULT_ERROR_MESSAGE` 상수 선언 후 두 위치에서 참조 |
| 7 | Maintainability | `getRequest` 인라인 익명 타입과 테스트 `ReqShape` 간 필드 구조 중복. 필드 추가 시 두 곳 동기화 필요 | `public-webhook-throttle.guard.ts` `canActivate`, `public-webhook-throttle.guard.spec.ts` | named interface(`PublicWebhookReqShape`) 선언 후 테스트에서 import/extends |
| 8 | Maintainability | env 복원 패턴 혼용 — `afterEach` vs `try/finally`가 동일 목적으로 혼용되어 신규 테스트 작성 기준 불명확 | `public-webhook-throttle.guard.spec.ts` CF 테스트 블록 | guard spec CF 테스트에 `beforeEach`/`afterEach` 패턴으로 통일 |
| 9 | Maintainability | 이관 주석 중복 가능성 — `extractClientIp` 이관 설명 주석이 여러 위치에 존재할 수 있음 | `public-webhook-throttle.guard.spec.ts` | 최종 파일에서 단일 위치만 남도록 중복 주석 제거 |
| 10 | Testing | `client-ip.spec.ts` 신규 두 케이스의 `afterEach` 스코프 불일치 가능성 — 첫 케이스가 `TRUST_CF_CONNECTING_IP=true` 설정 후 복원을 `afterEach`에 의존. describe 블록 구조에 따라 격리 취약점 가능 | `client-ip.spec.ts` L43–55 | 첫 케이스에 `try/finally` env 복원 추가 또는 두 케이스를 별도 describe + `afterEach`로 감싸기. 또는 두 번째 케이스 첫 줄에 `delete process.env.TRUST_CF_CONNECTING_IP` 명시 |
| 11 | Testing | `Logger.prototype` spy의 `mockRestore()`가 테스트 말미 위치(afterEach 아님) — 예외 발생 시 spy 잔류 가능성 | `http-exception.filter.spec.ts` L66–81, `guard.spec.ts` errorLog | 장기적으로 `afterEach` 패턴으로 통일 권장 |
| 12 | Testing | 비-413 4xx 케이스에 `requestId` 단언 누락 — 기존 413 케이스에는 있음 | `http-exception.filter.spec.ts` 비-413 케이스 | `expect(body.error.requestId).toBeDefined()` 단언 추가 고려 |
| 13 | Documentation | `extractClientIp` 삭제 후 최종 구현 파일에서 이관 결정 흔적 소멸 — spec 파일에는 이관 주석 있어 비대칭 | `public-webhook-throttle.guard.ts` | `extractClientIpFromHeaders` import 라인 근처에 이관 근거 한 줄 주석 추가(선택적) |
| 14 | Documentation | RESOLUTION.md 의 spec 반영 커밋 포함 여부 확인 필요 — `3-error-handling.md §1.3`, `12-webhook.md §6` spec 변경이 이 PR 에 포함됐는지 별도 확인 | `review/code/2026/06/28/17_00_25/RESOLUTION.md` | spec 반영 커밋이 PR에 포함됐는지 확인; 미포함이면 `plan/in-progress/` 에 열린 항목 확인 |
| 15 | Security | IP 미식별 fail-open 정책 (`if (!ip) return true`) — 공격자가 XFF 헤더를 제거해 rate-limit 우회 가능. 설계 의도 명확하고 RESOLUTION.md에 I5 보류로 명시됨 | `public-webhook-throttle.guard.ts` L108 | 중장기 개선: 인프라 수준 XFF 없는 요청 차단 또는 `req.socket.remoteAddress` 폴백 추가를 별도 plan 추적 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CWE-209 sanitize·extractClientIp 통합·fail-open 로깅 테스트 커버리지 완비. 즉각 조치 필요 취약점 없음 |
| requirement | NONE | 이전 WARNING 1건·INFO 다수 전부 해소. spec·코드 일치. SPEC-DRIFT 1건(whitespace 폴백) 코드 정확·spec 선택적 갱신 |
| scope | NONE | 5개 코드 변경 전부 RESOLUTION 선언 의도와 1:1 대응. 범위 이탈 없음 |
| side_effect | LOW | hooks.service.ts 로컬 래퍼 잔존으로 단일 구현 통합 불완전. alert storm 주의. 런타임 동작 동일 |
| maintainability | LOW | 매직 넘버·에러 메시지 중복·인라인 타입·env 복원 패턴 혼용 등 기존 INFO 패턴 잔존. 즉각 버그 위험 없음 |
| testing | LOW | 비-413 4xx·logger spy 단언 추가 완비. client-ip.spec.ts afterEach 스코프 불일치 잠재 격리 취약점 |
| documentation | NONE | JSDoc·테스트 주석 품질 양호. 이관 근거 흔적 소멸은 선택적 개선 사항 |

---

## 발견 없는 에이전트

모든 에이전트에서 발견사항 있음 (security/requirement/scope/documentation는 INFO 수준만, NONE 위험도).

---

## 권장 조치사항

1. **(후속 PR 권장)** `hooks.service.ts` L1002–1004 의 로컬 `extractClientIp` 래퍼를 제거하고 `extractClientIpFromHeaders` 직접 호출로 전환해 단일 구현 통합을 완성한다.
2. **(테스트 격리 강화)** `client-ip.spec.ts` 의 신규 두 케이스를 별도 describe + `afterEach` 로 감싸거나, 첫 케이스에 `try/finally` env 복원을 추가한다.
3. **(e2e 검증)** `'request entity too large'` 문자열을 expect 하는 e2e/통합 테스트가 없는지 코드베이스 grep으로 확인한다.
4. **(선택적 spec 갱신)** `spec/5-system/1-auth.md §2.3` 에 whitespace 헤더 폴백 동작(`[SPEC-DRIFT]`) 한 줄 추가를 고려한다.
5. **(선택적 문서화)** `public-webhook-throttle.guard.ts` 의 `extractClientIpFromHeaders` 호출부 근처에 이관 근거 한 줄 주석을 추가한다.
6. **(운영 절차)** 모니터링 시스템에서 `PublicWebhookThrottleGuard: trigger 조회 실패` 패턴에 rate-limit/flapping 억제 정책을 설정해 alert storm을 예방한다.
7. **(중장기 plan)** IP 미식별 fail-open 정책에 대해 인프라 수준 XFF 없는 요청 차단 또는 `req.socket.remoteAddress` 폴백 추가를 별도 plan 에 추적한다.

---

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

- **실행 (forced by router_safety)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | router 에 의해 생략 |
| architecture | router 에 의해 생략 |
| dependency | router 에 의해 생략 |
| database | router 에 의해 생략 |
| concurrency | router 에 의해 생략 |
| api_contract | router 에 의해 생략 |
| user_guide_sync | router 에 의해 생략 |
