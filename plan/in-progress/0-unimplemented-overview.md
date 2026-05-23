# 미구현 항목 오버뷰 (Spec 기준)

> 작성일: 2026-05-11
> 최근 갱신: 2026-05-18 (in-progress 정리에 따른 plan 목록 동기화)
> 출처: `spec/0-overview.md` §6.2~§6.3, 각 spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
> 검증 일자 기준: 2026-05-18. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것

본 문서는 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.

---

## 작업 흐름 권장 순서

다음 순서로 plan을 소화하면 의존성 충돌이 적다.

1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
3. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
4. **`2fa-webauthn-followups.md`** — WebAuthn 2FA 후속 (10개 항목: requiresTotp 제거, e2e, 모듈 분리 등). 본 PR 인 `2fa-webauthn.md` 는 ✅ 완료되어 `plan/complete/` 로 이동됨.
5. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
6. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).

## 하네스·프로세스 개선 (2026-05-23 신규)

`plan/in-progress/spec-harness-impl-coverage.md` (spec PR) 가 5개 결정 (A frontmatter / B reverse-evidence / C-1 plan-stale audit / C-2 /spec-coverage / D partial-impl discipline) 을 정의했고, 후속 5건 plan 으로 단계적 실행. 텔레그램 chat-channel UI 영구 누락 사례 (2026-05-23 발견) 의 재발 방지가 목적.

| 순서 | plan | 결정 | 의존 |
|---|---|---|---|
| 1 | `developer-partial-impl-discipline.md` | D | spec PR 머지 후 (병렬 가능) |
| 2 | `spec-frontmatter-rollout.md` | A | spec PR + `ai-presentation-tools` + `ai-agent-tool-connection-rewrite` 의존 |
| 3 | `user-guide-reverse-coverage.md` | B | spec PR 머지 후 (병렬 가능) |
| 4 | `plan-stale-audit.md` | C-1 | ✅ complete (2026-05-23) |
| 5 | `spec-coverage-slash-command.md` | C-2 | 2 완료 후 (spec frontmatter 의존) |

> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.

### 최근 완료

- ✅ **`20260516-full-review/`** (2026-05-16~18, `plan/complete/20260516-full-review/`) — 전체 코드베이스 audit 13 reviewer × 154 issue. RESOLUTION.md 의 처리 완료 표 (Critical 7건 + Warning 15건 + 후속 ai-review F-A~F-G) 반영, 의사결정 보류 항목은 본 인덱스의 각 plan 으로 흡수.
- ✅ **`agent-session-restore-on-rejoin.md`** (2026-05-17, `plan/complete/`) — 페이지 재진입 시 AI Agent 대화 메시지 복원 (frontend hydration 분기 보완).
- ✅ **`ai-agent-multiturn-waiting-persist.md`** (2026-05-17, `plan/complete/`) — AI Agent multi-turn 후속 turn 의 `NodeExecution.outputData` DB 영속 보강 (REST snapshot 경로 복원 가능).
- ✅ **`background-monitoring-api.md`** (2026-05-15, `plan/complete/background-monitoring-api.md`) — `GET /api/executions/:executionId/background-runs/:backgroundRunId` + cursor 페이지네이션 페이로드.
- ✅ **`accessibility-voiceover-validation.md`** (2026-05-12) — macOS VoiceOver 수동 체크리스트 완료. NF-A11Y-03 만족.
- ✅ **`team-workspace-followups.md`** (2026-05-12) — NAV-WF-07 공유 워크플로우 표시 ✅, NAV-UP-05 미가입자 초대 토큰 ✅.
- ✅ **`prd-spec-sync.md`** (2026-05-11) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 정합화.
- ✅ **`logic-node-followups.md`** (2026-05-11) — D1~D7 정리. Merge P2 만 별도 plan (`merge-p2-async-fanin.md`) 으로 분리.
- ✅ **`llm-provider-followups.md`** (2026-05-11) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅.

---

## 카테고리별 미구현 항목 매핑

### A. 제품 기능 (사용자 가치 큰 기능)

| PRD/Spec 항목 | 상태 | 처리 plan |
|---------------|------|-----------|
| **PRD 1 §3.9 NAV-MP-01~07 Marketplace** | ❌ 전체 미구현 (i18n 사전에만 등장) | `marketplace-and-plugin-sdk.md` |
| **PRD 4 §4 MP-CT/CS/PB-***| ❌ 전체 미구현 | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §10 ND-EX-01~03 노드 확장성 SDK** | ❌ 우선순위 3 | `marketplace-and-plugin-sdk.md` |
| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ | `marketplace-and-plugin-sdk.md` |
| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §6.1 ND-AG-06/10/21 AI Agent 도구 연결** | 🚧 의도적 제거, 재작성 예정 | `ai-agent-tool-connection-rewrite.md` |
| **PRD 3 §4.9 ND-PL-03 Parallel 결과 합산 / 중첩 Parallel / waitAll=false** | 🚧 P2 예정 | `parallel-p2.md` |
| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 PR1 (spec) ✅ / PR2 (구현) 대기 | `replay-rerun.md` |
| **PRD 5 NF-SC-10 2FA WebAuthn** | ✅ TOTP + WebAuthn (Passkey) 모두 ✅. 잔존 follow-up 10건 | `2fa-webauthn-followups.md` (본 작업은 `plan/complete/2fa-webauthn.md`) |

