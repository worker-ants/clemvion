# Plan 정합성 Check Payload

본 파일은 orchestrator 가 Plan 정합성 checker 용으로 작성한 입력입니다. `plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Plan 정합성)

1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)

## 검토 모드
구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/4-integration/4-cafe24.md

작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.

원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.

수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.

영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.)

## Target 문서
경로: `spec/4-nodes/4-integration/4-cafe24.md

작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.

원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.

수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.

영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.`

```
### 구현 대상 영역: `spec/4-nodes/4-integration/4-cafe24.md

작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.

원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.

수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.

영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.`
(없음)

```

## 진행 중 plan 문서 모음 (plan/in-progress/)

### plan/in-progress 진행 중 문서

#### `plan/in-progress/0-unimplemented-overview.md`
```
# 미구현 항목 오버뷰 (PRD/Spec 기준)

> 작성일: 2026-05-11
> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것

본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.

---

## 작업 흐름 권장 순서

다음 순서로 plan을 소화하면 의존성 충돌이 적다.

1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
3. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
4. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
5. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
6. **`2fa-webauthn.md`** — WebAuthn 2FA.
7. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
8. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
9. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).

> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.

### 최근 완료

- ✅ **`prd-spec-sync.md`** (2026-05-11, `plan/complete/prd-spec-sync.md`) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 (knowledge-base.mdx 한·영) 정합화.
- ✅ **`logic-node-followups.md`** (2026-05-11, `plan/complete/logic-node-followups.md`) — D1 If/Else `is_type`/`regex` evaluator 통합 ✅, D2 Loop breakCondition + meta.exitReason ✅, D3 Merge P2 → 별도 plan (`merge-p2-async-fanin.md`) 분리 ✅, D4 Switch `meta.value` alias 제거 + 마이그레이션 ✅, D5 Variable Modification recordValues opt-in + 마스킹 유틸 ✅, D6 보류 ✅, D7 case id reserved word 검증 ✅. spec/4-nodes/1-logic 의 P0/P1 미구현 표기 모두 정리 (Merge dormant 표기는 별도 plan 분리에 따른 의도적 잔존).
- ✅ **`llm-provider-followups.md`** (2026-05-11, `plan/complete/llm-provider-followups.md`) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅. `AzureOpenAIClient`·`LocalClient` 가 `OpenAIClient.stream()` 을 상속하여 자동 지원. spec 2종(7-llm-client.md §8.2, 4-ai-assistant.md §1.2/§11/§13/§15) 🚧·❌→✅, PRD 0 §6.1, 매뉴얼 4종(llm-config.mdx 한·영 + overview.mdx 한·영) 정합화.

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
| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | ✅ 활성화 (D2, meta.exitReason 추가) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | ✅ 구현 (D1, evaluator 통합) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | ✅ 핸들러 구현 + spec 정합 (PR-1) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod meta** | ✅ 핸들러 구현 + recordValues opt-in (D5) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
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

### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:

| Spec 항목 | 처리 결과 |
|-----------|-----------|
| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |

### D. 접근성

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |

### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:

| 항목 | 처리 결과 |
|------|-----------|
| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
| **사용자 매뉴얼** | `frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |

---

## plan 문서 목록

```
plan/in-progress/
├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
├── merge-p2-async-fanin.md            ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
├── replay-rerun.md                    ← Re-run 재실행 기능 도입
├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK

plan/complete/
├── prd-spec-sync.md                   ← §E "PRD/Spec ↔ 코드 정합성 정리" 완료 (2026-05-11)
├── llm-provider-followups.md          ← §C "LLM Provider 확장" 완료 (2026-05-11)
└── logic-node-followups.md            ← Logic 노드 잔여 P0/P1 (D1·D2·D4·D5·D7) 완료, D3 → merge-p2-async-fanin.md 분리 (2026-05-11)
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

```

#### `plan/in-progress/2fa-webauthn.md`
```
# 2FA WebAuthn 추가

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/06-2fa.md` (TOTP + 복구 코드 ✅)

## 배경

PRD 5 §2 NF-SC-10:

> **NF-SC-10** 2FA(Two-Factor Authentication) 지원 — 권장 — ✅ (TOTP + 복구 코드 10개. WebAuthn은 후속)

TOTP 인증 + 복구 코드는 ✅. WebAuthn (Passkey / 보안 키 등) 은 후속 작업으로 남아 있음.

## 관련 문서

- `prd/5-non-functional.md` §2 NF-SC-10
- `spec/5-system/1-auth.md` (인증 / 2FA 흐름)
- `spec/2-navigation/9-user-profile.md` (보안 설정 화면)
- `plan/complete/feature-roadmap/06-2fa.md` (TOTP 구현 history)
- 코드: `backend/src/modules/auth/two-factor*/`, `frontend/src/app/(main)/profile/security/`

## 작업 단위

### 1. 디자인 결정

- [ ] WebAuthn 라이브러리 선택 — `@simplewebauthn/server` + `@simplewebauthn/browser` 가 표준. 사용자 합의 필요
- [ ] **rpID / origin** — SaaS 도메인 vs. 셀프 호스팅 도메인 모두 지원해야 하므로 환경변수로 분리
- [ ] **사용자 흐름** — TOTP 만 / WebAuthn 만 / 둘 다 등록한 경우의 로그인 시 인증 옵션 우선순위
- [ ] **Passkey 다중 등록** — 사용자당 N개 인증기 등록 허용 (모바일 + 데스크톱 + 보안 키)
- [ ] **복구 코드** — TOTP 와 동일하게 별도 복구 코드 발급 vs. 공통 복구 코드 사용

### 2. 데이터 모델 / 마이그레이션

- [ ] `WebAuthnCredential` 엔티티 — `user_id`, `credential_id` (base64url), `public_key`, `counter`, `transports`, `device_name?`, `last_used_at?`, `created_at`
- [ ] 마이그레이션 추가

### 3. 백엔드 구현 (TDD)

- [ ] 등록 흐름: `POST /api/v1/auth/2fa/webauthn/register/options` → challenge 생성 + 세션 저장 → 클라이언트가 `navigator.credentials.create()` → `POST /api/v1/auth/2fa/webauthn/register/verify` → credential 저장
- [ ] 인증 흐름: 로그인 후 2FA 단계에서 `POST /api/v1/auth/2fa/webauthn/authenticate/options` → 클라이언트 `navigator.credentials.get()` → `POST /api/v1/auth/2fa/webauthn/authenticate/verify` → JWT 발급
- [ ] credential 관리 — 목록 조회 / 이름 수정 / 삭제 API
- [ ] counter 검증 (replay 방어) + 단위 테스트
- [ ] 통합 테스트 (등록 / 인증 / counter mismatch / 복구 코드 fallback)

### 4. 프론트엔드 구현 (TDD)

