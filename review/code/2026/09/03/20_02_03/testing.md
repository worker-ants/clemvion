# 테스트(Testing) 리뷰

## 검증 수행 내역

- `codebase/backend/src/modules/workspaces/workspaces.controller.ts:402` (`i.invitedBy` 그대로 통과) 를 실제로 확인함 — plan 문서의 인용과 일치.
- `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:31` 에서 `invitedBy: string | null` 을 확인 — DTO 의 `invitedBy?: string | null` 과 정합.
- `jest workspaces.controller.spec.ts` 를 원본 그대로 실행 → **14 passed, 14 total**.
- 뮤테이션 재현: `workspaces.controller.ts:402` 를 `invitedBy: i.invitedBy ?? ''` 로 임시 수정(원본은 scratch 로 `cp` 백업) 후 재실행 → **정확히 1 failed(“…코어션 없이 그대로 싣는다”) / 13 passed**, 대조군(“살아 있으면 그 id 를 싣는다”)은 GREEN 유지. plan 문서(`entity-nullable-column-type-mismatch.md`)가 적은 “실측 1 failed / 13 passed” 주장과 **일치함을 직접 재현으로 확인**.
- 원복: `cp` 로 원본 복구 후 `git status --short`/`git diff --stat` 로 무변경 확인, 이어서 원본 상태로 재실행해 14/14 통과 재확인. 저장소에 잔여물 없음.
- `main.ts` 에 `ClassSerializerInterceptor`/전역 `ValidationPipe` 가 없음을 확인 — `WorkspaceInvitationDto`/`ApiPropertyOptional` 은 Swagger 문서 메타데이터일 뿐이고 실제 응답은 컨트롤러가 손으로 구성한다. 즉 이번 diff 의 런타임 동작을 검증하는 유일한 지점은 컨트롤러 유닛 테스트이며, 새로 추가된 테스트가 정확히 그 지점을 캐너리로 고정하고 있다.
- `workspace-invitations.service.spec.ts` 에 `invitedBy: null`/`invitedByName: null` 케이스가 이미 존재함을 확인(서비스 레벨은 기존에 커버, 이번 diff 는 컨트롤러 레벨의 신규 커버리지).

## 발견사항

- **[WARNING]** 신규 `listInvitations` 테스트 2건에 서비스 호출 인자 검증이 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:71`-`85`, `:88`-`102` (describe `listInvitations`)
  - 상세: 같은 파일의 다른 5개 describe 블록(`update`/`remove`/`leave`/`transferOwnership`)은 전부 `expect(service.X).toHaveBeenCalledWith(...)` 로 서비스에 전달되는 인자를 검증하는데, 이번에 신설된 `listInvitations` 블록은 결과값(`result.data[0].invitedBy`)만 검증하고 `invitations.listPending` 이 `('ws-1', user.sub)` 로 정확히 호출됐는지는 검증하지 않는다. 이 핸들러가 테스트를 갖는 것은 이번 diff 가 처음이므로, `workspaceId`/`user.sub` 순서가 바뀌거나 잘못된 인자가 전달되는 회귀를 이 스위트가 못 잡는다.
  - 제안: 두 테스트 중 하나에 `expect(invitations.listPending).toHaveBeenCalledWith('ws-1', user.sub);` 를 추가해 파일 내 기존 관례와 맞춘다.

- **[INFO]** `listInvitations` 에 대해 예외 전파(에러 경로) 테스트가 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:60`-`103` (describe `listInvitations`)
  - 상세: 파일 내 다른 모든 describe 블록은 happy-path 1건 + 예외 전파(`ForbiddenException`/`NotFoundException` 등) 1건 이상의 짝을 이루는데, `listInvitations` 는 happy-path 변형 2건(null/non-null)만 있고 `invitationsService.listPending` 이 거부(예: 비-admin 요청자에 대한 `ForbiddenException`, 서비스의 `assertAdmin`)했을 때의 전파는 검증되지 않는다. 컨트롤러가 단순 await/return 이라 실패 가능성은 낮지만, 파일의 다른 5블록과의 스타일 일관성 관점에서 갭이다.
  - 제안: `invitations.listPending.mockRejectedValue(new ForbiddenException(...))` 케이스 1건을 추가해 패턴을 통일한다(선택 사항, 이번 diff 의 핵심 관심사는 아님).

