# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `TERMINAL_STATUSES` 가 `ReadonlySet<string>` 으로 **타입만** 선언되고 런타임에는 일반 `Set` 인스턴스라 실제로 보호되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:93` (`export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([...])`)
  - 상세: `ReadonlySet<string>` 은 컴파일 타임 뷰일 뿐이며, 이 값은 module-scope 에서 한 번 생성돼 그 프로세스의 모든 import 자가 **같은 인스턴스**를 공유한다. `(TERMINAL_STATUSES as Set<string>).add(...)` 같은 타입 단언이나 `as any` 캐스트로 우회하면 다른 테스트 파일(`plan-frontmatter.test.ts` 등, 같은 vitest 워커 프로세스에서 병렬 실행될 수 있음)의 판정에 영향을 줄 수 있다. 현재 코드베이스에는 그런 우회가 없어 실질 위험은 낮다.
  - 제안: 정말 불변이 필요하면 `Object.freeze(new Set([...]))` 로 런타임에도 강제하거나(단 `Set.freeze` 는 add/delete 를 막지 못하므로 실효는 제한적), 현재처럼 타입 레벨 보호로 충분하다는 판단이면 그대로 두어도 무방 — 굳이 조치가 필요한 수준은 아니다.

- **[INFO]** (확인 완료, 조치 불필요) `plan-scan.ts` 로의 로직 추출이 기존 호출부 시그니처를 깨지 않았는지 교차 검증함
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17,289` — `collectLivePlanMarkdown` 을 `plan-scan.ts` 에서 import 해 re-export
  - 상세: 이전 `spec-links.ts` 의 `collectLivePlanMarkdown` 반환 타입은 `SpecMdFile[]`(`{absPath, relPath}`), 새 구현은 `plan-scan.ts` 의 `PlanMdFile[]`(동일 shape) — 구조적으로 동일해 `findBrokenLinksInFiles(files: SpecMdFile[], ...)` 호출부에 타입 충돌이 없다. `plan-frontmatter.test.ts`, `spec-links.test.ts` 등 실제 호출부 전수를 grep 해 확인한 결과 모두 새 `plan-scan.ts` import 로 일관되게 재배선되어 있고, 옛 인라인 구현(`collectCompletedPlans`, 로컬 `TERMINAL_STATUSES`)에 대한 dangling 참조는 없다. 부작용 관점에서 문제 없음.

- **[INFO]** `plan-scan.test.ts` 의 fixture 는 실제 파일시스템(`os.tmpdir()`)에 쓰기를 수행하지만 격리·정리가 적절함
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:32-35`(`beforeAll`/`mkdtempSync`), `:64-66`(`afterAll`/`rmSync`), `:174-180`(두 번째 임시 디렉터리, `try/finally` 로 정리)
  - 상세: 저장소 실제 `plan/` 트리는 건드리지 않고 `fs.mkdtempSync` 로 격리된 임시 디렉터리에만 쓴다. 정리는 `afterAll`/`finally` 로 보장되어 정상 종료·assertion 실패 양쪽에서 leak 위험이 낮다. `beforeAll` 자체가 도중에 throw 하는 극단적 케이스(예: 디스크 풀)에서 vitest 가 `afterAll` 을 여전히 호출하는지는 프레임워크 시맨틱에 의존하지만, 이는 이 변경이 새로 도입한 위험이 아니라 저장소의 다른 테스트에도 공통되는 기존 패턴이다.

- **[NONE]** `plan-scan.ts` 프로덕션 모듈 자체는 순수 읽기 전용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 전체 (`walkPlanMarkdown`, `findNonTerminalCompletedPlans`)
  - 상세: `fs.existsSync` / `fs.readdirSync` / `fs.readFileSync` 만 사용하며 쓰기·삭제·환경변수·네트워크 호출이 전혀 없다. 파일 상단 주석대로 "테스트 밖에서 부를 수 있는" 함수들이지만, 어떤 호출 경로에서 실행되더라도 파일시스템에 부작용을 남기지 않는다.

## 요약

이번 변경은 `plan-frontmatter.test.ts`/`spec-links.ts` 에 흩어져 있던 plan 트리 순회·status 판정 로직을 `plan-scan.ts` 로 추출하고, `plan-scan.test.ts` 로 합성 fixture 기반 negative-path 테스트를 신설한 리팩터링이다. 프로덕션(스캔) 코드는 읽기 전용이라 부작용이 없고, 테스트 코드의 파일 쓰기는 격리된 임시 디렉터리에 한정되며 정리 로직도 갖춰져 있다. 추출로 인한 호출부 재배선은 `spec-links.ts` re-export 포함 전수 grep 으로 대조했으며 시그니처·타입 shape 이 구조적으로 동일해 기존 호출자에 영향이 없다. 전역 상태로 볼 만한 것은 `TERMINAL_STATUSES` module-scope 상수뿐이며 런타임 비-freeze 라는 경미한 지적 외에는 실질적 위험이 없다.

## 위험도
NONE
