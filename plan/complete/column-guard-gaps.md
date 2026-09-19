---
title: 컬럼 층 가드의 남은 빈칸 — 읽기 전용 세션의 회귀 테스트 · 선언한 기본값의 RETURNING
status: complete
owner: developer
worktree: column-guard-gaps-5e2c8a
started: 2026-09-20
completed: 2026-09-20
spec_impact: none
---

# 컬럼 층 가드의 남은 빈칸

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «컬럼 층 가드의 남은 빈칸 — 예방 계층 자체의 회귀 테스트 · `default`
RETURNING»(`plan/complete/entity-column-declaration-drift.md` 4라운드 «수렴 예외» 로 넘어온 것)을 닫는다. 테스트만 바뀐다.

## 무엇이 비었나 (`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`)

1. **예방 계층** — 컬럼 층 테스트는 TypeORM 비교기(`createSchemaBuilder().log()`)를 **읽기 전용 세션**(`default_transaction_read_only=on`)으로만
   연결해, 비교기가 DDL 을 실행하려 들면 Postgres 가 거부하게 한다. 그런데 그 옵션을 지워도 스위트는 GREEN 이다 — 탐지 계층(호출 전후 카탈로그
   대조)은 «바뀌었으면 잡는다» 이지 «막는다» 가 아니다. 예방이 살아 있는지를 보는 테스트가 없다.
2. **선언한 기본값의 왕복** — 컬럼 층 정정(#1358)이 `model_config.kind`(`DEFAULT 'chat'`, V088) · `workflow_assistant_session.last_interaction_at`
   (`DEFAULT now()`, V019) 에 `default` 를 선언했다. 값을 생략한 insert 가 DB 기본값을 채워 **돌려받는지**(TypeORM 이 그 컬럼을 RETURNING 에
   싣는지)는 전체 e2e 가 통과한 것으로만 확인됐다.
3. 가독성 — 지역 변수 `log`(무엇의 로그인지 모름) → `sqlMemory`, `COLUMN_LEVEL_SAMPLES.caught` 의 표본마다 어느 패턴의 것인지 주석.

## 할 것

1. 읽기 전용 세션 설정을 헬퍼(`readOnlyDataSourceOptions()`)로 빼 컬럼 층 테스트와 **새 테스트가 같은 것을 쓰게** 하고, 새 테스트가 그 세션으로
   `CREATE TEMP TABLE` 을 시도해 거부되는지 단언한다(Postgres 는 읽기 전용 트랜잭션에서 임시 테이블 `CREATE` 도 막는다 — 성공해도 임시라 무해).
   헬퍼에서 옵션을 지우면 이 테스트가 RED.
2. 같은 파일에 기본값 왕복 테스트 — 트랜잭션(ROLLBACK) 안에서 부모 행을 만들고 `kind` · `lastInteractionAt` 을 비운 채 `save` → 돌려받은 엔티티에
   `'chat'` · 시각이 들어 있다. 엔티티의 `default` 를 지우면 RED(뮤턴트로 확인).
3. 이름 · 주석.

## 비대상

- 다른 컬럼의 기본값 왕복 — 트래커가 짚은 두 컬럼(이번 정정에서 새로 선언한 것)만.

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/20/00_34_58`(scope `spec/2-navigation/` + 보정 블록 — 선례) BLOCK: NO. rationale checker 가
  «읽기 전용 세션은 임시 테이블 `CREATE` 도 거부한다» 를 pg18 로 재확인했다. WARNING 2(`GET /api/folders` · `GET /api/triggers/:id/history`
  응답 형태가 spec 표에 없다)와 INFO(`1-workflow-list.md` 의 완료된 `pending_plans`)는 이 변경과 무관한 기존 spec 공백 — planner 항목으로 트래커 등재.
- [x] 테스트 작성 · 뮤턴트로 판별력 — `d8fb708d5`. 일회용 DB(V001~V133) 8/8. 뮤턴트 셋 RED: 읽기 전용 옵션 제거(«rejected 대신 resolved») ·
  `kind` 의 `default` 제거(`'chat'` 이 안 옴) · `lastInteractionAt` 의 `default` 제거(`Date` 가 안 옴)
- [x] TEST WORKFLOW (lint · unit · build · e2e 366)
- [x] `/ai-review` 수렴 — 1라운드 `review/code/2026/09/20/01_00_21`(Warning 2 — 왕복 테스트의 연결 정리가 `try` 밖 → `a71642fe0` ·
  `--impl-prep` scope 가 무관 → 코드 밖, 근거 기록) · 2라운드 `01_24_51`(Critical 0 · Warning 2, 둘 다 코드 밖 — scope 건 재기록 · 리뷰 중
  작업 트리의 미커밋 마무리 편집을 관측 → `codebase/` 수정 0 라운드로 수렴). TEST WORKFLOW 재통과(e2e 366)
- [x] `--impl-done` — `review/consistency/2026/09/20/01_35_13`(scope `spec/2-navigation/` + 보정 블록) BLOCK: NO, Critical · Warning 0
- [x] 트래커 항목 해소 + planner 항목 하나 등재(`spec/2-navigation/` 목록 API 둘의 응답 형태 · 완료된 `pending_plans`) · harness 백로그
  §O 등재(`--impl-prep` · `--impl-done` 이 `spec/` 최상위 파일을 scope 로 못 받는다 — 이 PR 의 scope 우회가 그 증상) · 이 plan `plan/complete/` 로
