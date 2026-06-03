# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 1: `statistics.ts` — 신규 i18n 키 5개 추가

- **[WARNING]** `periodCustom` / `customRangeStart` / `customRangeEnd` / `customRangeApply` — 아직 spec 이 "미구현 (Planned)"으로 기록한 기능에 대한 i18n 키 선행 추가
  - 위치: `codebase/frontend/src/lib/i18n/dict/ko/statistics.ts` lines 105~108
  - 상세: `spec/2-navigation/7-statistics.md §2.1` 은 커스텀 범위 UI 를 **"커스텀 범위는 미구현 (Planned)"** 으로 명시하고 있으며, `plan/in-progress/spec-sync-statistics-gaps.md` 미구현 항목 2번도 동일 내용을 추적 중이다. 현재 `statistics/page.tsx` 의 `PERIODS` 배열은 `["1d", "7d", "30d", "90d"]` 로 고정돼 있고, `periodCustom` / `customRange*` 키를 소비하는 코드가 전혀 없다. 키가 정의됐으나 실제 UI 와 연결되지 않은 "dead" i18n 항목.
  - 제안: 커스텀 범위 UI 구현이 완료된 시점에 키를 추가하거나, 현재 PR 에 해당 UI 구현도 함께 포함해야 한다. 단순 키 선행 추가는 spec 미구현 상태와 코드베이스 모두에 노이즈를 남긴다.

- **[WARNING]** `changeVsPrev: "직전 기간 대비"` — spec 이 "전 기간 대비 증감률은 미구현 (Planned)"으로 기록한 기능에 대한 i18n 키 선행 추가
  - 위치: `codebase/frontend/src/lib/i18n/dict/ko/statistics.ts` line 109
  - 상세: `spec/2-navigation/7-statistics.md §2.2` 는 Total Runs 카드의 전 기간 대비 증감률을 **"미구현 (Planned)"** 으로 기록한다. `plan/in-progress/spec-sync-statistics-gaps.md` 미구현 항목 1번도 동일. `dashboard.ts` 의 `changeVsPrev` 키와 별도 namespace 의 동명 키로 중복 가능성이 있으며, `statistics/page.tsx` 에는 이 키를 소비하는 코드가 없다.
  - 제안: 동일하게 실제 증감률 구현 시에 추가하거나, 현재 PR 에서 증감률 카드 구현도 함께 이뤄져야 한다.

- **[INFO]** 영어(`en/statistics.ts`) Dict 동기화 누락
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/statistics.ts` (변경 없음)
  - 상세: `en/statistics.ts` 는 `Dict["statistics"]` 타입에 바인딩된다. `ko/statistics.ts` 가 `as const` 로 ko 사전의 source-of-truth 역할을 하므로 `Dict` 타입이 자동으로 새 키를 요구한다. `en/statistics.ts` 에 5개 키(`periodCustom`, `customRangeStart`, `customRangeEnd`, `customRangeApply`, `changeVsPrev`)가 없으면 TypeScript 타입 에러가 발생한다.
  - 제안: `en/statistics.ts` 에 동일 키를 추가해야 한다(또는 빌드 에러 확인).

### 파일 2: `triggers.ts` — `addTrigger` 키 추가

- **[INFO]** `addTrigger: "트리거 추가"` 키 사용처 미확인
  - 위치: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` line 200
  - 상세: `spec/2-navigation/2-trigger-list.md` 에는 `addTrigger` i18n 키가 명시적으로 정의돼 있지 않다. 프론트 코드베이스 검색 결과 이 키를 소비하는 `.tsx` / `.ts` 파일이 발견되지 않았다. `addWebhook`, `addWebhookTrigger` 는 이미 존재하며, `addTrigger` 는 더 일반적인 레이블로 보인다.
  - 제안: 이 키가 어떤 UI 컴포넌트에서 사용될지 확인 필요. 소비처 없이 추가된 키라면 불필요하다. spec 에 명시적 i18n 요구사항이 없으므로 INFO 등급.

