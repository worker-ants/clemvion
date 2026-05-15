# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `kb-selector` 확인 시 `string[]` 필드에 `string`을 주입하는 기능 버그가 포함되어 있으며, 레거시 메시지 렌더 시 런타임 크래시 위험과 `evaluateReviewGuard`의 핫패스 N×M DB 쿼리 문제가 동반됨

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 / 타입 | `kb-selector` 확인 시 `knowledgeBaseIds: string[]` 필드에 `string` 단일값 주입 → AI Agent 노드 실행 오류 | `assistant-message.tsx` `onConfirm` 콜백, `editor-store.ts updateNodeConfigField` | `field.widget === 'kb-selector'`이면 `[selectedId]`로 감싸거나, `CandidatePicker`에 `valueTransform` prop 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 / 런타임 | 레거시 DB 메시지의 `candidates` 필드 부재 시 `field.candidates.length`에서 `TypeError` 크래시 — 채팅 히스토리 rehydrate 시 패널 전체 파괴 | `candidate-picker.tsx:80`, `collectPickerEntries` | `const candidates = field.candidates ?? []` 방어 또는 `collectPickerEntries`에서 `Array.isArray` 체크 후 항목 제외 |
| 2 | 성능 / 데이터베이스 | `evaluateReviewGuard`가 매 `finish`마다 모든 노드에 대해 N×M 병렬 DB 쿼리 실행 (노드 30개×selector 3개 = 최대 90 쿼리/round, self-review 반복 시 누적) | `workflow-assistant-stream.service.ts:1301–1320` | `collectPendingUserConfig`(sync, 스키마만 검사)로 pending 노드 먼저 추린 뒤 그 노드에만 `fillCandidates` 호출; 또는 동일 widget 타입 배치 조회 |
| 3 | 부작용 / 신뢰성 | DB 장애 시 `candidates: []` degrade → `review-workflow.ts` 필터가 "리소스 없음"으로 오해석 → LLM이 실제 존재하는 리소스가 없다는 잘못된 안내 유도 | `candidate-lookup.service.ts:85–97`, `review-workflow.ts:659–666` | `candidates: null`(조회 실패) / `candidates: []`(실제 없음) / `candidates: [...]`(있음) 3-state 도입, 또는 warn 로그에 "리뷰 가드 오발동 가능" 명시 |
| 4 | 보안 | `integrationServiceType`이 런타임 검증 없이 DB `serviceType` 필터로 직결 — 커스텀 노드 지원 시 임의 값 노출 가능 | `candidate-lookup.service.ts lookupIntegrations()`, `detect-pending-user-config.ts` | `ALLOWED_SERVICE_TYPES = new Set(['email', 'http', 'database'])` 화이트리스트 검증, 또는 literal union 타입 강제 |
| 5 | 보안 | `settingsHref`가 검증 없이 `<a href>`에 삽입 — `javascript:` URI 또는 외부 절대 URL을 막지 않아 Open Redirect/XSS 잠재 진입점 | `candidate-picker.tsx ~100` | `settingsHref?.startsWith('/') ? settingsHref : undefined` guard 추가 |
| 6 | 보안 | `fieldPath`를 동적 키로 사용하는 객체 스프레드 — SSE 스트림에 런타임 검증 없는 타입 캐스팅만 존재, `__proto__` 전달 시 Prototype Pollution 위험 | `editor-store.ts updateNodeConfigField ~480` | `['__proto__', 'constructor', 'prototype'].includes(fieldPath)` 이면 early return |
| 7 | 보안 | Candidate ID·Name이 LLM 대화 히스토리에 영속화 — LLM 지시 일탈 시 실제 리소스 ID가 다음 tool 인자로 재사용될 수 있음 (Prompt Injection) | `workflow-assistant-stream.service.ts collectPendingUserConfigWithCandidates`, `evaluateReviewGuard` | 히스토리 저장 전 `candidates` 필드 제거(또는 `candidateCount`만 보존), SSE 렌더용과 LLM 피드백용 분리 |
| 8 | 의존성 | `IntegrationsModule`, `KnowledgeBaseModule` 신규 임포트 시 순환 의존성 여부 diff에서 미검증 | `workflow-assistant.module.ts:35–38` | `madge --circular` 또는 `nest build` 출력으로 순환 참조 없음 확인; 순환 발생 시 `forwardRef()` 또는 Repository 직접 주입으로 분리 |
| 9 | 의존성 | `IntegrationsService`, `KnowledgeBaseService`의 `exports` 선언 미검증 — 런타임 DI 오류 가능 | `workflow-assistant.module.ts`, 각 모듈 파일 | 각 모듈 `exports` 배열에 해당 서비스 포함 여부 명시적 확인 |
| 10 | 요구사항 / UX | Rehydrate 상태에서 `confirmed=true`이나 `selectedId=""`이므로 `candidates.find`가 `undefined` → fallback `currentValue`(raw ID)가 그대로 표시됨 | `candidate-picker.tsx:80–85` | fallback을 `candidates.find(c => c.id === selectedId \|\| c.id === currentValue)?.label ?? currentValue`로 수정 |
| 11 | 요구사항 | `update_node` tool 인자에서 nodeId를 `call.arguments?.id`로 읽는데, 실제 스키마 키와 불일치 시 picker가 조용히 렌더되지 않음 | `assistant-message.tsx:290–294 collectPickerEntries` | `update_node` 스키마 실제 필드명 확인 후 상수화, 또는 `call.arguments?.nodeId ?? call.arguments?.id` 방어적 처리 |
| 12 | 테스트 | `updateNodeConfigField`(undo 연동), `collectPickerEntries`/`CandidatePickers` 조합 로직, 레거시 `candidates` 미존재 경로, async `evaluateReviewGuard` 통합 경로 — 4개 갭 미테스트 | `editor-store.ts`, `assistant-message.tsx`, `review-workflow.spec.ts`, `workflow-assistant-stream.service.spec.ts` | 각 gap에 대한 단위/통합 테스트 추가 (상세 제안은 Testing 리뷰 참조) |
| 13 | 동시성 | `Promise.all` 콜백 내 외부 `Map`을 직접 `.set()` 변형 — 현재 단일 스레드라 안전하나 Worker Thread 전환 시 즉시 race condition | `workflow-assistant-stream.service.ts evaluateReviewGuard pendingByNode.set` | `Promise.all`이 `[nodeId, pending] as const` 쌍 반환 → `new Map(entries)`로 불변 생성 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수 | `collectPendingUserConfig` / `collectPendingUserConfigWithCandidates` 이름 분화로 호출 경로 파악 어려움 | `workflow-assistant-stream.service.ts:1228–1260` | 책임 명확한 이름 재정의(`collectPending` / `fillCandidates`)또는 내부 문서에 경로별 차이 기술 |
| 2 | 유지보수 / 성능 | DB `limit: MAX_CANDIDATES` 설정 후 `result.data.slice(0, MAX_CANDIDATES)` 이중 적용 | `candidate-lookup.service.ts lookupIntegrations/LlmConfigs/KnowledgeBases/Workflows` | DB limit이 보장되면 slice 제거, 불확실하면 방어 의도 주석 명시 |
| 3 | 유지보수 | `CandidatePickers`가 전체 `nodes` 배열 구독 — 무관한 노드 변경(드래그 등)마다 리렌더 유발, 내부 `find`가 O(N) 반복 | `assistant-message.tsx:238` | 필요한 nodeId만 선택적 구독, `useMemo`로 `Map<id, node>` 생성 후 O(1) 조회 |
| 4 | 유지보수 | `confirmed` state가 `currentValue` 외부 변경에 반응하지 않아 이중 진실 공급원 발생 | `candidate-picker.tsx:57–60` | `useEffect`로 `currentValue` 변화 감지하거나 `confirmed`를 derived state로 분리 |
| 5 | 유지보수 | `SETTINGS_HREF` widget→경로 매핑이 `assistant-message.tsx`에 인라인 정의 — widget 증가 시 변경 범위 확대 | `assistant-message.tsx:22–28` | `candidate-picker.config.ts` 분리, 또는 `candidate-picker.tsx`로 이동 |
| 6 | 유지보수 | `AssistantToolCallRecord.result` 타입이 `unknown`이어서 `as` 캐스팅 패턴이 컴포넌트·테스트에 중복 | `assistant-message.tsx:262–284` | `result` 타입을 discriminated union 또는 `NodeEditResult`로 좁혀 캐스트 제거 |
| 7 | 아키텍처 | `integrationServiceType` 같은 widget별 힌트가 공통 인터페이스에 누적되는 패턴 — 향후 인터페이스 오염 위험 | `detect-pending-user-config.ts`, `frontend/src/lib/api/assistant.ts` | 장기적으로 discriminated union(`type: 'integration-selector'; integrationServiceType: string`) 또는 `hint?: Record<string, unknown>` open slot |
| 8 | 아키텍처 | `PendingUserConfigField` 등 3개 타입이 프론트/백엔드에 이중 정의 — drift 위험 | `detect-pending-user-config.ts` vs `frontend/src/lib/api/assistant.ts` | 중기적으로 `packages/shared-types` 또는 OpenAPI 자동 생성 도입 |
| 9 | 의존성 | `LlmConfigService.findAll` 반환 타입 `Record<string, unknown>` — 컴파일 타임 감지 불가 변경 | `candidate-lookup.service.ts:110–130` | `LlmConfigService`에 구체적 반환 타입 추가 |
| 10 | 의존성 | `ExploreToolsService.listWorkflows` 반환 타입 `unknown` — 소비자 레이어에 런타임 narrowing 강제 | `candidate-lookup.service.ts:169–188` | `{ ok: boolean; items: WorkflowSummary[] }` 반환 타입 정의로 헬퍼 불필요화 |
| 11 | 요구사항 | `fillCandidates` 빈 배열 단락 시 원본 참조 반환 — JSDoc "항상 새 배열" 명세와 불일치 | `candidate-lookup.service.ts:58` | `return []`로 통일하거나 JSDoc에 예외 명시 |
| 12 | 테스트 | 복수 widget 동시 조회(`integration-selector + llm-config-selector`) 시나리오 미테스트 | `candidate-lookup.service.spec.ts` | pending 2건 시나리오로 배열 길이 및 각 `candidates` 매핑 검증 케이스 추가 |
| 13 | 문서화 | 3개 노드 스키마 `integrationServiceType` 주석 상세도 불일치(`send-email`만 3줄, 나머지 1줄) | `database-query.schema.ts`, `http-request.schema.ts`, `send-email.schema.ts` | `send-email`의 3줄 패턴으로 통일 |
| 14 | 부작용 | `workflow-selector` `SETTINGS_HREF`가 `/workflows`(목록)로 지정 — 다른 widget의 `/settings/*` 경로와 맥락 불일치 | `assistant-message.tsx:22` | `/settings/workflows` 등으로 통일하거나 문구를 "목록으로 이동"으로 일반화 |
| 15 | API 계약 | legacy row 처리 조건(`!Array.isArray(f.candidates)`)에 제거 시점 TODO 주석 없음 | `review-workflow.ts:656–677` | `// TODO(ED-AI-39): remove once all legacy rows are backfilled` 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | **HIGH** | `kb-selector` string[] 타입 불일치 버그, rehydrate raw ID 노출, `update_node` 인자 키 가정 |
| Security | **MEDIUM** | `integrationServiceType` 미검증 필터, prototype pollution 가능성, candidate ID LLM 히스토리 영속화 |
| Performance | **MEDIUM** | `evaluateReviewGuard` 핫패스 N×M DB 쿼리, `CandidatePickers` 전체 nodes 구독 |
| Database | **MEDIUM** | 동일 widget 타입 중복 병렬 쿼리, 복합 인덱스 존재 미확인 |
| Testing | **MEDIUM** | `updateNodeConfigField`, `collectPickerEntries`, legacy candidates path, async guard 통합 경로 4개 gap |
| Side Effect | **MEDIUM** | 레거시 `candidates` 미존재 크래시, DB 장애 시 리뷰 가드 오발동, Undo와 picker confirmed 불일치 |
| API Contract | **LOW** | silent degrade UI 혼동, `integrationServiceType` untyped string |
| Concurrency | **LOW** | `Promise.all` 내 Map 변형 패턴, 중첩 `Promise.all` DB 커넥션 burst |
| Architecture | **LOW** | `evaluateReviewGuard` O(N) DB 조회, widget별 hint 인터페이스 오염 패턴 |
| Dependency | **LOW** | 모듈 순환 의존성·exports 미검증, 약한 서비스 간 타입 계약 |
| Maintainability | **LOW** | 메서드 이름 분화, 이중 진실 공급원, `as` 캐스트 중복 |
| Documentation | **LOW** | 노드 스키마 주석 불일치, spec 절 번호 표기 불일치 |
| Scope | **NONE** | 범위 위반 없음 |

