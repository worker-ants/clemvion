# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** 모듈 경계 서술이 같은 커밋이 만든 변경으로 stale 해졌다 — "네 벌 중 둘만 합쳤다"는 스코프 안내가 더 이상 사실이 아니다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:18-22`
  - 상세: 이 헤더 주석은 "Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는 **아직 독립 구현으로 남아 있고**(...) 그 통합은 `plan/in-progress/docs-guard-walker-dedup.md` 에 등재했다" 라고 적고 있다. 그런데 같은 리뷰 대상인 `spec-plan-completion.test.ts:62-64` 를 보면 `collectCompletePlans` 는 이미 `collectCompletePlanMarkdown` 을 3줄로 위임하는 형태로 바뀌어 있다(즉 더 이상 독립 구현이 아니다). `git show <이 브랜치의 최신 커밋>` 으로 확인한 결과, 바로 이 커밋이 그 위임 전환을 수행했다 — 즉 헤더 주석이 서술하는 "아직 안 끝난 통합"은 **같은 커밋 안에서 이미 끝난 상태**다. 이 주석의 존재 목적 자체가 "네 벌을 하나로 합쳤다로 읽히지 않도록 범위를 명시한다"는 것이므로, 정확히 그 목적에서 어긋난 정보를 제공하고 있다는 점이 아이러니하다. 참고로 이 상태를 추적하는 `plan/in-progress/docs-guard-walker-dedup.md` 자체도 내부적으로 모순된 두 절을 갖고 있다 — §"함께 볼 것 — Gate C 의 4번째 walker"(아직 미착수로 서술)와 §"2026-08-10 추가"(같은 PR 에서 이미 해소했다고 서술)가 공존한다.
  - 제안: `plan-scan.ts` 헤더의 "아직 독립 구현으로 남아 있고... 등재했다" 문구를 "이 PR 에서 `collectCompletePlanMarkdown` 위임으로 전환해 통합했다"로 갱신한다. `docs-guard-walker-dedup.md` 의 §"함께 볼 것 — Gate C 의 4번째 walker" 절(체크박스 포함)도 완료로 갱신하거나 삭제해 두 절의 모순을 해소한다. (참고: `MEMORY.md` 의 "plan 서술은 철회로 거짓이 될 수 있다 + 체크리스트 두 군데" 교훈과 동일한 패턴.)

- **[INFO]** `plan-scan.ts` 한 파일이 네 가지 결이 다른 책임(디렉터리 순회 / frontmatter 파싱 인프라 / 종료-status 판정 / 필수 필드 검증)을 겸하고 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` (전체) — `walkPlanMarkdown`(59-86), `parseFrontmatterSafe`(121-128), `findNonTerminalCompletedPlans`(157-170), `checkPlanFrontmatter`(248-291)
  - 상세: "plan 트리 스캔 + 라이프사이클 불변식"이라는 상위 주제로는 응집돼 있지만, 순회 알고리즘·파서 캐시 우회 관용구·비즈니스 규칙(종료 상태 집합)·필드 검증 규칙이 한 모듈에 누적되고 있다. 현재 300줄 규모에서는 무리 없으나, `checkPlanFrontmatter` 계열 규칙이 더 늘어나면 SRP 경계를 넘어설 소지가 있다.
  - 제안: 지금 분리를 요구할 정도는 아니다. 다만 향후 필드 검증 규칙이 추가될 때는 `plan-walk.ts` / `plan-frontmatter-rules.ts` 등으로 쪼개는 것을 고려한다.

- **[INFO]** `findNonTerminalCompletedPlans` 는 판정 로직이 함수 내부에 인라인돼 있어 `checkPlanFrontmatter` 와 달리 순수 fixture 로 직접 겨눌 수 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:157-170`
  - 상세: `checkPlanFrontmatter(raw, relPath)` 는 원문 문자열을 받는 순수 함수로 설계돼 파일시스템 없이 각 분기를 fixture 로 직접 겨눌 수 있다(파일 자체 주석이 이 설계 의도를 명시). 반면 `findNonTerminalCompletedPlans(root)` 는 FS 순회·읽기·상태 판정이 한 함수에 섞여 있어, 이 함수의 판정 로직(`TERMINAL_PLAN_STATUSES.has(status)`)만 단위 테스트하려면 `plan-scan.test.ts` 처럼 `mkdtempSync` 로 실제 디렉터리를 만들어야 한다. 같은 파일 안에서 테스트 용이성 설계 수준이 일관되지 않는다.
  - 제안: `isTerminalStatus(status: string): boolean` 류의 순수 predicate 를 분리하면 다른 검사들과 추상화 수준이 맞춰지고 fixture 없는 단위 테스트가 가능해진다. 우선순위는 낮음(현재도 `plan-scan.test.ts` 가 FS fixture 로 커버하고 있어 검증 공백은 없음).

## 요약

두 파일은 이전에 네 벌로 흩어져 있던 plan 트리 walker/frontmatter 파싱 관용구를 `plan-scan.ts` 라는 단일 모듈로 수렴시키는 리팩터로, 단일 진입점(`parseFrontmatterSafe`) 도입과 `walkPlanMarkdown` 파라미터화(bucket/recurse)로 SRP·DRY·확장성 측면에서 실질적인 개선이다. 순환 의존성은 없고(`spec-links.ts`/`spec-plan-completion.test.ts` → `plan-scan.ts` 단방향), `__tests__/` 아래 비-테스트 모듈을 두는 배치도 `spec-links.ts` 등 기존 관례와 일치해 새로운 경계 위반은 아니다. 다만 `plan-scan.ts` 헤더 주석이 "이 PR 이 통합한 범위"를 스스로 서술하려다, 정작 같은 커밋에서 완료한 `collectCompletePlans` 위임 전환을 반영하지 못해 stale 해졌다 — 모듈 경계 문서가 코드보다 뒤처진 상태이며, 이를 추적하는 `plan/in-progress/docs-guard-walker-dedup.md` 도 내부적으로 모순된 두 절을 갖고 있다. 이는 기능 결함이 아니라 문서-코드 정합성 문제이지만, 이 파일이 명시적으로 막으려던 바로 그 실패 모드(스코프 오독)를 재현하고 있어 병합 전 정정을 권한다.

## 위험도
LOW
