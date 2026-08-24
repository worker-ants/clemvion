# 정식 규약 준수 검토 — `spec/5-system/` (node-output-envelope, impl-done)

## 검토 범위 및 방법

- diff-base `origin/main` 대비 HEAD 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/node-output-envelope-458f05`)에서 `git diff origin/main...HEAD` 로 실제 변경분을 직접 재확인했다 (`spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/conventions/conversation-thread.md`, `codebase/backend/src/modules/websocket/websocket.service.ts`).
- 대조 규약: `spec/conventions/node-output.md`, `spec/conventions/error-codes.md`, `spec/conventions/egress-masking.md`, `spec/conventions/interaction-type-registry.md`, `spec/conventions/swagger.md`, `spec/5-system/2-api-convention.md` 전문을 절대경로로 직접 Read.
- 이번 변경은 실질적으로 **문서 정정 + 그 정정에 맞춘 fail-closed allowlist 코드 확장**이다: (1) `execution.node.completed`/`.failed` wire 의 `output` 필드가 도메인 값이 아니라 `NodeHandlerOutput` 래퍼 전체임을 정정, (2) `error` 필드가 구조화 객체가 아니라 문자열임을 실측 정정, (3) `envelope.output` 에도 `nodeOutput` 과 동일한 fail-closed allowlist 를 적용(종전엔 `nodeOutput` 키만 좁히고 `output` 키는 통과시켰던 gap 을 닫음).

## 발견사항

- **[INFO]** `node-output.md` 에 WS wire 의 `output` 이중 네이밍(래퍼-도메인 충돌) 교차참조가 없음
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.completed`/`.failed` 행 (신규 caveat)
  - 위반 규약: 직접 위반은 아님 — `spec/conventions/node-output.md` Principle 0 / Principle 8.1 ("이중/불필요한 중첩 제거", `output.output.*` 패턴 금지)과의 **교차 완전성** 이슈
  - 상세: 이번 정정으로 WS wire 는 `execution.node.completed`/`.failed` 의 top-level `output` 키 안에 `NodeHandlerOutput` 전체(그 자신도 `output` 필드를 가짐)를 싣는다는 사실이 확정됐다 — 즉 wire 상 `output.output.*` 형태가 실제로 존재한다. 이는 Principle 8.1 이 명시적으로 금지하는 "`output.output.extracted.*`" 이중 중첩과 표면적으로 동일한 모양이다. 물론 이는 **핸들러가 설계한 도메인 output 구조**가 아니라 **WS 전송 봉투가 필드명을 `output` 으로 재사용**해서 생긴 아티팩트이므로 Principle 8.1 자체의 직접 위반은 아니다 (target 문서도 "이름이 겹칠 뿐 다른 층" 이라고 스스로 정확히 캐비엇한다). 다만 `node-output.md` 는 이미 `_resumeState`/`_resumeCheckpoint`/`_retryState` 같은 cross-cutting 예외를 Principle 0 노트에 등록하는 선례가 있는데, 이번에 확정된 WS wire 레벨 `output` 재사용은 그 목록에 없다 — `node-output.md` 만 읽는 독자는 이 wire-level 충돌을 알 길이 없다.
  - 제안: `node-output.md` Principle 0 또는 Principle 8.1 끝에 한 줄 교차참조("WS/EIA fanout wire 는 전송 봉투 필드명으로 `output` 을 재사용해 `output.output` 형태가 나타난다 — SoT: WS §4.1")를 추가하는 편이 완전성 면에서 낫다. target 문서 자체의 서술은 정확하고 충분히 방어적이므로 target 을 고칠 필요는 없고, `node-output.md` 쪽 갱신을 고려할 사안이다 (규약 갱신 제안).

- **[INFO]** REST 엔드포인트 `/api` prefix 표기 불일치 (사전 존재, 본 PR 변경분 아님)
  - target 위치: `spec/5-system/6-websocket-protocol.md` §1.3/§4.2/§4.6/Rationale (`POST /workflows/:id/execute`, `POST /executions/:id/stop` 등, `/api` 미포함) vs §4.1 값-마스킹 캐비엇의 `GET /api/executions/:id` (`/api` 포함) vs §6.2 `GET /executions/:id` (미포함)
  - 위반 규약: `spec/5-system/2-api-convention.md` §2.1 "기본 패턴" (`{base_url}/api/{resource}`) — 정식 REST 경로는 `/api` prefix 를 포함해야 한다.
  - 상세: 같은 문서 안에서 실제로는 동일한 엔드포인트(`/api/workflows/:id/execute` 등)를 어떤 곳은 `/api` 를 붙이고 어떤 곳은 생략해 표기가 갈린다. `git diff origin/main...HEAD` 확인 결과 이 줄들은 이번 PR 의 변경분이 아니라 기존 문서에 이미 있던 표기이므로 이번 작업이 새로 만든 문제는 아니다.
  - 제안: 별도 소정정 turn 에서 `/api` prefix 로 통일 검토(현재 작업 범위 밖이라 이번 PR 을 막을 사유는 아님).

