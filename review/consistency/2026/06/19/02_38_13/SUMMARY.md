# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical/Warning 없음. Warning 1건(dead 링크 frontmatter)과 Info 7건 식별. 구현 진행에 실질적 장애 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `pending_plans`에 이미 `plan/complete/`로 이동한 plan 파일 dead 링크 등재 | `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` line 11 | `plan/complete/spec-sync-execution-engine-gaps.md` (in-progress에 없음) | frontmatter에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 행 제거 (project-planner 영역). `spec-impl-evidence.md §3(c)` 승격 판정 정확도에 영향 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `pending_plans:` frontmatter가 이미 complete된 plan을 in-progress 경로로 참조 (Warning #1과 동일 근원) | `spec/5-system/4-execution-engine.md` frontmatter line 11 | Warning #1 조치와 통합 처리 |
| 2 | Cross-Spec | `§7.5.2` RESUME_* 후행 이벤트 누출 차단이 WS 이벤트 빌더 경로에서 "후속 점검 항목"으로 미확정 | `spec/5-system/4-execution-engine.md §7.5.2` 끝 주석 | 이번 구현이 해당 경로를 건드린다면 spec §7.5.2 주석을 정식 절로 확정 |
| 3 | Cross-Spec | `§7.5` rehydration outbound routing context 재등록 best-effort 실패 trade-off 미명시 | `spec/5-system/4-execution-engine.md §7.5` | 구현 시 trade-off 확인 후 필요 시 spec 명시 |
| 4 | Cross-Spec | `§9.2` `exec:seq:<executionId>` best-effort DEL 실패 시 메모리 누수 허용도 미명시 | `spec/5-system/4-execution-engine.md §9.2` | 구현 관심사 메모만. spec 변경 불필요 |
| 5 | Convention Compliance | `pending_plans:`에 llm-error-passthrough 구현 대상 surface를 책임지는 plan이 등재되지 않음 | `spec/5-system/4-execution-engine.md` frontmatter | 구현 plan 착수 시 frontmatter `pending_plans:`에 추가 후 가드 통과 확인 |
| 6 | Plan Coherence | `exec-park-durable-resume.md` 잔여 PR3와 `llm-error-passthrough` 범위가 동일 파일 수정 시 merge-coordinate 필요 | `spec/5-system/4-execution-engine.md §7.5.2` | 구현 plan 착수 시 코드 파일 겹침 확인 |
| 7 | Naming Collision | `EXECUTION_TIMEOUT` 동명 이중 레이어 — known artifact | `spec/conventions/error-codes.md §4` 기등록 | 현행 유지. 추가 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 직접 모순 없음. INFO 4건 |
| Rationale Continuity | NONE | 기각 대안 재도입 없음 |
| Convention Compliance | LOW | 규약 직접 위반 없음. INFO 1건 |
| Plan Coherence | LOW | WARNING 1건 (dead 링크). INFO 2건 |
| Naming Collision | NONE | 신규 식별자 도입 없음 |

## 권장 조치사항

1. **(Warning 해소 — project-planner)** `pending_plans:`에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 행 제거 (complete/ 로 이동됨).
2. **(item 2 무관)** llm-error-passthrough 가 신규 surface 구현이면 pending_plans 등재 — 단 본 작업은 기존 passthrough 행위의 테스트 보강이라 신규 surface 아님.
3. **(구현 중 확인)** PR3 코드 파일 겹침 점검.

> **item 2 비고**: 본 작업은 `classifyLlmError` 의 미등록 explicit code passthrough(spec §10 L1099 "명시 code 보존") 에 대한 테스트 어서션 보강 — 기존 행위, spec 변경 없음, 신규 식별자 없음. Warning/INFO 는 전부 pre-existing spec frontmatter(planner) 또는 타 경로 — 본 변경 무관.
