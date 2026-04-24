## 발견사항

### [INFO] `sanitizeLlmProvidedString` — C1 제어 문자 미처리
- **위치**: `shadow-workflow.ts` — `sanitizeLlmProvidedString` 함수
- **상세**: 현재 sanitizer는 `\x00-\x1F`, `\x7F`만 제거하고 `\x80-\x9F` (C1 제어 문자 블록)는 처리하지 않습니다. C1 범위에는 일부 터미널 에뮬레이터나 파서가 특수 처리하는 시퀀스(예: `\x85` NEL — 유니코드 newline)가 포함됩니다. 힌트가 LLM tool result로 전송되는 맥락이므로 실질적 위험은 낮지만, 방어 범위가 좁습니다.
- **제안**: 정규식을 `/[\x00-\x1F\x7F-\x9F]/g`로 확장하거나, 명시적으로 `\x85`, `\x0B` 등을 포함합니다.

---

### [INFO] 유니코드 방향 제어 문자(Bidi) 미중화
- **위치**: `shadow-workflow.ts` — `sanitizeLlmProvidedString` 함수
- **상세**: `\u202A`–`\u202E` (LRE, RLE, PDF, LRO, RLO), `\u2066`–`\u2069` (FSI/PDI 등), `\u200F` (RLM) 같은 유니코드 방향 제어 문자는 현재 sanitizer에서 통과됩니다. 이 문자들은 텍스트 에디터·터미널에서 시각적 인젝션에 악용될 수 있습니다. 힌트가 LLM에게 전달되는 도메인이므로 렌더링 공격 가능성은 낮지만, 노드 label이 사용자(LLM) 자유 입력이므로 zero-width 문자(`\u200B`, `\u200D`, `\uFEFF`)를 이용한 필터 우회 시도가 가능합니다.
- **제안**: 다음을 sanitizer에 추가합니다:
  ```typescript
  .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
  ```

---

### [INFO] `labelLookalikeHint` 입력에 사전 길이 제한 없음
- **위치**: `shadow-workflow.ts:383–390, 431–436, 493–505`
- **상세**: `labelLookalikeHint(value)`에 전달되는 `value`(LLM이 `id` 인자로 넣은 값)에 `maxLen` 이전에 길이 상한이 없습니다. 악의적(또는 버그성) LLM이 매우 긴 문자열을 `id` 자리에 넣으면 sanitizer의 `\s+` 압축 정규식이 긴 입력 전체를 처리한 뒤 잘라냅니다. 실제 공격 면은 작지만, sanitizer를 호출하기 전에 slice 처리를 추가하면 방어 깊이가 개선됩니다.
- **제안**: 
  ```typescript
  private labelLookalikeHint(value: string): string | null {
    if (!value || value.length > LABEL_HINT_MAX_LEN * 4) return null;
    // ...
  }
  ```

---

### [INFO] `node.id`의 JSON.stringify — 중복이나 무해
- **위치**: `shadow-workflow.ts` — `labelLookalikeHint` 메서드
- **상세**: `node.id`는 `randomUUID()`로 생성된 UUID이므로 이미 `[0-9a-f\-]`만 포함합니다. `JSON.stringify(node.id)`는 안전하지만 불필요한 래핑입니다. 보안 영향은 없으나 코드 명확성을 위해 UUID 포맷을 별도로 단언하면 좋습니다.
- **제안**: UUID 형식 런타임 검증이 필요하다면 별도 assert 추가, 그렇지 않으면 단순히 문자열 보간으로 처리합니다.

---

### [WARNING] Prompt Injection 표면 — 완화됨, 잔존 가능성 확인 필요
- **위치**: `shadow-workflow.ts` — `labelLookalikeHint` 반환 문자열 전체
- **상세**: 힌트 문자열은 LLM tool result로 전송됩니다. `sanitizeLlmProvidedString + JSON.stringify` 이중 보호로 newline 기반 마크다운 헤더 인젝션(`## HACK`)과 XML fence 탈출(`</user-request>`)은 차단됩니다. 그러나 sanitizer 이후에도 힌트 내부에 완성된 자연어 문장(`"... ignore all previous instructions ..."`)이 남을 수 있습니다. LLM tool result 경유 prompt injection은 system prompt 우선 순위 덕에 실질 위험이 낮지만, 이 힌트가 chain-of-thought 경로에 영향을 미칠 수 있습니다.
- **현재 방어 수준**: JSON.stringify(sanitize(label)) 패턴은 충분한 수준이며, 테스트 커버리지(`sanitizes label in the hint`)가 이를 고정합니다.
- **제안**: 추가 방어로 힌트 문자열에 고정 prefix/suffix 마커를 두어 LLM이 힌트 범위를 명확히 구분할 수 있도록 합니다. 예: `[hint] Value ... [/hint]` 형식.

---

## 요약

이번 변경은 LLM이 노드 label을 UUID 자리에 잘못 넣는 패턴을 감지해 힌트를 반환하는 기능입니다. 핵심 보안 메커니즘(`sanitizeLlmProvidedString` + `JSON.stringify` 이중 처리, 길이 상한 `LABEL_HINT_MAX_LEN`, 개행/꺾쇠 중화)은 적절히 구현되어 있으며, 테스트가 prompt injection 시나리오(`## HACK`, `<script>alert(1)</script>`)를 직접 커버합니다. 주요 잔여 취약점은 C1 제어 문자 및 Unicode Bidi 제어 문자 미처리이나, 해당 힌트가 사용자 렌더링 컨텍스트가 아닌 LLM tool result 채널로만 전달되는 점에서 실제 공격 가능성은 낮습니다. 하드코딩 시크릿, SQL/Command 인젝션, 인증 우회 등 OWASP Top 10의 치명적 항목은 발견되지 않았습니다.

## 위험도

**LOW**