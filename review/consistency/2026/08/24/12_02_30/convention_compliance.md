# 발견사항

## [INFO] `execution.node.completed`/`.failed` 두 행의 Principle 3.2 인용 형식 불일치

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 목록 표, `execution.node.completed` 행과 `execution.node.failed` 행 (이번 diff 로 두 행 모두 수정됨)
- **위반 규약**: 엄밀한 "위반"은 아니며 `spec/conventions/node-output.md` §3.2 크로스레퍼런스 관행과의 **일관성 미세 편차**
- **상세**: 같은 diff 에서 나란히 수정된 두 행이 같은 Principle 3.2 를 인용하면서 형식이 다르다 — `completed` 행은 `"CONVENTIONS Principle 3.2 가 말하는 output.error"` 로 **링크 없이** 산문 인용하는 반면, `failed` 행은 `[CONVENTIONS Principle 3.2](../conventions/node-output.md#32-outputerror-표준-형태)` 로 **명시적 anchor 링크**를 건다. 이 문서 전반은 CONVENTIONS 참조 시 anchor 링크를 붙이는 패턴이 지배적이라(Principle 4.5, Principle 7 등 모두 링크형), `completed` 행만 링크가 빠진 것은 이 PR 이 만든 새로운 편차다.
- **제안**: `completed` 행의 "CONVENTIONS Principle 3.2" 도 `[CONVENTIONS Principle 3.2](../conventions/node-output.md#32-outputerror-표준-형태)` 형태로 링크화. 사소하므로 강제 아님.

## [INFO] KB 이벤트 콜론 표기 vs execution 이벤트 dot 표기 — 스코프 밖(旣존) 이나 참고로 남김

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.3 (`document:embedding_started` 등)
- **위반 규약**: 없음 — Rationale "KB 채널 단위 전환" 항목이 "backend type union 의 형식과 일치" 를 근거로 명시적으로 정당화하고 있어 규약 위반이 아니라 **문서화된 의도적 예외**다.
- **상세**: 이번 diff 대상이 아니며(사전 존재), execution 계열이 `execution.node.completed` dot-notation 인 것과 대비해 KB 계열만 `document:embedding_started` colon+underscore 인데, 근거가 spec 본문에 이미 적혀 있어 발견사항이라기보다 확인 완료 항목이다.
- **제안**: 조치 불필요. 참고로만 기록.

# 확인 완료 (규약 준수 검증 — 위반 없음)

이번 diff(`spec/5-system/6-websocket-protocol.md` §4.1·§4.4, `spec/5-system/14-external-interaction-api.md` §R17)와 그 근거가 되는 코드(`websocket.service.ts`/`.spec.ts`)를 대조한 결과, 아래 규약 항목에서 위반을 찾지 못했다:

1. **에러 코드 명명** — `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY`/`EXECUTION_INTERNAL_ERROR`/`INVALID_EXECUTION_STATE`/`RESUME_*` 등 전부 `spec/conventions/error-codes.md` §1 의 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙을 따르며, 코드베이스 `error-codes.ts`/`ws-error-codes.ts` 의 실제 enum 값과 1:1 일치 확인.
2. **`config`/`output`/`nodeOutput` 형태** — §4.2 `buttonConfig.nodeOutput` 판별자 미포함 서술이 `node-output.md` Principle 1.1.4 (`type` 판별자 폐지)와 정합. `output.error` 표준 형태·`details.retryable`/`retryAfterSec` invariant 인용이 Principle 3.2/3.2.1 과 정합.
3. **egress 마스킹 좌표계** — §4.1 캐비엇의 `MAX_SANITIZE_DEPTH` 별개 불변식 서술이 `egress-masking.md` 표 4행과 정확히 일치.
4. **`seq` / Redis 키** — `exec:seq:<executionId>` 참조가 `redis-keys.md` 표와 일치.
5. **`ConversationTurnSource` 2값↔5값 매핑** — `conversation-thread.md` §1.1 의 backend 5값 enum과 §4.4.6 매핑표가 정합.
6. **`interactionType` 4값** (`form`/`buttons`/`ai_conversation`/`ai_form_render`) — `interaction-type-registry.md` §1.1 단일 진실과 일치.
7. **코드-스펙 일치** — 새로 추가된 `execution.node.completed`/`.failed` 의 `envelope.output` fail-closed allowlist 서술이 실제 `websocket.service.ts`/`.spec.ts` diff 와 1:1 대응(narrowTopLevelNodeOutput 헬퍼, 6곳 emit 카운트, DB 실측 표까지 모두 코드와 정합).
8. **anchor 링크 유효성** — 이 리뷰에서 검증한 모든 `#섹션-앵커` 형태 링크(node-output.md, conversation-thread.md, egress-masking.md 대상)가 실제 heading 과 일치.

# 요약

이번 PR(`node-output-envelope-458f05`)의 diff 는 `spec/5-system/6-websocket-protocol.md` §4.1/§4.4 와 `spec/5-system/14-external-interaction-api.md` §R17 에서 `execution.node.completed`/`.failed` 의 `envelope.output` fail-closed allowlist 적용을 문서화하는 편집이며, 명명 규약(UPPER_SNAKE_CASE 에러 코드)·출력 포맷 규약(`NodeHandlerOutput` 5필드, `output.error` 표준 형태, config/output 직교성)·egress 마스킹 좌표계·`ConversationTurnSource`/`WaitingInteractionType` enum 정합성 등 관련 정식 규약(`spec/conventions/node-output.md`, `error-codes.md`, `egress-masking.md`, `conversation-thread.md`, `interaction-type-registry.md`, `redis-keys.md`) 전반에 걸쳐 위반 없이 정합했다. 발견된 사항은 같은 diff 내 두 인접 행의 Principle 3.2 인용 링크 형식이 다르다는 INFO 1건뿐이며, 이는 실질적 규약 위반이 아니라 사소한 표기 통일성 제안이다. CRITICAL/WARNING 급 규약 위반은 발견되지 않았다.

# 위험도

NONE
