# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — Cross-Spec 에서 에러 코드 레이어 경계 교차 오염 WARNING 2건이 가장 높은 위험도이며, Naming Collision 의 산문 중복 기술 WARNING 2건이 추가된다. Critical 은 없음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `RERANK_CONFIG_INVALID` 를 설정 CRUD SSRF guard 에 사용 — 검색 실행 레이어 전용 코드와 경계 교차 오염 | `6-config.md §B.6.2`, R-4 | `spec/5-system/9-rag-search.md §6`, `spec/5-system/7-llm-client.md §5.5·§6` | `§B.6.2` 표 및 R-4 의 SSRF 에러 코드를 `MODEL_CONFIG_INVALID` 로 정정 |
| W-2 | Cross-Spec | R-4 가 "`tei`/local 만 예외" 로 기술 — `local` rerank provider 는 2026-06-05 Dropped, §B.6.2 표("tei 만")와 불일치 | `6-config.md R-4` | `spec/5-system/7-llm-client.md §2.1` (local Dropped 결정), `6-config.md §B.6.2` 표 | R-4 에서 "`tei`/local 만 예외" → "`tei` 만 예외" 로 수정 |
| W-3 | Naming Collision | `source_ip` 필드 정책이 두 문서에 산문 중복 기술 — 향후 drift 위험 | `6-config.md §A.3`, R-6 | `spec/1-data-model.md §2.13` | `§A.3` 의 `source_ip` 서술을 `spec/1-data-model.md §2.13` cross-reference 로 단순화 |
| W-4 | Naming Collision | `response_code` 필드 정책 이중 산문 기술 — 단일 진실 원칙 위반 | `6-config.md §A.3`, R-6 | `spec/1-data-model.md §2.13`, `spec/5-system/12-webhook.md WH-MG-05` | `§A.3` 의 `response_code` 서술을 해당 spec cross-reference 로 대체 |
| W-5 | Naming Collision | `ModelInfo` DTO 명 잠재적 충돌 — 향후 구현 시 혼선 가능 | `6-config.md` (암묵적 "모델 불러오기" 응답 항목) | `spec/1-data-model.md §2.16`, `spec/5-system/7-llm-client.md §3.5` | 신규 DTO 를 `ModelListItem` 또는 `ProviderModelItem` 으로 명명하거나 `ModelInfo` 정의를 LLM Client spec 으로 이관 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/1-data-model.md §2.16` rerank Planned 표기 미갱신 (`jina`/`voyage`/`local`/`builtin` 잔존) | `spec/1-data-model.md §2.16` | Dropped (2026-06-05, `7-llm-client.md §2.1` 참조) 로 갱신 또는 삭제 (target 수정 불필요) |
| I-2 | Cross-Spec | `PATCH /api/model-configs/:id/set-default` 개별 엔드포인트 행에 권한 레이블 누락 | `6-config.md §3` Model Config API 표 | `**(Editor+)**` 표시 추가 |
| I-3 | Rationale | R-1 이 Rerank 자유 입력 예외를 Rationale 내부에 명시하지 않음 | `6-config.md R-1` | R-1 끝에 "Rerank(`kind=rerank`) 는 model-list API 부재로 자유 입력 예외" 한 줄 추가 |
| I-4 | Rationale | §B.6.2 "연결 테스트 미제공" 참조가 R-3 자기참조 — 직접 근거 불명확 | `6-config.md §B.6.2` 마지막 bullet | LLM Client spec 링크로 교체하거나 R-3 에 분리 항 추가 |
| I-5 | Rationale | R-5 "AI Agent 노드 max_tokens 4096 동반 갱신" 선언이 단방향 — 역방향 확인 없음 | `6-config.md R-5` | `spec/4-nodes/3-ai/1-ai-agent.md` 실제 반영 여부 점검 |
| I-6 | Plan Coherence | `plan/in-progress/spec-sync-config-gaps.md` 19/19 완료됐으나 `plan/complete/` 미이동 | `plan/in-progress/spec-sync-config-gaps.md` | target 적용 시 `plan/complete/` 로 이동 |
| I-7 | Plan Coherence | `spec-draft-unified-model-management.md` 의 `6-config.md` 대상 변경은 반영 완료, 전체 완료 점검 필요 | `plan/in-progress/spec-draft-unified-model-management.md` | 전체 완료 여부 확인 후 `plan/complete/` 이동 |
| I-8 | Plan Coherence | `auth-config-webhook-followups.md §3·§4` 미완 항목 있으나 `6-config.md` 범위 밖 | `plan/in-progress/auth-config-webhook-followups.md` | 독립 후속 작업으로 추적 |
| I-9 | Convention Compliance | checker 출력 파일 부재 (read 실패) | `review/consistency/2026/06/16/08_47_09/convention_compliance.md` | 재시도 필요 |

> **NOTE**: Convention Compliance checker 의 출력 파일(`convention_compliance.md`)이 summary 시점에 읽기 실패했으나, 워크플로 `checkers` 배열은 `convention_compliance: success` 로 보고 — timing 이슈(아래 호출자 사후판정 §에서 파일 실재 확인).

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | SSRF guard 에러 코드 레이어 교차 오염(W-1), R-4 내 `local` 잔재(W-2) |
| Rationale Continuity | LOW | Rationale 보완 INFO 3건 (R-1 예외 미명시, R-3 자기참조, R-5 단방향 선언) |
| Convention Compliance | success (파일 실재) | 아래 호출자 사후판정 참조 |
| Plan Coherence | NONE | `status: implemented` 격상 정합. plan 파일 이동 INFO 2건 |
| Naming Collision | LOW | 산문 중복 기술 WARNING 2건(`source_ip`, `response_code`), `ModelInfo` 잠재 충돌 WARNING 1건 |

---

## 권장 조치사항

1. **(WARNING 해소 우선)** `spec/2-navigation/6-config.md §B.6.2` 표 및 `R-4` 의 SSRF guard 에러 코드를 `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 로 정정한다 (W-1).
2. **(WARNING 해소)** `R-4` 의 "`tei`/local 만 예외"를 "`tei` 만 예외" 로 수정한다 (W-2).
3. **(WARNING 해소)** `§A.3` 의 `source_ip` / `response_code` 산문 정책을 `spec/1-data-model.md §2.13` 및 `spec/5-system/12-webhook.md WH-MG-05` cross-reference 로 단순화한다 (W-3, W-4).
4. **(Convention Compliance 재시도)** `convention_compliance.md` 출력이 없으므로 해당 checker 를 재실행하고 결과를 통합한다. Critical 가 추가로 발견되면 BLOCK 재판정 필요.
5. **(INFO 조치)** `plan/in-progress/spec-sync-config-gaps.md` 를 `plan/complete/` 로 이동한다 (I-6).
6. **(INFO 조치)** `spec/1-data-model.md §2.16` rerank Planned 표기를 Dropped 로 갱신한다 (I-1).
7. **(INFO 조치)** `spec/4-nodes/3-ai/1-ai-agent.md` 에서 `max_tokens` 예시값 4096 동반 갱신 여부를 확인한다 (I-5).
8. **(INFO 조치)** `PATCH /api/model-configs/:id/set-default` 행에 `**(Editor+)**` 권한 레이블을 추가한다 (I-2).

