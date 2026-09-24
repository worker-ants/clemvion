# Cross-Spec 일관성 검토 — `spec/5-system` (impl-done, diff-base=origin/main)

## 조사 방법

`spec/5-system` 델타는 0파일(정상 — 이 브랜치는 spec 을 바꾸지 않는다, `spec_impact: none`). 실제 변경은 구현 diff 6파일(`workspaces.service.ts`/`.spec.ts`, `test/helpers/concurrency.ts`, `integration-rotate-concurrency.e2e-spec.ts`, `member-remove-concurrency.e2e-spec.ts`, `CHANGELOG.md`) + plan 파일 2건이다. HEAD 워킹트리에서 `git diff origin/main...HEAD`로 직접 diff 를 산출해 확인했으며(프롬프트 번들엔 diff 본문이 예산으로 잘려 있었음), 대응하는 `spec/data-flow/12-workspace.md`·`spec/5-system/1-auth.md`를 절대경로로 직접 읽어 대조했다.

핵심 변경: `WorkspacesService.removeMember()`의 owner 삭제 방지 가드가 무락 `findOne` 위에 있어 동시 `transferOwnership`과 경합하면 owner 가 삭제되는 TOCTOU 를, DELETE 문에 `role: Not('owner')` 술어를 추가해(새 락 도입 없이 EvalPlanQual 재평가에 의존) 원자화한 fix.

## 발견사항

- **[INFO]** `removeMember`의 owner 보호 메커니즘이 `data-flow/12-workspace.md`§1.6 에 미문서화 — 형제 셋과 비대칭
  - target 위치: `spec/5-system/1-auth.md` §3.2 각주(†) — "Admin 멤버 삭제는 대상이 Owner 인 경우 거부"만 서술, 메커니즘 언급 없음
  - 충돌 대상: `spec/data-flow/12-workspace.md` §1.6 (`:141` 부근 `DELETE /api/workspaces/:id/members/:memberId` 행 — "owner 는 제거 불가"만 적고 메커니즘 없음) vs 같은 표의 형제 행들(`:188` `deleteWorkspace` — 워크스페이스→멤버십 순 `pessimistic_write` 명시, `:189` `leaveWorkspace` — "비관적 락 트랜잭션 내에서 수행해 TOCTOU 방지" 명시, `transferOwnership` — 동일 잠금 순서 명시)
  - 상세: 이번 fix로 `removeMember`는 (deleteWorkspace/leaveWorkspace/transferOwnership 과 다른) **네 번째 메커니즘** — 새 락 없이 조건부 원자 `DELETE … WHERE role != 'owner'` + `affected` 판별 — 을 갖게 됐다. 세 형제는 spec 에 자신의 TOCTOU 방지 메커니즘이 명문화돼 있는데 이 자리만 없어, 다음에 이 표를 읽는 사람은 `removeMember` 가 여전히 무보호라고 오해할 수 있다. 실제 모순(문서가 틀렸다고 단언 가능한 문장)은 없다 — §1.6 은 결과("owner 는 제거 불가")만 적고 메커니즘을 규정하지 않으므로 이 fix 와 직접 모순되지는 않는다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-24 등재, planner·낮음 우선순위)에 `data-flow/12-workspace.md:141` 인근에 각주로 메커니즘을 명문화하는 후속 항목이 등록돼 있다. 신규 조치 불요 — 기존 추적 확인만.

- **[INFO]** `CANNOT_REMOVE_OWNER`(및 자매 코드 `OWNER_ROLE_PROTECTED`·`SOLE_OWNER_CANNOT_LEAVE`)가 중앙 에러 카탈로그 미등재
  - target 위치: `spec/5-system/1-auth.md` §3.2 각주, `spec/data-flow/12-workspace.md` §1.6
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.9 (자매 코드 `CANNOT_ASSIGN_OWNER` 는 등재돼 있음) / `spec/5-system/2-api-convention.md` §5.3 (신규 에러 코드 카탈로그 등재 의무)
  - 상세: 이번 diff 가 새로 만든 코드는 아니며(`CANNOT_REMOVE_OWNER`는 기존 가드에서 그대로 유지, 이번엔 재조회 경로에서 재사용될 뿐) 이 fix 로 새로 생긴 문제는 아니다. 다만 이 fix 가 해당 코드의 발행 경로(재조회 backstop)를 하나 늘려 코드의 표면적 중요도가 커졌다.
  - 제안: 이미 같은 followups 플랜에 planner·낮음 우선순위로 등재됨(§1.9 인접 등재 처방 포함) — 신규 조치 불요.

