# 정식 규약 준수 검토 — convention_compliance

> 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
> `spec/5-system/` 자체의 스코프 델타는 0파일이므로(정상 — 코드 전용 PR), 본 검토는
> 실제 구현 diff(`codebase/backend/**` 12파일 / ~1,400줄, `User` 엔티티 컬럼 노출 방어)가
> `spec/conventions/**` 의 정식 규약(특히 `swagger.md`)을 따르는지를 대상으로 한다.
> 프롬프트 번들이 예산 절단으로 `<git diff>`·`spec/conventions/**` 본문을 대부분 생략했으므로,
> `git diff origin/main...HEAD -- 'codebase/**' 'spec/**' 'plan/**'` 와 각 `spec/conventions/*.md`
> 를 직접 절대경로로 읽어 실측했다.

## 발견사항

- **[WARNING]** `WorkspaceMemberDto.joinedAt` JSDoc 이 공개 OpenAPI `description` 에
  내부 서사를 그대로 싣는다
  - target 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    `WorkspaceMemberDto.joinedAt` (이번 diff 신규 필드)
  - 위반 규약: [`spec/conventions/swagger.md` §3](spec/conventions/swagger.md)
    "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다" (2026-09-05 규약화, 이 필드
    추가(2026-09-06)보다 먼저 성립)
  - 상세: 해당 필드의 `/** ... */` 블록 전체가
    "그래서 §5.4 **기본형**(`@ApiProperty` + `nullable: true`)이지 키 생략형이 아니다",
    "`nullable` 은 **스키마를 따른 것**이지 현행 코드의 도달 가능한 상태가 아니다 — 실측
    (2026-09-06): `workspace_member` 행을 만드는 네 자리가 전부 `joinedAt: new Date()` 로
    즉시 채운다" 처럼 **내부 규약 적용 근거·실측 날짜·내부 서비스 동작**을 담고 있다.
    `nest-cli.json` 의 `introspectComments` 플러그인이 이 JSDoc 을 그대로 공개 OpenAPI
    `description` 으로 내보내므로, API 소비자가 몰라도 되는 내부 구현 서사가 그대로
    노출된다. `swagger.md` §3 자체가 이 정확한 위반을 이미 한 번(`alert-rule-response.dto.ts`
    `threshold` 필드, `--impl-done 20_05_42` W1) 겪고 규약화했는데, 같은 형태가 하루 뒤
    신규 필드에서 재발했다.
  - 제안: JSDoc 은 소비자가 이 필드를 쓰기 위해 알아야 하는 최소 정보만 남기고(예:
    "멤버가 워크스페이스에 합류한 시각. 상시 존재하며 값이 없으면 `null`."), "왜 이
    필드가 §5.4 기본형인지"·"현재 코드상 null 이 도달 불가능하다는 실측"·
    `WorkspacesService.listMembers` 내부 구현 언급은 바로 위 `//` 주석으로 옮긴다.
    `alert-rule-response.dto.ts` `threshold` 필드가 이미 이 분리를 적용한 정본 예시다.

