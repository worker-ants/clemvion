# Code Review 통합 보고서

## 전체 위험도
**LOW** — 핵심 기능 요구사항(V-02) 완전 충족. Critical 발견 없음. `includeConfidence` 기본값 변경에 대한 schema 테스트 누락, auto-form 렌더 통합 테스트 부재 등 WARNING 2건 / SPEC-DRIFT 2건이 존재하나 모두 코드 동작에는 영향 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `includeConfidence` 기본값 변경(true → false)에 대한 schema 명시 테스트 누락. `includeEvidence` 기본값 테스트는 있으나 `includeConfidence` 누락. | `codebase/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts` | `textClassifierNodeConfigSchema` describe 블록에 `it('defaults includeConfidence to false')` 테스트 케이스 추가 |
| 2 | Testing | auto-form 이 `text_classifier` / `information_extractor` 의 전체 필드를 실제로 렌더하는지 검증하는 렌더 통합 테스트 부재. 이번 PR 핵심 목적(필드 노출 보장)을 직접 검증하는 테스트가 없음. | `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/` | vitest + jsdom 환경에서 SchemaForm 에 두 스키마를 넘겼을 때 렌더된 필드 목록을 스냅샷 또는 getByLabelText 로 검증하는 통합 테스트 추가 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `text_classifier` spec §2 UI 다이어그램 — Conversation Context(contextScope 5필드 · includeSystemContext · systemContextSections 2필드) 섹션 미표현. auto-form 이행으로 코드가 의도적으로 노출 확장; spec §2 다이어그램이 낡음. §1 config 표는 정확히 기술됨. 런타임 동작 영향 없음. | `spec/4-nodes/3-ai/2-text-classifier.md §2` (lines 56–91) | 코드 유지 + spec §2 다이어그램에 Conversation Context / System Context 섹션 추가. project-planner 위임. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `information_extractor` spec §2 UI 다이어그램 — Memory 섹션(memoryStrategy 7필드) · Conversation Context(contextScope 5필드) · System Context(2필드) 미표현. §1 config 표에는 전부 기술됨. | `spec/4-nodes/3-ai/3-information-extractor.md §2` (lines 70–110) | 코드 유지 + spec §2 다이어그램에 Memory / Conversation Context / System Context 섹션 추가. project-planner 위임. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | 미사용 i18n 키(`includeConfidence`, `includeConfidenceHint` 등) 번역 사전에 잔존 가능. 런타임 오류 없음, 번들 사이즈 미미한 영향. auto-form 은 backend schema `ui.label` 직접 사용. | `codebase/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts`, `en/nodeConfigs.ts` | 별도 cleanup ticket 으로 처리. 블로킹 아님. |
| 2 | Side Effect | `includeConfidence` 기본값이 구 bespoke 폼(`true`)에서 schema 정의(`false`)로 교정. 기존 저장 설정값은 변경 없음. CHANGELOG 에 명시됨. | `text-classifier.schema.ts` L74-79 | 별도 조치 불필요. |
| 3 | Maintainability | `OVERRIDE_REGISTRY.switch` / `OVERRIDE_REGISTRY.table` 하드코딩 접근. 잔존 노드 목록 변경 시 테스트 함께 업데이트 필요한 묵시적 결합. 현재 주석이 관계 명시. | `override-registry.test.ts` lines 19-20 | 변경 불요. 잔존 목록이 자주 바뀔 경우 `Object.keys(OVERRIDE_REGISTRY)` 기반 스냅샷 전환 고려. |
| 4 | Maintainability | `NodeConfigRenderer` 에 대한 직접 단위 테스트 없음. `getNodeDefinition` null 반환 시 null 렌더 경로 미커버. | `codebase/frontend/src/components/editor/settings-panel/node-configs/index.tsx` | 이번 PR 범위 밖. 장기 개선 항목으로 기록. |
| 5 | Documentation | plan V-02 항목에 PR 번호 미기재(다른 항목은 기재됨). 머지 시 보완 가능. | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 머지 후 PR 번호 보완. |
| 6 | Documentation | CHANGELOG "기존 저장된 설정값에는 영향이 없다" 서술이 `includeConfidence` 에만 한정되는 것인지 전체 설정에 해당하는 것인지 불명확. | `CHANGELOG.md` lines 34–38 | 선택적 명확화. 블로킹 아님. |
| 7 | Security | 삭제된 bespoke 폼의 동적 키 업데이트 패턴(잠재적 prototype pollution 경로) 소멸. auto-form 경로의 prototype pollution 방어는 spec `clearFields` 예약 키 필터에 명시됨. | `ai-configs.tsx`(삭제), `override-registry.ts` | 신규 auto-form `clearFields` 핸들러의 예약 키 필터 구현 여부를 별도 리뷰에서 확인 권장. 본 변경 내 문제 없음. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질적 보안 위협 없음. 삭제된 동적 키 패턴(prototype pollution 경로) 소멸. |
| requirement | NONE | V-02 핵심 요구사항 완전 충족. SPEC-DRIFT 2건(spec §2 다이어그램 미갱신)은 코드 동작 무관. |
| scope | NONE | 6개 파일 모두 단일 목적 집중, 범위 이탈 없음. |
| side_effect | LOW | `includeConfidence` 기본값 교정(의도된 변경), i18n 키 잔존(런타임 무영향). |
| maintainability | NONE | 262라인 bespoke 컴포넌트 삭제, 중복 제거, 주석·spec 동기화 완료. |
| testing | LOW | `includeConfidence` schema 테스트 누락(WARNING), auto-form 렌더 통합 테스트 부재(WARNING). |
| documentation | LOW | 전반적 양호. plan V-02 PR 번호 미기재(INFO). |

