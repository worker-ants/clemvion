# Cross-Spec 일관성 검토 — spec/5-system/14-external-interaction-api.md (durationMs 종결 3종 구현)

## 검토 대상 diff 요약

`origin/main...HEAD` 는 EIA 종결 이벤트(`completed`/`failed`/`cancelled`) `durationMs` 필드를
"미구현(Planned)" → "구현됨"으로 전환한다. 코드( `execution-engine.service.ts` 6곳 completed +
4곳 failed + 6곳 cancelled, `retry-turn.service.ts` 2곳, 신규 `shared/utils/terminal-duration.ts`)
와 `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 · `spec/3-workflow-editor/
3-execution.md` §8.1 · `spec/conventions/chat-channel-adapter.md` §1.2 가 함께 갱신됐다.

## 발견사항

- **[WARNING]** `durationMs` 의 "값은 `null`, 키는 항상 존재" 계약이 §5.4 요구대로 반영됐는데,
  같은 관심사를 다루는 TS 타입 선언 두 곳이 갱신에서 빠졌다 — sibling 필드(`error.code`/
  `nodeId`)에서 이미 한 번 겪은 것과 동일한 형태의 drift
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 "종결 이벤트의 필드 집합"
    표(575행) — `durationMs | 3종 | 구현됨 | 밀리초. **알 수 없으면 null**(형제 error.code 와
    같은 부재 표현)`. [API 규약 §5.4](../5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략)
    의 "기본은 `null`"(181행) 원칙을 정확히 따른 선택이고, `resolveTerminalDurationMs()`
    (`codebase/backend/src/shared/utils/terminal-duration.ts`)는 실제로 모든 16 경로에서 키를
    항상 채우고 값만 `number | null` 로 낸다. 테스트도 `durationMs: null` 을 명시적으로 단언한다
    (`execution-engine.service.spec.ts:3212,19625`).
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` union 의
    `execution.completed`/`execution.failed`/`execution.cancelled` 세 variant 모두
    `durationMs?: number;` (optional, non-nullable) — 그리고 이를 코드로 옮긴
    `codebase/backend/src/modules/chat-channel/types.ts:392,410,423` 의
    `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent.durationMs?: number` 도 동일.
  - 상세: EIA §6 이 선언하는 실제 wire 계약은 "키는 항상 있고 값이 `number | null`"인데, 두
    타입 선언은 "키가 없을 수도 있고 있으면 반드시 `number`"(즉 `null` 은 애초에 대입 불가)다.
    `chat-channel.dispatcher.ts:534,571,587` 은 `event.payload as { durationMs?: number }` 로
    캐스팅해 통과시키므로 컴파일러가 `null` 유입을 잡지 못한다 — 지금은 소비처가 없어 조용히
    지나가지만, 다음에 `durationMs` 를 실제로 읽는 코드(예: 채널 렌더러에 소요시간 표시 추가)가
    "옵셔널이니 값이 있으면 숫자"라 가정하면 `null` 이 그대로 산술에 들어가 오작동한다
    (`null / 1000` → `0`, 크래시는 아니지만 "즉시 완료"로 오표시). 정확히 같은 패턴을
    `error.code`/`nodeId` 에서 겪었고(`plan/in-progress/eia-terminal-payload.md` ③-d·③-e,
    직전 PR #1169 에서 실제로 고쳤다), 이번 PR 의 "spec 동반 변경(전수)" 표
    (`eia-terminal-payload.md` §재판정④)에는 이 타입 두 곳이 목록에 없다 — 등재 자체가 빠졌다.
  - 제안: `spec/conventions/chat-channel-adapter.md` §1.2 의 3개 variant 와
    `codebase/backend/src/modules/chat-channel/types.ts` 의 3개 인터페이스 모두
    `durationMs?: number` → `durationMs: number | null` 로 정정 (developer 턴, `spec/`
    변경 없이 codebase 타입만 고치면 되는 쪽은 즉시 가능하나 convention 문서의 TS 스니펫도
    SoT 미러이므로 함께 고쳐야 함 — `plan/in-progress/eia-terminal-payload.md` 후속 체크리스트에
    등재 권장).

- **[WARNING]** (기지 항목, 이번 diff 밖 — 재확인) `spec/5-system/15-chat-channel.md` 가
  `InteractionRequestContext` 를 "단일 인터페이스 + optional `scope`" 로 서술해 EIA §3.3.1 의
  discriminated union 정의와 어긋난다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §3.3.1 (155~180행) —
    `ExternalInteractionRequestContext` / `InternalInteractionRequestContext` union +
    `isInternalCtx()` 타입 가드로 "v1 구현 완료" 명시.
  - 충돌 대상: `spec/5-system/15-chat-channel.md:319`("`scope: 'in_process_trusted'` 플래그가
    set 된 경우만... 별도 필드 도입") 및 `:507`("`InteractionRequestContext` 에
    `scope?: 'in_process_trusted'` optional 필드만 추가") — 둘 다 단일 인터페이스에 optional
    필드를 추가하는 서술로, EIA 가 이미 구현한 union 분리와 형태가 다르다.
  - 상세: 코드 SoT(EIA §3.3.1)는 이미 union 이므로 런타임 결함은 아니나, 토큰 우회를 가능케
    하는 보안 민감 타입(`scope: 'in_process_trusted'`)의 구조를 다른 문서가 다르게 서술하면
    향후 이 필드를 다루는 개발자가 15-chat-channel.md 만 보고 "단일 인터페이스에 optional
    필드 추가"로 재구현할 위험이 있다.
    이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "타 문서가 EIA 의 현재
    형태를 못 따라간 서술" 절(2026-08-15 등재, `09_00_27` cross_spec)에 등재돼 있다 — 신규
    발견 아님, 미해소 상태 재확인.
  - 제안: 15-chat-channel.md 두 위치를 EIA §3.3.1 을 가리키는 포인터로 교체(이미 plan 이
    제안한 방향). planner 턴 필요(spec 변경).

- **[INFO]** (기지 항목, 이번 diff 밖 — 재확인) EIA §5.1 이 `12-webhook.md §5.2` 를 여전히
  "legacy `statusCode/errors` shape" 로 대비 서술하나, webhook 은 이미 표준
  `{error:{code,message,details}}` 형식으로 정합화되어 그 표현이 실체 없음
  - target 위치: `spec/5-system/14-external-interaction-api.md:317`.
  - 충돌 대상: `spec/5-system/12-webhook.md` — `statusCode`/`errors[]` 패턴이 grep 0건, §5.2 는
    `error.code`/`error.details[]` 만 사용.
  - 상세: 정보 전달 목적의 대비 문구가 유효기간을 넘겨 오독을 유발할 수 있음(실질 계약 충돌은
    아님 — 두 endpoint 군 모두 이미 같은 신규 컨벤션을 씀). `spec-sync-external-interaction-api-
    gaps.md` 에 이미 등재.
  - 제안: "legacy" 대비 문구 제거 또는 "과거엔 달랐으나 현재는 동일 컨벤션"으로 정정.

- **[INFO]** (기지 항목, 이번 diff 밖 — 재확인) `spec/data-flow/15-external-interaction.md:119`
  가 EIA §3.3 에 정의되지 않은 `EIA-AU-09` 를 참조
  - target 위치: EIA §3.3 요구사항 표는 `EIA-AU-01`~`EIA-AU-08` 까지만 정의(136~143행).
  - 충돌 대상: `spec/data-flow/15-external-interaction.md:119` (`interaction.guard.ts
    EIA-AU-08/09`).
  - 상세: 존재하지 않는 요구사항 ID 를 가리키는 dangling 참조. `spec-sync-external-interaction-
    api-gaps.md` 에 이미 등재.
  - 제안: `EIA-AU-09` 제거 또는 실제 대응 요구사항 ID 로 교체.

## 검증했으나 충돌 없음으로 판정한 항목

- `spec/3-workflow-editor/3-execution.md` §8.1 표가 `execution.failed`/`execution.cancelled`
  에 `duration` 컬럼을 추가한 것은 `6-websocket-protocol.md:206`("`durationMs` 를 본 문서
  계열이 `duration` 으로 적어 온 표기 차이는 그대로 둔다")와 일치하고, 표 상단 캐비엇("여기
  적힌 이름·유무를 근거로 구현하지 말 것... EIA §6 이 소유")도 그대로 유지돼 SoT 단일화 원칙을
  깨지 않는다.
- `spec/data-flow/3-execution.md:111` 시퀀스 다이어그램(`UPDATE execution SET
  status='completed'/'failed'/'cancelled', ..., duration_ms, ...`)은 durationMs 구현 전엔 EIA
  §6 표와 불일치했으나, 이 PR 이 실제로 세 상태 모두 `duration_ms` 를 쓰게 만들어 다이어그램
  서술이 사실이 되었다(`eia-terminal-payload.md` §재판정④가 미리 예견). 별도 수정 불요.
- `markQueueWaitTimeout` 경로의 `durationMs` 가 "실행 시간이 아니라 큐 대기 시간"이라는
  캐비엇(EIA §6.5)은 `4-execution-engine.md:956`이 이미 문서화한 "orphan PENDING 은
  `queued_at` 기준, RUNNING 은 `started_at` 기준"의 이중 임계값 구조와 상충하지 않는다
  (PENDING 행도 `started_at` 컬럼을 생성 시점부터 갖는다는 전제와 일치).
- `EiaFailedEvent`의 `error.code`/`nodeId` (`string | null` / `string | null` optional) 타입은
  이미 §6.4 의 nullable 계약과 정합 — 이번 diff 가 건드리지 않았고 문제 없음.

## 요약

이번 diff 는 EIA 종결 이벤트 `durationMs` 를 "Planned → 구현됨"으로 전환하며 §6 필드 집합
표·WS 계열 문서·chat-channel convention 프로즈를 단일 SoT 원칙에 맞춰 잘 동기화했다. 다만
새로 확정된 "키 항상 존재·값은 `null` 가능" 계약이 두 곳의 TypeScript 타입 선언
(`spec/conventions/chat-channel-adapter.md` 의 `EiaEvent` union, `codebase/backend/src/modules/
chat-channel/types.ts` 의 `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`)에는 반영되지
않아 `durationMs?: number` 로 남아 있다 — 직전 PR 에서 `error.code`/`nodeId` 로 이미 한 번
겪은 것과 동일한 형태의 drift 다. 현재는 소비처가 없어 즉시 장애로 이어지진 않지만, 이 PR
자신의 "spec 동반 변경(전수)" 목록에도 빠져 있어 다음 사람이 놓치기 쉽다. 그 외 발견은 모두
이전 라운드(`09_00_27`)에서 이미 등재된 기지 항목의 재확인이며 이번 diff 의 범위 밖이다.

## 위험도

MEDIUM