- [ ] 보안 설정 페이지에 "Passkey / 보안 키" 섹션 추가 — 등록 / 목록 / 이름 변경 / 삭제 UI
- [ ] 로그인 후 2FA 단계 — TOTP / Passkey 선택 UI (사용자가 등록한 인증기에 따라)
- [ ] 브라우저 호환성 안내 (Safari, Chrome, Firefox 의 WebAuthn 지원 차이)
- [ ] i18n (ko/en)
- [ ] 단위 테스트 + e2e (Playwright Virtual Authenticator 활용)

### 5. spec / PRD 갱신

- [ ] `prd/5-non-functional.md` §2 NF-SC-10 상태 — TOTP + WebAuthn 모두 ✅
- [ ] `spec/5-system/1-auth.md` 에 WebAuthn 흐름 추가
- [ ] `spec/2-navigation/9-user-profile.md` 보안 섹션 갱신

### 6. 매뉴얼

- [ ] `frontend/src/content/docs/` 보안 가이드에 Passkey 등록·사용법 추가

### 7. REVIEW

- [ ] `ai-review` 실행 → Security 중심 (counter 검증, replay 방어, rpID 정합성, 복구 코드 fallback)

## 수용 기준

- 사용자가 Passkey/보안 키를 등록·관리·삭제 가능
- 로그인 시 TOTP 또는 Passkey 중 선택해 2FA 통과 가능
- counter 검증·복구 코드 fallback 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: TOTP 2FA 가 이미 ✅이므로 동일 모듈 확장
- **리스크**:
  - 셀프 호스팅 환경에서 rpID/origin 설정 실수 시 등록·인증 모두 실패 — 환경변수 검증 필수
  - 모바일 Safari 의 Passkey 흐름 차이 — 충분한 e2e/수동 검증 필요

```

#### `plan/in-progress/ai-agent-tool-connection-rewrite.md`
```
# AI Agent 일반 도구 연결 재설계

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: [`plan/complete/ai-agent-tool-connection-rewrite.md`](../complete/ai-agent-tool-connection-rewrite.md) (이전 제거 작업의 사유·복원 절차)

## 배경

PRD 3 §6.1 / PRD 6 §3.2 의 다음 요구사항이 **의도적으로 제거된 상태**다:

- ND-AG-06 — Tool/Function 호출 지원 (다른 노드를 도구로 연결)
- ND-AG-10 — Tool Area를 통한 도구 연결 (캔버스 드래그 앤 드롭)
- ND-AG-21 — 조건과 일반 도구 동시 호출 시 일반 도구 우선 실행

config 스키마에서 `toolNodeIds` / `toolOverrides` 필드와, 캔버스의 AI Agent 우측 점선 Tool Area UX가 모두 제거됐다. 조건 도구(`cond_*`) / KB 도구(`kb_*`) / MCP 도구(`mcp_*`) 는 영향 없고 정상 동작한다.

이 plan은 새 도구 연결 디자인을 결정하고 위 PRD 항목을 다시 활성화하는 작업이다.

## 관련 문서

- 제거 결정 사유 + 복원 절차: `plan/complete/ai-agent-tool-connection-rewrite.md`
- PRD: `prd/3-node-system.md` §6.1 ND-AG-06/10/21, `prd/6-phase2-ai.md` §3.2 동일 ID
- Spec (현재 비활성 박스): `spec/4-nodes/3-ai/1-ai-agent.md` §1 / §Tool Area 박스
- Spec 캔버스 (재작성 예정 박스): `spec/3-workflow-editor/0-canvas.md` §AI Agent Tool Area
- 영향 받지 않는 정상 도구: 조건(`cond_*`), KB (`kb_*`), MCP (`mcp_*`) — `backend/src/nodes/ai/ai-agent/tool-providers/{kb-tool-provider,mcp-tool-provider}.ts`

## 작업 단위

### 1. 디자인 결정 (사용자 합의 필요)

본 단계는 **사용자와의 대화로만** 진행한다. SDD/TDD 시작 전 결정해야 할 항목:

- [ ] **도구 등록 모델** — 다음 세 가지 중 어떤 모델을 채택할지 결정
  - (a) Tool Area 부활 — 캔버스에서 AI Agent 노드 옆 점선 박스로 다른 노드를 드래그해 도구로 등록
  - (b) Tool Area 폐기 → 설정 패널에서 "도구로 사용할 노드 ID 목록"을 select 위젯으로 선택
  - (c) 별도 "AI Tool" 노드 타입 신설 — AI Agent 출력 포트 외에 dedicated tool 포트로 연결, 도구 시그니처(name/description/parameters)를 노드 자체 config에 두어 AI Agent의 config는 `toolNodeIds`만 가짐
- [ ] **도구 시그니처 정의 위치** — 도구 노드 자체 (호출되는 측) vs. AI Agent (호출하는 측). 워크플로 작성자가 도구 사양을 한 곳에서만 관리하도록 결정
- [ ] **도구 호출 시 실행 컨텍스트** — 일반 워크플로 진행과 별개의 sub-execution으로 보낼지, 같은 execution 내 inline으로 처리할지. AI Agent multi-turn 도중 도구 노드가 form/buttons/ai_conversation 같은 블로킹 노드를 포함하면 어떻게 다룰지 결정
- [ ] **도구 결과 라우팅** — 도구 노드의 출력은 LLM 컨텍스트에만 들어가는지, 일반 다운스트림 노드로도 흐르는지
- [ ] **ND-AG-21 우선순위 규칙 재확인** — 일반 도구 우선 실행 → LLM 재평가 → 조건 도구 결정 흐름이 새 설계에서도 유지되는지

> 위 결정 사항은 plan을 진행할 사용자가 답한 후, 이 체크박스를 ✅ 처리하고 결정 내용을 본 plan §결정 기록 절에 추가한다.

### 2. PRD 갱신

- [ ] 결정에 따라 `prd/3-node-system.md` §6.1 ND-AG-06/10/21 본문 업데이트 + "재작성 예정" 표기 제거
- [ ] `prd/6-phase2-ai.md` §3.2 ND-AG-06/10/21 동일 갱신
- [ ] PRD 2 §10.4 ED-AI-19 등 AI Assistant 의 편집 도구 거부 정책에 영향 있는지 확인

### 3. Spec 작성

- [ ] `spec/4-nodes/3-ai/1-ai-agent.md` 의 "재작성 예정" 박스 제거 + 새 도구 연결 모델 명세
  - config 스키마: 새 필드 정의 (`toolNodeIds` 부활인지, 새 모델인지)
  - 도구 이름 규칙: `tool_*` 접두사 부활 또는 변경
  - 도구 description 파생 규칙
  - ToolOverride 구조 (필요 시)
  - 도구 호출 결과의 `output.result.*` 위치
