### 발견사항

---

**[CRITICAL]** 백엔드 테스트가 `messages` 필드 존재를 검증하지 않음
- 위치: `execution-engine.service.spec.ts` — 두 테스트 케이스 모두
- 상세: `use-execution-events.ts`는 `messages` 배열이 없으면 페이로드를 완전히 드롭한다 (파일 3 변경 핵심). 그런데 백엔드 테스트는 `payload.llmCalls`, `payload.durationMs`, `payload.nodeId` 등은 검증하면서 **`payload.messages`가 실제로 emit되는지 전혀 검증하지 않는다.** 프론트엔드의 "무조건 drop" 정책과 백엔드의 "무조건 전송" 가정이 테스트로 연결되지 않아, 백엔드에서 `messages`를 빠뜨리면 프론트 화면이 무음(silent) 장애로 이어진다.
- 제안:
  ```typescript
  expect(payload).toHaveProperty('messages');
  expect(Array.isArray(payload.messages)).toBe(true);
  expect((payload.messages as unknown[]).length).toBeGreaterThan(0);
  ```

---

**[WARNING]** 첫 번째 테스트의 `durationMs` 검증이 모호함
- 위치: `execution-engine.service.spec.ts` — `'emits llmCalls and durationMs...'` 테스트
- 상세: `llmCall.durationMs`과 `turnDebugHistory[0].totalDurationMs` 모두 `120`으로 동일하다. 서비스 코드가 어느 쪽 소스에서 `payload.durationMs`를 채우는지 테스트로 구분할 수 없다. 만약 서비스가 `llmCall.durationMs`의 합산이 아닌 `totalDurationMs`를 사용하거나 그 반대로 바꿔도 테스트는 통과한다.
- 제안: 두 값을 의도적으로 다르게 설정 — 예: `llmCall.durationMs: 90`, `totalDurationMs: 120`. 그 후 기대값이 `120`인지 `90`인지를 명시적으로 단언해 어느 쪽이 정책인지 문서화한다.

---

**[WARNING]** 두 번째 테스트의 `_resumeState`가 불완전함
- 위치: `execution-engine.service.spec.ts` — `'preserves the full llmCalls sequence...'` 테스트 (~970번째 줄)
- 상세: 해당 `_resumeState`에는 `model`, `totalInputTokens`, `totalOutputTokens` 필드가 없다. 첫 번째 테스트의 `_resumeState`에는 이 필드가 모두 있다. 서비스 코드가 이 필드에 접근하면 런타임 오류나 `undefined` 직렬화가 발생할 수 있으며, 이 테스트가 그 경로를 은닉한다.
- 제안: 두 번째 테스트의 `_resumeState`에도 `model`, `totalInputTokens`, `totalOutputTokens`를 포함시키거나, 서비스 코드가 해당 필드가 없어도 안전하게 동작함을 명시적으로 주석으로 근거를 남긴다.

---

**[WARNING]** 레거시 fallback 제거가 배포 안전성을 보장하지 않음
- 위치: `use-execution-events.ts` — `handleAiMessage` callback
- 상세: `messages` 없는 페이로드를 "invariant violation"으로 정의하고 드롭하는 정책은 "백엔드가 항상 `messages`를 보낸다"는 가정에 의존한다. 그러나 백엔드 코드 변경(`fd9aa3f`)과 프론트엔드 코드 변경이 원자적으로 배포되지 않는 경우(롤링 배포, 스테이징 환경 등), 구 버전 백엔드와 신 버전 프론트엔드가 공존하는 순간 AI 대화 응답이 UI에서 완전히 사라진다.
- 제안: 모노레포라면 배포 원자성을 CI/CD 정책으로 명문화하거나, 최소한 경과 기간(한 sprint) 동안 fallback을 `deprecated` 경고와 함께 유지한다.

---

**[WARNING]** 두 번째 백엔드 테스트에서 `durationMs` 검증 누락
- 위치: `execution-engine.service.spec.ts` — `'preserves the full llmCalls sequence...'` 테스트
- 상세: 첫 번째 테스트는 `payload.durationMs`를 검증하지만 두 번째 테스트(tool-loop, `totalDurationMs: 120`)는 `llmCalls`와 그 길이만 검증하고 `durationMs`를 검증하지 않는다. tool-loop 경로에서 `durationMs` 직렬화가 회귀해도 탐지되지 않는다.
- 제안: `expect(payload.durationMs).toBe(120)` 추가.

---

**[INFO]** 프로덕션에서 dropped payload 모니터링 불가
- 위치: `use-execution-events.ts` — `process.env.NODE_ENV !== "production"` 분기
- 상세: 개발 환경에서만 `console.warn`이 발생하므로 프로덕션에서 `messages` 없는 페이로드가 얼마나 오는지 파악할 방법이 없다. 정책 위반(invariant violation)이라면 프로덕션에서도 모니터링 채널(Sentry, DataDog 등)로 기록하는 것이 일반적이다.
- 제안: `console.warn` 대신 프로젝트의 에러 트래킹 훅을 사용하거나, 적어도 `console.error`로 레벨을 올려 프로덕션 로그에서도 식별 가능하게 한다.

---

**[INFO]** `makeAiAgentHandler`의 초기 `execute` 응답에 `messages` 필드 부재
- 위치: `execution-engine.service.spec.ts` — `makeAiAgentHandler` 함수
- 상세: 초기 `execute` mock 반환값의 `output`에 `messages` 필드가 없다(`{ messages: [], message: '', turnCount: 0 }`). 실제 AI agent execute 결과가 처음부터 `messages` 배열을 반환하는지 spec을 통해 확인 필요. 만약 서비스가 초기 execute 결과로도 `execution.ai_message`를 emit한다면, 이 mock이 현실을 반영하지 않는다.
- 제안: 초기 `execute` 결과의 `output.messages` 값이 스펙에서 요구하는 실제 타입과 일치하는지 확인.

---

### 요약

이번 변경의 핵심은 `ai_message` 핸들러의 레거시 fallback 경로를 제거하고 `messages` 배열을 프로토콜 불변 조건으로 격상한 것이다. 방향성은 올바르나, **백엔드 테스트가 `messages` 필드의 실제 emit을 검증하지 않아 프론트엔드의 강화된 정책과 테스트 수준에서 연결되지 않는 것이 가장 큰 요구사항 결함**이다. 또한 두 테스트의 모호한 `durationMs` 설계와 불완전한 `_resumeState`로 인해 일부 경로의 회귀 탐지가 불가능하며, 레거시 제거에 따른 비원자적 배포 리스크도 명시적 조치 없이 남아 있다.

### 위험도

**MEDIUM**