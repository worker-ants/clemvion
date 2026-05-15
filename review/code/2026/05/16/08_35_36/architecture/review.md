# 아키텍처(Architecture) 리뷰

리뷰 대상: `user-guide-sync-4af69c` worktree 변경 (2026-05-16)
파일 수: 11개 (MDX 문서 8개, plan 1개, consistency SUMMARY 2개)

---

### 발견사항

- **[INFO]** 문서 레이어 책임 분리 — 적절히 준수됨
  - 위치: 파일 1~8 (모든 MDX 변경)
  - 상세: 사용자 가이드(MDX)는 표현 레이어, spec은 비즈니스/기술 명세 레이어, plan은 작업 추적 레이어로 명확히 분리되어 있다. 이번 변경은 표현 레이어(MDX)만 수정하고, spec 본문 수정은 project-planner에 위임하는 방식으로 레이어 경계를 지킨다.
  - 제안: 현재 구조 유지.

- **[INFO]** Single Source of Truth 원칙 준수
  - 위치: `ai.mdx` frontmatter `spec` 배열, `integrations.mdx` frontmatter `spec`/`code` 배열
  - 상세: MDX 문서의 frontmatter `spec` 필드에 `spec/conventions/conversation-thread.md`, `spec/4-nodes/4-integration/4-cafe24.md`를 추가해 단일 진실 참조 체계를 갱신했다. 구현 소스(`code` 필드)도 `cafe24.schema.ts`를 추가로 명시해 추적성을 유지한다.
  - 제안: 현재 구조 유지.

- **[INFO]** 추상화 수준 — contextScope/contextInjectionMode 설계가 적절
  - 위치: `ai.mdx` + `ai.en.mdx` Conversation Context 섹션
  - 상세: `contextScope`(범위) / `contextInjectionMode`(주입 방식) / `includeToolTurns`(opt-in) / `excludeFromConversationThread`(opt-out) 4개 필드가 각각 단일 관심사를 담당한다. 각 boolean·enum 필드가 독립 관심사를 제어하는 구조로, 인터페이스 분리 원칙(ISP)에 부합한다.
  - 제안: 현재 구조 유지.

- **[INFO]** `$thread` 변수를 독립 1급 컨텍스트로 노출 — 좋은 추상화
  - 위치: `variables-and-context.mdx` + `.en.mdx` `$thread` 섹션
  - 상세: AI Agent 노드의 `contextScope` 자동 주입과 `$thread` 직접 참조를 분리한 것은 레이어 독립성을 잘 반영한다. 표현식 레이어에서 AI 노드에 의존하지 않고도 thread를 참조할 수 있도록 설계된 구조가 문서에서도 그대로 전달된다. Callout에서 두 방식의 사용 지침을 명확히 구분한 점도 모듈 경계를 사용자에게 바르게 안내한다.
  - 제안: 현재 구조 유지.

- **[INFO]** Cafe24 통합 — 노드·MCP Bridge 공유 경로가 문서에 명시됨
  - 위치: `integrations.mdx` + `.en.mdx` Cafe24 섹션
  - 상세: "같은 Cafe24 통합 하나를 등록하면 본 노드와 AI Agent의 MCP 도구 양쪽에서 재사용된다(토큰·요청 한도·로그가 일원화된다)"는 설명이 아키텍처 결정(단일 호출 경로 공유)을 사용자에게 정확히 전달한다. `spec/conventions/cafe24-api-metadata.md` §5의 레이어 경계 설명과 일관성이 있다.
  - 제안: 현재 구조 유지.

- **[WARNING]** `overview.mdx`/`overview.en.mdx` 의 Integration 카테고리 설명이 열거 방식 — 확장성 취약
  - 위치: `overview.mdx` line ~336, `overview.en.mdx` line ~312
  - 상세: Integration 카테고리 한 줄 설명을 "HTTP, 데이터베이스, 이메일, Cafe24 같은 외부 서비스 연동이에요"처럼 서비스명을 직접 나열하는 방식을 채택했다. 신규 통합 서비스(예: Slack, Salesforce 등)가 추가될 때마다 이 줄을 재수정해야 하는 tight coupling이 발생한다. 이번 Cafe24 추가가 그 패턴을 그대로 따른 것이며, 향후 반복될 가능성이 높다.
  - 제안: 카테고리 설명을 "외부 서비스와 연동하는 노드 모음 (HTTP · 데이터베이스 · 이메일 · Cafe24 등)"처럼 "등"으로 열거를 개방형으로 유지하거나, 아예 "외부 서비스와의 연동을 처리하는 노드 모음이에요."처럼 추상적 문장으로 고정하고 구체 목록은 `integrations.mdx` 에 위임하는 것을 검토한다. 이는 spec 변경 사항이므로 project-planner 위임 필요.

- **[INFO]** plan 문서의 레이어별 권한 분리 선언이 명시적
  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md` "의도적 제외", "후속(spec 갱신 위임)" 섹션
  - 상세: developer 권한 밖의 spec 수정 항목을 plan 내 "후속(spec 갱신 위임)" 섹션으로 분리하고 project-planner에 명시적으로 위임한다. CLAUDE.md의 역할 분리 원칙(developer는 spec read-only)을 plan 수준에서 구조화한 좋은 관행이다.
  - 제안: 현재 구조 유지.

- **[INFO]** consistency-check 결과가 SUMMARY에 통합 — 프로세스 계층 준수
  - 위치: `review/consistency/2026/05/16/08_22_34/SUMMARY.md`
  - 상세: 구현 착수 전 --impl-prep 모드 일관성 검토를 수행하고, Critical 없음 확인 후 착수한 워크플로우가 plan 체크리스트에 기록되어 있다. 이는 CLAUDE.md에서 정의한 "developer는 구현 착수 직전에 consistency-checker --impl-prep 를 의무 호출" 프로세스를 준수한다.
  - 제안: 현재 구조 유지.

---

### 요약

이번 변경은 사용자 가이드(MDX) 표현 레이어만을 대상으로 하며, SOLID 원칙·레이어 책임 분리·모듈 경계 측면에서 전반적으로 양호하다. `contextScope`/`contextInjectionMode` 필드 분리, `$thread` 독립 변수 노출, Cafe24 통합의 단일 호출 경로 공유 설명 등이 아키텍처 결정을 사용자에게 적절한 추상화 수준으로 전달한다. spec 본문 수정은 developer 권한 밖으로 명시적으로 위임하는 구조가 역할 경계를 잘 유지한다. 단, `overview.mdx`의 Integration 카테고리 설명이 서비스명을 직접 열거하는 방식은 신규 통합이 추가될수록 반복 수정이 필요한 확장성 취약점이다. 이 항목만 spec 레벨에서 개선 여지가 있으며, 나머지 구조적 이슈는 없다.

---

### 위험도

LOW
