# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 비즈니스 로직(`buildPickerSubmissionValue`의 MCP 객체 변환)이 무테스트이며, plan에서 명시 요구한 테스트 파일이 미제출 상태. 기능 구현 자체는 완전하나 회귀 방지 공백이 존재.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `assistant-message.test.ts` 파일 누락 — `buildPickerSubmissionValue`의 MCP 객체 변환 로직(`ids → [{integrationId, includeResources, includePrompts}]`)이 전혀 테스트되지 않음. plan 문서가 이 파일을 명시적으로 요구하며, 해당 함수는 `export`로 공개되어 있어 단위 테스트 작성이 용이한 상태임 | `assistant-message.tsx`, plan 문서 TODO | `buildPickerSubmissionValue` 단위 테스트를 single / kb-selector multi / mcp-server-selector multi / fallback 4개 케이스로 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract / Side Effect | MCP ServerRef 기본값(`includeResources: true, includePrompts: true`) 하드코딩 — `assistant-message.tsx`와 settings panel `McpServerSelector.add()`가 별개 위치에서 기본값을 유지. 스키마 변경 시 런타임 에러 없이 조용히 잘못된 config가 주입됨 | `assistant-message.tsx:61-66` | `mcpServerRefSchema` 기본값을 공유 상수(`MCP_SERVER_REF_DEFAULTS`)로 추출하거나, settings panel 컴포넌트와 동일 출처에서 파생 |
| 2 | Testing | `mcp-server-selector` rehydrate 테스트 누락 — `{integrationId}[]` 형태의 `currentValue` 복원 시 라벨 표시 경로가 미검증 (`KB rehydrate`는 커버되어 있으나 MCP는 없음) | `candidate-picker.test.tsx` | `currentValue=[{integrationId:"int-mcp-1", ...}]` 케이스로 "✓ 설정됨" 버블 및 라벨 표시 검증 추가 |
| 3 | Testing | 체크박스 전체 해제 후 Confirm 버튼 재비활성화 테스트 누락 — 선택 후 해제 시 `selectedIds`가 다시 비어 버튼이 `disabled`로 복귀되는 경로 미검증 | `candidate-picker.test.tsx` (multi-select describe) | 기존 "renders a checkbox list" 테스트에 토글 해제 스텝 추가 또는 별도 케이스 작성 |
| 4 | Testing | `buildPickerSubmissionValue` fallback 분기 미테스트 — "실제로 도달하지 않는다"는 주석이 있으나 코드로 존재하는 한 커버리지 공백 | `assistant-message.tsx` (multi 모드 fallback) | unknown-multi fallback 케이스를 `assistant-message.test.ts`에 포함 |
| 5 | Architecture / Maintainability | `extractSelectedIds`가 MCP 전용 shape(`integrationId` 키)을 범용 유틸에 포함 — presentation 레이어에 도메인 지식이 스며들어 MCP ref 스키마 변경 시 이 함수와 `buildPickerSubmissionValue` 두 곳을 동시에 수정해야 함 | `candidate-picker.tsx:57-76` | `extractSelectedIds`를 순수 `string[]` 정규화로 제한하고, `{integrationId}` 언패킹은 별도 함수(`extractMcpIds`)로 분리 |
| 6 | Maintainability | `buildPickerSubmissionValue` 반환 타입이 `unknown`으로 너무 넓음 — 소비 지점에서 컴파일러가 타입 불일치를 감지 불가 | `assistant-message.tsx:buildPickerSubmissionValue` 반환 타입 | `string \| string[] \| McpServerRef[]` 로 명시적 타입 선언 |
| 7 | Documentation | plan 문서 TODO 체크박스 미갱신 — backend/frontend 구현·테스트가 완료됐음에도 모든 `[ ]` 미체크 상태. CLAUDE.md 규약("작업이 끝나면 결과에 맞춰 갱신") 위반 | `plan/in-progress/ai-assistant-pending-config-mcp-multi.md` | 완료 항목을 `[x]`로 갱신, `TEST WORKFLOW`·`REVIEW WORKFLOW`·`plan/complete 이동`만 `[ ]` 유지 |
| 8 | Documentation | `candidate-lookup.service.spec.ts` 모듈 주석의 widget 수 불일치 — "4 widget"이라고 고정되어 있으나 실제로는 `mcp-server-selector` 추가로 5개. `system-prompt.spec.ts`에서는 "4가지 → 5가지"를 정확히 수정했는데 이 파일만 누락 | `candidate-lookup.service.spec.ts` 상단 docstring | `"본 spec 은 4 widget"` → `"본 spec 은 5 widget"` |
| 9 | API Contract | `CandidatePicker.onConfirm` prop 시그니처 breaking change — `(selectedId: string) => void` → `(selection: CandidatePickerSubmission) => void`. 현재 유일 소비자인 `assistant-message.tsx`는 업데이트됨. TypeScript 컴파일이 미래 소비자 불일치를 잡아주므로 실질 위험은 낮음 | `candidate-picker.tsx` (CandidatePickerProps interface) | 변경 이력 JSDoc 또는 컴포넌트 레벨 주석으로 breaking change 명시 |
| 10 | Documentation | plan 문서의 로컬 경로 참조 (`~/.claude/plans/ai-sleepy-garden.md`) — 팀원/CI 환경에서 접근 불가한 경로로 이력 추적 링크가 끊어져 있음 | `plan/in-progress/ai-assistant-pending-config-mcp-multi.md` 2번 라인 | 로컬 경로 참조 제거 또는 핵심 context를 plan 문서에 인라인으로 기술 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database / Performance | `lookupMcpServers`(및 기존 메서드들)의 이중 상한 적용 — `query.limit = MAX_CANDIDATES`(DB 레벨) + `.slice(0, MAX_CANDIDATES)` 중복. 불필요한 메모리 할당이나 기존 패턴과 일관성이 있음 | `candidate-lookup.service.ts:lookupMcpServers` | `IntegrationsService.findAll`이 limit을 준수한다면 slice 제거. 방어 코드라면 주석으로 의도 명시 |
| 2 | Database | `integrations` 테이블에 `(workspace_id, status, service_type)` 복합 인덱스 미확인 — MCP 타입 통합 사용 증가 시 풀스캔 위험 | `candidate-lookup.service.ts:lookupMcpServers` | 마이그레이션 파일에서 해당 복합 인덱스 존재 여부 확인, 없다면 추가 마이그레이션 권장 |
| 3 | Performance | `selectedIds.includes(id)` O(n) 탐색이 체크박스 렌더 루프 안에서 반복 — 현재 상한 20×20=400회로 무해하나, 상한 완화 시 O(n²) 열화 | `candidate-picker.tsx` multi-select 렌더 분기 | `useMemo(() => new Set(selectedIds), [selectedIds])`로 캐싱 후 `Set.has()` O(1) 활용 |
| 4 | Dependency | `UserActionWidget` union이 backend/frontend 양쪽에 중복 선언 — 이번 PR에서 양쪽이 정확히 동기화됨. 향후 widget 추가 시 두 파일 동시 수정 필수라는 암묵적 계약이 미문서화 | `detect-pending-user-config.ts` / `frontend/src/lib/api/assistant.ts` | 코드 주석에 "두 파일 동시 수정 필수" 경고 한 줄 추가. 장기적으로 공유 패키지 또는 OpenAPI auto-generate 검토 |
| 5 | Dependency | `CandidatePickerSubmission` 타입이 컴포넌트 파일에 정의되어 `assistant-message.tsx`가 import — picker → parent 콜백 계약이므로 `assistant.ts`(API 타입 SSOT)에 두는 편이 일관성이 높음 | `candidate-picker.tsx` export type, `assistant-message.tsx` import | `CandidatePickerSubmission`을 `assistant.ts`로 이동 후 re-import (선택적 개선) |
| 6 | Security | `workspaceId` 권한 검증이 호출자 계층에 위임 — `mcp-server-selector` 분기 추가로 새 조회 경로가 생겼으므로 컨트롤러의 워크스페이스 멤버십 가드가 이 경로를 커버하는지 재확인 권장 | `candidate-lookup.service.ts:fillCandidates` | 통합 테스트 또는 코드 추적으로 NestJS Guard가 `workspaceId`를 검증된 값으로 주입하는지 명시적 확인 |
| 7 | Security | `mcp` 서비스 타입이 `SUPPORTED_INTEGRATION_SERVICE_TYPES` 화이트리스트 밖에 있음 — 의도된 설계이나 향후 유지보수자가 화이트리스트에 `mcp`를 추가하면 중복/충돌 발생 가능 | `detect-pending-user-config.ts:SUPPORTED_INTEGRATION_SERVICE_TYPES` | "mcp는 별도 전용 경로(`lookupMcpServers`)를 사용하므로 의도적으로 제외" 주석 추가 |
| 8 | Security | `extractSelectedIds`의 ID 포맷 미검증 — `integrationId` 값의 UUID 형식을 확인하지 않음. 서버 제공 후보 목록에서만 선택되므로 실제 공격 경로는 제한적 | `candidate-picker.tsx:extractSelectedIds` | 필요 시 UUID 정규식 검사 또는 Zod 스키마 검증 레이어 추가 (낮은 우선순위) |
| 9 | Architecture | 새 widget 추가 시 6곳 이상 수동 수정 필요 (OCP 한계) — 현재 5개 widget에서는 허용 범위이나 계속 증가 시 누락 실수 가능성 | 백엔드 `USER_ACTION_WIDGETS`, `MULTI_SELECT_WIDGETS`, switch case / 프론트엔드 `UserActionWidget`, `SETTINGS_HREF`, `buildPickerSubmissionValue` | 단기: 현 구조 유지. 장기: widget descriptor registry 패턴으로 전환 검토 |
| 10 | Concurrency | `confirmed=false` 복귀 시(`Undo/Redo`) `selectedIds` 미초기화 — 동시성 버그는 아니나 Undo 후 체크박스가 이전 선택 상태를 기억하는 UX 불일치 | `candidate-picker.tsx:useEffect` | Undo 복귀 시 초기화가 필요하다면 `useEffect`에 `setSelectedIds([])`·`setSelectedId("")` 추가 |
| 11 | Testing | `error-degradation` 테스트 블록에 `mcp-server-selector` 명시적 케이스 없음 — 공유 try-catch 경로이므로 동작은 동일하나 명시적 케이스가 미래 회귀 안전망이 됨 | `candidate-lookup.service.spec.ts:error degradation describe` | 기존 패턴으로 widget만 `mcp-server-selector`로 교체한 케이스 1개 추가 |
| 12 | Documentation | `buildPickerSubmissionValue` fallback 주석에 "새 multi widget 추가 시 `MULTI_SELECT_WIDGETS`(backend)와 이 함수를 동시에 갱신해야 한다"는 계약 요건 미언급 | `assistant-message.tsx` fallback 주석 | 1문장 주석 추가 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **MEDIUM** | `assistant-message.test.ts` 누락, MCP rehydrate·fallback 분기 미테스트 |
| Security | LOW | `workspaceId` 가드 커버리지 재확인 권장, `mcp` 화이트리스트 주석 누락 |
| Performance | LOW | `slice` 중복 적용, `includes` O(n) 탐색 (상한 20개로 실영향 없음) |
| Architecture | LOW | `extractSelectedIds` 도메인 지식 노출, widget 추가 시 6곳 수정 분산 |
| Maintainability | LOW | `buildPickerSubmissionValue` unknown 반환 타입, multi 판정 로직 3곳 산재 |
| API Contract | LOW | MCP 기본값 단일 출처 부재, `onConfirm` breaking change 주석 누락 |
| Side Effect | LOW | MCP ServerRef 기본값 하드코딩, shared fixture 변경으로 기존 테스트 의미 변화 |
| Requirement | LOW | plan 문서 미갱신, `assistant-message.test.ts` 미제출, MCP 기본값 검증 불가 |
| Documentation | LOW | spec 파일 widget 수 불일치(4→5), plan 문서 TODO 미갱신·로컬 경로 참조 |
| Database | LOW | 이중 slice 중복, 복합 인덱스 존재 여부 미확인 |
| Dependency | LOW | MCP 기본값 공유 상수 미추출, `UserActionWidget` 양단 중복 |
| Concurrency | LOW | `confirmed` 복귀 시 `selectedIds` 미초기화 UX 불일치 |
| Scope | LOW | plan TODO 미체크, `buildPickerSubmissionValue` export 여부 |

