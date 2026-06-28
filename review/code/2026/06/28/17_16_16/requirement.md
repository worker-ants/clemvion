# 요구사항(Requirement) 리뷰 결과

리뷰 대상: 5개 코드 파일 + 리뷰 산출물 (RESOLUTION.md, SUMMARY.md, reviewer 결과 7개, meta/retry JSON)
리뷰 일시: 2026-06-28
Spec 참조: `spec/5-system/3-error-handling.md`, `spec/5-system/12-webhook.md`, `spec/5-system/1-auth.md`

---

## 발견사항

### [INFO] `[SPEC-DRIFT]` http-exception.filter.ts: `mapHttpErrorLike` 413 고정 문구 및 비-413 4xx 정책 — spec 갱신 확인
- **위치**: `codebase/backend/src/common/filters/http-exception.filter.ts` L117–121
- **상세**: 이전 리뷰(17_00_25)에서 SPEC-DRIFT로 지적된 사항이다. 변경된 worktree의 `spec/5-system/3-error-handling.md §1.3` `PAYLOAD_TOO_LARGE` 항목이 이미 갱신되어 있다 — "message 는 내부 원문을 echo 하지 않고 고정 문구 `"Request payload too large."` 만 반환한다(CWE-209 — 비-413 4xx http-error 는 `"The request could not be processed."`, 원문은 서버 로그에만)"가 명시됐다. 코드 구현과 spec이 일치한다.
- **제안**: 해당 없음 — 코드·spec 일치.

### [INFO] `[SPEC-DRIFT]` public-webhook-throttle.guard.ts: trigger 조회 실패 fail-open `error` 레벨 로깅 — spec 갱신 확인
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L79
- **상세**: 이전 리뷰(17_00_25)에서 SPEC-DRIFT로 지적된 사항이다. worktree의 `spec/5-system/12-webhook.md §6`에 "Guard의 trigger 조회 실패 시에도 fail-open(통과)하되, 이는 공개 webhook 보호를 일시 무력화하므로 `error` 레벨로 로깅해 장기 DB 장애로 인한 보호 우회 지속을 모니터링이 조기 탐지하게 한다"가 추가되어 있다. 코드 구현(`logger.error(...)`)과 spec이 일치한다.
- **제안**: 해당 없음 — 코드·spec 일치.

### [INFO] `[SPEC-DRIFT]` client-ip.spec.ts: whitespace 헤더 폴백 동작 — spec 미기술 (선택적)
- **위치**: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L43–55
- **상세**: 공백만 있는 `cf-connecting-ip` → XFF 폴백, 공백만 있는 XFF → null 반환 엣지 케이스 테스트가 추가됐다. `spec/5-system/1-auth.md §2.3`의 클라이언트 IP 정책은 CF → XFF → req.ip 우선순위만 명시하며 "빈 문자열/공백 헤더는 미존재로 취급해 다음 우선순위로 폴백"은 기술하지 않는다. 구현(`pickFirst`가 `value.trim()` 후 빈 문자열이면 undefined)은 방어적으로 올바르다. spec 반영은 선택적이나 명확성을 높인다.
- **제안**: 코드 유지. `spec/5-system/1-auth.md §2.3` 클라이언트 IP 행에 "헤더가 빈 문자열/공백만일 경우 미존재로 취급해 다음 우선순위로 폴백" 추가 고려.

### [INFO] http-exception.filter.spec.ts: 비-413 4xx 테스트 추가 — 이전 WARNING 해소 확인
- **위치**: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` L65–82
- **상세**: 이전 리뷰(17_00_25)의 WARNING 1건(비-413 4xx `mapHttpErrorLike` 분기 미검증)이 해소됐다. `{ status: 400 }` 케이스를 추가해 `body.error.code === 'VALIDATION_ERROR'`, `body.error.message === 'The request could not be processed.'`, `logger.warn` 원문 포함 호출을 모두 단언한다. 기능 완전성 관점에서 적절한 보완이다.
- **제안**: 해당 없음.

### [INFO] public-webhook-throttle.guard.spec.ts: fail-open `logger.error` 호출 검증 — 이전 INFO 해소 확인
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` L189–197
- **상세**: 이전 리뷰(17_00_25)의 INFO 16(fail-open 케이스 `logger.error` 검증 누락)이 해소됐다. `Logger.prototype.error` spy를 주입해 fail-open 시 정확히 1회 호출됨을 단언한다. 모니터링 알람 경로가 테스트로 고정됐다.
- **제안**: 해당 없음.

