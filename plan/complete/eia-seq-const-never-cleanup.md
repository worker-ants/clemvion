---
worktree: eia-seq-const-never-6060a2
started: 2026-06-27
owner: developer
priority: optional
parent: plan/complete/eia-distributed-seq-load-verify.md
spec_impact: none
---

# (선택) seq-load cleanup 후속 — 모듈 상수화 + `as never` 정리

> #735 리뷰의 후속 INFO(#3 모듈 상수, #5 service.spec `as never`) 정리. 코드 동작 무변경.

## 작업 단위

- [x] load spec: `WARMUP`/`SAMPLES` 지역 상수 → 모듈 레벨 `LATENCY_WARMUP_COUNT`/`LATENCY_SAMPLE_COUNT`
- [x] `execution-seq-allocator.service.spec.ts`: 8곳 `as never` → `as unknown as RedisConnectionProvider` (e2e spec 과 동일 패턴, `import type` 추가)

## 진행 중 발견한 별개 회귀 (#738 유입 — 본 작업과 무관, unblock 위해 동봉 수정)

- [x] `plan/complete/trigger-review-deferred-fixes.md` — W1·W7 이 spec 변경(12-webhook·data-flow 3건)했는데 `complete/` 이동 시 `spec_impact` 누락 → frontend Gate C unit 실패. #738 의 실제 spec diff 근거로 리스트 채움
- [x] `system-status.e2e-spec.ts` — #738 W7 신규 큐 `workspace-invitations-pruner` 가 `MONITORED_QUEUES`(프로덕션)엔 추가됐으나 e2e `EXPECTED_QUEUE_NAMES` 미갱신 → e2e 실패. 큐 목록에 추가

## 검증 (TEST WORKFLOW)

- [x] lint
- [x] unit (Gate C 회귀 수정 포함)
- [x] build
- [x] e2e (218 — load spec ≈76k events/s, latency median 0.070ms; system-status 큐 목록 수정 포함)
- [x] /ai-review (LOW, Critical 0 / WARNING 3 — W2·W3 현행유지, W1·SPEC-DRIFT 는 #738 후속으로 분리(task_5fd0aea7). RESOLUTION.md)

## #738 후속 분리 (본 PR scope 외)

리뷰가 #738 의 더 깊은 누락 2건을 추가 식별 → 별도 작업(`task_5fd0aea7`)으로 분리:
- W1: `triggers.mdx`/`.en.mdx` 의 `endpointPath` 예시값이 UUID 강제 후 stale
- SPEC-DRIFT: `spec/5-system/16-system-status-api.md` §1 큐 표에 `workspace-invitations-pruner` 누락