> Logic 카테고리 (Loop breakCondition / If-Else `is_type`·`regex` / If-Else·Switch `meta.matchedConditions` / Variable Decl·Mod meta) 및 Background 모니터링 API, NAV-UP-05·NAV-WF-07 는 모두 ✅ 완료 — 본 표에서 제거. 상세는 위 `### 최근 완료` 또는 `plan/complete/{logic-node-followups,background-monitoring-api,team-workspace-followups}.md` 참고.

### B. 인프라/배포 (셀프 호스팅)

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |

### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:

| Spec 항목 | 처리 결과 |
|-----------|-----------|
| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |

### D. 접근성 — ✅ 완료 (2026-05-12)

| PRD 항목 | 처리 결과 |
|----------|-----------|
| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | ✅ 수동 체크리스트 완료 (`plan/complete/accessibility-voiceover-validation.md`). 자동화 + 수동 검증 모두 충족. |

### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:

| 항목 | 처리 결과 |
|------|-----------|
| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
| **사용자 매뉴얼** | `codebase/frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |

---

## plan 문서 목록

```
plan/in-progress/                          # 2026-05-18 정리 후
├── 0-unimplemented-overview.md           ← 본 문서 (인덱스)
│
│  ── 큰 미구현 덩어리 (Spec 기준)
├── ai-agent-tool-connection-rewrite.md   ← AI Agent 일반 도구 연결 재설계 (디자인 결정 대기)
├── merge-p2-async-fanin.md               ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
├── parallel-p2.md                        ← 중첩 Parallel·waitAll=false·errorPolicy 노출
├── replay-rerun.md                       ← Re-run 재실행 (PR1 ✅ spec / PR2 ⏳ 구현)
├── 2fa-webauthn-followups.md             ← WebAuthn 2FA 후속 묶음 (본 작업 `plan/complete/2fa-webauthn.md` 완료 후)
├── self-hosting-deployment.md            ← Docker Compose 풀 번들·Helm·운영 가이드
├── marketplace-and-plugin-sdk.md         ← 마켓플레이스 전체 + 노드 플러그인 SDK
│
│  ── follow-up · 정합화 묶음
├── cafe24-backlog-residual.md            ← cafe24 누적 백로그 잔여
├── cafe24-restricted-scopes-followups.md ← cafe24-restricted-scopes PR 후속 3건 (allowlist UI / invalid_scope / privacy_* rename) 통합
├── cafe24-test-spec-guard-cleanup-followups.md ← cafe24-test-spec-guard PR ai-review 분리 cleanup
├── harness-i18n-userguide-gap.md         ← i18n / 유저 가이드 누락 방지 하네스 (P0 ✅ / P1+ ⏳)
├── notification-websocket-name-sync.md   ← Notification WebSocket 이벤트명·채널명 정합
├── node-output-redesign/                 ← (별도 디렉토리 — 본 정리 대상 제외)
└── spec-overview-followups-2026-05-18.md ← spec/0-overview.md 및 CLAUDE.md 정합 후속 4건 통합

plan/complete/  (최근만)
├── 20260516-full-review/                 ← 전체 코드베이스 audit (2026-05-16~18)
├── agent-session-restore-on-rejoin.md   ← AI Agent 재진입 메시지 복원 (2026-05-17)
├── ai-agent-multiturn-waiting-persist.md ← multi-turn outputData 영속 (2026-05-17)
├── background-monitoring-api.md         ← meta.backgroundRunId 모니터링 API (2026-05-15)
├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 검증 (2026-05-12)
├── team-workspace-followups.md          ← 공유 워크플로우 + 미가입자 초대 토큰 (2026-05-12)
├── prd-spec-sync.md                     ← spec ↔ 코드 정합 정리 (2026-05-11)
├── llm-provider-followups.md            ← LLM Provider 확장 (2026-05-11)
└── logic-node-followups.md              ← Logic 노드 잔여 P0/P1 (2026-05-11)
```

> 본 인덱스는 spec 기준의 큰 미구현 덩어리를 추적하고, 그 외 follow-up 묶음 plan 도 함께 가시화한다. `node-output-redesign/` 은 별도 디렉토리이며 본 인덱스의 관리 범위 밖.

각 plan 문서는 다음 구조를 따른다:

- **배경** — PRD/Spec의 어떤 항목이 미구현인지, 현 코드 상태
- **관련 문서** — PRD·Spec·메모리·기존 plan 링크
- **작업 단위** — 체크박스 todo 목록 (SDD: spec → 테스트 → 구현 순서)
- **수용 기준** — Definition of Done
- **의존성·리스크** — 다른 plan, 외부 시스템 영향

---

## 참고: 이미 완료되어 본 plan에 포함되지 않은 영역

- `plan/complete/feature-roadmap/stages.md` Stage 1~11 (LLM 토큰 추적 / Parallel P1 / Background 평면 구현 / 팀 워크스페이스 UI / RBAC / 2FA TOTP / 조직 Integration 공유 / OTel 트레이싱 / 알림 룰 CRUD / 접근성 자동화 / 매뉴얼 검색)
- `plan/complete/node-architecture/*` (handler colocation, schema audit, sub-workflow execution 등)
- `plan/complete/workflow-assistant/*` (Workflow AI Assistant 본체)
- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG — 코드 ✅, 표기 정합화는 `prd-spec-sync.md` 에서 처리)
- 전체 audit 산출물: `plan/complete/20260516-full-review/` — Critical/Warning 처리 분량은 RESOLUTION.md, 의사결정 보류 분량은 위 in-progress plan 으로 흡수
