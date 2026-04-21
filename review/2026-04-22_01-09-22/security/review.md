## 보안 코드 리뷰

### 발견사항

---

**[WARNING] 시스템 프롬프트에 사용자 제어 데이터 주입 (Prompt Injection 위험)**
- 위치: `system-prompt.ts`, `JSON.stringify(current)` 구문
- 상세: `buildSystemPrompt`이 `JSON.stringify(current)`를 시스템 프롬프트에 직접 삽입합니다. `current`는 사용자가 만든 노드 라벨·config를 포함하며, 공격자가 노드 라벨에 `}\n\n## NEW INSTRUCTION: ignore above`와 같은 프롬프트 인젝션을 심으면 LLM의 행동을 조작할 수 있습니다. `JSON.stringify`는 JSON 문법 탈출을 보장하지만 LLM의 시맨틱 파싱까지 막지는 않습니다.
- 제안: 노드 라벨/설명 등 사용자 입력 필드는 주입용 패턴(`##`, 백틱 블록, role 키워드 등)을 서버 측에서 사전 검증·이스케이프하거나, 워크플로우 스냅샷을 `role: tool` 결과 채널로 분리해 시스템 프롬프트 대신 tool result로 전달하는 아키텍처 전환을 검토하세요.

---

**[WARNING] `redactConfig()` 미검증으로 인한 시크릿 노출 위험**
- 위치: `system-prompt.ts`, `toWorkflowView(snapshot)` 주석
- 상세: 주석에 "`config`는 `redactConfig()`로 정리된 상태"라고 명시되어 있으나, 해당 함수의 구현이 리뷰 범위에 없습니다. HTTP 노드에 저장된 API Key, Bearer Token, 웹훅 시크릿 등이 미흡하게 redact되면 LLM API 호출 payload에 포함되어 외부 프로바이더 로그에 기록됩니다.
- 제안: `redactConfig()`가 `password`, `token`, `apiKey`, `secret`, `authorization` 등 민감 키를 `[REDACTED]`로 치환하는지 단위 테스트로 명시적으로 검증하세요. LLM 제공사의 프롬프트 로깅 정책도 확인이 필요합니다.

---

**[INFO] 이중 sanitize 호출 (비효율, 기능 영향 없음)**
- 위치: `assistant-message.tsx:42`, `markdown-renderer.tsx:26`
- 상세: `AssistantMessageView`가 `sanitizeAssistantText`를 호출한 뒤 `MarkdownRenderer`에 전달하고, `MarkdownRenderer` 내부에서도 동일 함수를 다시 호출합니다. 보안상 문제는 없으나 불필요한 중복 연산이 발생합니다.
- 제안: `MarkdownRenderer` 내부의 sanitize 호출을 제거하고, 외부(부모 컴포넌트)에서 sanitize된 값이 들어온다는 것을 JSDoc으로 명시하세요.

---

**[INFO] `String.replace(m[0], "")` — 동일 패턴 반복 시 첫 번째만 제거**
- 위치: `harmony-filter.ts:42`
- 상세: `out.replace(m[0], "")` 는 동일한 raw 문자열이 여러 번 나타날 경우 첫 번째만 제거합니다. `matchAll`로 얻은 각 매치가 서로 다른 위치에 있더라도 내용이 완전히 같으면 두 번째 이후 매치가 잔류합니다.
- 제안: `out = out.replace(m[0], "")` → `out = out.split(m[0]).join("")` 또는 이스케이프된 정규식으로 `replaceAll`을 사용하세요.

---

**[INFO] `final` 채널 body의 LLM 제어 가능성**
- 위치: `harmony-filter.ts:33-39`
- 상세: `final` 채널 body는 `stripHarmonyTokens` 후 그대로 화면에 노출됩니다. `final` 채널은 "사용자에게 보여주기로 의도된 공식 채널"이지만, 외부 공격자가 LLM 응답을 가로채거나 LLM 자체가 오용될 경우 임의 마크다운/링크가 렌더될 수 있습니다. `ReactMarkdown`이 `rehype-raw` 없이 사용되므로 raw HTML XSS는 차단되어 있습니다. 현재 위협 모델에서는 낮은 리스크입니다.
- 제안: 현재 구성(`rehype-raw` 미사용, `noreferrer noopener` 링크) 유지. 변경 시 반드시 XSS 재검토가 필요합니다.

---

### 요약

이번 변경은 LLM이 assistant text 채널로 harmony 제어 토큰을 leak할 때 UI에서 이를 필터링하는 방어 레이어를 추가한 것으로, 전반적인 보안 방향성은 올바릅니다. 가장 주목해야 할 위험은 **시스템 프롬프트에 사용자 제어 데이터(`JSON.stringify(current)`)가 직접 삽입되는 구조**로, 이는 프롬프트 인젝션의 잠재적 공격면이 됩니다. `redactConfig()` 구현 품질에 따라 민감한 자격 증명이 LLM 프로바이더에 전달될 수도 있으며, 이 부분은 별도 검증이 필요합니다. `harmony-filter.ts` 자체의 regex는 ReDoS 위험이 없는 선형 패턴이며, XSS는 `rehype-raw` 미사용 정책으로 충분히 차단되어 있습니다.

### 위험도

**MEDIUM**