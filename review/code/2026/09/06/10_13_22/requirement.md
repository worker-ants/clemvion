# 요구사항(Requirement) 리뷰

## 발견사항

- **[CRITICAL]** `user-entity-exposure-guard` 의 판정 술어가 관계 **속성 이름**(`'user'`)으로만 걸어, 실제 `User` 타입 관계 중 이름이 다른 것(`creator`·`owner`)을 전부 놓친다 — 그 결과 이 PR 이 "전수 열거 후 3곳 다 안전 확인" 이라고 선언한 것과 달리, 이미 존재하는 4번째 자리가 **투영 없이 `User` 전체를 응답에 그대로 흘린다**.
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 의 `isUserRelationPath`(관계 경로의 마지막 세그먼트가 문자열 `'user'` 인지만 비교) 및 그것을 쓰는 `findUserRelationLoads`.
  - 상세: 저장소에 `@ManyToOne(() => User)` 관계가 6곳 있고, 그중 `Workflow.creator`(`codebase/backend/src/modules/workflows/entities/workflow.entity.ts:56`) · `Workspace.owner`(`codebase/backend/src/modules/workspaces/entities/workspace.entity.ts:36`) · `Integration.creator`(`codebase/backend/src/modules/integrations/entities/integration.entity.ts:136`) · `WorkflowVersion.creator`(`codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts:40`) 는 관계 속성 이름이 `user` 가 아니다. 가드는 관계의 **타입**이 아니라 문자열 `relations: [...]`/`leftJoinAndSelect(...)` 인자의 **마지막 세그먼트 문자열**만 보므로 이 넷은 스캔 대상 밖이다.
    실제로 `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:71-77` 의 `findOne`(`GET /workflows/:wfId/versions/:versionId` — 컨트롤러 `workflow-versions.controller.ts:67-81` 이 반환값을 가공 없이 그대로 리턴)이 `relations: ['creator']` 로 `User` 를 **투영 없이** 통째로 로드하고, `select` 를 전혀 걸지 않는다. 같은 서비스의 자매 메서드 `findByWorkflow`(`:47-63`, `GET /workflows/:wfId/versions` 목록)는 `relations: { creator: true }` + `select: { creator: { id, name, email } }` 로 정확히 투영하는데, 상세 조회 쪽만 투영이 빠져 있다.
    `User` 엔티티에 `select: false`/`@Exclude()`/전역 `ClassSerializerInterceptor` 가 전부 0건(CHANGELOG·PR 본문 실측 그대로, 직접 grep 재확인)이고 `TransformInterceptor`(`codebase/backend/src/common/interceptors/transform.interceptor.ts`)는 `{data: ...}` 로 감싸기만 할 뿐 필드를 걷어내지 않으므로, `version.creator` 는 `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 을 포함한 `User` 전체 컬럼을 그대로 JSON 응답(`data.creator.*`)에 실어 워크스페이스 멤버 누구에게나(같은 워크플로우가 속한 워크스페이스의 다른 멤버 포함) 노출한다. 이 엔드포인트를 때리는 e2e 도 없어(grep 확인: `test/*.ts` 중 `versions/` 를 다루면서 `creator` 필드 형태를 검증하는 곳 없음) 지금 이 순간에도 발견되지 않는다.
    즉 이 PR 의 핵심 산출물(양방향 래칫 + 이름 기반 부재 단언)이 방어하려는 바로 그 결함 클래스(감사 로그 26키 유출과 동일 계열)가, 그 방어 도입 직후에도 다른 파일에 그대로 남는다 — "전수 열거" 방법론(관계 이름 `user` 기준 grep)이 원리적으로 이름이 다른 `User` 관계를 못 본다는 뜻이므로, CHANGELOG/plan 의 "3곳, 다 안전(코드 확인)" 서술은 부정확하다.
  - 제안: `findUserRelationLoads` 의 판정을 관계 **속성 이름**이 아니라 관계의 **선언된 타입**(엔티티의 `@ManyToOne/@OneToOne/@ManyToMany(() => User)` 데코레이터 인자)에 대응시키도록 넓힌다 — 최소한 저장소 전체의 `=> User)` 관계 속성 이름을 한 번 열거해(`user`·`creator`·`owner` 등) 그 집합을 `isUserRelationPath` 가 참조하게 하거나, TypeScript `Program`/`TypeChecker` 로 관계 프로퍼티의 실제 타입을 확인한다. 병행해서 `workflow-versions.service.ts#findOne` 에 `findByWorkflow` 와 동일한 `select: { creator: { id: true, name: true, email: true } }` 투영을 즉시 추가하고, `workspace-rbac.e2e-spec.ts`/`audit-logs.e2e-spec.ts` 와 같은 패턴으로 `expectNoUserSecrets` e2e 캐너리를 그 엔드포인트에도 배선한다.

- **[WARNING]** `workspace-rbac.e2e-spec.ts` 에 테스트 식별자 `F.` 가 두 번 쓰인다 — 새로 추가한 테스트와 기존 테스트가 같은 문자를 공유해, 파일이 일관되게 지켜 온 "테스트마다 고유 알파벳 식별자"(A, S, B, C, D, E, F, G, H, I) 관례가 깨진다.
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 새 테스트 `it('F. GET /:id/members — 멤버 목록에 \`User\` 비밀 컬럼이 실리지 않는다', ...)`(diff 라인 287, `D.` 테스트와 `E. transfer-ownership` 테스트 사이에 삽입)와 기존 `it('F. sole owner 는 leave 불가 — 403 SOLE_OWNER_CANNOT_LEAVE', ...)`(diff 라인 382, 파일 안에서 더 아래).
  - 상세: 파일의 다른 모든 테스트는 A/S/B/C/D/E/F/G/H/I 로 한 문자씩 유일하다(리뷰·PR 코멘트 등에서 "테스트 F" 라고 인용할 때 참조 대상이 모호해진다). 새 테스트를 `D.` 뒤에 끼워 넣으면서 다음 미사용 문자(예: `J.`)를 쓰지 않고 이미 쓰인 `F.` 를 재사용했다.
  - 제안: 새 테스트의 식별자를 `J.`(또는 파일 끝의 다음 미사용 문자)로 바꾼다.

- **[WARNING]** 이번에 신설한 두 검증자(`user-entity-exposure-guard.ts`/`.spec.ts`/`fixtures/user-relation-load.fixture.ts`, `user-secret-absence.ts`/`.spec.ts`)가 어떤 spec 문서의 `code:` frontmatter glob 에도 걸리지 않는다 — 이 저장소가 같은 plan 문서 안에서 이미 두 번(§5.4 검증자 2종 등재, 래칫 canary fixture 등재) 반복해서 고친 것과 같은 클래스의 사각지대다.
  - 위치: `spec/5-system/2-api-convention.md`(frontmatter `code:`, `swagger-dto-contract*.ts`/`response-contract*.ts`/`swagger-probe*.ts` 만 등재) · `spec/conventions/swagger.md`(동일) · `spec/conventions/secret-store.md`(`secret-store/**` 만 등재) — 세 문서 모두 `repo-guards/__tests__/user-entity-exposure*`·`shared/testing/user-secret-absence*` 를 커버하지 않음(직접 grep 확인).
  - 상세: `spec-code-paths.test.ts` 가드 자체는 빌드를 막지 않지만(글롭이 다른 파일에 매치하는 한 통과), `code:` 등재가 없으면 이 두 파일을 고쳐도 `--impl-done` SPEC-CONSISTENCY 게이트가 관련 spec 을 재검토 대상으로 못 잡는다. 리뷰 대상 plan 문서(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 자신이 "§5.4 검증자 2종의 역할 경계를 spec 본문에 한 문장으로"·"§5.4 검증자 code: 등재"·"§5.4 래칫 canary fixture 를 code: 에 등재" 를 이미 별도 체크박스로 걸어 두고 완료 처리한 선례가 있는데, 이번 `User` 엔티티 방어 항목은 "완료" 로 닫으면서도 같은 후속을 등재하지 않았다.
  - 제안: 코드 자체는 developer 권한 안이라 문제 없으나, spec 등재는 `spec/` 쓰기이므로 developer 가 직접 하지 않는다. 다만 이 plan 문서에 자매 항목들과 같은 형태의 planner 후속 bullet("`user-entity-exposure-guard*`/`user-secret-absence*` 를 §5.4 검증 층 표 + `code:` 에 등재")을 남기지 않은 것은 문서 완결성 공백이다 — 다음 planner 턴 착수 전에 이 bullet 을 추가할 것을 권한다.

- **[INFO]** `findUserRelationLoads` 는 TypeORM 의 `relations: { user: true }`(object 형) 문법을 인식하지 못한다 — 오직 배열 리터럴(`relations: [...]`)과 `leftJoinAndSelect`/`innerJoinAndSelect` 두 형태만 본다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 의 `findUserRelationLoads` (1) 분기 — `ts.isArrayLiteralExpression(node.initializer)` 조건.
  - 상세: 현재 저장소에서 `relations: { user: true }`(또는 그 변형이 `'user'` 를 가리키는) 실사용은 없어(직접 grep 확인) 지금 당장의 false negative 는 아니지만, object-form 자체는 이미 다른 곳(`workflow-versions.service.ts`)에서 실사용 중이라 다음에 누군가 `relations: { user: true }` 를 쓰면 이 가드는 조용히 통과시킨다. 위 CRITICAL 항목과 근본 원인이 같다(구조 형태 매칭이 열거식이라 원리적으로 닫히지 않는다).
  - 제안: CRITICAL 항목 수정과 함께 object-form 관계 표기도 같은 로직 경로로 흡수한다.

## 요약

이 PR 이 신설한 두 축(구조 기반 `user-entity-exposure-guard` + 값 기반 `user-secret-absence`)은 각각 독립적으로는 잘 구현돼 있다 — 단위 테스트 16개가 실제로 green 이고(직접 실행 확인), 3곳 베이스라인 문자열이 실제 코드와 정확히 일치하며(grep 대조), `WorkspaceMemberDto.joinedAt` 추가는 §5.4 "기본형" 규칙과 line-level 로 일치한다(엔티티 nullable 컬럼·서비스가 무조건 싣는 필드·DTO `@ApiProperty({nullable:true})` + non-optional 타입이 모두 일치). 다만 핵심 결함이 하나 있다 — `isUserRelationPath` 가 관계 **이름**이 `user` 인지만 보고 관계의 **타입**이 `User` 인지는 보지 않아서, 저장소에 실재하는 `creator`/`owner` 이름의 `User` 관계를 전부 놓치고, 그중 최소 한 곳(`WorkflowVersionsService.findOne` → `GET /workflows/:wfId/versions/:versionId`)이 지금 이 순간에도 `User` 전체(비밀번호 해시·2FA 복구 코드·계정 탈취 토큰 포함)를 투영 없이 응답에 흘리고 있다. 이는 이 PR 이 막으려는 바로 그 유출 클래스이며, PR 이 스스로 주장하는 "전수 열거 후 3곳 다 안전" 이라는 결론을 무효화한다. 부수적으로 새 e2e 테스트 식별자 중복(`F.` 두 번)과, 신설 검증자의 spec `code:` 미등재(같은 plan 문서가 반복적으로 스스로 고쳐 온 습관과 불일치)가 있다.

## 위험도

CRITICAL
