# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**CRITICAL** — plan frontmatter `started` 필드 누락(build guard 차단 예상) + `spec/5-system/3-error-handling.md §7` probe 역할 직접 충돌(target_specs 미포함)

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | plan frontmatter 필수 필드 `started` 누락 — `created` 로 대체되어 `plan-frontmatter.test.ts` build 차단 예상 | `plan/in-progress/spec-draft-health-probe-status.md` frontmatter | `.claude/docs/plan-lifecycle.md §4` (필수 3필드: `worktree`·`started`·`owner`) | `created: 2026-06-10` → `started: 2026-06-10` 으로 필드명 교체 |
| 2 | cross_spec | `/api/health` probe 역할 직접 충돌 — draft 는 readiness 전용으로 전환하지만 `3-error-handling.md §7` 는 liveness probe 용으로 명시. 해당 파일이 target_specs 에 미포함 | draft §C-1, §C-2 | `spec/5-system/3-error-handling.md §7.1–7.2` | `spec/5-system/3-error-handling.md` 를 target_specs 에 추가. §7.2 Note 를 "readiness probe(`/api/health`), liveness probe(`/api/health/live`)" 방향으로 교체 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `9-observability.md §1.1` mermaid 액터 라벨이 단일 `/api/health` 를 "k8s liveness / 사용자" 로 표기 — draft 채택 시 즉시 허위 | draft §영향받는 문서 (substantive) | `spec/data-flow/9-observability.md §1.1` mermaid + Rationale S3 권고 문장 | mermaid 를 liveness(`/api/health/live`) / readiness·사용자(`/api/health`) 두 경로로 분기. Rationale S3 절 재서술 (draft 갱신 예정 확인 필요) |
| 2 | cross_spec | `3-error-handling.md §7.2` HTTP status code 미기술 — SoT 분산 위험 | draft §C-1 "status !== 'healthy' → HTTP 503" | `spec/5-system/3-error-handling.md §7.2` | §7.2 에 HTTP 200/503 테이블 추가 또는 "상세는 `9-observability.md §1.1`" cross-ref 1줄 추가 |
| 3 | cross_spec | `16-system-status-api.md Rationale R-4` — probe 역할 전환 후 독자 혼동 가능성 (논리는 유효하나 liveness 컨텍스트 의존) | draft §C-1 | `spec/5-system/16-system-status-api.md Rationale R-4` | R-4 에 "HTTP status code 및 probe 역할 분리는 `9-observability.md §1.1` 참조" cross-ref 1줄 추가 |
| 4 | cross_spec | `9-observability.md Rationale` S3 권고("liveness probe 용 세계" 전제) — draft 채택 시 근거 소멸 | draft Rationale "왜 liveness 를 분리하는가" | `spec/data-flow/9-observability.md Rationale` S3 절 | readiness probe(`/api/health`)에 S3 ping 추가 가능·timeout 권장 방향으로 재서술 |
| 5 | convention_compliance | `worktree` 필드 값이 전체 경로(`.claude/worktrees/health-probe-status-d9a184`) — 규약 기대값은 디렉토리 이름만 | frontmatter `worktree` 필드 | `.claude/docs/plan-lifecycle.md §4` 예시 형식 | `worktree: health-probe-status-d9a184` (경로 prefix 제거) |
| 6 | convention_compliance | `spec/data-flow/9-observability.md` 가 spec-impl-evidence 가드 범위 밖 (`spec/data-flow/` 미포함) — 커버리지 갭 | draft §영향받는 문서 (substantive 변경 대상) | `spec/conventions/spec-impl-evidence.md §1` 적용 범위 목록 | (a) draft 본문에 수동 감사 필요 노트 추가, 또는 (b) `spec/data-flow/` 를 spec-impl-evidence 적용 대상으로 추가하는 follow-up |
| 7 | naming_collision | `spec/5-system/3-error-handling.md §7` 가 `/api/health` 를 "liveness probe 용" 으로 기술 — readiness 재정의 후 미갱신 시 혼선 (cross_spec Critical #2 와 동일 근원, WARNING 등급으로 통합) | draft §C-1 readiness 재정의 | `spec/5-system/3-error-handling.md` 라인 380 | target_specs 에 추가 후 "liveness probe 용" → "readiness probe 용" 정정, `/api/health/live` liveness 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 요구사항 ID 신규 부여 없음 — spec ID namespace 충돌 없음 | draft 전체 | 해당 없음 |
| 2 | cross_spec | `HEALTH_CHECK_LOG` 환경변수 — spec·코드베이스 전역 충돌 없음 | draft §C-4 | 구현 시 `.env.example` 및 운영 가이드 추가 (draft 에 계획됨) |
| 3 | convention_compliance | `target_specs` 비표준 frontmatter 키 — 추가 필드 허용 범위 내. Gate C `spec_impact` 와 중복 선언 가능성 | frontmatter `target_specs` | 완료 시 `spec_impact` 를 `target_specs` 기준으로 채우도록 체크리스트 명시 권장 |
| 4 | convention_compliance | `## 영향받는 문서` 의 spec 이식 완료 여부 체크 없음 | `## 후속 (구현 — developer)` 섹션 | 체크리스트에 "9-observability.md §1.1 + Rationale 갱신 완료 확인" 항목 추가 권장 |
| 5 | plan_coherence | `spec-sync-structural-followups §B` 의 `9-observability` 구조 정리 항목이 열려 있음 — 직교 작업, 충돌 없음 | `plan/in-progress/spec-sync-structural-followups.md §B` | target 머지 후 해당 항목 실행 시 최신 `9-observability.md` 기반으로 consistency-check 수행 |
| 6 | plan_coherence | `exec-intake-queue-impl.md` 의 `9-observability` 참조는 이미 완료([x]) — 범위 비중복 | 해당 없음 | 충돌 없음 |
| 7 | naming_collision | plan 로컬 레이블 `C-1`~`C-4` 가 `spec-sync-structural-followups.md` 의 C-1~C-19 와 중복 — 사소한 독자 혼동 가능성 | `plan/in-progress/spec-sync-structural-followups.md` | plan 내부 변경 ID 에 파일명 prefix 도입(예: `HP-C-1`), 또는 spec-sync-structural-followups 완료 후 활성화하면 자연 해소 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `3-error-handling.md §7` liveness/readiness 역할 직접 충돌 (target_specs 누락) + `9-observability.md §1.1` mermaid 허위화 |
| rationale_continuity | NONE | 기존 Rationale 기각 결정 재도입·invariant 위반 없음 |
| convention_compliance | CRITICAL | plan frontmatter `started` 필드 누락 → build guard 차단 예상 |
| plan_coherence | NONE | 활성 worktree 중 target spec 파일 병렬 편집 없음, 미해결 결정 우회 없음 |
| naming_collision | LOW | 실질 namespace 충돌 없음; `3-error-handling.md §7` 의미 충돌은 WARNING (cross_spec 과 동일 근원) |

## 권장 조치사항

1. **(BLOCK 해소 — 즉시)** `plan/in-progress/spec-draft-health-probe-status.md` frontmatter 에서 `created:` → `started:` 로 필드명 교체. `worktree:` 값에서 경로 prefix 제거(`health-probe-status-d9a184` 만 유지).
2. **(BLOCK 해소 — 즉시)** `spec/5-system/3-error-handling.md` 를 draft `target_specs` 목록에 추가. §7.2 Note 를 "readiness probe(`/api/health`): 의존성 장애 시 HTTP 503 / liveness probe(`/api/health/live`): 항상 HTTP 200" 방향으로 교체 예정 명시.
3. **(WARNING 해소 — spec 편집 시)** `9-observability.md §1.1` mermaid 를 liveness/readiness 두 경로로 분기. Rationale S3 절을 readiness probe 기준으로 재서술.
4. **(WARNING 해소 — spec 편집 시)** `16-system-status-api.md Rationale R-4` 에 probe 역할 분리 cross-ref 추가.
5. **(WARNING 해소 — spec 편집 시)** `3-error-handling.md §7.2` 에 HTTP 200/503 의미 테이블 또는 SoT cross-ref 추가.
6. **(INFO — 권장)** draft `## 후속` 체크리스트에 "9-observability.md §1.1 + Rationale 갱신 완료 확인" 항목 추가. `spec/data-flow/` spec-impl-evidence 가드 범위 외 사실을 본문에 노트.
