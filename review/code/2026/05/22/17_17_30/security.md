# 보안(Security) 코드 리뷰 결과

**대상**: AI Agent Presentation Tools (`render_*` tool family)
**검토 일시**: 2026-05-22
**검토 범위**: 파일 1~21 (backend 10개, frontend 8개, plan/i18n 3개)

---

## 발견사항

### [INFO] `render_` prefix 검사의 잠재적 우회 — `matches()` 검증 범위 제한

- **위치**: `render-tool-provider.ts` 라인 217-219 (`matches` 메서드), 라인 82-86 (`typeFromToolName`)
- **상세**: `matches()` 는 `toolName.startsWith('render_')` 로만 판단한다. `typeFromToolName()` 은 suffix 를 `SCHEMA_BY_TYPE` 조회로 재검증하여 실질적으로 5종 외의 suffix 는 `null` 을 반환한다. 이중 검증 구조가 정상 동작하여 `render_unknown_payload` 같은 임의 이름은 `UNKNOWN_TOOL` 에러로 처리된다. 다만 `matches()` 의 반환이 `true` 인 채로 `execute()` 에 도달했을 때 dispatch 는 `typeFromToolName` 에만 의존하므로 두 함수의 동작이 계속 정합하게 유지되어야 한다. 현재 코드에서는 문제 없으나, `matches()` 와 `typeFromToolName()` 이 분리된 함수이므로 미래 수정 시 inconsistency 가 생길 수 있다.
- **제안**: `matches()` 내부에서도 `typeFromToolName(toolName) !== null` 을 추가 조건으로 사용하거나, 최소한 코드 주석으로 두 함수의 정합 의존성을 명시한다.

---

### [INFO] LLM 제어 입력이 `formConfig` 로 전달 — `blockingFormRender.formConfig` 다운스트림 소비 시 신뢰 경계 주의

- **위치**: `render-tool-provider.ts` 라인 391-401, `agent-tool-provider.interface.ts` 라인 355-360
- **상세**: `blockingFormRender.formConfig` 는 LLM 이 생성한 payload 에 `defaults` overlay 를 적용한 후 zod schema 로 검증된 값이다. 현재 phase 2b 구현이 없어 (`ai-agent.handler.ts` 라인 1723-1735 에서 warn 후 schema violation 으로 처리) 이 경로는 실제 실행되지 않는다. 그러나 phase 2b 구현 시 `formConfig` 를 폼 렌더링 또는 외부 시스템 호출에 직접 사용할 경우, LLM 이 의도적으로 조작한 값이 downstream 에 영향을 줄 수 있다. `formConfig` 는 `Record<string, unknown>` 타입이고 zod validation 을 통과했으나, presentation form schema 의 허용 범위가 곧 downstream 의 허용 범위가 된다.
- **제안**: phase 2b 구현 시 `formConfig` 를 presentation form renderer 에 전달하기 전에, 렌더링 목적 외의 필드 (예: server-side callback URL, redirect 등) 가 form schema 에 포함될 수 없도록 presentation form 스키마 자체의 허용 필드를 제한적으로 정의한다. `formConfig` 를 신뢰할 수 없는 LLM 출력으로 취급하고 화이트리스트 접근을 유지한다.

---

### [INFO] `overlayDefaults` 재귀 깊이 제한 없음 — 대용량 중첩 객체에 대한 스택 오버플로우 가능성

- **위치**: `render-tool-provider.ts` 라인 108-133 (`overlayDefaults` 함수)
- **상세**: `overlayDefaults` 는 `defaults` 객체의 각 키에 대해 재귀 호출을 수행한다. LLM 이 극단적으로 깊이 중첩된 JSON 객체를 `arguments` 로 전달할 경우 (예: `{a:{a:{a:{...}}}}` 수백 단계), 재귀 호출 스택이 Node.js 기본 제한에 도달할 수 있다. 다만 이 함수 실행 이전에 zod schema `safeParse` 가 먼저 수행되므로 (라인 334), presentation 노드 schema 가 중첩 깊이를 실질적으로 제한한다면 실제 도달 가능성은 낮다. `defaults` 자체는 관리자가 설정하는 값이므로 공격자가 직접 제어하지 않는다.
- **제안**: zod schema 가 중첩 깊이를 제한하는지 확인한다. 확인이 어렵다면 `overlayDefaults` 에 최대 재귀 깊이 파라미터 (예: `depth = 0`, `maxDepth = 20`) 를 추가하고 초과 시 defaults 값을 그대로 반환하도록 처리한다.

