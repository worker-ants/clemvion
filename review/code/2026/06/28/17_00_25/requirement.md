# 요구사항(Requirement) 리뷰 결과

리뷰 대상: 5개 코드 파일 + 7개 리뷰 산출물 파일
리뷰 일시: 2026-06-28
Spec 참조: `spec/5-system/3-error-handling.md`, `spec/5-system/1-auth.md`, `spec/5-system/12-webhook.md`, `spec/conventions/error-codes.md`

---

## 발견사항

### [INFO] `[SPEC-DRIFT]` http-exception.filter.ts: `mapHttpErrorLike` 413 메시지 고정 문구 — spec 미기술
- **위치**: `codebase/backend/src/common/filters/http-exception.filter.ts` L179–183
- **상세**: 변경 전 코드는 `exception.message` (body-parser 원본 `"request entity too large"`)를 클라이언트에 그대로 echo 했다. 변경 후 코드는 CWE-209 정보 누출 방지를 이유로 `errStatus === 413` 이면 `"Request payload too large."`, 나머지 4xx 이면 `"The request could not be processed."`로 고정 문구를 반환한다.
  `spec/5-system/3-error-handling.md §1.3` 은 `PAYLOAD_TOO_LARGE` 코드·413 상태·`GlobalExceptionFilter` 매핑을 정의하지만, 클라이언트에 반환할 `message` 문자열(고정 문구 vs. 원본 echo)은 지정하지 않는다. 구현은 보안 개선(CWE-209)으로 합리적이며 되돌리는 것이 오답이다.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/3-error-handling.md §1.3` `PAYLOAD_TOO_LARGE` 행 또는 `GlobalExceptionFilter` 기술 위치에 "내부 message 를 echo 하지 않고 고정 문구 `Request payload too large.`(또는 상태 기반 일반 문구)를 반환한다(CWE-209)" 를 추가해야 한다.

---

### [INFO] `[SPEC-DRIFT]` http-exception.filter.ts: `mapHttpErrorLike` 비-413 4xx 일반 문구
- **위치**: `codebase/backend/src/common/filters/http-exception.filter.ts` L182
- **상세**: 413 이 아닌 4xx http-error-like 예외에 대해 `"The request could not be processed."` 고정 문구를 반환한다. 현재 spec 은 이 경로(body-parser 외 http-errors 미들웨어 등 장래 경로)의 message 정책을 명시하지 않는다. 주석이 "현재 도달 경로는 body-parser 413 뿐이나, 향후 http-errors 미들웨어 추가에도 안전"이라 의도를 명확히 서술하고 있어 합리적 선제적 구현이다.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/3-error-handling.md §1.3` 또는 `GlobalExceptionFilter` 매핑 설명에 비-413 4xx http-error-like 경로의 message 정책("상태 기반 일반 문구, 내부 message 미전달")을 추가.

---

### [INFO] `[SPEC-DRIFT]` public-webhook-throttle.guard.ts: trigger 조회 실패 로그 레벨 `error` 격상
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L78
- **상세**: 변경 전 `logger.warn`, 변경 후 `logger.error`로 격상. 주석 이유: fail-open이 공개 webhook 보호를 일시 무력화하므로 모니터링 알람이 DB 장애를 조기 탐지하게 한다(W2).
  `spec/5-system/3-error-handling.md §6.1` 로그 레벨 정책은 "WARN — 비정상이지만 복구 가능한 상황(재시도, 폴백)", "ERROR — 시스템 에러, 미처리 예외"로 정의한다. trigger 조회 실패는 복구 가능한 폴백이지만, 공개 webhook 보호가 실질적으로 비활성화되는 상황이라 `ERROR` 격상이 보안 모니터링 측면에서 합리적이다. spec 은 이 특수 케이스를 명시하지 않는다.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/3-error-handling.md §6.1` 또는 `spec/5-system/12-webhook.md` fail-open 절에 "trigger 조회 실패 fail-open 은 보호 우회를 의미하므로 `ERROR` 레벨 로깅"을 추가.

---

### [INFO] `[SPEC-DRIFT]` client-ip.spec.ts: whitespace-only 헤더 엣지 케이스 커버리지 추가
- **위치**: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L358–370 (추가된 2개 테스트)
- **상세**: 공백만 있는 `cf-connecting-ip` → XFF 폴백 테스트와 공백만 있는 XFF → `null` 반환 테스트가 추가됐다. 구현(`pickFirst`)이 `value.trim()` 후 빈 문자열이면 `undefined`를 반환하는 방식으로 이미 이 엣지 케이스를 처리하고 있다. `spec/5-system/1-auth.md §2.3 클라이언트 IP` 규칙은 우선순위만 정의하며 공백 헤더의 폴백 동작을 명시하지 않는다. 구현·테스트 모두 방어적으로 올바르다.
- **제안**: 코드 유지 + spec 반영 필요성 낮음(엣지 케이스 구현 세부). `spec/5-system/1-auth.md §2.3` 클라이언트 IP 행에 "헤더가 빈 문자열/공백만일 경우 미존재로 취급해 다음 우선순위로 폴백"을 추가하면 명확성이 높아진다.

---

### [INFO] public-webhook-throttle.guard.spec.ts: `extractClientIp` 임포트 제거 및 테스트 이관
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` diff L7–14, L269–294
- **상세**: Guard spec에서 `extractClientIp` 헬퍼 함수와 그 4개 테스트를 제거하고, 이를 `auth/utils/client-ip.spec.ts`로 이관했다. `public-webhook-throttle.guard.ts`에서 `extractClientIp`(래퍼) 함수 자체도 제거되고 `extractClientIpFromHeaders`를 직접 호출한다. 기능 완전성 측면에서 문제가 없다 — 이전에 `extractClientIp({ ... })` 헤더 경로 테스트로 커버하던 엣지 케이스들이 `extractClientIpFromHeaders` 테스트로 이관됐고, Guard 레벨 통합 테스트는 CF/XFF 헤더 처리를 계속 검증한다. 이관 후 Guard 측에서 "XFF 다중 IP 중 첫 번째만" 케이스는 `auth/utils/client-ip.spec.ts`에서 이미 커버되고 있다(`CF off → ignores CF header, uses XFF first IP`).

