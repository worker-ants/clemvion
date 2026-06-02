# Consistency Check 통합 보고서 (--impl-prep spec/5-system/)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**MEDIUM** — spec 간 어휘 불일치(health 3단계 값) 및 RBAC·API 컨벤션 문서에 신규 API 예외 미반영. 모두 target 변경 없이 관련 spec 동기화로 해결 가능한 WARNING. Critical 없음.

## Critical 위배
해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | 충돌 대상 | 제안 | 본 PR 처리 |
|---|---------|------|-----------|------|-----------|
| W-1 | Cross-Spec | `down` vs `unhealthy` health 어휘 분기 | `3-error-handling.md §7.2` /api/health (`healthy\|degraded\|unhealthy`) | §7.2 에 큐 상태 API 별도 어휘 노트(R-4 참조) | ✅ 동기화 |
| W-2 | Cross-Spec | RBAC 매트릭스에 System Status 미등록 | `1-auth.md §3.2` RBAC | `System Status \| R\|R\|R\|R` 행 + 전역 예외 각주 | ✅ 동기화 |
| W-3 | Cross-Spec | 워크스페이스 스코핑 예외 미반영 | `2-api-convention.md §2.3` | 시스템 전역 API 예외 카테고리 + 첫 사례 등재 | ✅ 동기화 |
| W-4 | Convention | `1-auth.md §1.5.4` 초대 에러코드 6개 lower_snake_case | `error-codes.md §1` UPPER_SNAKE | UPPER_SNAKE 교정 | ⛔ 무관 기존이슈 — 별도 |
| W-5 | Convention | `10-graph-rag.md` Overview/본문 경계 모호 | 3섹션 규약 | 구조 정리 | ⛔ 무관 기존이슈 — 별도 |
| W-6 | Convention | `10-graph-rag.md` Rationale 용어·비목표 중복 | 저장 위치 규약 | 본문 이동 | ⛔ 무관 기존이슈 — 별도 |
| W-7 | Naming | health 어휘 중첩 (W-1 동일 현상) | 동상 | W-1 과 함께 처리 | ✅ (W-1 로 해소) |

> W-1·W-7 은 동일 어휘 불일치 — `3-error-handling.md §7` 노트 1건으로 해소.

## 참고 (INFO) 주요
- I-1: `data-flow/9-observability.md` 에 System Status 흐름 추가 권장
- I-2: `0-overview.md §8` 문서 맵 + §6.3 로드맵에 System Status 등록 권장
- I-10~13: 신규 식별자(`system-status`/`system-status-api` id, `QueueRegistry`/`QueueStatusDto`/`SystemStatusOverviewDto`, `GET /api/system-status/overview`, `SYSTEM_STATUS_*_THRESHOLD`) — 충돌 없음 확인
- I-6·I-9: stale worktree/plan 정리 권장 (target 무관)

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | MEDIUM (W-1,2,3) |
| Rationale-Continuity | (output 재생성됨, 위반 없음) |
| Convention-Compliance | MEDIUM (W-4,5,6 — 무관 기존이슈) |
| Plan-Coherence | NONE (target 경합 없음) |
| Naming-Collision | LOW (신규 식별자 실질 충돌 없음) |

## 본 PR 조치 결정
- W-1/W-2/W-3/W-7: 내 신규 spec 의 직접 entailment → spec 동기화 수행 후 구현.
- W-4/W-5/W-6: 본 기능과 무관한 기존 spec 결함 → 본 PR 범위 밖, plan 에 기록만 (scope 확대 방지).
- I-1/I-2: 구현 완료 단계에서 후속 문서 동기화.