- [ ] `spec/3-workflow-editor/0-canvas.md` Tool Area 시각·인터랙션 재작성 (만약 결정 (a)면)
- [ ] `spec/3-workflow-editor/4-ai-assistant.md` — Workflow AI Assistant가 새 도구 연결 모델을 인식·편집할 수 있는지 정합화 (특히 `add_node` / `update_node` 응답의 dynamic-ports 모델)

### 4. 백엔드 구현 (TDD)

- [ ] `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` config 스키마에 새 필드 복원 + Zod 검증 + 테스트
- [ ] `backend/src/nodes/ai/ai-agent/tool-providers/` 에 일반 노드 도구 provider 구현 (`node-tool-provider.ts` 등) + 단위 테스트
- [ ] `ai-agent.handler.ts` — 도구 호출 시 sub-execution / inline 호출 (결정 사항 따라) + 부분 실패 격리 + diagnostics 누적
- [ ] 조건 도구와 일반 도구 동시 호출 시 ND-AG-21 우선순위 규칙 적용 (테스트로 회귀 잠금)
- [ ] `TOOL_EXECUTION_FAILED` 에러 코드 복원 (`spec/4-nodes/3-ai/1-ai-agent.md` §6 에 이미 placeholder)

### 5. 프론트엔드 구현 (TDD)

- [ ] AI Agent 설정 패널에 도구 등록 UI (a/b/c 결정 따라)
- [ ] 캔버스 렌더 (a 선택 시 Tool Area 점선 박스 부활, b 선택 시 패널만)
- [ ] 도구 호출 시 LLM 타임라인에 tool-call 카드 표시 (이미 KB·MCP·조건 도구는 표시됨 — 일반 도구도 동일 패턴 재사용)

### 6. Migration / Rollout

- [ ] 기존 워크플로의 AI Agent config가 새 스키마에 그대로 호환되는지 확인. 호환 안 되면 `backend/scripts/` 에 마이그레이션 스크립트 추가 + dry-run / apply 흐름

### 7. 매뉴얼 업데이트

- [ ] `frontend/src/content/docs/02-nodes/ai.mdx` (또는 해당 페이지) — 도구 연결 사용법 추가
- [ ] `frontend/src/content/docs/03-workflow-editor/walkthrough.mdx` — Tool Area / 도구 등록 흐름 walkthrough 갱신

### 8. REVIEW

- [ ] `ai-review` 스킬 실행 (Architecture / Side Effect / API Contract / Concurrency 중심)
- [ ] Critical / Warning 이슈 해소 → `review/<timestamp>/RESOLUTION.md` 작성

## 수용 기준

- ND-AG-06 / ND-AG-10 / ND-AG-21 가 PRD에서 ✅ 표기로 활성화
- 새 도구 연결 모델이 spec에 명시되고 코드에 반영
- 회귀 테스트: 조건 도구·KB 도구·MCP 도구는 동일하게 동작
- ai-review Critical/Warning 0
- Workflow AI Assistant 가 새 모델을 인식해 `add_edge` 의 도구 포트를 안전하게 채울 수 있음

## 의존성·리스크

- **의존**: `prd-spec-sync.md` 의 spec 정리가 끝난 baseline에서 시작하면 깔끔
- **순서 의존성**: `conversation-thread.md` (worktree: `conversation-thread-e509c5`) 가 `spec/4-nodes/3-ai/1-ai-agent.md §1` 표를 먼저 개정 — 본 plan 의 §3 spec 작성은 그 merge 이후 착수해야 신규 5필드(`contextScope`/`contextScopeN`/`contextInjectionMode`/`includeToolTurns`/`excludeFromConversationThread`) 와 DEPRECATED 마커(`conversationHistory`/`historyCount`) 위치를 일관되게 다룰 수 있다.
- **conversation-thread 와의 정책 의존**: 일반 `tool_*` 도구 결과의 ConversationThread 누적 정책은 `conversation-thread.md` v2 에서 결정된다 — 본 plan 활성화 시 `tool_*` 결과를 `ai_tool` source 로 push 할지(현재 KB/MCP 와 동일하게 `includeToolTurns` 게이트 적용) 별도 `tool_call` source 신설할지 확정 필요.
- **리스크**:
  - 결정 (c) "AI Tool 노드 신설" 시 노드 카탈로그·플러그인 인터페이스 변경 영향이 marketplace plan(`marketplace-and-plugin-sdk.md`) 까지 번질 수 있음
  - multi-turn 도중 도구 호출 → blocking 노드(form/buttons) 진입 시 AI Agent 의 `_resumeState` 관리 복잡도 증가
  - 기존 `tool_*` 접두사를 다시 사용할 경우 LLM 프롬프트 호환성 (이전 conversation history) 검증 필요

## 결정 기록

(사용자 답변 후 채워질 자리)

- 도구 등록 모델: TBD
- 도구 시그니처 위치: TBD
- 도구 호출 실행 컨텍스트: TBD
- 도구 결과 라우팅: TBD
- ND-AG-21 우선순위 유지 여부: TBD

```

#### `plan/in-progress/ai-review-subagent.md`
```
---
worktree: ai-review-subagent-b7c8d9
started: 2026-05-15
owner: developer
---

# AI-Review / Consistency-Check — `claude -p` 제거 + Sub-agent 위임

## Context

요금제 정책 변경으로 `subprocess.run(["claude", "-p", ...])` 와
`anthropic.Anthropic().messages.create(...)` 두 model 호출 경로가 모두 사용
불가가 되었다. 현재 `/ai-review` (`code-review-agents`) 와
`/consistency-check` (`consistency-checker`) 의 model 호출이 모두 `claude -p`
이므로 (`lib/agent_runner.py:34`, `lib/summary.py:46`,
`consistency_orchestrator.py:32`) 파이프라인 전체를 sub-agent 위임으로 전환한다.

남는 유일한 model 호출 경로는 **main Claude (현재 session) 가 `Agent` tool
로 sub-agent 를 invoke** 하는 것. sub-agent 는 별도 conversation 으로 자동
격리된다. 사용량 한도 시 무한 재시도는 `/loop` dynamic mode + `ScheduleWakeup`
으로 구현.

## 새 아키텍처

```
사용자 → /ai-review        → 1회 사이클 (한도 걸린 agent 는 pending 유지)
사용자 → /loop /ai-review  → 무한 재시도 (ScheduleWakeup 으로 self-pace)
    │
    ▼
main Claude
  1. orchestrator --prepare 호출 → 세션 디렉토리 + _prompts/<role>.md +
     _retry_state.json 초기화 (model 호출 없음, file IO 만)
  2. _retry_state.json 의 pending 리스트 Read
  3. 각 pending agent 에 대해 Agent tool 병렬 invoke
     (subagent_type=<role>-reviewer, prompt=경로 인자)
  4. sub-agent return value 파싱 (STATUS=success|rate_limit|network|fatal)
  5. _retry_state.json 갱신
  6. pending 비면 summary sub-agent → SUMMARY.md → 종료
     pending 남으면 /loop 안: ScheduleWakeup(reset_hint or 1800s) → turn 종료
                  /loop 밖: partial SUMMARY 후 종료
```

