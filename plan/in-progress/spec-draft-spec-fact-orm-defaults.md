---
title: 사실 정정 둘 — 0-overview 의 ORM(Prisma → TypeORM) · 1-data-model 의 빠진 DB 기본값 둘
status: complete
owner: project-planner
worktree: spec-fact-orm-defaults-3c7e91
started: 2026-09-19
completed: 2026-09-19
spec_impact:
  - spec/0-overview.md
  - spec/1-data-model.md
---

# 사실 정정 둘

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목을 닫는다 — 둘 다 **사실 정정**이고 동작 · 계약은 바뀌지 않는다.

- «`spec/0-overview.md` Rationale 이 백엔드 ORM 을 Prisma 로 적는다 — 실제는 TypeORM»
- «`spec/1-data-model.md` 컬럼 표가 DB 기본값 둘을 적지 않는다» (+ 같은 턴에 Rationale 한 줄)

## 실측 (2026-09-19, `origin/main` `19d9dedca`)

- `prisma` 는 저장소 **이력 전체**에 없다 — `git log -S prisma` (backend · 루트 `package.json`) 0건, `@prisma/client` 0건, `schema.prisma` 없음.
  TypeORM(`"typeorm": "^0.3.31"`)은 첫 커밋 `ae8f9cfd9`(2026-05-17, V001 과 같은 커밋)부터다. `app.module.ts` 는 `synchronize: false`.
  «NestJS + Prisma» 문장은 `0250793c8`(#256, 2026-05-22)이 넣었다 — 그때도 Prisma 는 없었다.
- `spec/` · `PROJECT.md` · `README.md` · `migrations/README.md` 에서 «Prisma» 는 `0-overview.md` Rationale 세 줄뿐이다.
- 이중 source 의 drift 는 지금 가드가 있다 — `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`: 인덱스 · 유니크 · CHECK · FK 는
  선언 → DB 한쪽(#1354), 컬럼 정의(타입 · NULL · 기본값 · enum 타입 이름 · 추가 · 삭제)는 양방향(#1358, TypeORM 스키마 비교기).
- 기본값 둘: `model_config.kind` `DEFAULT 'chat'`(`V088__model_config_rename_kind.sql:18`) · `workflow_assistant_session.last_interaction_at`
  `DEFAULT NOW()`(`V019__workflow_assistant.sql:25`). 이후 마이그레이션이 바꾸지 않았다. 엔티티는 #1358 이후 둘 다 선언한다.
- 표기 관례: §2 표는 기본값을 설명 칸에 `default=\`…\`` 로 적는다(§2.8 `notification_health` · `chat_channel_health`).

## 변경

### A. `spec/0-overview.md` `## Rationale` «DB 마이그레이션 도구로 Flyway 채택 (§2.8)»

- **배경**: «NestJS + Prisma 를 사용하므로 `prisma migrate` 를 …» → Backend 의 ORM 은 **TypeORM** 이고 스키마를 ORM 이 만들게 두지 않는다
  (`synchronize: false`) — ORM 이 엔티티에서 만드는 마이그레이션 대신 SQL 을 직접 쓴다.
- **채택**: «`prisma migrate` 대신» → «ORM 이 엔티티에서 만드는 마이그레이션 대신». 이유 (a)(b)(c)는 그대로.
- **trade-off**: «Prisma client 의 schema» → «TypeORM 엔티티 데코레이터». «schema 정의 자체의 이중 source 는 받아들인 비용이다» 뒤에 그 drift 를
  지금은 e2e 가드가 잡는다는 한 줄(`entity-schema-declarations` — 인덱스 · 제약은 선언 → DB, 컬럼 정의는 양방향; [데이터 모델 Rationale
  «`code:` 에 전용 e2e 가드 셋»](../../spec/1-data-model.md)).
- 절 끝에 `> **정정 (2026-09-19)**: 이 절은 ORM 을 Prisma 로 적었다 — 저장소 이력 어디에도 Prisma 는 없고 첫 커밋부터 TypeORM 이다(#256 이
  넣은 문장). 결정(Flyway · SQL 기반)과 이유는 그대로다.`

### B. `spec/1-data-model.md`

- §2.16 ModelConfig `kind` 설명 끝에 `default=\`chat\`(V088)`.
- §2.20 AssistantSession `last_interaction_at` 설명 끝에 `default=\`now()\``.
- `## Rationale` «`code:` 에 전용 e2e 가드 셋» 의 `entity-schema-declarations`(엔티티 선언 ↔ DB) → `(엔티티 선언 ↔ DB — 인덱스 · 제약은 선언 →
  DB 한쪽, 컬럼 정의는 양방향)`.

## 비대상

- 다른 컬럼의 기본값 전수 대조 — 이 두 개는 리뷰가 짚은 것이다. §2 전체 기본값은 대조하지 않았다(«§2 FK 삭제 동작 · 빠진 컬럼» 절이 적은
  «대조하지 않은 것: §2 의 값 목록» 과 같은 자리).

## Rationale

- **원문을 남기지 않고 고쳐 쓰는 이유**: 결정(Flyway · SQL)과 이유는 사실이고, 틀린 것은 전제의 이름(ORM) 하나다. 취소선으로 남기면 틀린
  사실이 두 번 읽힌다 — 절 끝의 정정 블록이 원문의 존재와 출처(#256)를 대신 기록한다.

### `--spec` 결과 반영 (`review/consistency/2026/09/19/20_45_59`, BLOCK: NO)

Critical 0 · WARNING 1 · INFO 1.

- **W1** — 변경 A 의 링크를 draft 위치 기준(`../../spec/1-data-model.md`)으로 적었다. `spec/0-overview.md` 에는 형제 파일 기준
  `./1-data-model.md#code-에-전용-e2e-가드-셋-2026-09-19` 로 넣었다(frontend `spec-link-integrity` 가드 통과 — 앵커 포함).
- **INFO** — «정정 (날짜)» 콜아웃을 규정하는 conventions 문서가 없다. 기존 선례(`data-flow/10-triggers` 등)를 그대로 따랐다 — 세 번째 반복 뒤
  규약화 검토(checker 제안, 차단 아님).

## 체크리스트

- [x] `--spec` 이 draft
- [x] spec 반영 (planner 커밋)
- [x] 트래커 두 항목 해소 · 이 draft `plan/complete/` 로
