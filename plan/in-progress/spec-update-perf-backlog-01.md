---
worktree: plan-complete-turn-timing-aa533b
started: 2026-06-10
owner: developer (draft) → project-planner (적용)
spec_impact:
  - spec/data-flow/4-file-storage.md
  - spec/5-system/4-execution-engine.md
  - spec/4-nodes/1-logic/10-parallel.md
---

# Spec update — perf 백로그 01 구현 동반 문구 동기화 (반영 완료)

> developer draft → `/consistency-check --spec` (세션 `review/consistency/2026/06/10/20_14_50`, **BLOCK: NO**) → 반영.
> 두 건 모두 **행위 의미 불변**의 code-sync 문구 갱신. 검토 WARNING(§1.6 오참조)·INFO(진입점 표·Rationale 병기) 반영해 교정.

## 1. `spec/data-flow/4-file-storage.md` — KB 삭제 S3 정리 (perf #2) ✅

- 흐름표 "KB 삭제" 행 + 인용 블록: 단건 for 루프 → `deleteMany(keys)` (`DeleteObjectsCommand` 1000키/요청 청크) 배치 서술로 갱신.
- Overview 코드 진입점 표에 `deleteMany(keys)` 추가 (검토 INFO 1).
- `## Rationale > s3Service.delete 실패가 warn 처리인 이유` 에 배치 partial-failure(`Errors[].Key` 일괄 warn) 병기 — best-effort 의미 동일 명시 (검토 INFO 2).

## 2. env read-once 문구 (perf #14) ✅ — 위치 교정: ~~§1.6~~ → **§2.1 + 10-parallel.md**

- `spec/5-system/4-execution-engine.md` **§2.1 순환 참조 제한 표** `MAX_NODE_ITERATIONS` 행에 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 (§11 worker env 동일 규약)" 추가. (검토 WARNING: draft 의 §1.6 은 미존재 섹션 오참조였음 — 교정.)
- `PARALLEL_ENGINE` 은 엔진 spec 에 없고 `spec/4-nodes/1-logic/10-parallel.md:14` rollback card 가 소유 — 해당 문장에 read-once 병기.

## 체크리스트

- [x] `/consistency-check --spec` — **BLOCK: NO** (Warning 1 = §1.6 오참조 → 본 문서에서 교정 반영)
- [x] 1·2 반영 (3개 spec 파일) — frontmatter `code:` 추가 불요 확인 (변경 파일 모두 기존 glob 내)
- [x] frontmatter `spec_impact` 선언 (Gate C)
- [x] 반영 후 본 draft 를 `plan/complete/` 로 이동