- **[INFO — 확인 결과 문제 없음, 참고용]** 절대 라인 번호 인용
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 신규 CRITICAL 정정 블록 (`execution-engine.service.ts:6302`·`:6378`·`:8018`, `ai-turn-orchestrator.service.ts:1537`)
  - 위반 규약(검토했으나 미해당): `spec/conventions/egress-masking.md` §1 은 "인용은 심볼 기준이다. 절대 라인 번호를 쓰지 않는다 — 리팩터마다 stale 화되기 때문이다" 라고 명시한다. 그러나 이 규칙은 egress-masking.md 자신의 좌표계 표(§1)에 **스코프가 한정**된 자기 규율이며, 프로젝트 전역 "spec 은 절대 라인 번호를 인용하지 않는다" 는 정식 규약으로 별도 선언된 곳은 없다. 실제로 `6-websocket-protocol.md` 자체도 diff 이전부터 `execution-engine.service.ts:2147-2210` 같은 절대 라인 인용을 이미 쓰고 있었다 (기존 관행). 따라서 이번 신규 인용은 기존 문서 관행과 일관되며 CRITICAL/WARNING 사유가 아니다 — 검토 과정에서 확인했다는 사실만 기록해 둔다.

## 정합성 확인 (양호 — 별도 조치 불요)

- `execution.node.completed`/`.failed` 의 `output.output.error` 재정정은 `node-output.md` Principle 3.2/3.2.1 의 `{code, message, details}` 구조와 정확히 일치하는 구조를 가리키며, wire-level `error`(string) 와의 레이어 구분도 명확하다.
- `envelope.output` 에 대한 fail-closed allowlist 확장(`websocket.service.ts` `narrowTopLevelNodeOutput`)은 `spec/conventions/egress-masking.md` 의 정책(표 5행 `stripExternalOnlyFields`/allowlist, "마스킹은 한 번 — 그 뒤 단계는 마커를 덮지 않는다")과 정확히 합치하며, `EIA §R17` 표의 "fail-closed allowlist" 갱신과도 코드-스펙 양쪽이 대응한다.
- WS 마스킹 깊이 상한(`MAX_SANITIZE_DEPTH`) 캐비엇은 `egress-masking.md` §1 좌표계 표(표 2행 vs 표 4행, `>=` vs `>`)와 정확히 일치한다 — 재선언(리터럴 복제) 없이 SoT 링크만 건 것도 `egress-masking.md` 가 요구하는 "마커 리터럴을 적지 않는다" 원칙에 부합한다.
- 에러 코드 표기(`INVALID_MESSAGE`, `UNKNOWN_TYPE`, `SUBSCRIPTION_LIMIT_EXCEEDED`, `RATE_LIMITED`, `RESUME_*`, `RETRY_*` 등)는 모두 `error-codes.md` §1 이 요구하는 `UPPER_SNAKE_CASE` 를 따른다.
- `interactionType` 값(`form`/`buttons`/`ai_conversation`/`ai_form_render`)과 처리 분기 서술은 `interaction-type-registry.md` §1 매트릭스와 정합한다.
- `messages[].source` 2값(`live`/`injected`)과 `ConversationTurnSource` 5값 매핑 서술은 `conversation-thread.md`/`interaction-type-registry.md §2` 범위와 충돌하지 않는다.
- 정정 표기 방식(취소선으로 원문 보존 + "정정" 라벨 + 실측 근거 인용)은 CLAUDE.md 가 규정하는 자기-반증형 소정정의 문서화 스타일과 일관된다.
- `nodeOutput`/`buttonConfig` 등 예시 JSON 에 `type` 판별자 래퍼가 없다 — `node-output.md` Principle 1.1.4 (판별자 폐지)와 합치.
- WS 는 Swagger/OpenAPI 대상이 아니므로 `swagger.md` 의 데코레이터·DTO 명명 규약은 해당 없음(스코프 밖 확인, 위반 아님).

## 요약

이번 변경은 `spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md`·`spec/conventions/chat-channel-adapter.md`·`conversation-thread.md` 에 걸쳐 "wire 의 `output` 필드가 도메인 값이 아니라 `NodeHandlerOutput` 래퍼 전체"라는 실측 사실을 정정하고, 그에 맞춰 `envelope.output` 에도 fail-closed allowlist 를 확장한 코드 변경이다. `node-output.md`(Principle 3.2/3.2.1/8.1/1.1.4), `error-codes.md`(UPPER_SNAKE_CASE), `egress-masking.md`(좌표계·fail-closed 정책), `interaction-type-registry.md` 등 관련 정식 규약과 대조한 결과 CRITICAL/WARNING 급 위반은 발견되지 않았다. 유일하게 눈에 띄는 것은 `node-output.md` 가 이번에 확정된 WS wire 레벨 `output` 이중 네이밍(전송 봉투가 `output` 필드명을 재사용해 `output.output` 형태를 만드는 것)에 대한 교차참조를 갖고 있지 않다는 완전성 갭(INFO)과, 이 PR 과 무관한 기존 REST 경로 `/api` prefix 표기 불일치(INFO, 사전 존재)뿐이다. 정정 방식(취소선 보존 + 실측 인용) 자체도 저장소의 문서 정정 관례에 부합한다.

## 위험도

LOW
