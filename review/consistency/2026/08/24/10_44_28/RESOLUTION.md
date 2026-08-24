# RESOLUTION — `10_44_28` (`--impl-prep`, BLOCK: YES)

CRITICAL 1 · WARNING 3 · INFO 4. **전부 처리**했다. 단 CRITICAL 은 **일부 반박**한다 —
근거를 아래에 남긴다.

## CRITICAL 1 — 절차 지적. 절반은 내 기록 결함, 절반은 오독이다

지적: *"EIA §R17 / WS §4.4 는 API 계약 문서인데, 자기-반증형 소정정 예외(조건 2: API 계약
제외)를 인용하는 frontmatter 주석 아래 developer 턴이 직접 고쳐 커밋했다."*

### 반박 — 나는 그 두 파일에 예외를 원용한 적이 없다

예외를 원용한 것은 **`spec/conventions/conversation-thread.md` 한 파일**이다. 그 파일에서
고친 문장은 *"잔여로 남은 것은 `envelope.output` 하나다"* — **상태 예고**이지 API 계약
조항이 아니다(조건 2 충족). 나머지 두 파일은 plan 의 `## 작업` 체크리스트에
**"(planner 턴)"** 으로 명시된 항목이고, 이 PR 안에서 그 턴으로 수행했다. spec 을 별도
PR 로 떼지 않는 판단은 `#1204`·`#1208`(둘 다 머지됨)에서 내린 것과 같다 — 떼면 머지 시차
동안 **live spec-impl drift** 가 생긴다.

### 수용 — 그런데 그렇게 읽힐 만했다. 그건 내 기록 결함이다

frontmatter 주석이 `spec_impact:` 세 항목 **아래쪽**에 하나만 붙어 있어, 세 파일 전부를
예외로 덮는 것처럼 읽힌다. checker 가 정확히 그렇게 읽었다. **문서가 그렇게 읽히면 그건
문서 잘못이다.**

고친 것:

- `spec_impact` 를 **두 블록으로 갈랐다** — (1) *"planner 턴으로 고친다 — 예외가 적용되지
  **않는** 파일들"* + 왜 같은 PR 인지, (2) *"자기-반증형 소정정 — **이 한 파일에만**"* +
  조건 1~5 를 어떻게 충족했는지.
- 체크리스트의 `(planner 턴)` 항목을 **`[x]` 로 동기화**했다(WARNING 3 과 같은 조치).
  checker 가 *"체크박스가 미체크라 planner 턴이 없었다고 판단"* 했으므로, 미체크 자체가
  Critical 의 물증이었다.

**절차를 다시 밟지는 않는다** — planner 턴은 실제로 수행됐고, 빠진 것은 **그 사실의 기록**
이었다. 없는 절차를 사후에 지어내는 것이 아니라, 있었던 절차의 증거를 채운 것이다.

## WARNING 2 (naming) — 진짜 오류였고, 내 표면 바로 위였다

WS §4.1 표가 `execution.node.completed` 의 `output` 을 *"`NodeHandlerOutput` 의 `output`
필드"* 라고 적는데 **틀렸다**. emit SoT 는 `output: nodeExecution.outputData` — **래퍼 전체**
다. 따라서 CONVENTIONS Principle 3.2 의 `output.error` 는 wire 에서 **`output.output.error`**
이고, 종전 서술은 한 겹 얕았다.

**선재 오류지만 고쳤다** — 내 allowlist 가 거르는 객체가 바로 그 래퍼다. 독자가 표를 보고
"`output` = 도메인 값" 으로 읽으면 **어느 층에 필터가 걸리는지를 오해**한다. 실측 근거
(emit 사이트)를 함께 적었다.

## INFO 1 (cross_spec/naming) — `execution.node.failed` 행에 `output` 누락

같은 표의 자매 행. `finalizeErrorPortNode` 가 `output: nodeExecution.outputData` 를 동봉하는데
표에 없었다. 열을 추가하고 *"이 래퍼도 fanout 에서 같은 allowlist 를 지난다"* 를 명시했다.
**W2 와 한 자리에서 같이 고쳤다** — 자매를 갈라 고치면 다음 라운드에 나머지가 돌아온다.

## WARNING 1 (convention) — `background:run:{id}` 채널이 §3.2 표에 없음

**선재 갭이고 이번 작업이 만든 것이 아니다.** `redis-keys.md` §4 가 SoT 로 §3.2 를 지목하는데
그 표에 행이 없어 포인터가 빈다. §3.2 는 이 작업의 `spec_impact` 밖이고 처분이 갈리는
결정(표에 행 추가 vs 포인터 변경)이라 **정본 트래커에 planner 항목으로 등재**했다.

## WARNING 3 — plan 체크리스트 stale

위 CRITICAL 수용분과 같은 조치로 해소. 완료 항목을 `[x]` 로 동기화하고, 남은 항목
(TEST WORKFLOW·`/ai-review`)만 미체크로 뒀다.

## INFO — 나머지

- **#4** — *"`spec_impact` 에 `conversation-thread.md` 누락"* 은 checker 3명의 **오탐**이었고
  summary 가 직접 재확인해 정정했다(이미 등재돼 있었다). 예산 절단으로 frontmatter 전문을
  못 본 것이 원인 — 이 하네스 한계는 앞선 라운드에도 반복 관측됐다.
- **#2** (`duration` vs `durationMs`) — 문서가 이미 의도적 표기 차이로 자각·기록. 조치 불요.
- **#3** (`swagger.md` 적용 대상 아님) — 커버리지 확인 기록.
