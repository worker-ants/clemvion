# 신규 식별자 충돌 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 범위 참고

`--spec` 예산 초과로 프롬프트 번들에서 `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/conventions/chat-channel-adapter.md` 세
핵심 파일이 전부 생략되어 있었다(기존 교훈 `feedback_consistency_spec_mode_budget`). 세
파일 모두 저장소에서 `Read`로 직접 열어 실제 본문(EIA §5.3~§6.6, WS §2.1~§4.2,
chat-channel-adapter §1.2/R3)을 대조했다.

## 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md` 교차 참조가 재사용된 라벨 `W1`을 가리킨다
  - target 신규 식별자: 체크리스트 항목 "`failRetryExecution` 의 `cancelledBy` 누락은
    [`retry-turn-terminal-guard.md`](./retry-turn-terminal-guard.md) **W1** 에서 집행
    (교차 참조만)" (line 178) 및 본문 line 137-139
  - 기존 사용처: `plan/in-progress/retry-turn-terminal-guard.md` 는 `W1` 라벨을 **최소 6곳
    이상**에서 서로 다른 결함에 재사용한다 — L120 `W1(concurrency)`(재진입 가드 원자성),
    L272/L329 `W1(api_contract)`(`cancelledBy` 누락, target 이 의도한 항목), L437
    `W1(requirement/concurrency)`, L490 `W1(SPEC-DRIFT)`, L573 `10R W1`, L653
    `W1(rationale_continuity)`, L676 `9R W1(database)`
  - 상세: 해당 plan 파일 스스로가 이 재사용 문제를 인지하고 있다 — L319-321 "같은 항목이
    라운드마다 다시 등재돼 고유 14건이 체크박스 20개로 흩어졌다" 며 "우선순위 순" 단일 목록
    (`#1`~`#19`, L326-346)을 별도로 만들어 두었다. target 이 인용한 항목은 그 단일 목록의
    **`#2`**("`EXECUTION_CANCELLED` payload 에 spec §4.1 필수 `cancelledBy` 추가", L329)이지만
    target 은 라운드-한정 임시 라벨 `W1`(모호)을 인용해, 정작 그 파일이 마련해 둔 안정적
    식별자(`#2`)를 쓰지 않았다. 내용 대조 결과 target 의 서술(`{status}` 뿐, 원래부터
    `cancelledBy` 없음, pre-existing)은 그 파일의 `#2`/L272-276 과 정확히 일치해 **의도한
    대상 자체는 맞다** — 다만 참조 표기가 모호하다.
  - 제안: `W1` 대신 `retry-turn-terminal-guard.md #2`(우선순위 목록 항목 번호) 또는
    `5R W1`처럼 라운드를 명시해 인용한다. 그 문서 자신도 같은 이유로 라운드 라벨을 버리고
    번호 목록을 SoT로 세웠으므로, target 도 같은 규칙을 따르는 편이 일관적이다.

- **[WARNING]** 신규 `payload` 봉투 필드가 `chat-channel-adapter.md` 의 `EiaEvent` 타입에는
  반영되지 않아 두 SoT 문서가 서로 다른 wire shape 를 서술하게 될 수 있다
  - target 신규 식별자: §0 "봉투 규칙" — EIA outbound webhook 전체를
    `{ type, executionId, triggerId, workflowId, seq, timestamp, payload: {...} }` 로
    재정의 (line 101-119). 실제 코드(`notification-fanout.service.ts:123-137`)와도 일치함을
    확인했다.
  - 기존 사용처: `spec/conventions/chat-channel-adapter.md` §1.2 (L138-150)는 `EiaEvent`
    union 을 **flat** 필드로 선언한다 — 예:
    `{ type: "execution.completed"; ...; result: {...}; durationMs: number; ... }`
    (`result`/`durationMs`가 `payload` 로 nest 되어 있지 않음). target §5(line 146-150)는
    "`finalNodeId`·`finalPort` 삭제, `result`·`durationMs` optional화, `cancelledBy`
    optional화"만 지시하고, §0 이 도입하는 `payload` nesting 을 `EiaEvent` 에 반영하라는
    지시가 없다("R3 가 SoT 라 선언하므로 여기가 따라온다"는 원칙만 서술).
  - 상세: R3(`chat-channel-adapter.md` L527-531)의 존재 이유가 정확히 "EIA §6 을 SoT 로
    삼아 drift 를 회피"하는 것인데, §0 이 EIA §6.3~§6.5 wire shape 를 nested `payload` 로
    바꾸는 동안 §5 실행 지시가 그 nesting 을 명시하지 않으면 구현자가 필드 3종만 고치고
    envelope 구조 변경을 누락하기 쉽다 — 결과적으로 같은 이름 `EiaEvent` 가 두 문서에서
    서로 다른 실제 shape(하나는 nested payload, 하나는 flat)를 가리키는 상태가 재발한다.
    이는 target 이 스스로 반려 이력으로 기록한 "봉투를 한 이벤트에만 적용해 반려된"
    (`15_28_10`) 패턴과 같은 종류의 위험이다.
  - 제안: §5 실행 지시에 "`EiaEvent` 3 variant 도 §0 의 `payload` 봉투로 재구조화"를
    명시적으로 추가한다(필드 optional화와 별개 작업 항목으로).

