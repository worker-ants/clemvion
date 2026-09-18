# 신규 식별자 충돌 검토 — 삭제 연쇄 FK 인덱스 다섯 (V112~V116)

## 검토 범위에 관한 메모

target 은 `spec/conventions/`(--impl-done scope) 이지만 `origin/main...HEAD` 델타에서 그 영역은 **0 파일**이다.
실제 신규 식별자는 구현 diff(11개 파일 / 291줄)에서 나온다 — 프롬프트 번들의 `git diff` 섹션이 예산에 잘려
있어, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/usage-log-workflow-index-5b1e07`)에서
`git diff origin/main...HEAD`, `git log`, 개별 마이그레이션·엔티티·e2e 파일을 직접 읽어 신규 식별자를
전수 확인했다.

신규 식별자 목록:
- 마이그레이션 파일 5쌍: `V112__node_execution_node_id_index.{sql,conf}` ~ `V116__llm_usage_log_execution_id_index.{sql,conf}`
- 인덱스명 5개: `idx_node_execution_node_id` · `idx_integration_usage_log_node_execution_id` ·
  `idx_integration_usage_log_workflow_id` · `idx_llm_usage_log_node_execution_id` · `idx_llm_usage_log_execution_id`
- e2e 스펙 파일: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`
- spec Rationale 제목: `### 삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)` (`spec/1-data-model.md`)
- plan 파일: `plan/in-progress/spec-draft-deletion-cascade-indexes.md`

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 마이그레이션 주석이 아직 존재하지 않는 `plan/complete/` 경로를 가리킨다
  - target 신규 식별자: 없음(경로 자체는 새 식별자가 아니라 참조 문자열)
  - 기존 사용처: `codebase/backend/migrations/V112__node_execution_node_id_index.sql` 등 5개 파일 헤더 주석의
    `plan/complete/spec-draft-deletion-cascade-indexes.md` — 이 경로는 워킹트리에 **아직 존재하지 않는다**
    (`find plan -iname '*deletion-cascade*'` → `plan/in-progress/spec-draft-deletion-cascade-indexes.md` 만 존재,
    frontmatter `status: in-progress`)
  - 상세: 이것은 이름 충돌이 아니라 **선반영 경로 참조**다. 선례(`V111__trigger_workflow_id_index.sql` 이
    `plan/complete/spec-draft-trigger-workflow-index.md` 를 인용)에서도 커밋 시점엔 해당 plan 이 아직
    `in-progress` 였고, 이후 별도 커밋(`e63a5bc5d` "구현(#1346) 머지 뒤 거짓이 된 문장 정리 · 공유 트래커 승격 규칙")에서
    `plan/complete/` 로 이동되어 참조가 사후에 맞아떨어졌다. 동일 패턴이 반복되는 것으로 보이며, 실제로
    `plan/in-progress/cafe24-backlog-residual.md` 에 추가된 새 섹션도 이 흐름(무관한 `--impl-prep` 이 지나가며
    발견한 부수 이슈를 별도 트래커에 기록)을 뒷받침한다.
  - 제안: 새 식별자 충돌은 아니므로 차단 사유 아님. 다만 이 plan 이 `plan/complete/` 로 이동되기 **전에** PR 이
    머지되면 마이그레이션 주석의 경로가 일시적으로 broken reference 가 된다 — plan 이동 타이밍을 놓치지 않도록
    plan lifecycle 체크리스트(§plan-lifecycle.md)에서 확인 권장. 새 파일·심볼 명의 충돌은 아니라는 점만 기록.

## 관점별 확인 결과 (충돌 없음 근거)

