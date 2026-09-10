# 요구사항(Requirement) 리뷰 — `trigger-workflow-ref` 캐너리, 4라운드

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` ·
`trigger-workflow-ref.spec.ts` (이번 커밋 `codebase/` 델타 전부 — 주석·라벨 전용, 로직 변경 0줄).
`git diff --stat HEAD~1 HEAD -- codebase/` 로 실측: 2 파일, 37 insertions / 16 deletions, 전부
comment/JSDoc 헤더 문자열이며 `expect(...)` 호출·분기 로직은 문자 단위로 동일함을 직접 diff 로 확인.

이번 라운드는 "코드가 의도한 기능을 충족하는가" 가 아니라 **저자가 이 세션에서 이미 네 번 틀린
근거 문장의 다섯 번째 사례 여부** — 3라운드에서 지적된 "고아 JSDoc 세 번→네 번" 정정이 사실인지,
그리고 새로 쓴 ⑤ 예외 서술의 사실성 — 을 좁게 검증하는 데 집중했다.

## 검증 1 — "네 번째가 바로 이 파일이다" (orphan JSDoc 카운트)

`codebase/backend/src/shared/testing/trigger-workflow-ref.ts:24-29`:

```
// 어떤 선언에도 붙지 않는 **고아 JSDoc** 이 되고, 그 형태를 이 저장소가 이미 **네 번** 겪었다.
// 앞선 세 번은 2026-09-06 시점 집계이고, **네 번째가 바로 이 파일이다** — 이 註가 인용하는
// `review/code/2026/09/10/15_52_06` maintainability W1 자체가 그 네 번째 발견이다.
```

**실측 결과: 참.** 두 갈래로 대조했다.

- **앞선 세 번(2026-09-06)의 출처** — `grep -rl "고아 JSDoc" review/` 로 전수 확인한 결과 2026-09-06
  날짜의 orphan JSDoc WARNING/W 는 정확히 셋이다: (1) `review/code/2026/09/06/11_55_36/maintainability.md`
  — `user-entity-exposure-guard.ts` 의 `findEagerUserRelations`/`collectUserRelationNames`,
  (2) `review/code/2026/09/06/15_52_58/maintainability.md` W4 — `triggers.service.ts` 의
  `isEndpointPathUniqueViolation` 위 빈 줄, (3) `review/code/2026/09/06/16_28_58/maintainability.md`
  — `triggers.service.spec.ts` 의 `it`→`it.each` 전환이 뗀 JSDoc. 이 셋은 사용자 memory
  `feedback_my_own_fix_is_the_next_defect.md`(`#1292` 세션, 수정일 2026-09-06)의 표 항목
  *"`it`→`it.each` 파라미터화 → orphan JSDoc (세 번)"* 과 정확히 대응한다(파일명·현상 서술 일치) —
  같은 세 사건을 가리킨다. 즉 "앞선 세 번은 2026-09-06 시점 집계" 는 문자 그대로 참이다.
