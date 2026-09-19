# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 재확인 (예산 절단 대응)

프롬프트가 번들한 "target 문서"는 `spec/2-navigation/2-trigger-list.md` · `3-schedule.md` 전문(트리거·스케줄 화면 spec, `PATCH /api/triggers/:id` · `enumName` 과 무관한 도메인)이었으나, 프롬프트 자신이 명시하듯 **scope(`spec/2-navigation`) 델타는 0개 파일**이다. 실제 "구현 diff: 9개 파일 / 320줄" 부분은 예산에 잘려 있었으므로, 지시에 따라 절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/entity-column-drift-b83f15`)에서 `git diff origin/main...HEAD`를 직접 재확인했다.

**실측 결과**: 이 브랜치(`entity-column-drift-b83f15`)의 실제 코드 diff는 spec/2-navigation(트리거·스케줄) 도메인과 전혀 무관하다. 실체는 TypeORM 엔티티 **컬럼 선언 ↔ 실제 DB 정합화**(`fix(entities): 컬럼 선언이 실제 DB 와 다른 아홉 곳`)와 그 가드를 컬럼 층으로 확장하는 테스트 추가다:

- `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts`
- `codebase/backend/src/modules/edges/entities/edge.entity.ts`
- `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts`
- `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts`
- `codebase/backend/src/modules/model-config/entities/model-config.entity.ts`
- `codebase/backend/src/modules/nodes/entities/node.entity.ts`
- `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts`
- `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts`
- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`
- (spec 쪽은 `plan/in-progress/entity-column-declaration-drift.md` 신설 + `spec-draft-nullable-notation-followups.md` 사실 정정 1건, `spec_impact: none`)

번들된 spec/2-navigation 본문은 이 diff와 겹치는 식별자가 전혀 없어(트리거/스케줄 도메인 vs 엔티티 컬럼 타입 선언) 아래 점검은 **실제 diff 기준**으로 수행했다.

## 발견사항

점검 관점 1~6(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로) 전부에 대해 실제 diff를 대조했다. **신규 식별자 충돌은 발견되지 않았다.**

- **엔티티/타입명 관점 — `enumName: 'edge_type'` / `enumName: 'node_category'` 추가는 충돌이 아니라 기존 DB 식별자 재사용**
  - target 신규 표기: `edge.entity.ts`(`enumName: 'edge_type'`), `node.entity.ts`(`enumName: 'node_category'`)
  - 기존 사용처: `codebase/backend/migrations/V001__initial_schema.sql:96` (`CREATE TYPE node_category AS ENUM (...)`), `:122` (`CREATE TYPE edge_type AS ENUM ('data', 'error')`)
  - 상세: 두 값은 새로 도입되는 이름이 아니라 V001에서 이미 만들어진 Postgres enum 타입 이름을 TypeORM 선언에 **뒤늦게 명시**한 것이다(이전엔 `enumName` 미지정이라 TypeORM이 `*_enum` 접미사로 잘못 추론했었다 — 이번 PR의 수정 대상 그 자체). 다른 의미로 이미 쓰이는 이름과의 충돌이 아니라 선언-DB 정합화.
  - 제안: 없음(정상).

- **엔티티/타입명 관점 — 신규 테스트 로컬 식별자 0-hit 확인**
  - target 신규 식별자: `UNDECLARED_COLUMNS`, `COLUMN_LEVEL`, `COLUMN_LEVEL_SAMPLES`, `isColumnLevel`, `dataSourceOptions` (모두 `entity-schema-declarations.e2e-spec.ts` 신규)
  - 기존 사용처: 없음 — `grep -rn` 으로 `codebase/backend/src`·`codebase/backend/test` 전체를 조회했으나 해당 파일 밖에서 0건.
  - 상세: 파일 스코프 로컬 상수/함수이며 다른 모듈·엔티티·DTO의 동명 식별자와 겹치지 않는다.
  - 제안: 없음(정상).

- **[INFO] `enumName` 파라미터가 두 계층에서 다른 케이싱 컨벤션으로 쓰인다 (기존 관행, 이번 PR이 새로 만든 문제 아님)**
  - target 신규 식별자: `edge.entity.ts` / `node.entity.ts`의 `@Column({ enumName: 'edge_type' | 'node_category' })` (snake_case, Postgres 타입명)
  - 기존 사용처: 같은 도메인의 `edges/dto/create-edge.dto.ts:59`, `edges/dto/responses/edge-response.dto.ts:31`, `workflows/dto/save-canvas.dto.ts:43,156`, `nodes/dto/create-node.dto.ts:31`, `nodes/dto/responses/node-response.dto.ts:19,85,129` 등의 `@ApiProperty/@ApiQuery({ enumName: 'EdgeType' | 'NodeCategory' })` (PascalCase, Swagger 컴포넌트 스키마명)
  - 상세: 둘은 서로 다른 라이브러리(TypeORM vs `@nestjs/swagger`)·다른 네임스페이스(Postgres enum 타입 vs OpenAPI 스키마 컴포넌트)라 실제 충돌은 아니다. 다만 같은 파라미터명 `enumName`이 같은 도메인 파일군(`edge.entity.ts` vs `edge-response.dto.ts`) 안에서 케이싱만 다른 값(`edge_type` vs `EdgeType`)을 가리켜, diff만 보는 리뷰어가 오타로 오인할 수 있다. 이 관행 자체는 이번 PR 이전부터 있었고(Swagger 쪽 `enumName`은 기존 코드), 이번 PR은 TypeORM 쪽 `enumName`을 새로 추가했을 뿐이다.
  - 제안: 조치 불요. 필요하면 `edge.entity.ts`의 `@Column` 데코레이터 주석에 "Postgres 타입명(snake_case)이며 Swagger `enumName`(PascalCase)과 별개"라는 한 줄을 남기는 정도로 충분.

## 요약

번들 프롬프트의 spec/2-navigation 본문(트리거·스케줄)은 이번 브랜치 diff와 무관하며, scope 델타 0개 파일이라는 프롬프트 자신의 진단과 일치한다. 절대경로 워킹트리에서 재확인한 실제 diff는 TypeORM 엔티티 컬럼 선언(타입·enumName·기본값)을 기존 DB 스키마에 맞추는 수정과 그 가드 테스트 확장뿐이며, 새로 도입된 이름은 모두 기존 DB 식별자(`edge_type`/`node_category`) 재확인이거나 단일 테스트 파일 스코프 로컬 상수로 grep 0-hit을 확인했다. 요구사항 ID·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 어느 관점에서도 새로 부여된 식별자가 없어 충돌 대상 자체가 없다.

## 위험도

NONE
