# Code Review 통합 보고서

## 전체 위험도
**LOW** — bespoke AI 노드 설정 폼 삭제 및 schema-driven auto-form 이행은 설계 의도에 맞고 보안·기능 위험 없음. 테스트 커버리지 공백(NodeConfigRenderer 통합 테스트 미존재)과 i18n 데드 키·CHANGELOG 미기재 등 소규모 후속 조치 필요.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 해당 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `NodeConfigRenderer` 에 대해 `text_classifier`·`information_extractor` 가 auto-form(`SchemaForm`)으로 렌더됨을 검증하는 통합 테스트 미존재 | `node-configs/index.tsx`, `override-registry.ts` | `getNodeDefinition` mock 사용 후 `SchemaForm` 렌더 여부를 단언하는 테스트 추가 |
| 2 | Testing | backend zod 스키마가 `visibleWhen`, `field-array` 등 UI 힌트를 올바르게 방출하는지 검증하는 테스트 미존재 (특히 `inputField` 의 `mode !== multi_turn` 조건부 노출) | `information-extractor.schema.ts`, `text-classifier.schema.ts`, `auto-form/__tests__/` | 백엔드 스키마 JSON Schema 직렬화 스냅샷 테스트 또는 frontend stub 기반 통합 테스트 추가 |
| 3 | Documentation | `ai-configs.tsx` 삭제로 `t("nodeConfigs.ai.*")` 소비자가 사라졌으나 ko/en i18n 딕셔너리 `ai` 섹션이 데드 코드로 잔존 | `src/lib/i18n/dict/ko/nodeConfigs.ts` L14–68, `en/nodeConfigs.ts` L16–55 | 별도 PR에서 미사용 i18n 키 제거 또는 사용처 주석 명시 (백로그 등록 권장) |
| 4 | Documentation | 사용자-노출 UI 변경(`examples`, `enumValues`, `maxCollectionRetries`, 대화 컨텍스트·메모리·시스템 컨텍스트 필드 신규 노출)이 CHANGELOG에 미기재 | `CHANGELOG.md` (Unreleased 섹션) | `## Unreleased` 에 "text_classifier·information_extractor 설정 폼 schema-driven auto-form 전환(cross-audit V-02)" 항목 추가 |
| 5 | Architecture | AI 노드 타입 문자열 리터럴(`"text_classifier"`, `"information_extractor"`, `"ai_agent"`)이 6개 이상 파일에 분산 하드코딩됨 | `node-config-summary.ts:36-38`, `workflow-canvas.tsx:109`, `use-expression-context.ts:177,242`, `apply-execution-snapshot.ts:425`, `result-detail.tsx:160-161`, `result-timeline.tsx:87` | AI 노드 타입 상수를 단일 모듈(`ai-node-types.ts`)로 중앙화하는 점진적 리팩터링 백로그 등록 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 삭제된 `ai-configs.tsx` 에 하드코딩 시크릿 없음. auto-form 경로는 `UNSAFE_KEYS` 프로토타입 오염 방어 보유. 공격 표면 축소 방향. | `ai-configs.tsx`(삭제), `utils.ts:84-101` | 현행 유지 |
| 2 | Architecture | OCP·SRP 준수 — `NodeConfigRenderer` 수정 없이 레지스트리 항목 제거만으로 auto-form 전환. 레이어 책임 분리 개선. | `override-registry.ts`, `index.tsx` | 현행 유지 |
| 3 | Requirement | 구 bespoke 폼이 누락하던 Conversation Context(5개), System Context(2개), examples, enumValues, maxCollectionRetries, memoryStrategy(7개) 필드가 auto-form에서 모두 노출. spec §1 Table 전 필드 커버 완료. | `textClassifierNodeConfigSchema`, `informationExtractorNodeConfigSchema` | 이행 방향 타당 |
| 4 | Side Effect | `includeConfidence` UI 기본값 불일치: 삭제된 bespoke form은 `true`, zod 스키마는 `false`. 신규 노드 생성 시에만 영향. 기존 저장 설정 무영향. | `ai-configs.tsx`(삭제) L97, `text-classifier.schema.ts` L77 | PR 설명에 의도적 변경 명시, 또는 zod 스키마 기본값을 `true`로 맞추는 것 검토 |
| 5 | Scope | 수정 3개 파일 모두 V-02 해소 목적에 직결. `override-registry.ts` 주석 확장(장황하나 오류 아님), plan 파일 V-16/V-17 PR 번호 보완 허용 수준. | `override-registry.ts`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 현행 유지 |
| 6 | Maintainability | 262줄 중복 bespoke 컴포넌트 삭제로 코드 복잡도 감소. AI 섹션 주석만 남고 실제 항목 0개인 구조는 장기적으로 정리 검토. | `override-registry.ts` L65–68 | AI 섹션 주석을 상단 JSDoc에 통합하거나 마이그레이션 완료 후 제거 고려 |
| 7 | Testing | 삭제 전 `ai-configs.tsx` 전용 unit 테스트가 원래 미존재. 삭제로 인한 테스트 손실 없음. | `node-configs/__tests__/` | 기술 부채로 기록 |
| 8 | Documentation | `override-registry.ts` 인라인 주석 및 `NodeConfigRenderer` JSDoc 모두 마이그레이션 패턴·근거 충분히 기술. backend zod 스키마 `.meta({ ui: ... })` 인라인 문서 충실. | `override-registry.ts` L65-69, `index.tsx` L11-21, `text-classifier.schema.ts`, `information-extractor.schema.ts` | 현행 유지 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 공격 표면 축소. 프로토타입 오염 방어 기존 적용. 시크릿 없음. |
| architecture | LOW | AI 노드 타입 문자열 리터럴 분산(WARNING). OCP·SRP·순환 의존성 패턴 양호. |
| requirement | NONE | spec §1 전 필드 커버 완료. 구 bespoke 폼 대비 기능 커버리지 향상. |
| scope | NONE | 수정 파일 3개 모두 V-02 목적에 직결. 무관 변경 없음. |
| side_effect | LOW | `includeConfidence` 기본값 변화(신규 노드만, INFO 수준). 댕글링 참조 없음. |
| maintainability | LOW | AI 섹션 빈 주석 잔존(INFO). 중복 코드 262줄 제거로 유지보수성 향상. |
| testing | MEDIUM | NodeConfigRenderer 통합 테스트 미존재(WARNING). backend 스키마 UI 힌트 검증 테스트 미존재(WARNING). |
| documentation | LOW | i18n 데드 키 잔존(WARNING). CHANGELOG 미기재(WARNING). 코드 내 인라인 문서는 양호. |

