### 발견사항

해당 없음 (직접 DB 쿼리 없음)

---

단, 데이터베이스에 **간접적으로 영향을 주는 설계 패턴** 2가지가 발견됩니다.

---

**[WARNING]** `_resumeState` JSON 블롭 무제한 성장
- 위치: `ai-agent.handler.ts:743-768` (`executeMultiTurn`), `ai-agent.handler.ts:1043-1068` (`processMultiTurnMessageInner`)
- 상세: `_resumeState`는 매 턴마다 DB에 upsert되는 JSON 컬럼으로 추정됩니다. 이 객체에 `messages` (턴당 최소 2개 + tool 메시지), `turnDebugHistory` (llmCalls 전체 payload 포함), `ragSources`, `lastTurnRequest/Response` (전체 컨텍스트 윈도우 포함)가 누적됩니다. 기본 `maxTurns: 20`, tool call이 많은 경우 수백 KB~수 MB까지 커질 수 있어, JSONB 쓰기 증폭과 WAL 부담이 발생합니다.
- 제안: `turnDebugHistory`에서 `llmCalls[].requestPayload`(전체 messages 배열 포함)는 resume에 불필요하므로 별도 스토리지(예: S3)로 분리하거나 DB persist 시 제거. `ragSources`는 chunkId만 저장하고 조회 시 조인하는 방식도 고려.

---

**[INFO]** `KbToolProvider.buildTools` 내 잠재적 N+1 패턴
- 위치: `ai-agent.handler.ts:1313-1327` (`buildTools`), `ai-agent.handler.spec.ts:34-41` (mock 패턴)
- 상세: 테스트에서 `mockKbService.findById`가 KB ID별로 개별 호출되는 것이 확인됩니다. `buildTools`는 single_turn 실행 시 1회, multi_turn에서는 **매 사용자 메시지마다 1회** 호출됩니다 (`processMultiTurnMessageInner:837`). KB가 N개이고 대화가 M턴이면 N×M번의 `findById` 쿼리가 발생합니다.
- 제안: `buildTools` 내부에서 KB ID 목록을 `findByIds` (batch 조회)로 처리하거나, 각 `buildTools` 호출 결과를 동일 turn 내에서 캐싱.

---

**[INFO]** `.passthrough()` 스키마로 인한 DB 레거시 필드 silently 보존
- 위치: `ai-agent.schema.ts:326`
- 상세: `toolNodeIds`, `toolOverrides` 등 DB에 저장된 레거시 config 필드가 스키마 검증을 통과해 handler까지 도달하지만, handler는 이를 읽지 않습니다. 의도된 하위 호환성 설계이나, 재작성 완료 후 `.passthrough()` 제거 및 마이그레이션 스크립트로 DB 클린업이 필요합니다.
- 제안: 재작성 완료 시점에 `plan/in-progress/ai-agent-tool-connection-rewrite.md`에 따라 레거시 필드를 DB에서 제거하는 마이그레이션 계획 수립.

---

### 요약

리뷰 대상 파일들은 직접적인 DB 쿼리를 포함하지 않습니다. 데이터베이스 관점에서의 주요 위험은 `_resumeState` JSON 블롭의 무제한 성장입니다. 기본 설정(maxTurns: 20, maxToolCalls: 10)에서 `turnDebugHistory`가 매 턴 전체 LLM 요청/응답 페이로드(컨텍스트 윈도우 전체 포함)를 누적하므로, 장기 대화 시 수 MB 크기의 JSON이 매 턴마다 DB에 쓰여 쓰기 증폭과 인덱스 부담이 발생할 수 있습니다. 또한 `buildTools`에서 KB별 개별 DB 조회가 멀티턴에서 매 턴 반복되는 패턴은 KB 수가 많은 워크플로에서 주목할 필요가 있습니다.

### 위험도

**LOW**