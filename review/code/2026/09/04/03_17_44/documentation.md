# 문서화(Documentation) 리뷰

## 검증 방법

이 PR(기준 `562d3119f`→`f6358ec0a`, 커밋 7개: walker 통합 + 낡은 spec 캐스트 가드 + 리뷰 1R~4R 수정)의
실제 변경 파일 9개(`source-scan.{ts,spec.ts}`, repo-guard 5개, `nullable-type-lie-cast-guard.ts`/`.spec.ts`,
plan 문서)를 `Read`로 저장소 현재 내용 전문을 직접 열어 확인했다. 이전 4개 라운드(01_49_18·02_12_38·
02_35_22·02_57_22)의 documentation 리뷰·RESOLUTION 을 먼저 읽어, 이미 지적·조치된 항목(JSDoc orphan·
`stripLiterals` 무테스트·픽스처 중복·"실측 20건" 하드코딩 등)을 재확인만 하고 새 지적으로 중복 제기하지
않았다. 의심 지점은 `git log -L`/`git show <commit>` 로 어느 커밋이 그 줄을 만들었는지 추적했다. 저장소
트리에는 아무것도 쓰지 않았다 — `git status --short` 는 이번 세션 산출 디렉터리(`review/code/2026/09/04/
03_17_44/`, untracked) 하나만 보여준다(리뷰 종료 시점까지 동일).

## 발견사항

