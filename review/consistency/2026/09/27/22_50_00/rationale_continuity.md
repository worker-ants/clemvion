# Rationale 연속성 검토 — spec/2-navigation/ (impl-done, cross-workspace-refs)

## 발견사항

- **[WARNING]** §3 Rationale 안에서 2026-07-05 원문 불릿이 2026-09-27 정정과 모순되는 채로 여전히 미표시
  - target 위치: `spec/2-navigation/1-workflow-list.md` 198행("**에러 코드**: 세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 동일한 `VALIDATION_ERROR` 를 재사용한다…") vs 201행("(2026-09-27 정정) 이 결정 뒤에도 **생성** 경로는 깊이만 봤다 — 다른 워크스페이스의 부모를 `getDepth` 가 «없음» 으로 읽어 깊이 1 로 통과시켰다")
  - 과거 결정 출처: 같은 문서 `## Rationale` §3 자체 — 2026-07-05 결정문과 2026-09-27 정정이 같은 절 안에 공존(직전 impl-prep 라운드 `review/consistency/2026/09/27/21_03_31/rationale_continuity.md` WARNING 2 에서 이미 동일 지점을 지적)
  - 상세: 198행은 "세 위반 모두 생성 경로와 동일한 VALIDATION_ERROR 를 재사용한다"고 적어, 위에서 아래로 읽는 독자에게 생성 경로가 이미 같은 워크스페이스 검사를 포함해 세 가지를 다 본다는 인상을 준다. 그런데 3행 아래 201행 정정은 "이 결정 뒤에도 생성 경로는 깊이만 봤다"고 명시적으로 반증한다. 이번 `--impl-done` 라운드에서 코드(`folders.service.ts`)를 확인한 결과 실제로는 정정 이후에야 생성 경로가 `assertParentInWorkspace` 로 워크스페이스 검사를 갖추게 됐다 — 즉 198행의 "재사용" 서술은 **사후적으로는** 참이 되었지만(현재 상태 기준 create·patch 모두 동일 `VALIDATION_ERROR` 를 쓴다), 문서 내부에서 "이미 그렇다"(198행, 2026-07-05 시점 서술)와 "그렇지 않았다"(201행, 2026-09-27 정정)가 취소선·각주 없이 나란히 남아 다음 독자·다음 PR이 이 Rationale 을 근거로 인용할 때 어느 시점 서술인지 혼동할 수 있다. 직전 라운드가 지적한 뒤에도 이번 diff(`git diff origin/main HEAD -- spec/2-navigation/1-workflow-list.md`)에는 198행에 대한 취소선·각주 수정이 없다.
  - 제안: 198행 불릿에 "(2026-09-27 이전엔 생성 경로가 워크스페이스를 보지 않았다 — 201행 정정 참고)" 각주를 붙이거나, "같은 워크스페이스" 부분만 취소선 처리해 정정 문단과 상호 참조시킨다.