---

### [INFO] `render_<type>` 레이블이 프론트엔드에 직접 렌더링 — XSS 위험 없음 확인

- **위치**: `assistant-presentations-block.tsx` 라인 63 (`<span>render_{p.type}</span>`)
- **상세**: `p.type` 은 `PresentationType` union (`'table' | 'chart' | 'carousel' | 'template' | 'form'`) 이고 백엔드에서 zod enum 으로 검증된 값이다. React 가 `{p.type}` 을 텍스트 노드로 자동 이스케이프하므로 XSS 위험이 없다. `dangerouslySetInnerHTML` 이 사용되지 않는다.
- **제안**: 현재 구현은 안전하다. 향후 `p.type` 을 attribute 값으로 직접 삽입하는 경우가 생기면 재검토가 필요하다.

---

### [INFO] `TemplateContent` — `dangerouslySetInnerHTML` + DOMPurify 조합 적절

- **위치**: `presentation-renderers.tsx` 라인 377, 387 (`TemplateContent` 내 `dangerouslySetInnerHTML`)
- **상세**: `TemplateContent` 는 LLM 이 생성한 HTML/Markdown 을 `dangerouslySetInnerHTML` 로 렌더링한다. `sanitizeHtml` 함수가 DOMPurify 를 사용하며, `SANITIZE_CONFIG` 에서 `style` 속성을 명시적으로 제외하고 허용 태그와 속성을 화이트리스트로 제한한다. CSS injection, data: URL, script injection 등의 주요 벡터가 차단되어 있다. SVG 속성도 SVG-specific 속성만 허용한다.
- **제안**: 현재 구현은 적절하다. `href` 속성이 허용되어 있으므로 `javascript:` protocol 이 링크에 삽입될 수 있는지 추가 확인이 권장된다. DOMPurify 는 `javascript:` href 를 기본적으로 차단하나, 버전에 따라 동작이 다를 수 있으므로 `FORCE_BODY` 또는 `ALLOWED_URI_REGEXP` 옵션으로 명시적으로 제한하는 것을 고려한다.

---

### [INFO] `p.toolCallId` 가 React `key` 로 사용 — 빈 값 시 index fallback

- **위치**: `assistant-presentations-block.tsx` 라인 58 (`key={p.toolCallId || p.type}-${idx}`)
- **상세**: `toolCallId` 가 빈 문자열이면 `p.type` 으로 fallback 되고 동일 type 이 여러 개일 때 `idx` 로만 구분된다. 보안 취약점이 아니나, `toolCallId` 는 백엔드에서 항상 설정되어야 하는 값이므로 (`PresentationPayload` interface 에서 non-optional) 빈 값이 도달한다면 상위 흐름의 버그를 나타낸다.
- **제안**: `toolCallId` 는 백엔드 `PresentationPayload` 에서 required 필드이므로 프론트엔드에서도 required 로 가정하고 `key={p.toolCallId}-${idx}` 로 단순화한다.

---

### [INFO] `safeJsonParse` 에러 메시지가 LLM tool_result 에 포함

