# 유지보수성(Maintainability) 리뷰 — plan-frontmatter.test.ts

## 발견사항

- **[INFO]** 매직 넘버 `5` 가 세 곳에서 반복
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:78`, `:164`, `:176` (`expect(...).toBeGreaterThan(5)`)
  - 상세: "discovery 가 살아있는가만 확인하는 하한" 이라는 동일한 의도를 세 곳에서 각각 별도 주석으로 설명하며 리터럴 `5` 를 반복한다. 의도는 잘 문서화돼 있어 오독 위험은 낮지만, 정책(하한값)이 바뀌면 세 곳을 모두 찾아 고쳐야 한다.
  - 제안: `const MIN_PLAUSIBLE_PLAN_COUNT = 5;` 같은 이름 있는 상수로 추출해 의도를 한 곳에 모으고 재사용.

- **[INFO]** 파일명과 실제 스코프 불일치 가능성
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 파일 전체 — 특히 두 번째 top-level `describe("completed plans declare a terminal status", ...)` 블록 (라인 169~193)
  - 상세: 파일명 `plan-frontmatter.test.ts` 는 frontmatter 필드(worktree/started/owner) 검증을 시사하지만, 이 블록은 `plan/complete/**` 문서의 `status` 값이 디렉터리와 모순되지 않는지를 검사하는 별개 관심사(라이프사이클 정합성)다. 파일 상단 주석(라인 33~50)이 "이동이 남기는 두 갭을 함께 막는다"는 의도를 잘 설명해 두어 당장 혼란은 낮지만, 파일명만 보고 진입하는 독자에게는 두 번째 describe 의 존재가 예상 밖일 수 있다.
  - 제안: 현 상태 유지도 무방하나(주석이 이미 근거를 제공), 향후 검사가 더 늘어난다면 `plan-lifecycle.test.ts` 등 더 포괄적인 파일명으로 분리하는 것을 고려.

- **[INFO]** 동일 rationale 주석의 근접 중복
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:75-77` 과 `:173-175`
  - 상세: "하한을 낮게 잡는 이유(실제 개수에 가깝게 잡으면 grooming 으로 깨진다)" 를 두 describe 블록에서 거의 같은 문구로 반복 설명한다. 로직 중복은 아니고 주석 중복이라 실질 위험은 없다.
  - 제안: 선택 사항 — 두 하한 검사 공통 rationale 을 파일 상단 주석 한 곳으로 모으고 각 지점에서는 짧게 참조만 남기면 향후 정책 변경 시 갱신 지점이 하나로 줄어든다.

## 요약

리뷰 대상은 plan 라이프사이티 가드 테스트(`plan-frontmatter.test.ts`) 한 개 파일이다. 함수 길이·중첩 깊이·순환 복잡도는 모두 낮고, 스캔 로직은 `plan-scan.ts` 의 단일 구현(`collectLivePlanMarkdown`/`collectCompletePlanMarkdown`/`findNonTerminalCompletedPlans`)에 위임해 실질적인 중복이 없다. `path.relative(...).split(path.sep).join("/")` 로 상대경로를 재계산하는 패턴이나 `describe(rel, ...)` 로 파일별 동적 describe 를 만드는 구조는 같은 디렉터리의 자매 테스트(`spec-plan-completion.test.ts`)와 동일해 코드베이스 컨벤션과 일관적이다. 테스트마다 "왜 이 하한/이 스코프인가" 를 설명하는 방대한 주석이 붙어 있는데, 이는 이 프로젝트의 확립된 하우스 스타일(과거 실패를 기록해 재발을 막는 방식)과 일치하므로 결함으로 보지 않았다. 남은 지적은 매직 넘버 추출, 파일 스코프-이름 정합, 주석 중복 정리 정도의 사소한 개선 여지뿐이며 모두 INFO 수준이다.

## 위험도
LOW