- **[WARNING]** 새 "참조의 소속"(data-model §1.1) invariant 가, 이 저장소가 이미 확립한 "opt-in 호출부는 다음 자리에서 깨진다" 원칙과 거리감 있는 방식으로 구현됨
  - target 위치: `spec/2-navigation/1-workflow-list.md` 124·125·141·142행(§1.1 링크로 새 `folderId`/`parentId` 소속 검사를 규정) 및 그 근거 `spec/data-flow/12-workspace.md` "본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)" 절(450행 부근); 구현은 `codebase/backend/src/common/utils/reference-in-scope.ts`(신규 유틸)를 `folders.service.ts`·`workflows.service.ts`·`triggers.service.ts`·`schedules.service.ts`·`alerts.service.ts`·`nodes.service.ts`·`edges.service.ts` 7곳이 각자 수동으로 호출하는 형태
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` Rationale "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)" — **기각된 대안**: "73개 라우트에 `@Roles('viewer')` 부착"("opt-in 모델의 연장이라 74번째 라우트에서 재발"); 그리고 `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록의 `endpoint-path-conflict-wrap*.ts` 주석 — "§3 의 409 `RESOURCE_CONFLICT` 계약을 AST 로 강제한다: `endpointPath` 를 쓰는 `save()` 는 래핑돼야 한다"(같은 클래스의 위험에 정적 완전성 가드를 쓴 선례)
  - 상세: `data-flow/12-workspace.md` 의 새 Rationale 은 자신의 설계를 정당화하며 "읽는 자리마다 필터를 기대하는 것은 위 «멤버십 검증은 가드 1곳에서» 가 «74번째 라우트» 로 기각한 모양 그대로다 — 저장이 입구 하나다"라고 **명시적으로 그 선행 원칙을 인용**한다. 그런데 실제 구현은 "가드 1곳"(모든 요청이 무조건 통과하는 단일 미들웨어)이 아니라, 7개 서비스가 각자 `assertReferenceInScope`/`assertParentInWorkspace`/`assertFolderInWorkspace` 를 **수동으로 호출**하는 opt-in 패턴이다 — 정확히 "73개 라우트에 데코레이터 부착"이 기각된 이유("다음 자리에서 잊는다")와 같은 리스크 형태를, 라우트가 아니라 서비스 메서드 단위로 재현한다. 같은 계열 문서(`2-trigger-list.md`)의 `endpointPath` 사례는 이 정확한 위험(수동 호출 컨벤션은 자기 강제가 안 됨)에 대해 AST 기반 정적 가드(`endpoint-path-conflict-wrap*.ts`)로 "모든 `save()` 가 래핑됐는지"를 강제하는 선례를 남겼는데, 이번 참조-소속 invariant 에는 대응하는 정적 완전성 검증(AST 가드·DTO 데코레이터·TypeORM subscriber 등)이 없다 — `reference-in-scope.spec.ts` 는 유틸 함수 자체의 동작만 단위 테스트하고, 앞으로 추가될 8번째/9번째 호출부(예: 향후 새 참조 필드)가 이 유틸을 호출하는지 여부를 검증하지 않는다. `workflows.service.ts` 의 `manager.insert` 관련 주석("`@BeforeInsert` hook·cascade 를 건너뛴다")도 엔티티 훅으로 이 검사를 대체할 수 없음을 스스로 보여준다.
  - 제안: (a) `data-flow/12-workspace.md` Rationale 의 "저장이 입구 하나다" 문장에 "다만 그 입구는 서비스별 수동 호출이라 완전성은 코드 리뷰에 의존한다"는 한계를 명시하거나, (b) `endpointPath` 선례처럼 참조-소속 필드를 쓰는 `save()`/`insert()` 를 정적으로 스캔하는 repo-guard 테스트를 추가해 "가드 1곳" 원칙이 실제로 재현되게 한다.

- **[INFO]** 형제 spec 전파 누락(2-trigger-list.md 등)은 직전 라운드 지적 그대로 미해결 — cross-spec 동기화 소관에 더 가까움
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.5/§3(트리거 생성 `workflowId`), `spec/2-navigation/3-schedule.md`, `spec/2-navigation/9-user-profile.md` §6.3
  - 과거 결정 출처: `review/consistency/2026/09/27/21_03_31/rationale_continuity.md` WARNING 3(동일 지점, impl-prep 단계에서 이미 보고)
  - 상세: 이번 `--impl-done` 라운드에서 `triggers.service.ts` diff 를 직접 확인한 결과 `POST /api/triggers` 는 이제 `workflowId` 를 §1.1 규칙으로 검증해 400 `VALIDATION_ERROR`(`field='workflowId'`) 를 던진다(구현 완료). 그러나 `2-trigger-list.md`(§2.5 생성 다이얼로그, §3 API 표)는 이 검증·에러 코드·§1.1 링크를 여전히 서술하지 않는다 — 구현이 spec 을 앞질러 착지한 상태다. 이 항목은 Rationale 자체의 모순이라기보다 spec-코드 동기화 문제라 `cross_spec`/`plan_coherence` 리뷰어의 1차 소관에 더 가깝지만, 근거가 된 동일 결정(§1.1)이 관련되어 있어 기록해 둔다.
  - 제안: `2-trigger-list.md`/`3-schedule.md`/`9-user-profile.md` 의 `workflowId` API 서술에 §1.1 참조·400 케이스를 추가하거나, 별도 후속 plan 으로 추적한다.

## 요약

이번 `--impl-done` 검토에서 `spec/2-navigation/1-workflow-list.md` 는 기존 Rationale 이 명시적으로 기각한 대안을 다시 채택하거나 시스템 invariant 를 직접 위반하는 CRITICAL 은 없다. 다만 두 가지 연속성 리스크가 남아 있다 — (1) §3 Rationale 안에서 2026-07-05 원문과 2026-09-27 정정이 취소선·각주 없이 병존해 시점 혼동 여지가 있고(직전 라운드 지적이 이번 diff 에도 반영되지 않음), (2) 새로 도입된 "참조의 소속" invariant(§1.1)가 이 저장소가 명시적으로 정립한 "가드 1곳"/AST 완전성 가드 원칙을 스스로 인용하면서도, 실제로는 그 원칙이 요구하는 정적 완전성 보장 없이 7개 서비스의 수동 호출로만 구현되어 원칙과 거리감이 있다. 형제 spec(2-trigger-list.md 등)의 전파 누락은 직전 라운드부터 이어지는 별도 갭으로 참고 기록했다.

## 위험도

MEDIUM