- **[WARNING]** 직전 라운드(4R, 커밋 `59a229943`)가 "검증 안 되는 하드코딩 개수를 뺀다"며 편집하다
  중복 단어를 남겼다 — "그 근거와 근거는" 이 되어 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:221-222`
    (`findStaleSpecCasts` docstring, "## 오탐 없음은 {@link widenedEntityFields} 가 이름 충돌을 뺀 덕이다" 절)
  - 상세: 원문(3R 이전)은 "충돌을 안 뺐을 때 **오탐이 재현된다** — 그 근거와 실측 20건은 그쪽 docstring 에
    있다" 였다. 4R 은 하드코딩 개수 "20건" 을 지우면서 `실측 20건은` 부분만 `근거는` 으로 바꿨는데,
    앞줄에 이미 있던 `그 근거와` 를 그대로 남겨 두 줄을 이어 읽으면 "그 근거와 근거는 그쪽 docstring 에
    있다" 가 된다 — 단어 `근거` 가 중복되고 "…와" 로 이어지는 접속 대상이 사라져 문법적으로 붕 뜬다.
    `git log -L 218,224:.../nullable-type-lie-cast-guard.ts` 로 확인하면 이 정확한 변경이 커밋
    `59a229943` (제목: "리뷰 4R — 한 자리만 고쳐서 깨진 참조를 만들었다") 에서 들어왔다 — 아이러니하게도
    "한 자리만 고쳐서 새 결함을 만들지 않겠다" 는 그 커밋 자체가 이 잔여 결함을 만들었다.
  - 제안: 두 줄을 "캐스트를 지워도 `tsc` 가 통과한다. 충돌을 안 뺐을 때 **오탐이 재현된다** — 그 근거는
    그쪽 docstring 에 있다." 로 정리(중복 `근거` 제거).

- **[WARNING]** 같은 커밋(`59a229943`)이 plan 문서에도 동일한 클래스의 중복 어구를 남겼다 —
  "판정 대상 판정 대상이 그만큼 줄어든다"
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:277-278`
    ("후속 — 넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트 가드" 항목의 인용 블록)
  - 상세: 원문(3R 이전)은 "…쪽의 **정당한** 캐스트를 오탐하기 때문이다(최소 픽스처로 재현). 판정 대상
    135 → **115**. 재현율을 잃는 대신…" 이었다. 4R 이 검증 안 된 숫자 나열(`135 → 115`)을 날짜 박힌
    괄호 서술로 바꾸며 앞줄 끝의 `판정 대상` 을 지우지 않고 다음 줄 앞에 `판정 대상이 그만큼
    줄어든다(...)` 를 추가했다. 결과: "…최소 픽스처로 재현). 판정 대상 판정 대상이 그만큼 줄어든다
    (**2026-09-04 실측 135 → 115**)." — `판정 대상` 이 연속 두 번 등장한다. `git log -L
    270,280:plan/in-progress/entity-nullable-column-type-mismatch.md` 로 확인하면 역시 `59a229943`
    가 원인이다.
  - 제안: 앞줄 끝의 `판정 대상` 을 지운다 — "…최소 픽스처로 재현). 판정 대상이 그만큼 줄어든다
    (**2026-09-04 실측 135 → 115**). 재현율을 잃는 대신…"

- **[WARNING]** 바로 다음 커밋(`f6358ec0a`)이 "날짜 없는 '실측' 주장" 을 grep 으로 훑어 고쳤다고 했는데,
  같은 문구의 **자매 파일 사본**을 놓쳤다 — `nullable-type-lie-cast.spec.ts` 에 `오늘 저장소는 전부
  T | null` 이 여전히 남아 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:238-241`
    (`it.each(['공백 없음', ...])` 바로 위 JSDoc, `isNullableType` 을 검증하는 테스트 설명)
  - 상세: `nullable-type-lie-cast-guard.ts` 의 `isNullableType` 함수 docstring 은 원래
    "오늘 저장소는 전부 `T | null` 이라 미발현이지만(실측)" 이라고 적혀 있었는데, 커밋 `f6358ec0a`
    (제목: "4R 절차를 바로 적용 — 내 훑기가 2자리를 더 찾았다") 이 이걸 "저장소는 전부 `T | null` 이라
    미발현이지만(**2026-09-04 실측**)" 으로 고쳐 `오늘` 이라는 상대 표현을 없애고 날짜를 박았다(같은
    커밋 메시지가 "① 날짜 없는 하드코딩 개수 ② 상호 참조 ③ **날짜 없는 '실측'**" 세 축으로 훑어
    "재훑기 0건" 이라고 명시적으로 주장한다). 그런데 `nullable-type-lie-cast.spec.ts:241` 의 테스트
    docstring 은 정확히 같은 주장("오늘 저장소는 전부 `T | null` 이라 이 테스트가 유일한 방어다")을
    **날짜 없이 그대로** 갖고 있다 — `git log -L 238,242:.../nullable-type-lie-cast.spec.ts` 로 보면
    이 줄은 3R(`df552e4c8`)에서 들어왔고 4R 스윕(`f6358ec0a`)이 대상으로 삼지 않았다. 이 plan 문서가
    바로 이 PR 안에서 "한 자리만 고치는 버릇" 을 4번 반복했다고 자인하고(`plan/in-progress/
    entity-nullable-column-type-mismatch.md` "## 한 자리만 고치는 버릇" 절), "서술을 고칠 때는 그
    문구를 grep 해서 나온 전부를 고친다" 는 절차를 세웠는데도, 그 절차를 처음 적용한 바로 그 커밋이
    구현부(guard.ts)와 소비부(spec.ts)에 나뉘어 있는 동일 주장 중 한쪽만 훑은 셈이다 — 대상 범위가
    "grep '오늘'" 이 아니라 아마도 자신이 방금 편집한 파일로 좁혀졌을 가능성이 있다.
  - 제안: `nullable-type-lie-cast.spec.ts:241` 도 같은 패턴으로 정정 — "저장소는 전부 `T | null` 이라
    이 테스트가 유일한 방어다(**2026-09-04 실측**, 리뷰 3R INFO#4)." 처럼 `오늘` 을 빼고 날짜를 박는다.
    재발 방지책으로는, 이번처럼 "grep 해서 나온 전부" 를 커밋 메시지에 적을 때 실제로 돌린 명령과
    매치 수를 함께 남기면(예: `grep -rn "오늘" codebase/backend/src/repo-guards plan/…` → N건) 다음
    사람이 "정말 전부였는지" 를 재검증할 수 있다.

## 확인된 정상 항목 (재검증, 조치 불필요)

- `stripComments`/`stripLiterals`/`countCalls` 각자의 JSDoc 이 자기 선언 바로 위에 정확히 붙어 있다
  (1R W4 조치 확인 — orphan 없음).
- `stripLiterals` 전용 테스트 7건, `withFixture`→`withFiles` 통합 후 얇은 래퍼로 정리, `sort()` 판별
  용 `nested-sibling.ts` 픽스처, `WIDENED_DECL` 의 "추가 데코레이터 1개까지만" 한계가 이제 `## 한계`
  절로 명시됨 — 전부 이전 라운드 WARNING/INFO 가 실제로 코드에 반영돼 있다.
- `masked-reject-callers-guard.ts:47` 의 `` `src/` 하위 `.ts` 전수 (node_modules·dist 제외). `` 주석은
  `collectTsFiles` 가 항상 켜는 `.d.ts` 제외를 여전히 언급하지 않는다 — 3R 에서 이미 지적·유예된
  항목이고 이번 라운드도 코드 변경이 없어 재조치 요구하지 않는다(참고 기록만).
- README·API 문서·CHANGELOG: 이 diff 는 내부 테스트 인프라(`repo-guards` walker 통합 + 신규 정적
  가드) + plan 문서 갱신뿐이다. 루트 `CHANGELOG.md` 는 API/DTO/스키마 계약이 실제로 바뀐 변경만
  기록하는 관례고 이번 diff 는 해당 없다. 신규 환경변수·배포 설정도 없다.

## 요약

이번 diff(walker 5사본 통합 + 낡은 spec 캐스트 가드)는 신규 공개 함수마다 "왜 필요한가/한계/오탐 여부"
절을 갖춘 JSDoc 을 일관되게 달았고, 이전 네 라운드의 documentation WARNING(JSDoc orphan·전용 테스트
부재·"검증 안 되는 개수" 하드코딩)이 실제로 코드에 반영됐음을 재확인했다는 점에서 전반적으로 문서화
규율이 여전히 높다. 다만 그 "검증 안 되는 개수를 뺀다" 는 수정 작업 자체(3R→4R, 커밋
`59a229943`/`f6358ec0a`)가 두 종류의 새 잔여물을 남겼다 — 편집 중 남은 중복 단어 2건(`guard.ts` 의
"근거와 근거는", `plan.md` 의 "판정 대상 판정 대상이")과, "날짜 없는 실측 주장을 훑었다" 고 커밋
메시지가 명시했는데 정작 자매 파일(`spec.ts`)의 동일 문구는 훑기에서 빠진 사례 1건이다. 셋 다 기능·
게이트 통과에는 영향이 없는 순수 프로세 결함이지만, 이 PR 이 "한 자리만 고치는 버릇" 을 명시적 주제로
삼아 절차까지 만든 바로 그 지점에서 같은 실패 양상(부분 스윕)이 반복됐다는 점에서 기록해 둔다.

## 위험도

MEDIUM
