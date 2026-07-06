# 정식 규약 준수 검토 — spec/data-flow/8-notifications.md

검토 모드: --impl-done (scope=spec/data-flow/8-notifications.md, diff-base=origin/main)
구현 변경 사항 SoT: `/Volumes/project/private/clemvion/.claude/worktrees/hopeful-wozniak-a22f76` (HEAD 워킹트리)

## 검토 배경

이번 diff 는 `background_failed` 알림의 딥링크(resource_type/resource_id=workflow)와
per-run attribution(신규 `background_run_id` 컬럼, migration V107)을 분리하는 변경이다.
target 문서(`spec/data-flow/8-notifications.md`)와 관련 코드(migration, entity, DTO, service,
processor, execution-engine)를 `spec/conventions/**` 의 명명·출력 포맷·문서 구조·API 문서·금지
항목 관점에서 대조했다.

## 발견사항

- **[INFO]** `select: false` 패턴이 코드베이스 최초 도입이나 conventions 문서에 미등재
  - target 위치: 코드 `codebase/backend/src/modules/notifications/entities/notification.entity.ts:52-58` (`backgroundRunId` 컬럼)
  - 위반 규약: 없음 (해당 패턴을 금지하거나 규정하는 `spec/conventions/**` 문서 부재)
  - 상세: "REST 미노출 내부 전용 컬럼" 을 위해 TypeORM `select: false` + JSDoc 주석으로 방어하는 패턴은 이 엔티티가 codebase 전체에서 최초 사례다 (`grep -rl "select: false" **/*.entity.ts` 결과 1건). 규약 위반은 아니지만, 향후 유사한 "attribution-only, REST 비노출" 컬럼이 또 생기면 이 패턴이 반복될 근거 문서가 없어 재발견 비용이 든다.
  - 제안: 규약 갱신을 원한다면 `spec/conventions/swagger.md` 또는 신규 짧은 절에 "REST 미노출 내부 컬럼은 `select: false` + 응답 DTO 미포함 이중 방어" 패턴을 명문화하는 것을 고려할 수 있다. 다만 현재 1건뿐이므로 즉시 규약화가 필수는 아니며, 두 번째 사례가 나올 때 승격해도 된다.

- **[INFO]** `NotificationDto.channel` enum 이 `'both'` 값을 문서화하지 않음 (이번 diff 범위 밖, 기존 결함)
  - target 위치: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts:53` `@ApiProperty({ example: 'in_app', enum: ['in_app', 'email'] })`
  - 위반 규약: `spec/conventions/swagger.md §1-4` (enum 필드는 실제 허용값을 정확히 표기) — 직접 위반이라기보다 정합성 갭
  - 상세: entity(`channel: string`, default `'in_app'`)와 spec 본문(`1-data-model.md §2.19`: `channel | Enum | in_app / email / both`)은 `'both'` 를 포함하는데, DTO 의 Swagger enum 목록에는 `'both'` 가 빠져 있다. 이번 PR 이 이 필드를 건드리지 않았으므로 이 diff 로 인해 발생한 결함은 아니지만, target 문서가 §5.1 등에서 `channel='both'` 를 실제로 발사한다고 서술하는 지점(`execution_failed`, `schedule_failed`, `team_invite`)과 Swagger 문서가 어긋나 있다는 점은 이번 검토에서 드러났다.
  - 제안: 이번 PR 의 필수 fix 대상은 아니나, 후속 PR 에서 `enum: ['in_app', 'email', 'both']` 로 갱신 권장.

## 준수 확인 (긍정 사례 — 참고용)

다음은 위반이 아니라 규약을 정확히 따른 사례로, 검토 과정에서 명시적으로 확인했다.

- **migration 명명·V번호 정책** (`spec/conventions/migrations.md §1-2`): `V107__notification_background_run_id.sql` 은 snake_case descriptor, 단조 증가(기존 max V106 → V107), gap 없음을 확인 (`ls migrations | grep V107`).
- **frontmatter 의무 대상 제외** (`spec/conventions/spec-impl-evidence.md §1`): `spec/data-flow/**` 는 frontmatter-evidence family 명시적 제외 대상이라, target 문서에 frontmatter 가 없는 것은 규약 위반이 아니다.
- **정보 저장 위치 원칙** (CLAUDE.md "정보 저장 위치"): 이번 PR 은 `spec/data-flow/8-notifications.md` (본문 갱신) 와 `spec/1-data-model.md §2.19` (엔티티 필드 갱신) 를 함께 갱신했고 Rationale 섹션(딥링크/attribution 분리 근거)도 문서 말미에 정확히 위치시켰다 — 3섹션 구성(Overview/본문/Rationale) 준수.
- **Swagger DTO 패턴** (`spec/conventions/swagger.md §1,§5`): `NotificationDto.resourceType`/`resourceId` JSDoc 갱신은 한국어 설명 + `@ApiPropertyOptional({ nullable, example, description })` 형식을 정확히 따르며, `description` 길이도 가이드라인(50~150자) 범위 내.
- **API endpoint/딥링크 계약 정합** (`spec/2-navigation/_layout.md §3.1`): target 문서가 인용하는 딥링크 매핑(`background_failed`→`/workflows/<resource_id>`, resource_id=workflow id)이 실제 `href.ts` 코드와 정확히 일치함을 확인.
- **명명 일관성**: `findByResource` → `findByBackgroundRun` 리네임이 서비스·spec·모든 호출부(`background-runs.service.ts`, 관련 `.spec.ts`, `executions.module.ts` 주석)에서 일관되게 적용됨 (구 이름의 잔존 참조 0건).

## 요약

target 문서(`spec/data-flow/8-notifications.md`)와 동반 구현은 명명 규약(migration V번호·snake_case, TypeORM 컬럼명), 출력 포맷 규약(Swagger DTO JSDoc·`@ApiPropertyOptional`), 문서 구조 규약(Overview/본문/Rationale, data-model과 data-flow 동시 갱신, frontmatter 제외 대상 정확 인지), API 문서 규약을 모두 정합하게 따르고 있다. CRITICAL/WARNING 급 위반은 발견되지 않았다. INFO 2건은 모두 이번 diff 의 직접적 결함이 아니라 (1) 새로 도입된 `select: false` 패턴의 규약 미문서화, (2) 이번 PR 범위 밖의 기존 `channel` enum 갭이며 즉시 조치를 요구하지 않는다.

## 위험도

NONE