---

## 호출자 사후판정 (main Claude, 2026-06-16 — spec-sync-config-c PR)

**BLOCK: NO 확정.** Critical 0. 본 PR 의 실제 편집 범위(diff)는 **(1) frontmatter `code:` glob + status `partial→implemented` + `pending_plans` 제거, (2) §A.4 권한 소절 확장, (3) §3 Authentication API 표 mutation 행 `(Admin+)` 주석 + 표 헤더 RBAC 한 줄, (4) Rationale R-2 RBAC bullet** 의 4곳뿐이다. WARNING/INFO 의 처분:

- **W-1·W-2 (rerank `RERANK_CONFIG_INVALID`·R-4 `local` 잔재)**: `§B.6.2`/`R-4` 는 **Part B(Models)** 영역으로 본 PR 이 한 글자도 건드리지 않은 **pre-existing** 내용. 본 작업(Part A — Auth RBAC + God-split)의 scope 밖. 별도 planner grooming(Part B Models spec-fix)으로 분리 — 본 PR 흡수 금지(scope creep·loop-avoidance).
- **W-3·W-4 (§A.3 `source_ip`/`response_code` 산문 중복)**: §A.3 은 R-6 호출이력 작업(별 PR, 이미 머지)의 산물로 본 PR 미편집 pre-existing. 단일진실 단순화는 정당하나 본 작업 범위 밖 → 동일하게 별도 grooming 분리.
- **W-5 (`ModelInfo` DTO)**: 미구현 DTO 의 투기적 명명 충돌 — 본 spec 에 해당 식별자 미존재(암묵). 향후 Part B 구현 시 결정. 본 PR 무관.
- **I-6 (plan 미이동)**: **이미 처리됨** — checker 가 working-tree 의 `git mv` 후 상태를 base 로 못 읽은 것. `plan/complete/spec-sync-config-gaps.md` 로 이동 완료(`git status` 확인). I-7 의 `spec-draft-unified-model-management.md` 는 본 PR 범위 밖 별 plan.
- **I-2·I-3·I-5·기타 INFO**: Part B/Rationale 보강 제안으로 본 작업 범위 밖. 별도 grooming 백로그.

**Convention Compliance (I-9)**: 1차 워크플로에서 `convention_compliance.md` 출력이 **실제로 미산출**됐다(`checkers[]` 의 success 보고는 부정확). prompt 파일이 남아 있어 **convention-compliance-checker 를 단건 재실행** → **BLOCK: NO** (CRITICAL·WARNING 0, INFO 3건). 재실행 산출물이 `convention_compliance.md` 로 정상 기록됨. 재실행 결과는 `status: implemented` + `pending_plans 없음` 을 **정상 정합으로 직접 확인**했고, SSRF 에러코드 INFO 는 위 cross-spec W-1 과 동일한 pre-existing 항목이다. ⇒ BLOCK: NO 유지(Critical 0).

결론: 본 PR 의 4개 편집 자체에 대한 Critical/Warning 은 0. WARNING 은 전부 본 PR 미편집 pre-existing(Part B / §A.3) → 별도 grooming. 진행(커밋·push·PR).
