# 테스트 관점 코드 리뷰 (fresh) — getStatus() 2단계 컬럼 projection — 직전 지적 fix 검증

- 직전 리뷰: `review/code/2026/07/10/22_47_32/testing.md` (Warning 2 / Info 2 / Info 2)
- fix 커밋: `f2764f3a9` (`refactor(external-interaction): ai-review Warning 4건 반영 — projection 상수화 + 인가 경계 테스트`)
- 검증 방법: 코드 리딩 + **mutation testing**(구현을 실제로 훼손한 뒤 해당 테스트가 red 로 전환되는지 확인, 이후 원복·전체 스위트 43/43 green 재확인). 아래 각 항목에 재현한 mutation 과 결과를 근거로 첨부.

## 발견사항 — 직전 지적 4건 fix 검증

### 검증 완료 (RESOLVED) — W-1: stage-2 `where`(executionId) 미단언 → 신규 테스트로 해소, mutation 으로 실효성 확인
- 위치: `interaction.service.spec.ts:833-850` (`'2단계 조회는 1단계와 동일한 executionId 로 스코프된다 (인가 경계)'`)
- 상세: `whereOf(repo.findOne.mock.calls[0][0])` / `calls[1][0]` 를 `toEqual({ id: IEXT_CTX.executionId })` 로,
  `nodeRepo.findOne` 의 `where` 를 `toMatchObject({ executionId: IEXT_CTX.executionId, status: 'waiting_for_input' })` 로 단언.
  `repo.findOne` 은 하나의 mock 함수를 stage-1/stage-2 양쪽에서 호출하지만, `Promise.all` 배열 구성이 동기적이라
  `mock.calls[0]`=stage-1(1단계, if 분기 진입 전), `mock.calls[1]`=stage-2(2단계, Promise.all 내부 첫 항목)로
  호출 순서가 결정적이다 — 인덱스 기반 단언이 fragile 하지 않음을 코드 흐름으로 확인.
- **mutation 검증**: `interaction.service.ts` 의 stage-2 `executionRepository.findOne` where 를
  `{ id: 'WRONG-EXEC-ID' }` 로 임의 변경 → 해당 테스트가 정확히 그 지점에서 red
  (`Expected: {"id":"exec-1"} / Received: {"id":"WRONG-EXEC-ID"}`). 마찬가지로 `nodeExecutionRepository.findOne`
  의 `executionId` 를 `'WRONG-NODE-EXEC-ID'` 로 변경해도 red. 둘 다 원복 후 전체 스위트 43/43 green 재확인.
  → **직전 리뷰가 지적한 "인가 경계 미검증" 카테고리의 회귀를 실제로 탐지한다.** `toMatchObject` 사용이
  검증력을 약화시키지 않음(핵심 필드가 정확히 비교됨).

### 검증 완료 (RESOLVED, 문서화 성격) — W-3: 기존 waiting 테스트 4건의 vacuous 성 → 주석으로 한계 명시
- 위치: `interaction.service.spec.ts:540-544` (`DURABLE_THREAD` 선언 직전 주석)
- 상세: 코드 자체(4개 테스트)는 변경되지 않았고 — 여전히 `mockResolvedValue`(비-Once)로 1/2단계를 구분 못 함,
  직전 리뷰가 정확히 예측한 대로 — 대신 "이 테스트들은 stage 를 구분 못하며, 실제 2단계 분리·마스킹 배선
  검증은 아래 `describe('... 컬럼 projection (2단계 조회)')` 가 담당한다"는 명시적 주석을 추가했다.
  이는 직전 리뷰의 제안("최소 코드 코멘트로 ... 남기거나")을 정확히 그대로 이행한 것으로, **과대주장이
  아니다** — RESOLUTION.md 도 "코드 변경 아닌 주석" 이라고 정직하게 기록. 실질 회귀 방어력은 신규
  projection describe(아래 W-1/INFO 항목들)가 담당하며, 이는 실제로 mutation 검증됨.
- 참고: 4개 구식 테스트 자체의 vacuous 성은 구조상 여전히 남아있다(설계상 의도된 잔여 — 새 describe 블록이
  "실제 가드"라는 게 이번 fix 의 요지). 이 잔여물이 향후 새 describe 블록이 약화/삭제될 경우의 잠재
  위험이라는 원 지적의 전제는 그대로이지만, 그 경우도 이번 주석이 유지보수자에게 경고하도록 설계됨 — 수용 가능.

