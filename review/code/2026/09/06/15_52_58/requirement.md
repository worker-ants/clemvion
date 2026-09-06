# 요구사항(Requirement) 리뷰

## 개요

이 diff(`origin/main...HEAD`)는 `User` 엔티티 컬럼 노출을 잡는 검출 3축(구조 축
`user-entity-exposure-guard.ts`, 이름 축 `user-secret-absence.ts`, JSDoc 인용 축
`dto-jsdoc-citation-guard.ts`) 신설과, 그 과정에서 발견한 실제 Critical
(`WorkflowVersionsService.findOne` 의 `creator` 미투영 유출), 트리거 `endpoint_path`
UNIQUE 충돌의 `2-trigger-list.md §3` 계약 미이행 수정, `pg-error.ts` SoT 확장, 그리고
harness `review_guard.py` frontmatter `code:` 파서의 entry-유실 버그 수정으로 구성된다.
이미 11차례의 `/ai-review`+`/consistency-check` 라운드(`10_13_22`→…→`15_30_59`)를 거치며
누적 지적이 대부분 해소된 상태이고, 직접 코드·spec·테스트를 대조한 결과 핵심 계약은
아래 CHANGELOG 건 하나를 제외하면 spec·구현·테스트 3자가 line-level 로 일치한다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 본문이 실제로 구현한 필드명과 다른 필드명(`subCode`)을 그대로 남겨 자기 문서 안에서도 모순된다
  - 위치: `CHANGELOG.md:153` (`` `details: { field: 'endpoint_path', subCode: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 를 싣는다 `` 문장)
  - 상세: 트리거 `endpoint_path` UNIQUE 충돌 시 실제 코드(`codebase/backend/src/modules/triggers/triggers.service.ts` 의 `rethrowEndpointPathConflict`)와 테스트(`triggers.service.spec.ts` 의 `rejects.toMatchObject({ response: { details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' } } })`)는 세부 코드를 `details.code` 키에 싣는다. 그런데 `CHANGELOG.md:153` 은 여전히 `details.subCode` 라고 서술한다. 커밋 이력을 추적하면(`git log -p -- CHANGELOG.md`) 이 문장은 `a185846a5` 커밋이 처음 썼고, 그 직후 `0fd4d2f29` 커밋이 **몇 줄 아래의 인용문(blockquote, 현재 `CHANGELOG.md:160-166`)만** `details.code` 로 정정하면서 본문 문장(`:153`)은 고치지 않고 남겼다. 그 결과 같은 파일 안에서 "`subCode` 를 싣는다"(153행)와 "세부 코드는 `details.code` 다"(161행)가 정면으로 모순되고, 실제 wire 는 후자다. CHANGELOG 는 다음 개발자·프런트엔드 소비자가 API 계약을 확인하는 1차 자료라, 이 문장만 보고 `details.subCode` 로 클라이언트 파싱 로직을 짜면 실제 응답과 어긋난다.
  - 제안: `CHANGELOG.md:153` 의 `subCode` 를 `code` 로 정정한다(코드·테스트·spec 은 이미 올바르므로 문서만 맞추면 된다). `developer` 권한 범위 내 CHANGELOG 수정이라 `spec/` 승인 절차와 무관하다.

- **[INFO]** (검증 완료, 조치 불요) 핵심 요구사항·spec 계약이 line-level 로 일치함을 직접 확인
  - `spec/2-navigation/2-trigger-list.md:164` 의 `"409 RESOURCE_CONFLICT (세부 코드 TRIGGER_ENDPOINT_PATH_CONFLICT, details.field='endpoint_path')"` ↔ `triggers.service.ts` 의 `rethrowEndpointPathConflict` 구현(`code: 'RESOURCE_CONFLICT'`, `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`) — 정확히 일치.
  - `spec/5-system/2-api-convention.md §5.4` 의 "`null`(키 present)=기본형, `@ApiProperty({nullable:true})`+`field: T|null`" 규칙 ↔ `workspace-response.dto.ts` 의 `WorkspaceMemberDto.joinedAt: string | null` + `@ApiProperty({nullable:true, type:String})` — 일치. `WorkspacesService.listMembers`/`workspace-invitations.service.ts`/`workspaces.service.ts`(2곳) 4자리 전부 `joinedAt: new Date()` 로 채운다는 주석 내용도 grep 으로 4건 확인.
  - `WorkflowVersionCreatorDto`(`id`,`name`,`email` 3필드) ↔ `CREATOR_PROJECTION`(`{id,name,email}`) ↔ `findOne`/`findByWorkflow` 의 `select.creator` — 3자 일치, 게다가 OpenAPI 스키마 대조 테스트(`workflow-versions.service.spec.ts` `CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto`)로 코드 레벨 고정.
  - `USER_SECRET_KEYS`(7컬럼) ↔ `user.entity.ts` 의 `@Column` 23개 중 `*Hash|*Secret|*Token|*RecoveryCodes` 패턴 컬럼 — 패턴 매칭 + 컬럼 수 카나리아(23) 양방향 테스트로 실측 확인.
  - `collectUserRelationNames` 파생 결과(`creator`,`executor`,`owner`,`user`) ↔ `*.entity.ts` 전수 grep(`: User`/`: User | null`) — 정확히 일치, 손 열거로는 놓쳤을 `Execution.executor` 까지 파생이 잡는다는 주석 주장도 실측대로다.

- **[INFO]** `listMembers` 의 구조적 갭(DB 투영이 아닌 JS 단 수동 매핑)은 이번 PR 범위 밖으로 명시 disclose 및 plan 후속 등재됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `listMembers` / 후속 항목: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`listMembers`를 DB 레벨 투영으로 옮긴다)
  - 상세: 구조 가드(`user-entity-exposure-guard`)는 로드 형태만 보므로 `relations:['user']` + 수동 매핑 형태는 원리적으로 보호 못 한다는 점, 안전망이 신규 단위 테스트 2건 + e2e `workspace-rbac` J. 뿐이라는 점이 주석·plan·CHANGELOG 세 곳에서 일관되게 disclose 돼 있다. 기능 결함이 아니라 의도적으로 유예된 구조 개선.
  - 제안: 조치 불요 — 후속 developer 턴에서 진행.

## 요약

핵심 요구사항(User 컬럼 노출 검출 3축 신설, `WorkflowVersionsService.findOne` Critical 유출 수정, 트리거 `endpoint_path` 충돌 계약 이행)은 spec·코드·테스트 3자가 실측 기준으로 정확히 일치하며, 엣지 케이스(빈 관계, 표면 2종 PG 에러, 인용 부호 포함 YAML 파싱, 반대 방향 대조군)도 촘촘히 테스트돼 있다. 11차례 리뷰 라운드를 거치며 지적된 항목은 코드 fix 또는 plan 후속 등재로 전부 처분됐음을 직접 대조로 확인했다. 유일하게 새로 발견한 결함은 `CHANGELOG.md` 본문이 트리거 충돌 응답의 세부 코드 키를 `subCode` 로 잘못 서술하고 있는 것으로(실제/테스트는 `code`), 같은 파일 안에서도 모순되는 순수 문서 결함이라 런타임 영향은 없지만 API 계약을 확인하는 1차 문서로서 정정이 필요하다.

## 위험도

LOW
