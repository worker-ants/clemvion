# 보안(Security) 코드 리뷰

## 리뷰 범위

`token` 계열 자격증명이 값-패턴(`SECRET_LEAK_PATTERNS`)·키-패턴(`CREDENTIAL_KEY_PATTERN` ×2)
세 축에서 마스킹 없이 새고 있던 결함을 닫는 변경. 핵심 코드:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 값 패턴(`SECRET_LEAK_PATTERNS`)에
  `access[_-]token|refresh[_-]token|id[_-]token` 3개 명시 대안을 `[A-Za-z0-9_-]*token` 한 대안으로
  흡수(bare `token=` 포함), 키 패턴(`CREDENTIAL_KEY_PATTERN`)에 동일하게 `[a-z0-9_-]*token` 적용.
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 동일 `CREDENTIAL_KEY_PATTERN` 을
  같은 형태로 미러 갱신(WS emit 페이로드 키-마스킹).
- `codebase/backend/src/modules/mcp/mcp-error-codes.ts` — MCP 전용 `MCP_EXTRA_SECRET_PATTERNS`(bare
  `token=`)가 공용 패턴에 흡수되어 배열을 비움(훅은 유지).
- 테스트 3파일 + spec 문서(`11-mcp-client.md`/`14-external-interaction-api.md`/`2-api-convention.md`)
  동기화.

## 발견사항

