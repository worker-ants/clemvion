# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1 & 2: ai.en.mdx / ai.mdx — Conversation Context 필드 표 및 섹션

- **[INFO]** `contextScopeN` 기본값 정보 미표기 (영문판)
  - 위치: `ai.en.mdx` FieldTable, `contextScopeN` 행
  - 상세: 한국어판(`ai.mdx`)은 `contextScopeN` 행의 description에 "기본 20"을 명시하지 않으나, 영문판과 spec(`conversation-thread.md` §5) 모두 기본값 칸에 `"20"`이 들어 있어 일관성은 유지된다. 다만 description 텍스트에서 "default 20"을 서술하는 영문판과 달리 한국어판 description은 기본값 언급이 없어 독자가 기본값 칸을 별도로 확인해야 한다. 가이드 일관성 관점의 개선 권고.
  - 제안: `ai.mdx` `contextScopeN` description에 "(기본 20)" 언급 추가.

- **[INFO]** `contextScope: thread` 토큰 비용 경고 — 정량 기준 부재
  - 위치: `ai.en.mdx` / `ai.mdx` Conversation Context 섹션
  - 상세: "Token usage can grow quickly in long conversations" / "토큰 사용량이 빠르게 늘 수 있어요"라고 경고하지만, cap 상수(`MAX_INJECTED_TURNS=100`, `MAX_INJECTED_CHARS=200_000`, `MAX_TURN_TEXT_CHARS=4000`) 관련 안내가 전혀 없다. 사용자는 thread 길이가 늘어날 때 내부에서 자동 drop이 일어나는 사실을 알지 못한다.
  - 제안: Callout 추가 또는 문장에서 "A cap of 100 injected turns applies automatically." 수준의 한 줄 안내 삽입.

- **[WARNING]** `messages` 모드에서 `source='system'` turn의 Anthropic API 비호환 미경고
  - 위치: `ai.en.mdx` / `ai.mdx` Conversation Context 섹션, `contextInjectionMode: messages` 설명
  - 상세: spec(`conversation-thread.md` §5.1)은 "messages 배열 내 `role: 'system'` 은 Anthropic API 비호환 — provider가 anthropic이면 `system_text` 모드 또는 별도 분기로 우회 필수"라고 명시한다. 그러나 사용자 가이드는 `messages` 모드가 "Plays well with tool calls and feels natural on chat models like OpenAI / Anthropic"이라고만 서술하여 Anthropic 비호환 케이스를 누락했다. v1에서는 `system` source turn이 자동 push되지 않으므로 실질 문제는 없다고 spec이 설명하지만, 향후 수동 push 도입 시 오해를 유발할 수 있다. 적어도 Callout 수준의 주의 사항이 필요하다.
  - 제안: `contextInjectionMode: messages` 설명 아래에 "Note: If you manually push `system`-sourced turns and use the Anthropic provider, switch to `system_text` mode." 같은 Callout 추가.

- **[INFO]** `excludeFromConversationThread` UI 그룹 위치 미기재
  - 위치: `ai.en.mdx` / `ai.mdx` FieldTable, `excludeFromConversationThread` 행
  - 상세: spec(`conversation-thread.md` §2.4)은 UI 그룹을 "Advanced > Conversation"으로 명시하나, 사용자 가이드 FieldTable에는 해당 UI 경로 안내가 없다. 동일 파일의 `Tool nodes (Tool Area)` 처럼 UI 경로를 description에 명시하면 사용자가 설정을 찾기 쉬워진다.
  - 제안: description에 "Found under Advanced > Conversation settings." 한 줄 추가.

---

### 파일 3 & 4: integrations.en.mdx / integrations.mdx — Cafe24 섹션

- **[INFO]** `pagination` 필드의 기본값 표기 불일치
  - 위치: `integrations.en.mdx` / `integrations.mdx` FieldTable, `pagination` 행
  - 상세: `pagination` 행의 default가 `"-"`로 표기되어 있으나, `fields` 행은 `"{}"` 로 명시된다. 페이지네이션을 지원하지 않는 operation에서 이 필드를 생략할 경우 실제 기본값이 `undefined`인지 `null`인지 `{}`인지 불분명하다. 스키마 파일(`cafe24.schema.ts`)을 참조 소스로 명시했으므로 해당 소스와 일치해야 한다.
  - 제안: 실제 스키마의 기본값 확인 후 `"-"` 또는 `"undefined"` 중 정확한 값으로 통일.

