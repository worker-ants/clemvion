# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — Critical 0건, Warning 4건(중복 수렴 후 실질 3건), Info 8건. 차단 사유 없으나 `## Rationale` 부재 및 verb 구분자 정책 미명시가 향후 혼선을 유발할 수 있음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | Critical 발견 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance / Rationale Continuity / Naming Collision (통합) | `## Rationale` 섹션 부재 — §2 "한 resource 안에서 패턴 혼용 금지" 규칙이 `workspace` 이중 패턴 예외를 포섭하지 않아 규칙 진술과 실제 적용 불일치 | `spec/conventions/audit-actions.md` §2 본문 전체 및 파일 종단 | CLAUDE.md "결정 배경 → 해당 spec 문서 끝 Rationale"; `spec/5-system/1-auth.md §Rationale 4.1.A` | `## Rationale` 신설하여 taxonomy 설계 근거 소유. §2 본문에 "§2.3 도메인 고유 동사는 같은 resource 의 §2.1/§2.2 verb 와 공존 가능 — 분류 기준은 verb 의 성격" 예외 조항 한 줄 추가. |
| W-2 | Convention Compliance | `model_config.set-default` verb 토큰에 하이픈 사용 — §1 에 구분자 정책 명시 없어 기존 언더스코어 관례(`scope_changed`, `transfer_ownership` 등)와 사실상 불일치 | `spec/conventions/audit-actions.md` §3 `model_config` 행 | 기존 다중 어절 verb 전체(`scope_changed`, `re_run`, `transfer_ownership`, `role_changed`, `password_changed`) — 모두 언더스코어 사용 | (a) `set_default` 로 통일(`1-auth.md §4.1` 동기 갱신 포함) **또는** (b) §1 에 "verb 토큰 내 구분자는 언더스코어 기본, `set-default` 는 API 경로 세그먼트 관용 표기로 예외" 명시. (a) 권장. |
| W-3 | Plan Coherence | `workspace.transfer_ownership` 시제 분류를 target §2.3 으로 해소했으나 `plan/in-progress/refactor-04-followup-pwchange-userip.md §후속` 메모가 닫히지 않아 추적 상태 불명확 | `spec/conventions/audit-actions.md` §3 `workspace` 행 | `plan/in-progress/refactor-04-followup-pwchange-userip.md §후속` — "workspace.transfer_ownership 시제 규약 카테고리 미분류 … 신설 또는 §4.1 예외 명시" (체크박스 없는 서술형 메모) | plan 의 해당 메모에 "→ `spec/conventions/audit-actions.md` §2.3 분류로 해소됨" 추가하여 명시적으로 닫는다. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `data-flow/1-audit.md §1.1` 이 `conventions/audit-actions.md` 를 명시적으로 역참조하지 않음 (단방향 링크) | `spec/data-flow/1-audit.md §1.1` | `[conventions/audit-actions.md](../conventions/audit-actions.md)` 링크 추가 권장 |
| I-2 | Rationale Continuity | `integration` resource 의 `scope_changed`·`reauthorized` 가 합성 과거분사로 §2.1 에 속하는 근거 미기재 | `spec/conventions/audit-actions.md` §3 `integration` 행 | §2.1 하단 또는 4.1.A Rationale 에 "합성 과거분사도 §2.1 범주" 한 줄 보완 |
| I-3 | Rationale Continuity | `model_config` 에 `reveal` 미포함 이유가 레지스트리 내 미기재 | `spec/conventions/audit-actions.md` §3 `model_config` 행 | 표 주석에 "ModelConfig 는 평문 reveal 엔드포인트 없음" 한 줄 추가 또는 `1-auth.md §4.1` 링크 |
| I-4 | Convention Compliance | 레지스트리 표 `상태` 컬럼 한국어·영어 혼용("구현" vs "Planned") | §3 표 전체 | "Planned" → "예정" 또는 "미구현" 으로 통일. `1-auth.md §4.1` 동기 갱신 권장 |
| I-5 | Convention Compliance | `## Overview` 헤딩이 일부 conventions 파일의 `## Overview (제품 정의)` 표준과 상이 | 파일 `## Overview` 헤딩 | `## Overview (목적)` 또는 `## Overview (명명 규약 범위)` 로 보완 가능 (낮은 우선순위) |
| I-6 | Plan Coherence | `auth_config.*` 5종 "구현" 표기가 `auth-config-webhook-followups.md §1` 완료(2026-06-11)와 정합 | §3 `auth_config` 행 | 조치 불요 |
| I-7 | Plan Coherence | `workspace.created/updated/deleted` "Planned" 등재가 `spec-sync-data-flow-12-workspace-gaps.md` 의 "결정 필요" 열린 상태와 충돌 없이 정합 | §3 `workspace` 행 | 조치 불요. 해당 plan 해소 시 동기 갱신 |
| I-8 | Plan Coherence | `model_config` "Planned" 등재가 `spec-draft-unified-model-management.md` 의 `llm_config→model_config` 리네임(미머지) 선제 채택 | §3 `model_config` 행 | 해당 plan 머지 시 resource 이름 일치 교차 확인 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 모든 spec 간 액션 목록·상태·책임 경계 일치. 단방향 링크 누락(INFO) |
| Rationale Continuity | LOW | §2 규칙과 `workspace` 이중 패턴 표현 불일치(WARNING). 기각 대안 재도입 없음 |
| Convention Compliance | MEDIUM | `## Rationale` 부재 + `set-default` 하이픈 구분자 정책 미명시(각 WARNING) |
| Plan Coherence | LOW | 모든 "구현" 표기가 완료 plan 과 정합. `workspace.transfer_ownership` 후속 메모 미닫힘(WARNING) |
| Naming Collision | LOW | 식별자 충돌 없음. §2/§3 `workspace` 규칙-레지스트리 긴장(WARNING, 타 checker 와 동일 사안) |

## 권장 조치사항

1. **(BLOCK 해소 해당 없음)** Critical 없음.
2. **(W-1 — 최우선)** `spec/conventions/audit-actions.md` 에 `## Rationale` 섹션 신설 — taxonomy 3분류 설계 근거 기술, `1-auth.md §Rationale 4.1.A` 인용 링크. 동시에 §2 본문에 "§2.3 도메인 고유 동사는 같은 resource 의 다른 패턴 verb 와 공존 가능" 예외 조항 추가하여 §3 `workspace` 각주 설명을 규칙 수준으로 격상.
3. **(W-2)** `model_config.set-default` → `set_default` 로 통일하고 `spec/5-system/1-auth.md §4.1` 도 동기 갱신. 또는 §1 에 하이픈 예외 정책 명시.
4. **(W-3)** `plan/in-progress/refactor-04-followup-pwchange-userip.md §후속` 메모에 "→ `spec/conventions/audit-actions.md` §2.3 분류로 해소됨" 추기하여 열린 후속 항목 닫기.
5. **(I-1)** `spec/data-flow/1-audit.md §1.1` 에 `conventions/audit-actions.md` 역참조 링크 추가.
6. **(I-2~I-3)** §3 표 주석 보완 — integration 합성 과거분사 근거, model_config reveal 미포함 사유.
7. **(I-4)** 레지스트리 `상태` 컬럼 한/영 통일 (낮은 우선순위).
