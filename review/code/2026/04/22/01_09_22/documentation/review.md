## 발견사항

### [INFO] `harmony-filter.ts` 복잡 정규식에 패턴 설명 부재
- **위치**: `harmony-filter.ts`, `CHANNEL_BLOCK_RE` 상수 정의
- **상세**: `CHANNEL_BLOCK_RE`는 채널 이름 그룹, `<|constrain|>` 같은 중간 토큰을 허용하는 `[\s\S]*?`, 그리고 lookahead 종료 조건을 포함하는 상당히 복잡한 패턴이다. 모듈 JSDoc이 전체 동작을 잘 설명하고 있지만, 정규식 자체에 "왜 `[\s\S]*?`가 `<|message|>` 앞에 있는지"(중간에 `<|constrain|>` 토큰이 올 수 있기 때문)를 한 줄로 설명하는 주석이 없다.
- **제안**:
  ```ts
  // channel name, optional <|constrain|>/<|return|> modifiers, then message body
  const CHANNEL_BLOCK_RE = ...
  ```

---

### [INFO] `markdown-renderer.tsx` JSDoc 설계 선택 항목에 harmony filter 미언급
- **위치**: `markdown-renderer.tsx`, 파일 상단 JSDoc 블록 (Design choices 섹션)
- **상세**: 기존 JSDoc이 `remark-gfm`, `rehype-raw` 제외(XSS 사유), 링크 처리, 스트리밍 내성 등 설계 결정을 열거하고 있다. harmony sanitize가 새로 추가됐는데 이 목록에는 반영되지 않았다. 인라인 주석은 있지만, 설계 선택 항목 목록과의 일관성이 어긋난다.
- **제안**: Design choices에 항목 추가:
  ```
  * - `sanitizeAssistantText` is applied before rendering so harmony control
  *   tokens that leak through the text channel are never shown to the user.
  ```

---

### [INFO] 테스트 케이스 인라인 주석과 실제 단언값 불일치
- **위치**: `harmony-filter.test.ts`, `"strips stray harmony tokens"` 케이스
- **상세**: 주석에 "공백 정규화"라고 적혀 있지만, 실제 기대값은 `"hello  world".trim()`으로 내부 이중 공백이 그대로 남는다. 구현(`STRAY_TOKEN_RE`로 토큰만 제거)도 공백을 정규화하지 않으므로 주석이 잘못된 기대를 심어줄 수 있다.
- **제안**: 주석을 `// 잔여 토큰만 제거, 내부 공백은 정규화하지 않음`으로 수정하거나, 기대값을 명시적으로 `"hello  world"`로 작성.

---

### [WARNING] `CHANNEL_BLOCK_RE`의 캡처 그룹 인덱스가 소비 코드에서 묵시적으로 사용됨
- **위치**: `harmony-filter.ts`, `sanitizeAssistantText` 함수 내 `m[1]`, `m[2]` 접근
- **상세**: `m[1]`(채널 이름), `m[2]`(메시지 body)가 정규식 그룹 순서에 의존하는데, 이 대응 관계에 대한 주석이 없다. 나중에 정규식을 수정해 그룹이 추가되면 조용히 버그가 발생할 수 있다.
- **제안**: 정규식 바로 아래에 그룹 인덱스를 명시하는 상수 또는 주석 추가:
  ```ts
  // m[1] = channel name, m[2] = message body
  const CHANNEL_BLOCK_RE = ...
  ```

---

### [INFO] spec 문서의 harmony 토큰 패턴 예시가 불완전
- **위치**: `spec/3-workflow-editor/4-ai-assistant.md`, 메시지 리스트 행
- **상세**: 스펙에 `<\|channel\|>...<\|message\|>{...}` 형태만 언급했는데, 실제 구현은 `<|start|>`, `<|constrain|>`, `<|end|>`, `<|return|>` 등도 처리한다. 스펙 수준에서 전체 패턴 열거는 불필요하지만, "harmony 제어 토큰" 명칭 링크나 구현 파일 참조가 있으면 스펙-코드 추적성이 높아진다.
- **제안**: 스펙 해당 셀에 `(구현: \`harmony-filter.ts\`)` 정도의 참조 추가 (선택적).

---

## 요약

전반적인 문서화 품질은 높다. `harmony-filter.ts`는 모듈 수준 JSDoc이 목적·규칙·안전 원칙을 명확히 기술하고, spec 문서도 sanitize 동작·버블 숨김 조건·사용자 노출 방지를 구체적으로 기술해 스펙-구현 정합성이 잘 유지된다. `assistant-panel.tsx`의 `lastSignature` 주석도 변경 이유(tool_call 배지·plan 카드·step 체크)를 적시해 이전보다 개선됐다. 단, `CHANNEL_BLOCK_RE` 정규식의 그룹 인덱스 대응 설명 누락, `markdown-renderer.tsx` JSDoc의 설계 선택 항목 미갱신, 테스트 인라인 주석의 "공백 정규화" 오기재가 소소한 개선 여지로 남는다.

## 위험도

**LOW**