# Security Review — AI Agent render_* Button userMessage

## 발견사항

### [WARNING] LLM-authored userMessage 콘텐츠 미검증 — XSS 잠재 경로
- **위치**: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` — `composeUserMessage` 함수 및 `handlePortButtonClick`
- **상세**: `button.userMessage` 는 LLM(외부 AI 모델)이 직접 설정하는 자유 문자열 필드다. `composeUserMessage` 가 반환한 값은 `onSendMessage(msg)` 를 통해 채팅 인터페이스로 곧바로 전달된다. 해당 문자열이 React 렌더 트리에서 `dangerouslySetInnerHTML` 없이 일반 텍스트로 취급된다면 XSS 위험은 낮지만, 이 값이 이후 서버나 다른 렌더 경로(마크다운·HTML 렌더러)로 흘러갈 경우 입력 새니타이징이 없으므로 스크립트 인젝션이 가능하다. 현재 코드에서 길이 제한, 특수문자 이스케이프, HTML 태그 필터링 중 어떤 것도 적용되지 않는다.
- **제안**: `onSendMessage` 호출 직전, 또는 `composeUserMessage` 내부에서 `userMessage` 값에 대해 (1) 최대 길이 제한(예: 500자), (2) `<`, `>`, `"`, `'` 등 HTML 특수문자 이스케이프, (3) `javascript:` · `data:` 스킴 패턴 필터링을 적용하거나, 이 문자열이 순수 평문 텍스트로만 사용됨을 아키텍처적으로 보장(React `children` 으로만 렌더)해야 한다.

---

### [WARNING] userMessage 길이 무제한 — DoS / 프롬프트 인젝션
- **위치**: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` (ButtonDef 인터페이스), `carousel.schema.ts` / `chart.schema.ts` / `table.schema.ts` / `template.schema.ts` 각각의 `buttonDefSchema`
- **상세**: `userMessage` 는 `z.string().optional()` 로 정의되어 있고 최대 길이 제약이 없다. LLM 이 악의적(또는 실수)으로 매우 긴 문자열(수십 KB 이상)을 emit 하면, 이 값이 채팅 UI 전송, 서버 저장, 다음 LLM turn 의 context 로 흘러들어가 (1) 불필요한 토큰 소비, (2) LLM 컨텍스트 오염(프롬프트 인젝션), (3) 스토리지/메모리 낭비로 이어질 수 있다. 특히 다음 LLM turn 의 user message 로 그대로 삽입되는 구조상, 공격자가 제어하는 `userMessage` 를 통해 시스템 프롬프트 무력화·역할 탈취가 가능한 간접 프롬프트 인젝션 경로가 존재한다.
- **제안**: Zod 스키마에 `.max(500)` 또는 서비스 정책에 맞는 상한을 추가한다. 예: `z.string().max(500).optional()`. `validateButtons` 함수(`button.types.ts`)에도 `userMessage` 길이 검사를 추가하는 것이 권장된다.

---

### [WARNING] userMessage 가 link 타입 버튼에도 파싱 시 통과 — 정책 불일치
- **위치**: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts` (테스트 케이스: "preserves userMessage on link-typed buttons at parse-time"), `validateButtons` 함수 (`button.types.ts`)
- **상세**: 스펙 §1.1은 `type: "link"` 버튼에 `userMessage` 가 설정된 경우 "무시"(클릭 시점 프론트엔드 책임)라고 명시하며, 파싱 단계에서는 reject 하지 않는다. 그러나 현재 `validateButtons` 도 이를 검증하지 않는다. `type: "link"` 인데 `userMessage` 가 존재하는 페이로드가 백엔드에서 아무런 경고 없이 저장·전달된다. 악의적 LLM 이 외부 URL로 이동하는 버튼에 `userMessage` 를 심어 두고 클라이언트가 이를 처리하도록 혼란을 유발하거나, 향후 코드 변경으로 `link` 타입에서도 `userMessage` 가 처리되는 회귀가 생길 수 있다.
- **제안**: `validateButtons` 에 `type: "link" && userMessage` 조합에 대해 최소한 경고(non-blocking error) 수준의 검증을 추가한다. 또는 Zod 스키마 수준에서 `.refine()` 으로 `link` + `userMessage` 조합을 명시적으로 배제하도록 한다.

---