- **[INFO]** 영어(`en/triggers.ts`) Dict 동기화 누락
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` (변경 없음)
  - 상세: `en/triggers.ts` 에 `addTrigger` 키가 없으면 TypeScript 타입 에러 발생 가능.
  - 제안: `en/triggers.ts` 에 `addTrigger: "Add Trigger"` 추가 필요.

### 파일 3: `workflows.ts` — `resetFilters` 키 추가

- **[INFO]** `resetFilters: "필터 초기화"` 키 사용처 미확인
  - 위치: `codebase/frontend/src/lib/i18n/dict/ko/workflows.ts` line 521
  - 상세: `spec/2-navigation/` 워크플로 목록 spec 에 `resetFilters` i18n 키 요구사항이 명시돼 있지 않다. 프론트 코드베이스 내에서 이 키를 소비하는 파일이 발견되지 않았다.
  - 제안: `en/workflows.ts` 에도 동기화 필요. 소비처가 없다면 불필요한 선행 추가 가능.

- **[INFO]** 영어(`en/workflows.ts`) Dict 동기화 누락
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/workflows.ts` (변경 없음)
  - 상세: `resetFilters` 키가 `en/workflows.ts` 에 없으면 TypeScript 타입 에러 발생 가능.

### 파일 4 & 5: `evaluator.spec.ts` + `evaluator.ts` — `fallback` 필터 구현

- **[INFO]** `fallback:` 필터가 spec 에서 명시적으로 정의되지 않음 (spec 누락)
  - 위치: `codebase/packages/node-summary/src/evaluator.ts` lines 1223~1232
  - 상세: `spec/3-workflow-editor/0-canvas.md §5.3`, `spec/4-nodes/0-overview.md §1.4`, `spec/conventions/cross-node-warning-rules.md` 등 node-summary 패키지를 참조하는 spec 문서 어디에도 `fallback:` 필터의 정의(인자가 config path 로 resolve 된다는 점, `default:` 와의 차이)가 명시돼 있지 않다. `spec/4-nodes/2-flow/0-common.md §4` 는 `{workflowName 또는 workflowId}` 패턴을 약속하나 구현 방법(필터)을 특정하지 않는다. spec 자체의 결함이 의심됨 — `project-planner` 에 spec 보완 위임 권고.
  - 제안: spec 에 `summaryTemplate` 지원 필터 목록(`upper`, `lower`, `default:`, `fallback:`) 및 각 필터의 인자 해석 방식을 명시하는 섹션 추가 필요.

- **[INFO]** 기능 완전성 양호 — `fallback:` 구현 자체는 의도에 정확히 부합
  - 위치: `evaluator.ts` lines 1223~1232, `evaluator.spec.ts` lines 554~595
  - 상세: primary 값 존재 시 그대로 반환, `undefined`/`null`/`""` 일 때 config path 로 resolve, 양쪽 모두 없으면 `""` — 4개 케이스 모두 테스트로 커버됨. `default:` 와의 의도 차이를 구별하는 5번째 테스트도 포함.
  - 제안: 없음 (구현 품질 양호).

- **[INFO]** `fallback:` 에 `null`-arg 방어 없음 (엣지 케이스 — 낮은 위험)
  - 위치: `evaluator.ts` line 1213 `const arg = rawArg ?? '';`
  - 상세: `{{ field | fallback: }}` 처럼 arg 가 빈 문자열이면 `getPath(config, '')` 가 호출된다. `getPath` 는 빈 path 를 `split('.')` 하면 `['']` 배열을 만들고, config 에 `''` 키가 없으면 `undefined` 를 반환한다 — 결국 `""` 렌더링으로 안전하게 처리됨. 런타임 위험은 없으나 spec 문서와 테스트에는 이 케이스가 언급되지 않음.
  - 제안: 테스트에 `{{ field | fallback: }}` (arg 없음) 케이스 추가 권고 (선택).

---

## 요약

5개 변경 파일 중 핵심 기능 구현(`evaluator.ts` `fallback:` 필터)은 의도와 구현이 정확히 일치하며 테스트 커버리지도 충실하다. 그러나 i18n dict 3개 파일에서 공통적으로 두 가지 문제가 발견된다: (1) spec 이 "미구현(Planned)"으로 명시한 기능(`periodCustom`, `customRange*`, `changeVsPrev`)에 대한 i18n 키가 실제 UI 구현 없이 선행 추가됐고, (2) 영어 dict(`en/`)가 동기화되지 않아 TypeScript 타입 에러가 예상된다. `addTrigger` / `resetFilters` 는 소비처 코드가 없어 실사용 맥락 확인이 필요하다. `fallback:` 필터는 spec 에서 정의되지 않은 확장이므로 spec 보완이 필요하다 (`project-planner` 위임).

## 위험도

**MEDIUM** — 영어 dict 미동기화로 인한 TypeScript 빌드 에러 가능성, spec Planned 기능의 i18n 선행 추가로 인한 코드베이스 혼재. 런타임 기능 오작동 위험은 낮음.
