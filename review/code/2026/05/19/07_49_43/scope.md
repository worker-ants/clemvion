# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `package-lock.json` 두 파일 (`codebase/backend/`, `codebase/frontend/`) 에서 `"dev": true` 플래그 제거 및 peer dependency 항목 삭제
  - 위치: `codebase/backend/package-lock.json` (L35–102), `codebase/frontend/package-lock.json` (L1039)
  - 상세: `chokidar`, `glob-parent`, `readdirp` 의 nested peer-optional 항목 삭제, `uglify-js` 및 `fsevents` 의 `"dev": true` 플래그 제거. 이 변경은 timezone context 기능과 직접적인 관련이 없다. 단, lock 파일은 `npm install` 재실행 시 자동 재생성되는 성격이므로 실질 기능 변화는 없다. 의도적인 의존성 정리라면 별도 커밋으로 분리하는 것이 이력 추적에 유리하다.
  - 제안: 기능 PR 과 lock 파일 정리 변경을 같은 커밋에 섞지 않도록 별도 커밋 또는 별도 PR 로 분리를 고려한다.

- **[INFO]** `ai-agent.thread.spec.ts` 에서 기존 테스트 케이스 세 곳에 `includeSystemContext: false` 옵션 삽입
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts` (L394, L402, L413)
  - 상세: thread injection 검증 목적의 기존 테스트에 `includeSystemContext: false` 를 추가해 새 prefix 기능이 기존 assertions 에 간섭하지 않도록 격리했다. 기존 테스트 로직을 변경하지 않고 config 에 옵션 하나를 추가한 것이므로, 기능 범위 내 최소 필요 수정에 해당한다.
  - 제안: 현재 방식 유지. 주석으로 의도를 명시한 것도 적절하다.

- **[INFO]** `codebase/backend/src/nodes/integration/cafe24/metadata/customer.ts`, `product.ts` 의 필드 description 수정
  - 위치: `customer.ts` L879, `product.ts` L992, L999, L1009, L1016
  - 상세: `since`/`until` 파라미터의 description 을 `'ISO8601 date — created_after'` 에서 `'ISO8601 datetime (KST, UTC+9) — ...'` 로 보강했다. cafe24 timezone 컨텍스트 수정(파일 19, `CAFE24_TIMEZONE_SUFFIX` 상수 추가, 파일 20, metadata.spec.ts KST 준수 테스트 추가)의 연장선상에 있어 기능 의도에 부합한다. 단, 이 파일들이 직접 수정 대상으로 명시됐다면 범위 내 변경이다.
  - 제안: 별도 이슈가 없으면 현재 방식 유지.

- **[INFO]** `codebase/frontend/src/lib/i18n/backend-labels.ts` 에서 신규 UI 필드 라벨·힌트·그룹·옵션 번역 추가
  - 위치: `backend-labels.ts` L1062–1093
  - 상세: `includeSystemContext`, `systemContextSections` 필드가 각 노드 schema 에 추가됨에 따라 UI 표시에 필요한 한국어 번역이 추가되었다. 해당 UI 필드가 schema 에 추가된 이상 번역 추가는 scope 내 필요 작업이다.
  - 제안: 현재 방식 유지.

## 요약

이 PR 의 핵심 의도는 AI 노드(AiAgent, TextClassifier, InformationExtractor) 의 시스템 프롬프트에 workspace timezone context prefix 를 자동 주입하고(spec §11), Cafe24 MCP 도구 description 에 KST 타임존 suffix 를 덧붙여 LLM 의 시각 추론 회귀를 방지하는 것이다. 변경된 파일 23개 모두 이 의도에 직결된다. 신규 shared 모듈(`system-context-prefix.ts/.spec.ts`) 신설, 각 핸들러/스키마/테스트 파일 수정, 실행 엔진의 `__workspaceTimezone` 주입, frontend 번역 추가까지 일관된 범위 안에서 이루어졌다. 다만 `package-lock.json` 두 파일에서 `"dev": true` 플래그 제거 및 peer dependency 항목 삭제가 포함되어 있어, 이 부분은 timezone context 기능과 무관한 의존성 정리 변경이 기능 PR 에 혼입된 상황이다. 기능 동작에는 영향 없지만 이력 추적 명확성을 위해 분리를 권고한다. 전체적으로 over-engineering, 불필요한 리팩토링, 무관한 코드 영역 수정, 포맷팅 혼입 등의 문제는 발견되지 않았다.

## 위험도

LOW
