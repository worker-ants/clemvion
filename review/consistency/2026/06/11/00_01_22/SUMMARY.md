# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 전원 WARNING/Critical 발견 없음. INFO 등급 7건 존재하며 모두 선택적 개선 권장 수준.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `swagger.md` 의 `@Public()` 예시 목록에 신규 `/api/health/live` 미언급 | `spec/conventions/swagger.md:122` | 예시를 `(auth, health[/live 포함], hooks)` 로 명확화 권장. 필수 아님. |
| 2 | Cross-Spec | `16-system-status-api.md` R-4 인라인 요약 — SoT(`9-observability §1.1`) cross-ref 명확, 내용 모순 없음 | `spec/5-system/16-system-status-api.md §R-4` | 현행 유지. |
| 3 | Cross-Spec | Trigger health 어휘(`unknown/healthy/degraded`) vs 큐 status API 어휘(`healthy/degraded/down`) 이원화 — R-4 에서 의도적 분리로 명시됨 | `spec/5-system/16-system-status-api.md §2`, `spec/1-data-model.md §2.8` | 현행 유지. UI 레이어 개발 시 용어 설명 추가 권장. |
| 4 | Cross-Spec | `9-observability.md §1.4` 큐 수 하드코딩 `13개` vs `16-system-status-api.md §1` 선언 15행 — 기존 구현 갭(V-15) 기인, 이번 변경이 신규 유발한 충돌 아님 | `spec/data-flow/9-observability.md §1.4` | `13개` 하드코딩을 spec SoT 참조로 대체하거나 구현 갭 메모 병기 권장. 긴급하지 않음. |
| 5 | Rationale Continuity | `3-error-handling.md` 자체 `## Rationale` 절에 liveness 결정 번복 항목 미기재 — 번복 근거 SoT 가 `9-observability.md ## Rationale` 에만 존재 | `spec/5-system/3-error-handling.md ## Rationale` | `3-error-handling.md ## Rationale` 에 번복 stub 항목 + `9-observability.md ## Rationale` cross-ref 추가 권장. 현재도 독자 추적 실질 장벽 없으므로 필수 아님. |
| 6 | Naming Collision | `spec/5-system/3-error-handling.md §7.1` 엔드포인트 목록에 신규 `GET /api/health/live` 미반영 — SoT(`9-observability §1.1`) 는 별도 지정됨 | `spec/5-system/3-error-handling.md §7.1` | `§7.1` 에 `GET /api/health/live` 추가하거나 SoT cross-ref 링크 추가. |
| 7 | Plan Coherence | `spec-sync-structural-followups.md` backlog 항목(`9-observability SoT 참조 두 갈래`) 이 target 변경으로 부분 해소됨 — 해당 plan 의 worktree 는 이미 STALE(MERGED) | `plan/in-progress/spec-sync-structural-followups.md` (STALE) | 조치 불요. 완료 표기는 선택사항. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | swagger.md 미언급, 큐 수 하드코딩(13 vs 15) — 기존 V-15 갭 기인. 직접 모순 없음. |
| Rationale Continuity | LOW | `3-error-handling.md ## Rationale` 에 번복 stub 미기재. `9-observability.md` 에 SoT 존재해 추적 가능. |
| Convention Compliance | NONE | 모든 규약(명명·문서 구조·frontmatter·Rationale 위치) 준수. 위반 없음. |
| Plan Coherence | NONE | Active worktree 3건 모두 target 파일과 교집합 없음. 미해결 결정 우회·선행 plan 미해소 없음. |
| Naming Collision | NONE | 신규 식별자 3건(`GET /api/health/live`, `HEALTH_CHECK_LOG`, `HEALTH_PROBE_PATHS`) 모두 충돌 없음. `§7.1` 목록 누락은 INFO. |

## 권장 조치사항

1. **(선택) `spec/5-system/3-error-handling.md §7.1`** — `GET /api/health/live` 항목 추가 또는 `9-observability §1.1` SoT 링크 삽입으로 엔드포인트 목록 완전화.
2. **(선택) `spec/5-system/3-error-handling.md ## Rationale`** — liveness 결정 번복 stub 항목 + `9-observability.md ## Rationale` cross-ref 한 줄 추가로 Rationale SoT 일관성 강화.
3. **(선택) `spec/data-flow/9-observability.md §1.4`** — `13개` 하드코딩을 `spec/5-system/16-system-status-api.md §1` 참조로 대체 또는 구현 갭(V-15) 메모 병기.
4. **(선택) `spec/conventions/swagger.md:122`** — `@Public()` 예시를 `(auth, health[/live 포함], hooks)` 로 명확화.

위 4건 모두 차단 사유 아님. BLOCK 해소 불필요.