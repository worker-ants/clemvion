# Cross-Spec 일관성 검토 결과

**검토 범위**: refactor 03 m-1 — backend NestJS `console.*` → `Logger` 전환 + ESLint `no-console` 가드
**검토 일시**: 2026-06-25
**검토 모드**: --impl-prep (구현 착수 전)

---

## 발견사항

### [WARNING] ai-agent spec §6.2.c.fallback 의 `console.warn` 원문이 spec 에 잔존

- **target 위치**: 본 PR 범위 설명 — "ai-agent spec §6.2.c.fallback 의 console.warn 원문 정정은 planner 위임(별건, 본 PR 미포함)"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 step 2 c.fallback
- **상세**: 해당 spec 행이 `` `console.warn('[processMultiTurnMessage] form submission without pendingFormToolCall — fallback to plain user message', { executionId, nodeId, formData })` `` 를 구현 prescription 으로 명시한다. 본 PR 이 no-console 가드를 활성화한 후 코드베이스가 `this.logger.warn(...)` 으로 전환되면 spec 원문과 코드가 어긋난다. PR 자체가 "별건"으로 인지하고 있으나 위임 완료 시점이 명시되지 않아 이후 일관성 검토에서 false Critical 로 반복 신호될 위험이 있다.
- **제안**: planner 위임 태스크에 명시적 추적 항목을 추가하거나, 본 PR 완료 후 ai-agent spec §6.2.c.fallback 의 `console.warn` 을 `this.logger.warn(...)` 으로 교정하는 별도 spec PR 을 plan/in-progress 에 등록. 본 PR 자체를 차단할 수준은 아니다.

---

### [WARNING] presentation/0-common spec 의 `console.warn` 처방이 no-console 가드 도입 후 불일치

- **target 위치**: 본 PR 범위 외 (명시적 언급 없음)
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` line 407 — `` `console.warn('[processAiResumeTurn] unknown action.type', { executionId, action })` `` 를 구현 prescription 으로 기술
- **상세**: ai-agent §6.2.c.fallback 과 동일한 패턴. 해당 코드 경로가 본 PR 의 전환 4곳에 포함되지 않고 이 파일(presentation/common)의 `console.warn` 도 면제 목록에 없다면, no-console 가드 활성화 후 lint 실패 또는 별도 eslint-disable 주석이 필요해진다. 또한 spec 이 `console.warn` 을 처방으로 계속 유지하면 향후 개발자가 spec 을 따라 `console.warn` 을 다시 쓸 수 있다.
- **제안**: (a) 해당 파일의 `console.warn` 도 본 PR 전환 대상에 포함하거나, (b) 전환했다면 spec 의 `console.warn` 표기를 `this.logger.warn(...)` 으로 정정하는 planner 위임을 ai-agent spec 과 동일 묶음으로 처리.

---

### [WARNING] EIA spec 의 `console.warn` 처방이 no-console 가드 도입 후 불일치

- **target 위치**: 본 PR 범위 외 (명시적 언급 없음)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` line 1108 — "HTTP 오류 시 `console.warn` 후 진행"
- **상세**: 해당 spec 이 프런트엔드(channel-web-chat 위젯 SPA) 코드 맥락인 경우 no-console 가드가 `*.spec` override 나 `scripts/` 제외에 해당하지 않으므로 가드 대상이 될 수 있다. 그러나 위젯 SPA(`codebase/channel-web-chat`)는 별도 eslint 설정을 가질 수 있으므로 실제 충돌 여부는 해당 eslint 구성에 따라 다르다. 백엔드가 대상이라면 직접 충돌.
- **제안**: 해당 경로가 백엔드인지 프런트엔드인지 확인 후, 프런트엔드(위젯)라면 `channel-web-chat` eslint 설정의 no-console 가드 적용 범위를 명확히 문서화. spec 의 `console.warn` 처방은 장기적으로 `logger.warn` 또는 해당 환경의 표준 로그 호출로 교정.

---

### [WARNING] data-flow/1-audit spec 이 `audit-logs.service.ts` 의 `console.warn` 을 명시

