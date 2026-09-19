# Rationale 연속성 검토 — entity-column-drift-b83f15 / scope: spec/2-navigation/

## 검토 전제 확인

- `spec/2-navigation/` 델타: 0개 파일(정상 — 이 브랜치는 spec 을 바꾸지 않는다).
- 실제 구현 diff(9파일/약 297줄, `origin/main`→HEAD)는 `codebase/backend/src/modules/{alerts,edges,integrations,llm,model-config,nodes,workflow-assistant,workspaces}/entities/*.entity.ts` 8개 TypeORM 엔티티 컬럼 선언 정정과 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 가드 확장(컬럼 층 추가) 1개 — 절대경로 워킹트리에서 `git diff origin/main HEAD -- '*.entity.ts'` 및 해당 테스트 파일로 직접 확인.
- `Trigger` 엔티티 자체(`triggers` 모듈)는 이번 diff 에 포함되지 않는다 — `spec/2-navigation/2-trigger-list.md` R-1~R-17, `3-schedule.md` Rationale 이 다루는 트리거·스케줄 필드 정책(예: `workflowId` read-only, `authConfigId` binding, PATCH 단일 경로 등)과 직접 충돌할 표면이 없다.

## 발견사항

이 diff 는 순수 스키마 선언 정정(TypeORM 컬럼 타입·enum 이름·기본값을 실제 DB 에 맞춤, `synchronize: false` 이므로 원칙적으로 동작 불변)이며, `spec/2-navigation/` 어떤 문서의 `## Rationale` 항목이 명시적으로 거부한 대안을 재도입하거나, 그 문서들이 박아 둔 설계 원칙(권한 게이트, PATCH 단일 경로, 딥링크 비대칭, drawer 분리 등)을 위반하는 지점을 찾지 못했다. CRITICAL/WARNING 없음.

- **[INFO] 컬럼 층 가드 범위 확장은 "번복" 이 아니라 사전에 트래커로 넘긴 항목의 계획된 완료**
  - target 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 상단 주석(diff) — "컬럼 정의(...)는 이 가드 밖이다" → "컬럼 층은 양방향이다"로 교체
  - 과거 결정 출처: `plan/complete/entity-schema-declaration-drift.md` §"비대상 — 컬럼 층 (트래커에 등재함)" — 해당 PR 이 컬럼 층 정정을 **명시적으로 스코프 밖**으로 두고 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재했다.
  - 상세: 이것은 "기각된 대안의 재도입"이 아니라 처음부터 이연(defer)만 하고 이유(층이 다르다 — 없는 인덱스·제약을 주장하는 클래스와 다른 문제)를 남겨 둔 항목을, 현재 plan(`plan/in-progress/entity-column-declaration-drift.md`)이 예정대로 닫는 것이다. 새 결정(컬럼 층도 가드 대상으로 삼는다, DB-only 컬럼은 예외 목록에 이유와 함께 등재)에 대한 근거가 테스트 파일 주석 + plan 문서 양쪽에 충분히 기록돼 있다.
  - 제안: 조치 불요. 참고로 `spec/1-data-model.md`의 `## Rationale` "`code:` 에 전용 e2e 가드 셋 (2026-09-19)" 항목은 `entity-schema-declarations`를 층 구분 없이 "엔티티 선언 ↔ DB"로 일반적으로 서술하고 있어 이번 컬럼 층 확장에도 그대로 부합한다 — 별도 spec 갱신 불필요.

- **[INFO] 런타임 영향(default 선언 → RETURNING 채움)은 spec Rationale 의 "동작 불변" 전제와 결이 다르지만, plan 이 스스로 반증·검증한 사안**
  - target 위치: `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts`의 `last_interaction_at` `default: () => 'now()'` 추가
  - 과거 결정 출처: `plan/complete/entity-schema-declaration-drift.md` — "이 선언들은 DB 를 바꾸지 않는다... 그래서 동작은 바뀌지 않는다"(인덱스·제약 층 한정 서술)
  - 상세: 현재 plan(`entity-column-declaration-drift.md` "런타임 영향" 절)이 이 전제가 컬럼 층 `default` 선언에는 그대로 성립하지 않음을 스스로 실측·기록했다(`ReturningResultsEntityUpdator`가 insert 후 기본값을 엔티티에 채워 넣음, 값 자체는 DB 기본값과 동일해 의미는 같음, 전체 e2e 로 확인). spec Rationale 자체를 반증한 것이 아니라(그 Rationale 은 인덱스·제약 층 한정 진술이었다) 새 층으로 확장하며 생기는 미세한 차이를 투명하게 기록한 사례다.
  - 제안: 조치 불요 — 이미 plan 에 실측·근거가 남아 있다. 향후 유사 PR 에서 "선언 정정은 동작 불변"이라는 일반화된 주장을 재사용할 때는 이 사례(컬럼 default 추가는 예외)를 함께 인용할 것을 권고.

## 요약

이번 diff 는 `spec/2-navigation/`를 전혀 건드리지 않았고(정상), 실제 코드 변경도 그 문서군이 서술하는 트리거·스케줄 UI/API 설계 결정과 무관한 8개 엔티티의 TypeORM 컬럼 선언(타입·enum 이름·기본값)을 실제 DB 스키마에 맞추는 순수 정합화 작업이다. 관련된 유일한 과거 결정(`plan/complete/entity-schema-declaration-drift.md`의 "컬럼 층은 비대상 — 트래커에 등재")은 거부(rejected)가 아니라 계획된 후속 작업 표시였고, 이번 plan(`entity-column-declaration-drift.md`)이 그 트래커 항목을 예정대로, 자체 근거(실측·뮤턴트 테스트·리뷰 라운드)를 남기며 닫았다. `spec/2-navigation/2-trigger-list.md`·`3-schedule.md`의 R-1~R-17 및 Rationale 어느 항목과도 직접적 충돌이 없다. Rationale 연속성 관점에서 위험은 없다고 판단한다.

## 위험도

NONE
