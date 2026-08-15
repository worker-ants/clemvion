# API 계약(API Contract) 리뷰 — `durationMs` 종결 3종 emit 확장

## 방법론 노트

프롬프트 번들이 대부분 파일의 "전체 파일 컨텍스트"를 예산 초과로 생략했다. `Read`로 직접 열어
확인한 파일: `execution-engine.service.ts`, `interaction.service.ts`,
`execution-status-response.dto.ts`, `execution-status.literal.ts`, `chat-channel/types.ts`,
`chat-channel.dispatcher.ts`, `websocket.service.ts`, `notification-fanout.service.ts`,
`execution.entity.ts`, `spec/5-system/14-external-interaction-api.md` §5.3/§5.4. 아래 위치 표기
중 diff 게이트가 있는 것은 게이트 번호를, 번들 밖에서 직접 읽은 파일은 `Read`로 확인한 실제
소스 줄 번호를 썼다(추정 없음).

리뷰 대상 diff(파일 10~23)는 이전 라운드의 `consistency-check` 산출물(리포트 md)이라 API 계약
코드 자체가 아니다 — 그 안의 발견사항은 참고만 하고 별도로 재평가하지 않았다.

## 발견사항

- **[WARNING]** REST 단발 상태 조회(`GET /api/external/executions/:executionId`, EIA §5.3)의
  응답 스키마가 이번 PR로 push 계열(webhook/SSE/WS `execution.completed`/`failed`/`cancelled`)에
  새로 추가된 `durationMs` 를 반영하지 않아, **같은 종결 상태를 두 표면에서 조회할 때 필드
  집합이 갈린다**.
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:106-173`(`ExecutionStatusDto` — `result`/`error`/`seq`/`updatedAt` 는 있으나 `durationMs` 없음), `codebase/backend/src/modules/external-interaction/interaction.service.ts:72-79`(`STATUS_PROJECTION_COLUMNS` — `durationMs` 미포함), `spec/5-system/14-external-interaction-api.md:434-486`(§5.3, 응답 스키마에 `durationMs` 없음 — 이번 diff 가 손대지 않은 구간)
  - 상세: 이번 PR은 §6(Outbound Notification: webhook/SSE/WS 종결 이벤트)에만 `durationMs` 를
    채워 넣었고, §5.3(REST 단발 status poll)·`ExecutionStatusDto`·`STATUS_PROJECTION_COLUMNS` 는
    건드리지 않았다. PR 이전에는 두 표면 모두 `durationMs` 를 안 줬으므로(§6 표가 "Planned"였음)
    최소한 **일관되게 없었다**. 이번 PR로 push 쪽만 채워지면서 "webhook/SSE/WS 로 받으면
    `durationMs` 가 있는데, 연결이 끊겨 재연결 후 `GET /status` 로 같은 execution 을 다시 조회하면
    `durationMs` 가 통째로 사라진다"는 **새로운 비대칭**이 생긴다. 이 갭은 spec-consistency
    라운드(`08_45_50`/`09_00_27`)의 어느 checker 도 지적하지 않았다 — 그쪽은 spec-to-spec 대조만
    하고 spec-to-DTO(코드) 대조는 하지 않기 때문으로 보인다.
  - 제안: `STATUS_PROJECTION_COLUMNS` 에 `durationMs` 를 추가하고 `ExecutionStatusDto` 에
    `durationMs?: number | null`(§5.4 null-vs-키생략 원칙에 따라 `result`/`error` 와 동일하게
    "completed 가 아니면도 present, 값은 null" 패턴 검토)을 노출하거나, 의도적으로 REST 표면에서
    제외한다면 §5.3 문서에 그 사유("확정값은 push 이벤트로만 받는다" 등)를 명시할 것.

- **[WARNING]** chat-channel 내부 소비 타입(`EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`)의
  `durationMs?: number` 선언과 dispatcher 의 캐스팅이 실제 wire 계약(`number | null`, 항상
  present)과 어긋나 **타입이 `null` 케이스를 감춘다**.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392,410,423`(`durationMs?: number;` 3곳), `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534,571,587`(`(event.payload as { durationMs?: number }).durationMs`)
  - 상세: emitter 쪽(`resolveTerminalDurationMs`, `emitCancellationEvent`)은 이번 PR로 **항상**
    `number | null` 을 채워 넣는다(키 생략 없음 — 스펙·구현 주석이 명시적으로 강조하는 지점).
    그런데 소비 측 타입은 `durationMs?: number`(옵셔널 + `null` 미포함)이라, 실제로 오는 `null`
    값이 타입 시스템 밖에 있다. `spec/conventions/chat-channel-adapter.md` 의 diff(파일 26)도
    "알 수 없으면 `null`이라 optional 표기는 유지한다"고 서술하는데, TS 의 `?:` 는 "키가 없을 수
    있다"(→ `undefined`)는 뜻이지 "`null` 이 올 수 있다"는 뜻이 아니다 — 두 개념이 다른데 같은
    표기로 뭉뚱그려졌다. 현재는 어떤 renderer(`providers/*/​*-message.renderer.ts`)도
    `durationMs` 를 소비하지 않아(grep 0건) 즉시 런타임 영향은 없는 dead field 지만, 다음
    사람이 `typeof event.durationMs === 'number'` 없이 산술(예: `formatDuration(durationMs)`)을
    하면 `null` 에서 조용히 깨진다 — 이 저장소가 `error` 필드에서 이미 겪은 클래스의 문제다.
  - 제안: 타입을 `durationMs: number | null;`(항상 present 이므로 required 로) 로 정정하고
    dispatcher 캐스팅도 `{ durationMs?: number | null }` 로 맞출 것. `EiaFailedEvent.error` 가
    `code: string | null` 로 이미 이 패턴을 쓰고 있으니 그 관례를 그대로 따르면 된다.

