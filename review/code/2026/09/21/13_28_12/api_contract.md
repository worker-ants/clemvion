# API 계약(API Contract) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정

## 검토 방법

`codebase/` 변경 3파일(`workspaces.service.ts`, `workspaces.service.spec.ts`, 신규
`member-remove-concurrency.e2e-spec.ts`)을 프롬프트 diff + `Read`/`Grep` 으로 직접 대조했다.
컨트롤러(`workspaces.controller.ts`)는 이번 diff 에 포함되지 않지만, 이 PR 이 바꾸는 서비스
메서드가 노출하는 HTTP 계약을 판정하려면 반드시 열어봐야 해서 워킹트리에서 직접 읽었다.
비교군으로 형제 다섯 컨트롤러(`workflows`·`triggers`·`schedules`·`integrations`,
그리고 `workspaces.controller.ts` 자신의 `remove()`)의 상태 코드 설정도 `grep`/`sed -n` 으로
직접 확인했다.

## 발견사항

- **[WARNING]** `DELETE /api/workspaces/:id/members/:memberId` 성공 응답이 `spec/5-system/2-api-convention.md §6` 의 "204 No Content = 삭제 성공" 표와 어긋난다 — `workspaces.controller.ts` 전체(워크스페이스 삭제 + 멤버 제거 둘 다)가 예외이고, 다른 네 형제 컨트롤러는 전부 명시적으로 204 를 쓴다. (이번 PR 이 새로 만든 문제는 아니다 — 컨트롤러는 이 diff 밖이다.)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:355-373`(`removeMember`, `@ApiOkWrappedResponse` + `return { data: { ok: true } }`, `@HttpCode` 없음 → 기본 200) 및 `:201-219`(같은 파일 `remove`/`deleteWorkspace`, 동일 패턴). 대조: `codebase/backend/src/modules/workflows/workflows.controller.ts:195-201`, `codebase/backend/src/modules/triggers/triggers.controller.ts:174-180` 모두 `@HttpCode(HttpStatus.NO_CONTENT)` + `@ApiNoContentResponse` 명시.
  - 상세: `spec/5-system/2-api-convention.md` §6 HTTP 상태 코드 표는 `204 | No Content | 삭제 성공` 한 줄로 DELETE 성공 응답을 못박는다. 그런데 `workspaces.controller.ts` 의 두 DELETE 핸들러(`remove`, `removeMember`)는 `@HttpCode` 를 지정하지 않아 NestJS 기본값인 200 을 그대로 쓰고, 본문도 `{ data: { ok: true } }` 로 봉투를 씌운다. `workflows`·`triggers`·`schedules`·`integrations` 네 컨트롤러의 DELETE 핸들러는 모두 `@HttpCode(HttpStatus.NO_CONTENT)` 를 명시하고 본문을 반환하지 않는다. 즉 이 저장소의 DELETE 응답 규약이 실제로는 두 갈래(204-무본문 계열 vs `workspaces.controller.ts` 의 200-봉투 계열)로 갈려 있는데, `2-api-convention.md §6` 은 이를 반영하지 않는다. 이번 PR 이 고치는 `removeMember()` 자체가 그 200 계열의 일원이라, 이 diff 의 API 계약을 정확히 판정하려면 이 표와의 불일치를 함께 봐야 한다.
  - 제안: 이번 PR 스코프는 아니다(컨트롤러 미변경). 다만 같은 diff 가 이미 `2-api-convention.md §3` "DELETE=멱등 O" 각주 필요성을 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재해 두었으므로, 같은 절 정리 작업 때 "성공 상태 코드도 컨트롤러별로 204/200 두 갈래" 라는 사실을 §6 에 각주로 함께 남기면 다음 사람이 형제 PR 을 베낄 때 상태 코드를 다시 틀리지 않는다.

- **[INFO]** 신규 e2e 파일·plan 문서의 "형제 다섯을 그대로 베끼면 틀리는 자리가 둘 있다 — 1. 이 라우트는 204 가 아니라 200 이다" 서술이 부정확하다(사소, 병합 차단 아님)
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 게이트 `18`~`20`(JSDoc), `plan/in-progress/member-dup-remove.md` 게이트 `94`~`95`
  - 상세: 이 서술은 "형제 다섯"(workflow/workspace/trigger/schedule/integration)이 전부 204 라는 것을 전제로, `removeMember` 만 유일하게 200 으로 예외라고 읽힌다. 그런데 실측 확인 결과 그 "형제 다섯" 중 하나인 `workspaces.service.ts deleteWorkspace()` (plan 자체의 표에서 `#1369`, `removeMember` 와 **같은 컨트롤러 파일**)도 이미 200 `{data:{ok:true}}` 를 반환하고, 그 사실은 같은 계열의 기존 e2e(`workspace-delete-concurrency.e2e-spec.ts:84`, `expect(...).toEqual([200, 404])`)가 이미 고정해 두었다. 즉 `removeMember` 가 다섯 형제 중 유일한 이례가 아니라 `workspaces.controller.ts` 전체가 공유하는 기존 패턴을 그대로 물려받은 것이다 — "형제 다섯은 전부 204" 라는 전제 자체가 실측과 다르다.
  - 제안: 정정 불요(기능·테스트 결과에는 영향 없음 — 실제 단언은 `[200, 404]` 로 이미 옳다). 다음에 이 주석을 다시 만질 기회가 있으면 "형제 다섯 중 `workspaces.deleteWorkspace()` 도 이미 200" 이라고 정확히 적어 두면 같은 착오가 반복되지 않는다.