- **[INFO]** FK `ON DELETE SET NULL` 을 실제 DB 로 관통하는 e2e/통합 테스트는 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:70`-`85` (mock 기반), 대응 e2e 부재 — `codebase/backend/test/app.e2e-spec.ts` 에는 `GET .../invitations` 호출이 없음(grep 확인)
  - 상세: 이번 변경의 동기가 된 실제 시나리오(초대자 계정 삭제 → `invited_by` NULL 로 cascade)는 유닛 테스트에서 `invitedBy: null` 을 목으로 주입해 컨트롤러 통과 동작만 고정한다. FK cascade 자체(DB 레벨)나 HTTP 전 구간(직렬화 포함)을 관통하는 e2e 는 없다. Swagger 메타데이터가 런타임에 영향을 주지 않음(위 검증 참고)을 감안하면 비용 대비 낮은 우선순위이나, 회귀 시 최종 안전망이 유닛 mock 뿐이라는 점은 인지해 둘 만하다.
  - 제안: 필수는 아님. 추후 워크스페이스 초대 e2e 스위트를 만들 때 "초대자 계정 삭제 후 목록 조회" 시나리오를 포함하는 것을 고려.

- **[INFO]** DTO `invitedBy?:`(optional key) vs FE 계약(`invitedBy: string | null`, non-optional) 의 표기 불일치
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:109`-`110` vs `codebase/frontend/src/lib/api/workspaces.ts:154`
  - 상세: 컨트롤러가 항상 `invitedBy` 키를 채워 보내므로(무조건 `i.invitedBy` 매핑) 런타임 갭은 없다. 이 불일치는 이미 plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`)의 "후속(planner 턴) — §5.4 의 `field?:` 표기와 기존 선례가 어긋난다" 항목으로 추적 중이므로 이 리뷰에서 별도 조치를 요구하지 않는다(재-flag 불필요, 이미 추적됨을 확인).

## 요약

핵심 diff(3파일)는 `WorkspaceInvitationDto.invitedBy` 를 nullable 로 정정하고, 그 근거가 되는 컨트롤러 통과 동작(코어션 없이 `null` 을 그대로 싣는다)을 캐너리 테스트 2건(null 케이스 + 대조군)으로 고정한다. 이 테스트들은 직접 뮤테이션(핸들러에 `?? ''` 삽입)으로 재현·검증했을 때 plan 문서가 주장한 "1 failed / 13 passed" 그대로 재현되었고, 대조군은 GREEN 을 유지해 분기를 실제로 가른다 — vacuous test 가 아니다. 테스트 docstring 도 왜 이 테스트가 필요한지, 무엇을 깨야 RED 가 되는지를 명시해 가독성·의도 전달이 우수하다. 다만 이 핸들러에 대한 첫 테스트 커버리지임에도 서비스 호출 인자 검증과 예외 전파 케이스가 파일 내 다른 5개 describe 블록과 달리 빠져 있어(WARNING 1 + INFO 1) 완성도에 소소한 여지가 있고, 실제 DB FK cascade 를 관통하는 e2e 는 없다(선택적 INFO). 회귀 위험은 낮고 기존 12개 테스트는 영향받지 않는다(14/14 통과, 원본 상태로 재확인 완료). 리뷰 과정에서 저장소에 남긴 임시 변경은 `cp` 로 완전히 원복했고 `git status --short` 로 클린 상태를 확인했다(리뷰 산출물 디렉터리의 untracked 파일 제외).

## 위험도

LOW