- **[WARNING]** `User` 엔티티 노출 방어 신규 검출 2축이 `swagger.md`/`2-api-convention.md`
  의 "두 검증자" 등재에서 빠져, 두 문서의 서술이 이제 사실과 다르다 (단, 이미 추적·유예됨)
  - target 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
    (+ `user-entity-exposure.spec.ts`), `codebase/backend/src/shared/testing/user-secret-absence.ts`
    (+ `.spec.ts`) — 이번 diff 신규 파일
  - 위반 규약: [`spec/conventions/swagger.md` §5-1](spec/conventions/swagger.md#5-1-응답-dto-위치)
    의 콜아웃(*"그 축은 런타임 짝인 `response-contract.ts` 가 문다… 두 검증자의 경계는
    API 규약 §5.4 검증 층이 소유한다"*)과 [`spec/5-system/2-api-convention.md` §5.4
    "검증 층"](spec/5-system/2-api-convention.md) 표(*"그 자리를 **두 검증자**가 나눠
    맡는다"*) — 두 문서 모두 "정확히 두 검증자"(`swagger-dto-contract-guard.ts` 선언↔선언,
    `response-contract.ts` 값↔선언)만 등재·양쪽 `code:` frontmatter 에 교차 등재하라고
    직접 지시한다.
  - 상세: 이번 PR 은 `User` 엔티티 노출을 막는 **제3의 축**(`user-entity-exposure-guard.ts`
    — TypeORM 쿼리 구성(`relations`/`select`/`*JoinAndSelect`) 정적 AST 스캔, 선언과도
    무관하고 실행도 필요 없음)과 **제4의 축**(`user-secret-absence.ts` —
    응답 바디를 이름 기반으로 깊이 훑는 런타임 부재 단언, 선언과 무관)을 신설했다. 두
    파일 모두 `spec/conventions/swagger.md`·`spec/5-system/2-api-convention.md` 의 `code:`
    frontmatter 어디에도 없고, 두 문서 본문의 "두 검증자" 서술도 갱신되지 않았다 —
    `grep -rn "user-entity-exposure\|user-secret-absence" spec/` 0건으로 확인.
  - **이미 추적됨**: 이 정확한 갭은 developer 자신이 실측해 `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 에 두 개의 미체크 후속 항목으로 등재했다
    (`review/consistency/2026/09/06/10_13_23` W1 인용, "5개 checker 중 4개가 독립 보고").
    `spec/conventions/**` 쓰기는 `project-planner` 소관이라 developer 가 직접 고치지
    않은 것은 워크플로 상 올바른 처신이다 — 즉 이 항목은 **새 결함이 아니라 다음
    planner 턴에서 §5.4「검증 층」과 두 문서 `code:` 에 신규 축 2행을 추가해야 하는
    확정된 미완 항목**이다. 본 리포트는 그 사실을 재확인·재확증한다.
  - 제안: 이번 PR 자체를 막을 사유는 아니다 — 다음 `project-planner` 턴에서
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 두 항목을
    집행할 것. 집행 시 "두 검증자" 같은 **개수 고정 문구**를 다시 쓰지 말고(플랜이
    스스로 지적함 — 축이 늘 때마다 숫자가 또 낡는다) 표로 나열하는 형태를 권고.

- **[INFO]** `User` 민감 7컬럼 응답 비노출 불변식의 SoT 가 코드에만 있다 (이미 추적됨)
  - target 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts`
    `USER_SECRET_KEYS` 배열
  - 위반(엄밀히는 공백) 규약: [`spec/conventions/secret-store.md` §1.1`](spec/conventions/secret-store.md)
    이 Trigger·AuthConfig 계열에 대해서는 "비대상 필드도 응답 바디에는 나가지 않는다" 를
    규범 문장으로 세워 두었는데, `User` 엔티티에는 대응하는 절이 없다.
  - 상세: 이번 PR 은 이 불변식을 코드(`USER_SECRET_KEYS` 배열 + 두 가드)로만 못박았다.
    같은 갭이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도
    미체크 항목("`User` 민감 7컬럼의 응답 노출 금지를 규약 문장으로", 2026-09-06 등재,
    `review/consistency/2026/09/06/10_13_23` W2 인용)으로 이미 등재돼 있다.
  - 제안: 다음 planner 턴에서 `spec/1-data-model.md §2.1` 또는 `spec/conventions/
    secret-store.md §1.1` 에 7컬럼 비노출을 규약 문장으로 명시하고 두 가드를 그 절의
    `code:`/본문 링크로 연결. 결정 근거(전수 열거 수치·기각 대안)는 plan/CHANGELOG 에서
    해당 spec 문서 `## Rationale` 로 옮긴다.

## 정합성이 확인된 부분 (참고)

- `user-entity-exposure-guard.ts` 는 "파서 순수 로직 vs 소비 spec 분리" 패턴을 형제 가드
  (`nullable-type-lie-cast-guard.ts`·`swagger-dto-contract-guard.ts`)와 동일하게 따른다.
  `user-relation-load.fixture.ts` 도 기존 `optional-nullable.fixture.ts` 와 같은
  `repo-guards/__tests__/fixtures/*.fixture.ts` 명명 패턴을 따른다 — 명명 규약 위반 없음.
- `workflow-versions.service.spec.ts` 의 신규 `CreatorProbeController` + `buildSwaggerDocument`
  /`schemasOf` 사용은 `swagger.md` 가 `code:` 로 지목한 `shared/testing/swagger-probe*.ts`
  패턴을 그대로 재사용 — 기존 확립된 패턴과 일치.
- 신규 e2e 3건(`audit-logs`·`workflow-crud`·`workspace-rbac`)은 `assertMatchesContract`
  + `contractForDto` (선언 대조)와 `expectNoUserSecrets` (이름 대조) 두 축을 함께 걸어
  `swagger.md` §5-1 이 요구하는 "엔티티를 그대로 노출하지 말 것"의 실질 검증 의도와 부합한다.
  두 축의 실행 순서(이름 축을 먼저)까지 근거를 남겨 결정을 설명한 점도 확인됨.
  `workflow-version-response.dto.ts` 의 `creator?: WorkflowVersionCreatorDto | null`
  (optional + nullable 동시 표기, §5.4 상 이론적으로는 애매한 조합)은 이번 PR 이
  건드리지 않은 기존 선언이라 §5.4 의 "소급 적용 대상 아님" 조항에 따라 이번 리뷰의
  신규 위반으로 보지 않았다.

## 요약

이번 diff(`User` 엔티티 컬럼 노출 방어 — 정적 AST 가드 + 런타임 이름 기반 가드 + 관련 e2e
3건 + `WorkflowVersionsService` 투영 수정)는 스스로 conventions 를 광범위하게 인용·준수하려는
의도가 뚜렷하고(§5.4, `response-contract`/`swagger-probe` 패턴, 파서/spec 분리 관례 재사용
등), 실제 위반은 크지 않다. 다만 (1) 신규 `joinedAt` DTO 필드의 JSDoc 이 하루 전 막 성문화된
"JSDoc 에 내부 서사 금지"(`swagger.md` §3) 규칙을 놓쳤고 — 이는 그 규칙이 만들어진 계기와
동일한 패턴의 재발이라 별도로 고쳐야 하며, (2) 신규 2축 검출기가 `swagger.md`/
`2-api-convention.md` 가 "두 검증자" 로 못박은 등재·경계 서술을 갱신하지 않아 두 문서가
이제 사실과 다르다 — 다만 이 갭은 developer 가 이미 실측해 plan 에 두 항목으로 정확히
등재하고 정당한 사유(§`spec/` 쓰기 권한 부재)로 planner 턴에 위임해 둔 상태라 이번 PR 의
결함이라기보다 확정된 후속 작업이다. 전체적으로 이 PR 자체가 새로 만든 미등재 규약 위반은
(1) 하나뿐이며, 나머지는 이미 인지·추적된 문서 후속 작업이다.

## 위험도

LOW
