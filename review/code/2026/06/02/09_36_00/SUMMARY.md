# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — i18n Principle 3-C 구현 자체의 완결성은 높으나, 핵심 spec(i18n-userguide.md, cross-node-warning-rules.md)이 구현을 따라가지 못한 SDD 원칙 위반과 프론트엔드 번역 함수·컴포넌트 렌더 경로에 대한 테스트 공백이 주요 위험 요소다.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Spec | `i18n-userguide.md` 에 "Principle 3-C" 정의 부재 — 코드·테스트·plan 이 미정의 spec 을 다수 참조. SDD 원칙 위반 | `spec/conventions/i18n-userguide.md` 전체 | `project-planner` 위임: Principle 3-C 절 신설 (GRAPH_WARNING_KO · translateGraphWarning · params 계약 · P3-C-1/P3-C-2 가드 정식화) |
| 2 | Requirement / Spec | `cross-node-warning-rules.md §3` `GraphWarningRuleResult` 타입 블록에 `params?` 필드 부재 — spec vs 구현 불일치. `evaluate` 반환 시그니처도 `{ message } \| null` 고정으로 구현의 `{ message; params? } \| null` 과 다름 | `spec/conventions/cross-node-warning-rules.md` L66–72 | `project-planner` 위임: spec §3 타입 블록에 `params?` 필드와 `evaluate` 반환 타입 변경 반영 |
| 3 | Testing | `custom-node.tsx` 의 `translateGraphWarning` 경유 렌더 경로(ko/en 로케일·params 유무)를 검증하는 컴포넌트 테스트 없음 | `codebase/frontend/src/components/editor/canvas/__tests__/custom-node-graph-warning.test.tsx` | ko + params → 한국어 보간, en → 영문 fallback, params 없음 → `result.message` 케이스 추가 |
| 4 | Testing | `editor-toolbar-rbac.test.tsx` 가 Save 버튼 `title` 을 구 동작(영문 원문 직접) 기준으로만 검증 — ko 로케일 + params 보간 경로 미커버 | `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-rbac.test.tsx` L134 | ko 로케일·params 있는 error result → title 이 한국어 보간 결과인지 검증 케이스 추가 |
| 5 | Testing | `translateGraphWarning` / `translateBackendError` 신규 함수에 대한 직접 단위 테스트 없음 — 로케일 분기·params 보간·fallback·null params 처리 모두 미커버 | `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` | 최소 4 케이스: (1) ko + known ruleId + params → 보간 문자열, (2) ko + unknown ruleId → fallback 영문, (3) en → fallback 영문, (4) params 누락 → template 그대로 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `params` 값(사용자 입력 노드 라벨)이 타입/docstring 수준에서 "신뢰 불가 입력" 으로 명시되지 않음 — 현재 React JSX 경로는 안전하나 향후 비-React 경로 확장 시 리스크 | `types.ts`, `translateGraphWarning` docstring | 타입 정의와 함수 주석에 "params 는 사용자 입력 포함 — 렌더 경로에서 반드시 escape" 명시 |
| 2 | Security | JSON input 파싱(`handleRunWithInput`) 후 클라이언트 측 스키마 검증 없이 서버 전송 | `editor-toolbar.tsx` L1214 | 클라이언트 깊이/크기 제한 또는 서버 DTO max depth 적용 (기존 코드 보완, 이번 범위 외) |
| 3 | Scope | e2e 테스트에서 기능 변경(params 단언)과 순수 포맷팅 리포맷이 혼재 | `codebase/backend/test/graph-warning-save.e2e-spec.ts` diff | 포맷 변경 별도 커밋 또는 커밋 메시지에 의도 명시 |
| 4 | Side Effect | `validation-errors.mdx` `order: 5` 가 같은 섹션 내 기존 파일과 중복될 수 있음 | `codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.mdx` | 동일 섹션 내 `order: 5` 중복 여부 기존 MDX 파일과 대조 확인 |
| 5 | Maintainability | `editor-toolbar.tsx` JSX `title` 속성에 IIFE 사용 — 기존 `useMemo` 컨벤션과 불일치, 매 render 마다 함수 생성 | `editor-toolbar.tsx` L1399–1406 | `useMemo` 로 추출 |
| 6 | Maintainability | `translateBackendError` 현재 호출 지점 없이 export — dead code 위험 | `backend-labels.ts` | TODO 주석 추가 또는 실제 호출 지점과 함께 후속 PR 추가 |
| 7 | Maintainability | `evaluator.ts` 의 조건부 spread `...(triggered.params ? { params: triggered.params } : {})` 가 불필요하게 복잡 | `evaluator.ts` | `params: triggered.params` 또는 `params: triggered.params ?? undefined` 로 단순화 |
| 8 | Maintainability | `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열이 `ERROR_KO` 키 목록과 수동 동기화 필요 | `backend-labels.test.ts` | 규모 커지면 `Object.keys(ERROR_KO)` 직접 순회로 전환 고려 |
| 9 | Testing | e2e A케이스에서 `params` 값(실제 노드 라벨) 미검증 — key 존재만 확인 | `graph-warning-save.e2e-spec.ts` L281–284 | `toMatchObject({ node: 'Outer', child: 'Middle', grand: 'Inner' })` 로 강화 가능 |
| 10 | Testing | `parallel.spec.ts` evaluator 레벨 케이스에서 `grand` 값 단언 누락 | `parallel.spec.ts` L165–168 | `toMatchObject({ node, child, grand: 'Innermost' })` 로 보완 |
| 11 | Testing | `no-internal-refs.test.ts` 상단 주석 Forbidden 목록에 `GRAPH_WARNING_KO` 미등재 (정규식은 추가됨) | `no-internal-refs.test.ts` L21–22 | 상단 주석 목록에 `GRAPH_WARNING_KO` 추가 |
| 12 | Documentation | `interpolate` 함수가 export 로 승격되었으나 JSDoc 없음 | `core.ts` — `export function interpolate` | `@param`, `@returns`, `@example`, params 누락 시 동작 설명 JSDoc 추가 |
| 13 | Documentation | `translateBackendError` JSDoc 에서 `params` undefined 시 graceful 동작 및 `fallback` 파라미터 타입 미문서화 | `backend-labels.ts` | `@param` 각 인자 추가, params 없을 때 동작 명시 |
| 14 | Documentation | `validation-errors.en.mdx` frontmatter 없음 — 빌드 시스템이 읽는 경우 누락 | `validation-errors.en.mdx` | 다른 `.en.mdx` 파일 패턴 확인 후 필요 시 최소 frontmatter 추가 |
| 15 | Documentation | `editor-store.ts` `params?` 필드에 `//` 인라인 주석 사용 — `/** */` JSDoc 스타일과 불일치 | `editor-store.ts` | `/** */` JSDoc 형태로 교체 |
| 16 | Documentation | `plan/in-progress/backend-msg-i18n-impl.md` frontmatter `worktree` 가 "(미정)" 으로 남음 | `plan/in-progress/backend-msg-i18n-impl.md` | `worktree: parallel-p2-w1w2` 로 업데이트 |
| 17 | API Contract | `POST /workflows/:id/save` 400 응답의 `details.errors` 배열에 포함되는 `params` 필드가 OpenAPI `@ApiResponse` 에 미정의 | `workflow-response.dto.ts` / save 엔드포인트 | `GraphWarningResultDto` 또는 별도 DTO 를 `@ApiResponse(400)` 데코레이터에 등록 |
| 18 | API Contract | `@ApiPropertyOptional` example 에 `grand` 키 누락 — e2e 가 검증하는 실제 params 구조와 불일치 | `workflow-response.dto.ts` L50 | example 을 rule 별 실제 params 키 반영하도록 갱신 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | params 의 사용자 입력 미문서화, JSON input 클라이언트 검증 부재 (모두 INFO) |
| requirement | MEDIUM | Principle 3-C spec 미정의, cross-node-warning-rules.md params 필드 미반영 (WARNING 2건) |
| scope | LOW | e2e 테스트 내 기능·포맷 변경 혼재 (INFO) |
| side_effect | NONE | 모든 변경이 additive·하위호환, 의도치 않은 부작용 없음 |
| maintainability | LOW | IIFE title prop, translateBackendError 미사용 export, 조건부 spread 복잡성 |
| testing | MEDIUM | translateGraphWarning·컴포넌트 렌더·toolbar title 의 로케일/params 경로 테스트 공백 (WARNING 3건) |
| documentation | NONE | 대부분 INFO 수준 개선 사항, 중대 문서화 갭 없음 |
| api_contract | LOW | 400 에러 응답 params OpenAPI 미정의, example 키 누락 |
| user_guide_sync | NONE | 매칭 4건 모두 동반 갱신 완료, 누락 0건 |