- **[INFO]** `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스가 각주 삽입으로 두 조각 렌더링(GFM 표 파손)
  - target 위치: `spec/5-system/1-auth.md` 366~391행
  - 충돌 대상: 없음(포맷 결함, 타 spec 과의 모순 아님)
  - 상세: 이번 diff 와 무관한 기존 결함이나, 같은 `--impl-prep` 라운드(`07_29_15`)에서 발견돼 이번 작업 트래커에 편입됐으므로 완전성을 위해 재확인차 기록.
  - 제안: 이미 등재됨 — 신규 조치 불요.

## 신규 충돌 없음 확인

- **데이터 모델**: `WorkspaceMember.role` 스키마·상태는 변경 없음. `Not('owner')` 는 조회 조건일 뿐 엔티티 정의를 바꾸지 않는다.
- **API 계약**: `DELETE /api/workspaces/:id/members/:memberId` 의 status/error shape(`403 CANNOT_REMOVE_OWNER` · `404 MEMBER_NOT_FOUND`)는 기존 계약 그대로 — 재조회는 응답 코드 결정에만 쓰이고 새 응답 필드를 추가하지 않는다.
- **요구사항 ID**: 신규 요구사항 ID 없음.
- **상태 전이**: `workspace_member.role` 의 owner→admin(이양) / 삭제 전이 규칙은 §1.6 서술과 여전히 일치 — "owner 는 제거 불가"가 동시성 하에서도 참이 되도록 강화됐을 뿐 전이 규칙 자체는 바뀌지 않았다.
- **RBAC**: Admin+ 의 멤버 삭제 권한, owner 대상 예외 모두 `spec/5-system/1-auth.md`§3.2 각주와 일치. 권한 검사 순서(assertAdmin 이 owner 가드 뒤에 있음)는 이번 PR 의 의도적 비스코프(§F "하지 않는 것")이고 별도 트래커 항목으로 이미 열려 있다 — 이번 diff 가 새로 만든 문제가 아니다.
- **계층 책임**: `4-execution-engine.md`§8(타-행 집계 조건부 UPDATE + advisory lock)과 이번 자리(같은-행 조건 DELETE)의 차이를 코드 주석이 명시적으로 구분해 두어, 향후 리뷰어가 이번 패턴을 §8 패턴에 오적용하는 것을 막고 있다 — 계층 간 책임·패턴 경계가 spec 서술과 어긋나지 않는다.

## 요약

`removeMember()` owner TOCTOU fix 는 `spec/5-system`을 변경하지 않고(`spec_impact: none`), 기존에 spec 이 서술한 계약("Admin 의 멤버 삭제는 대상이 Owner 인 경우 거부된다")을 동시성 하에서도 참으로 만드는 순수 구현 강화다. Data model·API 계약·요구사항 ID·상태 전이·RBAC 어느 영역에서도 기존 spec 과 직접 모순되는 CRITICAL/WARNING 급 신규 충돌은 없다. 유일하게 실질적인 관찰은 `data-flow/12-workspace.md`가 형제 세 메커니즘(pessimistic lock)은 명문화하면서 이번에 확정된 네 번째 메커니즘(조건부 원자 DELETE)은 여전히 미문서화라는 비대칭인데, 이는 같은 작업의 `--impl-prep` 단계에서 이미 발견돼 planner 후속 트래커(저비용·낮은 우선순위)로 등재돼 있어 이번 완료를 막을 사유가 아니다.

## 위험도

LOW
