---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# embedding-pipeline — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/8-embedding-pipeline.md

## 미구현 항목
- [x] §4.3 CSV 전용 청킹 — 행 단위 청크 구성 / chunk_size 내 다행 결합 / 행 중간 미분할. 현재 `csv.parser.ts` 가 행을 `\n` join 한 단일 문자열을 반환하고 공통 `chunkText()`(`\n\n+` 분할)를 통과하므로 행 중간 분할이 가능하다.
- [x] §6.1 DocumentChunk.metadata `{ page?, section? }` 채우기 — 현재 `embedding.service.ts` 가 모든 청크에 대해 `JSON.stringify({})` (빈 객체)를 INSERT. 파서가 page/section 을 추출해 청크 metadata 로 전달하는 경로 없음.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__8-embedding-pipeline.md 참조.
- 검증 근거: `codebase/backend/src/modules/knowledge-base/parsers/csv.parser.ts` (행을 `\n` join), `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts` (`Chunk` 인터페이스에 metadata 필드 없음, `\n\n+` 분할), `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts:273` (`JSON.stringify({})`).

## 구현 상태 (branch claude/spec-sync-impl-644d19, 2026-06-03)
- **§4.3 CSV row-aware chunking 구현 완료** — commit 836ce29f. `chunking/csv-chunker.ts` `chunkCsv()` + `embedding.service.ts` 의 `fileType === 'csv'` 분기. spec marker flip 완료 (2026-06-03 groom).
- **§6.1 chunk metadata `{page?, section?}` 는 여전히 미구현** — 재검증(2026-06-03 groom): `csv-chunker.ts:44` 및 text-chunker 가 `metadata: {}` 만 설정, `embedding.service.ts` 가 `chunk.metadata ?? {}` 를 INSERT 하므로 항상 `{}`. 파서가 page/section 을 추출하는 경로 부재. (commit 836ce29f 의 "chunk metadata" 는 metadata 컬럼 plumbing 일 뿐 page/section 채움 아님.) → spec §6.1 marker 유지, 본 ticket 은 in-progress 유지.

## §6.1 처리 결과 (2026-06-03 groom, 결정 A: 파서→metadata 경로)
- `parseDocumentSegments` 신설 — md=heading→`section`, pdf=pagerender→1-based `page`, txt=`{}`. csv 는 기존 row-aware `chunkCsv` 경로 유지(위치 메타 없음).
- `chunkText(text, options, baseMetadata)` 가 segment metadata 를 모든 chunk 에 전파. `embedding.service` 가 segment 별 chunk 의 index 를 연속 재부여.
- 테스트: md.parser.spec / pdf.parser.spec(pdf-parse mock) / text-chunker.spec baseMetadata / embedding.service.spec mock 갱신 (knowledge-base 199 pass).
