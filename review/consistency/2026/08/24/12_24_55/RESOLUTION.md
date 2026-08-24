# RESOLUTION — `12_24_55` (`--impl-done spec/conventions/` 재실행, BLOCK: YES)

CRITICAL 1 · WARNING 1 · INFO 3. **직전 라운드(`12_13_36`)의 CRITICAL 은 해소 확인**됐고,
이번엔 **새로운 CRITICAL** 이 나왔다 — 그리고 이건 문서 정합이 아니라 **실제 기능 결함**이다.

## CRITICAL 1 — 틀린 spec 문구가 프런트 결함을 낳았다. 전부 실측으로 확인했다

지적: WS §4.1 `.failed` 행이 *"`error` 는 `output.error` 전체 구조(`{code, message, details}`)"*
라 하는데 실제 emit 은 **string** 이고, 프런트가 그 문구를 믿어 재시도 배너가 안 뜬다.

**checker 말을 받아들이지 않고 직접 쟀다:**

| 확인 | 결과 |
|---|---|
| `NODE_FAILED` emit 4곳의 `error` | **전부 string** — `execution-engine.service.ts:6302`(`err.message`)·`:6378`(`errorMessage`)·`:8018`(`message`), `ai-turn-orchestrator.service.ts:1537`(`errorMessage`) |
| `extractNodeErrorPayload` 의 `direct` 분기 | `rawError` 가 **객체일 때만** 잡는다 → 문자열이면 `null` |
| `handleNodeFailed`(`:894`) 호출 | `extractNodeErrorPayload(payload.error, **undefined**)` → `nested` 도 없다 → **항상 `null`** |
| 그 함수의 주석 | *"§4.1 갱신 — `execution.node.failed.error` 는 `output.error` 전체 구조"* |

**코드가 틀린 spec 을 믿었다.** 주석이 §4.1 을 명시 인용한다 — 인과가 문서→코드 방향임이
주석에 남아 있다.

곁들여 확인한 것: `handleNodeCompleted`(`:804`)도 `nested` 가 `rawOutput.error` **한 단**만
보는데 `payload.output` 은 래퍼라 구조화 에러는 **두 단** 아래다. 같은 결함의 자매다.

### 한 것: spec 정정. 안 한 것: 프런트 수정

- **spec §4.1 `.failed` 행을 정정했다** — 원문을 취소선으로 남기고, 4곳 전수 실측과
  *"구조화 객체는 `output.output.error` 에만 있고 `output` 이 동봉되는 2경로에서만 도달
  가능"* 을 적었다. **이 문구가 프런트 결함을 낳았다는 인과도 함께** 적었다. 그 파일은 이
  PR 의 `spec_impact` 에 planner 턴 항목으로 이미 올라 있다.
- **프런트는 안 고쳤다.** checker 도 *"developer 권한 내, 병행 가능"* 이라 했지만 **범위가
  아니다**: (a) 이 PR 은 frontend 를 한 줄도 건드리지 않는 egress-masking 작업이고,
  (b) 고치면 **배너가 새로 뜨기 시작**하는 UI 동작 변경이며, (c) 현재 테스트
  (`CT-S9`/`CT-S10`)가 **존재하지 않는 shape 을 fixture 로 쓰고 배너 미표시를 의도된 동작으로
  단언**하고 있어 fixture 교체가 함께 필요하다. 실측·착수 지침을 전부 담아 **정본 트래커에
  🔴 항목으로 등재**했다.

  *"고칠 수 있으니 고친다"* 로 UI 결함을 masking PR 에 얹으면, 그 변경은 이 PR 의 리뷰
  범위(security/side_effect 중심)에서 제대로 검토되지 않는다.

## WARNING 1 — 내가 이번에 넣은 "`output` 도 함께 실린다" 가 과잉이었다

`10_44_28` INFO 1 을 받고 `.failed` 행에 `output` 열을 추가하면서 **무조건 실리는 것처럼**
적었다. 4곳 전수를 세니 **2곳만** 동봉한다 — `finalizeErrorPortNode` 와 AI turn 종결.
나머지 둘(pre-flight throw · container 실패)은 **키 자체가 없다**.

또 한 번 *"열어 본 것만 세고 일반화했다"* 다(같은 세션에서 `emit 5곳`→6곳과 같은 형태).
경로별로 세분해 정정했다. 기능상으로는 헬퍼의 null/non-object 가드가 안전하게 처리하므로
무해하다 — 순수 문서 정확도.

## INFO

- **#1** (provider spec 3곳) — 이미 직전 라운드에서 트래커에 등재했고 checker 도 그 사실을
  확인했다. 추가 조치 불요.
- **#2** (정정 표기 스타일이 emergent convention) — 정확한 관찰이다. 다만 표기 규약을
  `spec/conventions/` 에 신설하는 것은 이 PR 의 범위가 아니고, 지금 만들면 **표본이 이번
  시리즈 하나**라 성급하다. 넘긴다.
- **#3** (`output.output.<field>` 토큰이 `node-output.md` Principle 8.1 의 금지 패턴과 겹침)
  — 층위가 다르다(핸들러 내부 이중중첩 vs wire 래퍼/도메인 구분). checker 도 혼동 위험을
  낮게 봤다. 상호 참조 각주는 그 파일을 다음에 열 때.
