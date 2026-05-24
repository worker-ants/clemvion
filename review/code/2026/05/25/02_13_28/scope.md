# 변경 범위(Scope) 리뷰

**리뷰 대상**: fix(chat-channel + mcp): 응답 누락 + Cafe24 통합 WARN 노이즈
**검토일**: 2026-05-25

---

## 발견사항

### [INFO] `websocket.service.ts` — `envelope` 지역 변수명 `wireEnvelope` 로 rename
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `emitExecutionEvent` 및 `emitNodeEvent` 내부
- 상세: `const envelope` 를 `const wireEnvelope` 로 리네임했다. fanout 분리 로직 추가에 따른 의미 명확화 목적으로 볼 수 있으나, 이 변수명 변경 자체는 버그 fix 의 필수 조건이 아니다. `wireEnvelope` 라는 네이밍은 `attachRoutingContext` 의 입력 파라미터명 및 내부 로직과 일관성을 유지해 가독성을 높이므로 리팩토링이 fix 맥락 안에서 합리적으로 결합되어 있다.
- 제안: 이슈 없음. fanout/wire 분리 변경과 직접 연관된 리네임으로 범위 내 수정으로 판단한다.

---

### [INFO] `execution-event-emitter.service.ts` 파일 헤더 주석 내 `C-6 strangle step 1` 언급 — 기존 주석 미수정
- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` 파일 상단 JSDoc
- 상세: 파일 헤더 주석은 변경 전부터 존재하던 내용이며 diff 에 포함되지 않았다. 새로 추가된 `registerExecutionRouting` / `releaseExecutionRouting` 두 메서드와 그 JSDoc 주석이 fix 의도와 직접 부합한다. 불필요한 주석 추가·삭제는 없다.
- 제안: 이슈 없음.

---

### [INFO] `mcp-tool-provider.ts` — `inflight` Map 타입 변경 (`Promise<ServerEntry>` → `Promise<ServerEntry | null>`)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L970 (diff 기준)
- 상세: `null` sentinel 도입으로 인해 inflight 캐시의 타입 파라미터가 변경됐다. 이는 Issue 2 fix 의 내부 일관성 보장을 위한 필수 타입 변경으로, over-engineering 이나 불필요한 리팩토링이 아니다. `materializeServer` 반환 타입 (`Promise<ServerEntry | null>`) 과 정합한다.
- 제안: 이슈 없음.

---

### [INFO] `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md` 신규 생성
- 위치: `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md`
- 상세: CLAUDE.md 규약("진행 중 작업 → `plan/in-progress/<name>.md`")에 따른 plan 파일 생성이다. fix PR 범위 내 의무 산출물이다.
- 제안: 이슈 없음.

---

### [INFO] `review/consistency/2026/05/25/01_36_06/` 디렉토리 파일 신규 생성
- 위치: `review/consistency/2026/05/25/01_36_06/SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md` 등
- 상세: CLAUDE.md 규약("개발자는 구현 착수 직전 `consistency-check --impl-prep` 의무")에 따라 생성된 산출물이다. 구현 착수 선행 절차의 결과물로 범위 내 파일이다.
- 제안: 이슈 없음.

---

### [INFO] `websocket.service.spec.ts` — `firstValueFrom`, `take`, `toArray` 임포트 추가
- 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` L342-343
- 상세: 신규 테스트 그룹 (`execution routing context` describe)에서 사용하는 RxJS 연산자 임포트다. 테스트 추가에 직접 필요한 임포트이므로 불필요한 임포트 정리가 아니다.
- 제안: 이슈 없음.

---

### [INFO] `websocket.service.spec.ts` — `ExecutionChannelEvent` 타입 임포트 추가
- 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` L345
- 상세: 신규 테스트에서 `fanout` 변수 타입 어노테이션에 사용되는 임포트다. 필요한 임포트 추가이다.
- 제안: 이슈 없음.

---

### [WARNING] `websocket.service.spec.ts` — "credential-shape 키가 chatChannel 안에 있으면 sanitize 가 마스킹" 테스트 케이스
- 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` L501-522
- 상세: 이 테스트는 `chatChannel` 내 `api_key` 같은 credential 키 마스킹을 검증한다. `attachRoutingContext` 가 `chatChannel` 에 `sanitizePayloadForWs` 를 적용하는 구현(`websocket.service.ts` diff 내 `attachRoutingContext` 메서드)에 대응하는 테스트다. `sanitizePayloadForWs` 는 기존부터 존재하던 유틸리티이며 routing context 의 `chatChannel` 에 이를 적용하는 것은 defense-in-depth 목적으로 fix 범위 내 결정이다. 다만 이 sanitize 적용이 원래 plan 문서("Issue 1 수정 방향")에 명시되지 않은 추가 동작이라는 점에서 경미한 scope 확장 가능성이 있다. plan 본문에는 "sanitize 는 WebsocketService 측에서 적용"(`extractChatChannelFromInput` 함수 주석)이라는 언급이 있어 의도된 설계 결정임을 확인할 수 있다.
- 제안: plan 문서에 `chatChannel sanitize defense-in-depth` 항목을 간략히 명시하면 좋으나 현재 상태로도 수용 가능하다.

---

## 요약

변경된 10개 파일 전체가 plan 에 명시된 두 이슈(Issue 1: chat-channel routing context 누락으로 outbound 응답 전체 실패 / Issue 2: Cafe24 통합 시 WARN 노이즈) 의 해결을 위한 필수 변경으로 구성되어 있다. 추가된 `sanitizePayloadForWs` 적용이 plan 에 명시적으로 기술되지 않은 부분이 있으나, 구현 코드 내 주석에서 의도가 확인되고 security defense-in-depth 목적으로 합리적이다. 불필요한 리팩토링, 무관한 파일 수정, 기능 확장, 의미 없는 포맷팅 변경은 발견되지 않았다. 변수명 `wireEnvelope` 로의 rename 은 fanout/wire 분리 맥락에서 가독성 향상 목적이 명확해 정당하다.

---

## 위험도

NONE