- **[INFO]** §0 "봉투 규칙" 서브섹션 번호가 이 문서군에 전례 없는 `X.0` 패턴이다
  - target 신규 식별자: "### 0. 봉투 규칙"(line 95, 안 문서의 자체 아웃라인 표기이자
    체크리스트에서 "봉투 §0"으로 재인용, line 185/187)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md`(및 `spec/` 전체)에서
    `### 6.1`~`### 6.6`처럼 하위 절은 항상 `.1`부터 시작한다 — `grep -rn "^### 0\."
    spec/` 결과 0건, 이 저장소 spec 전체에 `X.0` 서브섹션 선례가 없다.
    (`0-overview.md`/`0-canvas.md` 류는 **파일명** 접두 컨벤션이며 문서 **내부** 절 번호
    컨벤션과는 다른 축이다.)
  - 상세: 실제 spec(`14-external-interaction-api.md`)에 이 봉투 절을 삽입할 때 번호를
    `### 6.0`(형제 6.1~6.6과 정합) 대신 독립된 `### 0.`으로 붙이면, 그 문서의 다른 모든
    `## N. / ### N.M` 넘버링 관례와 어긋나는 유일한 예외가 된다. 충돌(동일 식별자 재사용)은
    아니지만 명명 컨벤션 붕괴 소지가 있다.
  - 제안: 실제 삽입 시 `### 6.0 봉투 규칙`(또는 6.1을 봉투로 삼고 나머지를 6.2~6.7로
    한 칸씩 미는 방안)으로 형제 절과의 넘버링 패턴을 맞춘다.

- **[정보성 확인 — 문제 없음]** 아래는 충돌을 의심했으나 실측 결과 기존 컨벤션과 정합함을
  확인했다 (오탐 방지 기록):
  - "미구현 (Planned)" 마커(target line 124/132/143)는 `spec/2-navigation/_layout.md`,
    `9-user-profile.md`, `1-workflow-list.md`, `4-nodes/0-overview.md` 등 **10곳 이상**에서
    이미 쓰이는 확립된 컨벤션이다 — 신규 도입이 아니라 재사용.
  - `EIA-IN-04` 참조(target line 82)는 실제로 `spec/5-system/14-external-interaction-api.md`
    §5.3(L74 "`GET /api/external/executions/:executionId` 는 현재 상태 단발 조회")에 정확히
    대응한다. 새 ID 오용이 아니다.
  - target 은 새 requirement ID·API endpoint·이벤트명·ENV var·config key 를 하나도
    도입하지 않는다 — 기존 `execution.completed`/`failed`/`cancelled` 이벤트의 **payload
    필드**만 삭제/optional화/재구조화한다. 카테고리 1·3·4·5 관점에서는 충돌 후보가 없다.
  - `plan/in-progress/spec-draft-eia-r8-alignment.md` 와 파일명이 `spec-draft-eia-*` 접두를
    공유하지만 내용은 EIA §R8 idempotency 캐시 대상(2xx/409/410)에 관한 별개 완료 작업이라
    실질적 스코프 충돌은 없다.

## 요약

target 은 requirement ID·API endpoint·이벤트명·ENV var·신규 파일 경로를 새로 만들지 않고
기존 `execution.completed`/`failed`/`cancelled` webhook payload 의 필드 구성만 다듬는
draft라, 좁은 의미의 "신규 식별자가 기존과 다른 의미로 충돌"하는 CRITICAL 사례는 없다.
다만 (1) 다른 plan 문서의 라운드-한정 라벨 `W1`을 모호하게 인용해 그 문서 자신이 이미
"이런 재사용 문제로 단일 목록을 새로 만들었다"고 밝힌 함정을 그대로 재현했고, (2) 신규
도입하는 `payload` 봉투 구조가 `chat-channel-adapter.md` 의 `EiaEvent` 타입 갱신 지시에는
명시되지 않아 두 SoT 문서가 다시 어긋날 (같은 타입명이 다른 shape 를 가리킬) 여지가
남아 있다. 두 건 모두 즉시 사용자 혼선을 유발하는 CRITICAL은 아니나, target 이 이미
"봉투를 한 곳에만 적용해 반려됐다"는 이력을 갖고 있는 만큼 재발 방지 차원에서 반영을
권장한다.

## 위험도

LOW
