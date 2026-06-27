---
worktree: eia-seq-cleanup-d5b572
started: 2026-06-27
owner: developer
priority: optional
parent: plan/complete/eia-distributed-seq-load-verify.md
spec_impact: none
---

# (선택) seq-load e2e — 리뷰 INFO trivial cleanup 3건

> PR #730 (`/ai-review`) 에서 decline/보류했던 trivial INFO 3건을 한 PR 로 정리.
> 코드 동작 변경 없음 — 가독성·타입 안전성·DRY.

## 작업 단위

- [x] `P95_PERCENTILE = 0.95` 상수화 (latency 테스트 매직 넘버 제거)
- [x] `makeProvider` 반환 타입을 `Pick<RedisConnectionProvider, 'getClient'|'getClientOrNull'>` 로 명시 — blind `as never` → 시그니처 검사 + 주입부 `as unknown as` 이중 cast
- [x] `docker-compose.e2e.yml` `REDIS_HOST`/`REDIS_PORT` 를 `x-redis-env` YAML anchor 로 DRY (backend-e2e · backend-e2e-runner 공유)
- [x] **(발견·수정)** `plan/complete/spec-draft-eia-seq-nfr.md` 의 `spec_impact` 가 bare string → Gate C 테스트(`spec-plan-completion.test.ts`) 실패. #733(spec-only, unit 미실행)에서 유입된 회귀. YAML list 로 정정 (Gate C 규약: 리스트 또는 `none`/`없음`)

## 검증 (TEST WORKFLOW)

- [x] lint (PASS)
- [x] unit (PASS — Gate C 회귀 수정 후)
- [x] build (PASS)
- [x] e2e (PASS 218 — load spec ≈75k events/s, latency median 0.076ms; compose anchor 검증)
- [x] /ai-review (NONE, Critical/Warning 0 — INFO #6 stale path fix 적용 + RESOLUTION.md)