- **[INFO]** `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 과 공용 `sanitize-error-message.ts`
  의 동명 상수가 "의도된 미러"라고 새 주석이 명시하지만, `x[_-]api[_-]?key` 항목은 공용 쪽에만 있고
  WS 쪽엔 여전히 없다(이번 diff 가 만든 차이는 아니고 기존부터 존재).
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:67`~`75` (신규 주석 블록 +
    `CREDENTIAL_KEY_PATTERN` 선언) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:100`
    (`x[_-]api[_-]?key` 포함)
  - 상세: WS 쪽 `CREDENTIAL_KEY_PATTERN` 은 `x-api-key`/`x-auth-token` 형태의 키를 매칭하지 못한다
    (`x-auth-token` 은 이번 변경의 `[a-z0-9_-]*token` 덕분에 우연히 커버되지만, `x-api-key` 는 여전히
    빠져 있다 — `api[_-]?key` 대안이 `^`로 앵커링돼 있어 `x-` 접두사가 붙으면 매칭 안 됨). 새 JSDoc 이
    "함께 갱신한다"고 선언한 직후라 향후 독자가 두 목록이 완전히 동일하다고 오독할 위험이 있다.
    다만 이 비대칭은 이번 PR 이전부터 있었고(구 패턴에도 `x[_-]api[_-]?key` 없음), 이미
    `review/consistency/2026/08/17/13_31_57/SUMMARY.md` INFO#2 가 동일하게 지적·기록했다.
  - 제안: WS 페이로드가 REST 전용 `x-api-key` 헤더를 echo 할 가능성이 없다고 확정할 수 있으면 주석에
    "REST 전용 확장은 미러 대상 아님"을 한 줄 추가해 의도를 명시(consistency 리포트 제안과 동일). 그
    경로가 실제로 존재한다면 WS 쪽에도 `x[_-]api[_-]?key` 를 추가.

- **[INFO]** `maskSensitiveFields`(`codebase/backend/src/common/utils/mask-sensitive-fields.util.ts`
  의 `DEFAULT_SENSITIVE_KEYS`)는 이번 PR 범위 밖으로 남아, 로깅·workflow-assistant 표면에서 여전히
  접두 `token` 계열(`csrf_token`/`auth_token`/`session_token`/`csrfToken`)이 키 축에서 평문 통과한다.
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (이번 diff 미포함)
  - 상세: 이번 PR 의 plan(`plan/in-progress/eia-secret-pattern-token-family.md` "범위 결정" 절)이 의도적으로
    제외한 항목이고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
    workflow-assistant 항목에 이번 실측을 증거로 첨부해 뒀다고 명시한다 — 즉 알려진 채로 추적 중인
    잔여 노출이며 이번 diff 의 회귀가 아니다. 보안 관점에서 살아있는 갭이라는 사실만 기록해 둔다.
  - 제안: 별도 티켓(이미 트래커에 있음) 진행 시 동일한 `[a-z0-9_-]*token` 형태 적용 검토.

## 확인한 항목 (문제 없음)

- **정규식 안전성(ReDoS)**: `[A-Za-z0-9_-]*token` / `[a-z0-9_-]*token` 은 단일 문자클래스 `*` +
  고정 리터럴 접미사 형태로 중첩 정량자가 없다. plan 이 입력 2배 증가 시 실행시간 정확히 2배(선형)임을
  실측했다고 기록 — 코드 형태로도 이차 백트래킹 소지가 없어 그 결론과 합치한다.
  (`codebase/backend/src/shared/utils/sanitize-error-message.ts:42`,
  `codebase/backend/src/shared/utils/sanitize-error-message.ts:100`,
  `codebase/backend/src/modules/websocket/websocket.service.ts:75`)
- **패턴 확장이 축소를 유발하지 않음**: 제거된 명시 대안(`access[_-]token`/`refresh[_-]token`/
  `id[_-]token`, `[a-z0-9_-]*token` 이전의 websocket 쪽 `token|access[_-]?token|refresh[_-]?token`)은
  전부 새 단일 대안에 흡수되는 진짜 상위집합이다 — 매칭 범위가 넓어지기만 하고 기존에 잡던 형태가
  빠지는 회귀는 없다.
- **재마스킹 방지 계약 불변**: `MASKED_MARKERS`/`isMaskedMarker` 로직은 이번 diff 에서 변경되지 않았고,
  값-패턴 확장이 그 계약을 우회하지 않는다(마스킹된 값을 다시 마스킹하지 않는 안전 방향은 유지).
- **MCP 전용 배열을 비운 것의 등가성**: `MCP_EXTRA_SECRET_PATTERNS` 를 비워도 공용 `SECRET_LEAK_PATTERNS`
  가 bare `token=`/`token:` 을 포함해 상위집합으로 커버함을 `mcp-error-codes.spec.ts` 8건이 그대로
  GREEN(공용만으로)임을 통해 검증했고, 훅(빈 배열 + 확장 지점)은 남겨 제3자 MCP 서버가 새로운 형태를
  echo 하는 경우에 대비했다 — 방어 계층이 얇아지지 않았다.
  (`codebase/backend/src/modules/mcp/mcp-error-codes.ts:54`)
- **egress-only 마스킹 경계 명확**: 새 마스킹은 응답/로그 표면에만 적용되고 DB 원본은 유지되므로(문서
  및 코드 주석이 일관되게 명시), 다운스트림 실행 로직에 대한 부작용이 없다. `nextPageToken` 등 불투명
  커서가 오탐으로 마스킹되는 트레이드오프는 캐너리 테스트로 명시적으로 고정돼 향후 좁히려는 시도가
  결정을 재발견하지 않고 바로 보게 된다
  (`codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:412`).
- **뮤테이션/회귀 커버리지**: 값 축·키 축을 `it.each(FAMILY)` 로 각각 8종씩 고정하고, plan 이 값 축
  되돌리면 6 RED·키 축 되돌리면 8 RED 로 두 축이 독립적으로 관측됨을 확인했다고 기록 — 한 축만 고치고
  다른 축이 조용히 남는 이 저장소의 반복 결함 패턴을 이번엔 피했다.
- **하드코딩 시크릿**: 테스트 파일의 `sk-live-abc123`/`hunter2`/`SUPERSECRETVALUE` 등은 전부 합성
  fixture 이며 실제 자격증명이 아니다.
- **인젝션/인증/암호화/의존성**: 이번 diff 는 정규식 기반 egress 마스킹 로직과 문서 동기화에 국한되며
  SQL/커맨드/경로 인젝션, 인증/인가 로직, 해시/암호화 알고리즘, 서드파티 의존성 변경이 없다.

## 요약

이번 변경은 `token` 계열 자격증명이 값-패턴·키-패턴(두 위치) 세 축 모두에서 마스킹을 우회하던 실제
egress 노출 결함을 닫는 보안 하드닝이다. 확장된 정규식은 기존 매칭 범위의 진짜 상위집합이라 회귀가
없고, ReDoS 선형성 실측·값/키 축 독립 뮤테이션 검증·MCP 전용 패턴을 공용 SoT 로 흡수하며 무수정
프로브로 동치를 확인하는 등 검증 절차가 꼼꼼하다. 남은 항목은 전부 INFO 성격 — (1) WS↔공용
`CREDENTIAL_KEY_PATTERN` 의 `x-api-key` 비대칭은 이번 diff 이전부터 있던 것으로 이미 consistency
리뷰가 포착해 기록했고, (2) `mask-sensitive-fields.util.ts` 의 동일 갭은 의도적으로 범위 밖에 두고
별도 트래커 항목에 증거로 남겨졌다. 이번 diff 자체에서 새로 도입된 취약점이나 방어 축소는 발견되지
않았다.

## 위험도

NONE
