# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** CHANGELOG 의 판별력 근거 수치("단위 테스트 15개")가 실제 테스트 개수와 다르다
  - 위치: `CHANGELOG.md:26` ("테스트 15개가 진다." — 문장은 25~26줄에 걸쳐 있다)
  - 상세: 해당 문단은 "현 코퍼스엔 위반이 없어 술어가 망가져도 가드만으로는 초록이므로, 판별의
    부담은 단위 테스트 15개가 진다" 고 주장한다. 그런데 `isPendingPlanPath` 를 검사하는
    `describe("isPendingPlanPath", ...)` 블록(`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts`)은 실측으로
    **`it()` 8개 · `expect()` 16개**다(`awk`+`grep` 으로 직접 셈). 같은 diff 안의 다른 산출물도
    이와 다른 수를 말한다 — `plan/in-progress/pending-plan-is-plan.md` 의 체크리스트는
    "새 단위 6"(리졸루션 이전 시점), `review/code/2026/09/24/19_57_00/RESOLUTION.md` 는
    "새 단언 2개만큼"(6714→6716, 즉 6+2=8)이라고 적어 서로는 정합하지만 CHANGELOG 의 "15" 와는
    맞지 않는다. 이 문장은 "이 술어를 리팩터링할 때 몇 개의 단위 테스트가 회귀를 잡아주는가" 라는
    **판별력 주장**이라 다음 편집자가 테스트를 줄이거나 통합해도 되는지 판단하는 근거로 쓰일 수
    있다 — 실제보다 부풀려진 숫자(15 > 8)는 "이미 충분히 두텁다" 는 과신을 준다.
  - 제안: `CHANGELOG.md:26` 의 "15" 를 실측값(테스트 케이스 기준 8, 또는 assertion 기준 16 — 어느
    쪽을 셀지 명시)으로 정정한다. 수치를 CHANGELOG 에 다시 넣기 전에 `grep -c "  it("` 류로
    재확인할 것(이 PR 자체가 "실측이 아니라 훑은 값" 오류를 두 번 지적받은 이력이 있다 — W1/W2).

- **[INFO]** (선재, 이번 diff 는 확대하지 않음) `isApplicable` 과 `isPendingPlanPath` 가 "배열
  접두사 중 하나로 시작하는가" 를 각자 인라인 `.some(...startsWith(...))` 로 중복 구현한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:77`
    (`INCLUDE_PREFIXES.some((p) => relPath.startsWith(p))`) / `:104`
    (`PENDING_PLAN_DIRS.some((dir) => norm.startsWith(dir))`)
  - 상세: 직전 리뷰 라운드(`review/code/2026/09/24/19_57_00/maintainability.md`)에서 이미
    INFO 로 지적됐고 SUMMARY 의 INFO 5·조치 보류 사유("현재는 짧은 함수라 추출 비용 대비 이득
    낮음, 세 번째 유사 술어가 생기면 재고")도 타당하다. 이번 라운드에서 코드 자체는 바뀌지
    않았으므로 재확인만 하고 등급을 유지한다.
  - 제안: 조치 불요(기존 결정 유지). 세 번째 유사 술어가 추가될 때 공용 헬퍼(`hasAnyPrefix`)로
    통합을 재고할 것.

- **[INFO]** (선재) "plan 위치 디렉터리" 지식이 `PENDING_PLAN_DIRS` 와
  `spec-pending-plan-existence.test.ts` 의 문자열 치환에 독립적으로 중복된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:95`
    (`PENDING_PLAN_DIRS`) / `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts:64`
    (`planRel.replace("/in-progress/", "/complete/")`, 이번 diff 가 건드리지 않은 기존 줄)
  - 상세: 직전 라운드(architecture.md INFO 1)와 동일 지적이며 이번 diff 는 이 중복을 늘리지도
    줄이지도 않았다. 세 번째 plan 위치가 생기면 두 곳 중 하나만 갱신되고 다른 하나가 조용히
    낡을 수 있다는 위험은 그대로 남아 있다.
  - 제안: 조치 불요(다음에 이 파일을 만질 기회에 `PENDING_PLAN_DIRS` 기반으로 파생시킬 것 — 기존
    권고 유지).

## 요약

이번 라운드의 실제 소스 변경분(`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`
및 두 테스트 파일)은 직전 라운드(`19_57_00`)에서 이미 NONE 판정을 받은 코드와 동일하며, 이번
diff 가 그 위에 더한 것은 SoT 절 인용 정정(§3→§2.1)과 테스트 2건(룩얼라이크 캐너리·non-string
가드) 추가뿐으로 함수 길이·중첩·순환 복잡도·네이밍 컨벤션 어디에도 새 결함을 만들지 않았다.
`isPendingPlanPath` 는 여전히 4줄 본문·분기 3개의 순수 함수이고, 기존 `isApplicable` 과 동일한
스타일(모듈 최상단 상수 배열 + 짧은 가드 함수 + 배경 설명 주석)을 그대로 따른다. 다만 이번
라운드가 새로 얹은 `CHANGELOG.md` 항목의 판별력 근거 문장이 실제 테스트 개수(8개/16 assertion)와
다른 "15개" 를 주장한다 — 코드 자체의 유지보수성 문제는 아니지만, 이 저장소가 코드 옆에 "왜"
와 "얼마나 검증됐는가" 를 남기는 관례를 강하게 따르는 만큼, 그 수치가 틀리면 다음 편집자가
회귀 안전망의 두께를 오판할 수 있어 WARNING 으로 짚는다. 나머지 두 건은 이미 알려진 저비용
INFO 로, 이번 diff 가 확대하지 않았으므로 등급을 유지한다.

## 위험도

LOW