## 발견 없는 에이전트

- **user_guide_sync** — 동반 갱신 누락 없음 (SATISFIED 4/4)
- **side_effect** — 의도치 않은 부작용 없음
- **documentation** — 중대 문서화 갭 없음 (발견 전부 INFO)

## 권장 조치사항

1. **[필수] Spec 갱신 — `project-planner` 위임**: `i18n-userguide.md` 에 Principle 3-C 절 신설 및 `cross-node-warning-rules.md §3` `GraphWarningRuleResult` 타입 블록에 `params?` 필드·`evaluate` 반환 타입 업데이트. SDD 원칙상 구현 완료 후 반드시 spec 을 따라잡아야 함.
2. **[필수] 프론트엔드 번역 함수 단위 테스트 추가**: `translateGraphWarning` / `translateBackendError` 의 로케일별 분기·params 보간·fallback·null params 처리를 직접 검증하는 테스트 4+ 케이스 추가.
3. **[필수] 컴포넌트 렌더 경로 테스트 추가**: `custom-node-graph-warning.test.tsx` 에 ko/en 로케일 + params 유무 조합 케이스, `editor-toolbar-rbac.test.tsx` 에 ko 로케일 + params Save 버튼 title 케이스 추가.
4. **[권장] `editor-toolbar.tsx` IIFE → `useMemo` 리팩토링**: 기존 컨벤션과 일치시키고 렌더 성능 개선.
5. **[권장] API 문서 보완**: `POST /workflows/:id/save` 400 응답에 `@ApiResponse` 데코레이터로 `details.errors[].params` 스키마 등록, `@ApiPropertyOptional` example 에 `grand` 키 추가.
6. **[권장] `translateBackendError` TODO 주석 또는 후속 PR 연결**: 현재 미사용 export 상태 명시.
7. **[권장] plan frontmatter 업데이트**: `backend-msg-i18n-impl.md` 의 `worktree: (미정)` → `worktree: parallel-p2-w1w2`.
8. **[권장] `interpolate` JSDoc 추가**: export 승격 함수에 `@param`, `@returns`, params 누락 시 동작 설명 추가.

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (9명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (5명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |