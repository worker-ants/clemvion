# Cross-Spec 일관성 검토 — `spec/5-system/` (`node-output-envelope`, `12_42_20`)

## 컨텍스트

- HEAD = `20ec30308`. diff 범위(`origin/main...HEAD`, spec 만): `spec/5-system/{6-websocket-protocol,14-external-interaction-api,15-chat-channel}.md`,
  `spec/conventions/{chat-channel-adapter,conversation-thread}.md`. 코드: `websocket.service.{ts,spec.ts}`.
- 이 브랜치는 이미 5+ 라운드의 `/consistency-check` + `/ai-review` 를 거쳤다(`10_44_28`→`12_02_30`
  →`12_13_36`→`12_24_55`→`20ec30308`). 앞선 라운드들이 발견한 CRITICAL(§4.1 wrapper/도메인값
  분리, `chat-channel-adapter.md` §3 미러 누락, `.failed.error` 는 문자열이다)은 각각 후속 커밋으로
  **해소를 확인**했다(diff·grep 으로 직접 재확인, 아래).
- 본 라운드는 target(`spec/5-system/`, 특히 6-websocket-protocol.md §4.1/§4.4, 14-external-interaction-api.md
  §R17)이 **다른 spec 영역**(conventions, data-flow, 2-navigation, 3-workflow-editor, 4-nodes)과
  새로 충돌하는지에 집중했다.

## 확인한 것 (충돌 없음)

- `spec/conventions/node-output.md` Principle 0/3.2 — `NodeHandlerOutput.output.error` 도메인
  shape 정의는 target 의 "wire `output` = wrapper, 도메인 값은 `output.output`" 서술과 정합
  (서로 다른 층을 가리키며 이름만 겹친다는 target 자신의 캐비엇과 일치).
- `spec/4-nodes/4-integration/*.md`, `spec/4-nodes/3-ai/*.md` 의 다수 `output.error.*`/`$node[...].output.error.*`
  참조 — 전부 **도메인 레벨**(`NodeHandlerOutput.output.error`, expression resolver 가 직접 읽는
  레이어) 참조이고 WS wire 의 top-level `output`/`error` 필드와는 별개 네임스페이스라 충돌 없음.
- `spec/3-workflow-editor/3-execution.md` §8 이벤트 표(`execution.node.completed | ... output, duration`) —
  표 상단에 "여기 적힌 이름·유무를 근거로 구현하지 말 것, EIA §6 이 소유"라는 명시적 disclaimer 가
  있어 단순화 표기가 target 과 모순되지 않음.
- `spec/data-flow/{3-execution,8-notifications,14-chat-channel}.md`, `spec/4-nodes/7-trigger/providers/telegram.md` —
  이벤트 이름만 인용, shape 주장 없음.
- `spec/5-system/2-api-convention.md` §10 — `execution.node.*`/`NodeHandlerOutput` 언급 0건.
- `spec/2-navigation/14-execution-history.md`, `spec/conventions/data-hydration-surfaces.md` — `output.error`
  참조는 모두 도메인 레벨, target 의 wire 정정과 무모순.

## 발견사항

### [CRITICAL] `conversation-thread.md` §9.7 이 target 이 방금 정정한 `execution.node.failed.error` shape 과 여전히 모순 — 단, **이미 발견·등재·의도적 이연된 항목**

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.failed` 행
  (2026-08-24 정정: "⚠️ `error` 는 문자열이다" — emit 4곳 전수 실측, top-level `error` 는 항상
  `string`, 구조화 객체는 `output` 이 동봉되는 2/4 경로에서만 `output.output.error`).
- **충돌 대상**: `spec/conventions/conversation-thread.md` §9.7 "WS 이벤트 → store 변환 계약" 표의
  `node.failed` 행 — *"payload 의 `error.{code, message, details.retryable, details.retryAfterSec}`
  를 §1.2 `data?` shape 으로 매핑"* — 이는 wire top-level `error` 가 **구조화 객체**라는 서술이다.
  §1.1.1 도 같은 전제로 서술. (참고로 같은 표의 `node.completed` 행은 이미 `output.error` 에서
  추출한다고 정확히 적어 두 행 사이에 비대칭이 있다.)
- **상세**: target 이 이번에 확정한 실측(4개 emit 사이트 전부 string)과 정면으로 모순된다.
  이 모순은 가설이 아니라 **이미 실제 기능 결함으로 관측됐다** — frontend
  `use-execution-events.ts` 의 `extractNodeErrorPayload`/`handleNodeFailed` 가 conversation-thread.md
  의 (틀린) 계약을 그대로 코드화해, 라이브 WS 경로에서 `system_error` 재시도 배너가 뜨지 않는다.
  target 문서 자신도 이 인과를 §4.1 정정문에 명시했다 ("이 문구가 프런트 결함을 낳았다").
- **이미 추적 중** — 이 정확한 지점은 직전 라운드 `12_24_55` cross_spec 이 CRITICAL 로 먼저
  발견했고, `RESOLUTION.md` 가 "spec §4.1 행만 정정하고, frontend 코드 수정(및 그에 따른
  conversation-thread.md 본문 정정 여부)은 이 PR 범위 밖"이라 명시적으로 결정, 실측·착수 지침을
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-229`(🔴 항목, 2026-08-24 등재)
  에 전부 실었다. 이번 diff 는 이 gap 을 새로 만들지 않았다 — §4.1 을 정확하게 고치면서 그 정정이
  들추어낸 **인접 문서의 기존 drift**가 계속 보인다.
  - **트래커의 좁은 공백**: 등재문은 frontend 코드 수정 착수 지침(`extractNodeErrorPayload(payload.error,
    payload.output)` + 2단 `nested` 접근)은 구체적이지만, **`conversation-thread.md` §9.7 행 자체의
    문구 정정**(코드와 별개로 "payload 의 error 는 string" 으로 고쳐야 한다는 점)은 명시적으로
    등재돼 있지 않다 — 코드 수정 시 자연히 함께 고쳐질 가능성이 높지만, 문서만 먼저 읽는 사람은
    여전히 틀린 계약을 SoT 로 믿을 수 있다.
- **제안**: 이번 PR 을 이 이유로 재차단할 필요는 낮다 — 이미 알려졌고, 실측·착수 지침까지 갖춘
  정본 트래커 항목이 있으며, 5라운드째 같은 루프를 도는 비용이 이미 컸다(직전 라운드가 자체
  인지). 다만 그 트래커 항목의 "착수 시" 절에 **`conversation-thread.md` §9.7/§1.1.1 행의 문구
  자체도 정정 대상**이라고 한 줄 추가할 것을 권장 — frontend 코드만 고치고 문서 문구를 그대로
  두면 다음 사람이 다시 같은 틀린 전제를 SoT 로 읽는다.

### [INFO] provider 3개 문서(`telegram.md`/`slack.md`/`discord.md`) CCH-MP-06 의 `output.rendered` — 이미 등재됨

- **target 위치**: 없음 (target diff 밖, 확인만).
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/{telegram,slack,discord}.md` 의 CCH-MP-06 행이
  여전히 `output.rendered`(단일 단계)로 표기 — `chat-channel-adapter.md` §3 은 이미 `output.output.rendered`
  로 정정됨.
- **상세**: 2026-08-24 `12_13_36` convention_compliance INFO 1 로 이미 발견·등재됨
  (`spec-sync-external-interaction-api-gaps.md:231-241`) — "노드가 무엇을 만드나" vs "렌더러가
  어디서 읽나" 중 어느 의미인지 그 표 전체를 함께 봐야 판정 가능해 `spec/4-nodes/7-trigger/providers/`
  스코프의 별도 planner 턴으로 명시적으로 이연됨. 새로 지적할 필요 없음, 확인만 마쳤다.

## 요약

target(`spec/5-system/6-websocket-protocol.md` 의 §4.1/§4.4, `14-external-interaction-api.md` 의
§R17)이 이번 diff 로 수행한 "wire `output` = `NodeHandlerOutput` 래퍼, 도메인 값은 한 겹 아래"
정정과 "`.failed.error` 는 문자열" 정정은 그 자체로 일관적이며, `node-output.md` 의 도메인 레벨
Principle 3.2 정의·4개 emit 사이트 실측·allowlist chokepoint 코드와도 정합한다(직접 재확인).
새로 발견한 실질적 cross-spec 충돌은 하나 — `conversation-thread.md` §9.7 의 `node.failed` 행이
target 이 방금 정정한 wire `error` shape 과 여전히 모순되는데, 이는 **이번 세션이 새로 만든
결함이 아니라 직전 `12_24_55` cross_spec 라운드가 이미 CRITICAL 로 발견해 정본 트래커에 등재하고
의도적으로 이연한 known 항목**이다(RESOLUTION.md·트래커 라인 204+ 로 재확인). 트래커의 착수
지침에 문서 문구 정정 자체가 명시적으로는 빠져 있어 그 한 줄 보강을 권한다. 그 외 데이터모델·
API계약·요구사항ID·상태전이·RBAC·계층책임 관점에서 새로 발견된 충돌은 없다.

## 위험도

MEDIUM — 실체적 신규 충돌 0건. CRITICAL 1건은 이미 발견·실측·등재·의도적 이연이 완료된 known
issue 의 재확인이라 이 PR 을 이유로 재차단할 근거는 약하지만, 근본 원인(두 문서 간 wire shape
서술 불일치)이 여전히 살아 있고 트래커 착수 지침에 문서 정정 자체가 명시돼 있지 않다는 좁은
공백이 있어 NONE/LOW 로는 낮추지 않았다.
