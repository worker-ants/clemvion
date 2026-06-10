---
worktree: plan-complete-turn-timing-aa533b
started: 2026-06-10
owner: developer (draft) → project-planner (적용)
---

# Spec update draft — perf 백로그 01 구현 동반 문구 동기화 (2건)

> developer 는 `spec/` read-only — 본 draft 를 project-planner 가 `/consistency-check --spec` 후 반영한다.
> 두 건 모두 **행위 의미 불변**의 code-sync 문구 갱신 (consistency-check `19_06_27` I1 판정: 비차단).

## 1. `spec/data-flow/4-file-storage.md` — KB 삭제 S3 정리 문구 (perf #2)

- 대상: 흐름표의 "KB 삭제" 행(:100 부근) + "`s3Service.delete(doc.fileUrl)` 를 for 루프로 호출하여 수행한다"(:103 부근).
- 변경: 단건 for 루프 서술 → "`s3Service.deleteMany(keys)` — `DeleteObjectsCommand` 1000키/요청 청크 배치 삭제. 부분 실패는 응답 `Errors[].Key` 를 일괄 warn(best-effort 의미론 불변), 명령 단위 실패도 warn 후 KB row 삭제 진행."
- 불변: Rationale 의 best-effort/warn 정책 서술, line 93 "GC batch" 문구(독립).

## 2. `spec/5-system/4-execution-engine.md §1.6` — env read-once 문구 (perf #14)

- 대상: §1.6 표의 `MAX_NODE_ITERATIONS` 행 (+ `PARALLEL_ENGINE` 언급 위치).
- 변경: §11 자매 env 와 동일한 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영" 문구 추가 (구현: 인스턴스 수명 lazy read-once 캐시).

## 체크리스트

- [ ] project-planner: `/consistency-check --spec` 본 draft → BLOCK 확인
- [ ] 1·2 반영 + frontmatter `code:` 영향 확인 (변경 파일은 기존 glob 내 — 추가 불요 예상)
- [ ] 반영 후 본 draft 를 `plan/complete/` 로 이동