### 검증 완료 (RESOLVED) — INFO: `arrayContaining` 초과 컬럼 미검출 → 정확 집합 비교로 강화, mutation 으로 확인
- 위치: `interaction.service.spec.ts:789-800` (`'1단계는 응답 조립에 쓰이는 컬럼만 select — 초과·누락 모두 불가'`)
- `expect(select.slice().sort()).toEqual(BASE_COLUMNS.slice().sort())` 로 변경됨.
- **black-box 결합 판단**: 테스트의 `BASE_COLUMNS`(L760-767)는 구현의 `STATUS_PROJECTION_COLUMNS` 상수를
  import 하지 않고 **리터럴로 독립 재기술**한다(주석 L759 로 명시). 이는 올바른 선택이다 — 만약 구현
  상수를 그대로 import 해 비교했다면 `toEqual(STATUS_PROJECTION_COLUMNS)` 는 항상 자기 자신과 비교하는
  **tautology**가 되어 이번 fix 의 목적(초과 컬럼 검출)을 무력화했을 것. 독립 재기술 방식은 구현이
  실수로 컬럼을 추가/삭제하면 테스트가 즉시 fail 하는 진짜 회귀 가드다.
- **mutation 검증**: `STATUS_PROJECTION_COLUMNS` 에 `'triggerId'` 를 추가 → 해당 테스트가 정확히 그
  차이(`+ "triggerId"`)로 red. 원복 후 43/43 green 재확인. → 직전 리뷰가 지적한 "초과 컬럼 미검출"
  결함이 실제로 해소됐음을 실증.

### 검증 완료 (RESOLVED) — INFO: waiting + 대기 nodeExec 없음 + durable thread 존재 조합 미검증 → 신규 테스트, mutation 으로 확인
- 위치: `interaction.service.spec.ts:854-867` (`'waiting + 대기 nodeExec 없음 — thread 가 있어도 context/currentNode 는 null'`)
- 상세: `repo.findOne.mockImplementation` 을 `select` 분기로 나눠 stage-2 `conversationThread` 조회가
  실제 값(`THREAD`, non-null)을 반환하도록 세팅하고, `nodeRepo.findOne` 은 `null`. 결과로 `r.context`/
  `r.currentNode` 가 `null` 임을 단언.
- **"thread 가 fetch 됐다가 버려진다"는 사실을 실제로 고정하는가?** — 리뷰 프롬프트가 제기한 질문에 대한
  답: 이 테스트는 stage-2 fetch 가 **일어났음을 직접 단언하지 않는다**(예: `toHaveBeenCalledTimes(2)`
  부재). 그러나 mutation 으로 실질을 검증한 결과, 이 테스트는 **단순히 "thread 없음" 케이스의 재탕이
  아니라 독립적인 검출력을 가진다**:
  - 코드에 "`conversationThread` 가 존재하면 `nodeExec` 유무와 무관하게 `context` 에 흘려보낸다"는
    누출 버그를 인위 주입(`if (conversationThread) { context = { conversationThread }; }`)했더니
    **이 신규 테스트만 red 로 전환**되고, 기존 L527-536(`'waiting_for_input — 대기 NodeExecution
    없으면 currentNode/context null'`, thread 미설정)은 **green 을 유지**했다(전체 로그 확인 완료).
  - 즉 이 신규 테스트는 "nodeExec null → context null" 만 검증하는 게 아니라, **"thread 존재 + nodeExec
    null → 그럼에도 context 에 thread 가 새지 않는다"**는, 기존 테스트로는 커버되지 않던 별개의 회귀
    클래스를 실제로 잡는다. 직전 리뷰가 우려한 "계산은 했지만 폐기됨" 동작이 향후 실수로 "폐기 안 됨(누출)"
    으로 바뀌는 것을 정확히 검출.
  - 다만 `expect(repo.findOne).toHaveBeenCalledTimes(2)` 같은 명시적 호출-횟수 단언을 추가하면
    "2단계 fetch 자체가 실행됐다"는 사실까지 자기 문서화(self-documenting)할 수 있어 더 강건해짐 —
    현재도 기능적으로는 충분(위 mutation 결과가 이를 실증)하므로 **INFO(선택적 개선)** 수준.

## 신규 발견사항 (이번 라운드에서 새로 확인된 항목, 전부 INFO)

- **INFO — `THREAD`(L773-787, 신규 describe) 와 `DURABLE_THREAD`(L545-567, 구 describe) 중복**
  - 두 상수가 거의 동일한 conversation-thread fixture 를 서로 다른 describe 블록에서 각자 재선언한다
    (turn 개수·`totalChars`만 다름). 기능적 문제는 없음(각 describe 는 독립적으로 self-contained 해야
    한다는 관점에서는 오히려 의도적일 수 있음) — 다만 fixture 스키마가 바뀌면(예: `ConversationThread`
    타입에 필드 추가) 두 곳을 따로 갱신해야 하는 유지보수 비용. 우선순위 낮음, 통합 제안만.

