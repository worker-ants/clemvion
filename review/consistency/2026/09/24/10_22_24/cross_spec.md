# Cross-Spec 일관성 검토 — `spec/5-system` (impl-prep: `member-auth-order`)

## 검토 범위와 제약

본 검토는 `plan/in-progress/member-auth-order.md` (`removeMember()` 의 인가 순서를
대상 조회보다 앞으로 옮기는 처방, `spec_impact: none`) 의 `--impl-prep spec/5-system` 게이트용
번들을 대상으로 한다. **번들 자체가 컨텍스트 예산 초과로 심하게 축소됐다** — `spec/5-system/*`
17개 중 3개(`3-error-handling.md`·`1-auth.md`·`2-api-convention.md`)만 전문이 실렸고 나머지
14개는 생략, "관련 spec 본문" 절도 108개 파일 중 `spec/0-overview.md`·`spec/data-flow/12-workspace.md`
2개만 전문이고 나머지(`spec/2-navigation/9-user-profile.md` 포함 — target 문서 자신이 RBAC
근거로 인용하는 파일)는 전부 생략됐다. 아래 발견사항은 **실제 로드된 5개 파일**을 근거로 하며,
생략된 파일과의 충돌 여부는 확인 불가로 남는다(과거 유사 사례: `--spec` 모드의 예산 누락).

## 발견사항

- **[INFO]** `NOT_A_MEMBER` 카탈로그의 예시 경로 열거가 새 발행처를 언급하지 않는다
  - target 위치: `spec/5-system/3-error-handling.md:49`("전환 `/switch`·탈퇴·멤버십 확인 경로")·`:230`("전환·탈퇴 경로의 `NOT_A_MEMBER`(403)는 §1.2")
  - 충돌 대상: 처방 대상인 `DELETE /api/workspaces/:id/members/:memberId`(`WorkspacesService.removeMember`) — [`spec/data-flow/12-workspace.md` §1.6](../../../../../../spec/data-flow/12-workspace.md)
  - 상세: 처방이 구현되면 `removeMember` 가 비-멤버 요청자에게 `403 NOT_A_MEMBER` 를 새로 발행한다. 카탈로그 설명은 발행 모듈을 `auth.service`·`workspaces.service` 로 이미 포괄적으로 적어 두어 **의미상 모순은 아니나**, 예시 경로 열거(전환·탈퇴)에는 "멤버 제거" 가 없어 새 발행처가 카탈로그 예시와 불일치하게 보일 수 있다. 직접 모순(CRITICAL)은 아니고 예시 목록의 완결성 문제.
  - 제안: `member-auth-order.md` §E 가 이미 "`NOT_A_MEMBER` 카탈로그 설명의 경로 열거에 이 자리를 추가하는 것" 을 developer 권한 밖으로 인지하고 planner 항목으로 등재하겠다고 명시했다 — 그 계획대로 planner 턴에서 `3-error-handling.md:49`·`:230` 두 곳 모두(§1.2 본문 + §1.9 하단 note) 예시를 갱신하면 해소된다. 이번 --impl-prep 게이트를 막을 사안은 아니다.

- **[INFO]** 처방의 서비스 레이어 멤버십 체크가 "멤버십 검증은 가드 1곳에서" 중앙화 결정의 적용 범위 밖임을 확인 — 모순 아님
  - target 위치: `member-auth-order.md` §B("`assertMembership`/`assertAdmin` 이 각각 `getMemberRole` 호출")·§E("13개 라우트 축은 이 PR 이 닫지 않는다")
  - 충돌 대상: [`spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)"](../../../../../../spec/data-flow/12-workspace.md)
  - 상세: 이 rationale 은 `RolesGuard` 가 **`@WorkspaceId()` 로 헤더 워크스페이스 컨텍스트를 소비하는 라우트**에서 멤버십 검증을 가드 1곳으로 수렴시킨 결정이며, 스스로 적용 범위를 "워크스페이스 컨텍스트를 소비하는 인증된 라우트" 로 명시하고 `:id` 경로 파라미터는 "리소스 지목이지 인가 판정의 입력이 아니다" 라고 별도로 구분한다. `removeMember` 는 `@Param('id')` 를 쓰는 라우트라 이 rationale 의 적용 범위 **밖**이다. 따라서 처방이 서비스 레이어에 멤버십 체크(`getMemberRole`)를 두는 것은 "가드 1곳" 결정과 직접 충돌하지 않는다 — 오히려 그 결정이 커버하지 못하는 잔여 표면(경로 파라미터 워크스페이스 라우트, 17개 중 13개 무보호)의 존재를 재확인할 뿐이다.
  - 제안: 이 교차 확인 자체는 액션이 필요 없다. 다만 `member-auth-order.md` §E 가 이 잔여 표면("13-라우트 축")을 별 항목으로 등재하겠다고 이미 명시했으므로, 그 후속 planner/developer 항목이 실제로 이 rationale 을 인용하며 스코프를 정의하도록 연결해 두면 두 문서(플랜·spec) 간 참조가 끊기지 않는다.

- **[INFO]** RBAC·에러 카탈로그 자체는 정합 — 참고용 대조 결과
  - target 위치: `spec/5-system/1-auth.md` §3.2 각주("Admin 멤버 삭제의 대상 제약 … `CANNOT_REMOVE_OWNER`")
  - 충돌 대상: `spec/data-flow/12-workspace.md` §1.6 (`DELETE /api/workspaces/:id/members/:memberId` 행, "owner / admin … owner 는 제거 불가")
  - 상세: 두 문서 모두 "owner 는 제거 대상이 될 수 없다" · "본인 제거는 `leaveWorkspace` 로 위임" 을 동일하게 기술하며 모순 없음. `member-auth-order.md` 가 인용한 "12-workspace.md:141 은 권한을 owner/admin 으로만 규정" 도 실제 파일과 대조해 정확했다(§A 실측 검증됨). 처방(비-멤버 요청자에 `403 NOT_A_MEMBER`)은 두 문서 어느 쪽의 "owner/admin 만 호출" 의도와도 배치되지 않는다 — 새 응답은 그 의도를 오히려 더 분명히 집행한다.
  - 제안: 없음(참고용, 문제 아님).

## 요약

로드된 5개 spec 파일(`3-error-handling.md`·`1-auth.md`·`2-api-convention.md`·`data-flow/12-workspace.md`·`0-overview.md`) 범위 안에서는 `removeMember` 인가 순서 처방과 직접 모순되는 CRITICAL 항목이 없다. `NOT_A_MEMBER` 카탈로그 예시 미열거와 "가드 1곳" 결정의 적용 범위 문제는 둘 다 플랜(`member-auth-order.md` §E)이 스스로 인지하고 planner/후속 항목으로 명시적으로 미뤄 둔 사안이라 이번 게이트를 막을 근거가 되지 않는다. 다만 번들 예산 초과로 target 문서 자신이 인용하는 `2-navigation/9-user-profile.md` 를 포함해 관련 spec 108개가 생략됐으므로, 이 검토는 "생략분과 무충돌" 을 보증하지 않는다 — 좁은 스코프(`spec_impact: none`, 코드 전용 변경)라는 플랜의 성격상 실무 리스크는 낮다고 판단한다.

## 위험도

LOW
