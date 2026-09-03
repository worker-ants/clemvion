# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 대상 정정

Payload 는 target 을 `spec/5-system/` 로 지정했으나, 실제 diff-base(`origin/main...HEAD`)의
코드 변경은 `plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 3 이다 —
TypeORM 엔티티 6개(`AuditLog.ipAddress`, `AuthConfig.ipWhitelist`(엔티티+응답 DTO),
`Edge.condition`, `Folder.parentId`/`parent`, `WorkflowVersion.changeSummary`,
`WorkspaceMember.joinedAt`)의 TS 타입을 `nullable: true` DB 컬럼에 맞춰 `| null` 로
넓히고, `folders.controller.ts`/`folders.service.spec.ts`/`auth.service.spec.ts` 의
불필요해진 이중 캐스트를 제거한 것이다. `spec/5-system/` 자체는 이 diff 로 1줄도 바뀌지
않았다(scope 델타 0, plan frontmatter 도 `spec/1-data-model.md`·`spec/data-flow/10-triggers.md`·
`spec/5-system/2-api-convention.md` 를 **후속 planner 턴** 대상으로만 명시). 이하는 이
코드 변경이 `spec/5-system/` 및 `spec/1-data-model.md`(관련 영역)와 상충하는지를 점검한 결과다.

## 점검 결과

### 데이터 모델 충돌 — 없음 (오히려 정합화)

diff 가 넓힌 6개 필드의 nullability 는 `spec/1-data-model.md` 가 이미 `?` 로 문서화해 둔
것과 **전부 일치**한다:

| 필드 | 코드(변경 후) | `spec/1-data-model.md` |
|---|---|---|
| `AuditLog.ipAddress` | `string \| null` | §2.18 `ip_address \| String?` |
| `AuthConfig.ipWhitelist` | `string[] \| null` | §2.17 `ip_whitelist \| String[]?` |
| `Edge.condition` | `Record<string, unknown> \| null` | §2.7 `condition \| JSONB?` |
| `Folder.parentId`/`parent` | `string \| null` / `Folder \| null` | §2.5 `parent_id \| UUID?` |
| `WorkflowVersion.changeSummary` | `string \| null` | §2.15 `change_summary \| String?` |
| `WorkspaceMember.joinedAt` | `Date \| null` | §2.3 `joined_at \| Timestamp?` |

즉 이번 diff 는 **타입이 spec 을 따라잡은 것**이지 spec 과의 새 모순을 만들지 않는다.

### API 계약 충돌 — 없음 (규약 그대로 준수)

`AuthConfigDto.ipWhitelist` 가 `@ApiPropertyOptional({ type: [String], nullable: true,
example: [] })` + `ipWhitelist?: string[] | null` 로 바뀐 것은
[`spec/5-system/2-api-convention.md §5.4`](../../../../../../spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략)
의 "`null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`"
규칙 및 [`spec/conventions/swagger.md §1-3`](../../../../../../spec/conventions/swagger.md#1-3-optional-필드)
과 문언까지 정확히 일치한다. §5.4 는 "소급 적용 대상 아님 — 앞으로 도입·**변경되는**
필드에 적용" 이라 명시하는데, 이 diff 가 바로 그 nullability 를 변경하는 커밋이므로
규약 적용 대상이 맞다(plan 본문도 같은 근거를 인용해 이 필드 1건만 조치했다고 밝힘).
endpoint·HTTP method·다른 필드의 request/response shape 은 변경되지 않았다.

`folders.controller.ts` 의 `dto as Partial<Folder>` 캐스트 제거는 컨트롤러→서비스 인자
타입만 좁힌 것으로, `UpdateFolderDto`(이미 `parentId: string | null`)와 서비스 시그니처
간 계약 변경은 없다.

### 요구사항 ID / 상태 전이 / RBAC / 계층 책임 충돌 — 해당 없음

이번 diff 는 신규 요구사항 ID·상태 머신·권한 모델을 도입하지 않는다. 계층 책임(컨트롤러가
DTO 를 그대로 서비스에 전달)도 기존 패턴을 유지한다. `spec/5-system/1-auth.md`(RBAC §3),
`spec/5-system/3-error-handling.md`(에러 코드) 등 다른 5-system 하위 문서와 이 diff 사이에
연결점이 없다.

### 참고 — plan 이 이미 위임한 별도 후속 (본 검토의 신규 발견 아님)

`entity-nullable-column-type-mismatch.md` 는 아래 두 항목을 **planner 턴 필요**로 자체
위임해 두었다(§할 일). 본 검토에서 재확인만 하며, 새 결함으로 등록하지 않는다:

- `spec/1-data-model.md §2.9` `next_run_at` 이 `Timestamp`(non-`?`)로 오기돼 있음 — DB 는
  원래 `nullable: true`. plan 이 이미 후속 항목으로 명시.
- `spec/5-system/2-api-convention.md §2.2` 명명 규칙에 `/api/auth/*` 액션 네임스페이스
  예외 조항 누락 — plan 이 이미 후속 항목으로 명시, 이번 diff 와 무관한 선재 gap.

## 요약

이번 diff 는 6개 TypeORM 엔티티(+1개 응답 DTO)의 TS 타입을 DB 실제 nullability 및
`spec/1-data-model.md` 가 이미 문서화한 `?` 표기에 맞춰 넓히는 순수 타입 정합화이며,
`AuthConfigDto.ipWhitelist` 의 `nullable: true` 선언은 `spec/5-system/2-api-convention.md
§5.4`·`spec/conventions/swagger.md §1-3` 규약과 정확히 일치한다. 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 `spec/5-system/` 또는
`spec/1-data-model.md` 와의 모순을 발견하지 못했다. plan 이 자체적으로 위임해 둔 두 건의
선재 spec 오탈자/gap(§2.9 `next_run_at`, §2.2 `/api/auth/*` 네임스페이스)은 이 diff 가
새로 만든 것이 아니라 기존에 있던 것이며, planner 턴이 별도로 처리할 사안이다.

## 위험도

NONE
