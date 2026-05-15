## 보안 코드 리뷰

### 발견사항

---

**[INFO] `recoverLeakedPlan` — 단일 인용부호(`'`) 문자열 처리**
- 위치: `recover-leaked-plan.ts`, `findMatchingBrace` 함수
- 상세: JSON 표준은 문자열 구분자로 이중 인용부호만 허용하지만, 이 파서는 단일 인용부호도 문자열 시작으로 인식한다. 유효한 JSON은 `JSON.parse`에서 어차피 실패하므로 실질적 취약점은 없지만, `'` 문자가 포함된 입력에서 depth 카운팅 오동작 가능성이 있다 (ex: `{ "x": "it's fine", ... }`에서 `'s`가 문자열로 인식되어 이후 `{`/`}`를 무시).
- 제안: `inString` 핸들링을 JSON 표준에 맞게 이중 인용부호만으로 제한하거나, 현재 동작이 의도적이라면 주석에 명시.

```typescript
// 현재: '"' 또는 "'" 모두 처리
if (c === '"' || c === "'") { inString = c; ... }

// 제안: JSON 표준 준수
if (c === '"') { inString = c; ... }
```

---

**[INFO] 복구된 plan 필드에 길이 제한 없음 — DB 지속 전**
- 위치: `recover-leaked-plan.ts`, `isProposePlanShape` + `workflow-assistant-stream.service.ts`, `buildPlanFromArgs`
- 상세: `isProposePlanShape`는 `title`, `description`, `summary` 문자열의 길이를 검증하지 않는다. LLM이 수천 자의 `description`을 가진 step을 뱉어도 통과하며, `buildPlanFromArgs`에서도 제한 없이 `AssistantPlanRecord`에 저장된다. 이후 `renderActivePlanSection`의 `sanitizeLabel(s, 200)` 에서야 프롬프트 삽입 시 절단된다. DB 직접 저장 경로에서는 길이 제한 없음.
- 제안: `isProposePlanShape`에서 제목 최대 200자, step description 최대 500자 등 합리적 상한을 적용.

---

**[WARNING] 간접 프롬프트 인젝션 — LLM 출력 기반 plan 자동 생성**
- 위치: `workflow-assistant-stream.service.ts` `:637-688` (leak 복구 블록)
- 상세: 악의적 사용자가 워크플로우 노드 config, label, 혹은 대화 내용에 `{ "title": "...", "steps": [...] }` 형태의 텍스트를 심어 LLM이 이를 텍스트 채널로 그대로 출력하도록 유도할 수 있다. `recoverLeakedPlan`이 이를 실제 `propose_plan` tool call로 변환하면, 사용자가 직접 요청하지 않은 plan이 자동 생성되어 세션에 영속화된다. 공격자가 워크플로우 노드 데이터를 편집할 수 있다면 (공유 워크플로우 등) 이 경로가 실질적 위협이 된다.
- 완화 요소: `isProposePlanShape`의 엄격한 shape 검증, `VALID_STEP_ACTIONS` 화이트리스트, 이후 사용자 승인이 필요한 plan 구조. 즉각적인 canvas 변경은 없음.
- 제안: 복구 시 로그에 `recovered: true` 플래그 외에 클라이언트 측에서도 시각적으로 "자동 복구된 계획"임을 구분 표시하여 사용자 인지를 높이는 것 검토.

---

**[INFO] `sessionId` 로그 출력 시 미가공 삽입**
- 위치: `workflow-assistant-stream.service.ts` `:644-649`
- 상세: `sessionId`는 서버 내부에서 생성된 값이므로 현실적 위험은 낮지만, 로그 라인에 `sessionId`가 raw string interpolation으로 삽입된다. `title`은 `JSON.stringify`로 이스케이프되지만 `sessionId`는 그렇지 않다.
- 제안: 일관성을 위해 `sessionId`도 `JSON.stringify`로 감싸거나, 로그 포맷터가 구조화 로깅(structured logging)을 지원한다면 object 형태로 전달.

---

**[INFO] `openQuestions` 타입 캐스팅 — `buildPlanFromArgs`**
- 위치: `workflow-assistant-stream.service.ts`, `buildPlanFromArgs` 내 `openQuestions` 처리
- 상세: `(args.openQuestions as string[])` 캐스팅은 각 원소가 string임을 런타임에 보장하지 않는다. 복구 경로에서는 `isProposePlanShape`가 사전 검증하므로 안전하지만, 정상 tool call 경로(`kind === 'plan'`)는 같은 `buildPlanFromArgs`를 사용하며 거기서는 LLM이 number나 null을 섞어 보낼 수 있다.
- 제안: `.filter((q): q is string => typeof q === 'string')`으로 안전하게 처리.

---

### 요약

이번 변경은 LLM이 `propose_plan` 도구 대신 plan JSON을 텍스트 채널로 출력하는 실사례를 방어하는 프롬프트 강화(Option A)와 서버 사이드 복구(Option B)를 동시에 도입한다. 기존 `sanitizeUserText`/`sanitizeLabel` 방어선은 잘 유지되고 있으며, `isProposePlanShape`의 엄격한 shape 검증과 `VALID_STEP_ACTIONS` 화이트리스트가 오탐·남용을 1차 차단한다. 다만 간접 프롬프트 인젝션 경로(악의적 노드 데이터 → LLM 텍스트 출력 → 자동 plan 생성)는 신규 공격 표면으로 존재하며, 공유 워크플로우 환경에서는 주의가 필요하다. 단일 인용부호 파싱 처리, 필드 길이 미검증, `openQuestions` 타입 캐스팅은 낮은 우선순위의 방어적 개선 사항이다.

### 위험도

**LOW**