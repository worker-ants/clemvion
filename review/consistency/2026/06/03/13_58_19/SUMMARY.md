# Consistency Check 통합 보고서

**BLOCK: YES** — CRITICAL 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**MEDIUM** — Convention Compliance checker 에서 CRITICAL 1건(scope 외 미검증에 의한 불확실성), WARNING 9건(plan dangling reference 2건 포함), INFO 다수 발견

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `node-output.md §3.2.1` `retryable: false` + `retryAfterSec` 동반 금지 invariant 가 AI 노드 spec 에 명시적으로 반영되어 있는지 미검증 — 해당 규약이 "convention-compliance checker 가 발견한다" 고 직접 지목함 | `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md` (스캔 범위 외) | `spec/conventions/node-output.md §3.2.1` — invariant: `retryable === true` 일 때만 `retryAfterSec` set 가능 | `spec/4-nodes/3-ai/` 하위 AI 노드 spec 에서 `output.error.details.retryAfterSec` 문서화 시 해당 invariant 명시 여부 직접 검증; 미명시 시 각 노드 spec 에 `[node-output §3.2.1]` 참조 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence / Naming Collision (중복 통합) | `pending_plans` 에 등재된 `spec-sync-workflow-list-gaps.md` 가 worktree 에만 존재, main 에 없음 — dangling reference | `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans` | `plan/in-progress/spec-sync-workflow-list-gaps.md` (미존재) | 해당 plan 파일을 같은 PR 에 포함해 생성하거나, frontmatter 에서 `pending_plans` 항목 제거 및 `status: partial` 재검토 |
| 2 | Plan Coherence | `pending_plans` 에 등재된 `spec-sync-external-interaction-api-gaps.md` 가 존재하지 않음 — dangling reference | `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans` | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (미존재) | 신규 plan 파일 생성(갭 목록 포함)하거나 `spec-fix-eia-token-error-codes.md` 범위로 통합 후 단일 plan 참조로 교체 |
| 3 | Plan Coherence | `spec-fix-eia-token-error-codes.md` 와 EIA spec 파일을 공유하면서 착수 선후 관계 미명시 | `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 | `plan/in-progress/spec-fix-eia-token-error-codes.md` (`TOKEN_REVOKED`, `SCOPE_MISMATCH` 미해소 결정 보유) | spec-sync-audit PR 머지 후 착수 선행 조건을 `spec-fix-eia-token-error-codes.md` 에 명시 |
| 4 | Cross-Spec | `0-dashboard.md §5` 괄호 주석에 `waiting_for_input` 누락 — DTO enum 5종으로 오기재 | `spec/2-navigation/0-dashboard.md §5` 상태 열 괄호 보조 설명 | `spec/1-data-model.md §2.13` (6종), `spec/5-system/4-execution-engine.md §1.1`, `spec/3-workflow-editor/4-ai-assistant.md §get_workflow_executions` | 괄호 주석을 6종 enum 포함으로 수정하거나 삭제 후 `spec/1-data-model.md §2.13` 참조 링크로 대체 |
| 5 | Rationale Continuity | Flyway forward-only 정책 + 환경별 conf 폐기 결정 변경 후 Rationale 미기록 | `spec/0-overview.md §2.8` 롤백·환경 분리 행 | 기존 Rationale "DB 마이그레이션 도구로 Flyway 채택" (undo 스크립트·`flyway-{env}.conf` 방식 전제) | `spec/0-overview.md ## Rationale` "Flyway 채택" 항 하위에 (1) forward-only 채택 이유, (2) CLI 인자 주입 방식 채택 이유 추가 |
| 6 | Rationale Continuity | Dashboard 성공률 공식 변경(`completed/(completed+failed)` → `completed/전체`) 후 `## Rationale` 섹션 부재 | `spec/2-navigation/0-dashboard.md §3` Success Rate 행 | 기존 동일 spec 의 구 공식 정의 | `spec/2-navigation/0-dashboard.md` 에 `## Rationale` 섹션 신설 후 공식 변경 근거 기록 |
| 7 | Convention Compliance | `spec/1-data-model.md` frontmatter `status: implemented` 이나 일부 필드·엔티티(`SecretStore §2.21.1` 등) 구현 상태 모호 | `spec/1-data-model.md` frontmatter | `spec/conventions/spec-impl-evidence.md` + `spec/0-overview.md §6.1~§6.3` | frontmatter 에 `status: partial` 또는 `pending_plans:` 추가하거나, data-model spec 의 `status` 의미를 규약에서 별도 정의 |
| 8 | Convention Compliance | `spec/2-navigation/0-dashboard.md` 에 `## Overview (제품 정의)` 표준 헤더 부재 (`## 1. 개요` 사용) | `spec/2-navigation/0-dashboard.md` 전체 구조 | `spec/0-overview.md §8 문서 컨벤션` | 규약 갱신으로 `_product-overview.md` 보유 영역의 상세 spec 에서 `## N. 개요` 패턴 허용 명시(저비용) 또는 헤더 통일 |
| 9 | Convention Compliance | `spec/1-data-model.md §2.17.3 Rationale (AuthConfig 도메인)` 이 본문 중간에 위치 — 규약의 "본문 끝 `## Rationale`" 패턴과 불일치 | `spec/1-data-model.md §2.17.3` | `spec/0-overview.md §8 문서 컨벤션` | `§2.17.3 Rationale` 을 문서 끝 `## Rationale` 섹션으로 통합 이동하거나, 규약에 인라인 Rationale 서브섹션 허용 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/0-overview.md §4 영역별 진입 문서` 에 `data-flow/` 미등재 (§8 문서 맵에만 등장) | `spec/0-overview.md §4` | §4 표에 `data-flow/` 행 추가 또는 §8 에 역할 각주 설명 |
| 2 | Cross-Spec | `1-workflow-list.md §2.4` 목표 기본 정렬(`updated_at`)과 API 규약 글로벌 기본값(`created_at`) 간 cross-reference 미명시 | `spec/2-navigation/1-workflow-list.md §2.4` | "API 규약 글로벌 기본값과 다른 리소스별 목표값 — 서버 수정 필요" 명시 또는 API 규약에 override 가능 주석 추가 |
| 3 | Rationale Continuity | Dashboard 요약 카드 구성 변경(Avg Time 카드 제거) 의도 미기록 | `spec/2-navigation/0-dashboard.md §3` | `## Rationale` 신설 시 Avg Time 미노출 결정 근거도 함께 기록 |
| 4 | Rationale Continuity | `spec/1-data-model.md §2.13 chain_id` NULLABLE 변경 — `spec/5-system/13-replay-rerun.md §9.1` 에 명시적 Rationale 기록 존재, 정합성 유지됨 | `spec/1-data-model.md §2.13` | 추가 조치 불필요 |
| 5 | Convention Compliance | `spec/data-flow/` 하위 상세 파일 Overview 헤더가 `## Overview` 로 표준 헤더(`## Overview (제품 정의)`)와 미세 불일치 | `spec/data-flow/1-audit.md` 등 | 헤더 통일 또는 규약에 data-flow 하위 파일 예외 명시 |
| 6 | Convention Compliance | `spec/data-flow/` 에 `_product-overview.md` 부재 — `0-overview.md` 패턴 사용 중 | `spec/data-flow/` 폴더 | CLAUDE.md 또는 `spec/0-overview.md §8` 에 `0-overview.md` 대체 패턴 허용 명시 |
| 7 | Convention Compliance | `spec/0-overview.md §4·§8` 에서 `spec/conventions/` 파일 목록이 부분적으로만 등재 (`swagger.md`, `migrations.md` 등 다수 미등재) | `spec/0-overview.md §4·§8` | `spec/conventions/README.md` 또는 `spec/conventions/0-overview.md` 신설하여 규약 파일 목록 관리 |
| 8 | Convention Compliance | `spec/conventions/swagger.md §5-1` 응답 DTO 위치 규약이 개별 spec 에서 경로 미명시 | `spec/2-navigation/0-dashboard.md §7` (`DashboardSummaryDto`) | 구현 착수 시 swagger.md §5-1 을 체크리스트로 활용하는 것으로 충분 |
| 9 | Plan Coherence | `node-output-redesign/README.md` — `conventions-code-data-9b32d5` 이미 MERGED·stale, merge 시 diff context 충돌 가능 | `spec/conventions/node-output.md` | 머지 전 `git diff origin/main` 으로 spec-sync-audit 패치 clean apply 여부 확인 |
| 10 | Plan Coherence | `execution-engine-residual-gaps.md` worktree(`spec-frontmatter-status-migration-027c17`) 미활성 | `plan/in-progress/execution-engine-residual-gaps.md` | frontmatter worktree 값 정비 또는 plan을 `complete/` 이동 검토 |
| 11 | Naming Collision | `Node.category` enum 에 `trigger` 추가 — `spec/4-nodes/0-overview.md` 와 기존 불일치 해소하는 올바른 정합화 수정 | `spec/1-data-model.md §2.6` | canonical SoT 명시 또는 cross-reference 유지 |
| 12 | Naming Collision | `DashboardSummaryDto` 필드 정합화(`inactiveWorkflows` 제거, `activeWorkflows`·`runs7dPrevious`·`runs7dChangePercent` 추가) | `spec/2-navigation/0-dashboard.md §6` | 추가 조치 불필요 |
| 13 | Naming Collision | `folderId` 쿼리 파라미터 — 이미 코드베이스에 구현됨, spec 누락 항목 추가 | `spec/2-navigation/1-workflow-list.md §3 API` | 추가 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `waiting_for_input` 괄호 주석 누락(WARNING 1), 문서 맵 cross-reference 미흡(INFO 2) |
| Rationale Continuity | LOW | Flyway forward-only·환경 설정 변경 Rationale 미기록(WARNING 1), Dashboard 성공률 공식 변경 Rationale 부재(WARNING 1) |
| Convention Compliance | MEDIUM | `node-output.md §3.2.1` invariant AI 노드 spec 반영 미검증(CRITICAL 1), 헤더 패턴·frontmatter status 불일치(WARNING 3) |
| Plan Coherence | LOW | dangling plan 참조 2건(WARNING), EIA 착수 선행 관계 미명시(WARNING 1) |
| Naming Collision | LOW | `spec-sync-workflow-list-gaps.md` dangling reference(WARNING — Plan Coherence 와 중복 통합), 나머지 식별자는 모두 정합화 수정 |

