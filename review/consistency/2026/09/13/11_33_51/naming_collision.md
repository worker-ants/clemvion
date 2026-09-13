# 신규 식별자 충돌 검토 — naming_collision

검토 모드: `--impl-done`, 명목 scope `spec/5-system/`(델타 0, 정상) · 실제 구현 diff
(`origin/main`대비 24개 파일 — CHANGELOG·backend DTO/service·frontend 가드 3종·MDX 4쌍·plan)
을 SoT(HEAD 워킹트리, `/Volumes/project/private/clemvion/.claude/worktrees/guide-error-code-truth`)
에서 직접 대조했다.

## 발견사항

- **[CRITICAL] `integrations.mdx`/`.en.mdx` 가 신규로 적은 `MAKESHOP_UNRESOLVED_PATH_PARAM` 이 실제로는 기존 제네릭 코드 `INTEGRATION_CALL_FAILED` 의 자리를 가리킨다 — `.code` 로 나가지 않는다**
  - target 신규 식별자: `MAKESHOP_UNRESOLVED_PATH_PARAM` — `codebase/frontend/src/content/docs/02-nodes/integrations.mdx:303`, `integrations.en.mdx:292` (이번 diff 로 신규 추가된 문장. "설정이 잘못돼 호출 자체가 만들어지지 않은 경우" 4종 중 하나로, `MAKESHOP_UNKNOWN_OPERATION`·`MAKESHOP_MISSING_FIELDS`·`MAKESHOP_INVALID_SHOP_UID` 와 나란히 **동일한 `code:` 계열**인 것처럼 제시된다).
  - 기존 사용처(충돌 대상): `INTEGRATION_CALL_FAILED` — `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:146`(정의) 및 `makeshop.handler.ts:360`·`cafe24.handler.ts:373`·`http-request.handler.ts:626`·`database-query.handler.ts` 전부가 공유하는 **모든 Integration 노드 공통의 제네릭 fallback 코드**("`IntegrationError` 가 아닌 throw 의 기본 코드"). `spec/4-nodes/4-integration/0-common.md §4.2` 에 이미 그렇게 명시돼 있다.
  - 상세: `makeshop.handler.ts:435-437` 의 경로-placeholder 미해결 검사는 `throw new Error(\`MAKESHOP_UNRESOLVED_PATH_PARAM: ...\`)` 로 **일반 `Error`** 를 던진다(`IntegrationError` 가 아님). 바깥 catch(`makeshop.handler.ts:358-360`)의 분기는 `err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED'` 이므로, 이 경로는 `IntegrationError` 가 아니라서 **실제 `output.error.code` 는 `INTEGRATION_CALL_FAILED`** 다. `MAKESHOP_UNRESOLVED_PATH_PARAM` 문자열은 `error.message` 안에 텍스트로만 남는다. 반면 형제 셋(`MAKESHOP_UNKNOWN_OPERATION`·`MAKESHOP_MISSING_FIELDS`·`MAKESHOP_INVALID_SHOP_UID`)은 전부 `throw new IntegrationError('CODE', ...)` 로 던져지므로 `err.code` 가 그대로 보존돼 실제 `.code` 값이 맞다 — 넷 중 셋만 진짜다.
    같은 이름의 **자매 `CAFE24_UNRESOLVED_PATH_PARAM`**(`cafe24.handler.ts:453`, 동일하게 일반 `Error`)도 같은 결함을 갖고 있는데, 형제 문서 `cafe24.mdx`/`cafe24.en.mdx` 는 이 이름을 **전혀 인용하지 않는다**(grep 0건) — 이번 PR 이 명시적으로 "베낄 미러" 로 참조한 그 형제 페이지가 오히려 이 함정을 피해 갔다.
    이 PR 이 새로 배선한 `guide-error-code-existence.test.ts`(축 3″, `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`)의 `collectBackendTokens` 는 **파일 텍스트 전체에서 `UPPER_SNAKE` 정규식으로 토큰을 걷는다** — `.code` 필드 할당인지 `Error` 메시지 문자열 안의 텍스트인지 구분하지 않는다. 그 결과 `MAKESHOP_UNRESOLVED_PATH_PARAM` 은 backend 소스에 "존재" 하므로 베이스라인 0 을 통과하지만, 이는 **이 PR 이 고치려던 바로 그 결함 클래스**(가이드가 실재하지 않는/다른 의미인 코드를 적는다)를 가드의 사각지대(존재 검사 ≠ `.code` 방출 검사)를 통해 **다시 들여온 것**이다.
  - 제안: 가이드 문장에서 `MAKESHOP_UNRESOLVED_PATH_PARAM` 를 실제 방출 코드 `INTEGRATION_CALL_FAILED` 로 정정하거나(다만 이 코드는 이 실패에 고유하지 않고 다른 다수 실패도 함께 이 코드로 뭉뚱그려진다는 점을 함께 서술), 혹은 `makeshop.handler.ts`(및 동형 결함을 가진 `cafe24.handler.ts`)의 해당 `throw new Error(...)` 를 `throw new IntegrationError('MAKESHOP_UNRESOLVED_PATH_PARAM', ...)` 로 바꿔 코드 쪽을 문서 서술에 맞추는 것도 대안이다(다만 이는 `spec/5-system` 밖의 `spec/4-nodes/4-integration/*` 범위이므로 별도 planner 턴 필요). `guide-error-code-scan.ts` 의 기준집합을 "`.code:`/`IntegrationError(` 인자 위치" 로 좁히는 후속 보강도 고려할 만하다(다만 이번 CRITICAL 의 직접 처방은 아니다).

