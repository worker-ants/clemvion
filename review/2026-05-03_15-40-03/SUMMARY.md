파일 쓰기 권한이 필요합니다. 권한을 승인해 주시면 저장하겠습니다. 그 전에 통합 보고서 내용을 아래에 출력합니다.

---

# Code Review 통합 보고서

> 리뷰 대상: `fix(ai-nodes): workspace 기본 LLM 존재 시 실행을 통과시키고 셀렉터 UI 일치화`
> 생성일: 2026-05-03

## 전체 위험도

**MEDIUM** — 보안 신뢰 경계 불명확(IDOR 가능성)과 AI 노드 실행 경로의 N+1 DB 쿼리가 핵심 위험이며, 나머지는 아키텍처 부채·테스트 갭·UX 플리커로 운영 장애로 직결되지는 않는다.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **Security** | `context.variables.__workspaceId`를 신뢰 경계 검증 없이 보안 결정(validation 우회)에 사용 — 공격자가 `variables`에 타 워크스페이스 ID를 주입해 IDOR 탐색 또는 검증 우회 가능 | `execution-engine.service.ts` — `filterAiNoLlmProviderError` | `workspaceId`를 user-land `variables`가 아닌 `ExecutionContext`의 전용 시스템 필드에서 읽도록 분리 |
| 2 | **Security** | `BadRequestException` 페이로드에 `workspaceId`를 구조화 필드로 노출 — 자동화 스크립트가 타인의 workspace ID를 열거하는 surface 확대 | `llm.service.ts` — `resolveConfig` throw 블록 | 프론트엔드가 해당 필드를 파싱하지 않는다면 제거; 사용하는 경우 "자신의 ID만 반환됨" 주석 명시 |
| 3 | **Performance** | AI 노드 N개 포함 워크플로우 실행 시 `hasDefaultLlmConfig` → `findDefault` DB 쿼리 N회 반복 (N+1) — 캐시 없음 | `execution-engine.service.ts` — `filterAiNoLlmProviderError`, `llm.service.ts` — `hasDefaultLlmConfig` | `listModelsCache`와 동일한 패턴으로 단기 TTL 인메모리 캐시 추가, 또는 실행 컨텍스트에 1회 조회 후 재사용 |
| 4 | **Reliability** | `hasDefaultLlmConfig`가 DB 오류로 throw할 경우 예외가 전파되어 `INVALID_NODE_CONFIG` 대신 DB 에러로 노드 실패 처리 — 오류 경로 오염 | `execution-engine.service.ts` — `filterAiNoLlmProviderError` | try-catch로 감싸고 예외 시 원본 `errors` 반환 (fail-safe) |
| 5 | **Architecture** | LLM 도메인 검증 로직(노드 타입 판별·에러 메시지 식별·기본 LLM 존재 확인)이 실행 엔진 인프라 레이어로 침투 — SRP 위반 | `execution-engine.service.ts` — `filterAiNoLlmProviderError` | `NodeHandler.validate(config, context?)` 시그니처 확장 또는 `AiValidationPostProcessor` 서비스로 추출 |
| 6 | **Architecture** | `validate()` 반환 타입이 `string[]`이어서 에러 종류를 한국어 문자열 비교로 식별 — 메시지 변경 시 필터가 무음으로 비활성화되는 구조적 부채 | `execution-engine.service.ts` — `errors.includes(AI_NO_LLM_PROVIDER_MESSAGE)`, `llm-provider-rule.ts` | `validate()` 반환 타입을 `Array<{ code: string; message: string }>`로 확장; 단기 불가 시 TODO 이슈로 추적 |
| 7 | **Architecture** | 프론트엔드 `LLM_PROVIDER_NODES`와 백엔드 `AI_LLM_PROVIDER_NODE_TYPES`가 동일한 3개 노드 타입을 별도 파일에 이중 관리 — 새 AI 노드 추가 시 한쪽 누락 위험 | `backend/src/nodes/ai/llm-provider-rule.ts`, `frontend/src/lib/utils/node-config-summary.ts` | 공유 패키지에 단일 상수 선언; 단기 불가 시 두 파일에 "동기화 필수" 주석 명시 |
| 8 | **Concurrency** | `hasDefaultLlmConfig` 확인과 실제 LLM 핸들러 실행 사이에 기본 LLM이 삭제될 수 있는 TOCTOU 창 존재 — validation 통과 후 실행 시점에 `LLM_CONFIG_NOT_FOUND` 예외 발생 가능 | `execution-engine.service.ts` — validation + 핸들러 실행 사이 | 핸들러 내부에서 `LLM_CONFIG_NOT_FOUND`를 `INVALID_NODE_CONFIG`와 동일 policy로 처리, 또는 조회 결과를 context에 저장해 재사용 |
| 9 | **UX** | `isLoading` 상태에서 `configs`가 빈 배열이므로 `defaultConfig === undefined` → "기본 LLM 미설정" 힌트가 잠시 노출됐다가 사라지는 플리커 | `llm-config-selector.tsx` — `!defaultConfig && value === ""` 조건 | `isLoading` / `isPending` 플래그를 조건에 추가해 로딩 중 힌트 숨김 |
| 10 | **UX** | 쿼리 완료 전 AI 노드를 추가하면 `defaultLlmConfigId`가 null이어서 `llmConfigId` 미주입 — 이후 쿼리 완료 시 소급 보정 없음 | `workflow-canvas.tsx` — `buildInitialConfig`, `handleAddNodeFromSearch`, `onDrop` | `isLoading` 시 노드 추가 비활성화, 또는 쿼리 완료 후 미설정 AI 노드 일괄 보정 |
| 11 | **Testing** | `workflow-canvas.tsx`의 `buildInitialConfig` 로직(AI 노드 추가 시 기본 LLM 자동 주입) 테스트 부재 | `workflow-canvas.tsx` — `buildInitialConfig` 콜백 | 순수 함수로 분리하거나 `handleAddNodeFromSearch` 호출 시 `config.llmConfigId` 검증 단위 테스트 추가 |
| 12 | **Testing** | `llm-config-selector.test.tsx`에 `useT` 모킹 부재 — i18n Provider 없으면 렌더 실패 또는 정규식 매칭 실패 가능 | `llm-config-selector.test.tsx` 전체 | `vi.mock("@/lib/i18n", ...)` 최소 mock 추가 |
| 13 | **Maintainability** | 테스트 내 `NO_LLM_MSG` 한국어 리터럴 하드코딩 — `AI_NO_LLM_PROVIDER_MESSAGE` 상수 변경 시 테스트가 조용히 통과 (SSOT 원칙 위반) | `execution-engine.service.spec.ts:2982` | `import { AI_NO_LLM_PROVIDER_MESSAGE } from '../../nodes/ai/llm-provider-rule'`로 교체 |
| 14 | **Maintainability** | API 응답 이중 fallback 패턴 `data?.data ?? data ?? []`이 두 컴포넌트에 중복 | `workflow-canvas.tsx:114–118`, `llm-config-selector.tsx:24` | `llmConfigsApi.getAll()` 반환 타입 단일화 또는 `useQuery` 래퍼 훅으로 추출 |
| 15 | **Documentation** | `workflow-canvas.tsx` 주석에서 "CustomNode가 동일 query key 사용" 주장이 파일 내 검증 불가 — 키 변경 시 잘못된 안도감 제공 | `workflow-canvas.tsx:100–106` | 상수 `LLM_CONFIGS_QUERY_KEY`로 추출해 양쪽이 동일 상수 참조 |
| 16 | **API Contract** | `resolveConfig` 에러 메시지가 영문 고정 → 한국어 동적 문자열로 변경 — 메시지 문자열을 파싱하는 외부 클라이언트가 있으면 breaking change | `llm.service.ts` — `resolveConfig` | `code` 기반 에러 핸들링 가이드 공지 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **Database** | `(workspace_id, is_default)` 복합 인덱스 존재 여부 미확인 — `findDefault` 반복 호출 개선 후에도 인덱스 부재 시 풀 스캔 가능 | `LlmConfig` 엔티티 / 마이그레이션 | 인덱스 현황 확인; 없으면 마이그레이션으로 추가 |
| 2 | **Concurrency** | 동일 실행 내 AI 노드 직렬 실행 중 기본 LLM 삭제 시 앞 노드는 통과·뒤 노드는 차단되는 비대칭 결과 가능 | `execution-engine.service.ts` — 노드 실행 루프 | 실행 시작 시점 1회 조회 후 context에 주입 (W-3 캐시 해결로 자연히 완화) |
| 3 | **Performance** | `LlmConfigSelector`의 `configs.find((c) => c.isDefault)` 매 렌더마다 재실행 — 미메모이즈 | `llm-config-selector.tsx:25` | `useMemo(() => configs.find(...), [configs])` 추가 |
| 4 | **Performance** | `buildInitialConfig`에서 AI 노드 여부와 무관하게 항상 객체 스프레드 수행 | `workflow-canvas.tsx:122` | 비-AI 노드는 early-return으로 원본 반환 |
| 5 | **Dependency** | `modules/execution-engine`이 `nodes/ai/llm-provider-rule`을 직접 import — 실행 엔진이 특정 노드 카테고리를 직접 인식하는 결합 | `execution-engine.service.ts:54–57` | 현재 범위(읽기 전용 상수)에서는 수용 가능 |
| 6 | **Testing** | `filterAiNoLlmProviderError` 내 `hasDefaultLlmConfig` 예외 전파 경로 테스트 부재 | `execution-engine.service.spec.ts` | W-4 fail-safe 추가와 함께 fallback 동작 테스트 추가 |
| 7 | **Testing** | `context.variables.__workspaceId` 키 자체가 없는 케이스 미검증 (`buildContext('')`만 존재) | `execution-engine.service.spec.ts:3063` | `buildContext(undefined)` 케이스 별도 `it` 추가 |
| 8 | **Testing** | `filterAiNoLlmProviderError` private 메서드 직접 테스트 — `Filterable` 타입 어긋나도 컴파일 오류 미발생 | `execution-engine.service.spec.ts:2994–3072` | `Filterable` 변경 시 동기화 주석 명시 |
| 9 | **Testing** | `llmService` 타입 캐스트 패턴이 4개 `it()` 블록에 중복 | `execution-engine.service.spec.ts` | `beforeEach`에서 `let llm` 한 번 할당 |
| 10 | **Testing** | `LlmConfigSelector` 테스트에 사용자 인터랙션 케이스 부재 | `llm-config-selector.test.tsx` | `userEvent.selectOptions` 기반 선택 변경 테스트 추가 |
| 11 | **Testing** | `resolveConfig` 에러 메시지 테스트에 한국어 문자열 하드코딩 | `llm.service.spec.ts:228` | 메시지 상수 추출 후 공유, 또는 `workspaceId` payload 검증으로 대체 |
| 12 | **Maintainability** | `Filterable` 타입이 `filterAiNoLlmProviderError` 파라미터 타입을 수동 복제 — 시그니처 변경 시 무음 불일치 | `execution-engine.service.spec.ts:2989–2996` | `// keep in sync with filterAiNoLlmProviderError signature` 주석 추가 |
| 13 | **Maintainability** | 테스트명 `'keeps the error when workspaceId is missing in context'`가 실제로는 빈 문자열 케이스를 검증 | `execution-engine.service.spec.ts:3063` | 테스트명을 `'workspaceId is empty string'`으로 수정 |
| 14 | **Documentation** | `filterAiNoLlmProviderError` JSDoc에 `@param context` 누락 | `execution-engine.service.ts:2394–2423` | `@param context` 태그 및 `context.variables.__workspaceId` 접근 방식 기술 |
| 15 | **Documentation** | i18n `defaultOptionWithResolved` 키의 `{{name}}` 플레이스홀더 계약이 dict 파일 내 명시 없음 | `en.ts:1119`, `ko.ts:1115` | `// interpolation: { name: string }` 주석 추가 |
| 16 | **API Contract** | `workspaceId` 필드 신규 추가 — 엄격한 스키마 검증 클라이언트 영향 가능 | `llm.service.ts` — `resolveConfig` 에러 응답 | OpenAPI 스펙 에러 스키마에 `workspaceId` 필드 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **MEDIUM** | `context.variables.__workspaceId` 신뢰 경계 불명확(IDOR), `workspaceId` 구조화 필드 노출 |
| Performance | **MEDIUM** | `hasDefaultLlmConfig` N+1 DB 쿼리 (핫패스) |
| Architecture | **LOW** | LLM 도메인 로직의 실행 엔진 침투, `validate()` `string[]` 설계 부채, 노드 타입 이중 관리 |
| Testing | **LOW** | `buildInitialConfig` 테스트 부재, `useT` 모킹 누락, `hasDefaultLlmConfig` 예외 경로 미테스트 |
| Side Effect | **LOW** | DB 오류 전파 오염, `resolveConfig` 메시지 변경 호환성, 로딩 중 힌트 플리커 |
| Concurrency | **LOW** | TOCTOU 경쟁 조건, 동일 실행 내 쿼리 결과 비일관성 |
| Maintainability | **LOW** | SSOT 원칙 위반(`NO_LLM_MSG` 리터럴), API 응답 패턴 중복 |
| Requirement | **LOW** | N+1 쿼리, 노드 추가 race condition, `__workspaceId` 완전 부재 케이스 미검증 |
| Database | **LOW** | N+1 유사 패턴, `(workspace_id, is_default)` 인덱스 의존성 미확인 |
| API Contract | **LOW** | `resolveConfig` 에러 메시지 언어 변경(breaking 가능), `workspaceId` 필드 추가 |
| Documentation | **LOW** | `filterAiNoLlmProviderError` `@param context` 누락, 캐시 공유 주석 검증 불가 |
| Scope | **LOW** | 범위 위반 없음; 변경셋은 단일 사용자 스토리를 응집도 있게 완성 |
| Dependency | **LOW** | 신규 외부 패키지 없음; `hasDefaultLlmConfig` 핫패스 반복 조회, API 응답 이중 fallback 중복 |

