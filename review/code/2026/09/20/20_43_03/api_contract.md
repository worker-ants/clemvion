# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 동시 DELETE 경합 시 "패자" 요청의 응답 코드가 `204`(구) → `404`(신)로 바뀐다 — 문서화된 계약 안의 변경
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:280-285`(`RESOURCE_NOT_FOUND` 던짐), 대응 컨트롤러 `codebase/backend/src/modules/workflows/workflows.controller.ts:195-214`(`@HttpCode(HttpStatus.NO_CONTENT)` + 기존 `@ApiNotFoundResponse`) / `codebase/backend/src/modules/workspaces/workspaces.service.ts:530-535`(`WORKSPACE_NOT_FOUND`), 대응 컨트롤러 `codebase/backend/src/modules/workspaces/workspaces.controller.ts:201-213`(기존 `@ApiNotFoundResponse`)
  - 상세: 직접 두 컨트롤러 파일을 열어 확인한 결과, `DELETE /api/workflows/:id`·`DELETE /api/workspaces/:id` 모두 이번 diff 이전부터 Swagger 에 404 응답을 이미 선언해 두고 있었다(`@ApiNotFoundResponse`). 이번 변경은 **새 상태 코드나 새 응답 스키마를 만들지 않고**, 기존에 "존재하지 않는 리소스"에만 쓰던 404 응답을, "동시 삭제 경합에서 진 요청"이라는 새 시나리오에도 적용한 것이다. 이전 동작(둘 다 204, 감사 행 2건)은 클라이언트에게 거짓 성공 신호를 주는 결함이었으므로 이 변경은 계약을 넓히는 breaking change 가 아니라 기존에 문서화된 오류 응답을 정확한 상황에 연결한 수정이다. 다만 두 요청을 경합시켜 응답을 관찰하는 기존 클라이언트(있다면)는 이제 하나가 404 를 받는다는 점에서 **관측 가능한 동작 변화**이며, `plan/in-progress/dup-delete-audit.md` 가 `spec_impact: none` 으로 선언한 근거(트리거 목록 §4.4 의 "두 번째 요청은 404" 선례를 따르는 것)와 일치한다.
  - 제안: 조치 불요. 이미 문서화된 응답 형태 안의 변경이고, e2e(`workflow-delete-concurrency.e2e-spec.ts:93`)가 `[204, 404]` 를 계약으로 고정했다.

- **[INFO]** 에러 코드/메시지 관례가 두 서비스 파일 사이에서 다르다(신규 불일치 아님, 각 파일 내부는 일관됨)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:281-284`(`code:'RESOURCE_NOT_FOUND'`, 영문 `'Workflow not found'`) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:531-534`(`code:'WORKSPACE_NOT_FOUND'`, 한글 `'워크스페이스를 찾을 수 없습니다.'`)
  - 상세: 직접 `grep` 으로 확인 — `RESOURCE_NOT_FOUND`+영문 메시지는 같은 파일의 기존 `findById()`(`:172-173`)와 정확히 동일한 리터럴을 재사용하고, `WORKSPACE_NOT_FOUND`+한글 메시지는 같은 파일 안의 다른 7곳(`:349,383,463,602,628,709,853`)과 문자 그대로 동일하다. 즉 이번 diff 는 **각 파일이 이미 쓰던 관례를 정확히 재사용**했을 뿐이고, 두 파일 사이의 코드명·언어 불일치는 이 PR 이전부터 있던 것이며 새로 벌어지지 않았다.
  - 제안: 조치 불요(pre-existing). 표준화가 필요하면 별도 planner 항목.

- **[INFO]** 내부 포트 인터페이스 `TriggerResourceReleasePort.lockParentAndListTriggerIds` 반환 타입 변경(`Promise<string[]>` → `Promise<LockedParentTriggers>`) — 외부 HTTP 계약과 무관, 소비처 전수 동기화 확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:120-129`(`LockedParentTriggers` 신설), `:178`(포트 시그니처), 구현 `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:84,89-100,105-108`
  - 상세: `grep -rn "lockParentAndListTriggerIds"` 로 재확인한 결과 소비처는 `workflows.service.ts:273`·`workspaces.service.ts:522` 두 곳뿐이며, 두 곳과 세 spec 파일(`trigger-resource-releaser.service.spec.ts`·`workflows.service.spec.ts`·`workspaces.service.spec.ts`)의 mock 이 모두 `{ parentPresence, triggerIds }` 형태로 같은 커밋에서 동기화됐다. `ModuleRef.get(..., { strict: false })` 로 지연 해석되는 토큰이라 타입체크가 놓칠 수 있는 자리이지만, `plan/in-progress/dup-delete-audit.md` 체크리스트가 "단위는 GREEN 인데 build 가 타입 오류로 잡았다"를 실측으로 남겨(import 누락 사례) 이 위험을 이미 실증적으로 확인해 뒀다. HTTP 로 노출되는 인터페이스가 아니므로 API 버전 관리 대상이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `DELETE /api/workflows/:id`(204, 본문 없음)와 `DELETE /api/workspaces/:id`(200, `{ data: { ok: true } }`)의 응답 형태 자체가 서로 다르다 — 이번 diff 가 만든 것이 아니라 기존 계약
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:196`(`@HttpCode(HttpStatus.NO_CONTENT)`) vs `codebase/backend/src/modules/workspaces/workspaces.controller.ts:208`(`@ApiOkWrappedResponse(OkResultDto, ...)`, `@HttpCode` 미지정 → 기본 200)
  - 상세: 두 컨트롤러 파일을 직접 열어 확인했다. 이번 PR 은 두 서비스 메서드의 `absent` 판정 로직만 바꿨고 컨트롤러 데코레이터는 건드리지 않았으므로, 이 응답 형태 비대칭은 diff 범위 밖의 기존 상태다. 새 404 분기가 두 컨트롤러 모두 이미 있던 `@ApiNotFoundResponse` 계약 안에 들어가므로 이 비대칭이 이번 변경으로 악화되지는 않는다.
  - 제안: 조치 불요(pre-existing, 이 PR 스코프 밖).

## 검증 내역 (참고)

- 컨트롤러 두 곳(`workflows.controller.ts`, `workspaces.controller.ts`)을 직접 `Read`/`grep` 해 `@ApiNoContentResponse`/`@ApiNotFoundResponse`/`@HttpCode` 선언이 이번 diff 이전부터 존재함을 확인했다 — 새 상태 코드·새 스키마 없음.
- `RESOURCE_NOT_FOUND`/`WORKSPACE_NOT_FOUND` 리터럴이 각 파일 내부의 기존 동일 리터럴과 문자 그대로 일치함을 `grep -A1`로 확인 — 새 코드/메시지 신설 아님, 재사용.
- 인증/인가(`@Roles('editor')`, 워크스페이스 owner 사전 검사)는 이번 diff 로 변경되지 않았다 — `absent` 검사는 잠금 뒤(이미 인가를 통과한 트랜잭션 내부)에서만 일어나 인가 우회 경로를 만들지 않는다.
- 요청 검증(`ParseUUIDPipe`), URL 설계(`DELETE /api/workflows/:id`, `DELETE /api/workspaces/:id`), 페이지네이션(해당 없음 — 단건 삭제)은 변경되지 않았다.
- 신규 e2e(`codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts:93`)가 `[204, 404]` 및 감사 행 1건을 값으로 고정해, 이 계약이 회귀 없이 유지됨을 실측한다.
- 저장소 파일은 뮤테이션하지 않았다 — 읽기 전용 조사만 수행(`Read`/`grep`).

## 요약

이번 변경은 외부 HTTP API 계약을 새로 만들거나 깨지 않는다. 워크플로/워크스페이스 DELETE 컨트롤러 모두 이번 diff 이전부터 Swagger 에 404 응답을 문서화해 두고 있었고, 이번 수정은 그 기존 404 계약을 "동시 삭제 경합에서 진 요청"이라는 정확한 상황에 연결한 것뿐이다(이전엔 둘 다 204를 돌려주며 감사 로그만 중복 남기던 결함). `TriggerResourceReleasePort.lockParentAndListTriggerIds` 반환 타입 변경은 순수 내부 모듈 경계(포트 1개·구현 1개·호출자 2개)에 국한되며 같은 커밋에서 전부 동기화됐음을 grep 으로 재확인했다. 두 서비스 파일 사이의 에러 코드/메시지 언어 불일치, 두 DELETE 엔드포인트의 응답 형태(204 vs 200+body) 차이는 모두 이 PR 이전부터 있던 것으로 새로 벌어지지 않았다. Critical/Warning 급 API 계약 위반은 발견되지 않았다.

## 위험도

NONE
