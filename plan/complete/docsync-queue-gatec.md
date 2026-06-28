---
worktree: docsync-queue-gatec-1dcb6c
started: 2026-06-28
owner: developer
priority: optional
spec_impact: none
---

# (B) 반복 회귀 근본 정비 — Gate C 실패형 경고 + 신규 큐 동반갱신 매트릭스

> 이번 세션에서 `#733`/`#738` 가 같은 종류 누락(spec_impact 형식, 신규 큐 동반갱신)을 반복.
> 증상(개별 회귀)은 #735/#740/#748 로 막았고, 본 작업은 **재발 방지 가드/문서**를 보강.

## 작업 단위

- [x] **B-1** `.claude/docs/plan-lifecycle.md` Gate C 섹션에 `spec_impact` **흔한 실패형** 명시:
      bare string → fail(리스트로), 빈 배열 `[]` → fail(무변경은 `none`), spec-only PR 은 unit 미실행이라 회귀 누출 → `complete/` 이동 직후 `spec-plan-completion` 확인 권고
- [x] **B-2** `PROJECT.md §변경 유형 매핑` + `.claude/config/doc-sync-matrix.json` 에 **"신규 BullMQ 큐 추가"** 행 추가 (1:1 binding 유지):
      targets = `MONITORED_QUEUES`(constants.ts) · `system-status.e2e` `EXPECTED_QUEUE_NAMES` · `spec/16` §1 큐 표 · `spec/data-flow/0-overview` §3 개수+§4 카탈로그.
      #738 이 큐 추가 시 이 surface 들을 동시 누락 → 매트릭스 행 부재가 근본 원인.

## 검증

- [x] `python3 -m unittest test_doc_sync_matrix` 7/7 통과 (JSON↔표 행수 20:20, guard/convention/glob 참조 실존)
- [x] JSON 유효성 (rows 20)

## 비고

- harness/문서 전용 변경(`codebase/` 코드 무변경) → CODE-REVIEW push 게이트 비대상(review_guard 는 codebase/ 변경 시만). spec/ 무변경이라 SPEC-CONSISTENCY 게이트도 비대상.
- 유일 강제 가드(`test_doc_sync_matrix.py`)는 통과. plan-lifecycle.md 변경은 문서(가드 없음).