---

## 발견 없는 에이전트

없음 — 13개 에이전트 모두 최소 1건 이상의 발견사항을 보고함

---

## 권장 조치사항

### 즉시 처리 (운영 위험)

1. **[Security] `workspaceId` 신뢰 경계 명확화** — `context.variables.__workspaceId` 대신 `ExecutionContext`의 전용 시스템 필드에서 `workspaceId`를 읽도록 변경. IDOR 가능성 차단.
2. **[Reliability] `filterAiNoLlmProviderError` fail-safe 추가** — `hasDefaultLlmConfig` 호출을 try-catch로 감싸고 예외 시 원본 `errors` 반환. DB 장애가 AI 노드 실행 오류로 번지는 것을 방지.
3. **[Performance] `hasDefaultLlmConfig` 캐싱** — `listModelsCache` 패턴과 동일하게 짧은 TTL(30–60초) 인메모리 캐시 추가.

### 단기 처리 (품질 개선)

4. **[Security] `workspaceId` 에러 페이로드 필드 제거** — 프론트엔드가 파싱하지 않는다면 `BadRequestException` payload에서 제거.
5. **[UX] 로딩 중 힌트 플리커 수정** — `isLoading` 플래그를 `noDefaultHint` 렌더 조건에 추가.
6. **[Testing] `NO_LLM_MSG` 리터럴 → 상수 import 교체** — SSOT 원칙 복원.
7. **[Testing] `useT` 모킹 추가** — `llm-config-selector.test.tsx`의 구조적 불안정 해소.
8. **[Testing] `buildInitialConfig` 단위 테스트 추가** — 캔버스의 핵심 LLM 자동 주입 동작 검증.

### 중기 처리 (기술 부채)

9. **[Architecture] `validate()` 반환 타입 구조화** — `Array<{ code: string; message: string }>`로 변경해 문자열 비교 기반 보안 분기 제거.
10. **[Architecture] 프론트/백 AI 노드 타입 공유 패키지 추출** — `packages/node-types`에 단일 상수 선언.
11. **[Maintainability] API 응답 fallback 패턴 정규화** — `llmConfigsApi.getAll()` 반환 타입 단일화.
12. **[Documentation] `filterAiNoLlmProviderError` JSDoc 보완** — `@param context` 태그 및 `context.variables.__workspaceId` 접근 방식 기술.