## Sub-agent 정의 (.claude/agents/)

13 reviewer (`<role>-reviewer.md`):
api_contract, architecture, concurrency, database, dependency,
documentation, maintainability, performance, requirement, scope, security,
side_effect, testing

5 checker (`<checker>-checker.md`):
convention_compliance, cross_spec, naming_collision, plan_coherence,
rationale_continuity

2 summary: `code-review-summary.md`, `consistency-summary.md`

각 정의 frontmatter:
```
---
name: <slug>
description: <한 줄>
tools: Read, Grep, Glob, Bash, Write
model: sonnet
---
```

본문은 기존 prompts 의 내용을 그대로 옮기되, 다음 contract 를 끝에 추가:
- review.md 본문은 호출자가 prompt 에 인자로 준 OUTPUT_PATH 에 Write tool 로
  저장한다.
- 호출자에게 return 하는 값은 한 줄: `STATUS=<...> ISSUES=<n> PATH=<...>
  RESET_HINT=<sec or "">`.
- 사용량 한도/네트워크 오류 메시지를 받으면 `STATUS=rate_limit` 또는
  `STATUS=network` 로 보고하고 임의 우회 금지.

## Python orchestrator 슬림화

`code_review_orchestrator.py` / `consistency_orchestrator.py` 가
남기는 역할:
- diff/context 수집 + prompt-budget 압축 (`168-297` 의 기존 로직 유지)
- prompt 파일을 `review/<timestamp>/_prompts/<role>.md` 로 저장
- `_retry_state.json` 초기화 (pending=전체, success=[], fatal=[], attempts=0)
- 세션 디렉토리 경로를 stdout 으로 반환

제거할 코드:
- `from lib import agent_runner, summary`
- `agent_runner.run_agents_parallel(...)` 호출 (`code_review_orchestrator.py:290`)
- `summary.run_summary(...)` 호출 (`code_review_orchestrator.py:308`)
- 동일 위치의 consistency_orchestrator 호출

`lib/agent_runner.py`, `lib/summary.py` → 삭제. `lib/session.py` 유지.

## 변경 파일

### 신규
- `.claude/agents/<role>-reviewer.md` × 13
- `.claude/agents/<checker>-checker.md` × 5
- `.claude/agents/code-review-summary.md`
- `.claude/agents/consistency-summary.md`

### 수정
- `.claude/skills/code-review-agents/hooks/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/hooks/consistency_orchestrator.py`
- `.claude/skills/code-review-agents/lib/__init__.py`
- `.claude/skills/code-review-agents/SKILL.md`
- `.claude/skills/code-review-agents/README.md`
- `.claude/skills/consistency-checker/SKILL.md`
- `.claude/commands/ai-review.md`
- `.claude/commands/consistency-check.md`
- `.claude/skills/code-review-agents/hooks/hooks.json` (PostToolUse 제거)
- `CLAUDE.md` ("외부 LLM 호출 정책" 절 신설)

### 삭제
- `.claude/skills/code-review-agents/lib/agent_runner.py`
- `.claude/skills/code-review-agents/lib/summary.py`
- `.claude/skills/code-review-agents/prompts/`
- `.claude/skills/consistency-checker/prompts/`

## 환경변수

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `RETRY_WAKE_DEFAULT_SEC` | 1800 | reset-hint 없을 때 ScheduleWakeup 대기 |
| `RETRY_WAKE_CAP_SEC` | 3600 | wake delay 상한 |
| `RATE_LIMIT_PATTERNS` | (내장) | sub-agent return value 매칭용 추가 패턴 |
| `NETWORK_PATTERNS` | (내장) | 동일 |

## 단계

- [x] 1. .claude/agents/ 디렉토리 신설 + 20 subagent definition 작성
- [x] 2. code_review_orchestrator.py 축소 (--prepare 모드)
- [x] 3. consistency_orchestrator.py 축소
- [x] 4. lib/agent_runner.py + lib/summary.py 삭제, lib/__init__.py 정리
- [x] 5. prompts/ 디렉토리 삭제 (양 skill)
- [x] 6. SKILL.md / README.md 재작성
- [x] 7. .claude/commands/ 슬래시 정의 갱신
- [x] 8. hooks.json PostToolUse 트리거 제거
- [x] 9. CLAUDE.md 정책 절 신설
- [~] 10. `consistency-check --impl-prep`: spec 변경 없음으로 본 작업에는 적용 안 됨. 대신 `--plan` 으로 smoke test 수행 (orchestrator prepare 까지). 실제 sub-agent 호출은 commit/merge 이후 사용자 환경에서 수동 검증.
- [x] 11. orchestrator smoke test 통과: 두 orchestrator 의 `--prepare` 가 session_dir / _prompts / _retry_state.json 정상 생성. `AI_REVIEW_LOOP=1` 환경변수가 `loop_mode=true` 로 반영됨. subagent_type 매핑 (`side_effect → side-effect-reviewer`, `plan_coherence → plan-coherence-checker`) 정상.
- [ ] 12. 통합 검증 (follow-up — 사용자 환경에서 수동 수행 필요):
    - `/ai-review` 호출 → main Claude 가 13개 Agent tool 병렬 invoke → STATUS 파싱 → SUMMARY.md 생성.
    - `/loop /ai-review` 사용량 한도 시뮬레이션 → ScheduleWakeup 예약 → wake 시 재진입 → pending 만 재호출.
    - `/consistency-check --plan plan/in-progress/ai-review-subagent.md` → 5 checker sub-agent invoke → consistency-summary → BLOCK 결정.
    - 본 worktree 의 `.claude/agents/` 가 main session 에 인식되는 시점 확인 (cwd / merge 시점).
- [x] 13. plan 갱신.
- [x] 14. 단일 커밋 (7a52b93e on `claude/ai-review-subagent-b7c8d9`). PR 은 통합 검증 후 사용자 결정.
- [ ] 15. PR 생성 (통합 검증 완료 후).

## 검증 결과 (smoke)

| 항목 | 결과 |
| --- | --- |
| `python3 -c "from lib import session"` | OK |
| `code_review_orchestrator.py` import | OK (ALL_AGENTS 13개 그대로) |
| `consistency_orchestrator.py` import | OK (ALL_CHECKERS 5개 그대로) |
| `_subagent_type('side_effect')` | `side-effect-reviewer` |
| `_subagent_type('plan_coherence')` | `plan-coherence-checker` |
| `code_review_orchestrator.py --prepare` (전체 diff, 30 파일) | 성공. session_dir/_prompts/security.md + _retry_state.json + meta.json 생성. stdout 마지막 줄에 session_dir 절대경로. |
| `AI_REVIEW_LOOP=1 code_review_orchestrator.py --prepare` | `_retry_state.json` 의 `loop_mode=true`. |
| `consistency_orchestrator.py --plan plan/.../ai-review-subagent.md` | 성공. session_dir/_prompts/plan_coherence.md (header + 모드 + Target 문서 + plan_in_progress) + _retry_state.json (pending=['plan_coherence'], summary=consistency-summary). |

