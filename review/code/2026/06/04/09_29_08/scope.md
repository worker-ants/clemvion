# Scope Review

## 발견사항

범위 이탈 발견 없음.

모든 변경은 명확하게 연관된 AGM 번호(AGM-08/AGM-09/AGM-10/AGM-11)로 추적 가능하며, 각 파일의 변경 목적이 persistent 메모리 기능 강화 작업 범위 안에 있다.

### 파일별 범위 검토 요약

- **V079 SQL 마이그레이션**: `expires_at` 컬럼 추가 + partial index — AGM-10 TTL 기능에 필요한 최소 변경. 범위 외 없음.
- **agent-memory.service.ts**: TTL(`ttlDays`), 의미 기반 dedup(`findSimilarFact`/`findSimilarInBatch`/`updateMemory`/`insertMemory`), 만료 row evict(`evictExpiredAndOldest`) 추가 — AGM-09/AGM-10에 직접 대응. `evictOldest` → `evictExpiredAndOldest` 이름 변경은 동작 변경과 함께 이루어져 순수 리팩토링이 아님.
- **agent-memory.service.spec.ts**: 신규 기능에 대한 테스트 추가 — 범위 일치.
- **agent-memory-extraction.queue.ts**: `ttlDays` 필드 추가(AGM-10), `MemoryKind`/`ExtractedItem` 타입 및 `parseExtractionResponse` 반환 타입 변경(AGM-11), 프롬프트 업데이트 — 모두 해당 AGM과 직접 연결.
- **agent-memory-extraction.queue.spec.ts**: `parseExtractionResponse` 테스트 업데이트 — 신규 shape(AGM-11)에 맞춰 기존 테스트 케이스를 수정 및 추가. 범위 일치.
- **agent-memory-extraction.processor.ts**: `ttlDays` 전달(AGM-10), `item.kind` 저장(AGM-11) — 범위 일치.
- **agent-memory-extraction.processor.spec.ts**: AGM-10/AGM-11 테스트 추가, 기존 첫 테스트에 주석 한 줄 추가 — 범위 일치.
- **ai-agent.handler.ts**: 증분 추출 watermark(AGM-08), `ttlDays` 전달(AGM-10), `resolveMemoryTtlDays` private 메서드, `memoryTtlDays` config 전달 — 모두 AGM 기능과 직결.
- **ai-agent.memory.spec.ts**: AGM-08/AGM-10 테스트 추가 — 범위 일치.
- **ai-agent.schema.ts**: `memoryTtlDays` 필드 추가 — AGM-10 UI 노출. 범위 일치.
- **ai.en.mdx / ai.mdx**: `memoryTtlDays` 문서 추가 — 기능 릴리스에 따른 문서 갱신. 범위 일치.
- **backend-labels.ts**: `memoryTtlDays` i18n 라벨·힌트 추가 — 신규 UI 필드에 대응하는 최소 i18n. 범위 일치.

## 요약

전체 변경은 persistent 메모리의 TTL 만료(AGM-10), 의미 기반 dedup(AGM-09), 증분 추출 watermark(AGM-08), 추출 항목 분류(AGM-11) 네 가지 기능을 구현한 것으로, 각 변경 파일이 명확히 하나 이상의 AGM 번호에 귀속된다. 불필요한 리팩토링, 무관 파일 수정, 포맷팅만의 변경, 미사용 임포트 추가 등 범위 이탈 징후는 없다. 의도된 기능 범위를 정확히 커버한다.

## 위험도

NONE
