# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

실제 diff(`git diff origin/main...HEAD`)는 `spec/5-system/14-external-interaction-api.md`
(§5.3 `GET /api/external/executions/:id` 응답에 `durationMs` 추가, §6.5 취소 경로
`durationMs` COALESCE/RETURNING 갭 해소 기술)와 `spec/conventions/node-cancellation.md`
(`finalizeCancelledExecution` 0행 재조회 분기 정정) 두 spec 파일 + 대응 backend 코드
(`execution-engine.service.ts` / `retry-turn.service.ts` / `execution-status-response.dto.ts`
/ `interaction.service.ts`)와 사용자 문서(`triggers.mdx`/`triggers.en.mdx`)로 구성된다.
아래는 이 변경이 `spec/**` 의 다른 영역·타 코드 표면과 충돌하는지에 대한 검토다.

## 발견사항

- **[INFO]** Web-chat 위젯 SDK 타입 `ExecutionStatus` 가 신규 `durationMs` 필드를 미러하지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 (`GET
    /api/external/executions/:executionId` 응답에 `durationMs` 신규 추가), 해당 spec
    frontmatter `code:` 목록은 `codebase/channel-web-chat/src/lib/eia-types.ts` 를
    명시적으로 이 spec 의 구현 표면(SoT 코드)으로 지정한다.
  - 충돌 대상: `codebase/channel-web-chat/src/lib/eia-types.ts` 의 `ExecutionStatus`
    interface (line 172-188) — `id`/`workflowId`/`status`/`currentNode`/`context`/
    `result`/`error`/`seq`/`updatedAt` 만 선언하고 `durationMs` 필드가 없다. 같은 파일의
    `eia-events.ts` 도 `durationMs` 를 전혀 다루지 않는다(종결 이벤트 3종에 `durationMs` 를
    실은 앞선 PR #1171 분도 이 SDK 타입엔 반영된 적이 없다).
  - 상세: 이번 diff 로 backend DTO(`execution-status-response.dto.ts`)·spec 본문·
    사용자 문서(`codebase/frontend/src/content/docs/02-nodes/triggers.mdx` /
    `triggers.en.mdx` — "이 재조회 응답에도 종결 이벤트와 같은 `durationMs` 가 들어 있어요")
    세 표면은 동기화됐으나, 같은 spec 이 코드 SoT 로 지정한 네 번째 표면(`eia-types.ts`)만
    누락됐다. 기능적으로는 JS 런타임 객체에 필드가 실제로 실리므로 즉시 깨지는 동작은
    없다(현재 위젯 어느 코드도 `durationMs` 를 읽지 않는다) — 다만 그 SoT 파일을 통해
    타입 안전하게 소비하려는 다음 작업(예: 위젯에 소요시간 표시 추가)이 `as any` 없이는
    이 필드에 접근할 수 없고, 컴파일러가 그 사실을 알려주지도 않는다.
  - 제안: `ExecutionStatus` 에 `durationMs?: number | null;` 을 추가해 backend DTO/spec
    §5.3 와 동일한 optional-nullable 형태로 맞춘다. 종결 이벤트 페이로드(§6 필드 집합 표)를
    다루는 SDK 타입이 별도로 있다면 그쪽도 함께 확인할 것 — 이번 검토에서는 완전 표현이
    확인되지 않았다(전용 completed/failed/cancelled 파서·타입이 `eia-events.ts` 에 없다).

## 교차검증 통과 항목 (참고 — 문제 없음, 근거 기록)

- `data-flow/15-external-interaction.md` §1.2/§2.2 의 idempotency 캐시 키 서술
  (`interaction:idempotency:<executionId>:<route>:<key>`)은 `5-system/14-...` §R8 Rationale
  "캐시 키 스코프" 및 `spec/conventions/redis-keys.md` §3 인벤토리와 문구까지 일치하며,
  실제 구현(`idempotency.interceptor.ts`)도 동일 스코프(`req.interaction.executionId` +
  `context.getHandler().name`)로 키를 합성한다 — 이 축은 이번 diff 의 변경 대상이 아니었고
  기존 상태 그대로 정합했다.
- `spec/5-system/15-chat-channel.md` R-CC-20 은 EIA `Idempotency-Key` 재사용을 명시적으로
  기각하고 전용 `ChatChannelDedupService`(`cc:dedup:*`)를 채택 — in-process trusted 경로가
  HTTP `IdempotencyInterceptor` 를 거치지 않는다는 사실과 일치해 두 메커니즘 간 네임스페이스
  충돌이 없다.
- `finalizeCancelledExecution` 0행 재조회 분기(`node-cancellation.md` 수정분)는 실제
  `execution-engine.service.ts` 구현과 문구까지 일치하며, 인접한 `4-execution-engine.md`
  §1.1/§7.4 의 "RUNNING 중 cancel 은 기록은 즉시, turn 은 즉시 안 끊음" 서술·
  `6-websocket-protocol.md` §4.3 (`_retryState`) "replay 중 cancel → `execution.cancelled`
  발사" 서술과도 모순되지 않는다(별개 코드 경로 — replay turn 경계 gate vs top-level
  `stop()` RUNNING/PENDING 종결).
- `durationMs` 의 §6 normative 필드 집합 표(`5-system/14-...`)·§5.3 getStatus 신규 필드·
  `6-websocket-protocol.md` §2.2 "WS 계열은 같은 값을 `duration` 으로 적는다" 캐비엇이
  서로를 정확히 가리키며 값이 갈리는 서술이 없다.
- API 규약 §5.4 (`null` vs 키 생략) 관점에서 `durationMs?: number | null` +
  `@ApiPropertyOptional({ nullable: true })` DTO 선언은 "null(키 present)" 규칙과
  일치하고, `interaction.service.ts` 가 `execution.durationMs ?? null` 로 항상 키를
  채워 넣어 spec 서술("종결 전에는 null — 키는 present")과 실제 wire 가 같다.

## 요약

이번 diff(EIA `durationMs` getStatus 노출 + `finalizeCancelledExecution` 취소 이벤트
발행 보정)는 `data-flow/15-external-interaction.md`·`conventions/redis-keys.md`·
`4-execution-engine.md`·`6-websocket-protocol.md`·`3-error-handling.md`·
`15-chat-channel.md` 등 인접 영역 및 실제 backend 구현과 문구 단위로 정합하며, 새로
도입한 요구사항 ID·데이터 모델·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다. 유일한
지적은 같은 spec 이 코드 SoT 로 지정한 web-chat 위젯 SDK 타입(`eia-types.ts`)이 이번
필드 추가를 미러하지 못해 네 표면 중 하나만 뒤처졌다는 점이며, 기능적 파급은 없어
INFO 로 등급한다.

## 위험도

LOW
