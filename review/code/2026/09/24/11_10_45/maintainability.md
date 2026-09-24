# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `where` 기반 mock 라우팅 로직이 서로 다른 `describe` 블록에 중복 등장한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1291-1303` (`records member.removed (mode=removed) on admin removeMember`) 및 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1492-1502` (`wireFindOne` 내부)
  - 상세: 두 자리 모두 "`opts.where.id` 가 대상 memberId 와 같은지로 요청자 role 조회와 대상 조회를 가른다"는 동일한 아이디어를 각자 구현한다. 전자는 `describe('audit logging (결정4=B)', …)`(라인 1164) 안에, `wireFindOne` 은 `describe('removeMember — 동시 제거', …)`(라인 1467) 안에 있어 스코프가 달라 직접 재사용은 불가능했던 것으로 보인다. 커밋 메시지·인라인 주석("형제 `wireFindOne` 과 같은 방식")이 이 관계를 명시해 의도가 분명하고, 각 구현이 5~12줄 수준으로 작아 당장 심각한 유지보수 부담은 아니다.
  - 제안: 이 파일의 `removeMember` 관련 mock 구성이 앞으로 더 늘어난다면, `where.id` 라우팅 로직을 파일 상단(모든 `describe` 밖)의 공용 헬퍼로 뽑아 두 블록이 같은 함수를 호출하도록 하면 향후 재배치 시 두 곳을 동시에 고칠 필요가 없어진다. 지금 스코프에서는 선택적 개선.

- **[INFO]** 같은 `describe` 블록 내에서 mock 구성 스타일이 혼재한다 (order-coupled vs where-routed)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `describe('audit logging (결정4=B)', …)` 블록 안, `records member.invited …`(1224-1254)·`records member.role_changed …`(1256-1284)는 여전히 `mockResolvedValueOnce().mockResolvedValueOnce()` 호출-순서 결합 패턴을 쓰고, 바로 다음 `records member.removed …`(1286-1303)만 `mockImplementation` where-라우팅으로 바뀌었다.
  - 상세: 이번 PR의 근거(주석)는 "`removeMember`의 조회 순서가 바뀌어 순서-결합 mock이 깨졌다"는 것으로, 이 한 테스트만 고친 것은 합리적이다. 다만 같은 블록의 나머지 두 테스트(`addMemberByEmail`, `updateMemberRole`)도 서비스 코드의 `findOne` 호출 순서가 바뀌면 동일한 방식으로 깨질 수 있는 잠재적 취약점을 그대로 가지고 있어, 한 파일 안에 두 가지 mock 관용구가 공존하게 됐다.
  - 제안: 지금 당장 리팩터링할 필요는 없으나, 이후 `addMemberByEmail`/`updateMemberRole`의 조회 순서를 건드리는 PR이 있다면 같은 where-라우팅 방식으로 전환하는 것을 고려할 것.

- **[INFO]** `removeMember`의 신규 인가 분기 앞에 놓인 주석 블록이 매우 길다 (실질 코드 2줄 대비 주석 12줄)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:819-832` (`requesterRole` 조회 및 `throwNotAMember()` 분기), `codebase/backend/src/modules/workspaces/workspaces.service.ts:843-850` (admin/owner 판정 순서)
  - 상세: 보안에 민감한 순서 결정의 배경(왜 `assertAdmin`을 맨 앞에 둘 수 없는지, 가드 계층이 이 라우트를 막지 못하는 이유, 쿼리 중복 방지)을 상세히 남긴 것은 이 파일 전체의 기존 컨벤션(예: DELETE 원자성 설명, `listMembers`의 프로젝션 설명)과 일치하며, 이런 종류의 순서 의존적 보안 로직은 향후 재배치 실수를 막기 위해 이 정도 문서화가 오히려 바람직하다. 다만 함수를 처음 읽을 때 코드 흐름을 스킵하며 훑기는 어려워진다.
  - 제안: 현 상태 유지 가능. 추가 조치 불필요 — 기존 파일 스타일과 일관됨.

- **[INFO]** 리뷰 대상에 포함된 `plan/in-progress/*.md`, `review/consistency/**` 파일들은 코드가 아닌 계획·리뷰 산출물이다
  - 위치: `plan/in-progress/member-auth-order.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/consistency/2026/09/24/10_22_24/*`
  - 상세: 가독성·네이밍·함수 길이·중첩·매직 넘버·중복·복잡도·일관성이라는 본 점검 관점은 실행 코드를 전제로 하므로 이 문서들에는 적용하지 않았다. 문서 자체의 구조(체크리스트·표·인용)는 프로젝트의 plan lifecycle 컨벤션(`CLAUDE.md`, `.claude/docs/plan-lifecycle.md`)을 따르고 있어 특이사항이 없다.
  - 제안: 없음 (범위 외 명시).

## 요약

핵심 변경(`workspaces.service.ts`의 `removeMember` 인가 순서 재배치, 신규 `throwNotAMember`/`throwAdminRequired` private 헬퍼 추출, `workspaces.service.spec.ts`/`workspace-rbac.e2e-spec.ts`의 대응 테스트)은 유지보수성 관점에서 전반적으로 양호하다. 에러 메시지 리터럴을 헬퍼로 뽑아 기존 `throwMemberNotFound`/`throwCannotRemoveOwner` 선례를 그대로 따랐고, 헬퍼 배치 위치(첫 사용처 직후·다음 사용처 직전)도 일관적이다. 테스트는 순서-결합 mock을 where-기반 mock으로 교체해 향후 재배치에 더 강건해졌으며, 각 테스트에 "무엇을 보호하는지"와 "왜 이 판별력이 필요한지"를 밝히는 docblock이 충실히 달려 있어 회귀 방지 의도가 코드에 남는다. 발견된 사항은 모두 INFO 수준으로, 서로 다른 `describe` 스코프에 유사한 mock 라우팅 로직이 중복되는 점과 한 블록 안에 두 가지 mock 관용구가 공존하는 점 정도이며 둘 다 즉시 조치가 필요한 결함은 아니다. 코드 자체의 분기 수·중첩 깊이·네이밍은 기존 파일 컨벤션 범위 안에 있다.

## 위험도

LOW