---

## 발견 없는 에이전트

해당 없음 (모든 실행 에이전트가 발견사항을 보고함).

---

## 권장 조치사항

1. **[W-1] NodeConfigRenderer 통합 테스트 추가** — `text_classifier` 타입으로 `NodeConfigRenderer` 호출 시 `SchemaForm` 이 렌더되고 override 컴포넌트가 렌더되지 않음을 검증. `getNodeDefinition` mock 으로 격리 가능.
2. **[W-2] backend 스키마 UI 힌트 검증 테스트** — `information-extractor.schema.ts` 의 `inputField.visibleWhen` 등 JSON Schema 직렬화 결과를 스냅샷 테스트로 고정. `mode !== multi_turn` 조건부 노출 회귀 방지.
3. **[W-3] CHANGELOG 업데이트** — `## Unreleased` 에 "text_classifier·information_extractor 설정 폼을 schema-driven auto-form으로 전환 (cross-audit V-02). examples, enumValues, maxCollectionRetries, 대화 컨텍스트·메모리·시스템 컨텍스트 필드 자동 노출." 기재.
4. **[W-4] i18n 데드 키 제거 백로그 등록** — `ko/nodeConfigs.ts`·`en/nodeConfigs.ts` 의 `ai` 섹션 미사용 키를 별도 PR에서 정리.
5. **[INFO, 후속] `includeConfidence` 기본값 검토** — zod 스키마 `default(false)` 를 `default(true)` 로 수정하거나, PR 설명에 의도적 동작 변경임을 명시.
6. **[INFO, 장기] AI 노드 타입 상수 중앙화** — `ai-node-types.ts` 단일 모듈로 문자열 리터럴 6개소 하드코딩 해소 리팩터링 백로그 등록.

---

## 라우터 결정

라우터가 reviewer 를 선별하여 실행함.

- **실행 (forced, 8명)**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- **제외 (6명)**:

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | AI 노드 UI 폼 삭제 및 registry 수정으로 성능 회귀 위험 낮음 |
| dependency | 외부 의존성 추가/변경 없음 |
| database | DB 스키마·마이그레이션 변경 없음 |
| concurrency | 동시성 로직 변경 없음 |
| api_contract | API 계약 변경 없음 (프론트엔드 UI 레이어만 변경) |
| user_guide_sync | 사용자 가이드 문서 동기화 범위 아님 |

- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (architecture 포함하여 전체 8명 실행)