# 부작용(Side Effect) 리뷰 결과

검토 대상: http-exception filter CWE-209 fix, client-ip 테스트 보강, PublicWebhookThrottleGuard extractClientIp 통합 (후속 리뷰 — RESOLUTION 적용 후)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] `public-webhook-throttle.guard.ts` — `extractClientIp` export 제거 후 외부 참조 잔존 여부 확인

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (diff 삭제 블록)
- 상세: `public-webhook-throttle.guard.ts` 에서 `export function extractClientIp(...)` 가 제거됐다. 동반 spec 파일(`public-webhook-throttle.guard.spec.ts`)에서 해당 import 도 함께 제거됐다. 코드베이스 grep 결과, 이 guard 파일의 `extractClientIp` 를 직접 import 하는 외부 파일은 발견되지 않았다. `hooks.service.ts` 에 별도의 동일 이름 로컬 함수(`function extractClientIp(...)`)가 존재하나 이는 guard 파일 export 와 무관하고 독립적 함수다. 따라서 이번 삭제로 인한 컴파일 오류는 없다.
- 제안: 해당 없음 — 이미 확인 완료.

### [INFO] `hooks.service.ts` — 로컬 `extractClientIp` 함수 잔존 (별건 사본 drift)

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L1002-L1004
- 상세: 이번 변경에서 guard 의 `extractClientIp` 래퍼를 제거하고 `extractClientIpFromHeaders` 직접 호출로 통합했으나, `hooks.service.ts` 에 동일 목적의 로컬 래퍼 함수(`function extractClientIp(headers: Record<string, string>): string | undefined { return extractClientIpFromHeaders(headers) ?? undefined; }`)가 남아 있다. 이 함수는 이번 diff 의 범위에 포함되지 않았다. 단일 구현 통합 목적에 비추면 `hooks.service.ts` 의 래퍼도 후속 정리 대상이 된다. 현재 상태에서 동작 차이는 없으나(내부에서 `extractClientIpFromHeaders` 를 동일하게 위임), 두 번째 래퍼의 잔존으로 "단일 구현 drift 방지" 의도가 반만 달성된 상태다.
- 제안: 후속 PR 에서 `hooks.service.ts` 의 로컬 `extractClientIp` 를 제거하고 `extractClientIpFromHeaders` 를 직접 호출하도록 전환. 현재는 동작 동일이므로 차단 사안 아님.

### [INFO] `public-webhook-throttle.guard.ts` — `logger.warn → logger.error` 레벨 상향의 모니터링 부작용

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L74-L79 (catch 블록)
- 상세: trigger 조회 실패 시 로그 레벨이 `warn` 에서 `error` 로 상향됐다. 의도된 변경(W2 — 모니터링 알람으로 DB 장애 조기 탐지)이나, 프로덕션 DB 일시 장애 시 공개 webhook 요청 수만큼 `error` 레벨 로그가 연속 발생해 alert storm 이 발생할 수 있다. 코드 자체의 부작용은 아니며 운영 절차 사안이다.
- 제안: 모니터링 시스템에서 `PublicWebhookThrottleGuard: trigger 조회 실패` 패턴에 rate-limit 또는 flapping 억제 정책 설정 권장. 코드 변경 불요.

### [INFO] `client-ip.spec.ts` — 신규 테스트의 `process.env` 변경 격리 (afterEach 의존)

- 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L43-L55 (신규 추가 2건)
- 상세: 첫 번째 신규 테스트(`empty/whitespace cf-connecting-ip → falls back to XFF`)는 `process.env.TRUST_CF_CONNECTING_IP = 'true'` 를 설정하고 afterEach 에서의 복원에 의존한다. describe 블록 상단의 `afterEach`(L11-L14)가 `orig` 값으로 원복하는 구조이므로 격리는 정상 동작한다. 두 번째 신규 테스트(`whitespace-only XFF → null`)는 첫 번째 테스트 후 afterEach 가 수행된 후에 실행되므로 env 오염이 없다. 설계상 안전하다.
- 제안: 현 구조 유지. afterEach 복원이 이미 올바르게 동작 중이므로 추가 조치 불요.

### [INFO] `http-exception.filter.ts` — `mapHttpErrorLike` 반환 메시지 변경의 클라이언트 계약 영향

- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` L108-L110 (`mapHttpErrorLike`)
- 상세: `mapHttpErrorLike` 가 반환하는 `message` 필드가 `exception.message` (원본 `'request entity too large'`)에서 상태 코드 기반 고정 문구(`'Request payload too large.'` 또는 `'The request could not be processed.'`)로 변경됐다. CWE-209 정보 노출 방지를 위한 의도적 변경이다. 반환 타입·메서드 시그니처는 변경되지 않았으나, 기존 e2e/통합 테스트 또는 클라이언트 코드가 `'request entity too large'` 원본 문자열을 파싱하거나 기댓값으로 사용했다면 동작 차이가 발생한다. 단위 테스트(`http-exception.filter.spec.ts`)는 새 고정 문구를 검증하도록 업데이트됐다.
- 제안: `'request entity too large'` 문자열을 expect 하는 e2e/통합 테스트 유무를 확인한다. 이번 diff 외부 파일 검색 결과 이를 직접 기댓값으로 쓰는 테스트는 보이지 않으나, 미탐지 가능성을 배제할 수 없다.

### [INFO] review 산출물 파일들 (파일 6-16, 18-24) — 런타임 부작용 없음

- 위치: `review/code/2026/06/28/17_00_25/` 및 `review/consistency/2026/06/28/16_50_18/` 하위 파일
- 상세: 신규 생성된 마크다운·JSON 파일들은 워크플로 산출물이며 런타임 코드 경로에 영향을 주지 않는다. `_retry_state.json` 의 절대 경로 하드코딩은 이식성 문제이나 부작용 관점 런타임 위험 없다.
- 제안: 해당 없음.

---

## 요약

이번 변경 세트는 세 영역으로 나뉜다. (1) `http-exception.filter.ts` 의 CWE-209 메시지 sanitize — 반환 타입·시그니처 변경 없이 값만 달라지므로 구조적 부작용은 없으나 메시지 문자열에 의존하는 외부 클라이언트가 있다면 동작 차이가 발생한다. (2) `public-webhook-throttle.guard.ts` 의 `extractClientIp` export 제거 및 공유 코어 직접 호출 — 외부 참조 없음을 grep 으로 확인해 컴파일 오류 위험 없다. 로그 레벨 `warn→error` 상향은 의도된 변경으로 운영 측면의 alert storm 주의만 필요하다. 단, `hooks.service.ts` 에 동일 역할의 로컬 래퍼 함수가 이번 diff 범위 밖에서 잔존해 단일 구현 통합이 불완전하다. (3) `client-ip.spec.ts` 신규 테스트 — afterEach env 복원 구조가 올바르게 동작해 테스트 격리 부작용 없다. 전역 변수 수정, 파일시스템 의도치 않은 변경, 환경 변수 무단 쓰기, 네트워크 호출 추가, 이벤트·콜백 시그니처 변경은 이번 변경에서 발견되지 않았다.

## 위험도

LOW

---

STATUS: PASS
