# 리뷰 이슈 조치 내역 — 2026-04-22

대상 리뷰: `review/2026-04-22_00-00-12/SUMMARY.md`
조치자: developer role

## 조치 요약

| # | 카테고리 | 발견사항 | 조치 | 위치 |
|---|----------|----------|------|------|
| WARNING 3 | Architecture | 시스템 프롬프트 스냅샷(edge `id` 없음) vs `buildCurrentWorkflowResult` 발산 | **통일**: 두 표현이 동일한 `toWorkflowView(snapshot)` 헬퍼를 사용하도록 리팩터. 엣지 `id` + 노드 `category` 가 양쪽 모두에 포함됨 → `remove_edge` 가 프롬프트 스냅샷만 보고도 호출 가능 | `tools/workflow-view.ts` (신규), `prompts/system-prompt.ts`, `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult` |
| WARNING 4 | Architecture | `handleExploreCall` switch 에 `get_current_workflow` 케이스 없음 → 조건부 우회 제거 시 `UNKNOWN_EXPLORE_TOOL` 무음 실패 | switch 에 방어 분기 추가: INTERNAL 에러 + 원인 메시지를 tool_result 로 반환. 루프가 shadow 선처리를 잊는 회귀가 생기면 LLM 응답/테스트로 즉시 드러남. 메서드 JSDoc 에 경계 명시 | `workflow-assistant-stream.service.ts:handleExploreCall` |
| WARNING 6 | Maintainability | 스냅샷 매핑 로직이 `system-prompt.ts` 와 `buildCurrentWorkflowResult` 에 중복 | WARNING 3 통일 과정에서 함께 해소. 중복 제거 + 타입 안전한 `WorkflowView` 인터페이스 export | `tools/workflow-view.ts` |
| WARNING 7 | Testing | 엣지 필드·빈 워크플로우·exploreTools 호출 여부·node type 검증 공백 | stream spec 에 엣지 전체 필드(`id/sourcePort/targetPort/type`) `toMatchObject` 검증, `category`·`position`·`containerId` 검증, **빈 캔버스 테스트 신규 추가**, `exploreTools.getWorkflow`/`listWorkflows` `not.toHaveBeenCalled` 검증, in-turn add_node 후 node `type` 검증 | `workflow-assistant-stream.service.spec.ts` |
| WARNING 9 | Documentation | 서비스 JSDoc 및 테스트 헤더 미갱신 | 클래스 JSDoc 에 `get_current_workflow` 가 shadow 선처리된다는 경로 설명 추가, 테스트 헤더에 신규 시나리오 3개(get_current_workflow/빈 캔버스/rehydration) 기재 | `workflow-assistant-stream.service.ts`, `workflow-assistant-stream.service.spec.ts` |
| INFO 3 | Requirement | 도구 description 에 redact 정책 미언급 → LLM 이 API 키 값을 기대할 수 있음 | `get_current_workflow` description 끝에 "Sensitive config values (apiKey, secret, token, etc.) are redacted to \"[REDACTED]\"" 추가 | `tools/tool-definitions.ts` |
| INFO 6 | Testing | in-turn add_node 테스트에서 노드 `type` 미검증 | `newNode?.type` 검증 추가 | `workflow-assistant-stream.service.spec.ts` |
| INFO 8 | Documentation | `buildCurrentWorkflowResult` 에 redact 정책 주석 부재 | "시스템 프롬프트 스냅샷과 동일한 보안 정책(redactConfig) · 동일한 shape(toWorkflowView)" 주석 추가 | `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult` |
| 추가 | Testing / Security | `redact.ts` 단위 테스트가 존재하지 않아 secret 키 패턴 커버리지 드리프트가 조용히 발생할 수 있음 (WARNING 2 연관) | `tools/redact.spec.ts` 신규 작성 — 대소문자 변형/nested/`{{ }}` 표현식 보존/null safety/빈 문자열 등 4개 케이스 고정 | `tools/redact.spec.ts` |

## 스코프 밖으로 분류해 이번 PR 에서는 조치하지 않은 항목

| # | 이유 |
|---|------|
| WARNING 1 (Prompt Injection 방어 강화) | 기존 스냅샷 주입 방식에 대한 심화 방어 제안. 워크플로우 전역에 걸친 경계 마커·길이 검증 정책은 별도 설계·합의가 필요해 본 PR 스코프를 벗어남. 별도 이슈로 다룸 |
| WARNING 2 (redactConfig 단일 의존 → allowlist) | 보안 경계 정책 전환. 본 PR 에서는 coverage 보강(redact.spec.ts) 으로 일부 완화. allowlist 전환은 별도 설계 필요 |
| WARNING 5 (매직 문자열 상수화) | 단일 참조 지점(`workflow-assistant-stream.service.ts:224`) 뿐이어서 상수화 이득이 적음. 다른 도구 이름들도 모두 문자열 리터럴 상태라 일관성을 깨지 않음. 전면 상수화는 별도 리팩터 작업 |
| WARNING 8 (`frontend/package-lock.json` 혼입) | 직전 커밋(`3d784aa` 및 `b16d47d`) 의 결과물로, 본 PR 에서 생성된 변경이 아님. 본 PR 은 lock 파일을 건드리지 않음 |
| WARNING 10 (SSE 이벤트 타입 스펙·구현 불일치) | 기존 구현/스펙 간 간극이며, 본 PR 변경과 무관. 별도 스펙 정리 과제 |
| INFO 1/2 (토큰 증가·redact 재연산) | 현재 규모에서 실질 영향 없음. 고트래픽 전환 시 재검토 |
| INFO 4 (handleExternalExploreCall 리네임) | WARNING 4 방어 분기 + JSDoc 경계 명시로 충분. 이름 변경은 호출자까지 영향 |
| INFO 5 (`as never` 캐스팅) | 기존 테스트 관용구. 본 PR 이 유일한 원인 아니며, 전면 교체는 별도 리팩터 |
| INFO 7 (`?? 'edit'` fallback) | 기존 로직이며 본 PR 변경 범위 밖 |
| INFO 9 (spec §5.3 explore 배지 설명) | 스펙 §4.1 탐색 도구 표에 `get_current_workflow` 를 이미 추가했으며, §5.3 의 "탐색 도구 결과 → 탐색 배지" 규칙은 기존 문구로 이 도구에 자동 적용됨. 추가 한 줄은 과잉 |
| INFO 10/11 (DB/의존성) | 본 PR 스코프 밖, 문제 없음 |

## 검증

조치 후 다음을 재수행:

- `npx eslint "src/**/*.ts"` → 통과
- `npx jest src/modules/workflow-assistant` → 통과 (기존 5 + 신규 3 → 8 케이스, redact 4 케이스)
- `npx jest` (전체) → 통과
- `npx nest build` → 통과

E2E(프론트 연동) 검증은 사용자가 UI 에서 "템플릿 노드랑 스위치 노드 찾아봐" 재시도로 확인.
