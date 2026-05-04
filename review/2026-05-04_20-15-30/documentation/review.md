### 발견사항

- **[INFO]** `buildAiMessageDebugFromResumeState` JSDoc이 충분히 명확함
  - 위치: `execution-engine.service.ts:151–183`
  - 상세: 함수 목적, 반환 타입의 optional 이유, 두 분기 동기화 의도까지 명시되어 있음. 문서 품질 양호.
  - 제안: 없음

- **[INFO]** 테스트 파일 상단 블록 주석이 spec 경로를 명시함
  - 위치: `execution-engine.service.spec.ts:3214–3217`
  - 상세: `spec/5-system/6-websocket-protocol.md` 참조를 인라인 주석으로 남김. 구현과 스펙 연결점이 명확함.
  - 제안: 없음

- **[WARNING]** `waiting_for_input` emit 분기의 인라인 주석이 `requestPayload`/`responsePayload`/`durationMs` 제거 이유를 충분히 설명하지 않음
  - 위치: `execution-engine.service.ts:1687–1704` (diff 기준 `+1704` 부근)
  - 상세: 추가된 주석 "Shape mirrors the terminal-emit branch below so the frontend debug timeline..."은 의도를 설명하지만, 이전 세 필드(`lastTurnRequest`, `lastTurnResponse`, `lastTurnDurationMs`)가 왜 제거되었는지—즉 `turnDebugHistory` 구조로 통합된 배경—는 언급되지 않음. 향후 리뷰어가 "왜 single-call payload가 사라졌는가"를 물을 수 있음.
  - 제안: 주석에 한 줄 추가: `// lastTurnRequest/Response/durationMs는 turnDebugHistory 단일 엔트리와 중복이므로 buildAiMessageDebugFromResumeState로 통합`

- **[INFO]** Spec 문서 업데이트가 구현과 동기화되어 있음
  - 위치: `spec/5-system/6-websocket-protocol.md` §4.1 테이블, §4.4 예시 JSON
  - 상세: `metadata?`, `llmCalls?`, `durationMs?` 필드가 이벤트 테이블과 JSON 예시 양쪽 모두에 반영됨. `llmCalls` 의미와 두 분기 동일 shape 직렬화 정책도 산문으로 설명됨.
  - 제안: 없음

- **[WARNING]** Spec의 `llmCalls` 배열 항목 타입이 명시되지 않음
  - 위치: `spec/5-system/6-websocket-protocol.md:330` 추가된 산문 및 JSON 예시
  - 상세: JSON 예시에서 `llmCalls` 배열 항목은 `requestPayload`, `responsePayload`, `durationMs`를 가지지만, 이 구조가 공식 타입으로 정의된 표가 없음. `buildAiMessageDebugFromResumeState`가 `unknown[]`를 반환하는 것과 맞물려, 프론트엔드 소비자가 타입을 추론해야 함.
  - 제안: Spec에 `llmCalls` 항목 스키마 소형 테이블 추가: `requestPayload: object`, `responsePayload: object`, `durationMs: number`

- **[INFO]** `durationMs`가 최상위와 `llmCalls[].durationMs` 두 곳에 존재하는 의미 차이가 spec에서 명확함
  - 위치: `spec/5-system/6-websocket-protocol.md` JSON 예시
  - 상세: 최상위 `durationMs`는 `totalDurationMs`(턴 전체), 배열 내 `durationMs`는 개별 LLM 호출 시간임. 예시 값(842)이 같아 혼동 여지가 있으나, 설명 산문이 "해당 턴에서 발생한 모든 LLM 호출"이라고 명시해 어느 정도 구분됨.
  - 제안: JSON 예시 주석 또는 표에서 "최상위 `durationMs` = `totalDurationMs` (턴 총 소요시간), 배열 내 `durationMs` = 단일 LLM 요청 소요시간" 구분을 명시하면 오독 방지에 도움.

---

### 요약

전체적으로 이번 변경은 구현(service), 테스트(spec.ts), 프로토콜 문서(markdown) 세 레이어가 일관되게 동기화된 모범적인 사례다. `buildAiMessageDebugFromResumeState`의 JSDoc은 목적·반환 타입 이유·두 분기 정책을 명확히 서술하고, Spec도 이벤트 테이블과 JSON 예시 모두에 변경을 반영했다. 다만 `waiting_for_input` emit 지점에서 이전 세 필드 제거 배경이 주석에 명시되지 않은 점, Spec에서 `llmCalls` 배열 항목 타입 테이블이 없는 점, 최상위 `durationMs`와 배열 내 `durationMs`의 의미 차이가 예시에서 구분되지 않는 점이 소폭 개선할 여지로 남는다.

### 위험도

**LOW**