- **[INFO]** 예시 코드의 `start_date` 날짜 범위 — "yesterday" 의미와 실제 표현식 불일치
  - 위치: `integrations.en.mdx` / `integrations.mdx` Example 섹션
  - 상세: 예시 제목은 "어제 미발송 주문 가져오기" / "Fetch yesterday's unshipped orders"이나, `start_date` 필드에 `formatDate($now, "YYYY-MM-DD")`만 있고 `end_date` 가 없으며, `$now`는 오늘 날짜를 반환한다. "어제" 범위를 나타내려면 `formatDate(addDays($now, -1), "YYYY-MM-DD")`와 `end_date`가 함께 필요하다. 의도와 구현 간 괴리.
  - 제안: 예시 제목을 "Recent unshipped orders"로 수정하거나, `start_date`를 `addDays($now, -1)` 등 어제를 지칭하는 표현식으로 수정.

- **[INFO]** `error` 포트 — 재시도 정책 언급 없음
  - 위치: `integrations.en.mdx` / `integrations.mdx` Ports 섹션
  - 상세: `error` 포트 설명에서 "leaky-bucket rate limit exceeded"를 언급하나, 재시도 로직이나 backoff 정책에 대한 안내가 없다. 다른 Integration 노드(HTTP Request 등)도 동일하게 생략되어 있으면 일관성은 있으나, Cafe24의 leaky-bucket 특성을 강조했다면 짧은 재시도 안내가 도움이 된다.
  - 제안: Callout에 "Cafe24 rate-limit errors are transient; connect the error port to a Wait + retry loop." 한 줄 권고.

---

### 파일 5 & 6: overview.en.mdx / overview.mdx

- **[INFO]** Integration 카테고리 설명 — Cafe24 추가 후 열거 방식의 확장성 우려
  - 위치: `overview.en.mdx` / `overview.mdx` FieldTable, Integration 행
  - 상세: 변경 후 "HTTP, databases, email, and Cafe24"처럼 특정 서비스 이름이 나열된다. 향후 Integration 노드가 추가될 때마다 이 한 줄을 수정해야 한다. 기능성 문제는 아니나 유지보수 부담 증가.
  - 제안: "HTTP, databases, email, and third-party services like Cafe24" 처럼 일반화하거나, 특정 이름 나열 방식을 그대로 유지할 것임을 팀 내에서 합의.

---

### 파일 7 & 8: variables-and-context.en.mdx / variables-and-context.mdx — `$thread`

- **[WARNING]** `$thread.text` 메모이제이션 설명과 spec 내용 불일치
  - 위치: `variables-and-context.en.mdx` FieldTable, `text` 행 / `variables-and-context.mdx` FieldTable
  - 상세: 영문 가이드는 "`$thread.text` ... Memoized after the first access."라고 기술하나, spec(`conversation-thread.md` §7 v2 로드맵)은 "현재 `buildExpressionContext`가 호출마다 전체 thread를 system_text로 즉시 렌더 (성능 hot path)"라고 명시해 v1에서는 메모이제이션이 구현되어 있지 않음을 시사한다. 동일 섹션의 Callout도 "calling it repeatedly inside a loop can get expensive"라며 성능 비용을 경고하는데, 메모이제이션이 실제로 적용된다면 루프 내 반복 호출이 비싸지 않아야 한다. 설명이 상충한다.
  - 제안: v1 실제 구현 여부 확인 후, (1) 메모이제이션이 구현되지 않았다면 "Memoized after the first access" 문구를 제거하고 Callout 경고만 유지, (2) 구현됐다면 Callout 경고를 "evaluated once per expression context; avoid in hot loops"로 완화.