## 권장 조치사항

1. **(BLOCK 해소 — 즉시 필수)** `spec/4-nodes/3-ai/` 하위 AI 노드 spec 3개(`1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`)를 직접 열어 `output.error.details.retryAfterSec` 문서화 시 `retryable === true` 조건 invariant 가 명시되어 있는지 검증한다. 미명시 시 각 파일에 `spec/conventions/node-output.md §3.2.1` SoT 참조를 추가한다.
2. **(dangling plan 해소)** `plan/in-progress/spec-sync-workflow-list-gaps.md` 와 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 이번 PR 에 함께 생성하거나, 각 spec frontmatter 의 `pending_plans` 참조를 실존하는 plan 파일로 교체한다.
3. **(Cross-Spec 정합)** `spec/2-navigation/0-dashboard.md §5` 괄호 주석을 `waiting_for_input` 포함 6종 enum 으로 수정하거나 삭제 후 `spec/1-data-model.md §2.13` 링크로 대체한다.
4. **(Rationale 기록)** `spec/0-overview.md ## Rationale` 에 Flyway forward-only 정책·CLI 인자 주입 방식 채택 근거를 추가하고, `spec/2-navigation/0-dashboard.md` 에 `## Rationale` 섹션을 신설하여 성공률 공식 변경 근거와 Avg Time 카드 미노출 결정을 기록한다.
5. **(선행 관계 명시)** `plan/in-progress/spec-fix-eia-token-error-codes.md` 에 "선행: spec-sync-audit PR 머지 후 착수" 조건을 추가한다.
6. **(규약 명확화)** `spec/0-overview.md §8` 또는 CLAUDE.md 에 `_product-overview.md` 패턴과 `0-overview.md` 패턴의 구분 기준을 명문화하고, `_product-overview.md` 보유 영역의 상세 spec 에서 `## N. 개요` 패턴 허용 여부를 명시한다.