### [WARNING] `__item_{idx}` 파싱 시 정수 범위 검증 부재 — items 배열 경계 초과 접근
- **위치**: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` — `findButtonContext` 함수, 라인 기준 `dynamicIdx` 처리 블록
- **상세**: `buttonId.match(/__item_(\d+)$/)` 로 추출한 인덱스를 `items[dynamicIdx]` 에 직접 사용한다. `Number.isFinite` 체크만 수행하며 `dynamicIdx < items.length` 및 `dynamicIdx >= 0` 을 명시적으로 확인하지 않는다. JavaScript 배열에서 범위 초과 접근은 `undefined` 를 반환하므로 런타임 오류를 일으키지는 않지만, 악의적으로 조작된 `buttonId`(예: `act__item_999999`) 로 의도하지 않은 `undefined` 컨텍스트를 유발할 수 있다. 또한 매우 큰 정수값의 경우 성능 영향이 있을 수 있다.
- **제안**: 아래와 같이 범위 검증을 추가한다:
  ```ts
  const dynamicItem =
    dynamicIdx !== null &&
    Number.isFinite(dynamicIdx) &&
    dynamicIdx >= 0 &&
    dynamicIdx < items.length
      ? items[dynamicIdx]
      : undefined;
  ```

---

### [INFO] .passthrough() 스키마 — 추가 필드 무제한 허용
- **위치**: `carousel.schema.ts`, `chart.schema.ts`, `table.schema.ts`, `template.schema.ts` — 각 `buttonDefSchema`의 `.passthrough()`
- **상세**: 모든 `buttonDefSchema` 가 `.passthrough()` 를 사용하고 있어, Zod 파싱 후에도 스키마에 정의되지 않은 임의의 필드가 페이로드에 보존된다. LLM 이 emit 하는 버튼 객체에 `__proto__`, `constructor` 등의 프로토타입 오염 관련 키나 내부 상태를 혼란시킬 수 있는 필드를 포함시켜도 그대로 통과한다. TypeScript 타입 시스템이 런타임에는 보호 역할을 하지 않는다.
- **제안**: `passthrough()` 대신 `.strip()` (기본 Zod 동작)을 사용하거나, 알려진 필드만 명시적으로 허용하는 엄격 모드를 적용한다. 이미 존재하는 필드 정의가 충분하다면 `.strict()` 로 미지정 필드를 거부하는 것도 고려할 수 있다.

---

### [INFO] URL 스킴 검증이 공유 validateButtons 에만 존재 — Zod 스키마 레벨 미흡
- **위치**: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` — `validateButtons` 함수 (라인 154)
- **상세**: `javascript:`, `data:`, `vbscript:` 스킴에 대한 URL 검증이 `validateButtons` 임페러티브 함수에만 존재하며 Zod 스키마 수준의 `.url()` 이나 `.refine()` 으로는 보호되지 않는다. `validateButtons` 를 거치지 않는 경로(Zod 파싱만 수행하는 경우)에서는 악성 URL이 통과할 수 있다. 현재 코드에서 `carousel.schema.ts` 등의 `buttonDefSchema.url` 필드는 단순 `z.string().optional()` 로 정의되어 있다.
- **제안**: `url` 필드의 Zod 스키마에 `.refine()` 을 추가해 파싱 시점에도 `javascript:` 등을 차단한다. 예: `z.string().refine(v => !/^(javascript|data|vbscript):/i.test(v.trim()), 'Disallowed URL scheme').optional()`.

---

### [INFO] 하드코딩된 시크릿 — 없음
모든 변경 파일에서 API 키, 비밀번호, 토큰, 인증서 등의 하드코딩된 시크릿은 발견되지 않았다.

---

### [INFO] 에러 처리 — 민감 정보 노출 없음
에러 메시지 및 검증 실패 메시지에 민감 정보(사용자 데이터, 내부 경로 등)가 포함되지 않는다. 검증 오류는 필드명·인덱스 기반의 범용적 메시지를 사용한다.

---

## 요약

이번 변경은 AI Agent `render_*` 도구에서 LLM이 버튼 클릭 시 발화될 user message(`userMessage` 필드)를 명시할 수 있도록 하는 기능 추가다. 보안 관점에서 가장 주목해야 할 지점은 **LLM-authored 자유 문자열이 입력 검증 없이 채팅 user message로 직접 흘러가는 경로**다. 현재 구현에는 길이 제한, HTML 이스케이프, 프롬프트 인젝션 방지 로직이 전혀 없으며, `passthrough()` 스키마로 인해 임의 필드도 페이로드에 보존된다. URL 스킴 검증은 임페러티브 함수 레벨에만 존재하고 Zod 파싱 레벨에는 빠져 있다. 심각한 0-day 취약점은 없으나, LLM이 `userMessage`를 통해 다음 LLM turn 시스템 프롬프트를 오염시키는 간접 프롬프트 인젝션 경로는 실질적 위협으로 분류될 수 있다. `dynamicIdx` 배열 경계 검증은 방어적 코드 수준의 경미한 미흡이다.

---

## 위험도

**MEDIUM**
