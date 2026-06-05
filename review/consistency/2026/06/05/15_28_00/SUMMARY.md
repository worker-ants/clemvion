# Consistency (--impl-done) 통합 — V086 인덱스

**BLOCK: NO** — Critical 0. 3 checker.

## 확인(정상)
- naming: 인덱스명 `idx_agent_memory_scope_updated`·V086·plan명 충돌 없음(NONE).
- convention: 마이그레이션 파일명·.conf 페어링·executeInTransaction=false·CONCURRENTLY IF NOT EXISTS·DOWN 주석·V번호 단조 전부 규약 충족. (plan spec/spec_impact 중복 → code 리뷰에서 spec 제거 조치.)

## ⚠️ FALSE POSITIVE (merge-base 미사용 오귀속 — git 반증)
cross-spec·side-effect 가 본 PR diff(merge-base 84dd7314..HEAD, 7파일) 밖을 비교해 오보:
- cross-spec W-01/W-02 "V086 가 17-agent-memory §1/AGM-02·data-model §3 에 미등재" → **FP. 본 diff 가 정확히 등재함**(spec/5-system/17-agent-memory.md·1-data-model.md 변경 포함).
- cross-spec W-03·side-effect "AGM-12/§6/NAV-AM 삭제 + listScopes 미구현" → **FP. A1(#471) 머지로 main 에 존재**(본 PR 미삭제·미관여). V086 주석의 AGM-12 참조 정당.
- cross-spec I-01 "V083~085 Execution 컬럼 삭제" → **FP. exec-park 작업, 본 PR 무관**(diff 에 해당 파일 0).
- cross-spec I-02 ".conf 누락" → **FP. .conf 본 diff 포함**.
- convention "pending_plans dangling(admin-ui/summary-model)" → 본 worktree(main 기반, #481 미머지)엔 두 plan 이 in-progress 실존 → 유효. #481 이 정리.

## checker별 BLOCK: cross-spec NO · convention NO · naming NO
