### 발견사항

---

**[WARNING] `send-email.handler.ts`: 오류 코드 분기가 항등 표현식으로 무력화됨**
- 위치: `send-email.handler.ts` — `buildSubWorkflowError` 이후 추가된 catch 블록
- 상세: 아래 코드에서 양쪽 분기가 동일한 값을 반환하므로 `IntegrationError` 판별이 사실상 무의미하다.
  ```typescript
  const code =
    err instanceof IntegrationError
      ? 'EMAIL_SEND_FAILED'   // ← 동일
      : 'EMAIL_SEND_FAILED';  // ← 동일
  ```
  `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE` 같은 `IntegrationError` 코드는 `details.integrationCode`에만 내려가고, `output.error.code`는 항상 `EMAIL_SEND_FAILED`다. 이로 인해 에러 포트를 받는 다운스트림 노드가 에러 종류를 구분할 수 없다.
- 제안: 분기별 코드를 실제로 다르게 설정하거나(`'INTEGRATION_CONFIG_ERROR'` vs `'EMAIL_SEND_FAILED'`), 단일 상수로 정리하되 의도를 명시하라.

---

**[WARNING] `NodeHandlerOutput` 인터페이스에 엔진 내부 상태(`_resumeState`)가 노출됨 — ISP 위반**
- 위치: `node-handler.interface.ts:68-75`
- 상세: `_resumeState`는 엔진의 멀티턴 재개 메커니즘에 특화된 필드다. 이를 모든 핸들러가 구현해야 하는 `NodeHandlerOutput` 인터페이스에 선언하면, resume을 전혀 사용하지 않는 핸들러(Chart, Table, HTTP Request 등)도 이 필드의 존재를 인지해야 한다. 인터페이스 분리 원칙(ISP)에 어긋난다. 또한 `_` prefix 컨벤션은 "내부 전용"을 나타내는데 공개 인터페이스에 포함되는 것은 모순이다.
- 제안: 멀티턴 핸들러 전용 서브타입을 도입하거나(`ResumableHandlerOutput extends NodeHandlerOutput`), `_resumeState`를 어댑터 레이어에서 핸들러 반환값 밖에서 별도로 관리하는 것을 검토하라.

---

**[WARNING] 프론트엔드 이중 경로 조회가 여러 파일에 산재 — DRY 위반**
- 위치: `conversation-utils.ts`, `output-shape.ts`, `conversation-inspector.tsx`
- 상세: `output.result.messages ?? output.messages`, `result?.turnCount ?? output.turnCount`, `result?.endReason ?? output.endReason` 패턴이 3개 파일에 걸쳐 독립적으로 반복된다. 이 이중 경로 조회는 마이그레이션 기간 필요한 하위호환성이지만, 유틸리티 함수로 추출되지 않아 마이그레이션 완료 시 일괄 제거가 어렵고 동작 불일치 위험도 있다.
- 제안: `resolveResultField(output, 'messages')`, `resolveResultField(output, 'turnCount')` 같은 단일 헬퍼로 캡슐화하여 migration 완료 시점에 한 곳만 제거하도록 하라.

---

**[WARNING] `code.handler.ts` 에러 코드 이중화 — 코드 정규화 후 레거시 코드가 `meta`에 병존**
- 위치: `code.handler.ts` — `buildErrorReturn` 메서드
- 상세: `output.error.code`는 `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED`로 정규화되지만, `meta.errorCode`는 정규화 전 원래 코드(`CODE_RUNTIME_ERROR`, `EXECUTION_TIMEOUT`)를 그대로 유지한다. 같은 에러에 대해 두 가지 코드 체계가 공존하면, 관측성(observability) 대시보드나 다운스트림 에러 핸들링이 어느 코드를 사용해야 하는지 불분명해진다. 또한 테스트(`code.handler.spec.ts`)는 `meta.errorCode`로 `CODE_RUNTIME_ERROR`를 기대하고 있어 양쪽 체계를 동시에 테스트하고 있다.
- 제안: 하나의 코드 체계를 선택하라. Stage 7(어댑터 제거) 전까지 레거시 `meta.errorCode`가 필요하다면 해당 의도를 코드 주석으로 명시하고, `meta.errorCode`를 deprecated 마킹하라.

