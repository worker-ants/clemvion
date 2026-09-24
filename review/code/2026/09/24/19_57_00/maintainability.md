# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `isApplicable` 과 `isPendingPlanPath` 가 같은 "접두 배열 순회" 패턴을 각자 인라인으로 구현한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:77` (`isApplicable` 의 `INCLUDE_PREFIXES.some((p) => relPath.startsWith(p))`) 와 `:100` (`isPendingPlanPath` 의 `PENDING_PLAN_DIRS.some((dir) => norm.startsWith(dir))`)
  - 상세: 두 함수 모두 "문자열 배열 중 하나로 시작하는가" 를 `.some(...startsWith(...))` 로 반복한다. `isApplicable` 은 basename 예외·정규식 제외 등 추가 로직이 있어 완전히 같은 모양은 아니지만, 접두 매칭 자체는 동일한 표현이 두 번 등장한다.
  - 제안: 현재는 각 3~9줄짜리 짧은 함수라 추출 비용 대비 이득이 낮다. 세 번째 유사 술어가 생기면 그때 `hasAnyPrefix(value, prefixes)` 같은 공용 헬퍼로 묶는 것을 고려. 지금 단계에서 강제할 정도의 중복은 아님.

- **[INFO]** `path.posix.normalize` 는 백슬래시를 구분자로 인식하지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:98` (`isPendingPlanPath` 의 `path.posix.normalize(relPath)`)
  - 상세: `relPath` 는 spec frontmatter 작성자가 손으로 적는 문자열이라, 이론상 `plan\in-progress\foo.md` 처럼 백슬래시가 섞여 들어와도 `path.posix.normalize` 는 이를 정규화하지 않고 그대로 통과시킨 뒤 `.startsWith("plan/in-progress/")` 검사에서 false 로 떨어진다(즉 우회가 아니라 과탐지 방향이라 보안 결함은 아님). 저장소 관례상 모든 상대경로가 POSIX 슬래시라는 전제(파일 상단 주석 §103~106 "walkTree 는 항상 `/` 로 정규화") 와 일관되므로 실무 영향은 없다.
  - 제안: 현재 문서화된 전제 안에서는 문제 없음 — 별도 조치 불필요. 주석에 "POSIX 경로 전제" 를 한 줄 명시하면 다음 독자가 같은 의문을 반복하지 않는다.

## 요약

이번 변경의 핵심은 `spec-frontmatter-parse.ts` 에 순수 술어 `isPendingPlanPath(relPath)` 를 신설하고, 기존 `isApplicable` 과 동일한 스타일(모듈 최상단 상수 배열 + 짧은 가드 함수 + 배경 설명 주석)로 작성한 점이다. 함수는 4줄, 분기 3개로 짧고 순환 복잡도가 낮으며, 네이밍(`isPendingPlanPath`, `PENDING_PLAN_DIRS`)이 기존 `isApplicable`/`INCLUDE_PREFIXES` 컨벤션과 정확히 대응해 일관성이 높다. 주석은 "왜 이 술어가 필요한가"(사고 사례)와 "왜 정규화를 먼저 하는가"(`..` 우회 방지)를 함수 위에 명시해 다음 독자가 설계 의도를 재구성할 필요가 없다. 테스트(`spec-frontmatter-parse.test.ts`, `spec-pending-plan-existence.test.ts`)는 각 분기(허용 위치, 사고 재현 형태, research 배제, 비-md/디렉터리, `..` 탈출, spec 오기재)를 독립된 `it` 블록으로 나눠 가독성과 커버리지가 모두 좋다. plan 문서(`pending-plan-is-plan.md`)는 결함→처방→검증(뮤테이션 표 포함)→영향범위 순으로 구조화되어 있어 근거 추적이 쉽다. 매직 넘버·과도한 중첩·긴 함수 등 전형적 유지보수성 결함은 관찰되지 않았고, 지적한 두 건은 모두 실무 영향이 없는 INFO 수준이다.

## 위험도
NONE