- **네 번째 = 이 파일 자신** — `review/code/2026/09/10/15_52_06/maintainability.md` 를 직접 열어
  확인한 결과 W1 이 정확히 `trigger-workflow-ref.ts` 의 파일-스코프 메인 독스트링(당시 `/** */`
  블록, 3-64행)을 "함수 선언과 구문적으로 연결되지 않은 고아 블록" 으로 지목한다. `git show
  64334e708:...trigger-workflow-ref.ts` 로 그 시점 원문을 확인한 결과 이미 `//` 로 바뀐 상태였고
  (round-2 착지 커밋에서 `/** */`→`//` 전환 자체가 15_52_06 W1 에 대한 fix였음), 그 전환과 함께
  써넣은 설명 문장이 그때는 "세 번" 이라고만 적어 **자기 자신(이 전환의 계기가 된 W1 발견)을 그
  카운트에서 빠뜨렸다** — 이것이 3라운드 `review/code/2026/09/10/16_26_57` requirement W1 이 잡은
  정확히 그 결함이다. 이번 커밋(`cfd195fb4`)의 diff는 그 결함을 "세 번"→"네 번" + 자기 지시 문장
  추가로 정정했고, 위 계보를 그대로 따라가면 3(2026-09-06, #1292) + 1(이 파일, 15_52_06, 이 PR) = 4 로
  산수가 맞는다.

새로 발견한 결함 없음 — 정정이 사실과 일치한다.

## 검증 2 — ⑤ 예외 서술의 사실성 (null vs `{}` 진단 불가)

`codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts:30-32`:

```
> ⑤ 가 없으면 실패 메시지가 *"keys [] ≠ ['id','name']"* 이 되어 **`null` 인지 `{}` 인지 말해
> 주지 않는다.** 즉 ⑤ 의 가치는 검출이 아니라 **진단 품질**이다.
```

**핵심 주장(⑤ 없으면 null/{}를 구분 못 한다)은 실측으로 참임을 확인했다.** 저장소 파일을 건드리지
않고 scratch 에 별도 스크립트(`/private/tmp/.../scratchpad/repro.js`)를 만들어, 헬퍼가 실제로 쓰는
`expect(...).toEqual(...)` 호출(같은 `expect` 패키지, `node -e` 로 백엔드 디렉터리에서 require)을
`workflow: null`(→`ref = {}`, ⑤ 삭제 시나리오와 동일) 과 `workflow: {}`(리터럴 빈 객체) 두 입력으로
각각 실행했다:

```
=== workflow: null ===
expect(received).toEqual(expected) // deep equality
- Expected  - 4        + Received  + 1
- Array [ "id", "name", ]           + Array []

=== workflow: {} literal ===
expect(received).toEqual(expected) // deep equality
- Expected  - 4        + Received  + 1
- Array [ "id", "name", ]           + Array []
```

**두 시나리오의 실패 메시지가 바이트 단위로 동일하다** — 즉 ⑥ 키셋 검사만으로는 `workflow` 가
`null` 이었는지 실제로 빈 객체 `{}` 였는지 구분할 방법이 없다는 서술이 정확하다.

**단, 인용된 문자열 자체는 리터럴이 아니라 의역이다(경미).** 실제 Jest 출력은
`"keys [] ≠ ['id','name']"` 도, 커밋 메시지가 쓴 `"expected [] to equal ['id','name']"` 도 아니고
`expect(received).toEqual(expected) // deep equality` 헤더 + `jest-diff` 스타일의 `Array [] ` vs
`Array ["id","name"]` 블록이다. 두 표현 모두 "빈 배열 vs `['id','name']`" 이라는 내용은 정확히
전달하지만, 따옴표로 감싸 마치 실제 에러 문자열을 인용하는 것처럼 보이는 서술 방식이 이 세션이
반복해서 겪은 "근거 문장의 정밀도" 패턴과 같은 결이라 기록해 둔다. 기능·판정 로직에는 영향 없다.

- **[INFO]** ⑤ 예외 서술이 인용하는 "실패 메시지" 문자열이 실제 Jest 출력의 리터럴 인용이 아니라
  의역이다 — 핵심 주장(진단 불가)은 참이나 인용 형식이 오인을 부를 수 있다
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts:30-31`
  - 상세: 실제 `toEqual` 실패 메시지는 `expect(received).toEqual(expected) // deep equality` +
    jest-diff 블록(`Array []` vs `Array ["id","name"]`)이며, 문서가 따옴표로 인용한
    `"keys [] ≠ ['id','name']"` 형태와 텍스트가 다르다(`node -e` 로 실제 `expect` 패키지를 호출해
    재현 확인, 백업/원복 불필요 — 저장소 파일은 읽기만 했다). 논지 자체는 훼손되지 않는다: 두
    입력(`null`/`{}`)이 만드는 메시지가 서로 구분 불가능하다는 것은 실측으로 참이다.
  - 제안: 여유가 있다면 "keys [] ≠ [...]" 를 "실패 메시지가 빈 배열 vs `['id','name']` 형태의
    구조적 diff 가 되어" 정도로 바꿔 리터럴 인용처럼 보이지 않게 한다. 이 라운드가 "정지 라운드" 로
    선언돼 있고(커밋 메시지) 기능 영향이 없으므로 이 브랜치에서 즉시 고칠 필요는 없다 — 다음 후속
    등재 때 같이 반영해도 무방.

## 검증 3 — 라벨 `③·⑤` 이 실제로 무는 가드와 일치하는가

`trigger-workflow-ref.spec.ts:96-106` 의 헤더 `## 가드 ③·⑤ — null 은 부재가 아니다` 를 실제
`expectTriggerWorkflowRef` 구현과 대조했다. 함수 안에서 가드는 정확히 11개 지점
(① `dto` not-null/defined 쌍 → ② 비밀 컬럼 loop → ③ `present:false` 키 부재 → ④ `present:true` 키
존재 → ⑤ `workflow` not-null → ⑥ 키셋 `toEqual` → ⑦ `id` 타입 → ⑧ `id` UUID → ⑨ `name` 타입 →
⑩ `name` 길이 → ⑪ `expectedWorkflowId`)이고, 이는 헤더 docstring 이 선언한 11단계·아래 11개
`it()`(+양성 케이스 1개=12) 와 정확히 1:1 대응한다 — 직접 라인별로 세어 확인했다.

`③·⑤` 라벨이 붙은 그 테스트(`null` 은 부재가 아니다)는 **본문에서 스스로** "이 케이스가 실제로
무는 것은 ③ 쪽뿐이다 ... ⑥ 키셋 검사가 먼저 던진다" 라고 명시한다 — 즉 라벨은 "이 테스트가
겨냥하는 두 가드" 를 나타낼 뿐 "독립적으로 판별하는 가드" 를 주장하지 않으며, 그 구분을 문장으로
분명히 한다. 이 라벨 부여 자체는 3라운드 `review/code/2026/09/10/16_26_57` testing INFO(*"라벨이
이 하나만 비어 있어 '가드가 10개' 로 오인될 수 있다"*)에 대한 fix이고, 인용도 정확하다.
**라벨-가드 불일치 없음 — 새로 지적할 것 없음.**

## 검증 4 — 재지적 금지 항목 확인

- SPEC-DRIFT(§3, `2-trigger-list.md §3` "이 축에는 캐너리가 아직 없다") — `RESOLUTION.md` Warning
  표에 planner 후속 1번으로 이미 등재돼 있음을 확인. 본 리포트에서 재론하지 않는다.
- 사전 존재 CRITICAL 2건(chatChannel PATCH bot-token 우회, `ChatChannelCard` 편집-저장 400) —
  `RESOLUTION.md` Critical 표에 처분(트래커 등재)이 이미 기록돼 있음을 확인. 본 리포트에서
  재론하지 않는다.

## 뮤테이션/검증 위생

이번 검증은 저장소 파일을 전혀 수정하지 않았다 — `node -e`/scratch 스크립트로 실제 `expect`
패키지를 직접 호출해 재현했을 뿐, `trigger-workflow-ref.ts`/`.spec.ts` 는 `Read` 로만 열었다.
`git status --short` 로 작업 트리 clean 을 확인했다(추가 파일 없음, scratch 는 저장소 밖).

## 요약

이번 라운드의 `codebase/` 델타는 주석·라벨 전용 2파일이며 로직 변경이 없다. 저자가 직전 라운드에서
지적받은 "고아 JSDoc 카운트(세 번→네 번)" 정정은 2026-09-06 세 건(`#1292`, memory 파일과 대응
확인)과 이 파일 자신의 15_52_06 발견을 합쳐 산수가 정확히 맞고, 자기 지시("이 註가 인용하는 W1
자체가 그 네 번째")도 시점·인과관계 모두 사실과 일치한다. ⑤ 예외 서술의 핵심 주장(null/`{}` 구분
불가)은 `expect` 라이브러리를 직접 실행해 재현 확인했고 참이다 — 다만 인용된 "실패 메시지" 문자열
자체는 실제 Jest 출력의 리터럴이 아닌 의역이라 INFO 로 기록한다. 라벨 `③·⑤` 부여는 실제 가드
11개와 1:1 대응하며 스스로 "③만 실제로 문다" 고 명시해 오인 소지가 없다. 신규 코드 결함 없음,
SPEC-DRIFT·사전 존재 CRITICAL 은 재지적하지 않았다.

## 위험도

NONE — 코드 로직 변경 없음(주석·라벨 전용), 검증한 세 서술 모두 사실과 일치하거나(1, 3) 핵심
주장이 참이고 인용 형식만 경미하게 의역(2, INFO). 차단 사유 없음.

STATUS: success
