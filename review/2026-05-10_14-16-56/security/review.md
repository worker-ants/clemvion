### 발견사항

---

**[WARNING] PII 노출 불일치 — 불완전한 입력 필드 Truncation**
- 위치: `text-classifier.handler.ts`, catch 블록 내 return 구조
- 상세: 코드 주석은 "long user prompts / PII don't land full-length in error envelope details"를 목적으로 `truncateForErrorDetails(inputField, 500)`을 명시하지만, **동일한 `inputField` 원문이 세 경로로 여전히 노출**된다.
  1. `output.originalInput: inputField` → truncation 없음
  2. `meta.llmCalls[0].requestPayload.messages[1].content` → 사용자 입력 원문 그대로
  3. `output.error.details.originalInput: truncatedInput` → 유일하게 500자 cap
- 다운스트림 노드가 `$node[X].output.originalInput` 또는 `$node[X].meta.llmCalls[0].requestPayload`로 접근하면 PII가 완전한 형태로 노출된다. spec §5.3 JSON 예시도 동일 패턴으로 기술되어 있어 설계 의도처럼 보이지만, PII 방어 목적의 truncation이 하나의 필드에만 적용되는 것은 불완전하다.
- 제안: `output.originalInput`도 `truncatedInput`으로 교체하거나, 세 노출 지점의 정책을 spec에 명시적으로 문서화할 것. `requestPayload.messages`의 `content`는 별도로 truncate하거나 `meta.llmCalls`에서 제외를 검토.

---

**[INFO] meta.llmCalls에 requestPayload 전체 포함 — 비즈니스 로직 노출**
- 위치: `text-classifier.handler.ts:165`, `meta.llmCalls[0].requestPayload`
- 상세: `requestPayload`에는 카테고리 목록, 사용자 instructions, JSON Schema 등 구성된 시스템 프롬프트 전체가 포함된다. 이전 코드에서는 `output._llmCalls`(언더스코어 prefix로 internal 시그널)에 있었으나, 이번 변경으로 `meta.llmCalls`로 이동하여 공식 접근 경로(`$node[X].meta.llmCalls`)로 승격되었다. 성공 경로(`processSingleLabelResult`)에도 동일하게 존재하므로 신규 취약점은 아니지만, debug trace가 정식 메타데이터로 공개됨에 따라 다운스트림 노드가 프롬프트 구조를 읽을 수 있게 된다.
- 제안: `requestPayload`를 그대로 포함할 경우 spec에 "디버그 전용이며 외부 노출 의도 없음"을 명시. 민감도가 높으면 `requestPayload`에서 `messages[1].content`(사용자 입력)만 제거하거나 마스킹 적용.

---

**[INFO] 에러 메시지 원문 패스스루**
- 위치: `text-classifier.handler.ts:125`, `const message = error instanceof Error ? error.message : String(error)`
- 상세: LLM 프로바이더의 에러 메시지 원문이 필터링 없이 `output.error.message`로 반환된다. rate limit 헤더 정보, 내부 엔드포인트 URL, 계정 quota 상세 등이 포함될 수 있다. spec이 "provider 원문 보존, 국제화 없음"으로 명시하고 있어 의도된 설계이나, 다운스트림 노드가 이 메시지를 그대로 사용자에게 노출할 경우 정보 유출이 된다.
- 제안: spec에 "다운스트림에서 사용자 노출 시 sanitize 책임은 호출자에게 있음"을 명기하거나, provider 에러 메시지 패턴 목록을 정의해 표준화된 메시지로 래핑하는 레이어 검토.

---

**[INFO] 타이밍 정보 노출**
- 위치: `meta.durationMs`, `meta.llmCalls[0].durationMs`
- 상세: LLM 호출 소요 시간이 에러 응답에 포함된다. 이 컨텍스트에서 timing side-channel 위험은 극히 낮으나, 워크플로우 외부로 이 데이터가 노출되는 경로가 있다면 공격자가 모델/네트워크 조건을 추론하는 데 활용될 수 있다.
- 제안: 내부 워크플로우 실행에만 사용되고 외부 API 응답에 포함되지 않는다면 수용 가능.

---

### 요약

이번 변경은 에러 케이스의 `meta` 필드를 채우는 관찰가능성(observability) 개선이 주목적으로, 새로운 데이터를 생성하는 것이 아니라 기존 `output._llmCalls`를 `meta.llmCalls`로 재배치한 것이다. 근본적인 보안 취약점은 존재하지 않으나, **PII truncation 정책이 세 노출 지점 중 하나(`details.originalInput`)에만 적용**되는 불일치가 가장 주목할 사항이다. 주석과 CONVENTIONS §7의 의도(`PII don't land full-length`)와 실제 동작이 일치하지 않아, 다운스트림 노드가 `$node[X].output.originalInput`이나 `$node[X].meta.llmCalls[0].requestPayload`를 통해 완전한 사용자 입력에 접근할 수 있다. 나머지 발견사항은 모두 설계상 의도된 정보 노출이나 기존 코드에서 이전된 패턴이다.

### 위험도

**LOW**