# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done  
검토 범위: `spec/5-system/`  
diff-base: `107b7617c`  
변경 파일: `spec/5-system/17-agent-memory.md`, `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`

---

## 발견사항

충돌로 분류될 항목이 없다. 세 파일 각각에 대해 검토 결과를 기록한다.

### spec/5-system/17-agent-memory.md — 상태 키 원복

**변경 내용**: diff-base(`107b7617c`)에서 `_resumeState.memoryState.lastExtractionTurnSeq` (I12 결정, sub-namespace 도입)로 변경됐던 spec 기술을 `_resumeState.lastExtractionTurnSeq` (평면 키)로 되돌렸다.

**충돌 분석**:
- target이 도입하는 "신규" 식별자는 없다 — 기존 평면 키 `_resumeState.lastExtractionTurnSeq`로의 원복이다.
- 코드(`ai-memory-manager.ts`, `ai-turn-executor.ts`, `agent-memory-injection.ts`, `information-extractor.handler.ts`)는 일관되게 `lastExtractionTurnSeq`를 평면 키로 사용하고 있으며, `memoryState.lastExtractionTurnSeq` 경로는 어떤 `.ts` 파일에도 존재하지 않는다.
- 인접 spec 문서들(`spec/data-flow/13-agent-memory.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/5-system/_product-overview.md`)도 모두 평면 키 `lastExtractionTurnSeq`를 사용 중이다.

**결론**: 원복이므로 신규 식별자 도입이 없고, 기존 코드 및 인접 spec과 충돌하지 않는다.

---

### spec/5-system/12-webhook.md — POST 전용 규칙 스코프 명문화

**변경 내용**: "POST 전용" 규칙이 트리거 진입 엔드포인트(`/api/hooks/:endpointPath`)에 한정되며, 하위 서브경로는 각 영역 spec이 별도로 정의할 수 있다는 clarification 추가. 예시로 `GET /api/hooks/:endpointPath/embed-config`를 참조.

**충돌 분석**:
- 새 엔드포인트 도입 없음. `GET /api/hooks/:endpointPath/embed-config`는 이미 `spec/7-channel-web-chat/4-security.md §3-①`과 `hooks.controller.ts`(`@Get(':endpointPath/embed-config')`)에 정의·구현된 기존 엔드포인트다.
- 신규 요구사항 ID, 환경변수, 이벤트명 없음.

**결론**: 기존 식별자에 대한 참조 clarification이며 충돌 없음.

---

### spec/5-system/2-api-convention.md — 페이지네이션 응답 구조 주석 추가

**변경 내용**: `PaginatedResponseDto`(`{ data, pagination }`)가 top-level 형제 구조로 pass-through된다는 설명 주석을 §5.2 아래에 추가.

**충돌 분석**:
- 신규 타입명 없음. `PaginatedResponseDto`는 이미 `spec/conventions/swagger.md §2-5`, `spec/3-workflow-editor/4-ai-assistant.md`, 코드 `common/dto/paginated-response.dto.ts`에 정의된 기존 DTO다.
- 주석이 설명하는 `data`, `pagination` 필드 이름, `TransformInterceptor` pass-through 동작은 이미 `spec/conventions/swagger.md §5-2`에 canonical 정의가 있으며 cross-ref 링크를 포함한다. 내용이 일치하므로 중복 정의 충돌 없음.

**결론**: 기존 식별자에 대한 문서 강화이며 충돌 없음.

---

## 요약

`spec/5-system/` 대상 diff(diff-base `107b7617c`)가 도입하는 진정한 신규 식별자는 없다. 세 변경 모두 기존에 존재하는 키·타입·엔드포인트에 대한 원복 또는 clarification이다. 특히 `_resumeState.lastExtractionTurnSeq` 원복은 코드 실체와 인접 spec 모두와 정렬을 맞추는 수정으로, 이전 spec이 도입한 `memoryState` sub-namespace(`_resumeState.memoryState.lastExtractionTurnSeq`)가 구현 없이 spec에만 남아 있던 상태를 해소한다. 요구사항 ID·엔티티명·API 엔드포인트·이벤트명·환경변수·파일 경로 어느 관점에서도 충돌이 발견되지 않는다.

## 위험도

NONE