- **[INFO] `MAKESHOP_CALL_FAILED`(MCP 도구 경로) vs `INTEGRATION_CALL_FAILED`(노드 실행 경로) — 같은 통합의 두 실행 표면에서 이름이 다른 제네릭 fallback 코드가 병존**
  - target 신규 식별자: 이번 diff 자체가 도입한 것은 아니나, 이번에 새로 작성된 `integrations.mdx` §MakeShop 절이 "코드는 실패 방식에 따라 갈린다" 고 서술하는 바로 그 절 옆에 두 계열(`MAKESHOP_*` 노드 vs `MAKESHOP_CALL_FAILED`/AI Agent MCP 도구)이 공존한다는 사실이 문서에 드러나지 않는다.
  - 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts:686`(`code: 'MAKESHOP_CALL_FAILED'`, AI Agent 노드가 MakeShop 을 MCP 도구로 쓸 때의 제네릭 fallback) vs `integration-handler-base.ts:146`(`code: 'INTEGRATION_CALL_FAILED'`, 일반 MakeShop **노드** 실행의 제네릭 fallback).
  - 상세: 두 이름이 비슷해(`*_CALL_FAILED`) 어느 코드가 어느 실행 경로(노드 직접 실행 vs AI Agent 의 MCP 도구 호출)에 대응하는지 가이드만 봐서는 구분하기 어렵다. 이번 PR 의 diff 범위는 아니라 CRITICAL 로 올리지 않지만, 같은 절을 손댄 김에 명시했다면 좋았을 자리다.
  - 제안: 후속 편집에서 두 표면(§02-nodes 의 일반 노드 vs AI Agent MCP 도구)의 코드 계열이 다르다는 한 줄을 추가하는 것을 고려. 이번 배치의 필수 처분 대상은 아니다.

- **[INFO] `TestConnectionResultDto.code` 신규 필드 — 충돌 없음, 검증 완료**
  - target 신규 식별자: `TestConnectionResultDto.code?: string`(`integration-response.dto.ts`).
  - 기존 사용처: 같은 파일의 `ModelTestConnectionResultDto` 는 `code` 필드가 없다(순수 `message`) — 두 자매 DTO 의 필드 집합이 달라졌지만, 실제로 나가는 런타임 값이 서로 다르므로(하나는 `code` 를 내고 하나는 안 낸다) 이는 **정확한 반영**이지 충돌이 아니다(diff 주석·`swagger-dto-contract.spec.ts:391,404` 화이트리스트로 이미 양쪽 다 등재돼 정합 확인됨).
  - 판정: 충돌 없음 — 정보 제공 목적으로만 기록.

- **[INFO] `LlmService.testConnection()` 반환 필드 `error → message` 리네임 — 충돌 없음**
  - target 신규 식별자: 없음(기존 DTO·프런트엔드가 이미 쓰던 `message` 로 서비스 쪽을 맞춘 것). API 봉투(`{ error: { code, message } }`, `2-api-convention.md §5.3`)의 `message` 와 필드명이 같지만, 이 값은 HTTP 200 의 **결과 객체**(`data.message`)이지 에러 봉투가 아니므로 중첩 위치가 달라 실제 파싱 충돌은 없다. diff 자체 주석(`llm.service.ts` JSDoc)이 이 구분을 이미 명시하고 있다.
  - 판정: 충돌 없음.

- 신규 export 식별자(`ErrorCodeCitation`·`CitationAxis`·`scanErrorCodeCitations`·`collectBackendTokens`, `guide-error-code-scan.ts`)와 신규 파일 경로(`guide-error-code-scan.ts`·`guide-error-code-existence.test.ts`·`guide-sanitized-message-parity.test.ts`, `codebase/frontend/src/lib/docs/__tests__/`)는 저장소 전체(`git grep`)에서 다른 의미로 쓰인 곳이 없고, `<logic>.ts` + `<logic>.test.ts` 페어링은 같은 디렉터리의 기존 관례(`impl-anchor-parse.ts`/`impl-anchor-existence.test.ts`, `plan-scan.ts`/`plan-scan.test.ts`, `spec-links.ts`/`spec-links.test.ts`)와 일치한다 — 충돌·컨벤션 위반 없음.
- `spec/5-system/` 자체는 이번 diff 에서 변경되지 않았다(scope 델타 0, 정상) — 새 요구사항 ID·엔드포인트·이벤트명·ENV 키는 이 영역에서 도입되지 않았다.

## 요약

이번 배치는 유저 가이드가 적던 존재하지 않는/은퇴한/오귀속 에러 코드 5종을 실재 코드로 맞추고 재발 방지 가드까지 배선한 자기-반증적 정합화 작업이며, `spec/5-system` 자체에는 변경이 없어 그 영역 기준 신규 식별자 충돌은 원천적으로 없다. 다만 정정 과정에서 **새로 작성한 MakeShop 문장 하나(`MAKESHOP_UNRESOLVED_PATH_PARAM`)가 이 PR 이 막으려던 바로 그 결함 클래스를 다시 들여왔다** — 실제 방출 코드는 이미 다른 의미(모든 Integration 노드 공통 fallback)로 쓰이는 기존 식별자 `INTEGRATION_CALL_FAILED` 인데, 가이드는 이를 MakeShop 전용 세부 코드인 것처럼 서술했고, 새로 만든 가드는 "backend 소스에 문자열로 존재하는가" 만 보기 때문에(Error 메시지 안 텍스트 vs 실제 `.code` 방출을 구분 못함) 이를 통과시킨다. 나머지 신규 필드·신규 export·신규 파일 경로는 기존 사용처와 대조한 결과 전부 충돌이 없고 기존 컨벤션과도 정합적이다.

## 위험도

HIGH
