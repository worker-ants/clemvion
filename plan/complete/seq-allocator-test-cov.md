---
worktree: seq-allocator-test-cov-74e999
started: 2026-06-28
owner: developer
priority: optional
spec_impact: none
---

# (C-1) ExecutionSeqAllocator 커버리지 갭 보강

> #740 리뷰 INFO(#3 sanitize, #4 release DEL 실패) — allocator 의 두 best-effort/보안 경로가 unit 미검증.
> 프로덕션 코드 무변경 — 테스트만 추가.

## 작업 단위

- [x] `sanitize` (private static, 로그 인젝션 방지) 직접 테스트 — CR/LF/탭 → 공백, 128자 cap, 비문자열 String() 강제
- [x] `release` 의 DEL reject 경로 — `client.del().catch()` 가 throw 없이 swallow + `logger.warn` 1회 (fire-and-forget, unhandled rejection 아님)

## 비고 (진행 중 발견)

- W3(TTL 헬퍼 추출)·W1·SD1 은 본 작업 착수 전 이미 #748/#749 로 해소됨 → 칩 task_5fd0aea7 소진. 본 PR 은 C-1(sanitize/release 커버리지)만.

## 검증

- [x] lint
- [x] unit (backend — 신규 5 케이스: sanitize 4(치환·cap·128/129 경계·비문자열) + release-reject 1. frontend schedules-page flaky 1건은 단독 재실행 10/10 green 으로 무관 확인)
- [x] /ai-review (LOW, Critical/Warning 0 — INFO 채택분 반영: 128/129 경계·warn 메시지 검증·spy try/finally·주석. RESOLUTION.md)
- build·e2e: 프로덕션 코드 무변경(unit-spec 추가만) → 무관
