이제 분석이 완료되었습니다. 보안 리뷰 결과를 작성합니다.

---

## 발견사항

---

### 1. **[CRITICAL]** 실행 제어 API에 소유권 검증 없음 (IDOR)
- **위치**: `execution-engine.service.ts` — `continueExecution()` L1504, `continueButtonClick()` L1528, `continueAiConversation()` L1542, `cancelWaitingExecution()` L1516
- **상세**: 네 메서드 모두 `executionId` 에 해당하는 pendingContinuation 유무만 확인하고, **해당 실행이 호출자의 것인지 전혀 검증하지 않는다**. 다른 사용자의 `executionId`를 알고 있으면 해당 사용자의 실행을 재개·취소하거나 AI 대화에 임의 메시지를 주입할 수 있다. 이 메서드들이 WebSocket/REST 레이어에서 직접 호출된다면 인증 우회 없이도 악용 가능하다.
- **제안**: 서비스 레이어에서 `executionId → workspaceId/userId` 매핑을 조회하여 호출자 권한을 검증하거나, 적어도 NestJS Guard 레이어에서 소유권 확인을 강제하고 이를 문서화해 우회 불가능하게 설계한다.

---

### 2. **[WARNING]** `_resumeState`(rawConfig 포함)가 WAITING 상태에서 DB에 그대로 저장됨
- **위치**: `execution-engine.service.ts` — L1591, L1618–1621
- **상세**: `waitForAiConversation`은 L1591에서 `resumeState.rawConfig = Object.freeze({ ...(node.config ?? {}) })`로 원본 config(expression 평가 전)를 resumeState에 합친다. 이 후 L1618에서 `nodeExec.outputData = (structured ?? nodeOutput)`를 저장하는데, `nodeOutput`에 `_resumeState`(rawConfig 포함)가 그대로 담겨 DB에 영구 저장된다. 노드 config에 `apiKey: "sk-actual-value"` 같은 하드코딩 자격증명이 있으면 DB/REST API를 통해 노출된다. (종료 후에는 L1869에서 `delete finalOutput._resumeState`로 제거하지만 WAITING 중간 행에는 잔존한다.)
- **제안**: `nodeExec.outputData` 저장 전에 `_resumeState`를 제거하거나, 저장할 때 credential-like 필드를 strip하는 헬퍼를 적용한다.

---

### 3. **[WARNING]** 에러 스택 트레이스가 DB에 저장됨
- **위치**: `execution-engine.service.ts` — L1282–1285
  ```typescript
  savedExecution.error = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  ```
- **상세**: 실행 실패 시 `stack` 필드가 DB Execution 행에 저장된다. REST API로 실행 이력을 조회할 때 이 스택이 클라이언트에 노출될 수 있으며, 파일 경로·모듈명·버전 정보 등 공격자에게 유용한 정보를 포함한다. WS 이벤트(L1295)에는 message만 보내는 점은 올바르다.
- **제안**: DB에는 스택을 저장하지 않거나 서버 전용 로그(Logger)에만 기록하고, REST 응답에서 stack 필드를 제거한다.

---

### 4. **[WARNING]** 폼 제출 데이터(`formData`)에 대한 입력 검증 없음
- **위치**: `execution-engine.service.ts` — `continueExecution()` L1504–1511, `waitForFormSubmission()` L1428–1434
- **상세**: `continueExecution(executionId, formData)`는 `formData`에 어떠한 유효성 검사도 없이 pending continuation에 그대로 전달한다. 이 데이터는 L1428–1434에서 `interactionData`로 병합된 후 `$node["Form"].output.interaction.data`를 통해 하위 노드로 흘러간다. 폼 스키마(필드 타입·허용값 등)와 대조하는 검증이 없으므로 예상치 않은 타입이나 크기의 데이터가 파이프라인을 오염시킬 수 있다.
- **제안**: `waitForFormSubmission`에서 데이터를 병합하기 전에 node.config의 `fields` 스키마로 formData를 검증한다. `continueAiConversation`이 메시지 길이를 검증하는 것처럼 일관된 방어를 적용한다.

---

### 5. **[WARNING]** 재귀 깊이(`recursionDepth`) 상한이 진입점에서 미검증
- **위치**: `execution-engine.service.ts` — `executeSync()` L779, `executeAsync()` L877
- **상세**: `options.recursionDepth`가 호출자로부터 전달되어 그대로 Execution 행에 저장된다. 최대 재귀 깊이 초과 여부를 이 진입점에서 검증하지 않으며, 악의적 또는 잘못된 호출이 반복적으로 하위 워크플로우를 호출해 메모리/DB 자원을 고갈시킬 수 있다.
- **제안**: 서비스 레이어에서 `MAX_RECURSION_DEPTH` 설정값과 비교하여 초과 시 즉시 거부한다.

---

### 6. **[INFO]** 노드 입출력 데이터가 WebSocket으로 무조건 전송됨
- **위치**: `execution-engine.service.ts` — `executeNode()` L2248–2251 (`input: nodeInput`), L2390 (`output: nodeExecution.outputData`)
- **상세**: `NODE_STARTED`/`NODE_COMPLETED` WS 이벤트에 노드의 전체 입력·출력 데이터가 포함된다. 노드 출력에 API 응답 원문, 개인정보, 자격증명이 담길 경우 WS 구독자 전원에게 노출된다. WS 구독이 소유권 기반으로 범위가 제한되어 있다면 수용 가능하지만, 공유 채널 구조라면 민감 정보를 필터링하거나 별도 엔드포인트로 분리해야 한다.
- **제안**: WS 이벤트의 `input`/`output` 필드에 대해 credential-like 필드(키 이름이 `apiKey`, `token`, `password`, `secret`에 해당하는 것)를 자동 마스킹하는 sanitizer를 적용한다.

---

### 7. **[INFO]** `NodeHandlerOutput.config` 크레덴셜 strip 규약이 강제가 아닌 관례로만 존재
- **위치**: `node-handler.interface.ts` — L72 주석 "Credential material MUST be stripped before returning"
- **상세**: 인터페이스 주석에 "credential 제거 필수"가 명시되어 있지만 강제 메커니즘이 없다. 핸들러가 규약을 위반하면 WS 이벤트·DB NodeExecution에 크레덴셜이 그대로 노출된다. 스펙 문서 링크만 있고 런타임 검증이 없다.
- **제안**: `adaptHandlerReturn` 또는 `executeNode`의 `adapted` 처리 시점에 config의 알려진 sensitive 키를 자동으로 마스킹하는 로직을 추가한다.

---

## 요약

전체적으로 실행 엔진은 입력 흐름·에러 처리·크리티컬 제어 경로에서 견고한 구조를 갖추고 있으나, **소유권 기반 접근 제어가 서비스 레이어에 부재**한 점이 가장 큰 위험이다. `continueExecution` 계열 메서드가 전적으로 상위 레이어(Guard/Controller)의 인가에 의존하는 구조인데, 그 의존성이 코드 레벨에서 강제되지 않아 미래 리팩터링 또는 새 엔드포인트 추가 시 IDOR 취약점이 재발할 가능성이 높다. 또한 `_resumeState`가 DB에 저장되는 WAITING 상태에서 rawConfig가 크리덴셜을 포함할 경우 정보 노출로 이어지며, 에러 스택 트레이스의 DB 저장 및 폼 데이터 검증 부재도 보완이 필요하다.

## 위험도

**HIGH**