# 신규 식별자 충돌 검토

검토 모드: 구현 완료 후 (`--impl-done`)
대상 범위: `spec/4-nodes/4-integration/` (diff-base: origin/main)

---

## 발견사항

### WARNING: `DB_HOST_BLOCKED` — `spec/2-navigation/4-integration.md` SSRF 에러 코드 열거 표에 미등재

- **target 신규 식별자**: `DB_HOST_BLOCKED` (`spec/4-nodes/4-integration/2-database-query.md` §4/§5.3/§6.2, `spec/5-system/3-error-handling.md` §1.4/§3.2, `codebase/backend/src/nodes/core/error-codes.ts` line 30)
- **기존 사용처**: `spec/2-navigation/4-integration.md` line 1079 에 `EMAIL_HOST_BLOCKED` 가 "send_email 노드는 error 포트 출력 / 연결 테스트는 result.code 반환" 으로 열거되어 있음. Database 대응 항목 없음.
- **상세**: 이번 diff 에서 `spec/5-system/3-error-handling.md` 두 테이블(line 80, 223), `codebase/backend/src/nodes/core/error-codes.ts`, `execution-failure-classifier.ts` `INTERNAL_CODES` 는 모두 갱신됨. `spec/conventions/chat-channel-adapter.md` line 388 의 `DB_*` 와일드카드 표기도 자동 포함. 그러나 `spec/2-navigation/4-integration.md` 는 변경 대상에서 제외되어, Email SSRF(`EMAIL_HOST_BLOCKED`) 항목과 대칭되는 Database SSRF 항목이 누락된 채로 남는다. 독자가 해당 테이블에서 DB SSRF 차단 코드를 찾으면 발견하지 못하는 혼동이 발생한다.
- **제안**: `spec/2-navigation/4-integration.md` 의 SSRF 에러 코드 표(line 1079 근방)에 `| \`DB_HOST_BLOCKED\` | DB host 가 사설/loopback 이라 SSRF 가드에 차단 (기본 ON, \`ALLOW_PRIVATE_HOST_TARGETS\` opt-out) | database_query 노드 error 포트 출력 |` 행을 추가한다. 현 PR 범위에서 해결하거나 `plan/in-progress/http-ssrf-all-auth-followups.md` 후속 항목으로 추적한다.

---

### INFO: `INVALID_PARAMETERS` — 기존 spec 사용처와 의미 일치

- **target 신규 식별자**: `INVALID_PARAMETERS` (`spec/4-nodes/4-integration/2-database-query.md` §5.8/§6.2 — `config.parameters` JSON parse 실패 전용)
- **기존 사용처**: `spec/2-navigation/4-integration.md` line 1082 에 동일 이름·동일 의미로 이미 열거됨.
- **상세**: 의미 완전 일치. 충돌 없음.
- **제안**: 없음.

---

### INFO: Redis 채널 `integration:cache:invalidate` — 기존 정의와 충돌 없음

- **target 신규 식별자**: `integration:cache:invalidate` (Redis pub/sub 채널명, `spec/4-nodes/4-integration/2-database-query.md` §4 / Rationale)
- **기존 사용처**: `spec/0-overview.md` line 244, `spec/5-system/4-execution-engine.md` line 1062/1064, `spec/data-flow/5-integration.md` line 71 에 동일 이름·동일 의미로 이미 등록됨.
- **상세**: 기존 정의와 완전 일치. 충돌 없음.
- **제안**: 없음.

---

## 요약

이번 target(`spec/4-nodes/4-integration/`)이 도입하는 핵심 신규 식별자는 `DB_HOST_BLOCKED`(에러 코드 enum), `INVALID_PARAMETERS`(기존 동일 의미 공존), `integration:cache:invalidate`(Redis 채널)이다. `INVALID_PARAMETERS`와 `integration:cache:invalidate`는 기존 사용처와 의미·형식이 일치하여 충돌이 없다. `DB_HOST_BLOCKED`는 `error-codes.ts`, `2-database-query.md`, `3-error-handling.md`, `execution-failure-classifier.ts`에 일관되게 신설되었으나, `spec/2-navigation/4-integration.md`의 SSRF 에러 코드 열거 표에서 `EMAIL_HOST_BLOCKED` 대응 항목 대비 DB 항목이 누락되어 문서 간 비대칭이 발생한다. 즉각적인 사용자 혼선을 유발하는 CRITICAL 수준은 아니나 명확화가 권장되는 WARNING이다. API endpoint, 요구사항 ID, 파일 경로, 이벤트명 차원의 충돌은 발견되지 않았다.

## 위험도

LOW
