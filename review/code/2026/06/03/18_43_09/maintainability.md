# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `codebase/frontend/src/lib/i18n/dict/ko/statistics.ts`

- **[INFO]** 추가된 키 5개 (periodCustom, customRangeStart, customRangeEnd, customRangeApply, changeVsPrev) 모두 일관된 camelCase 네이밍 패턴을 따르며 의미가 명확하다.
  - 위치: 파일 끝 추가 블록 (lines 35–39 in diff)
  - 상세: 기존 `period7d`, `period30d` 등의 접두어 패턴과 일관성이 있으며, 새 키 `periodCustom`도 이를 따른다.
  - 제안: 특이사항 없음. 기존 파일에 `averageDuration`과 `avgDuration`이 동일 의미로 두 곳 존재하는 중복이 있으나 이번 변경과 무관하다.

---

### 파일 2: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`

- **[WARNING]** `addWebhook`과 `addTrigger`, `addWebhookTrigger` 세 키가 의미가 겹쳐 구분이 불명확하다.
  - 위치: lines 198–200 (`addWebhook`, `addTrigger`, `addWebhookTrigger` 인접)
  - 상세: `addWebhook`("웹훅 추가"), `addTrigger`("트리거 추가"), `addWebhookTrigger`("웹훅 트리거 추가") 세 키가 공존하며, 어느 컴포넌트가 어느 키를 써야 하는지 파일만 보고는 판단하기 어렵다. 이름 중복에 의한 혼동이 발생할 수 있다.
  - 제안: 세 키 각각의 사용처를 주석으로 명시하거나, 미사용 키를 제거해 관리 부담을 낮춘다.

- **[INFO]** 파일 전체에 flat 키와 중첩 객체(`rowActions`, `history`, `delete`, `detail`, `externalInteraction`, `chatChannel`)가 혼재한다. 이번 추가(`addTrigger`)는 기존 flat 레이어에 놓이므로 구조 일관성은 유지된다.

---

### 파일 3: `codebase/frontend/src/lib/i18n/dict/ko/workflows.ts`

- **[INFO]** `resetFilters` 키 단 하나의 추가이며 camelCase, 한국어 값("필터 초기화") 모두 기존 컨벤션에 부합한다.
  - 위치: `adjustFiltersHint` 뒤 (line 441 in diff)
  - 제안: 특이사항 없음.

---

### 파일 4: `codebase/packages/node-summary/src/__tests__/evaluator.spec.ts`

- **[INFO]** 새 `describe('fallback: filter …')` 블록의 테스트 케이스는 각 경계 조건(primary 존재, 빈 문자열, 완전 누락, 양쪽 누락, `default:`와의 차이)을 명확히 분리하여 의도를 이해하기 쉽다.
  - 위치: lines 553–594 in diff

- **[INFO]** `'differs from default: which would emit the literal path name'` 케이스는 `default:` vs `fallback:` 동작 차이를 명시적으로 검증하는 guard 테스트이다. 설명적 이름과 주석이 유지보수성을 높인다.
  - 위치: lines 586–593 in diff
  - 제안: 특이사항 없음.

---

### 파일 5: `codebase/packages/node-summary/src/evaluator.ts`

- **[INFO]** `applyFilter` 시그니처에 `config: NodeConfig` 파라미터를 추가하고 `fallback:` 케이스를 `switch`에 삽입하는 변경은 기존 `case` 패턴과 완전히 일관된다.
  - 위치: `applyFilter` 함수 (lines 285, 294–908 in diff)

- **[INFO]** `case 'default':` 블록에 `// \`arg\` is a literal …` 주석이 추가되어, `fallback:`과의 의미 차이를 인라인에서 명확히 설명한다. 이후 유지보수자가 두 케이스의 차이를 파악하는 데 도움이 된다.

- **[INFO]** `fallback:` 케이스 내 빈값 판단 조건(`value === undefined || value === null || value === ''`)이 `default:` 케이스와 완전히 동일한 표현을 사용한다. 두 케이스가 빈값 정의를 독립적으로 복제하고 있어, 이후 빈값 기준 변경 시 두 곳을 동시에 수정해야 하는 잠재적 유지보수 부담이 생긴다.
  - 위치: `applyFilter` 내 `case 'default':` 및 `case 'fallback':` (lines 892–905 in diff)
  - 상세: 현재는 두 케이스뿐이어서 위험도는 낮지만, 필터 종류가 늘어나면 빈값 판단 로직의 분산이 커진다.
  - 제안: `const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === '';` 같은 내부 헬퍼를 추출하면 단일 정의로 통일 가능하다.

---

## 요약

i18n 사전 파일 3개(statistics, triggers, workflows)는 소규모 키 추가로 기존 컨벤션을 잘 따르며 유지보수성 위험이 낮다. `triggers.ts`의 `addWebhook` / `addTrigger` / `addWebhookTrigger` 유사 키 공존은 사용처 불명확으로 인한 혼동 가능성이 있어 주석 보완이 권장된다. `evaluator.ts`의 핵심 변경(`fallback:` 필터 추가)은 기존 `switch` 패턴에 자연스럽게 통합되었고 주석 품질도 양호하나, `case 'default':`와 `case 'fallback':`이 빈값 판단 조건을 중복 표현하는 경미한 DRY 위반이 있다. 전체적으로 변경 범위 대비 유지보수성 리스크는 낮다.

## 위험도

LOW