- **[INFO]** (재확인, 이미 트래킹됨) `DELETE` 멱등성 표(§3)와 "동시 요청 진 쪽 404" 의 정면 충돌이 6번째 사례를 얻는다
  - 위치: `spec/5-system/2-api-convention.md §3`(HTTP 메서드 표, `DELETE | O`) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts` 게이트 `826`~`838`(`if (affected === 0) this.throwMemberNotFound();`)
  - 상세: 동시 `DELETE` 두 건 중 패자가 이제 `200` 대신 `404 MEMBER_NOT_FOUND` 를 받는다 — 형제 다섯(#1369~#1372)과 동일 패턴의 6번째 적용이다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(planner 소유)와 이번 세션의 9-agent 코드 리뷰(`review/code/2026/09/21/12_57_05/SUMMARY.md` SPEC-DRIFT #1)·consistency-check(`review/consistency/2026/09/21/12_23_48`) 양쪽에서 반복 확인·등재됐다.
  - 제안: 신규 조치 불요 — 코드 유지, spec 각주 반영은 planner 턴 대상으로 이미 넘어가 있다.

- **[INFO]** (재확인, 이미 등재·유예됨) `removeMember()` 의 권한 검사 순서가 API 응답 코드를 통해 인가되지 않은 호출자에게도 정보를 노출한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` — 조회(`findOne`) → 404(`MEMBER_NOT_FOUND`) → 자가 위임 → owner 403(`CANNOT_REMOVE_OWNER`) → `assertAdmin`(403 `ADMIN_REQUIRED`) 순서. 함수 자체는 diff 밖(이번 PR 이 그 이후 로직만 바꿈)이라 게이트 번호 대신 함수명으로 표기.
  - 상세: API 계약 관점에서 보면, 워크스페이스 비멤버도 `(workspaceId, memberId)` 쌍에 대해 세 가지로 구분되는 HTTP 응답(`404`/`403 CANNOT_REMOVE_OWNER`/`403 ADMIN_REQUIRED`)을 받을 수 있어 응답 코드 자체가 관측 가능한 정보 노출 채널이 된다. 같은 파일의 다른 Admin+ 엔드포인트(`addMemberByEmail`, `updateMemberRole`)는 `assertAdmin` 을 가장 먼저 호출해 이 계약을 지킨다. 이미 이번 세션 이전 라운드(`review/code/2026/09/21/12_57_05/security.md` WARNING 1)에서 발견·등재됐고, `plan/in-progress/spec-draft-nullable-notation-followups.md`(게이트 `4819`~`4838`)에 "에러 코드 계약 변경 수반 → 별 PR" 이라는 명시적 유예 근거와 함께 트래킹 중이며, `review/code/2026/09/21/12_57_05/RESOLUTION.md` 가 "본 세션에서 코드 무수정" 으로 확정했다.
  - 제안: 재-flag 불필요. API 계약 각도에서도 같은 결론(별도 PR, 에러 코드 계약 변경 수반)에 동의한다 — 이번 diff 를 막을 사유는 아니다.

- **[INFO]** 에러 코드 재사용(`MEMBER_NOT_FOUND`)이 "진짜 부재"와 "동시 삭제 패자" 두 의미로 겹치는 것은 형제 패턴과 일치 — 신규 문제 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 게이트 `310`(`if (!member) this.throwMemberNotFound();`, `updateMemberRole` 경로) / 게이트 `838`(`removeMember` 의 `affected===0` 판정)
  - 상세: 같은 에러 코드가 "행이 원래 없었다" 와 "경합에서 졌다" 두 원인을 구분 없이 표현하는 것은 형제 다섯(#1369~#1372) 전부가 채택한 기존 관례이며, 이 PR 이 새로 만든 모호성이 아니다. 요청 검증(`ParseUUIDPipe`)·응답 봉투(`{data:{ok:true}}` / `{error:{code,message}}`)·URL 경로(`DELETE /api/workspaces/:id/members/:memberId`, RESTful 계층 구조 준수) 모두 이번 diff 로 바뀌지 않았고 컨벤션과 정합한다.
  - 제안: 없음.

## 요약

이번 diff 자체(무락 `findOne`+`remove(entity)` 를 원자적 `delete({id, workspaceId})`+`affected===0` 판정으로 교체)는 새 엔드포인트·새 요청 파라미터·새 응답 스키마를 도입하지 않으며, 요청 검증·인증 가드·URL 설계는 그대로다. API 계약 관점에서 관측 가능한 유일한 변화는 동시 `DELETE` 패자가 `200`→`404` 로 바뀌는 것인데, 이는 형제 다섯(#1369~#1372)과 동일한, 이미 3라운드 넘게 추적·문서화된 하위 호환성 변경(SPEC-DRIFT)이라 재차 차단 사유가 되지 않는다. 권한 검사 순서 문제 역시 API 응답 코드를 통한 정보 노출 소지가 있으나 이미 발견·등재·유예가 끝난 사안이다. 이번 리뷰에서 새로 확인한 지점은, `workspaces.controller.ts` 의 두 DELETE 핸들러(워크스페이스 삭제·멤버 제거)가 `spec/5-system/2-api-convention.md §6` 이 못박은 "204 No Content" 관례 대신 `200 {data:{ok:true}}` 를 쓰고 있고, 이것이 `removeMember` 하나만의 예외가 아니라 같은 컨트롤러 전체의 기존 패턴이라는 점이다 — 이번 PR 의 신규 e2e·plan 문서가 "형제 다섯은 전부 204" 라고 서술한 것은 실측(같은 형제인 `deleteWorkspace()` 도 200)과 어긋난다. 둘 다 이번 PR 을 막을 사유는 아니며, 다음 spec 정리 라운드에서 상태 코드 갈래를 함께 각주로 남길 것을 권한다.

## 위험도

LOW
