# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `system-context-prefix.ts` 공개 API — 독스트링 품질 우수
  - 위치: `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts` 전체
  - 상세: 모듈 레벨 JSDoc 블록, `resolveSystemContextTimezone`, `buildSystemContextPrefix`, `buildSystemContextPrefixFromContext`, `normalizeSystemContextConfig`, `formatIsoWithTimezone`, `formatUtcOffsetLabel` 등 공개 함수 모두 JSDoc 주석이 달려 있다. spec 섹션 참조(`§11.x`)도 포함되어 추적성이 좋다.
  - 제안: 한 군데 — 모듈 헤더 10번째 줄 `*전달하는`에 공백이 누락되어 있다(`* 전달하는`으로 수정). 경미한 오탈자이지만 공식 문서 문자열인 만큼 정정을 권장한다.

- **[INFO]** 내부 전용 함수 `renderSection`, `getPartsInTimezone`, `computeOffsetMinutes`, `formatOffsetIsoSuffix`, `isValidIanaTimezone` — 독스트링 없음
  - 위치: `system-context-prefix.ts` L62, L96, L155, L194, L216
  - 상세: 이들은 파일 내부 private 헬퍼(`export` 없음)이므로 독스트링 미필수 기준에는 부합한다. 다만 `computeOffsetMinutes`는 `longOffset` 파싱 로직이 비자명하므로 한 줄 인라인 주석 이상이 있으면 유지보수성이 향상될 것이다.
  - 제안: `computeOffsetMinutes` 함수 상단에 `// Parses "GMT+09:00" / "GMT-05:30" / "GMT" from Intl longOffset part` 수준의 한 줄 주석 추가를 권장한다.

- **[WARNING]** `ai-agent.handler.ts` 내 두 곳의 `buildSystemContextPrefixFromContext` 호출 주석 — multi-turn 동결 의미 설명의 미묘한 부정확성
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` diff 1244번 줄 (multi-turn 경로)
  - 상세: 주석은 `state.systemPrompt 로 저장돼 후속 turn 에서도 같은 prefix 를 본다 (turn 마다 재계산 불필요 — $now 가 execution-frozen)` 라고 서술하지만, diff 상 `ai-agent.handler.ts` 코드에서 `state.systemPrompt` 저장 로직은 이 diff 에 포함되어 있지 않다. 저장 로직이 이미 기존 코드에 있다면 주석은 정확하지만, 독자가 diff 만 보고 저장 경로를 확인할 수 없는 상태다.
  - 제안: 저장 로직이 기존 코드에 이미 존재한다면 주석에 `(기존 코드 — state.systemPrompt 저장 경로 유지)` 같이 명시하거나, 관련 코드 줄 번호를 인라인으로 참조해 독자가 추적할 수 있도록 한다.

- **[INFO]** `information-extractor.handler.ts` multi-turn 경로 주석
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` diff 613번 줄
  - 상세: `state.messages[0] 에 frozen 되어` 라고 서술하지만 multi-turn info-extractor 가 `state.messages[0]` 에 systemPrompt 를 저장하는 구체적 메커니즘이 이 diff 밖에 있어 주석이 단독으로 서술하기 어렵다. 현재로서는 의도 파악에 충분하나, ai-agent 주석과 동일한 추적성 문제가 있다.
  - 제안: 경미 수준이므로 수정 의무는 없으나, 기존 저장 경로를 주석에 `(hhh 줄 참조)` 형태로 인라인 링크하면 유지보수성이 오른다.

- **[INFO]** 스키마 필드 주석 — 세 AI 노드 스키마 파일(`ai-agent.schema.ts`, `text-classifier.schema.ts`, `information-extractor.schema.ts`) 의 `includeSystemContext` / `systemContextSections` 블록 상단 주석은 각각 SoT 링크(`spec/4-nodes/3-ai/0-common.md §11`)와 기능 요약을 포함해 일관성이 좋다. 다만 세 파일 중 `ai-agent.schema.ts` 만 상단 주석에 `Cafe24 MCP 도구 description 의 KST suffix 와 두 채널로 LLM 시각 추론 회귀를 차단` 설명이 포함되어 있고, `text-classifier.schema.ts`·`information-extractor.schema.ts` 는 간략한 spec 참조만 있다.
  - 위치: `ai-agent.schema.ts` L338, `text-classifier.schema.ts` L824, `information-extractor.schema.ts` L646
  - 제안: 세 파일의 주석 수준을 통일하거나, 다른 두 파일에서 Cafe24 연관 설명은 불필요하다면 `ai-agent.schema.ts` 주석의 Cafe24 언급을 공통 모듈(`system-context-prefix.ts`) 주석으로 이동하는 것을 고려한다.

- **[INFO]** `cafe24-mcp-tool-provider.ts` diff — `CAFE24_TIMEZONE_SUFFIX` 상수 임포트 추가 및 도구 description 에 append, 코드 변경 자체에 주석 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` L214-L493
  - 상세: 변경 자체는 단 한 줄(`\n\n${CAFE24_TIMEZONE_SUFFIX}` 추가)이며, 상수명이 의도를 충분히 표현한다. 별도 인라인 주석이 없어도 가독성에 문제 없다.
  - 제안: 필요 시 `// spec/conventions/cafe24-api-metadata.md §5.3` 한 줄 주석을 상수 정의 행 옆에 두면 추적성이 향상되지만, 현재 수준도 허용 범위다.