---

## 호출자(spec-sync-audit) 검증·해소 결과 (2026-06-03)

> 본 consistency-check 의 BLOCK: YES 는 Convention-Compliance checker 의 **"미검증에 의한 불확실성"** CRITICAL 1건이 사유였다. checker scope(spec/0-overview·1-data-model·2-navigation 0/1) 밖이라 직접 확인 못 한 항목으로, 호출자가 직접 검증함:

### CRITICAL 해소 — 검증 결과 **이미 준수** (위반 아님)
- `node-output.md §3.2.1` invariant(`retryAfterSec` 는 `retryable === true` 일 때만 set)가 AI 노드 spec 3개에 반영됐는지: **3개 모두 명시 확인**.
  - `spec/4-nodes/3-ai/1-ai-agent.md:884,899` — "retryable === true 일 때만 set 가능 (Principle 3.2.1)"
  - `spec/4-nodes/3-ai/2-text-classifier.md:331` — "invariant: retryable === true 일 때만 set (Principle 3.2.1)"
  - `spec/4-nodes/3-ai/3-information-extractor.md:286` — "invariant: retryable === true 일 때만 set (Principle 3.2.1)"
  → **실질 CRITICAL 없음. 검증 후 BLOCK 무효화.**

### WARNING dangling plan 2건 — **false positive** (checker 가 origin/main 기준 비교)
- `plan/in-progress/spec-sync-workflow-list-gaps.md`, `spec-sync-external-interaction-api-gaps.md` 는 본 worktree 브랜치에 **실존**(13:26 생성). Python 가드 + 정식 vitest `spec-pending-plan-existence.test.ts`(61 테스트) **통과**. dangling 아님.

