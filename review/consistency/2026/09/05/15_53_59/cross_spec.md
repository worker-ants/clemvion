# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 배경

- 이번 라운드의 `spec/5-system/**` 델타는 **0개 파일**(정상 — 이 브랜치는 spec 을 바꾸지 않았다).
- 프롬프트 번들의 `## 구현 변경 사항` 섹션은 예산에 잘려 본문이 없었다. 이에 따라
  `git diff origin/main -- codebase/ spec/` 를 워킹트리에서 직접 실행해 실제 변경분을
  확인했다: **9개 파일 / 1101줄** (`codebase/backend/src/modules/audit-logs/audit-logs.service.ts`,
  `audit-logs.spec.ts`, 신규 `execution-response.dto.spec.ts` · `response-contract.ts` ·
  `response-contract.spec.ts`, 및 4개 e2e 스펙). `spec/` 변경은 없다.
- 변경 내용은 (1) `AuditLogsService.findAll` 이 `User` 엔티티 전 컬럼을 응답에 실어보내던
  유출을 3필드(`id`/`name`/`email`)로 좁히는 보안 수정, (2) 응답 1건을 생성된 OpenAPI
  스키마와 대조하는 `§5.4` 런타임 검증기(`response-contract.ts`) 신설 및 4개 e2e/1개 unit
  스펙 배선이다. 이 diff 는 이미 `review/code/2026/09/05/15_31_41` 코드 리뷰와
  `review/consistency/2026/09/05/15_31_43` cross-spec 라운드를 거쳤고, 그 두 라운드가 낸
  WARNING 2건(자매 필드 `workspace` 미차단, `ExecutionDto` 스키마 가드 부재)은 커밋
  `5fcb5c625` 에서 이미 반영됐다.

## 발견사항

이번 라운드에서 신규로 제기할 CRITICAL/WARNING 은 없다. 아래는 확인 결과와 잔존 INFO 다.

- **[INFO]** §5.4 신규 검증 인프라가 spec `code:` frontmatter 에 미등재 (기존 추적 항목, 재확인만)
  - target 위치: 해당 없음(spec 델타 0)
  - 충돌 대상: `spec/5-system/2-api-convention.md` frontmatter `code:` (§5.4 를 정의하는 SoT), `spec/conventions/swagger.md` frontmatter `code:`
  - 상세: 신규 `codebase/backend/src/shared/testing/response-contract.ts`(+ 기존 `swagger-probe.ts`)는 §5.4(부재 표현 규칙)를 **런타임으로 시행**하는 유일한 코드인데, 두 spec 문서의 `code:` 목록 어디에도 등재돼 있지 않다(직접 grep 확인, 0건). `swagger.md` 는 이미 유사 계층(`repo-guards/__tests__/swagger-dto-contract*.ts`, 선언 레벨 정합성 가드)을 등재하고 있어 등재 관례상 비대칭이 남는다.
  - 재확인: 이 항목은 새로 발견한 것이 아니다 — 직전 라운드(`review/consistency/2026/09/05/15_31_43`)가 동일 지적을 냈고, RESOLUTION 은 "developer 는 `spec/` 쓰기 권한이 없다"는 이유로 `plan/in-progress/spec-draft-nullable-notation-followups.md:297`(체크박스 미완, planner 소유)에 등재하는 것으로 처분했다. 실측: 그 라인은 지금도 `- [ ]` 미완 상태로 남아 있어 처분 그대로 유효하다 — 재발이 아니라 지속.
  - 제안: 새 조치 불요. 다음 `project-planner` 턴에서 `spec-draft-nullable-notation-followups.md` 의 해당 체크박스를 처리할 때 `2-api-convention.md`(및 필요시 `swagger.md`) frontmatter 에 `codebase/backend/src/shared/testing/**` 를 함께 등재.

## 확인했으나 충돌 없음으로 판정한 항목

- **데이터 모델**: `AuditLogListItem`(`Omit<AuditLog, 'user'|'workspace'> & { user: Pick<User,'id'|'name'|'email'> | null }`) 은 기존 `AuditLogUserDto`(`id`/`name`/`email` 3필드, `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`)와 정확히 일치한다. 새 엔티티·필드 선언 없음.
- **API 계약**: 엔드포인트·메서드·요청/응답 shape 변경 없음 (`GET /api/audit-logs` 의 `user` 필드 값 범위만 좁혔고, DTO 선언은 무변경).
- **`AuditLogDto.user` 의 `@ApiPropertyOptional({ nullable: true })`(optional+nullable 조합)** 은 §5.4 상 선언 레벨 위반이지만, 이 diff 가 만든 것이 아니라 기존 drift 다(`spec-draft-nullable-notation-followups.md` 의 78곳 중 `AuditLogDto` 8곳에 포함, 트래커 기재 확인). `response-contract.ts` 자신의 JSDoc 도 이 조합을 "판정 대상 아님(선언 층의 문제)"으로 명시해 책임 경계를 스스로 밝히고 있어 계층 책임 충돌 없음.
- **요구사항 ID**: 신규 ID 부여 없음.
- **상태 전이**: 해당 없음 — audit log 조회 경로 변경, 상태 머신 무관.
- **RBAC**: `AuditLogsController` 의 `@Roles('admin')` 가드 무변경. §4.2 "관리자(Admin+)만 조회" 와 여전히 일치.
- **계층 책임**: `response-contract.ts`(런타임 값-대-선언 검증)와 기존 `repo-guards/__tests__/swagger-dto-contract-guard.ts`(정적 데코레이터-대-TS타입 검증)의 역할 분담이 `response-contract.ts` JSDoc 안에서 명시적으로 교차 참조되어 중복·충돌 없이 상호보완 관계로 설계돼 있음을 코드에서 직접 확인.
- **`data-flow/1-audit.md` §2.1** "응답에 actor `user` join 포함"은 필드 수를 명시하지 않는 일반 서술이라 이번 좁히기와 모순되지 않는다.

## 요약

이번 라운드의 실제 구현 변경(9파일)은 spec `5-system` 어느 문서도 건드리지 않았고, 내용도 §5.4·§4.1/§4.2(감사 로그)와 이미 정의된 DTO 계약(`AuditLogUserDto`)에 정확히 부합하는 보안 버그 수정 + 테스트 하드닝이다. 신규 검증 인프라(`response-contract.ts`)는 기존 정적 가드(`swagger-dto-contract-guard`)와 책임을 명시적으로 분담해 계층 충돌이 없으며, 남은 유일한 문서화 간극(spec `code:` frontmatter 미등재)은 이미 planner 소유 백로그 항목으로 추적 중이라 이번 라운드가 새로 조치할 것은 없다. Cross-spec 관점에서 이 변경분이 다른 영역과 모순을 일으킬 지점은 발견되지 않았다.

## 위험도

NONE
