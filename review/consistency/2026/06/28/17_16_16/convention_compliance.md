# Convention Compliance Review

**검토 모드**: impl-done (scope=spec/5-system/, diff-base=origin/main)
**변경 파일**: `spec/5-system/3-error-handling.md`, `spec/5-system/12-webhook.md`

---

## 발견사항

### [INFO] `spec/5-system/3-error-handling.md` — `## Overview` 섹션 부재 (pre-existing)
- **target 위치**: `spec/5-system/3-error-handling.md` 문서 구조 전체 (H2 레벨)
- **위반 규약**: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
- **상세**: 이 파일은 `## 1. 에러 분류` 로 바로 시작하며 `## Overview` 섹션이 없다. `## Rationale` 섹션은 있다. 본 diff 에서 신규 도입한 결함이 아니라 origin/main 에도 동일하게 없는 pre-existing 상태이며, 이번 변경분(PAYLOAD_TOO_LARGE message 고정 문구 추가)이 해당 결함을 가중하거나 제거하지는 않았다.
- **제안**: 후속 작업에서 `## Overview` 절(에러 처리 정책 문서의 범위·책임 경계 요약)을 추가하는 것이 권장되나, 본 diff 의 변경 범위에서 즉시 수정 의무는 없다.

---

### [INFO] `spec/5-system/3-error-handling.md` — PAYLOAD_TOO_LARGE 설명 셀에 구현 세부 인라인 확장 (형식 INFO)
- **target 위치**: `spec/5-system/3-error-handling.md` §1.3 유효성 검증 에러 표, `PAYLOAD_TOO_LARGE` 행 `설명` 셀
- **위반 규약**: 없음 — 위반이 아님. 에러 코드 설명 셀에 `message` 고정 문구 및 CWE-209 참조를 인라인 서술한 것은 `spec/conventions/error-codes.md` §1(의미 기반 명명)·`spec/conventions/node-output.md §3.2`(`code` 는 `UPPER_SNAKE_CASE`) 어디도 금지하지 않는다.
- **상세**: 신규 추가된 `**`...**` 강조 문구(`message` 고정 문구·CWE-209)는 에러 코드명(`PAYLOAD_TOO_LARGE`) 자체를 변경하지 않고 설명 셀을 보강한다. 에러 코드명은 `UPPER_SNAKE_CASE` 를 유지한다(`spec/conventions/error-codes.md §1`, `node-output.md §3.2`). 규약 위반 없음.
- **제안**: 현 상태 유지 가능. 다만 비-413 4xx http-error 의 고정 문구(`"The request could not be processed."`) 는 `PAYLOAD_TOO_LARGE` 코드 행 설명에 인라인으로 들어 있어, 다른 에러 코드 행에 검색될 때 혼동 여지가 있다. 별도 주석(blockquote)으로 분리하면 가독성이 높아지나 규약상 강제 사항은 아니다.

---

### [INFO] `spec/5-system/12-webhook.md` — Rate Limiting 불릿에 Guard 장애 동작 정책 인라인 추가
- **target 위치**: `spec/5-system/12-webhook.md` §6 구현 세부 Rate Limiting 불릿, `PublicWebhookThrottleGuard` 단락
- **위반 규약**: 없음 — 위반이 아님.
- **상세**: 신규 추가된 **굵은 문구**(`Guard 의 trigger 조회 실패 시에도 fail-open(통과)하되 … error 레벨로 로깅해 …`)는 기존 불릿의 연속 서술로 삽입됐다. 에러 코드명을 새로 도입하지 않고, Webhook 에러 코드(§1.7)·API endpoint·출력 포맷 규약에 영향을 주지 않는다. `spec/conventions/error-codes.md`, `node-output.md`, `swagger.md`, `audit-actions.md` 어떤 규약도 위반하지 않는다.
- **제안**: 이 정책은 구현-수준(logging 전략·fail-open 근거)이어서 `## Rationale` 절에 별도 항목으로 두는 것이 문서 구조상 더 자연스럽다. 그러나 기존 불릿이 이미 설계 근거를 인라인으로 혼합해온 패턴을 따르므로 규약상 강제 사항은 아니다.

---

## 요약

이번 diff(`spec/5-system/3-error-handling.md` · `spec/5-system/12-webhook.md`)에서 변경된 두 부분 모두 정식 규약(`spec/conventions/`) 을 직접 위반하지 않는다. 에러 코드 명명은 `UPPER_SNAKE_CASE` 를 유지하고, 새로운 에러 코드를 신설하지 않았으며, 출력 포맷·API 응답 봉투·감사 액션·Swagger 데코레이터 패턴에 영향을 주지 않는다. `spec/5-system/3-error-handling.md` 의 `## Overview` 절 부재는 pre-existing 이슈로 이번 변경이 유발한 것이 아니며 INFO 수준으로 기록한다.

## 위험도

NONE