### WARNING 정정 완료 (호출자가 도입한 변경분)
- **W4 (cross-spec)**: `spec/2-navigation/0-dashboard.md §5` status enum 괄호에 `waiting_for_input` 추가(6종, 데이터 모델 §2.13 참조). ✅
- **W5 (rationale)**: `spec/0-overview.md ## Rationale` 에 Flyway forward-only·CLI 인자 주입 채택 근거 추가(구 undo/conf 전제 폐기 명시). ✅
- **W6 (rationale)**: `spec/2-navigation/0-dashboard.md` 에 `## Rationale` 신설 — 성공률 분모(7일 전체)·Avg Time 카드 미노출 code-sync 근거 기록. ✅

### 미조치 (사유 명시)
- 헤더 패턴(`## N. 개요` vs `## Overview (제품 정의)`)·data-flow `_product-overview` 부재·인라인 Rationale 위치 등 convention WARNING/INFO: **spec-sync 가 도입한 게 아닌 다수 파일의 선재(pre-existing) 패턴**이며, checker 도 "규약 갱신 권장"(파일 변경 아님)으로 분류. 본 동기화 범위 밖 — 별도 컨벤션 정비 turn 권고.
- `1-data-model.md status: implemented`(W7): 가드 면제 파일이며 엔티티 정의는 구현됨. data-model status 의미 규약화는 별도 검토.

**최종 판정: 검증 후 실질 BLOCK 없음(CRITICAL=compliant, dangling=false-positive). 도입분 WARNING 3건 정정 완료.**