- **[INFO]** Re-run API 경로의 금지된 URL 버전 세그먼트(`/api/v1/executions/:id/re-run`)를
  `/api/executions/:id/re-run` 으로 정정 — `2-api-convention.md §1`("버전은 URL 경로에
  포함하지 않음")·`13-replay-rerun.md` 정본 표기와 일치시켰다.
  - 위치: `spec/5-system/14-external-interaction-api.md:1112`(§12 호환성)
  - 상세: 이 줄은 사전 라운드의 `convention_compliance` checker(`08_45_50`)가 CRITICAL 로
    지적했던 바로 그 위반이고, 이번 diff 가 실제로 고쳤다. 새 위반이 아니라 기존 규약 위반의
    올바른 해소.
  - 제안: 없음(조치 완료 확인).

- **[INFO]** `durationMs` 를 종결 이벤트(webhook/SSE/WS `execution.completed`/`failed`/`cancelled`)
  payload 에 추가 — additive field 라 EIA §12 Rationale("기존 클라이언트는 unknown field 를
  무시 → 영향 없음")에 따라 **하위 호환성 문제 없음**. `notification-fanout.service.ts:134`
  (`payload: event.payload`)가 payload 를 그대로 통과시켜 webhook 쪽에서도 필드가 strip 되지
  않고 도달함을 확인했다. `null`(알 수 없음) vs 키 생략 구분(§5.4)도 전 경로에서 일관되게
  `?? null` 패턴으로 지켜졌다(engine/retry-turn 서비스 diff 전수 확인).
  - 제안: 없음(계약 설계 자체는 건전).

- **[INFO]** 요청 검증·페이지네이션·인증/인가 — 이번 diff 에 해당 표면 변경 없음(N/A).

## 요약

이번 변경은 종결 이벤트(`completed`/`failed`/`cancelled`) 3종 전부에 `durationMs` 를 채우는
작업으로, 값 계산·영속 책임을 `terminal-duration.ts` 헬퍼로 일원화하고 raw UPDATE 경로는
`RETURNING` 으로 DB 와 wire 값을 일치시키는 등 설계 자체는 건전하며 §12 호환성 Rationale이
말하는 "additive field, 기존 클라이언트 영향 없음" 조건도 실제로 지켜진다. 부수적으로 이번
diff 는 사전에 지적된 `/v1/` URL 버전 세그먼트 위반도 함께 해소했다. 다만 (1) push 표면(§6)에만
필드를 채우고 REST 단발 조회(§5.3, `ExecutionStatusDto`)는 손대지 않아 두 표면 간 응답 스키마가
새로 어긋났고, (2) chat-channel 내부 소비 타입이 실제로는 항상 `number | null` 로 오는 값을
`number | undefined` 로 선언해 타입이 `null` 케이스를 감춘다 — 둘 다 지금 당장 클라이언트를
깨뜨리진 않지만(dead field거나 아직 아무도 안 읽음) API 계약의 정확성을 갉아먹는 실질적 갭이라
WARNING 으로 기록한다.

## 위험도

MEDIUM
