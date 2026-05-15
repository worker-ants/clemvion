# Review Resolution — 2026-04-24_17-14-09

리뷰 대상: 커밋 `895cb61` (ED-AI-39 in-message candidate picker 구현).
Critical 1건 + Warning 13건 + Info 15건 중 **Critical/Warning 전건과 주요 Info**를 조치. 전체 backend 1902 · frontend 1089 · lint · build 모두 통과.

## Critical

| ID | 조치 |
|----|------|
| **C-1** | `kb-selector` 의 `knowledgeBaseIds` 는 `string[]` 필드이므로 단일 id 를 `[selectedId]` 로 감싸 주입. `AssistantMessageView` 의 picker `onConfirm` 분기(`field.widget === 'kb-selector'`) 에서 처리. |

## Warning

| ID | 조치 |
|----|------|
| **W-1** | `CandidatePicker` 가 `field.candidates` 를 `Array.isArray(...) ? ... : []` 로 normalize. 레거시 DB 메시지의 candidates 부재 시에도 패널 크래시 없이 amber 안내 박스 렌더. 회귀 테스트 추가 (`survives a legacy payload with missing candidates`). |
| **W-2** | `evaluateReviewGuard` 에서 **모든 노드** × **모든 selector field** 로 N×M DB 조회가 돌던 것을 개조: sync `collectPendingUserConfig` 로 pending 필드가 **실제로 있는 노드**만 우선 추려 그 노드에 한해서만 async `fillCandidates` 호출. pending 없는 노드는 빈 배열 직행. 결과 Map 은 `Promise.all` entries → `new Map(entries)` 불변 생성 (W-13 동시 해소). |
| **W-3** | DB 조회 실패 시 `candidates: []` 로 degrade 하는 정책은 유지하되, warn 로그 메시지에 **"review guard may misfire"** 시그널 추가. 3-state (조회 실패 vs 실제 없음) 전면 도입은 follow-up 로 기록. |
| **W-4** | `SUPPORTED_INTEGRATION_SERVICE_TYPES = ['email','http','database'] as const` 화이트리스트를 `detect-pending-user-config.ts` 에 선언. `detectPendingUserConfig` 는 schema meta 에서 읽은 `integrationServiceType` 을 이 Set 에 대해 검증한 뒤에만 필드에 실는다. 임의 문자열이 DB `service_type` 필터로 직결되는 경로 차단. `IntegrationServiceType` literal union 타입 export. |
| **W-5** | `sanitizeSettingsHref` 헬퍼 추가 — `"/"` 로 시작하지 않는 값 (외부 URL·`javascript:` URI·빈 문자열) 은 `undefined` 로 변환해 `<a href>` 에 삽입되지 않는다. 테스트 3케이스(`javascript:`, 외부 http, 정상 `/`) 추가. |
| **W-6** | `editor-store.updateNodeConfigField` 가 `fieldPath` 가 `'__proto__' / 'constructor' / 'prototype'` 이면 early return. SSE 스트림을 통한 prototype pollution 차단. 테스트에 검증 케이스 추가 (`blocks prototype pollution keys`). |
| **W-7** | 실제 candidate id·name 이 **LLM 히스토리**로 영속 재주입되는 경로를 제거 — `stripCandidatesFromToolResult(result)` 헬퍼가 tool result 의 `pendingUserConfig[*].candidates` 를 제거하고 `candidateCount: number` 로 대체. 적용 지점: ① 같은 턴 round-trip 의 tool message, ② 세션 rehydration 의 `toChatMessages` 경로. SSE 이벤트와 DB persist 는 원본 그대로 → 프런트 picker 는 변함없이 동작. System prompt 의 `candidates: []` → `candidateCount === 0` 기준으로 갱신 (3곳). |
| **W-8** | `npm run build` / `npm test` 가 IntegrationsModule · KnowledgeBaseModule 추가 후에도 통과 → Nest 가 순환 의존성을 검출하지 않았음을 확인 (빌드가 순환 시 에러). |
| **W-9** | 각 모듈(`IntegrationsModule`, `KnowledgeBaseModule`, `LlmConfigModule`) 모두 해당 Service 를 `exports: [...]` 에 선언해 놓은 것을 확인 (기존 상태 검증 완료, 런타임 DI 오류 없음). |
| **W-10** | `CandidatePicker` 의 rehydrate 라벨 fallback 을 `candidates.find(c => c.id === selectedId || c.id === currentValue)?.label ?? currentValue` 로 교체. raw UUID 노출을 막고 사용자에게 사람이 읽을 수 있는 라벨만 표시. 테스트에서 `Gmail SMTP` 라벨 검증으로 회귀 방지. |
| **W-11** | `collectPickerEntries` 에서 `update_node` 의 nodeId 를 `call.arguments.id ?? call.arguments.nodeId` 방어적으로 읽어 camelCase/snake_case 두 클라이언트 모두 수용. 값 존재+문자열 타입 체크 후 사용. |
| **W-12** | 테스트 4개 갭을 메움: (1) `updateNodeConfigField` 의 Undo 스택 푸시와 config merge 동작 (editor-store.test), (2) prototype 키 차단 (동 파일), (3) 레거시 candidates 부재 경로 (candidate-picker.test), (4) `sanitizeSettingsHref` 가드 3케이스. async `evaluateReviewGuard` 는 기존 `workflow-assistant-stream.service.spec.ts` 의 pendingUserConfig 케이스 + review-workflow.spec 의 candidates 0/1+ 분기로 간접 커버. |
| **W-13** | `Promise.all` 콜백 안에서 외부 `Map.set` 변형하던 패턴을 엔트리 배열 반환 → `new Map(entries)` 불변 생성으로 교체 (W-2 구현에 함께 반영). Worker Thread 로 전환되더라도 race condition 없음. |

