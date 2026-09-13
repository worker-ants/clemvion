# Rationale 연속성 검토 — guide-error-code-truth (impl-done, scope=spec/5-system/)

## 조사 방법

`spec/5-system` 델타는 이번에도 0 (코드·문서 전용 PR, 4번째 연속 라운드). 프롬프트 번들이
예산 초과로 `3-error-handling.md`·`7-llm-client.md` 등 17개 파일 본문과 `<git diff
origin/main...HEAD -- code_areas>` 자체를 절단했으므로, `git diff origin/main...HEAD` 를
워킹트리에서 직접 실행해 실제 변경분을 확인하고, 인용된 spec 문서(`3-error-handling.md
§1.4`, `2-navigation/4-integration.md §9.1`, `conventions/error-codes.md`,
`conventions/swagger.md §3`)를 직접 Read 해 diff 안의 인용문·근거 문장과 대조했다. 또한
같은 세션의 선행 3회 rationale_continuity 라운드(`10_12_54`·`10_41_13`·`11_08_03`, 전부 CRITICAL/
WARNING 0)와 `plan/in-progress/guide-error-code-truth.md`·`spec-draft-nullable-notation-
followups.md` 의 처분 이력을 대조해 이번 라운드(라운드 3 수정분 반영 후)에 새 회귀가
없는지 확인했다.

## 발견사항

없음 — CRITICAL/WARNING 대상 없음.

### [INFO] "결과 객체 필드명은 에러 봉투와 겹치면 안 된다" 원칙이 여전히 spec Rationale 부재 (선행 INFO 승계 확인)

- target 위치: `codebase/backend/src/modules/llm/llm.service.ts` `testConnection` JSDoc — 전
  라운드(`11_08_03`)에서 지적된 것과 동일 지점, 이번 diff 로 코드 변화 없음
