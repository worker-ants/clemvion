# Cross-Spec 일관성 검토 — `spec-draft-spec-fact-orm-defaults`

## 발견사항

- **[INFO]** `0-overview.md`→`1-data-model.md` 앵커 링크 경로가 plan 문서 기준 상대경로
  - target 위치: `plan/in-progress/spec-draft-spec-fact-orm-defaults.md` `## 변경` A 항목, "지금은 e2e 가드가 잡는다는 한 줄" 삽입문 중 `[데이터 모델 Rationale «code: 에 전용 e2e 가드 셋»](../../spec/1-data-model.md)`
  - 충돌 대상: `spec/0-overview.md` 자체 (편집 대상 파일)
  - 상세: `../../spec/1-data-model.md` 는 이 draft 문서(`plan/in-progress/`)의 위치 기준으로는 올바른 상대경로지만, 실제 삽입 대상인 `spec/0-overview.md` 는 `spec/1-data-model.md` 와 같은 디렉터리(`spec/`)에 있다. 이 문자열을 그대로 `0-overview.md` 에 넣으면 링크가 `spec/../../spec/1-data-model.md` = 저장소 루트 밖을 가리켜 깨진다. `spec/0-overview.md` 안의 기존 동일 참조 패턴(예: 문서 상단 `> 관련 문서: [데이터 모델](./1-data-model.md)`)은 `./1-data-model.md` 형태를 쓴다.
  - 제안: planner 가 실제 `spec/0-overview.md` 에 반영할 때 앵커를 `./1-data-model.md#code-에-전용-e2e-가드-셋-2026-09-19` (또는 상응하는 slug) 형태로 고쳐 삽입. cross-spec 계약 충돌은 아니고 draft 초안의 표기 그대로 옮겨 적으면 생기는 문서 내 링크 결함이라 낮은 등급.

## 검증 내역 (충돌 없음을 확인한 항목)

- **ORM 정정 (`spec/0-overview.md` §2.8 Rationale, Prisma → TypeORM)**: `spec/` 전체에서 "Prisma" 문자열은 정확히 이 세 줄(§2.8 Rationale 배경·채택·trade-off)뿐이며, `PROJECT.md`·`README.md`·`migrations/README.md`·`spec/conventions/migrations.md` 어디에도 다른 ORM 서술이 없다. target 이 이 세 줄만 고치면 저장소 전체에서 Prisma 잔존 참조가 0 이 되어 다른 영역과의 drift 가 남지 않는다.
- **`entity-schema-declarations` 가드 서술 정정 (`spec/1-data-model.md` Rationale)**: 변경 대상 문구는 `spec/1-data-model.md` 안에서만 한 번(§Rationale "`code:` 에 전용 e2e 가드 셋") 나타나고 다른 spec 문서에 이 가드에 대한 설명이 중복되어 있지 않다. 실제 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 헤더 주석이 "인덱스 · 제약 층의 방향은 한쪽이다(선언→DB) / 컬럼 층은 양방향이다" 라고 명시해, target 이 적으려는 "(엔티티 선언 ↔ DB — 인덱스 · 제약은 선언 → DB 한쪽, 컬럼 정의는 양방향)" 과 정확히 일치한다.
- **§2.16 ModelConfig `kind` 기본값**: 마이그레이션 `V088__model_config_rename_kind.sql:18` (`ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'chat'`) 및 엔티티 `model-config.entity.ts` (`@Column({ length: 20, default: 'chat' })`) 모두 `chat` 기본값을 선언한다. §2 표의 다른 필드(`notification_health`/`chat_channel_health`, §2.8 Trigger)가 이미 "값 목록. 설명. `default=`…``." 형식을 쓰고 있어 표기 관례와도 맞는다. `2-navigation/6-config.md`·`5-system/7-llm-client.md` 등 `kind` 를 참조하는 다른 spec 문서는 기본값에 대한 별도 주장을 하지 않아 모순 소지가 없다.
- **§2.20 AssistantSession `last_interaction_at` 기본값**: 마이그레이션 `V019__workflow_assistant.sql:25` (`DEFAULT NOW()`) 및 엔티티 `workflow-assistant-session.entity.ts` (`default: () => 'now()'`) 와 일치. 다른 영역 spec(`3-workflow-editor/4-ai-assistant.md` 등, 이번 번들에는 미포함이나 §2.20 필드를 다시 정의하는 곳은 없음)에서 이 값을 재정의하지 않는다.
- **요구사항 ID·API 계약·상태 전이·RBAC·계층 책임**: 이 draft 는 두 문서의 서술(Rationale 문장, 표의 설명 칸)만 고치는 순수 사실 정정이며 신규 엔티티·필드·엔드포인트·요구사항 ID·상태 머신·권한 규칙을 도입하지 않는다. 위 다섯 관점에서 다른 영역과 충돌할 표면 자체가 없다.

## 요약

target 은 두 군데의 순수 사실 정정(ORM 명칭, DB 컬럼 기본값 표기)이며 동작·계약을 바꾸지 않는다. `git log -S`·실제 마이그레이션 파일·엔티티 선언·e2e 가드 헤더 주석을 대조한 결과 draft 의 모든 사실 주장이 실측과 일치했고, 수정 대상 두 문서(`spec/0-overview.md`, `spec/1-data-model.md`) 밖에 같은 내용을 다르게 서술하는 곳도 없어 새로운 cross-spec drift 를 만들지 않는다. 유일하게 발견된 사항은 draft 본문 안의 상대경로 링크가 plan 문서 위치 기준으로 쓰여 있어 `spec/0-overview.md` 에 그대로 옮기면 깨진다는 표기상 결함으로, INFO 등급이며 반영 시 경로만 `./1-data-model.md` 형태로 바로잡으면 된다.

## 위험도

LOW