## 통합 검증 follow-up

main session 에서 Agent tool 로 sub-agent 를 invoke 하려면 sub-agent definition 이 main 의 `.claude/agents/` 검색 경로에 등록되어야 한다. 본 작업은 worktree 안에 신설했으므로, **PR merge 후 (또는 cwd 를 worktree 로 옮긴 상태에서)** 실제 호출 검증이 가능하다. 수동 검증 절차는 위 단계 12 참고. 검증 실패 시 plan 을 다시 `in-progress` 로 되돌리고 후속 조치.

## Follow-up — 리뷰 디렉토리 nested 구조 (commit 2)

`review/<timestamp>/` 와 `review/consistency/<timestamp>/` 의 flat 누적이 `ls` 등 파일시스템 조회 시 부담이 커서 nested 형식으로 전환.

- 신규 형식:
  - 코드 리뷰: `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
  - 일관성 검토: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
- 변경된 코드:
  - `lib/session.py:create_session_dir` 가 nested ISO 로 디렉토리 생성. `subdir` 인자는 호환 유지.
  - `code_review_orchestrator.py` 의 `REVIEW_OUTPUT_DIR` 기본값 `./review` → `./review/code`.
  - `consistency_orchestrator.py` 는 prefix 그대로 `./review/consistency` (nested 는 session 모듈이 처리).
- 변경된 문서: `CLAUDE.md` 의 명명 컨벤션 표 + "정보 저장 위치" 표 + Skill 체계 표의 path 표현, `code-review-agents/SKILL.md`, `code-review-agents/README.md` 의 산출물 디렉토리 트리 + `_retry_state.json` 예시, `consistency-checker/SKILL.md`, `.claude/commands/consistency-check.md` 산출물 섹션.
- Smoke test:
  - `REVIEW_OUTPUT_DIR=/tmp/code-nested ... --prepare` → `/tmp/code-nested/2026/05/15/07_47_44/...` ✓
  - `CONSISTENCY_OUTPUT_DIR=/tmp/cons-nested ... --plan ...` → `/tmp/cons-nested/2026/05/15/07_47_46/_prompts/plan_coherence.md` 등 정상 ✓
  - 기본값(환경변수 없음) → `./review/code/2026/05/15/07_47_57/` ✓
- 기존 flat 디렉토리(`review/<ts>/`, `review/consistency/<ts>/`) 의 일괄 이동은 사용자 별도 작업.

## 단계 (이어서)

- [x] 16. `lib/session.py:create_session_dir` 를 nested ISO 로 변경 + docstring 갱신.
- [x] 17. `code_review_orchestrator.py` 기본 `REVIEW_OUTPUT_DIR` 을 `./review/code` 로.
- [x] 18. 문서 path 표현 갱신 (CLAUDE.md / 양 SKILL.md / README.md / commands/consistency-check.md).
- [x] 19. Smoke test (양쪽 orchestrator + 기본값).
- [x] 20. follow-up 단계 본 plan 에 기록.
- [x] 21. follow-up 커밋 + push (commit 241e0ebb).
- [x] 22. summary self-discovery follow-up 커밋 + push (commit 04302603).

## Follow-up — 사용자 테스트 피드백 (commit 5+6)

사용자가 실제 `/ai-review` 호출 시 두 가지 이슈 보고:
1. 이중 경로 — `review/2026-05-15_15-29-14` (옛 flat) 와 `review/code/2026/05/15/15_30_00` (새 nested) 가 동시에 생성됨.
2. 자동 후속 흐름 누락 — 옛 동작 (리뷰 → planner/developer 위임 → 이슈 해결 → e2e) 이 빠짐.

### 이슈 1 — commit 16a80728 (`fix(settings): plugins 등록 제거`)

원인: `.claude/settings.json` 의 `plugins: [".claude/skills/code-review-agents"]` 가 plugin 시스템을 통해 plugin path 의 `hooks.json` 을 PostToolUse 로 자동 등록. 옛 hooks.json (Write/Edit 트리거) 이 옛 orchestrator 를 fork → `session.create_session_dir` 만 옛 flat 형식으로 만들고 본문은 `claude -p` 부재로 실패.

해결: `plugins` 배열 제거. slash command 가 진입점이 된 후로 plugin 자동 등록은 필요 없음. 머지 후 main 의 hooks.json 도 함께 사라지면 옛 path 생성 메커니즘 완전 소멸.

### 이슈 2 — 자동 후속 흐름 (commit 6 in progress)

SKILL.md 에 "단계 8. 자동 후속 흐름" 신설:

- 8.1 분류: spec 관련 / 코드 관련.
- 8.2 spec 관련: `project-planner` 절차 (draft → `/consistency-check --spec` → `BLOCK: NO` 시 spec 반영).
- 8.3 코드 관련: `developer` 절차 (수정 + 단위 테스트 + commit).
- 8.4 모두 처리 후 `make e2e-test` 자동 실행.
- 8.5 실패 시 원인 분석 + 추가 fix (최대 3회).
- 8.6 통과 시 `RESOLUTION.md` 작성.
- 8.7 안전 가드: consistency-check `BLOCK: YES`, e2e 누적 3회 실패, 직전 수정과 무관한 사전 결함, DB 마이그레이션·외부 API 계약 변경, SUMMARY "사용자 결정 필요" 표기 → 자동 중단 + 사용자 보고.

동반 갱신: commands/ai-review.md 의 단계 8 추가, README.md 의 아키텍처 그림에 자동 후속 흐름 추가.

- [x] 23. settings.json plugins 제거 commit (16a80728).
- [x] 24. SKILL.md / commands / README 의 자동 후속 흐름 작성.
- [ ] 25. 자동 후속 흐름 commit + push.

## Follow-up — 지침 통합 보강 (commit 4)

전체 skill·agent 지침 검토 결과 발견된 약점 일괄 보강. 사용자 확인 사항: C3 (role-specific prompt 재작성) 적용, E1·E2 (가독성) 적용, C3 의 단일 공유 제안은 거부 (역할 격리 강화 의도).

- **A1 — `--resume` 모드 도입**: 두 orchestrator (`code_review_orchestrator.py`, `consistency_orchestrator.py`) 에 `--resume <session_dir>` 신설. `_retry_state.json` 존재만 검증 후 그 경로를 stdout 으로 echo. /loop wake 후 동일 세션 재진입 메커니즘이 결정성 있게 동작.
- **A2 — STATUS 미수신 fallback**: SKILL.md 단계 4 에 sub-agent 가 한도/네트워크 오류로 STATUS 라인을 만들지 못한 경우 main 이 응답 본문 키워드 매칭으로 분류하는 규칙 + 패턴 리스트 명시.
- **C3 (재해석) — role-specific prompt body**: `lib/role_instructions.py` 신설 — 13 reviewer + 5 checker 의 `ko_title`·`perspective`·`checklist` 를 single source 로 보관. orchestrator 의 `build_agent_prompt_body(agent_name, ...)` 가 role 마다 다른 본문 (`_prompts/<role>.md`) 을 생성 — system prompt 와 이중 강화로 역할 격리 보장.
- **C1, C2 — /loop 호출 형식 명시**: `AI_REVIEW_LOOP=1` env prefix 의 정확한 명령 라인, ScheduleWakeup prompt 의 `/loop /<slash> --resume <session_dir>` 절대경로 표기.
- **C4 — `_retry_state.json` 갱신 필드 명시**: SKILL.md 단계 5 에 갱신 필드 6개(`agents_*`, `agent_history`, `rate_limit_episodes`, `last_reset_hint_sec`, `wake_history`, `total_wait_sec`) 명시.
- **D1, D2 — output_file 검증 + STATUS 정규식 파싱**: SKILL.md 단계 4 에 보강. sub-agent 본문에도 "Write 실패 시 success 거짓 보고 금지" 추가.
- **B1, B2, B3 — stale path / slash 누락 동기화**: SKILL.md·README.md 의 `REVIEW_OUTPUT_DIR` 기본값 → `./review/code`, project-planner SKILL.md 의 옛 flat path → nested, developer SKILL.md 의 `consistency-checker` → `/consistency-check`.
- **E1, E2 — 가독성**: 18개 sub-agent definition 의 호출 규약·상태 결정 섹션을 통일 패턴으로 일괄 재생성 (`lib.role_instructions` 가 single source). commands 의 step 번호에 0 (사전 점검 — worktree 확인) 추가해 SKILL.md 와 일관.
- Smoke: reviewer 3종 + checker 3종 prompt 가 role-specific 으로 다르게 생성됨, `--resume` valid/invalid 분기 정상.

- [ ] 23. 통합 보강 follow-up 커밋 + push.

## Follow-up — summary sub-agent self-discovery (commit 3)

main 이 매 사이클마다 임시 markdown 을 만들어 summary sub-agent 에 전달하던 단계를 제거. summary sub-agent 가 `session_dir=<...>` 한 인자만 받고 자기 컨텍스트에서 `_retry_state.json` → `subagent_invocations[*].output_file` → `meta.json` 을 직접 Read 해 통합 보고서를 작성하도록 단순화.

- 변경: `.claude/agents/code-review-summary.md`, `.claude/agents/consistency-summary.md` 의 호출 규약 + 수행 절차.
- 동반 갱신: code-review-agents/SKILL.md (단계 6), consistency-checker/SKILL.md (단계 5), commands/ai-review.md, commands/consistency-check.md.
- retry_state 스키마 변경 없음 — `summary_subagent_type` / `summary_output_file` 필드가 summary sub-agent 내부에서 직접 참조된다.
- main 의 절차에서 "임시 `_summary.md` 작성" step 제거 → main 의 turn 길이 1단계 감소, conversation 안에 본문이 들어가지 않아 격리 강화.

- [ ] 22. summary self-discovery follow-up 커밋 + push.

## 검증

1. drift: 20 subagent definition 의 frontmatter 가 Claude Code 가 로드
   가능한 schema 인지 확인.
2. 수동 1: 작은 diff 가 있는 worktree 에서 `/ai-review` → 13 Agent 호출 →
   각 review.md + SUMMARY.md 생성.
3. 수동 2: 한 sub-agent prompt 를 임시로 "강제 STATUS=rate_limit" 로 만들고
   `/loop /ai-review` 진입 → ScheduleWakeup 예약·재진입·재호출 검증.
4. 회귀: hooks.json PostToolUse 제거 후 자동 trigger 가 fire 하지 않는지.

## 비-목표

- `claude -p` 의 동시 실행 성능 보존 (Agent tool 의 병렬성에 위임).
- 13개 sub-agent prompt 내용 자체의 품질 개선.
- /loop 외 자동 재시도 메커니즘 (cron 등 검토 가능하나 본 작업 범위 밖).

```