- **위치**: `render-tool-provider.ts` 라인 135-143, 라인 307-325
- **상세**: JSON 파싱 실패 시 `parsed.error` (JavaScript `Error.message`) 가 `issues` 배열에 포함되어 tool_result 로 LLM 에게 회신된다. 이 에러 메시지는 사용자에게 직접 노출되지 않고 LLM 내부 컨텍스트에서만 사용된다. Node.js `JSON.parse` 의 에러 메시지는 입력 내용 일부를 포함할 수 있으나 (예: "Unexpected token 'x' at position 3"), 이는 LLM 재시도 안내를 위한 정보로서 적절한 사용이다. `meta.presentationSchemaViolations` 에도 기록되나 이는 내부 메트릭 경로이다.
- **제안**: 현재 사용 패턴은 보안상 문제 없다. `issues` 내용이 최종 사용자 UI 에 직접 노출되는 경로가 추가될 경우 재검토가 필요하다.

---

### [WARNING] `defaults` 필드가 `z.record(z.string(), z.unknown())` 로 정의 — 임의 구조 허용

- **위치**: `ai-agent.schema.ts` 라인 249-259 (`presentationToolDefSchema` 의 `defaults` 필드)
- **상세**: `defaults` 는 `z.record(z.string(), z.unknown())` 로 정의되어 임의의 키-값 구조를 허용한다. 이 값은 관리자(워크플로우 설계자)가 설정하며 LLM 이 생성하지 않는다. `overlayDefaults` 로 LLM payload 와 deep-merge 되어 최종적으로 presentation node 의 zod schema 로 검증된다. 따라서 악의적인 `defaults` 설정이 zod validation 을 우회해 프론트엔드 렌더러에 도달할 수 없다. 다만 워크플로우 설계자가 신뢰할 수 없는 환경(예: 멀티테넌트, 워크플로우 공유)에서 `defaults` 를 통해 의도치 않은 데이터를 주입할 수 있다.
- **위험 조건**: 멀티테넌트 환경에서 워크플로우 설계자 권한을 가진 사용자가 악의적인 `defaults` 를 설정하는 경우.
- **제안**: `defaults` 의 최대 바이트 크기를 schema 레벨에서 제한하는 것을 고려한다. 현재 1MB cap 은 최종 payload 에만 적용되며 `defaults` 자체의 크기는 별도로 제한되지 않는다.

---

### [INFO] 하드코딩된 시크릿 없음 확인

모든 변경 파일을 검토한 결과 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다.

---

### [INFO] 인증/인가 변경 없음 확인

이번 변경은 프레젠테이션 렌더링 tool provider 를 추가하는 기능 확장이다. 인증/인가 경계 변경, 새로운 인증 우회 경로, 세션 관리 변경은 없다. `presentationTools` 설정은 기존 노드 config 접근 제어 체계에 포함된다.

---

### [INFO] 의존성 보안 — 기존 DOMPurify, zod 재사용

신규 npm 의존성 추가가 없다. DOMPurify 및 zod 는 기존 코드베이스에서 사용 중인 라이브러리를 그대로 재사용한다.

---

## 요약

이번 변경은 AI Agent 에 `render_*` 가상 도구 패밀리를 추가하는 기능 확장이다. 보안 측면에서 전반적으로 방어적으로 설계되었다. LLM 출력은 반드시 zod schema 검증을 통과해야 하며, 프론트엔드 HTML 렌더링은 DOMPurify 화이트리스트로 보호된다. `render_*` tool name 은 이중 검증(matches + typeFromToolName), `defaults` overlay 는 관리자 설정 후 zod re-validation 을 거친다. 주요 우려 사항은 `defaults` 필드의 크기 미제한(WARNING 수준)과 `overlayDefaults` 재귀 깊이 미제한(INFO), 그리고 phase 2b 에서 `blockingFormRender.formConfig` 를 신뢰할 수 없는 LLM 출력으로 취급해야 한다는 점이다. 하드코딩된 시크릿, SQL/커맨드 인젝션, SSRF, 인증 우회 등 OWASP Top 10 Critical 수준의 취약점은 발견되지 않았다.

---

## 위험도

**LOW**

> 현재 구현 범위에서 CRITICAL/HIGH 수준 취약점은 없다. 미구현(phase 2b) 인 `render_form` 블로킹 흐름 구현 시 `formConfig` 신뢰 경계 설계를 보안 관점에서 재검토해야 한다.
