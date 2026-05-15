### 발견사항

---

**[INFO] 사용자 설정 포트 `label` 필드가 비정제(unsanitized) 상태로 LLM tool result에 포함됨**
- **위치**: `workflow-assistant-stream.service.ts` — `portResolver` 내부 `p.label ? { label: p.label } : {}` 분기
- **상세**: 캐러셀 버튼·스위치 케이스 등 사용자가 직접 입력한 `config.buttons[*].label` 값이 `result.ports.outputs[*].label`로 직렬화되어 LLM 컨텍스트에 그대로 투입된다. 동일 코드베이스의 `userRequest`는 `sanitizeLlmProvidedString()`을 거쳐 C0/C1 제어문자·Bidi·꺾쇠·개행을 중화하는데, 포트 `label`은 동일 경로를 거치지 않는다. JSON 구조가 자연적인 구분자를 제공하고 LLM이 `id`를 사용하도록 지시되어 있어 실제 악용 가능성은 낮지만, 악의적으로 구성된 label(예: `"IGNORE PREVIOUS INSTRUCTIONS: ..."`)이 LLM 추론에 영향을 줄 수 있는 간접 프롬프트 인젝션 표면이 존재한다.
- **제안**: `p.label`을 포함하기 전에 `sanitizeLlmProvidedString(p.label, 80)` 통과 처리를 적용한다. `LABEL_HINT_MAX_LEN`(80)은 기존 label 처리와 동일한 상한이므로 재사용 적합.

```typescript
// workflow-assistant-stream.service.ts — portResolver 내부
import { sanitizeLlmProvidedString } from './tools/shadow-workflow';

...(p.label
  ? { label: sanitizeLlmProvidedString(p.label, 80) }
  : {})
```

---

**[INFO] `retriedFromError` HTML `title` 속성 사용 — React 이스케이프 의존**
- **위치**: `tool-call-badge.tsx` — `title` prop 구성 블록
- **상세**: `retriedFromError`는 서버 `ShadowErrorCode` 열거형(`'PORT_NOT_FOUND'` 등)에서 유래하지만, 프론트엔드에서 `call.result as { error?: unknown }` 로 캐스팅 후 `typeof r?.error === "string"` 로 받아 HTML `title` 속성에 직접 삽입된다. React JSX가 속성값을 자동 이스케이프하므로 현재는 XSS가 발생하지 않는다. 그러나 보호가 React의 기본 동작에만 의존하며, `dangerouslySetInnerHTML` 등으로 렌더 경로가 변경될 경우 재검토가 필요하다.
- **제안**: 현재 구조는 안전하다. 단, 서버에서 내려오는 error 코드를 `RECOVERABLE` 집합(`PORT_NOT_FOUND`, `NODE_NOT_FOUND`) 등 알려진 값으로 화이트리스트 검증 후 badge에 전달하면 신뢰 경계가 명시적으로 좁혀진다.

---

**[INFO] `RUNTIME_PORTS_MAX_PER_SIDE = 50` 방어 상수 — 긍정 평가**
- **위치**: `shadow-workflow.ts:252`, `buildRuntimePorts()`
- **상세**: `portResolver`가 반환하는 출력 포트가 과도하게 많을 경우(악의적 또는 오류 config) `result.ports` 페이로드 폭주 및 LLM 컨텍스트 낭비를 막기 위해 `.slice(0, 50)`으로 상한을 적용한 것은 올바른 방어적 구현이다. 추가 조치 불필요.

---

**[INFO] 시스템 프롬프트 내 `result.ports` 텍스트 삽입 — 안전**
- **위치**: `system-prompt.ts` — 정적 블록 수정 부분
- **상세**: 변경된 프롬프트 텍스트는 상수 문자열이며 런타임 사용자 데이터가 직접 포함되지 않는다. `userRequest` 삽입 경로(`buildSystemPrompt()`의 `sanitizeUserRequest()`)는 기존과 동일하게 유지되며, 추가 삽입 경로가 도입되지 않았다.

---

### 요약

이번 변경사항(ED-AI-40: `add_node`/`update_node` 성공 시 runtime ports 자동 포함, retry-recovered 배지)에서 중대한 보안 취약점은 발견되지 않았다. `RUNTIME_PORTS_MAX_PER_SIDE = 50` 상한, `sanitizeLlmProvidedString` 활용, React JSX의 자동 이스케이프 등 기존 방어 기제가 잘 유지되고 있다. 다만 사용자 설정 포트 `label`이 `sanitizeLlmProvidedString`을 거치지 않고 LLM tool result에 포함되는 점이 간접 프롬프트 인젝션 표면을 소폭 확대하므로, `userRequest` 처리와 동일한 sanitize 경로를 적용하는 것이 바람직하다.

### 위험도

**LOW**