# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `localeCompare` 기반 정렬로 전환 — 로케일 의존적 순서
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:84` (`walkPlanMarkdown` 내 `out.sort((a, b) => a.relPath.localeCompare(b.relPath))`)
  - 상세: 종전 `spec-plan-completion.test.ts` 의 손수 DFS 는 `out.sort()` (절대경로 문자열 기본 정렬, locale-무관 UTF-16 코드유닛 비교) 를 썼다. 새 `walkPlanMarkdown` 은 `relPath` 를 `localeCompare` 로 비교한다. `localeCompare` 는 Node 실행 환경의 로케일/ICU 데이터에 영향을 받을 수 있어, 동일 입력이라도 환경별로 순회·`describe()` 등록 순서가 달라질 여지가 있다. 판정 결과(불리언 pass/fail)에는 영향이 없고 테스트 리포트 순서에만 영향을 주는 수준으로 심각도는 낮다.
  - 제안: 순서에 의미를 두지 않는다면 문제 없음. 순서 안정성이 필요하면 `localeCompare` 대신 단순 문자열 `<`/`>` 비교로 고정하는 편이 결정적이다.

- **[INFO]** gray-matter 캐시-우회 관용구 중앙화 — 위험 감소(부작용 아님, 참고용)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:121-128` (`parseFrontmatterSafe`)
  - 상세: 기존에 `findNonTerminalCompletedPlans`, `checkPlanFrontmatter`, `spec-plan-completion.test.ts` 의 두 지점(총 4곳)에 `matter(raw, {})` 패턴이 손으로 복제돼 있었다. 이번 변경으로 단일 함수로 합쳐졌고, 두 파일 모두 동일 헬퍼를 통해 캐시-우회 옵션(`{}`)을 일관되게 적용한다. 이는 새 부작용이 아니라 "다섯 번째 호출부가 `{}` 를 빠뜨려 gray-matter 프로세스-전역 캐시 오염이 조용히 재발"하는 기존 위험을 줄이는 방향의 리팩터다. 다만 `spec-frontmatter-parse.ts:113` 의 `matter(raw)` (옵션 없음) 는 이번 변경 범위 밖이라 그대로 남아 있다 — 별도 파일·별도 용도라 이번 diff 의 회귀는 아니다.
  - 제안: 조치 불요. 참고로만 기록.

- **[INFO]** `plan-scan.ts` 공개 표면 확장 — 순수 추가(additive)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:98-128` (`ParsedFrontmatter` interface, `parseFrontmatterSafe` export)
  - 상세: 새 export 2개(`ParsedFrontmatter`, `parseFrontmatterSafe`)가 추가됐다. 기존 export(`collectLivePlanMarkdown`, `collectCompletePlanMarkdown`, `checkPlanFrontmatter`, `findNonTerminalCompletedPlans`, `findFrontmatterViolations`, `TERMINAL_PLAN_STATUSES`, `WORKTREE_SENTINEL` 등) 의 시그니처·동작은 변경되지 않았다. 저장소 내 기존 소비처(`plan-frontmatter.test.ts`, `spec-links.ts`, `plan-scan.test.ts`) 는 이번 변경으로 영향받는 심볼을 import 하지 않는다(grep 확인). `plan-scan.ts` 밖(비-`__tests__` 코드)의 소비처는 아직 없다 — 헤더 주석의 "테스트 밖에서 부를 수 있는" 은 현재 실현되지 않은 전제이나 이번 diff 의 부작용은 아니다.
  - 제안: 조치 불요.

## 요약

두 파일 모두 파일시스템 **읽기 전용**(`fs.existsSync`/`readdirSync`/`readFileSync`) 순수 함수로 구성되며, 쓰기·삭제·네트워크 호출·환경 변수 접근·이벤트/콜백 발생이 없다. 핵심 변경은 두 파일(`plan-scan.ts`, `spec-plan-completion.test.ts`)에 손으로 4곳 복제돼 있던 "plan 트리 DFS 수집" 과 "gray-matter 캐시-우회 파싱" 로직을 `plan-scan.ts` 의 단일 구현(`walkPlanMarkdown`/`collectCompletePlanMarkdown`, `parseFrontmatterSafe`)으로 합친 리팩터다. 기존 공개 함수의 시그니처·리턴 타입은 그대로이고 새 export 는 추가일 뿐이라 기존 호출자에 영향이 없으며, 오히려 캐시-우회 관용구 중복이 사라져 "누락 시 조용히 재발" 하던 기존 위험을 줄인다. 유일하게 관찰된 미세한 동작 차이는 정렬 비교자가 절대경로 기본 문자열 정렬에서 `relPath.localeCompare` 로 바뀐 점인데, 판정 결과(pass/fail)에는 영향이 없고 테스트 순서에만 잠재적 영향을 준다.

## 위험도

LOW
