## 보안 리뷰 결과

### 발견사항

---

**[WARNING] 타입 캐스팅을 통한 Non-null Assertion으로 런타임 크래시 가능**
- 위치: `execution-engine.service.ts`, `waitForButtonInteraction` 함수
- 상세: `buttonConfig`를 `ButtonConfig | undefined`로 타입 선언한 후 `!`로 non-null assertion 처리. `structuredConfig?.buttonConfig`와 `nodeOutput.buttonConfig` 모두 `undefined`인 경우 `buttonConfig.buttons` 접근 시 런타임 TypeError 발생 → 실행 엔진 크래시로 이어질 수 있음.
  ```typescript
  const buttonConfig = ((structuredConfig?.buttonConfig ??
    nodeOutput.buttonConfig) as ButtonConfig | undefined)!;
  const buttons = buttonConfig.buttons; // ← buttonConfig가 undefined면 크래시
  ```
- 제안: non-null assertion 제거 후 명시적 guard 추가
  ```typescript
  if (!buttonConfig) {
    throw new Error(`Node "${node.label}" has no buttonConfig in waiting state`);
  }
  ```

---

**[WARNING] `structuredOutputPayload.previousOutput`에 민감 데이터 노출 가능성**
- 위치: `execution-engine.service.ts`, `waitForButtonInteraction` 함수 (구조화 캐시 업데이트 블록)
- 상세: `prevOutput`(이전 핸들러 출력 전체)을 `structuredOutputPayload.previousOutput`에 그대로 포함하여 `nodeExec.outputData`에 저장. 이전 출력에 민감 데이터(API 응답, DB 결과, 사용자 개인정보 등)가 포함된 경우 DB에 중복 저장되며 감사 로그나 외부 노출 시 정보 유출 위험이 있음.
- 제안: `previousOutput` 필드 필요 여부를 재검토하고, 꼭 필요하다면 민감 필드(e.g. password, token, secret, credential 패턴)를 redact하는 유틸리티를 거쳐 저장할 것.

---

**[WARNING] `interactionType` 값이 외부 입력에서 비롯되어 `status` 필드로 그대로 저장**
- 위치: `execution-engine.service.ts`:1754 부근
  ```typescript
  status: interactionData.interactionType as string,
  ```
- 상세: `interactionData.interactionType`은 `ButtonInteractionData` 타입에 정의된 값이지만, 타입 캐스팅만으로 런타임 검증 없이 `NodeHandlerOutput.status`에 할당됨. 이 값이 하위 라우팅 로직에서 사용될 경우 의도치 않은 상태 분기 유도 가능.
- 제안: 허용된 interactionType 값(`'button_click'`, `'button_continue'`, `'button_timeout'`)에 대해 명시적 whitelist 검사 추가.
  ```typescript
  const VALID_INTERACTION_TYPES = ['button_click', 'button_continue', 'button_timeout'] as const;
  if (!VALID_INTERACTION_TYPES.includes(interactionData.interactionType)) {
    throw new Error(`Invalid interactionType: ${interactionData.interactionType}`);
  }
  ```

---

**[INFO] `toEngineFlatShape`의 config spread — 프로토타입 오염 위험은 낮으나 주의 필요**
- 위치: `handler-output.adapter.ts`:84
  ```typescript
  ...(hasConfig ? adapted.config : {}),
  ```
- 상세: 이전 코드에서 `adapted.config as Record<string, unknown>` 캐스팅을 제거한 변경. `NodeHandlerOutput.config`의 타입이 `Record<string, unknown>`으로 고정되어 있다면 문제 없으나, 인터페이스 변경으로 임의 객체가 `config`에 들어올 경우 `__proto__` 등 특수 키가 spread될 수 있음. 프레임워크 레벨에서 이미 방어되고 있을 가능성이 높아 LOW 위험.
- 제안: `node-handler.interface.ts`의 `NodeHandlerOutput.config` 타입이 `Record<string, unknown>`으로 명확히 고정되어 있는지 확인. 외부 입력이 config에 직접 들어오는 경로가 있다면 `Object.create(null)` 기반 객체나 명시적 키 필터링 적용 권장.

---

**[INFO] `safeEvaluate` 에러 처리에서 민감 데이터 콘솔 출력**
- 위치: `table.handler.ts`
  ```typescript
  console.error('[TableHandler] ctx.$sourceItem:', JSON.stringify(ctx.$sourceItem));
  console.error('[TableHandler] ctx.$var:', JSON.stringify(ctx.$var));
  ```
- 상세: 기존 코드이나 변경사항에 포함된 파일로 언급. `$sourceItem` 및 `$var`는 런타임에 사용자 데이터를 포함할 수 있으며, 프로덕션 로그에 민감 정보(이름, 이메일, 점수 등)가 그대로 출력됨.
- 제안: 프로덕션 환경에서 `console.error` 대신 구조화 로거(NestJS `Logger`)를 사용하고, PII 가능 필드는 키 목록만 출력하거나 `[REDACTED]` 처리. 또는 로그 레벨을 `debug`로 낮추어 프로덕션에서 노출되지 않도록 제어.

---

**[INFO] XSS 방어 (기존 방어 정상 확인)**
- 위치: `carousel.handler.ts`, `table.handler.ts`
- 상세: `escapeHtml`이 `&`, `<`, `>`, `"`, `'` 를 인코딩하고, `sanitizeUrl`이 `javascript:` scheme을 차단함. 테스트 코드에서도 이를 검증하고 있어 XSS 방어는 적절히 유지됨. 변경 후에도 보안 동작에 회귀 없음.

---

**[INFO] `buttonItemMap` ButtonConfig 노출**
- 위치: `button.types.ts`
  ```typescript
  buttonItemMap?: Record<string, number>;
  ```
- 상세: 버튼 ID → 아이템 인덱스 매핑이 클라이언트에게 전달될 경우, 내부 데이터 구조(아이템 순서, 개수)가 노출됨. 기능상 필요하지만 이 정보를 활용한 인덱스 조작(예: 음수 인덱스, 범위 초과)에 대한 경계 검사 여부 확인 필요.
- 제안: `waitForButtonInteraction`에서 `buttonItemMap[click.buttonId]`로 얻은 인덱스를 사용할 때 `outputItems` 배열 범위 검사가 이미 `itemIndexForStruct != null && outputItems ? outputItems[itemIndexForStruct]` 형태로 존재하나, 인덱스가 음수이거나 배열 길이를 초과하는 경우도 고려하여 `>= 0 && index < outputItems.length` 조건 추가 권장.

---

### 요약

이번 변경은 핸들러 출력 구조를 `{ config, output, meta }` 형태로 마이그레이션하는 리팩터링으로, 보안 관련 신규 취약점 도입은 없음. 다만 `buttonConfig`에 대한 non-null assertion(`!`)이 런타임 크래시 경로를 열어두고 있으며, 이전 핸들러 출력 전체를 `previousOutput`으로 DB에 저장하는 패턴은 민감 데이터 중복 저장 위험을 내포한다. `interactionType` 값이 런타임 whitelist 검증 없이 상태 필드로 사용되는 점도 방어적으로 보완할 필요가 있다. XSS 및 URL 인젝션에 대한 기존 방어 로직은 변경 이후에도 정상적으로 유지된다.

### 위험도

**MEDIUM**