---

## 발견 없는 에이전트

- **Scope** — 20개 파일 전체가 ED-AI-39 스펙 경계 안에 있으며 의도와 무관한 수정 없음

---

## 권장 조치사항

1. **[즉시] `kb-selector` 타입 불일치 수정** — `onConfirm`에서 `widget === 'kb-selector'`이면 `[selectedId]`로 감싸 `knowledgeBaseIds: string[]`에 올바른 배열 주입
2. **[즉시] 레거시 `candidates` 미존재 방어** — `CandidatePicker`에 `const candidates = field.candidates ?? []` 추가, 배포된 구 메시지 rehydrate 크래시 방지
3. **[배포 전] `evaluateReviewGuard` DB 쿼리 최적화** — `collectPendingUserConfig`(sync)로 pending 노드 먼저 추린 뒤 그 노드에만 `fillCandidates` 호출, 불필요한 DB burst 차단
4. **[배포 전] 모듈 의존성 검증** — `IntegrationsModule`, `KnowledgeBaseModule`의 순환 참조 및 `exports` 선언 확인(`madge --circular` 또는 빌드 출력)
5. **[단기] 보안 3종 처리** — `integrationServiceType` 화이트리스트 검증, `settingsHref` `/` 시작 guard, `fieldPath` prototype 키 차단
6. **[단기] Rehydrate raw ID 노출 수정** — `candidates.find(c => c.id === selectedId || c.id === currentValue)?.label ?? currentValue` fallback 로직
7. **[단기] 누락 테스트 추가** — `updateNodeConfigField`(undo 연동), `collectPickerEntries` 분기, legacy `candidates` 미존재 fixture, async guard 통합 경로
8. **[중기] DB 장애 degrade 개선** — `candidates: null`(조회 실패) 3-state 도입으로 review guard 오발동 방지
9. **[중기] `integrationServiceType` 타입 강화** — `'email' | 'http' | 'database'` literal union 공통 파일 정의 및 양 단에 적용
10. **[중기] Candidate ID LLM 히스토리 제거** — 히스토리 저장 전 `candidates` 필드 strip 또는 `candidateCount`만 보존