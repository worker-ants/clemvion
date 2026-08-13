# Cross-Spec 일관성 검토 — `spec/data-flow/` (impl-done, diff-base=origin/main)

## 검토 범위 확인

이번 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 와
그 테스트(`idempotency.interceptor.spec.ts`) **단 두 파일**로 한정된다. 신규 endpoint·엔티티·
요구사항 ID·상태 전이·RBAC 규칙은 추가되지 않았다. 변경 내용은 `IdempotencyInterceptor` 가 캐시에서
읽은 Redis 엔트리를 "문법은 유효하지만 엔트리 형태가 아닌 값"(`null`/숫자/배열/필드 누락·타입
불일치)까지 방어하도록 넓힌 것 — `isIdempotencyEntry()`/`isHttpStatusCode()` 형태 검증 추가, 안쪽
`responseJson` 파싱을 한 곳으로 모아 손상 시에도 500 이 아니라 fail-open 강등, `discardCorruptEntry()`
로 warn 로그 통일. `spec/data-flow/15-external-interaction.md` 자체는 이번 diff 에서 수정되지
않았다(코드만 변경).

## 대조한 SoT 문서

- `spec/data-flow/15-external-interaction.md` §1.2·§2.2·§Rationale("Fail-open 정책의 일관 표기")
- `spec/5-system/14-external-interaction-api.md` R8 ("Idempotency-Key 와 `submit_form` 검증 실패의
  관계" — 캐시 대상 닫힌 목록 `2xx`/`409`/`410`, "단일 비교로 축약 금지", 캐시 키 스코프
  `interaction:idempotency:<executionId>:<route>:<key>`)
  — bundle 은 예산 초과로 이 파일을 생략했으므로 워크트리 절대경로에서 직접 읽어 대조했다.
- `spec/7-channel-web-chat/**` (idempotency 관련 언급 1건, 무관한 다른 맥락)

## 대조 결과

- **닫힌 목록(`2xx`/`409`/`410`) 유지**: `isErrorStatusCacheable()` 는 `statusCode === 409 ||
  statusCode === 410` 그대로다. 신규 `isHttpStatusCode()`(100–599 범위 sanity check)는 이 목록을
  대체하거나 단일 비교로 축약하지 않는다 — R8 이 명시적으로 금지한 패턴(`>= 400`, `=== 400`)에
  해당하지 않는다.
- **캐시 키 스코프 불변**: `interaction:idempotency:<executionId>:<route>:<key>` 포맷·`rawKey ===
  null` 판정으로의 변경(`readKey`)은 스코프 자체를 건드리지 않는다. R8 "캐시 키 스코프" 절과 충돌
  없음.
- **Fail-open 정책과 정합**: 손상 엔트리를 500 대신 신규 처리로 강등하는 동작은 data-flow §Rationale
  "Fail-open 정책의 일관 표기"("idempotency 저하 = 캐시 미스로 판정돼 다운스트림 중복 실행 가능"이
  이미 문서화된 최악 결과)의 연장선이며, 이번 변경은 그 저하 모드를 좁히는 방향(진짜 손상만 강등,
  스코프·닫힌 목록 판정은 그대로)이라 기존 서술과 모순되지 않는다.
- **RBAC/인가**: `InteractionGuard` 가 인터셉터보다 먼저 실행되는 순서는 불변 — 이번 diff 는 Guard
  이후 단계(캐시 계층)에만 있다.
- **네이밍 충돌 없음**: `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE`/`isHttpStatusCode` 는
  codebase 전역에서 이 파일에만 존재 — 다른 모듈의 동명 상수·에러 코드 규약과 충돌하지 않는다.

## 발견사항

없음 — 이번 diff 는 `spec/data-flow/15-external-interaction.md` 및 그 SoT 인
`spec/5-system/14-external-interaction-api.md` §R8 이 이미 정의한 계약(닫힌 목록·캐시 키 스코프·
fail-open 정책) 범위 안에서의 방어적 구현 강화이며, 다른 spec 영역과 충돌하는 데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임 변경은 없다.

## 요약

diff 는 `IdempotencyInterceptor` 내부의 캐시 엔트리 형태 검증을 추가하는 좁은 범위의 방어적
리팩터링으로, `spec/5-system/14-external-interaction-api.md` R8 이 규정한 캐시 닫힌 목록과 키
스코프 규칙을 그대로 보존하며 fail-open 정책 서술과도 정합한다. `spec/data-flow/15-external-
interaction.md` 본문은 이번 diff 로 수정되지 않았고, 대조한 범위(EIA §R8, web-chat 참조) 내에서
cross-spec 충돌은 발견되지 않았다.

## 위험도

NONE