### [INFO] public-webhook-throttle.guard.ts: `extractClientIp` 래퍼 제거 — 기능 완전성 확인
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` diff 삭제 블록
- **상세**: `extractClientIp` export 함수가 제거되고 `extractClientIpFromHeaders` 직접 호출로 대체됐다. 반환 타입이 `string | undefined`(구) → `string | null`(신)로 변경됐다. Guard 내부에서는 `if (!ip) return true` 패턴이 동일하게 null/undefined 모두를 falsy로 처리하므로 동작은 동등하다. guard.spec.ts에서 `extractClientIp` import가 함께 제거됐고, 기존 4개 테스트는 `client-ip.spec.ts`의 `extractClientIpFromHeaders` 테스트로 이관됐다. 헤더가 모두 없는 경우(구 `undefined`, 신 `null`) 동작도 동일하게 IP 식별 불가 → fail-open이 보장된다.
- **제안**: 해당 없음.

### [INFO] review 산출물 파일 (RESOLUTION.md, SUMMARY.md, reviewer 결과, meta/JSON)
- **위치**: `review/code/2026/06/28/17_00_25/` 하위 파일 전체
- **상세**: 워크플로우 산출물이며 기능 코드가 아니다. RESOLUTION.md의 조치 항목이 코드 변경 내용과 일치한다. 요구사항 충족 분석 대상 외.
- **제안**: 해당 없음.

---

## Spec Fidelity 점검 요약

| 변경 영역 | 관련 Spec | 일치 여부 |
|-----------|-----------|-----------|
| `mapHttpErrorLike` 413 고정 문구 `"Request payload too large."` | `spec/5-system/3-error-handling.md §1.3 PAYLOAD_TOO_LARGE` | 일치 — spec 갱신 완료 |
| `mapHttpErrorLike` 비-413 4xx 고정 문구 `"The request could not be processed."` | `spec/5-system/3-error-handling.md §1.3 PAYLOAD_TOO_LARGE` | 일치 — spec 갱신 완료 |
| trigger 조회 실패 fail-open `logger.error` 격상 | `spec/5-system/12-webhook.md §6` | 일치 — spec 갱신 완료 |
| whitespace 헤더 폴백 동작 | `spec/5-system/1-auth.md §2.3` | SPEC-DRIFT(INFO) — 코드 정확, spec 선택적 갱신 대상 |
| `extractClientIpFromHeaders` 직접 호출 (CF→XFF 우선순위) | `spec/5-system/1-auth.md §2.3` | 일치 — CF/XFF 우선순위 준수 |
| fail-open `logger.error` 단언 테스트 | `spec/5-system/12-webhook.md §6` | 일치 — 구현이 spec과 대응 |

---

## 요약

이번 변경은 이전 리뷰(17_00_25)에서 발견된 WARNING 1건(비-413 4xx 메시지 분기 미검증)과 INFO 2건(logger.warn/logger.error 호출 검증 누락)을 모두 해소했다. `http-exception.filter.ts`의 CWE-209 대응(내부 메시지 echo 차단 및 상태 기반 고정 문구 반환)은 spec `§1.3`에 반영됐고, `PublicWebhookThrottleGuard`의 fail-open `error` 레벨 로깅은 spec `12-webhook.md §6`에 반영됐다. 코드 구현과 spec이 모두 일치하며, SPEC-DRIFT로 남은 항목은 whitespace 헤더 폴백 동작(`1-auth.md §2.3`) 1건으로 코드가 옳고 spec 갱신이 선택적인 경우다. TODO/FIXME/HACK 주석 없음. 모든 반환 경로에서 적절한 값을 반환한다. 에러 시나리오(DB 장애 fail-open, 공백 헤더, 413/비-413 4xx 메시지 마스킹)가 모두 테스트로 커버된다. 요구사항 충족 관점의 Critical/Warning 미발견.

## 위험도

NONE

---

STATUS: PASS
