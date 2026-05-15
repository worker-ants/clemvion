# 문서화(Documentation) 리뷰

리뷰 대상: user-guide-sync-4af69c 워크트리 변경 (총 11개 파일)
리뷰 일시: 2026-05-16

---

### 발견사항

- **[INFO]** `$thread.turns` 배열 요소의 타입 구조가 미완전 문서화
  - 위치: `frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx` (추가된 FieldTable, turns 행)
  - 상세: `turns` 속성의 설명에서 각 turn 이 갖는 `source`, `role`, `nodeId`, `data` 필드를 나열했지만, `source` 의 가능한 값(예: `presentation_user`, `ai_agent` 등)과 `role` 의 가능 값(`user` / `assistant`)을 예시 외에 명시적으로 열거하지 않았다. 예제 코드에서 `data.email` 접근 패턴은 보여주지만, `data` 가 어떤 형태인지(특히 presentation Form turn 외 케이스)는 설명이 없다.
  - 제안: `source` 열거 값 및 `role` 가능 값을 인라인 설명이나 별도 소형 테이블로 추가하거나, `spec/conventions/conversation-thread.md` 로 딥링크를 제공해 독자가 스키마 전체를 확인할 수 있도록 안내하면 충분하다.

- **[INFO]** 한국어 문서와 영문 문서 간 `source` 예시 표현 불일치 가능성
  - 위치: `variables-and-context.mdx` L459 (`source is presentation_user` 예제 주석) vs `variables-and-context.en.mdx` L392 동일 예제 주석
  - 상세: 두 파일 모두 `{{ $thread.turns[0].data.email }}` 예제 타이틀을 "Pick a field from the first form turn (when source is presentation_user)" (영문) / "첫 turn 의 form 데이터 필드 참조 (Presentation Form turn 일 때)" (한국어)로 각각 표현하고 있다. 한국어 버전은 `presentation_user` 라는 실제 source 값을 노출하지 않아서, 독자가 source 값을 특정 값으로 필터링하는 표현식을 작성할 때 참고가 어렵다.
  - 제안: 한국어 예제 타이틀 또는 부연 설명에 `source === 'presentation_user'` 와 같은 실제 값을 병기한다.

- **[INFO]** `contextInjectionMode: system_text` 사용 시 실제 렌더 포맷 비문서화
  - 위치: `frontend/src/content/docs/02-nodes/ai.en.mdx` 및 `ai.mdx` (Conversation Context 섹션 신설 부분)
  - 상세: `system_text` 모드로 주입할 때 "renders the thread as a single text block appended to the system prompt"라고만 설명한다. 독자가 이 텍스트 블록의 구체적인 포맷(헤더·구분자·role 표기 방식 등)이 궁금할 경우 확인할 경로가 없다. `variables-and-context` 의 `$thread.text` 설명에 "system_text format"이라는 표현이 있으므로 두 문서가 같은 포맷을 공유함은 알 수 있지만, 실제 렌더 결과 예시가 없다.
  - 제안: 짧은 예시 출력(예: `[User]: ...\n[Assistant]: ...` 형식) 또는 `spec/conventions/conversation-thread.md` 로의 딥링크를 추가해 구체적 포맷을 참조할 수 있게 한다.

- **[INFO]** `excludeFromConversationThread` 기본값 표기 불일치 가능성
  - 위치: `ai.mdx` 및 `ai.en.mdx` FieldTable, `excludeFromConversationThread` 행
  - 상세: FieldTable에서 `default: "false"`로 기재되어 있다. 불리언 필드의 기본값을 문자열 `"false"`로 표현하는 것이 다른 불리언 필드(`includeToolTurns`) 와 동일하게 일관성은 있으나, 표현식 컨텍스트에서 타입을 혼동할 여지가 있다. 프로젝트 내 다른 FieldTable 관례와 동일하다면 문제 없다.
  - 제안: 현행 유지해도 무방하나, 만약 다른 불리언 필드가 `false`(비문자열)로 표기된다면 통일한다.

