# Plan 정합성 검토 — spec/5-system/ (impl-prep)

검토 대상 작업: `plan/in-progress/ws-event-types-extract.md` (현재 branch
`claude/ws-event-types-extract`, worktree `eia-r8-cache-scope-4ae434`) — `websocket.service.ts`
의 런타임 값(enum/interface/type, `:6~:340`)을 의존성-프리 모듈로 분리해 순환 import 를 끊는
작업. `spec_impact: none`.

> 방법 메모: 프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/4-execution-engine.md` ·
> `6-websocket-protocol.md` · `14-external-interaction-api.md` 본문(이 작업과 가장 관련 깊은
> 3개)을 생략했다. `Read`/`grep` 로 해당 spec·`websocket.service.ts` 실물·연관 plan 을 직접
> 열어 판정했다 — 아래 발견은 번들 누락에 의존하지 않는다.

## 발견사항

- **[WARNING]** 다른 in-progress plan 의 `websocket.service.ts` 라인 인용이 이 리팩터로 무효화된다
  - target 위치: 해당 없음 (target=`spec/5-system/`) — 실제 충돌 지점은
    `codebase/backend/src/modules/websocket/websocket.service.ts` (target 코드베이스, `code:`
    frontmatter 로 `6-websocket-protocol.md`·`14-external-interaction-api.md` 에 귀속)
  - 관련 plan:
    - `plan/in-progress/node-output-redesign/background.md:3,144` — `BACKGROUND_RUN_STARTED/COMPLETED
      (websocket.service.ts:175-176)`
    - `plan/in-progress/spec-draft-eia-62-waiting-payload.md:193-194` — `stripExternalOnlyFields
      (websocket.service.ts:479)` 등 (역사 기록, 이미 `[x]` 처리됨)
    - `plan/in-progress/spec-draft-eia-notification-payload-contract.md:52,55,61` — 생산자
      `emitExecutionEvent(websocket.service.ts L453-489)` / `L576-582` / `broadcastToChannel L471`
      — **이 문서는 `status: in-progress` 이고 `result.outputs`·`chatChannel` 외부 유출 등
      미해결 항목이 이 라인 분석 위에 서 있다.**
  - 상세: `ws-event-types-extract.md` 는 `websocket.service.ts` 의 선언 블록(`:6~:340` — `Execution
    EventType`·`NodeEventType`·`BackgroundRunEventType`·`NotificationEventType`·payload 인터페이스
    등, 실측으로 직접 확인)을 새 모듈로 들어낸다. 이는 (a) 이동되는 심벌 자체의 인용
    (`node-output-redesign/background.md:175-176` — `BackgroundRunEventType` 이 바로 이 범위 안에
    있음, 직접 파일 확인으로 검증)과 (b) 그 아래 남는 메서드(`emitExecutionEvent` 등)의 절대 라인
    번호(약 300줄 이상 위가 빠지므로 `L453-489`·`L471`·`L576-582` 등 전부 하방 shift)를 동시에
    무효화한다. `ws-event-types-extract.md` 의 조치 목록에는 이 인용 갱신/감사 항목이 없다.
  - 이 저장소는 이미 같은 문제를 별도로 인지하고 고치는 중이다 —
    `spec-draft-eia-notification-payload-contract.md:199-200` 자체가 "코드 3곳의 `EIA §6.5 line
    536` 인용에서 줄 번호 제거"를 별도 후속 항목으로 두고 있고, `spec-sync-external-interaction-
    api-gaps.md` 는 "라인 인용은 리팩터마다 stale 화돼 심볼로 고정" 을 명문 교훈으로 적어 뒀다
    (착수 전 리팩터 이력 인용 정정 사례). 이번엔 그 교훈이 대상 파일 밖(다른 plan 문서)의
    인용에는 적용되지 않았다.
  - 제안: `ws-event-types-extract.md` 조치 목록에 "이동 후 `grep -rn 'websocket\.service\.ts:'
    plan/ spec/` 로 하위 인용 재확인 + 심볼 기준으로 갱신(또는 라인 번호 제거)" 항목 1개 추가.
    비용은 낮다(정적 grep + 문구 치환) — 코드 변경이 아니므로 이미 열려 있는 리뷰 신선도
    게이트도 다시 열지 않는다.

- **[INFO]** 새 파일이 `6-websocket-protocol.md` 의 `code:` frontmatter 에 반영되지 않을 소지
  - target 위치: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` (현재
    `websocket.service.ts` 를 개별 파일로 명시, glob 아님)
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` (신설 `websocket-events.types.ts`)
  - 상세: 이 spec 의 `code:` 목록은 (execution-engine 과 달리) `**` glob 이 아니라 개별 파일을
    나열한다. 새 파일이 이벤트 타입/payload 인터페이스의 실제 정의처가 되면, `spec-coverage`
    같은 grep 기반 audit 이 그 새 파일을 못 훑을 수 있다. 다만 이 리팩터는 **재-export 로 기존
    export 표면을 보존**하므로 (spec 이 참조하는 심벌 자체는 여전히 `websocket.service` 에서
    쓸 수 있다) 즉시 깨지는 것은 아니다.
  - 제안: 우선순위 낮음. `ws-event-types-extract.md` 완료 시 `6-websocket-protocol.md` frontmatter
    `code:` 에 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 한 줄 추가 검토
    (spec 본문 변경은 아니므로 `spec_impact: none` 과 모순되지 않음 — frontmatter 메타데이터
    갱신은 developer 권한 범위 내).

## 확인했으나 문제 없음 (기록용)

- **미해결 결정과의 충돌 없음**: `ws-event-types-extract.md` 는 값/타입 이동만 하는 순수
  내부 리팩터이고(“범위 밖”에 `WebsocketService` 책임 분리·`forwardRef` 제거를 명시적으로
  배제), `spec-sync-external-interaction-api-gaps.md` 의 미해결 결정 항목(`result.outputs`
  shape·분산 SSE fan-out·`cancelledBy` 실제 주체 등) 중 어느 것도 이 변경으로 일방 결정되지
  않는다.
- **선행 plan 정합**: 이 plan 이 전제하는 "종결 emit 타입 파사드(`eia-terminal-emit-facade`,
  PR #1174)" 는 실측 결과 `origin/main` 에 이미 병합됨(`8e0728a90`) — 전제가 유효하다. 다만
  `eia-terminal-emit-facade.md` 자체의 체크리스트는 `ai-review`/`impl-done`/`push` 항목이
  `[ ]` 로 남아 실제 병합 상태(merged)를 반영하지 못한다 — plan 위생 이슈이지 이번 작업의
  선행조건 미해소는 아니다(정본 트래커 `spec-sync-external-interaction-api-gaps.md` 가 이미
  `[x] 완료` 로 정확히 기록).
- **후속 항목(코드 심볼 자체)**: 이 리팩터가 닫는 정본 트래커 항목("`websocket.service` 가
  값과 서비스를 함께 export" `17_54_32` W7)은 이 plan 문서에 정확히 1:1 로 연결돼 있고
  "구현 커밋과 같은 턴에 양쪽을 닫는다"는 약속도 명시돼 있다 — 이 축은 정합.

## 요약

`ws-event-types-extract.md` 는 정본 EIA 트래커(`spec-sync-external-interaction-api-gaps.md`)의
등재 항목을 정확히 실행하는 좁은 범위의 내부 리팩터로, 제품 결정이나 spec 본문과 충돌하지
않는다. 다만 그 리팩터가 `websocket.service.ts` 상단 ~300줄을 들어내는 구조적 변경이라, 같은
파일을 라인 번호로 인용하는 다른 세 개의 in-progress plan(`node-output-redesign/background.md`
· `spec-draft-eia-62-waiting-payload.md` · `spec-draft-eia-notification-payload-contract.md`)의
인용이 조용히 stale 화된다 — 특히 마지막 문서는 아직 미해결 항목(`result.outputs`,
`chatChannel` 외부 유출)이 그 인용 위에서 진행 중이다. 이 저장소가 이미 "라인 인용은
리팩터마다 stale 화된다"는 교훈을 별도로 기록해 둔 만큼, 착수 계획에 인용 재확인 한 단계를
추가하는 편이 싸고 정합하다. CRITICAL 급 결정 충돌은 없다.

## 위험도

LOW