---

### [INFO] review 산출물 파일들 (파일 6–12): 기능 완전성 관점 해당 없음
- **위치**: `review/consistency/2026/06/28/16_50_18/` 하위 파일들
- **상세**: consistency check 워크플로우 산출물 파일들(SUMMARY.md, _retry_state.json, 각 checker 결과)이다. 기능 코드가 아니므로 요구사항 충족 관점의 코드 분석 대상이 아니다. `_retry_state.json`의 `agents_success: []`, `agents_fatal: []` 상태는 session 초기화 시점의 스냅샷이며 정상이다.

---

## Spec Fidelity 점검 요약

| 변경 | 관련 Spec | 일치 여부 |
|------|-----------|-----------|
| `mapHttpErrorLike` 413 message 고정 문구 | `spec/5-system/3-error-handling.md §1.3` | SPEC-DRIFT — 코드 정확, spec 미기술 |
| `mapHttpErrorLike` 비-413 4xx message | `spec/5-system/3-error-handling.md §1.3` | SPEC-DRIFT — 코드 정확, spec 미기술 |
| trigger fail-open `logger.error` 격상 | `spec/5-system/3-error-handling.md §6.1` | SPEC-DRIFT — 코드 정확, spec 미기술 |
| `extractClientIpFromHeaders` 직접 호출 | `spec/5-system/1-auth.md §2.3` | 일치 (CF→XFF→req.ip 우선순위 준수) |
| whitespace header 폴백 | `spec/5-system/1-auth.md §2.3` | SPEC-DRIFT — 코드 정확, spec 미기술 |
| `extractClientIp` 래퍼 제거 | `spec/5-system/1-auth.md` | 일치 (단일 구현 통합 방향과 부합) |

---

## 요약

모든 코드 변경은 의도한 기능을 완전히 구현하고 있으며 Critical/Warning 수준의 요구사항 위반이 없다. `http-exception.filter.ts`의 내부 message echo 차단(CWE-209)과 `PublicWebhookThrottleGuard`의 fail-open 로그 레벨 `error` 격상은 보안과 모니터링 측면에서 합리적인 의도적 개선이다. `extractClientIp` 래퍼 함수 제거 및 `extractClientIpFromHeaders` 직접 호출로의 통합은 단일 구현 원칙에 부합한다. 공백 헤더 폴백 동작은 구현과 테스트 모두 올바르게 처리된다. 다만 이 개선 사항들이 `spec/5-system/3-error-handling.md §1.3`·`§6.1` 및 `spec/5-system/1-auth.md §2.3`에 아직 반영되지 않아 4건의 SPEC-DRIFT(모두 INFO)가 존재한다. 이들은 코드 버그가 아니라 spec 갱신 누락이며 `project-planner`/`resolution-applier`의 spec 반영 경로로 처리해야 한다. TODO/FIXME 주석 없음. 모든 반환 경로가 적절한 값을 반환한다. 에러 시나리오(DB 장애 fail-open, 공백 헤더, 순환 참조 body)가 모두 테스트로 커버된다.

## 위험도

NONE