- **[INFO]** `CAFE24_TIMEZONE_SUFFIX` 상수 위치와 문서화
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/index.ts` L902-L903
  - 상세: 상수가 `index.ts` 에 `export const` 로 선언되어 있으나 JSDoc 없이 값만 있다. 값 자체가 self-explanatory 하지만 이 상수가 §5.3 SoT 라는 사실을 코드 독자가 즉시 알기 어렵다.
  - 제안: `/** spec/conventions/cafe24-api-metadata.md §5.3 — 모든 Cafe24 도구 description 끝에 append 하는 KST 단일 정책 문자열. */` 한 줄 JSDoc 추가를 권장한다.

- **[WARNING]** README 업데이트 필요성 — `__workspaceTimezone` 컨텍스트 변수 및 System Context Prefix 기능
  - 위치: 프로젝트 루트 `README.md` (현재 diff 에 포함되지 않음)
  - 상세: 이번 변경으로 `ExecutionContext.variables` 에 `__workspaceTimezone` 라는 새 엔진 내부 변수가 추가되었고, AI 노드 3종에 `includeSystemContext` / `systemContextSections` 신규 설정 옵션이 추가되었다. README 에 AI 노드 설정 옵션이나 실행 컨텍스트 변수 목록이 언급되어 있다면 업데이트가 필요하다. 단, 이 프로젝트는 spec 기반 SDD 이고 README 의 구체적 내용은 확인되지 않았으므로 조건부 WARNING이다.
  - 제안: README 의 AI 노드 관련 설정 섹션이 있다면 `includeSystemContext` 옵션과 `__workspaceTimezone` 컨텍스트 변수를 추가 문서화한다.

- **[INFO]** spec 문서 변경 반영 — `spec/4-nodes/3-ai/0-common.md`, `spec/conventions/cafe24-api-metadata.md` 가 이번 변경 대상에 git status 상 포함(`M spec/4-nodes/3-ai/0-common.md` 등)
  - 위치: `spec/4-nodes/3-ai/0-common.md §11`, `spec/conventions/cafe24-api-metadata.md §5.2, §5.3`
  - 상세: 코드 변경 주석들이 이 spec 섹션을 SoT 로 일관되게 참조한다. spec 문서 자체도 이번 PR 의 일부로 수정되어 있어 코드-spec 정합성이 유지되고 있는 것으로 보인다.
  - 제안: 문서 리뷰 범위상 diff 가 누락된 파일(파일 13·14 는 `diff omitted due to prompt size limit`)이 있으므로, spec 문서에 §11 섹션이 코드와 정합하는지 최종 확인을 권장한다.

- **[INFO]** 테스트 인라인 주석 — 적절함
  - 위치: `ai-agent.thread.spec.ts`, `cafe24-mcp-tool-provider.spec.ts`, `metadata.spec.ts`
  - 상세: `includeSystemContext: false` 플래그를 추가하는 곳마다 `// §11 prefix 와 무관한 테스트` 또는 더 긴 설명 주석이 달려 있어 기존 테스트의 의도가 변경되지 않았음을 명시한다. `cafe24-mcp-tool-provider.spec.ts` 의 새 테스트 블록도 의도와 회귀 방어선의 역할을 상세히 설명하는 주석을 포함한다.
  - 제안: 현재 수준 유지.

- **[INFO]** i18n 레이블 파일 (`backend-labels.ts`) — 신규 UI 레이블 문서화
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts`
  - 상세: `LABEL_KO`, `HINT_KO`, `GROUP_KO`, `OPTION_LABEL_KO` 네 딕셔너리 모두 새 System Context 관련 항목이 추가되어 있다. 영문 hint 와 한국어 번역이 쌍으로 존재하며 내용도 일치한다.
  - 제안: 해당 없음.

- **[INFO]** `package-lock.json` 변경 (backend·frontend) — 문서화 관점 무관
  - 위치: `codebase/backend/package-lock.json`, `codebase/frontend/package-lock.json`
  - 상세: 의존성 락 파일 변경 (optional/peer 패키지 중복 항목 제거, `dev` 플래그 조정)으로 문서화 필요 항목 없음.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 AI 노드 3종(AI Agent, Text Classifier, Information Extractor)에 System Context Prefix 기능을 추가하고, Cafe24 MCP 도구 description 에 KST 타임존 접미사를 붙이는 작업이다. 문서화 측면에서는 전반적으로 양호하다. 신규 핵심 모듈(`system-context-prefix.ts`)에 모듈 레벨 JSDoc 과 공개 함수 전체에 주석이 작성되어 있고, 코드 변경 주석들이 spec SoT 섹션(`§11`, `§5.2`, `§5.3`)을 일관되게 참조한다. 테스트 파일에도 기존 테스트 의도를 보호하는 인라인 주석이 적절히 삽입되어 있다. 개선 여지는 소수이며, 모듈 헤더의 공백 오탈자 수정, `CAFE24_TIMEZONE_SUFFIX` 상수의 JSDoc 1행 추가, `computeOffsetMinutes` 인라인 주석 추가가 권장 수준이다. multi-turn 경로의 `state.systemPrompt` 동결 설명 주석은 기존 저장 로직에 대한 참조가 없어 독자 추적성이 다소 낮으며, 이 점이 주의를 요하는 유일한 WARNING이다. README 업데이트 필요성도 조건부 WARNING으로 확인이 권장된다.

## 위험도

LOW