#### `plan/in-progress/brand-refresh-impl.md`
```
---
worktree: brand-refresh-7a3f12
started: 2026-05-15
owner: developer
---

# Plan: Brand Refresh — Stage 2 (자산·코드 구현)

Stage 1 (`spec/6-brand.md` §8 정식 개정) 의 인수인계를 받아, 신 brand spec 에 맞게 자산을 생성하고 코드에 통합한다.

## 컨텍스트

- **Stage 1 산출물**: `spec/6-brand.md` §8 정식판 (Visual Identity), `spec/2-navigation/_layout.md` §2.1 동기화, `spec/2-navigation/10-auth-flow.md` §1 동기화.
- **사전 일관성 검토**: 1차 `review/consistency/2026/05/15/18_25_10/`, 2차 `review/consistency/2026/05/15/18_36_51/` (BLOCK: NO).
- **원본 컨셉 자산**: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관). inline SVG 가 light/dark 페어로 들어있음.
- **현재 코드 상태**: `frontend/public/logo.svg`·`logo-mark.svg`·`frontend/src/app/icon.svg`·`favicon.ico` 는 옛 덩굴 곡선 자산이며 코드에서 거의 참조되지 않음. `frontend/src/app/globals.css` 의 `--primary` 는 generic HSL — brand spec 과 매핑 안 됨.

## 0. 착수 전 의무 절차

- [x] **현재 worktree 확인** — main 워크트리에서 진입 금지. 본 plan 의 worktree 는 `brand-refresh-7a3f12`.
- [x] **`/consistency-check --impl-prep spec/6-brand.md` 호출** (`developer` skill 의무). Critical 0 건 확인 시 착수.
- [x] **Stage 1 산출물 재읽기** — `spec/6-brand.md` §8 (특히 §8.2 컬러 토큰, §8.4 로고 시스템, §8.6 자산 마이그레이션) 과 `_layout.md §2.1`, `10-auth-flow.md §1`.

---

## 1. 자산 생성 (§8.4.1 의 9종)

원본은 `temp/clemvion_logo_concepts.html` 의 inline SVG. 각각 별도 파일로 추출하고 viewBox·색을 spec 토큰과 정렬한다.

### 1.1 SVG 자산 (5종)

- [x] `frontend/public/logo.svg` — Full logo (light). viewBox `260×80`. mark + wordmark + sub-copy 3요소. 색은 §8.2.1 / §8.2.2 의 light 토큰.
- [x] `frontend/public/logo-dark.svg` — Full logo (dark). 동 viewBox. 색은 §8.2.3 의 dark 토큰.
- [x] `frontend/public/logo-mark.svg` — Icon mark (light, 96px master).
- [x] `frontend/public/logo-mark-dark.svg` — Icon mark (dark, 96px master).
- [x] `frontend/public/logo-wordmark.svg` — Wordmark only (sub-copy 없음). 라이트 변종. 다크 변종은 `<Logo />` 컴포넌트의 `currentColor` 활용 또는 추후 분리.

SVG 작성 시 주의:
- 워드마크 `<text>` 의 fontFamily 에 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택 명시 (§8.3, R-11).
- 워드마크 weight: base 200 / accent `vi` 600. `<tspan font-weight="600" fill="...">vi</tspan>` 활용.
- sub-copy `AGENTIC WORKFLOW` 은 Courier New / 8px / letter-spacing 3px / uppercase.

### 1.2 Favicon multi-size 합성

- [x] **16px 전용 vector 신규 작성** — 96px master 의 단순 축소 금지 (§8.4.2). 노드 ≤ 4 / 라인 ≤ 3 으로 단순화. `frontend/public/favicon-16.svg` 로 배치.
- [x] **32px vector** — `frontend/src/app/icon.svg` 가 master 의 축소판으로 작동. Next.js metadata 가 자동 노출.
- [ ] **48px vector + multi-size `favicon.ico` 합성** — *Follow-up*. ImageMagick / `png-to-ico` 등 raster 도구 필요. 현 PR 에서는 옛 `favicon.ico` 삭제, modern 브라우저는 `icon.svg` 사용.

### 1.3 PNG 자산 (Follow-up)

PNG 변환은 raster 도구(sharp / ImageMagick / Inkscape) 가 필요하므로 별도 PR 로 분리한다. 현 PR 에서는 SVG 등가물을 임시 사용:

- [ ] `frontend/src/app/apple-icon.png` (180×180) — 임시로 `frontend/public/apple-icon.svg` 사용 (modern iOS ≥ 12 가 SVG apple-touch-icon 지원). 폴백 PNG 는 follow-up.
- [ ] `frontend/src/app/opengraph-image.png` (1200×630) — *현 PR 에서는 OG/Twitter `images` 메타데이터 비활성화*. SVG OG 카드는 X/Slack/Facebook 크롤러가 안정적으로 렌더하지 않아 소셜 미리보기가 깨질 위험. PNG 생성 후 `frontend/src/app/layout.tsx` 의 `openGraph.images` 와 `twitter.card`(`summary_large_image`로 복원) 를 재활성화.

---

## 2. CSS 토큰 매핑 — **테마 롤백 (2026-05-15)**

사용자 피드백 *"전체적인 색상이 별로"* 로 globals.css 의 Vine 토큰 매핑을 **main 으로 전면 롤백**. Shadcn neutral 토큰 (`--primary: 222.2 47.4% 11.2%` 등) 그대로 유지. `(auth)/layout.tsx` 배경도 `bg-gradient-to-br ...` 로 복원.

SVG 자산은 자체 fill 로 Vine 컬러를 보유하므로 로고/파비콘 비주얼은 그대로 유지됨. 단 spec ↔ 코드 일치를 위해 `spec/in-progress/spec-update-brand-followup.md` 의 P-4 항목 (spec §8.2 부분 롤백 / 후속 분리) 을 project-planner 에 위임.

본 §2 의 아래 체크박스는 *원래 계획* 이며, 롤백으로 모두 **무효화**:

## ~~2. (이전 계획) CSS 토큰 매핑~~ — 무효

`frontend/src/app/globals.css` 의 `:root` 와 `.dark` (또는 `[data-theme="dark"]`) 페어를 정리한다.

- [x] **현행 generic HSL `--primary` (`222.2 47.4% 11.2%`) 폐기** → §8.2.1 의 `vine-700` (`#1e7a42`) HSL 변환값으로 교체.
- [x] 라이트 모드 `:root` 매핑:
  - `--primary` ← `vine-700`
  - `--background` ← `soil-50`
  - `--card` ← `soil-100`
  - `--foreground` ← `ink`
  - `--muted-foreground` ← `ink-60` 또는 `ink-40`
  - `--border` ← `vine-border`