- **target 위치**: 본 PR 범위 외 (audit-logs.service.ts 는 전환 4곳에 미포함)
- **충돌 대상**: `spec/data-flow/1-audit.md` line 23 — "`audit-logs.service.ts` 의 `console.warn`"
- **상세**: spec 이 `audit-logs.service.ts` 의 로그 채널로 `console.warn` 을 명기한다. no-console 가드 활성화 후 해당 파일에 `console.warn` 이 남아 있으면 lint 에러가 발생한다. 해당 파일이 본 PR 전환 대상에 포함되지 않으면 lint 실패가 생길 수 있고, 포함됐다면 spec 원문이 구현과 어긋나게 된다.
- **제안**: `audit-logs.service.ts` 의 `console.warn` 도 전환 대상에 포함하거나(eslint-disable 면제 처리), spec 의 해당 문구를 `this.logger.warn` 으로 정정.

---

### [INFO] spec/5-system/3-error-handling.md §6.2 의 로그 형식 처방은 본 PR 과 정합

- **target 위치**: 본 PR 설명 — "spec 3-error-handling.md §6.2 구조화 JSON 로깅 정합"
- **충돌 대상**: `spec/5-system/3-error-handling.md` §6.2
- **상세**: §6.2 는 구조화 JSON 로그 형식(timestamp/level/service/message/context)을 명시하며, NestJS `Logger` 가 이 형식을 채우는 구조적 로그 채널이라는 점에서 본 PR 의 전환 방향과 일치한다. 모순 없음.
- **제안**: 현상 유지. 확인 완료.

---

### [INFO] chat-channel-adapter spec 의 swallow(logger.warn) 처방은 본 PR 과 정합

- **target 위치**: 본 PR 설명 — "chat-channel-adapter.md §swallow(logger.warn) 정합"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md` line 84, line 119
- **상세**: spec 이 이미 `logger.warn` 을 처방하고 있으며 본 PR 의 `modules/mcp/mcp-test-connection.service.ts` 전환과 방향이 일치한다. 모순 없음.
- **제안**: 현상 유지. 확인 완료.

---

### [INFO] code 노드 spec 의 `console.log/warn/error` 는 사용자 샌드박스 맥락으로 본 PR 와 무관

- **target 위치**: 해당 없음 (본 PR 면제 경로와 별개)
- **충돌 대상**: `spec/4-nodes/5-data/2-code.md` (사용자 제공 코드 실행 환경)
- **상세**: 해당 spec 의 `console.log/warn/error` 는 code 노드 사용자 샌드박스 안에서 사용자 작성 코드가 호출하는 표준 JS 전역으로, 백엔드 서비스 코드와 네임스페이스가 다르다. `code.handler.ts` 의 면제 5곳은 pre-bootstrap 경로라 이미 별도 처리됨. 모순 없음.
- **제안**: 현상 유지.

---

## 요약

본 PR(refactor 03 m-1)은 백엔드 NestJS 코드의 `console.*` → `Logger` 전환과 ESLint no-console 가드 추가라는 순수 로그 채널 교체 작업이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서 기존 spec 과의 직접 모순은 발견되지 않았다. 다만 `spec/4-nodes/3-ai/1-ai-agent.md`(§6.2.c.fallback), `spec/4-nodes/6-presentation/0-common.md`(§processAiResumeTurn), `spec/5-system/14-external-interaction-api.md`(soft-fail), `spec/data-flow/1-audit.md`(audit-logs.service.ts) 등 4개 spec 문서가 `console.warn` 을 구현 prescription 으로 명기하고 있어, no-console 가드 활성화 후 spec-코드 불일치가 발생할 수 있다. 이 중 ai-agent §6.2.c.fallback 은 본 PR 이 "planner 위임 별건"으로 명시했으나 나머지 3곳은 언급이 없다. 이 4건 모두 코드 동작을 막는 CRITICAL 수준은 아니지만, 이후 spec-coverage/consistency-check 에서 반복 경보를 유발할 수 있으므로 planner 위임 묶음으로 처리를 권장한다.

---

## 위험도

LOW