---

**[INFO] `adaptHandlerReturn`의 bare object fallback이 프로덕션 코드에 잔존**
- 위치: `handler-output.adapter.ts:27-47`
- 상세: 주석에 "Test fixtures and a handful of one-off mock handlers still return bare objects"라고 명시되어 있다. 테스트 전용 우회 경로가 프로덕션 어댑터에 있으면, 잘못된 핸들러 반환값이 조용히 통과되는 암묵적 계약이 형성된다. Phase 3 완료 선언과 함께 이 branch를 제거한다면 핸들러 구현 품질이 강제된다.
- 제안: Stage 7 예정 제거 시점을 코드 주석에 명시(`// TODO Stage 7: remove after all handlers are verified canonical`)하거나, TypeScript 타입 수준에서 핸들러 반환 타입을 강제하여 컴파일 단계에서 잡도록 하라.

---

**[INFO] 컨테이너 결과 키 이름 불일치 (`items` vs `iterations` vs `mapped`)**
- 위치: `execution-engine.service.ts`, `spec/4-nodes/1-logic-nodes.md`
- 상세: ForEach → `{ items, count }`, Loop → `{ iterations, count }`, Map → `{ mapped, count }`. 동일한 "수집된 결과 배열 + 개수" 패턴을 세 가지 서로 다른 키로 표현한다. 사용자 입장에서 컨테이너 타입마다 키 이름을 기억해야 한다. 스펙 문서도 이를 각각 별도 섹션으로 기술하고 있어 학습 비용이 증가한다.
- 제안: `results` 와 같은 통일된 키를 고려하거나, 현재 선택(의미론적 명확성 우선)을 명시적 설계 결정으로 스펙에 기재하라. 어느 쪽이든 표준화가 필요하다.

---

**[INFO] `CONVENTIONS §N` 참조가 코드 전반에 분산되어 있으나 conventions 문서 위치 불명확**
- 위치: `ai-agent.handler.ts`, `carousel.handler.ts`, `http-request.handler.ts` 등 다수
- 상세: `CONVENTIONS §3.2`, `§4.3`, `§7`, `§8`, `§9.2` 등의 참조가 20개 이상의 파일에 걸쳐 있다. 코드 리뷰어나 신규 기여자가 이 문서를 찾을 경로가 코드베이스 내 어디에도 명시되지 않아 참조 추적성이 낮다.
- 제안: CONVENTIONS 문서 경로를 `CLAUDE.md` 또는 `spec/` 디렉토리에 명시적으로 연결하라.

---

### 요약

이번 변경은 노드 핸들러 출력 형식을 `{ config, output.result.*, output.error.*, meta }` 구조로 일원화하는 대규모 아키텍처 마이그레이션으로, 방향성은 올바르다. 에러를 throw 대신 `error` 포트 라우팅으로 전환하고, 리터럴 설정값을 `config`로, 런타임 결과를 `output`으로 분리한 Principle 1.1 적용은 레이어 책임 분리 측면에서 명확한 개선이다. 다만 세 가지 구조적 우려가 남아 있다: (1) `_resumeState`가 공개 인터페이스에 노출된 ISP 위반, (2) `send-email` 핸들러의 에러 코드 항등 버그, (3) 프론트엔드의 이중 경로 조회 패턴이 유틸리티 추출 없이 반복되는 DRY 위반. Stage 7 완료 이전까지 레거시 경로가 어댑터와 프론트엔드 양쪽에 유지되는 점은 불가피하나, 제거 시점과 완료 기준을 코드 수준에서 명시적으로 표시할 필요가 있다.

### 위험도

**MEDIUM**