- 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` §9.1 관련 항
  ("Endpoint 시맨틱: `:id/test` 는 ... 결과 body 형식이 이미 `{ success, code, message }`
  의 success/false 패턴이라 가드 결과도 같은 shape 으로 표현하는 게 자연스럽다" — 직접 대조
  확인, 원문과 정확히 일치)
- 상세: 신규가 아니라 **승계 상태 확인**이다. 전 라운드 INFO 를
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `testConnection 실패 응답
  shape` 항목에 "함께 명문화할 것 (`--impl-done` `11_08_03` rationale_continuity INFO#2)"
  로 정확히 인용해 planner 백로그에 편입했음을 diff 로 확인했다 — 유실되지 않았다. 다만
  spec Rationale 자체에는 아직 반영되지 않은 상태라 원칙은 여전히 JSDoc 한 곳에만 존재한다.
- 제안: 변경 없음 — 기존 제안 유지(해당 planner 항목 처리 시 `7-llm-client.md` 또는
  `2-api-convention.md` Rationale 에 명문화). 코드 변경 불요, BLOCK 대상 아님.

## 라운드 3 수정분에 대한 추가 확인 (11_08_03 이후 diff)

- **`run-results{,.en}.mdx` 노드-카테고리 표 5종 보강**: `spec/5-system/3-error-handling.md
  §1.4` 노드 수준 표(HTTP/Database/Email/LLM/Code/Sub-workflow 6개 카테고리)를 직접 대조한
  결과, 추가된 코드(`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`·`MAX_COLLECTION_RETRIES_EXCEEDED`·
  `SUB_WORKFLOW_QUEUE_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE`)와 `*_HOST_BLOCKED` 설명 문구가
  spec 표·SSRF 가드 설명(§1.4 "SSRF 차단" 각주)과 정확히 일치한다. 새 원칙 도입이 아니라
  기존 §1.4 표를 뒤늦게 완전히 미러링한 것.
- **`error-handling.mdx` 예시의 `NODE_EXECUTION_FAILED` → `LLM_TIMEOUT` 치환**: §1.4 "구 에러
  코드 `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR` 는 ... 더 이상 사용하지
  않는다" 원칙을 다시 위반하지 않고 그대로 따른다 — 은퇴 코드 재도입 없음.
- **`integrations.mdx` MakeShop 7종 + 경계 설명**: "호출 후 실패(7종)" vs "호출 전 설정
  검증 실패(4종)" 를 목록 확장 대신 **경계 명시**로 처리했다는 plan 서술(§G documentation
  W#2)을 diff 로 확인 — 실재 코드(`MAKESHOP_UNKNOWN_OPERATION` 등)를 지어내지 않고 정확한
  이름으로 열거했다.
- **`LLM_CONNECTION_ERROR` 처분 번복의 취소선 처리**: `spec-draft-nullable-notation-
  followups.md` 에서 과거 처분 문장("수렴 코드 `LLM_CONNECTION_ERROR` 를 적어라")을 물결
  취소선(`~~...~~`)으로 원문 그대로 보존하고, 바로 아래 "위 취소선: 그 처분이 내 실측에
  반증됐다" 로 반증 근거(엔드포인트가 코드를 전혀 안 냄 — 주어 자체가 틀렸다)를 인접
  기록했다 — "결정의 무근거 번복" 에 해당하지 않는 모범 사례(선행 라운드와 동일 평가 유지).
- **`code`/`meta` 필드 JSDoc 서사 분리**: `TestConnectionResultDto.code` 의 JSDoc 이
  API 소비자용 설명만 담고 경위·근거는 바로 위 `//` 주석으로 분리돼 있음을 `conventions/
  swagger.md §3`(플러그인이 JSDoc 을 `description` 에 그대로 싣는다는 원칙) 원문과 대조
  확인 — 라운드 1 위반(convention W#1)이 라운드 2 에서 정정된 상태가 유지되고 있다.
- **신규 backlog 6건**(`spec-draft-nullable-notation-followups.md`): 카탈로그 누락·shape
  미문서화·관계표 누락·MCP 필드 미선언·역방향 가드 부재·유령 필드 가드 부재. 전부 발견
  출처(리뷰 세션 경로)를 정확히 인용하고, 이미 §1.4/§9.1/`conventions/error-codes.md` 가
  못박은 소유 경계("본 문서가 유일하게 소유하는 것: ① 의미 기반 명명, ② rename 안정성,
  ③ historical-artifact" — 원문 대조 확인)를 벗어나지 않는다. spec 을 직접 고치지 않고
  planner 백로그로 이관해 권한 경계(`developer` 는 `spec/` 쓰기 불가)도 지켰다.

## 교차 검증한 항목 (선행 라운드부터 유지, 회귀 없음)

- 은퇴 코드(`NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR`) 재도입: 없음.
- CWE-209 원문 미노출 원칙(`api-convention.md §5.3`): `sanitizeLlmErrorMessage` 8갈래 고정
  문장 + `guide-sanitized-message-parity.test.ts` 양방향 대조로 오히려 강화됨. `models.mdx`
  신규 표도 SoT 문장을 그대로 옮겼을 뿐 provider 원문을 노출하지 않는다.
- `nodeName` → `nodeLabel`: 기존 §2.2(2026-08-17) 정정을 문서가 뒤늦게 따라간 것, 신규
  번복 아님.
- 가드 배치 위치(`error-codes.md` 대신 `docs/__tests__/`): 문서 소유 경계 원문과 일치,
  근거 실재.
- Planned 로드맵 코드(`LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`) 가드 배제: `7-llm-client.md
  §6` "미구현(Planned)" 표기와 정합.

## 요약

이번 라운드(4번째 연속 검토)는 라운드 3 이 추가한 노드-카테고리 표 보강·MakeShop 경계 설명·
6건의 신규 planner 백로그를 포함해 diff 전체를 재확인했으나, Rationale 연속성 관점의 신규
문제는 발견되지 않았다. 은퇴된 결정(구 에러 코드 3종)은 재도입되지 않았고, 합의된 설계
원칙(§9.1 결과-객체 패턴, CWE-209 비노출, JSDoc/주석 서사 분리, 문서 소유 경계)은 모두
원문과 대조해 정확히 지켜지고 있으며, 유일한 결정 번복(`LLM_CONNECTION_ERROR` 처분)은
취소선과 반증 근거를 인접 기록하는 모범적 방식으로 처리됐다. 선행 라운드가 지적한 유일한
INFO(결과-객체 명명 원칙이 JSDoc 에만 존재)는 유실 없이 planner 백로그에 정확히 승계되어
있음을 이번에 재확인했다 — 아직 spec Rationale 명문화 자체는 미완이므로 동일 INFO 로 유지한다.

## 위험도

NONE
