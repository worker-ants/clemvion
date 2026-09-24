# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** plan 디렉터리 지식이 두 곳에 독립적으로 존재한다 (이전 라운드에서 이미 지적·유예된 항목, 변경 없음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:95` (`PENDING_PLAN_DIRS`) / `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts:64` (`planRel.replace("/in-progress/", "/complete/")`, 이번 diff 범위 밖의 기존 코드)
  - 상세: `isPendingPlanPath` 는 "어느 디렉터리가 work plan 위치인가" 를 `PENDING_PLAN_DIRS` 배열 하나로 응집시켰지만, 바로 옆 `it("... path resolves", ...)` 는 같은 지식을 `"/in-progress/"` → `"/complete/"` 문자열 치환으로 독립 인코딩한다. 직전 라운드(`review/code/2026/09/24/19_57_00/architecture.md`)가 이미 INFO 로 짚었고, RESOLUTION(`review/code/2026/09/24/19_57_00/RESOLUTION.md` INFO 1·5)에서 "세 번째 소비처가 생기면" 조건으로 명시적으로 유예했다. 이번 라운드 diff(코드 3파일, `git diff --stat origin/main...HEAD -- codebase/` 확인)는 해당 파일들을 다시 건드리지 않았으므로 새로운 결함이 아니라 기존 유예 결정의 재확인이다.
  - 제안: 조치 불요 — 기존 유예 결정을 그대로 승계.

- **[INFO]** 두 "경로 분류 술어" 의 함수 시그니처가 비대칭이다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:75`(`isApplicable(relPath: string)`) 대 `:97`(`isPendingPlanPath(relPath: unknown)`)
  - 상세: 같은 모듈에서 같은 역할(접두사 allow-list 판정)을 하는 두 함수가 입력 타입 계약을 달리한다. 의도는 합리적이다 — `isApplicable` 은 내부에서 이미 정규화된 문자열만 받는 반면(`collectApplicableSpecs` → `walkTree` 산출물), `isPendingPlanPath` 는 신뢰되지 않는 YAML 파스 결과(`pending_plans: [42]` 같은 항목)를 직접 받는 경계에 있다. 다만 이 비대칭이 왜 존재하는지는 코드 주석에 암묵적으로만 드러나 있어(YAML 파싱 언급) 다음에 세 번째 술어를 추가하는 사람이 "그때그때 다른 시그니처" 를 관례로 오해할 여지가 있다.
  - 제안: 조치 불요 수준이지만, 다음에 이 파일을 만질 기회에 "왜 `unknown` 을 받는가(신뢰 경계)" 를 한 줄로 명시하면 다음 추가자의 판단 기준이 된다.

## 요약

핵심 변경(`isPendingPlanPath`)은 기존 `isApplicable` 과 동일한 형태(순수 함수·모듈 최상단 allow-list 상수·짧은 가드 로직)를 그대로 따라 4개 가드가 공유하는 헬퍼 허브(`spec-frontmatter-parse.ts`)에 추가됐고, 단일 책임(경로가 work plan 형태인가)을 정확히 지킨다. 이번 결함의 본질이었던 "존재 검사가 정합 검사를 대신하던" 문제를 "형태 검사"(`isPendingPlanPath`, 신규)와 "존재 검사"(기존 `it("... resolves")`)로 명확히 분리해 관심사를 섞지 않았고, 가드가 항목마다 형태 → 존재 순서로 검사하도록 배선한 것도 사고 재발을 막는 방향과 일치한다. `path.posix.normalize` 를 접두사 비교 이전에 수행해 `..` 이스케이프를 닫은 것, 허용 위치를 정확히 두 디렉터리로 좁힌 닫힌 allow-list(fail-closed) 설계 모두 이 가드의 목적(SoT 보다 넓게 구현되지 않기)에 부합한다. 순환 의존성, 레이어 책임 혼선, 신규 안티패턴은 발견되지 않았다. 유일하게 남는 것은 이전 라운드에서 이미 논의·유예된 "plan 디렉터리 지식 중복"(`PENDING_PLAN_DIRS` vs 문자열 치환)으로, 이번 diff 가 만들거나 확대한 문제가 아니며 기존 합의(세 번째 소비처 등장 시 통합)가 여전히 유효하다. 나머지 리뷰 대상 파일(CHANGELOG·plan 문서·이전 라운드의 review/consistency 산출물)은 실행 코드가 아닌 프로세스 기록물로, 아키텍처 관점에서 평가할 대상이 아니다.

## 위험도

NONE
