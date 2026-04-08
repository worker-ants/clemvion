## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] Prompt Injection — LLM 시스템 프롬프트에 사용자 제공 데이터 직접 삽입**
- 위치: `ai-agent.handler.ts` — `buildConditionSystemPromptSuffix()`
- 상세: `c.prompt` 값이 sanitization 없이 시스템 프롬프트에 직접 concatenation됨. 악의적인 사용자가 condition prompt에 `]\n\n[새로운 지시]` 형태의 문자열을 삽입하면 LLM의 행동을 조작할 수 있음.
- 제안: condition prompt 값에서 시스템 프롬프트 구조를 깨뜨릴 수 있는 패턴 (`[`, `]`, 과도한 줄바꿈 등) 필터링 또는 길이 제한 추가. 최소한 validate()에서 prompt 최대 길이 검증 필요.

---

**[WARNING] JSON.parse 미검증 외부 입력 — ToolCall arguments 파싱**
- 위치: `ai-agent.handler.ts` — `extractConditionReason()` (L: `JSON.parse(tc.arguments)`)
- 상세: try/catch로 파싱 오류는 처리하나, 파싱 성공 후 `args.reason`의 타입만 `as string`으로 캐스팅. LLM이 `reason`에 매우 긴 문자열, 중첩 객체, 또는 프로토타입 오염 가능 키(`__proto__`, `constructor`)를 반환할 경우 하위 처리에서 문제 발생 가능.
- 제안: `args.reason`이 string이고 합리적인 길이(예: 500자) 이하인지 검증 후 사용.

---

**[WARNING] 입력 검증 부재 — conditions ID가 기존 tool 이름과 충돌 가능**
- 위치: `ai-agent.handler.ts` — `buildTools()`, `classifyToolCalls()`
- 상세: condition의 `id`가 UUID라고 가정하나 validate()에서 UUID 형식을 강제하지 않음. 만약 condition id가 일반 tool nodeId와 동일하거나 `__proto__`, `toString` 등 예약 문자열이면 `conditionIds` Set 기반 분류 로직에서 오작동 가능. 또한 condition id가 `out`, `timeout`, `error` 같은 시스템 예약 포트 이름과 충돌하면 라우팅 오작동.
- 제안: validate()에서 UUID 형식 정규식 검증 및 예약 포트 이름 충돌 방지 로직 추가.

---

**[WARNING] 신뢰되지 않은 LLM 응답으로 포트 라우팅 결정**
- 위치: `execution-engine.service.ts` — `waitForAiConversation()`, `ai-agent.handler.ts` — `classifyToolCalls()`
- 상세: LLM이 호출하는 tool 이름(`tc.name`)으로 condition 포트를 결정하는 구조. 프롬프트 인젝션 등으로 LLM이 정의되지 않은 condition id를 tool로 호출하거나 예상치 못한 포트로 라우팅을 유도할 수 있음. `conditionIds.has(tc.name)` 체크는 있으나 이는 condition tool 분류 용도이며, 실제 포트 존재 여부는 검증되지 않음.
- 제안: `applyPortSelection` 또는 라우팅 단계에서 허용된 포트 목록 대비 화이트리스트 검증 추가.

---

**[INFO] 민감 정보가 tool 응답에 포함될 가능성**
- 위치: `ai-agent.handler.ts` — tool 실행 결과 메시지 (normal tool case)
- 상세: `arguments: tc.arguments` 가 그대로 tool result 메시지에 포함되어 LLM context에 전달됨. 이 arguments에 API 키, 인증 토큰 등이 포함된 경우 LLM 프롬프트 history에 노출되어 로그나 multi-turn 대화 저장 시 유출 가능.
- 제안: tool arguments를 LLM에 다시 전달할 때 민감 필드를 제거하거나 마스킹하는 정책 고려.

---

**[INFO] crypto.randomUUID() 클라이언트 사이드 ID 생성**
- 위치: `ai-configs.tsx` — `addCondition()`
- 상세: 브라우저의 `crypto.randomUUID()`는 충분한 엔트로피를 가지나, 생성된 UUID가 서버에서 condition 도구 이름으로 사용됨. 클라이언트가 임의의 UUID를 조작하여 전송할 경우 서버 validate()에서 형식 검증이 없으므로 공격 가능.
- 제안: 서버 validate()에서 UUID 형식 강제 검증으로 보완 (위 WARNING과 동일한 조치).

---

**[INFO] 조건 개수 제한 없음**
- 위치: `ai-agent.handler.ts` — `validate()`, `ai-configs.tsx` — `addCondition()`
- 상세: 조건 배열의 최대 크기 제한이 없음. 수백 개의 condition이 등록되면 시스템 프롬프트와 tool 목록이 LLM context limit을 초과하거나 응답 지연을 유발할 수 있음. DoS 벡터로 활용 가능.
- 제안: 최대 조건 수(예: 20개) 제한을 validate()와 UI 양쪽에 추가.

---

### 요약

이번 변경에서 하드코딩된 시크릿이나 SQL 인젝션 같은 전통적인 취약점은 발견되지 않았다. 그러나 LLM 기반 아키텍처 특유의 **Prompt Injection** 위험이 핵심 취약점으로 식별된다 — condition의 `prompt` 필드가 시스템 프롬프트에 그대로 삽입되어 LLM 행동 조작이 가능하며, LLM 응답(tool name)으로 포트 라우팅을 결정하는 구조는 프롬프트 인젝션 성공 시 워크플로우 흐름 조작으로 이어질 수 있다. 또한 condition id의 형식 및 예약어 충돌 검증 부재, tool arguments가 LLM context에 재노출되는 점이 보조 위험 요소로 존재한다. 현재 수준에서 즉각적인 RCE나 데이터 유출 경로는 보이지 않으나, LLM이 신뢰 경계의 일부로 포함된 아키텍처임을 명심하고 입력 검증을 강화해야 한다.

### 위험도

**MEDIUM**