- **[INFO]** `$thread` 읽기 전용(readonly) 특성 — 표현식에서 쓰기 시도 시 동작 미기술
  - 위치: `variables-and-context.en.mdx` / `variables-and-context.mdx` $thread 섹션
  - 상세: "A readonly snapshot"이라고만 설명하며, 표현식에서 `$thread.turns.push(...)` 같은 변이 시도를 하면 어떤 에러가 발생하는지(혹은 silently ignored) 기술이 없다. 엣지 케이스 처리 부재.
  - 제안: "Mutation attempts are ignored / throw TypeError at runtime." 수준의 단문 추가.

- **[INFO]** `$thread.turns[0].data.email` 예시 — `turns`가 비어있을 때 예외 처리 미안내
  - 위치: `variables-and-context.en.mdx` / `variables-and-context.mdx` Example "Pick a field from the first form turn"
  - 상세: `$thread.turns[0]`는 turns 배열이 비어있으면 `undefined`를 반환하고, `.data.email`은 TypeError를 유발할 수 있다. 가이드가 이 패턴을 그대로 권장하면 초보 사용자가 런타임 오류를 만날 수 있다.
  - 제안: 예시 아래에 "Use a Condition node to guard against an empty thread before accessing turns." 또는 `$thread.length > 0 ? $thread.turns[0].data.email : ''` 형태의 방어적 표현식 예시 추가.

---

### 파일 9: plan/in-progress/user-guide-sync-2026-05-16.md

- **[INFO]** 체크리스트 항목 완료 표기와 실제 작업 범위 일치 여부
  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md` 체크리스트 섹션
  - 상세: `[x] 테스트 — registry.ts 단위 테스트에서 모든 .mdx frontmatter 의 spec/code 경로 실존을 검증함` 항목이 완료로 표시되어 있다. `integrations.mdx`의 `code` 필드에 `backend/src/nodes/integration/cafe24/cafe24.schema.ts`가 새로 추가되었으므로 해당 파일 실존 여부가 테스트에서 실제로 통과했는지 본 리뷰 범위에서는 확인 불가. 단위 테스트 통과 기록이 plan에 첨부되어 있지 않아 추적이 어렵다.
  - 제안: 테스트 실행 결과(예: CI 링크 또는 `npm test` 출력 일부)를 plan 또는 RESOLUTION.md에 첨부.

---

### 파일 10: review/consistency/2026/05/16/08_22_34/SUMMARY.md

- **[INFO]** 기능 완전성 범위 밖 항목이나 후속 위임 명세의 완결성
  - 위치: SUMMARY.md "후속(spec 갱신 위임)" 섹션
  - 상세: W1~W4·I3·I7~I10을 `project-planner` 위임 대상으로 나열했으나, 위임 티켓(plan 문서 생성 또는 이슈)이 실제로 생성되었는지 확인할 수 없다. 후속 조치가 plan/in-progress에 반영되지 않으면 추적이 누락될 위험이 있다.
  - 제안: `plan/in-progress/`에 spec 갱신 위임용 신규 plan 항목 또는 별도 plan 파일을 생성하여 추적 가능하게 할 것.

---

## 요약

전반적으로 이번 변경은 `conversationHistory`/`historyCount`에서 `contextScope` 계열 5개 필드로의 스키마 교체, Cafe24 노드 섹션 신설, `$thread` 변수 문서화를 완성도 높게 수행했다. spec(`conversation-thread.md`, `cafe24-api-metadata.md`)과의 필드명·기본값 일치는 양호하다. 다만 `$thread.text` 메모이제이션 기술이 spec v2 로드맵과 충돌하는 WARNING, `messages` 모드의 Anthropic provider `system` role 비호환 미경고 WARNING 두 건은 사용자 오해를 유발할 수 있어 수정이 권장된다. 예시 코드의 "어제 주문" 날짜 표현식 불일치와 `$thread.turns[0]` 빈 배열 예외 처리 미안내는 초보 사용자 경험에 영향을 줄 수 있는 INFO 항목이다. 기능 완전성 측면에서 4가지 보강 범위는 모두 구현되었으나, 위의 세부 항목들을 반영하면 문서 품질이 더욱 향상된다.

## 위험도

LOW
