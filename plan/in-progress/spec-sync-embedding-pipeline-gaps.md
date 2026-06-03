---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# embedding-pipeline — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/8-embedding-pipeline.md

## 미구현 항목
- [ ] §4.3 CSV 전용 청킹 — 행 단위 청크 구성 / chunk_size 내 다행 결합 / 행 중간 미분할. 현재 `csv.parser.ts` 가 행을 `\n` join 한 단일 문자열을 반환하고 공통 `chunkText()`(`\n\n+` 분할)를 통과하므로 행 중간 분할이 가능하다.
- [ ] §6.1 DocumentChunk.metadata `{ page?, section? }` 채우기 — 현재 `embedding.service.ts` 가 모든 청크에 대해 `JSON.stringify({})` (빈 객체)를 INSERT. 파서가 page/section 을 추출해 청크 metadata 로 전달하는 경로 없음.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__8-embedding-pipeline.md 참조.
- 검증 근거: `codebase/backend/src/modules/knowledge-base/parsers/csv.parser.ts` (행을 `\n` join), `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts` (`Chunk` 인터페이스에 metadata 필드 없음, `\n\n+` 분할), `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts:273` (`JSON.stringify({})`).
