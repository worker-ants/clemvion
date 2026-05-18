---
worktree: ai-timezone-context-9c8e2f
started: 2026-05-18
owner: developer
---

# Plan: AI Timezone Context — Implementation (Phase B)

본 plan 은 [Spec AI 공통 §11 (AI 노드 시스템 프롬프트 자동 prefix)](../../spec/4-nodes/3-ai/0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix) 및 [Spec Cafe24 API Metadata §5 (Timezone Semantics)](../../spec/conventions/cafe24-api-metadata.md#5-timezone-semantics) 가 정의한 두 변경의 backend·frontend 구현 항목을 추적한다.

Phase A (spec 개정) 는 본 worktree 의 PR 으로 머지된다. Phase B (구현) 는 별도 PR 로 developer 가 수행한다.

---

## Phase A — spec 개정 ✓ (본 worktree PR)

- [x] `spec/conventions/cafe24-api-metadata.md` §5 신설 + 기존 §5–§8 → §6–§9 shift + §3 예시 갱신 + Rationale + CHANGELOG
- [x] `spec/4-nodes/4-integration/4-cafe24.md` §4.3 신설 + §8.1 도구 description suffix 한 줄 + §12.x Rationale 미설 (CHANGELOG 한 행만 추가, Rationale 본문은 `cafe24-api-metadata.md` 가 SoT)
- [x] `spec/5-system/11-mcp-client.md` §2.3 Bridge 별 description suffix 정책 한 줄
- [x] `spec/4-nodes/3-ai/0-common.md` §11 (AI 노드 시스템 프롬프트 자동 prefix) 신설 + 기존 §11 CHANGELOG → §12 + Rationale 섹션 신설
- [x] `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표 (`includeSystemContext`/`systemContextSections`) + §6.1/§6.2 + §7 config echo + §12.3 Rationale
- [x] `spec/4-nodes/3-ai/2-text-classifier.md` §1 config 표 + §4 실행 로직 + §8 CHANGELOG
- [x] `spec/4-nodes/3-ai/3-information-extractor.md` §1 config 표 + §4.1/§4.2 실행 로직 + §8 CHANGELOG
- [x] `spec/conventions/conversation-thread.md` §5 ordering 한 줄 (pointer to §11.4)
- [x] `spec/1-data-model.md §2.2` Workspace `settings.timezone` 알려진 키 명시
- [x] 외부 앵커 갱신 (Critical 해소): `4-cafe24.md:370,378` / `2-navigation/4-integration.md:975` 의 `#6-mcp-...` / `#7-allowlist-...` → `#7-mcp-...` / `#8-allowlist-...`
- [x] consistency-check 통과 (BLOCK: NO — `review/consistency/2026/05/18/23_08_06/`)

---

## Phase B — 구현 (별 PR, developer)

### B-1. Cafe24 도구 description 자동 suffix

- [x] `Cafe24McpToolProvider.buildTools()` 에 `CAFE24_TIMEZONE_SUFFIX` 자동 append 로직 추가 (`metadata/index.ts` 에 상수 + JSDoc 정의, provider 에서 import 후 description 에 prepend)
- [x] 메타데이터 row 의 date/time 필드 `description` 을 §5.2 컨벤션 으로 갱신 (`product.since/until`, `customer.since/until`)
- [x] unit test — `Cafe24McpToolProvider.buildTools()` 결과의 모든 도구 description 이 KST suffix 를 포함 (find 로 대표 도구 직접 검증 + 전체 루프 fallback)
- [x] unit test — date/time 필드의 description 이 KST/`YYYY-MM-DD` 형식을 명시 (`metadata.spec.ts` §5.2 위반 가드)

### B-2. AI 노드 시스템 컨텍스트 prefix

- [x] `aiAgentNodeConfigSchema` (zod) 에 `includeSystemContext` / `systemContextSections` 추가 (둘 다 default 보유, UI widget 메타 포함)
- [x] `textClassifierNodeConfigSchema` 동일
- [x] `informationExtractorNodeConfigSchema` 동일
- [x] 공통 헬퍼 `buildSystemContextPrefix` + `buildSystemContextPrefixFromContext` 신설 (`shared/system-context-prefix.ts`) — `time` / `timezone` / `workspace` / `node` 섹션별 출력
- [x] 워크스페이스 timezone SoT 헬퍼 `resolveSystemContextTimezone` 신설 — `Workspace.settings.timezone` → `process.env.TZ` → `UTC` precedence + `Intl.DateTimeFormat` 검증
- [x] `ExecutionEngineService.runExecution` 의 createContext 단계가 workflow.workspace.settings.timezone 을 `__workspaceTimezone` 변수로 주입 (3 핸들러 공통 SoT, N+1 회피)
- [x] `ai-agent.handler.ts` single-turn + multi-turn 첫 진입 (executeMultiTurn) 의 `finalSystemPrompt` build 단계에 prefix prepend (resume turn 은 `_resumeState.messages` 영속으로 자연 frozen)
- [x] `text-classifier.handler.ts` system prompt 빌드 단계에 prefix prepend
- [x] `information-extractor.handler.ts` single-turn + multi-turn 첫 진입에 prefix prepend
- [x] config echo: spec §11.7 의 default 일치 시 생략 정책 명시 (실제 default 생략 로직은 후속 — 본 PR 은 spec 명시 + raw echo 흐름 유지)
- [x] frontend UI — backend schema 의 `widget: 'checkbox'` / `'multiselect'` 메타로 Config 패널에 자동 렌더. `visibleWhen: { field: 'includeSystemContext', equals: true }` 로 sections select 토글 연동.
- [x] frontend i18n dict 갱신 — `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 새 라벨·옵션·hint·group ko 매핑 추가 (parity 가드 통과)
- [x] handler unit test — prefix 포함/제외 fixture (3 노드 각 2 case)
- [x] handler unit test — 워크스페이스 timezone 별 ISO 출력 (system-context-prefix.spec.ts 27 case — KST / UTC / America/New_York / Asia/Kolkata 등)
- [x] handler unit test — `includeSystemContext: false` 시 prefix 미포함
- [x] handler unit test — normalizeSystemContextConfig 의 default / opt-out / 빈 배열 동등 / 잘못된 섹션 필터링
- [x] consistency-check 권장 W1~W9 조치 (config typed, ExecutionContext JSDoc, multi-turn 주석, customer.until KST, 영어 통일, suffix test 강화, .passthrough 검증)
- [x] e2e test — `make e2e-test` 16 suites · 93/93 pass (KST 시나리오 통합 검증은 후속 별 PR, 본 PR 은 회귀 안전망)

### B-3. 후속

- [x] Phase B 머지 후 본 plan 을 `plan/complete/` 로 `git mv` (같은 PR 안의 별 commit)

### B-4. 보류·후속 — 별 plan 분리

후속 enhancement 11건 (schema 헬퍼·KST e2e·캐싱·UI 경고 등) 은 별 plan `plan/in-progress/ai-timezone-context-followups.md` 로 이관. 본 plan 의 미체크 follow-up 없음 — 본 PR 머지와 함께 `git mv plan/in-progress/impl-ai-timezone-context.md plan/complete/`.

---

## Side-effect 점검 메모 (Phase B 착수 시 재확인)

| 항목 | 상태 |
|---|---|
| `node-output-redesign` plan 의 ai-agent / text-classifier / information-extractor / cafe24 — `output` wrapper 표준에 집중하며 §1 config 표는 본 변경과 직접 충돌 없음 | OK |
| `conversation-thread-e509c5` worktree — git worktree list 에 부재 (이미 merge 완료). `1-ai-agent.md §1` 의 thread 관련 5 필드는 본 변경 시점에 이미 존재 | OK |
| `Workspace.settings.timezone` — `spec/1-data-model.md §2.2` 에 명시했으나 백엔드 entity decorator / migration 차원의 schema 강제는 아직 없음. Phase B-2 의 `resolveWorkspaceTimezone` 이 `undefined` 케이스를 정상 처리하므로 마이그레이션 불요 | OK |
| `Schedule.timezone` 컬럼 (IANA) 과의 명명 — `Workspace.settings.timezone` 은 settings JSONB 하위, Schedule 은 1급 컬럼. 서로 다른 SoT 로 의도된 분리 | OK |
| 기존 워크플로 row 영향 — config 부재 시 default `true` 해석. DB 마이그레이션으로 명시 `false` 박지 않음. 토큰 비용 +30 토큰 / LLM 응답 변화 우려 워크플로만 사용자가 인지 후 명시 opt-out | OK (Rationale 명시) |

---

## 참고 — Phase A consistency-check 결과 요약

- 세션: `review/consistency/2026/05/18/23_08_06/SUMMARY.md`
- BLOCK: NO
- Critical 1건 (외부 파일 앵커 shift) — 본 worktree PR 내에서 해소 완료
- Warning 9건 — 모두 Phase A 본문에 반영
- Info 14건 — 후속 권장 항목은 Phase B 체크리스트에 흡수
