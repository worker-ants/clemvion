# Testing Review

## 발견사항

### **[CRITICAL]** KO 사전 신규 키가 EN 사전에 누락 — `dict parity` 테스트 실패 예상
- 위치: `codebase/frontend/src/lib/i18n/dict/en/statistics.ts`, `dict/en/triggers.ts`, `dict/en/workflows.ts`
- 상세: KO 사전에 추가된 5개 키(`periodCustom`, `customRangeStart`, `customRangeEnd`, `customRangeApply`, `changeVsPrev`), 1개 키(`addTrigger`), 1개 키(`resetFilters`)가 EN 대응 파일에 전혀 없다. `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts`의 `dict parity (ko ↔ en)` describe 블록이 `koOnly` 배열에 이 키들을 열거하며 **빌드 단계에서 실패한다**. 특히 EN `statistics.ts`는 마지막 키가 `colErrorRate`로 끝나 5개 모두 누락이 확실하다.
- 제안: EN 사전 3개 파일에 대응 번역을 추가한 뒤 커밋. 각각 `"Custom"`, `"Start date"`, `"End date"`, `"Apply"`, `"vs. previous period"` / `"Add trigger"` / `"Reset filters"` 형식.

### **[WARNING]** `fallback` 필터 — 연쇄 필터(chained filter) 테스트 누락
- 위치: `codebase/packages/node-summary/src/__tests__/evaluator.spec.ts` — `fallback:` describe 블록
- 상세: `{{ workflowName | fallback:workflowId | upper }}` 처럼 `fallback` 뒤에 추가 필터가 체인된 경우를 검증하는 케이스가 없다. `applyFilter`는 `value`와 `config` 모두를 전달하므로 체인 자체는 동작하나, fallback 분기에서 `getPath`가 반환한 값이 다음 `upper`/`lower` 필터에 올바르게 전달되는지는 검증되지 않는다.
- 제안: `renderTemplate('{{ workflowName | fallback:workflowId | upper }}', { workflowId: 'wf-1' })` → `'WF-1'` 케이스를 추가.

### **[WARNING]** `fallback` 필터 — dot-path 인수 해석 테스트 누락
- 위치: `codebase/packages/node-summary/src/__tests__/evaluator.spec.ts` — `fallback:` describe 블록
- 상세: `getPath`는 점 경로(`nested.id`)를 지원하지만 `fallback:nested.id`처럼 중첩 경로를 인수로 받는 경우의 테스트가 없다. 구현은 정상 동작하나 커버리지 공백이다.
- 제안: `renderTemplate('{{ name | fallback:meta.id }}', { meta: { id: 'x' } })` 케이스 추가.

### **[WARNING]** `fallback` 필터 — `fallback` 인수 자체가 빈 문자열일 때 동작 미검증
- 위치: `codebase/packages/node-summary/src/__tests__/evaluator.spec.ts`
- 상세: `rawArg`가 없어 `arg = ''`인 상태에서 `getPath(config, '')` 호출 결과가 테스트에 없다. `getPath`는 빈 문자열 경로를 `split('.')` → `['']`로 처리하고, `config['']`는 `undefined`를 반환한다. 이 경우 빈 문자열이 렌더되는지 확인이 필요.
- 제안: `renderTemplate('{{ name | fallback: }}', {})` → `''` 또는 동일한 빈 결과를 검증하는 케이스 추가 (엣지케이스 문서화 목적).

### **[INFO]** i18n 사전 변경 전용 테스트는 별도로 존재하지 않지만 기존 parity 가드가 역할을 대리함
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts`
- 상세: 현재 KO-only 키 추가 시 `dict parity` 테스트가 자동으로 실패하는 구조다. 이는 의도된 설계이며 테스트 격리·가독성 면에서 적절하다. 다만 CRITICAL 항목과 같이 이 리뷰 대상 변경이 EN 업데이트 없이 커밋되면 테스트가 그 즉시 빨간불을 낸다.

### **[INFO]** `evaluator.spec.ts` 신규 `fallback` describe 블록 — 테스트 구조 및 가독성 양호
- 위치: `codebase/packages/node-summary/src/__tests__/evaluator.spec.ts` lines 553-594
- 상세: 각 케이스가 단일 assertion, 명확한 의도(`uses the primary value when present`, `falls back when primary is missing entirely` 등)로 분리되어 있다. `default:`와 `fallback:`의 의미적 차이를 별도 케이스로 명시한 점은 회귀 방지 측면에서 우수한 패턴이다.

### **[INFO]** `applyFilter` 함수 서명 변경 — 내부 함수이므로 Mock 영향 없음
- 위치: `codebase/packages/node-summary/src/evaluator.ts` line 884
- 상세: `applyFilter`는 비공개(non-export) 함수이므로 외부 테스트가 직접 mock하는 경우가 없다. `renderTemplate` 공개 함수를 통한 블랙박스 테스트가 전부이며, 이는 올바른 설계다. 시그니처 변경이 기존 테스트를 깨지 않는다.

---

## 요약

핵심 테스트 위험은 **i18n 사전 parity 위반**이다. KO 사전 3개 파일에 총 7개 키가 추가됐으나 EN 대응 파일에 전혀 반영되지 않아, 이미 존재하는 `dict parity (ko ↔ en)` 테스트가 CI에서 즉시 실패할 것이다. `evaluator.ts`의 `fallback` 필터 구현에 대한 신규 테스트는 핵심 케이스(primary 있음·없음·양쪽 없음·`default:` 비교)를 잘 커버하며 가독성과 격리성도 양호하다. 다만 체인 필터, dot-path 인수, 빈 인수 엣지케이스가 커버리지 공백으로 남아 있다.

## 위험도

**HIGH** — EN 사전 누락으로 기존 parity 테스트 실패가 확실하며, 그 상태로 병합되면 영문 사용자에게 KO fallback 또는 raw key가 노출된다.

STATUS: SUCCESS
