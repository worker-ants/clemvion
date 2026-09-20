# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `TriggerResourceReleasePort.lockParentAndListTriggerIds` 반환 시그니처 변경(`Promise<string[]>` → `Promise<LockedParentTriggers>`) — 내부 계약이지만 호출자 전수 확인 완료
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:175-178` (인터페이스 선언), 구현은 `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:81-109`
  - 상세: `grep -rn "lockParentAndListTriggerIds\|TRIGGER_RESOURCE_RELEASER"` 로 backend 전체를 훑은 결과, 이 포트를 소비하는 곳은 `workflows.service.ts:273`(`workflows.service.ts:280-287`에서 `locked.parent`/`locked.triggerIds` 사용)와 `workspaces.service.ts:524`(`{ triggerIds: ids }` 구조분해)뿐이며 두 곳 모두 새 반환 형태에 맞춰 갱신됐다. 관련 spec 파일(`trigger-resource-releaser.service.spec.ts`, `workflows.service.spec.ts`, `workspaces.service.spec.ts`)의 mock 도 전부 `{ parent, triggerIds }` 형태로 일치. 놓친 호출부는 없음 — 실제 위험은 낮으나, `ModuleRef.get(..., { strict: false })` 로 지연 해석하는 토큰이라 타입체크가 놓칠 수 있는 자리였고 plan 문서 자체가 "단위는 GREEN 인데 build 가 타입 오류로 잡았다"(`LockedParentTriggers` import 누락)를 실측으로 기록해 뒀다. 이 시그니처 변경의 blast radius 는 grep 으로 완전히 덮인다는 점을 기록해 둔다.
  - 제안: 조치 불요(이미 전수 갱신 확인). 향후 이 포트에 새 호출자가 추가될 때 이 반환 형태(`{ parent, triggerIds }`)를 전제하도록 JSDoc 이 이미 안내하고 있음.

- **[INFO]** 공개 API 응답 변화 — 동시 `DELETE /api/workflows/:id` 의 "패자" 요청이 `204`에서 `404`로 바뀜(의도된 수정)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `remove()` 메서드, `locked.parent === 'absent'` 분기
  - 상세: 이 변경은 이 PR 의 목적 그 자체(중복 감사 행 제거)이자 트리거 삭제 §4.4 의 기존 선례("두 번째 요청은 404")를 워크플로 삭제에 맞추는 것으로, `plan/in-progress/dup-delete-audit.md` 와 consistency-check(`review/consistency/2026/09/20/19_30_57`, BLOCK:NO)가 이미 검토·승인했다. 워크스페이스 삭제(`workspaces.service.ts`) 경로는 반환된 `parent` 필드를 쓰지 않고 기존 `assertWorkspaceDeletable` 잠금 재검사에 그 판정을 맡기는데, 그 재검사는 멤버십 조회(`!myMembership` → 403 `OWNER_REQUIRED`)를 워크스페이스 존재 조회보다 먼저 하므로, 동시 삭제로 `WorkspaceMember` 행이 CASCADE 로 함께 사라진 두 번째 요청은 404가 아니라 403을 받을 수 있다. 이는 이 diff 가 만든 게 아니라 `assertWorkspaceDeletable`의 기존 검사 순서(diff 밖)에서 이미 존재하던 비대칭이며, consistency-check INFO#5 도 "차단 사유 아님"으로 이미 표시했다.
  - 제안: 워크플로/워크스페이스 두 삭제 경로의 동시-삭제 응답 코드 비대칭(404 vs 403)은 이번 PR 스코프 밖이므로 조치 불요. 향후 대칭화가 필요하면 별도 planner 항목으로.

- **[INFO]** 신규 파일 생성은 모두 plan/review 산출물 — 애플리케이션 코드의 예상치 못한 파일시스템 부작용 없음
  - 위치: `plan/in-progress/dup-delete-audit.md`, `review/consistency/2026/09/20/19_30_57/*`
  - 상세: 이번 diff 에서 새로 생성된 비-코드 파일은 프로젝트 컨벤션(plan 라이프사이클·consistency-check 산출물 저장 규칙)이 요구하는 정규 산출물이며, 런타임 코드 경로가 파일시스템에 쓰는 동작은 없다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 `lockParentAndListTriggerIds` 가 잠금 뒤 읽은 부모 행의 존재 여부(`parent: 'present' | 'absent'`)를 더는 버리지 않고 호출자에게 돌려주는 것이며, 이 인터페이스(반환 시그니처) 변경의 모든 소비처(`workflows.service.ts`, `workspaces.service.ts`, 관련 spec mock 3곳)가 grep 으로 확인한 결과 빠짐없이 새 형태에 맞춰 갱신되어 있다. `trigger-resource-releaser.service.ts` 의 구현부는 기존에 이미 실행되던 동일한 `manager.findOne` 호출의 반환값을 추가로 캡처하는 것뿐이라 새로운 쿼리·락·외부 호출·전역 상태 변경은 없다. 워크플로 삭제 경로에서 `parent: 'absent'` 시 `NotFoundException` 을 던지는 것은 트랜잭션을 롤백시켜 감사 기록·비밀 정리 호출을 건너뛰게 하는 의도된 부작용이며, 트랜잭션 밖에서 먼저 실행되는 외부 자원 해제(`releaseExternalForParent`)의 중복 실행은 이 PR 이전부터 있던 기지의 잔여 이슈로 plan 문서가 스코프 밖으로 명시했다. 새로 생성된 파일은 전부 plan/review 규약이 요구하는 산출물이고, 환경 변수·네트워크 호출·이벤트/콜백 관련 새로운 부작용은 발견되지 않았다.

## 위험도

LOW
