## 발견사항

### [WARNING] `finishReason` 컬럼의 신규 값 `'auto_resume_pending'` 이 엔티티에 미문서화
- **위치**: `workflow-assistant-message.entity.ts:125` (`finishReason` 필드)
- **상세**: 엔티티의 `finishReason: string | null` 은 기존에도 가능한 값 목록(stop/tool_calls/error 등)을 문서화하지 않았으나, 이번 변경으로 `'auto_resume_pending'` 이라는 의미 있는 마커 값이 추가됐다. SQL 마이그레이션 주석과 스펙 §6.0 에는 기술되어 있지만, 필드 선언부 자체에는 없어 `appendMessage` 호출부 개발자가 유효 값을 추론해야 한다.
- **제안**: `finishReason` JSDoc에 `@example` 또는 가능한 값 목록을 한 줄 추가. 예:
  ```ts
  // 가능한 값: 'stop' | 'tool_calls' | 'error' | 'auto_resume_pending'
  finishReason: string | null;
  ```

---

### [WARNING] `resumeMeta` 파라미터 주석이 함수 시그니처 내부에 위치
- **위치**: `workflow-assistant-stream.service.ts` `persistAssistantTurn` 시그니처
- **상세**: 현재 주석이 파라미터 선언 바로 위에 인라인으로 삽입되어 있다. TypeScript/TSDoc 문서 생성기는 파라미터 앞 주석을 `@param` 으로 인식하지 않으며, IDE hover 도움말에도 표시되지 않는다.
- **제안**: 함수 선언 위에 JSDoc 블록을 두거나, `@param resumeMeta` 형태로 통합:
  ```ts
  /**
   * @param resumeMeta stall 자동 복구로 한 턴이 여러 row로 쪼개질 때 이 row의 위치를 표시.
   *   기본값은 단일 정상 row용 (autoResumed: false).
   */
  private async persistAssistantTurn(..., resumeMeta: {...} = {...})
  ```

---

### [WARNING] `STALL_MAX_ATTEMPTS` 프론트 상수와 백엔드 `MAX_STALL_ROUNDS` 간 드리프트 감지 불가
- **위치**: `assistant-store.ts:65` (`STALL_MAX_ATTEMPTS = 2`)
- **상세**: JSDoc에서 "백엔드에서 변경되면 같이 업데이트"라고 명시했으나 컴파일타임·런타임 모두 검증 수단이 없다. rehydrate 시 서버가 저장한 `autoResumeAttempt` 값이 이 상수를 초과하면 divider가 `"2/2"` 대신 `"2/1"` 같이 오표시된다. 메모리 문서 유지보수 체크리스트에는 포함되어 있으나 문서 수준의 안전망만 존재한다.
- **제안**: `auto_resume` SSE 이벤트의 `max` 필드가 이미 페이로드에 포함되어 있으므로, rehydrate 경로(`hydrateMessage`)에서 `STALL_MAX_ATTEMPTS` 상수 대신 서버가 persist한 값을 활용하는 방안 검토 — 즉 `autoResumeAttempt` 외에 `autoResumeMax` 를 DB 컬럼으로도 저장하거나, 현재 설계의 제약을 JSDoc에 더 명확히 기술.

---

### [INFO] `applyAutoResumeEvent` JSDoc이 rehydrate 경로의 `max` 값 출처를 미설명
- **위치**: `assistant-store.ts` `applyAutoResumeEvent` 함수 JSDoc
- **상세**: 이 함수는 SSE 이벤트에서 `max` 를 직접 받아 저장하지만, `hydrateMessage` 는 `STALL_MAX_ATTEMPTS` 상수를 사용한다. 두 경로가 다른 소스에서 `max` 를 가져온다는 점이 문서화되지 않아 향후 유지보수 시 혼란 여지가 있다.
- **제안**: JSDoc에 한 줄 추가: `// 실시간 경로: event.data.max 사용. rehydrate 경로(hydrateMessage): STALL_MAX_ATTEMPTS 상수 사용`

---

### [INFO] Spec §6.0이 어떤 엔드포인트 응답에 해당하는지 불명확
- **위치**: `spec/3-workflow-editor/4-ai-assistant.md` §6.0
- **상세**: 도입부에 `GET /api/v1/workflow-assistant/sessions/{id}` 만 명시되어 있으나, 메시지 목록을 반환하는 다른 엔드포인트(있다면)에도 동일하게 적용되는지 명확하지 않다. 사소한 범위이지만 API 소비자 관점에서 혼동 소지가 있다.
- **제안**: 해당 섹션 도입 문장에 "messages 배열을 포함하는 모든 응답(sessions/{id} 등)"으로 범위를 명확히 기술.

---

### [INFO] `AssistantMessageData.autoResumeReason` 타입이 프론트 실제 사용 타입보다 느슨
- **위치**: `frontend/src/lib/api/assistant.ts:35`
- **상세**: API 타입은 `autoResumeReason?: string | null` 이지만, 스토어에서 `msg.autoResumeReason as "stall_pending_steps"` 로 강제 캐스팅된다. 향후 새 reason 값이 추가될 때 타입 오류로 잡히지 않는다.
- **제안**: `autoResumeReason?: 'stall_pending_steps' | string | null` 또는 별도 union 타입으로 명시.

---

## 요약

전반적으로 이번 변경은 **문서화 품질이 매우 높다**. SQL 마이그레이션 헤더, 엔티티 JSDoc, 스펙 §5.3.2·§6.0 신설, 메모리 문서 §10, i18n 키 추가까지 백엔드-프론트-스펙-메모리 모든 계층이 일관성 있게 갱신되어 있다. 지적 사항은 모두 경미한 수준으로, `finishReason` 가능 값 미문서화와 `STALL_MAX_ATTEMPTS`/`max` 이중 소스 문제가 향후 유지보수 부채로 쌓일 가능성이 있는 부분이다. `persistAssistantTurn` 의 `resumeMeta` 파라미터 주석 위치는 IDE 도움말 노출을 위해 표준 JSDoc 형식으로 옮기는 것을 권장한다.

## 위험도

**LOW**