---

## 발견 없는 에이전트

없음 — 전 에이전트에서 최소 1건 이상 발견사항이 보고됨.

---

## 권장 조치사항

1. **[즉시]** `assistant-message.test.ts` 작성 — single / kb-selector multi / mcp-server-selector multi / fallback 4개 케이스 추가 (CRITICAL, plan 요구사항)
2. **[즉시]** plan 문서 TODO 체크박스 갱신 — 완료 항목 `[x]` 처리 후 `TEST WORKFLOW`·`REVIEW WORKFLOW` 완료 시 `git mv plan/complete/`로 이동
3. **[단기]** MCP ServerRef 기본값 공유 상수 추출 — `buildPickerSubmissionValue`와 settings panel이 동일 상수를 참조하도록 단일 출처 확보
4. **[단기]** `buildPickerSubmissionValue` 반환 타입을 `string | string[] | McpServerRef[]`로 구체화
5. **[단기]** `candidate-picker.test.tsx`에 MCP rehydrate 케이스 및 체크박스 전체 해제 케이스 추가
6. **[단기]** `candidate-lookup.service.spec.ts` 모듈 주석 "4 widget" → "5 widget" 수정
7. **[선택]** `extractSelectedIds`의 MCP shape 처리를 별도 함수로 분리하여 presentation 레이어 도메인 지식 제거
8. **[선택]** `SUPPORTED_INTEGRATION_SERVICE_TYPES` 옆에 `mcp` 의도적 제외 주석 추가, `buildPickerSubmissionValue` fallback 주석에 동시 수정 필수 안내 추가