STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** `execution-engine.service.ts` (실행 엔진) 변경이 매트릭스 `run-debug-flow-change`(실행·디버깅 흐름 변경, semantic) trigger 와 표면적으로 유사해 보여 `codebase/frontend/src/content/docs/05-run-and-debug/` 을 직접 대조했다 — 갱신 불요로 판정.
  - 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `retry-turn.service.ts`, `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `types.ts`, 신규 `codebase/backend/src/shared/utils/terminal-error-payload.ts`
  - 매트릭스 항목: `run-debug-flow-change` — "실행·디버깅 흐름 변경 → `codebase/frontend/src/content/docs/05-run-and-debug/`" (PROJECT.md :151, `doc-sync-matrix.json` id `run-debug-flow-change`)
  - 대조 결과: 이 PR 은 `execution.failed` 이벤트(`ExecutionEventType.EXECUTION_FAILED`, `Execution.error` 컬럼)의 **wire 형태**를 문자열 → `{code, message, nodeId, details?}` 객체로 정규화하는 내부 계약 수정이다. 실제 실행/재시도/취소 로직(언제 실패로 판정되는지, 몇 번 재시도하는지 등 "흐름" 자체)은 바뀌지 않았고, 최종 사용자에게 노출되는 에러 문구도 동일하다(같은 `message` 값을 객체에서 뽑아 렌더). `05-run-and-debug/error-handling.mdx`(`:106-121` Error 포트 페이로드)와 `run-results.mdx`(`:158-175` "에러 메시지 해석" 예시)는 둘 다 **다른 객체**(`NodeExecution.error` / error-port 데이터, 필드 `nodeName`·`nodeType`·`timestamp`·`originalInput`)를 문서화하고 있어 이번에 바뀐 `Execution.error`(top-level `execution.failed` 이벤트)와 무관하다 — grep 결과 두 문서 모두 이번 변경의 대상 필드 예시를 포함하지 않는다.
  - 상세: 사용자에게 새로 보여지는 것이 없으므로(내부 소비자인 `use-execution-events.ts` 는 같은 changeset 안에서 이미 동반 수정돼 최종 화면 문구는 종전과 동일) 문서 갱신 의무는 발생하지 않는다고 판단. 다만 앞으로 `execution.cancelled` 계열까지 같은 객체화가 이뤄지거나(현재 plan 에 별건으로 등재됨), 외부 webhook/SSE 문서(`02-nodes/triggers.mdx`)에 향후 `error` 필드의 JSON 예시가 추가될 경우엔 이 커밋을 참조점으로 동기화가 필요하다.
  - 제안: 조치 불요(gray-zone 확인 완료, 실제 staleness 없음).

- **[INFO]** SoT spec 문서(`spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md`)는 같은 changeset 안에서 이미 동기화됨 — 이는 `doc-sync-matrix.json`의 `spec-major-change` trigger(frontmatter/status 정합, 다른 reviewer 영역) 범주이며 본 리뷰어 영역(frontend user-guide MDX·i18n dict·backend-labels)과는 별개다. 참고용으로만 기재.

### 요약
`.claude/config/doc-sync-matrix.json`(rows 21건) + `PROJECT.md` §변경 유형 매핑 표를 적재해 이번 changeset(base `589914d6d` → HEAD, 63개 파일: backend `execution-engine`/`chat-channel`/`shared/utils` 6개 소스 + 2개 신규 spec/테스트, frontend `use-execution-events.ts` 1개, 나머지는 `plan/**`·`review/**`·`CHANGELOG.md`·`spec/**` 순수 문서)을 매트릭스 21개 trigger 각각에 대조했다. `codebase/backend/src/nodes/**`(새 노드), `*.tsx`(신규 UI 문자열), `content/docs/**`(신규 섹션), `dict/**`·`backend-labels.ts`·`locale.ts`(i18n), `auth/**`, `expression-engine/**`, `error-codes.ts`, `*.controller.ts`/`dto/**` 등 어떤 glob 에도 매칭되지 않았고, semantic trigger 중 유일하게 근접했던 "실행·디버깅 흐름 변경" 도 직접 두 docs 파일(`error-handling.mdx`, `run-results.mdx`)을 대조해 무관함을 확인했다(별개 객체를 문서화 중). 이 PR 은 `execution.failed` wire payload 를 string→object 로 정규화하는 backend 내부 계약 수정 + 그 유일한 내부 소비자(`use-execution-events.ts`)의 동반 수정이며, 최종 사용자 가시 문구·UI 라벨·문서 예시는 변경 전후 동일하다. 매칭된 trigger 0건, 누락 0건.

### 위험도
NONE
