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

- [ ] `Cafe24McpBridge.listTools()` (또는 `operationToMcpTool`) 에 `CAFE24_TIMEZONE_SUFFIX` 자동 append 로직 추가
- [ ] 메타데이터 row 의 date/time 필드 `description` 을 §5.2 컨벤션 (`'ISO8601 datetime (KST, UTC+9) — ...'`) 으로 일괄 갱신
  - 영향 row: `product_list.since`, `order_list.start_date`/`end_date`, `customer_list.start_date`/`end_date`, `community_*.start_date`/`end_date`, salesreport, mileage 의 시각 필터 등 (~20–30 row 추정 — 백엔드 메타데이터 grep 으로 정확한 명단 확정)
- [ ] unit test — `Cafe24McpBridge.listTools()` 결과의 모든 도구 description 이 KST suffix 를 포함하는지
- [ ] unit test — date/time 필드의 description 이 `'ISO8601 date'` 단독으로 끝나지 않는지 (§5.2 위반 검출)

### B-2. AI 노드 시스템 컨텍스트 prefix

- [ ] `aiAgentNodeConfigSchema` (zod) 에 `includeSystemContext` / `systemContextSections` 추가 (둘 다 optional, default 가 backend 측 fallback)
- [ ] `textClassifierNodeConfigSchema` 동일
- [ ] `informationExtractorNodeConfigSchema` 동일
- [ ] 공통 헬퍼 `buildSystemContextPrefix(context, config)` 신설 — `time` / `timezone` / `workspace` / `node` 섹션별 출력 생성
- [ ] 워크스페이스 timezone SoT 헬퍼 `resolveWorkspaceTimezone(context)` 신설 — `Workspace.settings.timezone` → `process.env.TZ` → `UTC` precedence + `Intl.DateTimeFormat` 검증
- [ ] `ai-agent.handler.ts:806` 부근 `finalSystemPrompt` build 단계에 prefix prepend (Single Turn / Multi Turn 첫 턴 / multi-turn resume — 3 경로 모두)
- [ ] `text-classifier.handler.ts` system prompt 빌드 단계에 prefix prepend
- [ ] `information-extractor.handler.ts` 의 `buildMultiTurnSystemPrompt` / single-turn system prompt 빌드에 prefix prepend
- [ ] config echo: 새 필드 두 개가 default 와 일치하면 echo 생략, 변경된 값이면 echo (`output.config`)
- [ ] frontend UI — Config 패널에 "System Context" 토글 + 섹션 multi-select. `includeSystemContext: false` 면 섹션 select disabled (3 노드 공통 패턴)
- [ ] handler unit test — prefix 포함/제외/섹션별 출력 fixture (3 노드)
- [ ] handler unit test — 워크스페이스 timezone 별 ISO 출력 (KST / UTC / Asia/Tokyo 등)
- [ ] handler unit test — `includeSystemContext: false` 시 prefix 미포함
- [ ] handler unit test — config echo 의 default 생략 동작
- [ ] e2e test — KST 워크스페이스에서 AI Agent 의 systemPrompt 가 `+09:00` ISO 와 `Asia/Seoul (UTC+9)` 라인을 포함하는지

### B-3. 후속

- [ ] Phase B-1·B-2 모두 머지 후 본 plan 을 `plan/complete/` 로 `git mv` (같은 PR 안의 별 commit)

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
