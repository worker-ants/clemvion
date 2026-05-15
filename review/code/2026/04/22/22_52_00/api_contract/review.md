## 발견사항

### [INFO] 합성 plan 이벤트의 `id` 필드 포맷이 실제 tool call ID와 다름
- **위치**: `workflow-assistant-stream.service.ts` — 복구 경로 `syntheticCallId = 'leak_' + randomUUID()`
- **상세**: 정상 경로의 plan 이벤트 `id`는 LLM이 할당한 tool call ID(예: `call_abc123`)이고, 복구 경로는 `leak_{uuid}` 형태. 프론트엔드가 이 ID를 불투명 식별자로만 사용하면 무해하지만, 패턴 검사나 중복 제거 로직이 있다면 예상치 못한 동작 가능.
- **제안**: 프론트엔드 SSE 소비 코드에서 `id`를 opaque key로만 취급하는지 확인. 그렇지 않다면 ID 포맷 문서화 또는 단순 UUID로 통일 권장.

### [INFO] `pendingToolCalls` 저장 레코드에 `recovered: true` 필드 추가
- **위치**: `workflow-assistant-stream.service.ts` — `result: { ok: true, planId, recovered: true }`
- **상세**: DB에 persist되는 tool call 결과 객체에 `recovered` 필드가 추가됨. 기존 소비자가 이 result를 읽는 경우 additive change이므로 breaking은 아니나, `toChatMessages`에서 이 result를 LLM에 history로 전달할 때 `recovered: true`가 포함됨. 일부 모델이 예상치 못한 필드에 민감하게 반응할 수 있음.
- **제안**: history rehydration 시 `recovered` 필드를 strip하거나, `{ ok: true, planId }` 만 LLM에 반환하도록 분리 고려.

### [INFO] `recoverLeakedPlan`의 markdown code fence 처리 범위 불명확
- **위치**: `recover-leaked-plan.ts` — `recoverLeakedPlan` 함수, `recover-leaked-plan.spec.ts` code fence 테스트
- **상세**: 테스트는 `` ```json\n{...}\n``` `` 케이스를 커버하지만, 실제 `recoverLeakedPlan` 구현은 `{`를 스캔하므로 code fence 내부의 JSON을 파싱하긴 하나 `matched`에 fence 텍스트가 포함될 수 있음. `assistantText.replace(leak.matched, '')`로 스크럽 시 fence가 남을 수 있어 UI에 `` ``` `` 조각이 노출될 가능성 존재.
- **제안**: code fence를 감지하는 별도 경로 추가 또는 `matched` 반환 시 fence 포함 여부를 명시적으로 처리.

---

## 요약

이 변경은 외부 HTTP REST API 엔드포인트나 버전 관리된 공개 API를 수정하지 않고, LLM 스트리밍 서비스의 내부 SSE 채널 계약만 영향을 줍니다. SSE plan 이벤트의 데이터 shape는 기존과 동일하게 유지되며, 합성 경로에서 생성되는 `id` 포맷 차이(`leak_` 접두사)와 DB 저장 레코드의 `recovered: true` 필드 추가는 additive change입니다. 프론트엔드가 plan 이벤트 ID를 opaque identifier로만 처리하고 LLM history rehydration에서 `recovered` 필드가 무해하다면 하위 호환성 문제는 없습니다.

## 위험도

**LOW**