1. **요구사항 ID 충돌** — 이 PR 은 신규 요구사항 ID(`V-*`/`INT-*`/`G-*` 류)를 부여하지 않는다. 순수 DB 인덱스
   추가이며 spec 요구사항 ID 신규 발급 없음. N/A.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. `NodeExecution`·`IntegrationUsageLog`·`LlmUsageLog`
   TypeORM 엔티티(`node-execution.entity.ts`·`integration-usage-log.entity.ts`·`llm-usage-log.entity.ts`)는
   컬럼 변경 없이 그대로이고, 신규 인덱스 5개 중 TypeORM `@Index` 데코레이터로 반영된 것은 없다 — 이는
   기존 컨벤션과 일치한다(`integration-usage-log.entity.ts` 상단 주석: "TypeORM `@Index` 선언은 방향 drift
   회피를 위해 의도적으로 생략, migration 이 SoT"). 기존 `llm-usage-log.entity.ts` 의 `@Index('idx_llm_usage_log_workspace_created_at', …)` /
   `@Index('idx_llm_usage_log_provider_model_created_at', …)` 두 개와도 이름이 겹치지 않는다.
3. **API endpoint 충돌** — 신규 endpoint 없음. N/A.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트 신규 없음. N/A.
5. **환경변수·설정키 충돌** — `.conf` 5개가 모두 `executeInTransaction=false` 하나만 쓴다. 이는 신규 키가
   아니라 `V109__workspace_personal_owner_unique.conf` / `V110__schedule_workspace_next_run_index.conf` /
   `V111__trigger_workflow_id_index.conf` 에서 이미 쓰던 동일 Flyway 설정 키의 재사용이며 의미도 동일
   (`CREATE/DROP INDEX CONCURRENTLY` 비-트랜잭션 요구). 충돌 없음.
6. **파일 경로 충돌** —
   - 마이그레이션 버전 번호 `V112`~`V116`: `codebase/backend/migrations/` 전수 조회 결과 기존 최대 버전은
     `V111`이었고 5개 신규 번호는 어디에도 중복되지 않는다. 빌드 시점 중복 가드
     (`check-duplicate-versions.sh`, `scripts/check-migration-versions.py`, `migrations.spec.ts`)도
     이미 존재해 이 클래스의 충돌은 구조적으로 방어된다. 다른 in-progress plan 파일들에서도 `V112`~`V116`
     번호를 선점하려는 언급이 없어(grep 0건) 병렬 세션 충돌 가능성도 낮다.
   - 인덱스명 5개: `codebase/backend/migrations/` 전 파일 grep 결과 신규 5개 파일 자신을 제외하면 재사용
     이력이 없다. 명명 스타일(`idx_<table>_<column>`)도 기존 `idx_integration_usage_log_integration_at`
     (V008) · `idx_llm_usage_log_workspace_created_at`(V014) 등과 일관된다.
   - e2e 스펙 파일 `deletion-cascade-indexes.e2e-spec.ts`: `codebase/backend/test/` 전수 조회 결과 동일/유사
     이름 파일 없음.

## 요약

target 은 명목상 `spec/conventions/` 지만 실제 코드 델타(V112~V116 마이그레이션 5쌍, e2e 스펙 1개, `spec/1-data-model.md`
등 4개 spec 파일의 표·Rationale 갱신)에서 도입된 신규 식별자(마이그레이션 버전 번호, 인덱스명, 파일 경로,
Rationale 제목)를 전수 대조한 결과 기존 사용처와의 CRITICAL/WARNING 급 충돌은 없다. 인덱스명은 테이블당
`idx_<table>_<column>` 컨벤션을 그대로 따르고, TypeORM 엔티티에는 (기존 관례대로) 데코레이터로 미러링하지
않아 엔티티 레벨 이름 충돌 여지도 없다. 유일하게 눈에 띈 것은 마이그레이션 주석이 아직 `in-progress` 상태인
plan 파일을 `plan/complete/` 경로로 선반영 인용한 점인데, 이는 새 식별자 충돌이 아니라 plan 이동 타이밍
문제이며 선례(V111)에서도 동일 패턴이 사후에 해소된 바 있어 INFO 로만 기록한다.

## 위험도

NONE
