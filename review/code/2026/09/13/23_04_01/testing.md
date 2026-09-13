# 테스트(Testing) 코드 리뷰 — error-code-emission-axis (라운드 10 / `23_04_01`)

## 검토 범위·방법

`origin/main` 대비 이 브랜치는 10개 커밋(`65256a109`~`d39d91a84`)이 쌓여 있고, 실질
코드는 두 파일로 좁혀진다 — `guide-identifier-scan.ts`(발행 축 정규식 3종 + 공용 수집기
`collectMatches` + `computeNonEmittedOffenders`/`isMessagePrefixOnly` + 두 어휘 목록)와
그 테스트 `guide-identifier-existence.test.ts`. 나머지(`CHANGELOG.md`·`PROJECT.md`·
`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·plan·이전 라운드 산출물이라 테스트
관점의 코드 대상이 아니다.

이 축은 이미 9라운드의 `/ai-review`를 거치며 매 라운드 testing 리뷰어가 실제 결함(진짜
CRITICAL 2건 포함)을 mutation으로 찾아 판별 fixture·진리표·vacuity floor로 닫아 왔다
(`review/code/2026/09/13/{19_23_22→…→21_19_46}/testing.md`, RESOLUTION.md 궤적).
이번 라운드가 보는 것은 **직전 리뷰(`22_38_36`) 이후의 fix 커밋(`d39d91a84`, "라운드 9")과
그 이전 두 커밋(라운드 7 `53d29a6f4`, 라운드 8 `061f5153f`)이 코드에 실제로 추가한 테스트**다
— `git diff eb53aba1c..d39d91a84 -- guide-identifier-scan.ts guide-identifier-existence.test.ts`
로 직접 diff를 확인했다. **라운드 9 자체는 코드 diff가 `guide-identifier-scan.ts`의 주석
2줄뿐**(트래커 인용을 줄 번호에서 앵커 문구로 교체) — 테스트 코드 변경이 없다.

### 독립 재현 (저장소 뮤테이션, 완료 후 `cp`로 원복·`git status --short`로 확인)

- `guide-identifier-existence.test.ts` 단독 실행 → **82 passed (82)**. plan
  (`error-code-emission-axis.md:603`)이 주장한 "79 → 82"·"폴더 23파일 3,382건"과 일치.
- `codebase/frontend/src/lib/docs/__tests__` 폴더 전체 실행 → **23 files / 3,382 tests
  passed** — plan의 실측 숫자와 정확히 일치.
- `SOURCE_ROOTS = ["codebase/backend/src", "codebase/packages"]`를
  `["codebase/backend/src"]`로 원본 파일에서 직접 뮤테이션(사본은 리포 밖
  scratch에 `cp`로 백업) → 재실행 결과 **정확히 1건만 FAIL**:
  `` `[루트 통일] `packages` 에만 있는 파일도 특정된다 — 거짓 실패 방지` ``
  (`resolveSourceLines(onlyInPackages[0])`가 `null`을 반환). 나머지 81건은 GREEN으로
  유지됐다 — 이 신규 테스트가 **정확히 자신이 겨눈 것만** 무는 판별 fixture임을 확인했다.
  이후 `cp`로 원본을 복원했고 `git status --short`로 저장소가 세션 시작 시점과 동일함을
  확인했다(잔여는 이 리뷰 세션 자신의 출력 디렉터리 + 병행 세션의 consistency 출력뿐).
- `resolveSourceLines — 유일성 가드` describe만 `-t` 필터로 격리 실행 → **4 passed
  | 78 skipped**, 정상 통과. 모듈 스코프 캐시(`sourceLinesCache`)가 앞선 "where" 검증
  블록의 사전 호출 없이도 이 describe 단독으로 올바르게 동작함을 확인 — 테스트 순서에
  대한 숨은 결합이 없다.

## 발견사항

새로 지적할 CRITICAL/WARNING은 찾지 못했다. 라운드 7·8이 각각 넣은 신규 테스트
(`resolveSourceLines` 0건/2건 이상/1건/루트-통일 4종, `parseWhereRefs` 잔여 대조군 2종)는
전부 "두 판정이 갈리는 값"을 정확히 고르고 있고, 위 뮤테이션 재현으로 실제 판별력도
확인했다.

- **[INFO]** `parseWhereRefs`의 잔여(residue) 판정이 미도달하는 분기가 여전히 하나 있다
  — 회귀 아님, 확인 후 유지
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    함수 `parseWhereRefs` 및 그 호출부(`describe("발행 축 — …")` 안 `it("where 의
    파일:줄이 …")`)
  - 상세: 현재 검증 순서는 "residue !== '' → refs.length === 0 → 파일 미특정" 이다.
    `where` 값이 `" — 산문"`처럼 refs 앞부분이 공백/구분자뿐이면 residue도 빈 문자열이
    되고 `refs.length === 0` 분기가 대신 걸린다. 이 분기 자체를 겨눈 합성 fixture는
    없다 — 다만 이는 라운드 3(`review/code/2026/09/13/20_13_13/RESOLUTION.md` INFO#11)과
    라운드 4~9에서 반복 확인·명시적으로 유예된 항목("순수 함수 분리 시 함께")이고, 이번
    라운드의 fix 대상이 아니었다(라운드 9는 주석만 건드렸다). 새로 발견한 갭이 아니라
    기존에 문서화된 유예가 그대로 남아 있음을 재확인한 것으로만 기록한다.
  - 제안: 조치 불요(기존 유예 유지).

- **[INFO]** `[2건 이상]` 판별 fixture(`index.ts`)가 합성이 아니라 실제 저장소 레이아웃에
  결합돼 있다 — 이미 자각·문서화된 트레이드오프
  - 위치: `guide-identifier-existence.test.ts` `describe("resolveSourceLines —
    유일성 가드")`의 `it("[2건 이상] 다중 매치도 null …")`
  - 상세: `index.ts`가 오늘 `SOURCE_ROOTS` 안에 55개 있다는 실측에 의존한다. 이 개수가
    장차 1개 이하로 줄면(비현실적이지만 원리적으로는 가능) 이 테스트는 **잘못된 이유로
    FAIL**한다(진짜 회귀가 아니라 코퍼스 축소) — 다만 그 실패가 *조용히 통과*가 아니라
    *fail-loud*이므로 위험 방향은 안전하다. 주석에 46→55 개수 변화까지 실측·기록해 두어
    "왜 이 값을 쓰는지"가 추적 가능하다. 합성 fixture로 대체하려면 `walkTree`를 stub해야
    하는데 이는 "실제 저장소 배치에 관한 주장"이라는 이 describe 자신의 설계 의도(같은
    describe의 `[루트 통일]` 케이스 주석)와도 일치하는 선택이다.
  - 제안: 조치 불요 — 현재 설계가 의도적이고 실측이 근거를 남기고 있다.

- **[INFO]** `sourceLinesCache`(module-scope Map)가 두 개의 분리된 `describe` 블록에서
  공유된다 — 격리 확인, 결함 아님
  - 위치: `guide-identifier-existence.test.ts:120`(`sourceLinesCache` 선언) — 사용처는
    상단 `describe("유저 가이드 식별자 실재성 가드")`의 "where" 검증과 하단
    `describe("resolveSourceLines — 유일성 가드")` 양쪽
  - 상세: 전체 스위트를 순서대로 실행하면 `execution-engine.service.ts`가 상단 "where"
    검증에서 먼저 캐시되고, 하단 `[1건] 유일하면 줄 배열을 준다` 테스트는 그 캐시를
    재사용한다(재계산 아님). 이것이 mutation 검출력을 떨어뜨리는지 `-t` 필터로 하단
    describe만 격리 실행해 확인했다 — **격리 실행도 통과**하므로 순서 의존이 실질적
    위험으로 이어지지 않는다(순수 함수 메모이제이션이라 계산 시점과 무관하게 같은 결과).
    다만 다음에 이 describe를 읽는 사람이 "이 `it`이 매번 새로 계산한다"고 오해할 수 있는
    자리이므로 기록한다.
  - 제안: 조치 불요. 굳이 명시하려면 해당 `it` 주석에 "이 파일명은 상단 where 검증에서
    이미 캐시됐을 수 있다"를 한 줄 덧붙일 수 있다(낮은 우선순위).

## 요약

라운드 7·8이 실제로 새로 짠 테스트(`resolveSourceLines` 유일성 가드 4종, `parseWhereRefs`
잔여 대조군 2종)는 이 저장소가 9라운드에 걸쳐 다듬어 온 규율(두 판정이 갈리는 값을
고정·판별 fixture·vacuity floor)을 그대로 따르고 있고, `SOURCE_ROOTS`에서 `packages`를
빼는 뮤테이션을 직접 걸어 **정확히 그 신규 테스트 1건만** RED가 되는 것을 확인했다 —
과매치나 무관한 부수 실패 없이 정밀하게 겨눈 판별력이다. 라운드 9는 코드 diff가 주석
2줄뿐이라 테스트 관점에서 검토할 신규 표면이 없었다. 남은 갭 둘(잔여 판정의 `refs.length
=== 0` 분기 미도달, `[2건 이상]`의 실코퍼스 결합)은 새로 발견한 것이 아니라 3~9라운드에서
이미 지적·유예가 명시된 항목이 그대로 남아 있는 것이고, 캐시 공유는 격리 실행으로 실질
위험이 없음을 직접 확인했다. 새로 보고할 CRITICAL/WARNING은 없다.

## 위험도

NONE
