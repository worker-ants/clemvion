# 신규 식별자 충돌 검토 — naming_collision

검토 대상: `plan/in-progress/requiredwhen-dsl-whitelist.md`
검토 모드: plan draft (--plan)
검토 일시: 2026-05-19

---

### 발견사항

- **[INFO]** `matchesVisible` / `matchesRequired` — 기존 `matches()` 분리, 충돌 없음
  - target 신규 식별자: `matchesVisible(rule, config)`, `matchesRequired(rule, config)` (frontend `visibility.ts` 내부 함수)
  - 기존 사용처: 동일 파일의 `matches()` 함수 (main 브랜치 `visibility.ts:5`) 가 `Rule` 단일 타입으로 visibleWhen/requiredWhen 양쪽을 처리했음. 현재 worktree 에서는 이미 적용 완료.
  - 상세: 백엔드에 `matches(toolName: string): boolean` 메서드가 `IAgentToolProvider` 인터페이스(`agent-tool-provider.interface.ts:26`)에 존재하지만 도메인·모듈·타입이 완전히 다르며(AI 에이전트 도구 이름 매칭 용도), 프론트엔드 `visibility.ts` 와 namespace 가 분리된다. 명칭 충돌 없음.
  - 제안: 현재 `matchesVisible`/`matchesRequired` 는 file-private이므로 외부 참조 가능성 없음. 변경 필요 없음.

- **[INFO]** `VisibleRule` / `RequiredRule` 타입 별칭 — 충돌 없음
  - target 신규 식별자: `type VisibleRule`, `type RequiredRule` (frontend `visibility.ts` 내부)
  - 기존 사용처: main 브랜치의 `type Rule` (동일 파일 내부)가 존재했으나 이 Plan 에서 `VisibleRule`로 대체됨. 두 타입 모두 export 되지 않아 모듈 외부 충돌 없음.
  - 상세: 코드베이스 전체에서 `VisibleRule` / `RequiredRule` 명칭을 사용하는 다른 파일 없음. 충돌 없음.
  - 제안: 없음.

- **[INFO]** `equals: T | readonly T[]` 의미 확장 — visibleWhen 과 requiredWhen 간 의미 일관성
  - target 신규 식별자: `requiredWhen` 의 `equals` 속성 시그니처 `unknown | readonly unknown[]` (배열이면 화이트리스트)
  - 기존 사용처: `visibleWhen.equals` 는 `unknown` 단일값 (3-shape union 유지). `requiredWhen.equals` 는 이전 `unknown` 단일값에서 `unknown | readonly unknown[]` 로 확장.
  - 상세: 동일 `equals` 키가 두 DSL 에서 다른 시그니처를 가지게 된다. `visibleWhen.equals` 는 단일값 비교, `requiredWhen.equals` 는 단일값 또는 배열 화이트리스트. 기능적 혼동 가능성이 있으나 두 필드는 서로 다른 union arm 또는 별도 타입 별칭으로 구분되므로 TypeScript 컴파일러가 자동으로 타입 오류를 검출한다. 런타임에서도 `matchesVisible` / `matchesRequired` 로 처리 경로가 분리되어 있다.
  - 제안: `visibleWhen` 도 장기적으로 `equals` array 화이트리스트를 지원할 필요가 생길 수 있다. 현재는 `oneOf` 형태가 이를 담당하므로 기능 공백은 없다. 단, 추후 `visibleWhen` 도 `notEquals` / `oneOf` 를 정준화하려면 같은 접근을 적용하면 된다 (현 Plan 범위 밖).

- **[INFO]** `oneOf` 키워드 다중 의미 — DSL 속성명 vs Swagger/JSON Schema 예약어
  - target 신규 식별자: 폐기되는 `requiredWhen.oneOf` (제거 대상)
  - 기존 사용처: `ApiOkWrappedOneOfResponse` (backend Swagger 데코레이터), JSON Schema `oneOf` 키워드 (`types.ts:111` 주석), `zod v4` `oneOf`.
  - 상세: `requiredWhen` 의 `oneOf` 속성키는 완전히 다른 설정 DSL 내부의 속성명이며 Swagger `oneOf` 와는 namespace 가 분리된다. 제거(폐기) 방향이므로 충돌이 심화되지 않는다.
  - 제안: 없음.

- **[INFO]** `spec/4-nodes/1-logic/2-switch.md §8 Rationale` 신설 — 기존 섹션 번호 충돌 없음
  - target 신규 식별자: `## 8. Rationale` (switch.md 에 신규 추가)
  - 기존 사용처: main 브랜치의 `2-switch.md` 는 §1~§7 만 존재 (§8 없음). 같은 폴더 `0-common.md` 의 §8 은 "캔버스 요약", `3-loop.md` 의 §8 은 "Rationale" — 문서 내부 섹션 번호이므로 교차 참조 없으면 충돌 아님.
  - 상세: 파일 경로 충돌 없음. 섹션 번호는 문서별로 독립이므로 다른 spec 파일의 §8 과 충돌하지 않는다.
  - 제안: 없음.

---

### 요약

target plan 이 도입하는 신규 식별자(`matchesVisible`, `matchesRequired`, `VisibleRule`, `RequiredRule`, `requiredWhen` 단일 shape, `§8 Rationale` 섹션)는 코드베이스 및 spec 전체에서 충돌하는 기존 사용처가 없다. 백엔드 `IAgentToolProvider.matches()` 는 도메인이 완전히 달라 이름 유사성에도 불구하고 혼동 가능성이 없다. `oneOf` 키워드는 Swagger/JSON Schema 문맥과 DSL 속성명 문맥이 명확히 분리되며, 해당 속성 자체가 이 Plan 에서 제거되므로 충돌이 줄어드는 방향이다. `equals` 속성의 시그니처 확장(단일값 → 단일값|배열)은 `visibleWhen` 과 `requiredWhen` 간 미세한 의미 불일치를 낳지만 TypeScript 타입 시스템이 이를 자동 구분하며 런타임 처리 경로도 분리되어 있어 실질적 혼동 위험은 낮다. 전반적으로 이 Plan 은 식별자 충돌 관점에서 안전하다.

### 위험도

NONE
