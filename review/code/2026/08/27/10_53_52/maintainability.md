# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위

핵심 코드 변경 4개 파일을 실제 소스(`Read`)로 전체 대조했다:

- `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts`
- `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts`
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts`

나머지 17개 파일(`plan/**`, `review/consistency/**`, `spec/**`)은 프로세스·문서 산출물이라
"코드"로서의 가독성/함수 길이/복잡도 관점 평가 대상이 아니라고 판단해 최소한만 확인했다.
다만 이번 diff가 건드리지 않은 인접 코드(`ai-turn-executor.ts`)에서 이 변경의 부작용으로
생기는 문서 드리프트를 발견해 아래에 포함한다.

## 발견사항

- **[WARNING]** 제거된 마스킹 boundary를 여전히 근거로 인용하는 stale 주석 (diff 밖 인접 파일)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3280`, `:3350-3352` (직접 `Read`로 실제 줄 번호 확인 — 이번 diff에는 포함되지 않은 파일)
  - 상세: 이 파일은 `_retryState`에서 credential을 제외하는 이유를 "`maskSensitiveFields` boundary strip 과 동일 정책" 이라고 두 곳에서 설명한다(`// ... maskSensitiveFields\` boundary 와 동일 정책.` / `/** ... same masking policy as \`_resumeState\` (\`maskSensitiveFields\` boundary strip). */`). 그런데 이 PR이 정확히 그 boundary(`handler-output.adapter.ts`의 `maskSensitiveFields(r.config)` 호출)를 제거했다. `_retryState`의 allow-list 방식 자체는 안전하지만(별도 메커니즘), 주석이 인용하는 "그 boundary"는 이제 아무것도 마스킹하지 않는다 — 미래 독자가 이 주석을 근거로 "config echo boundary가 여전히 자격증명을 strip한다"고 오해할 수 있다.
  - 이번 PR의 `spec_impact`(6개 spec 파일)와 `review/consistency/2026/08/24/19_26_06/` 산출물은 모두 `spec/**` 문서만 스캔했고(각 checker가 `spec/5-system/` 등으로 스코프됨), 코드 주석인 이 파일은 그 스윕에 포함되지 않았다 — 그래서 아직 아무 곳에도 추적되지 않는다.
  - 제안: 이 두 주석을 "credential 은 egress(REST/WS) 에서만 마스킹되며, `_retryState`/`_resumeState` 는 별도로 allow-list 로 credential 필드를 아예 담지 않는다" 로 정정. spec 6곳과 같은 커밋/턴에서 처리하거나 별도 후속 항목으로 등재.

- **[INFO]** 동일한 보안 불변식 설명이 3곳에 근접-중복 서술됨 (단일 출처 부재)
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-48`(주석), `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:92-108`(JSDoc), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:113-128`(JSDoc)
  - 상세: "어댑터가 config를 더 이상 마스킹하지 않아도 안전한 이유(egress 두 곳이 이미 `deepRedactSecrets*`를 걸고, 그 키 축이 `DEFAULT_SENSITIVE_KEYS`를 포함한다)"라는 동일 논지가 세 파일에 표현만 바꿔 반복된다. 이 저장소가 `RESOLUTION.md`에서 스스로 기록했듯("게이트는 `1-ai-agent.md:480` 한 자리를 지목했다... 실제로는 그 파일에만 4자리였고 전체 8개 파일") 이런 다중 산개 서술은 향후 이 불변식이 바뀔 때(예: 값 축 확장, 목록 축소) 한 곳만 고치고 나머지를 놓치는 사고를 유발하기 쉬운 형태다.
  - 제안: 세 곳 중 한 곳(예: `mask-sensitive-fields.util.spec.ts`의 포함관계 캐너리 JSDoc)을 canonical 설명으로 삼고, 나머지 두 곳은 "왜 안전한지는 `mask-sensitive-fields.util.spec.ts`의 포함관계 캐너리 참조" 정도로 짧게 줄여 중복 표면을 줄이는 편이 향후 동기화 비용을 낮춘다.

- **[INFO]** plan 체크리스트가 같은 diff 안의 실제 상태와 어긋남
  - 위치: `plan/in-progress/masking-expression-egress-split.md` 체크리스트 "- [ ] (planner 턴) **6개 spec**" 항목
  - 상세: 이 항목은 미체크(`[ ]`) 상태인데, 그 6개 spec_impact 대상 파일(`spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/3-ai/1-ai-agent.md`(2곳), `spec/5-system/4-execution-engine.md`, `spec/conventions/egress-masking.md`, `spec/conventions/node-output.md`)는 이번 diff 안에서 이미 정정 문구(취소선 + "2026-08-24 정정")로 편집되어 있다. 체크박스만 보고 "planner 턴이 아직 안 됐다"고 오판할 수 있다.
  - 제안: 이 diff가 실제로 머지되는 시점(마무리 커밋)에 체크박스를 함께 갱신 — 이 저장소가 이미 알고 있는 반복 패턴(체크와 완료 이동은 한 동작)과 동일한 종류의 사소하지만 반복되는 위생 이슈다.

- **[INFO]** 동일 basename의 서로 다른 유틸 파일 두 개 (`sanitize-error-message.ts`) — 이번 PR이 그중 하나에 새로 강하게 의존
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` vs `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`
  - 상세: 이번 PR의 두 신규 테스트 파일 모두 `deepRedactSecrets`를 `'../../shared/utils/sanitize-error-message'`에서 import한다 — 이는 올바른 대상이며 실제로 그렇게 구현돼 있다. 다만 같은 디렉터리 트리에 이름이 완전히 같은 파일이 두 개(하나는 알림 메시지용 `sanitizeErrorMessage`, 하나는 API/WS egress용 `deepRedactSecrets`/`redactSecrets`) 존재하는 구조는, 이번 PR의 안전성 주장이 "정확히 어느 마스커를 거치는가"에 전적으로 의존하는 만큼, IDE 자동완성이나 grep으로 잘못된 파일을 짚기 쉬운 위험을 키운다. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W6에서 `CREDENTIAL_KEY_PATTERN` 이중 선언 문제로 별건 등재돼 있어 새로 만드는 항목은 아니다.
  - 제안: 별건 처리 시 두 파일 중 알림 전용 쪽(`modules/execution-engine/sanitize-error-message.ts`)을 `notification-error-sanitizer.ts` 등으로 리네임하는 것도 함께 검토 가치가 있다.

## 긍정적으로 확인된 점

- `handler-output.adapter.ts`의 `config` 필드 조립이 `(maskSensitiveFields(r.config ?? {}) ?? {}) as Record<string, unknown>` → `r.config ?? {}`로 단순화됐다. `NodeHandlerOutput.config`가 이미 `Record<string, unknown>`으로 타입돼 있어 캐스트가 불필요해졌고, 순수 함수 호출 한 겹과 타입 단언이 사라져 오히려 이 함수의 순환 복잡도가 낮아졌다.
- `mask-sensitive-fields.util.spec.ts`의 신규 `KEYS` 상수는 `DEFAULT_SENSITIVE_KEYS`를 손으로 재나열하지 않고 `maskSensitiveFields(...)` 호출 결과에서 파생시켜, 목록이 넓어질 때 테스트가 자동으로 새 키를 포함하도록 만들었다 — 손-나열 대비 향후 drift에 강한 설계다. `KEYS`의 SCREAMING_CASE 네이밍도 이 저장소의 기존 관행(`assert-row-array.spec.ts`의 `SRC`/`FILES`, `update-returning-rows.spec.ts`의 `EXPECTED` 등 — 테스트 내 로컬 파생 상수)과 일치한다.
- `handler-output.adapter.spec.ts`의 신규/치환 테스트들은 `[캐너리]`/`[대조군]` 접두어로 "무엇을 고정하는 테스트인지"를 제목에서 바로 알 수 있게 했고, 기존 스타일(예: 이전 `INFO #5 (Security)` 주석 패턴)과 어울리는 톤을 유지한다.
- 두 유틸 함수(`maskSensitiveFields`, `deepRedactSecrets`) 자체는 이번 diff에서 로직 변경이 없고 여전히 짧고 단일 책임을 유지한다 — 함수 길이/중첩 깊이 관점에서 문제 없음.

## 요약

핵심 로직 변경(`handler-output.adapter.ts`의 마스킹 제거, `mask-sensitive-fields.util.ts`의 주석 정정)은 작고 명확하며 오히려 복잡도를 낮췄다. 테스트 추가분도 함수당 책임이 분명하고 파생 fixture로 향후 drift에 대비하는 등 이 저장소의 기존 관행에 잘 맞는다. 다만 이 변경의 안전 논거가 "여러 표면에 흩어진 산문 설명 + 다른 파일의 그 산문을 신뢰하는 것"에 의존하고 있어, (1) diff 밖의 `ai-turn-executor.ts`에 이미 stale해진 주석 2곳이 이번 스윕에서 누락됐고, (2) 동일 논지가 3개 파일에 근접-중복 서술돼 향후 동기화 비용을 만들며, (3) plan 체크리스트가 같은 diff 안의 실제 상태를 아직 반영하지 못한 상태다. 코드 자체의 가독성·네이밍·복잡도는 양호하다.

## 위험도

LOW