## 발견 없는 에이전트

- **scope**: 범위 이탈 항목, 불필요한 리팩토링, 무관 파일 수정 전혀 없음.
- **maintainability**: 삭제 중심 PR 로 유지보수성 전반적으로 개선됨.
- **security**: 하드코딩 시크릿·인젝션 취약점·인증 우회 등 실질적 보안 위협 없음.
- **requirement**: 핵심 기능 요구사항 완전 충족.

## 권장 조치사항

1. **[WARNING-1 — Testing]** `text-classifier.schema.spec.ts` 에 `includeConfidence` 기본값 `false` 검증 테스트 추가 (소규모, 즉시 보완 가능).
2. **[WARNING-2 — Testing]** vitest + jsdom 환경에서 `textClassifierNodeConfigSchema` / `informationExtractorNodeConfigSchema` 를 SchemaForm 에 넘겼을 때 렌더된 필드 목록을 검증하는 통합 테스트 추가 — PR 의 핵심 목적(필드 노출 보장)을 직접 검증.
3. **[SPEC-DRIFT-1 — project-planner]** `spec/4-nodes/3-ai/2-text-classifier.md §2` 다이어그램에 Conversation Context / System Context 섹션 추가.
4. **[SPEC-DRIFT-2 — project-planner]** `spec/4-nodes/3-ai/3-information-extractor.md §2` 다이어그램에 Memory / Conversation Context / System Context 섹션 추가.
5. **[INFO]** 미사용 i18n 키(`includeConfidence`, `includeConfidenceHint`) cleanup ticket 생성 (블로킹 아님).
6. **[INFO]** 머지 완료 후 plan V-02 항목에 PR 번호 보완.

## 라우터 결정

라우터가 선별하여 실행함 (`routing=done`).

- **실행 (forced by router_safety, 7명)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 전원 강제 포함)
- **제외 (7명)**:

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 삭제 중심 PR, 성능 영향 없음 |
  | architecture | 기존 auto-form 아키텍처 내 레지스트리 항목 제거, 구조 변경 없음 |
  | dependency | 신규 의존성 추가 없음 |
  | database | 백엔드/DB 변경 0건 |
  | concurrency | 비동기/동시성 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 변경 없음 |