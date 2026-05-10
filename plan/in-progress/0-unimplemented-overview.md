# 미구현 항목 오버뷰 (PRD/Spec 기준)

> 작성일: 2026-05-11
> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것

본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.

---

## 작업 흐름 권장 순서

다음 순서로 plan을 소화하면 의존성 충돌이 적다.

1. **`prd-spec-sync.md`** — 실제 구현이 끝났는데 PRD/Spec이 ❌·🚧로 남아있는 항목부터 정합화한다 (그래야 이후 plan의 baseline이 정확해진다).
2. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
3. **`logic-node-followups.md`** — Loop breakCondition, If/Else operator, Variable meta 등 Logic 노드의 잔여 P0/P1 항목을 한 PR 단위로 묶는다.
4. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
5. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
6. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
7. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
8. **`2fa-webauthn.md`** — WebAuthn 2FA.
9. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
10. **`llm-provider-followups.md`** — Azure OpenAI 스트리밍, Local LLM 검증.
11. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
12. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).

> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.

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
| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | 🚧 P1 미구현 | `logic-node-followups.md` |
| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | 🚧 P1 silent fall-through | `logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | 🚧 P0 미구현 | `logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod `meta.declaredVariables` / `meta.modifications`** | 🚧 P1 미구현 | `logic-node-followups.md` |
| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant | `logic-node-followups.md` |
| **Spec 4-nodes/1-logic/12-background 모니터링 API** | ❌ 미구현 (`meta.backgroundRunId` 키만 발급) | `background-monitoring-api.md` |
| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 미구현 (future PRD) | `replay-rerun.md` |
| **PRD 1 §3.11 NAV-UP-05 미가입자 초대 토큰** | 🚧 후속 (가입 사용자 추가만 ✅) | `team-workspace-followups.md` |
| **PRD 1 §3.1 NAV-WF-07 공유 워크플로우 표시** | 🚧 백엔드만 존재, UI 미노출 | `team-workspace-followups.md` |
| **PRD 5 NF-SC-10 2FA WebAuthn** | 🚧 TOTP만 ✅, WebAuthn 후속 | `2fa-webauthn.md` |

### B. 인프라/배포 (셀프 호스팅)

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |

### C. LLM Provider 확장

| Spec 항목 | 상태 | 처리 plan |
|-----------|------|-----------|
| **Spec 3-workflow-editor/4 §27 Azure OpenAI 스트리밍** | 🚧 v1 제외, 후속 작업 | `llm-provider-followups.md` |
| **Spec 5-system/7 §LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 OpenAI 호환 자동 지원 가능, MVP 범위 밖 | `llm-provider-followups.md` |

### D. 접근성

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |

### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝)

| 항목 | 코드 상태 | PRD/Spec 표기 | 처리 plan |
|------|-----------|---------------|-----------|
| **PRD 9 Graph RAG 전체 (KB-GR-MD/EX/DM/SR/PA/UI/OB-*)** | ✅ backend P0~P2까지 구현 (`backend/src/modules/knowledge-base/graph/*`, frontend `entity-list.tsx` / `relation-list.tsx` / `graph-3d-renderer.tsx`, V025~V027 마이그레이션) | ❌ 로드맵 | `prd-spec-sync.md` |
| **PRD 5 NF-OB-05 알림 평가 cron** | ✅ `AlertsEvaluatorService`가 BullMQ `*/5 * * * *` repeatable로 활성 | 🚧 주기 평가 cron 후속 | `prd-spec-sync.md` |
| **PRD 7 EH-NAV-04 AI Assistant 실행 read-only 도구** | 🚧 검증 필요 — `workflow-assistant/tools/explore-tools.service.ts`, `tool-definitions.ts`에 키워드 존재 | ❌ | `prd-spec-sync.md` (검증 후 분기) |
| **Spec 5-system/4-execution-engine §3.3 Background "🚧 spec-only"** | ✅ 평면 구현(ND-BG-05 대안)으로 ✅ | 🚧 미구현 표기 잔존 | `prd-spec-sync.md` |
| **Spec 1-data-model.md / 3-workflow-editor/0-canvas.md / 2-edge.md Background 컨테이너 표기** | (대안 구현으로 컨테이너 미적용 결정) | 🚧 미구현 표기가 의미 혼동 야기 | `prd-spec-sync.md` |

---

## plan 문서 목록

```
plan/in-progress/
├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
├── prd-spec-sync.md                   ← Graph RAG·Alert cron·Background spec 등 정합화
├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
├── logic-node-followups.md            ← Loop break / If-Else op / meta 필드 / Merge timeout
├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
├── replay-rerun.md                    ← Re-run 재실행 기능 도입
├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
├── llm-provider-followups.md          ← Azure OpenAI / Local LLM 스트리밍
├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK
```

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
- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG PRD 단계 — 코드 구현은 ✅, PRD 표기 갱신은 본 plan의 `prd-spec-sync.md`에서 처리)