- **[INFO]** `integrations.mdx` 한국어 도입부 문장이 새 Cafe24 노드를 미반영
  - 위치: `frontend/src/content/docs/02-nodes/integrations.mdx` diff 중 비수정 부분(L233)
  - 상세: 파일 본문 첫 단락이 "외부 서비스와 연동하는 통합 노드 세 종류를 설명해요."로 시작한다. Cafe24가 추가되었으므로 실제로는 네 종류가 됐지만 이 문장은 갱신되지 않았다.
  - 위치 보충: `integrations.mdx` 도입부 단락 — `이 페이지에서는 외부 서비스와 연동하는 통합 노드 세 종류를 설명해요.`
  - 제안: "세 종류" → "네 종류" (혹은 "여러 종류")로 수정하거나, 영문 파일에 대응하는 문장도 동일 여부를 확인해 일관되게 유지한다.

- **[WARNING]** `integrations.en.mdx` 도입부도 동일 문제 여부 확인 필요
  - 위치: `frontend/src/content/docs/02-nodes/integrations.en.mdx` (diff에 해당 부분 미포함)
  - 상세: 한국어 파일과 달리 영문 파일의 도입 단락이 diff에 나타나지 않으므로, 영문 도입 단락에도 "three kinds" 또는 그에 상응하는 표현이 남아있을 수 있다. 실제 파일을 확인해 같은 문제가 있다면 함께 수정해야 한다.
  - 제안: `integrations.en.mdx` 도입부를 확인하고 필요시 "four" 또는 "several" 로 갱신한다.

- **[INFO]** Cafe24 섹션에 페이지네이션 커서 방식에 대한 설명 부재
  - 위치: `integrations.mdx` 및 `integrations.en.mdx` Cafe24 FieldTable, `pagination` 행
  - 상세: `pagination` 필드 설명에 `{ limit?, offset?, cursor? }` 형태를 언급했지만, 실제로 `cursor` 방식 페이지네이션을 지원하는 operation이 어느 것인지, `cursor` 값은 어떻게 얻는지(직전 응답의 어떤 필드에서 추출하는지)에 대한 안내가 없다.
  - 제안: 이 단계에서 상세 설명이 과도하다면 최소한 "커서 방식은 일부 operation에서만 지원되며, 응답의 `next_cursor` 필드 값을 다음 요청에 전달합니다." 등 단 한 문장의 힌트를 추가하거나, 별도 딥링크를 제공한다.

- **[INFO]** Plan 문서 체크리스트 항목 중 "테스트" 설명이 구현 세부사항을 문서 내에서 설명하지 않음
  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md` 체크리스트 섹션
  - 상세: 체크리스트의 테스트 항목에 "`registry.ts` 단위 테스트에서 모든 .mdx frontmatter 의 `spec`/`code` 경로 실존을 검증함"이라고 기재되어 있다. 이 테스트 접근 방법은 훌륭하나, 어느 테스트 파일에 이 검증이 들어있는지 명시되지 않아 이후 개발자가 추적하기 어렵다.
  - 제안: 테스트 파일 경로(예: `frontend/src/lib/docs/__tests__/registry.spec.ts`)를 괄호 안에 병기한다.

---

### 요약

이번 변경은 사용자 가이드(MDX)를 실제 구현과 동기화하는 문서화 작업으로, 전반적으로 높은 품질을 갖추고 있다. 한국어·영문 양방향으로 신규 섹션과 필드가 동시에 추가되었고, 상호 참조 링크(`contextScope` ↔ `$thread` 문서)도 적절히 배치되어 있다. 발견된 이슈는 모두 INFO 또는 WARNING 등급으로, 기능 사용에 치명적인 오류는 없다. 가장 즉각적으로 수정할 만한 항목은 한국어 `integrations.mdx` 도입부의 "세 종류" 표현(노드 수 불일치)과, 영문 파일 동일 지점에 같은 문제가 있는지 확인하는 작업이다. `$thread.turns` 각 요소의 `source` 열거 값 등은 독자 경험을 높이는 선택적 개선 사항이다.

### 위험도

LOW
