# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[INFO]** 개방-폐쇄 원칙(OCP) 준수 — 마이그레이션 방향이 정석
  - 위치: `override-registry.ts` 전체 + `index.tsx`
  - 상세: `NodeConfigRenderer`는 레지스트리 조회 → 없으면 `SchemaForm` 폴백이라는 단일 선택 축을 일관되게 유지한다. 새 노드 타입을 추가하거나 override를 제거할 때 `NodeConfigRenderer` 자체는 수정할 필요가 없다. 이번 변경은 두 항목을 레지스트리에서 제거하는 것만으로 auto-form 경로로 전환하며, 기존 구조에 어떠한 분기도 추가하지 않는다.
  - 제안: 현행 유지.

- **[INFO]** 단일 책임 원칙(SRP) — 삭제된 `ai-configs.tsx`의 책임 분리 평가
  - 위치: (삭제된) `ai-configs.tsx`
  - 상세: 삭제된 파일은 `TextClassifierConfig`·`InformationExtractorConfig` 두 컴포넌트를 하나의 파일에 공동 배치했다. 각 컴포넌트는 해당 노드의 렌더 로직만 담당했으나, 카테고리/필드 추가·삭제·수정 로직을 컴포넌트 내부에 직접 정의하고 있었다(핸들러 함수 내재화). 삭제 자체는 해당 책임을 schema-driven 레이어(백엔드 zod schema + `SchemaForm`)로 위임함으로써 프론트엔드 책임을 적절히 줄인다.
  - 제안: 현행 유지.

- **[INFO]** 레이어 책임 분리 개선
  - 위치: `ai-configs.tsx` (삭제됨), `SchemaForm` + `widget-registry.ts`
  - 상세: 삭제 이전에는 필드 목록·레이블·위젯 종류가 프레젠테이션 레이어(TSX)에 하드코딩되어, 백엔드 스키마 변경이 프론트 파일 변경도 요구했다. 이번 변경 이후 해당 정보는 백엔드 zod 스키마의 `ui` 힌트로 일원화되며 `SchemaForm`이 메타데이터를 소비하는 데이터 계층 → 프레젠테이션 계층 흐름이 명확해진다.
  - 제안: 현행 유지.

- **[INFO]** 순환 의존성 — `widget-resolver.ts` 패턴이 올바름
  - 위치: `widget-registry.ts` → `widgets.tsx` ↔ `widget-resolver.ts`
  - 상세: `FieldArrayWidget`(내부에서 중첩 위젯을 동적으로 조회)와 `widget-registry.ts`(모든 위젯을 등록) 사이의 잠재적 순환을 `widget-resolver.ts`의 지연 레지스트리 패턴으로 끊고 있다. 이번 변경은 이 의존성 구조를 변경하지 않는다.
  - 제안: 현행 유지.

- **[INFO]** 확장성 — 레지스트리 주석이 마이그레이션 전략을 명시
  - 위치: `override-registry.ts` JSDoc 주석 및 인라인 주석
  - 상세: "When the underlying zod schema + widget registry becomes expressive enough for a given node, remove its entry from this map and the auto-form will take over."라는 설명이 마이그레이션 경로를 코드 수준에서 문서화한다. 이번 V-02 수정이 동일 패턴의 반복 적용임을 주석이 보강한다.
  - 제안: 현행 유지.

- **[WARNING]** 문자열 리터럴 분산 — 노드 타입 식별자가 다수 모듈에 하드코딩됨
  - 위치: `node-config-summary.ts:36-38`, `workflow-canvas.tsx:109`, `use-expression-context.ts:177,242`, `apply-execution-snapshot.ts:425`, `result-detail.tsx:160-161`, `result-timeline.tsx:87`
  - 상세: `"text_classifier"`, `"information_extractor"`, `"ai_agent"` 문자열 리터럴이 6개 이상의 파일에 중복 분산되어 있다. 이번 변경과 직접 충돌하지는 않지만, 향후 AI 노드 타입이 변경되거나 추가될 경우 누락 갱신 위험이 존재한다. `LLM_PROVIDER_NODES` (`node-config-summary.ts`)처럼 Set으로 중앙화한 패턴이 이미 일부 존재하나 전체 사용처로 통일되어 있지 않다.
  - 제안: `@/lib/node-definitions/ai-node-types.ts` 같은 단일 상수 모듈에 AI 노드 타입 식별자를 열거하고, 현재 분산된 하드코딩 문자열을 해당 상수로 교체하는 점진적 리팩터링을 백로그에 등록할 것을 권장한다. 이번 PR 범위 내 강제 사항은 아님.

- **[INFO]** 추상화 수준 — `SchemaForm`의 `groupEntries` 방어 코드
  - 위치: `schema-form.tsx:57-94` (`groupEntries` 함수 주석)
  - 상세: 동일한 그룹 이름을 가진 비연속 필드를 병합하는 방어 로직이 존재하며, 이것이 백엔드 `order` 충돌로 인한 런타임 React key 경고를 예방한다. 이 복잡성은 현재 `group` 메타데이터가 백엔드에서 자유 문자열로 지정된다는 데서 비롯된다. 이번 AI 노드 마이그레이션이 이 경로를 더 많이 사용하게 된다는 점에서, 백엔드 스키마 생성 레이어에서 `order` 충돌을 정적으로 검증하는 것이 장기적으로 더 안전하다.
  - 제안: 즉각 변경 불필요. 백엔드 zod 스키마 lint(order 중복 방지)를 향후 개선 항목으로 고려.

## 요약

이번 변경은 `TextClassifierConfig`·`InformationExtractorConfig`의 bespoke TSX 폼을 삭제하고 이를 schema-driven `SchemaForm` 경로로 전환하는 것으로, 기존 `OVERRIDE_REGISTRY` → `NodeConfigRenderer` 아키텍처가 처음부터 의도한 마이그레이션 경로를 그대로 따른다. OCP·SRP 관점에서 코드베이스의 책임 경계가 개선되었으며, 프레젠테이션 레이어에 하드코딩되어 있던 필드 메타데이터가 백엔드 SSOT(zod schema ui 힌트)로 올바르게 이동한다. 구조적 결함은 없으며, `widget-resolver.ts`를 통한 순환 의존성 차단 패턴도 유지된다. 단, AI 노드 타입 문자열 리터럴이 여러 파일에 분산된 것은 기존 기술 부채로 이번 변경과 무관하게 존재하며, 장기 유지보수성 측면에서 점진적 중앙화가 권장된다.

## 위험도

LOW