- [x] 다크 모드 페어:
  - `--primary` ← `vine-dark-accent`
  - `--background` ← `vine-dark-bg-base`
  - `--card` ← `vine-dark-bg-elevated`
  - `--foreground` ← `text-on-dark`
  - 기타 §8.2.3 대응표 그대로 (단 `--destructive-foreground` 는 red 배경 가독성 보장을 위해 near-white 유지 — globals.css 인라인 주석 참고)
- [x] **HSL/RGB 표현 일관성** — Tailwind / Shadcn 컨벤션 (`hsl(var(--primary))`) 을 유지하려면 HEX → HSL 변환 후 공백 구분 표기 사용.
- [x] **주석으로 매핑 명시** — 각 CSS 변수 옆에 brand 토큰 이름 주석 (`/* vine-700 from spec/6-brand.md §8.2.1 */`).
- [x] **Tailwind v4 `@theme` directive 갱신** — `--color-vine-300 ~ --color-vine-900` ramp + `--color-ink`, `--color-soil-50/100`, `--color-vine-border` 등록. **다크 토큰(`vine-dark-*`) 은 별도 Tailwind 키로 등록하지 않는다** — `:root` / `.dark` CSS 변수 페어(`--primary` 등) 가 자동 전환을 담당 (spec R-10, impl-prep INFO 10).

검증:
- [ ] 매핑 후 dev server 가동 → 사이드바·인증 화면이 신 컬러로 렌더되는지 확인.

---

## 3. 컴포넌트 (`<Logo />`, `<LogoMark />`)

새 컴포넌트 위치: `frontend/src/components/ui/logo.tsx` (Shadcn ui 그룹과 일관).

- [x] `<Logo />` — props:
  - `variant?: "full" | "mark" | "wordmark"` (default: `"full"`)
  - `theme?: "light" | "dark" | "auto"` (default: `"auto"` — Tailwind `dark:` variant 로 CSS 토글)
  - `size?: number` (px) — **기본값 없음**. 미전달 시 underlying SVG 의 natural viewBox 크기로 렌더. caller 가 사용 자리에 맞게 결정 (sidebar=150, auth=200, README inline=280 등).
  - 정적 SVG 파일을 `<img>` 로 임베드. brand SVG 는 ~1–2KB 의 작은 정적 자산이라 `next/image` 의 최적화 이점이 없고, SSR 일관성 위해 plain `<img>` 채택 (`@next/next/no-img-element` lint 는 파일 레벨 disable).