- **INFO — `nodeRepo.findOne` where 단언이 `toMatchObject`(L846-849), execution 쪽은 `toEqual`(L840-845) — 비대칭**
  - 인가 경계의 핵심 필드(`executionId`)는 두 단언 방식 모두 mutation 으로 검출 확인됐으므로 실질
    위험은 없음. 다만 `toMatchObject` 는 원칙상 `where` 객체에 예기치 못한 추가 키(예: `nodeId` 오조건)가
    섞여도 통과하므로, 완전성을 위해서는 `toEqual({ executionId: ..., status: 'waiting_for_input' })` 로
    통일하는 편이 더 엄격. 우선순위 낮음.

- **INFO — e2e 필드값 단언 여전히 부재 (직전 리뷰 항목, 미변경, 재확인만)**
  - `external-interaction.e2e-spec.ts` 는 이번 fix 커밋에서 변경되지 않았다(`git diff` 확인).
    직전 리뷰가 이미 "우선순위 낮음"으로 분류한 항목이라 이번 라운드의 fix 의무 대상은 아니었고,
    실제로 RESOLUTION.md 에도 별도 조치 언급이 없다 — 의도된 defer 로 판단, 재지적만.

- **INFO — `Promise.all` 병렬 디스패치 자체 미검증 (직전 리뷰 항목, 미변경, 재확인만)**
  - 직전 리뷰가 명시적으로 낮은 우선순위로 분류했고 이번 fix 대상에도 포함되지 않았다. 여전한 갭이지만
    신규 회귀는 아니며, 정확성(correctness)이 아닌 latency 특성에만 영향.

## 전체 스위트 평가 — 핵심 회귀 커버리지

`interaction.service.spec.ts` 43/43 green(`npx jest interaction.service.spec.ts` 로 로컬 재확인) 기준,
mutation testing 으로 아래 4개 핵심 회귀 클래스를 **전부 실제로 탐지함을 실증**:

1. **1단계에 `conversationThread` 재포함** — `'1단계는 응답 조립에 쓰이는 컬럼만 select'`(L789-800, 정확
   집합 비교) + `not.toContain('conversationThread')`. mutation(컬럼 추가)으로 검출 확인.
2. **마스킹 우회** — `'2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과'`(L873-911, secret
   포함 fixture) + 기존 4개 waiting 테스트(비록 stage 구분은 못하지만 마스킹 자체는 실값으로 검증).
3. **`updatedAt` fallback 침묵 회귀** — `'updatedAt — finishedAt 우선, 없으면 startedAt 의 실값'`
   (L934-952, 실제 타임스탬프 문자열 비교, `typeof==='string'` 아님).
4. **인가 이탈(다른 execution 의 thread 조회)** — `'2단계 조회는 1단계와 동일한 executionId 로
   스코프된다'`(L833-850). mutation(executionId 오배선) 양쪽(execution/nodeExecution 리포지토리
   모두)에서 검출 확인.

네 가지 모두 실제 코드 훼손 → red 전환을 직접 재현해 확인했으므로, 이번 fix 라운드는 **직전 리뷰가
지적한 갭을 명목상이 아니라 실질적으로 해소**했다고 판단한다. CRITICAL/WARNING 급 잔여 갭 없음 — 남은
항목은 전부 INFO(선택적 강화) 수준.

## 요약

직전 리뷰(`22_47_32/testing.md`)가 지적한 W-1(인가 경계 미검증)·W-3(구식 테스트 vacuous)·INFO
2건(초과 컬럼 미검출·조합 미검증)을 전부 코드로 확인하고, 나아가 **실제 mutation testing**(구현을
의도적으로 훼손 후 해당 테스트가 red 로 전환되는지 5개 시나리오로 재현: stage-2 execution where 오배선,
nodeExecution where 오배선, 컬럼 초과, context 누출)으로 각 fix 의 실효성을 직접 검증했다. 5개 시나리오
모두 정확히 의도된 테스트가 fail 했고, 다른 무관한 테스트는 영향받지 않았으며, 원복 후 전체 스위트
43/43 green 을 재확인했다. W-3 는 코드가 아닌 주석 추가로만 처리됐지만 이는 직전 리뷰의 제안을 정확히
이행한 것이고 실질 방어력은 신규 describe 블록이 담당하도록 설계돼 있어 과대주장이 아니다. 남은 항목
(THREAD/DURABLE_THREAD 중복, nodeRepo where 단언의 `toMatchObject` vs `toEqual` 비대칭, e2e 필드값
단언 부재, Promise.all 디스패치 순서 미검증)은 전부 이전부터 알려졌거나 이번 라운드에서 새로 발견된
저위험 INFO 로, 병합을 막을 이유가 없다.

## 위험도

LOW — 직전 리뷰가 MEDIUM 으로 평가한 핵심 갭(인가 경계 미검증, 구식 테스트 vacuous, 초과 컬럼 미검출,
조합 미검증)이 전부 실질적으로 해소됨을 mutation testing 으로 직접 실증했다. CRITICAL/WARNING 없음.
잔여 INFO 항목은 전부 저위험 선택적 강화 사항.

STATUS: OK
