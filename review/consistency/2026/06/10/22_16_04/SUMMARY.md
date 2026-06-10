# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 한다

검토 대상: `plan/in-progress/spec-draft-health-probe-status.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-10

---

## 전체 위험도

**MEDIUM** — Cross-Spec CRITICAL 1건(probe 역할 정의 충돌) + Convention CRITICAL 1건(plan 파일 미존재)이 복합. 나머지는 WARNING/INFO 수준으로 spec 적용 체크리스트 범위 내.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `/api/health` 를 readiness 전용으로 재정의 — 기존 "liveness probe 용" 진술과 의미 역전 | `spec-draft-health-probe-status.md` HP-C-1 | `spec/5-system/3-error-handling.md:380` — "`/api/health` 는 liveness probe 용 binary 판정" | spec 이식(`3-error-handling.md §7.2` Note 교체)이 구현보다 반드시 선행되어야 한다. 단순 교체가 아닌 "기존 liveness 결정 명시적 폐기 + 신규 readiness 결정" ADR 패턴으로 작성할 것. |
| 2 | Convention Compliance | `plan/in-progress/spec-draft-health-probe-status.md` 가 디스크에 존재하지 않음 — plan 파일 기반 SoT invariant 위반 | 파일 전체 | `CLAUDE.md §정보 저장 위치`, `plan-lifecycle §1` — "진행 중 작업은 `plan/in-progress/<name>.md` 에 생성" | 검토 완료 즉시 `plan/in-progress/spec-draft-health-probe-status.md` 로 저장한다. 이후 단계(spec 반영)의 SoT 파일이 없으면 워크플로가 깨진다. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `/api/health` unhealthy 시 503 응답 body shape 가 `GlobalExceptionFilter` 의 `{error:{...}}` shape 와 혼동될 수 있음 — spec 에 명시 없음 | HP-C-1 503 응답 정의 | `spec/5-system/3-error-handling.md:26` `SERVICE_UNAVAILABLE`, `spec/5-system/4-execution-engine.md:1148` `SERVER_SHUTTING_DOWN` 503 사용처 | `9-observability.md §1.1` 에 "unhealthy 시 503 은 `{status, version, uptime, checks}` body 를 유지하며 GlobalExceptionFilter shape 로 변형되지 않는다" 한 줄 추가 |
| 2 | Cross-Spec | `외부 (k8s liveness / 사용자)` mermaid 액터 라벨이 `/api/health/live` 신규 분기를 반영하지 못함 | `9-observability.md §1.1` 수정 계획 | `spec/data-flow/9-observability.md:37` mermaid 단일 흐름 | `9-observability.md §1.1` mermaid 를 readiness(`/api/health`)·liveness(`/api/health/live`) 두 participant 분기로 갱신 |
| 3 | Cross-Spec | R-4 의 "binary `healthy\|unhealthy`" 진술이 HTTP status code 추가 후 부분적으로 부정확해짐 — body 기준임을 명시해야 함 | `16-system-status-api.md` cross-ref 추가 계획 | `spec/5-system/16-system-status-api.md:116` R-4 | R-4 에 "binary 는 응답 body 의 status 어휘 기준이며, HTTP status code 는 200/503 으로 readiness 신호를 추가 전달한다" 삽입 |
| 4 | Rationale Continuity | `/api/health` liveness→readiness 번복 시 구 결정 폐기 Rationale 이력이 남지 않음 — 단순 텍스트 교체로는 이력 소실 | `9-observability.md §Rationale`, `3-error-handling.md §7.2` 갱신 계획 | `spec/data-flow/9-observability.md §Rationale` 기존 liveness 언급, `spec/5-system/3-error-handling.md §7.2` Note | `3-error-handling.md §7.2`·`9-observability.md §Rationale` 모두 "HP-C-1/HP-C-2 변경에 의해 기존 liveness 결정 번복됨" 을 ADR 한 줄로 명시. 삭제·덮어쓰기만으로 처리 금지. |
| 5 | Convention Compliance | `spec/5-system/16-system-status-api.md` cross-ref 추가 시 `spec-link-integrity.test.ts` anchor 정합 — `9-observability.md §1.1` heading 이 먼저 확정되지 않으면 빌드 가드 실패 | `16-system-status-api.md` cross-ref 추가 계획 | `spec-link-integrity.test.ts` (#anchor slug 검증) | spec 적용 순서: `9-observability.md §1.1` heading 확정 → `16-system-status-api.md` cross-ref 추가. 실제 heading slug 와 anchor 가 일치하는지 확인. |
| 6 | Plan Coherence | `spec-sync-structural-followups.md §B` 가 동일 `9-observability.md` 의 SoT cross-ref 정리 항목(`[ ]` 미완)을 보유 — target PR 편집 시 편집 경합 가능 | `9-observability.md` substantive 갱신 계획 | `plan/in-progress/spec-sync-structural-followups.md §B` 미완 항목 | target PR 이 `9-observability.md` 개정 시 structural-followups §B 의 해당 항목을 병행 처리하거나, PR 완료 후 해당 체크를 명시적으로 해소한다. |
| 7 | Plan Coherence | `spec-sync-structural-followups.md` frontmatter `worktree: spec-sync-audit` 가 active 브랜치로 추적되지 않음 — 재개 시 `9-observability.md` 편집 경합 위험 | `spec-sync-structural-followups.md` frontmatter | `git worktree list` — `spec-sync-audit` 없음 | `spec-sync-structural-followups.md` worktree 필드를 현재 상태로 갱신하고, §B 9-observability 항목이 target PR 에서 해소될 수 있는지 확인 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `9-observability.md Rationale` S3 ping "Planned" 표기 재서술 범위 — 미구현 상태 보존 필요 | `9-observability.md §Rationale` 재서술 계획 | 재서술 시 "S3 ping 자체는 여전히 미구현(Planned)" 사실을 명시 보존. "Planned" 표기 삭제·모호화 금지. |
| 2 | Rationale Continuity | `16-system-status-api.md R-4` "binary" 진술 유효성 — body 어휘 기준으로 실질 충돌 없음 | `16-system-status-api.md R-4` | cross-ref 추가 시 "body status 어휘는 여전히 binary" 임을 명시하면 독자 혼동 최소화. |
| 3 | Convention Compliance | `spec/data-flow/9-observability.md` 가 `spec-impl-evidence` 가드 범위 밖 — draft 자신이 이미 인지·기록 | `spec-draft §후속 수동 감사 노트` | spec 적용 시 Rationale 에 이 한계 유지·기록. 장기적으로 `spec/data-flow/**` 를 가드 범위에 추가하는 결정을 명문화 검토. |
| 4 | Convention Compliance | `spec/5-system/3-error-handling.md` 정정 후 frontmatter `status: implemented` 유지 여부 | `3-error-handling.md` frontmatter | `§7.2` Note 정정은 기존 구현 범위 내 명확화이므로 `status` 강등 불필요. 새 endpoint glob 이 기존 `codebase/backend/src/modules/health/**/*.ts` 에 매치되면 변경 불필요. |
| 5 | Convention Compliance | plan 내 변경 항목 식별자 `HP-C-1`~`HP-C-4` — 명시적 금지 패턴 없음, plan 내부 한정 | `spec-draft §변경 요지` | 수정 불필요. 구현 완료 후 `spec/5-system/_product-overview.md` 에 HP-C 시리즈 등재 또는 기존 요구사항 ID 체계에 통합 검토. |
| 6 | Cross-Spec | `HEALTH_CHECK_LOG` ENV var — 기존 사용처 없음, 신규 도입, 충돌 없음 | HP-C-4 | `.env.example` 추가 시 기존 `#` 주석 패턴(한국어 설명 + 기본값)을 따를 것. |
| 7 | Cross-Spec | 요구사항 ID `HP-C-1`~`HP-C-4` — 기존 `HP-C-` prefix 사용처 없음, 충돌 없음 | `spec-draft §변경 요지` | 충돌 없음. 추후 `_product-overview.md` 등재 고려. |
| 8 | Plan Coherence | `exec-intake-queue-impl.md` 의 `16-system-status-api.md §1` 변경 항목은 이미 완료(`[x]`) — 충돌 없음 | `exec-intake-queue-impl.md` PR2a | 조치 불필요. |
| 9 | Plan Coherence | stale worktree `spec-sync-audit-998544` (PR #516 MERGED) — CRITICAL 제외 처리됨 | `.claude/worktrees/spec-sync-audit-998544` | `cleanup-worktree-all.sh --yes --force` 실행 권장. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **MEDIUM** | CRITICAL 1건(`/api/health` probe 역할 역전) + WARNING 3건(503 body shape 혼동, mermaid 미갱신, R-4 부정확). `cross_spec.md` 파일 Read 실패(디스크 미존재)했으나 naming_collision.md 및 다른 checker 교차 발견으로 내용 통합됨. |
| Rationale Continuity | **LOW** | WARNING 1건(번복 Rationale 이력 소실 위험) + INFO 2건. 번복 인식 자체는 draft 에 있으나 실제 spec 반영 시 ADR 패턴 적용 필요. |
| Convention Compliance | **MEDIUM** | CRITICAL 1건(plan 파일 미존재) + WARNING 2건(anchor 정합, 가드 범위 밖 한계). |
| Plan Coherence | **LOW** | WARNING 2건(9-observability.md 편집 경합, spec-sync worktree 추적 누락). Active 경합 없음, stale 1건은 PR #516 MERGED 로 제외. |
| Naming Collision | **MEDIUM** | Cross-Spec 결과와 교차 발견 일치. 신규 식별자(`HEALTH_CHECK_LOG`, `HP-C-*`, `/api/health/live`) 충돌 없음. |

> **참고**: `cross_spec.md` 파일이 디스크에 존재하지 않아 Read 실패. workflow manifest 는 `success` 로 보고했으나 출력 파일 미생성 상태. naming_collision.md 가 동일 충돌 발견사항을 포함하고 있어 Cross-Spec 내용이 통합 보고서에 반영됐다.

---

## 권장 조치사항

1. **(BLOCK 해소 — 즉시)** `plan/in-progress/spec-draft-health-probe-status.md` 를 디스크에 저장한다 (Convention Compliance CRITICAL).
2. **(BLOCK 해소 — spec 이식 전)** `spec/5-system/3-error-handling.md §7.2` 의 "liveness probe 용" Note 를 "HP-C-1/HP-C-2 에 의해 기존 liveness 결정 번복됨" ADR 패턴으로 교체한다. 단순 텍스트 교체가 아닌 명시적 폐기 + 신규 결정 형식. 이 spec 이식 완료 전 구현 착수 금지 (Cross-Spec CRITICAL).
3. **(spec 적용 순서)** `9-observability.md §1.1` heading 확정 → `16-system-status-api.md` cross-ref 추가 순서로 진행해 `spec-link-integrity.test.ts` 빌드 가드 실패를 방지한다.
4. **(spec 갱신 시)** `9-observability.md §Rationale` 에 기존 "liveness 빨라야 함" 서술을 readiness 기준으로 재서술하되, S3 ping "Planned(미구현)" 사실을 보존한다.
5. **(spec 갱신 시)** `9-observability.md §1.1` 에 unhealthy 503 응답이 `{status, version, uptime, checks}` body 를 유지하며 GlobalExceptionFilter shape 로 변형되지 않음을 명시한다.
6. **(spec 갱신 시)** `9-observability.md §1.1` mermaid 를 readiness/liveness 두 participant 분기로 갱신한다.
7. **(병행 처리 권장)** target PR 이 `9-observability.md` 를 개정할 때 `spec-sync-structural-followups.md §B` 의 SoT dual-reference 항목을 병행 처리하거나 완료 후 명시적으로 체크한다.
8. **(정리 권장)** stale worktree `spec-sync-audit-998544` 를 `cleanup-worktree-all.sh --yes --force` 로 제거하고, `spec-sync-structural-followups.md` frontmatter `worktree` 필드를 현재 상태로 갱신한다.