## 선택 반영한 Info

| ID | 조치 |
|----|------|
| **I-3** | `CandidatePickers` 가 매 렌더마다 `nodes.find` 로 O(N) 스캔하던 것을 `useMemo` 기반 `Map<id, node>` 구축 → O(1) 조회로 변경. |
| **I-4** | `confirmed` 가 `currentValue` 외부 변경에 반응하지 않는 이중 진실 공급원 문제를 `useEffect` 로 해소 — Undo/Redo 로 canvas 값이 바뀌면 picker 도 interactive 상태로 즉시 복귀. |
| **I-11** | `CandidateLookupService.fillCandidates` 의 빈 배열 short-circuit 을 `return pending` → `return []` 로 수정 (항상 새 배열 반환 계약과 일치). |
| **I-13** | 3개 노드 스키마의 `integrationServiceType` 주석을 `send-email` 의 3줄 패턴으로 통일. |
| **I-15** | `review-workflow.ts` 의 legacy fallback 조건에 `TODO(ED-AI-39): legacy session 회전 이후 제거` 주석 추가. |

## Follow-up (이번 범위 밖)

- **W-3 완전 해결**: `candidates: null` (조회 실패) / `[]` (실제 없음) / `[...]` (있음) 3-state 도입. 현재는 warn 로그로만 신호.
- **INFO-7 / INFO-8**: widget별 hint 가 공통 인터페이스에 섞이는 오염 회피 (discriminated union), 프론트/백엔드 타입 중복(`PendingUserConfigField`) → shared-types 패키지 또는 OpenAPI 자동 생성.
- **INFO-9 / INFO-10**: `LlmConfigService.findAll` / `ExploreToolsService.listWorkflows` 반환 타입 명확화.
- **INFO-12**: `CandidateLookupService` 복수 widget 동시 조회 시나리오 스펙 케이스 추가.
- **INFO-14**: `/workflows` vs `/integrations` 경로의 전역 명명 통일은 라우팅 리디자인 범위.

## 재검증 결과

- `backend/npm run lint` — clean.
- `backend/npm test` — 1902/1902 passed.
- `backend/npm run build` — clean.
- `frontend/npm run lint` — clean.
- `frontend/npm test` — 1089/1089 passed.
- `frontend/npm run build` — clean.