- [x] alt 속성: full = `"Clemvion — Agentic Workflow"` (sub-copy 항상 동반), mark/wordmark = `"Clemvion"`.
- [x] dark variant 자동 전환 — `theme="auto"` 시 두 자산 모두 렌더하고 Tailwind `dark:hidden` / `hidden dark:block` 으로 CSS 토글. server component 호환.

---

## 4. UI 자리 통합 (§8.4.6 의 5개 자리)

### 4.1 사이드바 (`frontend/src/components/layout/sidebar.tsx`)

- [x] 사이드바 최상단에 로고 슬롯 추가. 옛 코드의 productName 텍스트 + "C" 단일 글자를 교체.
- [x] expanded → **Full logo (dark variant) on `bg-[#111e14]` h-14 헤더 row 전체** (commits `ecc94a6f`, `fddc426d`). 옛 *"theme=auto size=150"* 계획에서 라이트 모드 시인성 이슈로 dark 컨테이너 + dark variant 로 정착.
- [x] collapsed → `<LogoMark theme="dark" size={32}>` (자체 dark 라운드 rect 보유). 같은 dark band 안에 자연스럽게 blend.
- [x] 로고 wrapper 에 `<Link href="/dashboard">` 로 감싸 클릭 시 dashboard 이동 (§8.4.6, `_layout.md §2.1`).

### 4.2 인증 화면 (`frontend/src/app/(auth)/layout.tsx` 또는 폼 컴포넌트)

- [x] `(auth)/layout.tsx` 의 카드 컨테이너 위에 풀로고 중앙 배치. **최종 형태** (commits `df1533ab`, `fddc426d`): 그라데이션 배경 (Shadcn neutral) 위에 `rounded-2xl bg-[#111e14]` 라운드 컨테이너 + `<Logo variant="full" theme="dark" size={200} />`. 옛 *"soil-50 단색"* 계획은 테마 롤백으로 그라데이션 복원, 시인성 위해 dark pill 추가.
- [x] 로고는 non-link 이미지 (a11y smoke 회귀 잠금, commit `3af19e21`).
- [x] 영향 받는 페이지: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` (layout 1개에서 일괄 처리).

### 4.3 Next.js metadata (favicon, apple-icon, OG)

- [x] `frontend/src/app/layout.tsx` 의 `metadata.icons` 명시 — `favicon-16.svg` (16×16) + `icon.svg` (32×32) + `apple-icon.svg` (180×180). 자동 인식 의존 제거.
- [x] `openGraph` / `twitter` — `images` 는 **현 PR 에서 비활성화** (SVG OG 카드 크롤러 호환성 이슈). `title` / `description` 만 유지. PNG 자산 생성 후 §1.3 follow-up 에서 `summary_large_image` 카드 + `opengraph-image.png` 복원.
- [x] `metadata.title` / `description` §8.5 어조 검토 — 그대로 유지.

### 4.4 README.md

- [x] 프로젝트 루트 `README.md` 헤더에 full logo svg 임베드 (`<img src="frontend/public/logo.svg" alt="Clemvion — Agentic Workflow" width="280">`). 옛 `prd/brand.md` 링크는 `spec/6-brand.md` 로 정정.

---

## 5. 회귀 테스트 (`make e2e-test-full`) — Stage 2 시행 결과

- [x] backend supertest 66/66 통과 (Stage 2 가 backend 영역 무관)
- [x] **fail #1** (a11y smoke — forgot-password 첫 Tab) — 회귀 발견 후 즉시 fix. `(auth)/layout.tsx` 의 로고 `<Link>` 를 non-link `<div>` 로 변경, `(auth)/__tests__/layout.test.tsx` 에 잠금 케이스 추가. commit `3af19e21`.
- [ ] **fail #2** (password-reset — `/login` redirect timeout) — **local Mac ARM docker 에서 결정적 재현, root cause 미확정, CI 검증 대기**. 상세 bisect 는 `review/code/2026/05/15/19_07_13/e2e-bisect-notes.md`. CSS 변경(`:root` HSL, `@theme`) 이 dev mode HMR 과 race 가능성. CI Ubuntu x86 환경에서 통과 여부로 timing flake 판단 분기.
- [ ] **Playwright 시각 회귀** (sidebar collapsed/expanded, 인증 카드, dashboard) — 별도 follow-up (pixel snapshot baseline 갱신 필요).
- [ ] **다크 모드 토글 시각 회귀** — 별도 follow-up.

### fail #2 의 CI 결과별 분기

- CI 통과 → 로컬 docker timing flake 로 분류, 본 항목 close.
- CI fail → `e2e-bisect-notes.md` 의 "CI 가 만약 fail 하면 시도할 fix 후보" 우선순위 따라 진입 (form 의 setTimeout→useEffect 전환 또는 테스트 결정성 강화).

---

## 6. 마무리 검증 (Stage 2 종료 조건)

- [ ] **§8.2.5 grep 0 건**:
  ```bash
  grep -rnE '\bVine Green\b|\bBud Lime\b|\bDeep Forest\b|\bBark\b|\bSoil\b|#1F8A4C|#A8D86F|#0F3D2A|#6B5544|#F4F1EC|#111111' spec/ frontend/
  grep -rnE '\bInk\b' spec/ frontend/
  ```
  (단, spec/6-brand.md §8.2.5 의 폐기 매트릭스 자체는 의도적으로 보존되어 잡힘 — 그 행 제외 후 0 건 검증)
- [ ] **`spec/6-brand.md §8.2.6` 일시 불일치 윈도우 종료** — 코드 토큰과 spec 토큰이 일치함을 확인.
- [ ] **`/ai-review` 호출** (developer skill 의무) — Critical 0 건 확인.
- [ ] **본 plan 을 `plan/complete/brand-refresh-impl.md` 로 `git mv`**.

---

## 7. PR 생성

- [ ] PR 제목: `feat(brand): refresh visual identity — node graph logo + Vine ramp tokens`
- [ ] 본문 요약: Stage 1 (spec) + Stage 2 (자산·코드) 묶음으로 PR 생성. spec/6-brand.md §9 변경 이력 인용.
- [ ] reviewers: 사용자.

---

## Rationale 검증 (Stage 2 종료 후)

- [ ] `spec/6-brand.md` R-1 ~ R-12 의 의도가 코드/자산에 정확히 반영되었는지 self-review.
- [ ] 특히 R-8 (네이밍), R-11 (system 폰트 스택), R-6 (16px 별도 vector) 는 구현 디테일이므로 specific 검증.

```

#### `plan/in-progress/cafe24-app-url-3rdparty-shorten.md`
```
---
worktree: cafe24-3rdparty-url-503aa0
started: 2026-05-15
owner: developer
---

# Cafe24 App URL 100자 한도 — `/api/3rd-party/<provider>/` namespace + 토큰 단축

## 배경

Cafe24 Developers

... (truncated due to size limit) ...
