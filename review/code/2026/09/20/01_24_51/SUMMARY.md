# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실 코드 변경(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`, e2e 테스트 2건 추가 + 헬퍼 추출 + 관용구 정리)에 Critical/Warning 급 코드 결함 없음. 1라운드에서 지적된 유일한 WARNING(`QueryRunner` 커넥션 누수 가능성)은 커밋 `a71642fe0` 로 실제 해소됐음을 9개 reviewer 전원이 소스 대조로 재확인했다. 위험도가 NONE 이 아니라 LOW 인 이유는 코드 밖 두 건 — (1) `--impl-prep` consistency-check 가 무관한 spec 스코프로 실행돼 무관 WARNING 2건이 이 changeset 에 편입된 것(1라운드에서 이미 "코드 밖·조치 없음"으로 처분됨), (2) 리뷰 진행 중 관측된, 아직 커밋되지 않은 plan 트래커 상태가 존재하지 않는 `plan/complete/column-guard-gaps.md` 를 완료 근거로 선인용하는 시점 불일치 — 때문이다. 라우팅·forced 화이트리스트는 정상 이행됐다(강제 지정된 7개 reviewer 전원 결과 확보, 누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | (1라운드에서 이미 지적·처분됨 — 기록 유지) 같은 changeset 에 실린 `--impl-prep` consistency-check 세션이 이 작업(spec 대상 `spec/1-data-model.md`, `spec_impact: none`)과 무관한 스코프(`spec/2-navigation/`)로 실행돼, 무관한 WARNING 2건(`GET /api/folders`·`GET /api/triggers/:id/history` 응답 포맷 spec 미기재)이 이 changeset 에 편입됨 | `review/consistency/2026/09/20/00_34_58/SUMMARY.md` (WARNING #1·#2, INFO #4), `plan/in-progress/column-guard-gaps.md` 체크리스트 `--impl-prep` 항목 | 이번 changeset 재작업 불요(RESOLUTION 이 "코드 밖·근거 기록"으로 이미 처분, 근거 검증 완료). 재발 방지책만 별도 harness 개선 항목으로 등록 검토 |
| 2 | documentation | (스코프 밖 · 우발적 관측, 커밋되지 않은 워킹트리 상태) `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커가 이 작업을 이미 `[x]` 완료로 표시하며 아직 존재하지 않는 `plan/complete/column-guard-gaps.md` 를 근거로 인용 — 실제 plan(`plan/in-progress/column-guard-gaps.md`)은 `/ai-review 수렴`·`--impl-done`·`plan/complete/ 이동` 3항목이 아직 미완료 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4892-4895` | 마무리 커밋 전에 순서를 맞출 것 — 테스트 → 리뷰 수렴 → `--impl-done` → plan 이동이 실제로 끝난 뒤에 트래커를 `[x]` 로 닫고 `plan/complete/column-guard-gaps.md` 를 인용해야 죽은 링크가 되지 않는다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/maintainability/testing/database/concurrency/documentation | 1라운드 WARNING(`QueryRunner` 커넥션 획득이 `try` 밖에 있어 실패 시 release 누락 가능)이 커밋 `a71642fe0` 로 실제 해소됨 — `connect()`/`startTransaction()` 을 `try` 안으로, `finally` 는 `isTransactionActive` 확인 후 롤백 → 중첩 `finally` 에서 `release()` 를 무조건 호출하도록 재구성. TypeORM `PostgresQueryRunner.release()` 소스까지 확인해 연결 실패 시에도 안전(no-op)함을 재검증 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-663` | 조치 불요(검증 완료) |
| 2 | requirement/maintainability/documentation | 두 `readOnlyDataSourceOptions()` 호출부(기존 컬럼 층 테스트, 신규 읽기 전용 방어 테스트)의 `try`/`finally` 관용구가 통일됨(1라운드 INFO 조치 확인) | `:568-577`, `:595-606` | 조치 불요 |
| 3 | security/database | 신규 raw SQL INSERT(user/workspace/workflow) 전부 파라미터 바인딩(`$1`,`$2`) 사용, 동적 값은 직전 `RETURNING` 결과뿐 — SQL 인젝션 표면 없음 | `:619-630` | 조치 불요 |
| 4 | database/concurrency/side_effect | 트랜잭션 경계·롤백·격리 적절 — 부모 3행 생성부터 두 엔티티 save 까지 한 `QueryRunner` 트랜잭션 안에서 수행되고 무조건 rollback. 대상 엔티티에 `@BeforeInsert`/`EventSubscriber`/DB 트리거·NOTIFY 없어 트랜잭션 밖으로 새는 부수 효과 경로 없음(실측 확인) | `:614-663`, 관련 엔티티 `model-config.entity.ts`, `workflow-assistant-session.entity.ts` | 조치 불요 |
| 5 | maintainability/testing | 부모 행(user/workspace/workflow) 원시 SQL 3연쇄가 이 파일 기준 세 번째 반복(공유 헬퍼 없음, `webhook-endpoint-reservation.e2e-spec.ts` 에도 동일 패턴 존재) — 1라운드에서도 지적된 기존 패턴, 이번 diff 의 신규 회귀 아님 | `:619-630` | 조치 불요. 네 번째 e2e 파일이 같은 체인을 필요로 하면 공유 헬퍼 추출 고려 |
| 6 | testing/maintainability | 신규 왕복 테스트가 단일 `it` 에서 두 컬럼(`model_config.kind`, `workflow_assistant_session.last_interaction_at`)을 순차 검증 — 같은 트랜잭션·부모 행 공유 필요성에 따른 의도된 트레이드오프 | `:614-663` | 조치 불요. 세 번째 대상 컬럼 추가 시 분리 재고 |
| 7 | requirement/testing/documentation | 파일 헤더 JSDoc(`:29`)이 아직 존재하지 않는 `plan/complete/column-guard-gaps.md` 를 인용 — 이 저장소의 기존 선례(마무리 커밋에서 plan 이동)와 동일한 패턴, plan 체크리스트가 이미 이동을 to-do 로 추적 중 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:29` | 조치 불요. 마무리 커밋에서 plan 이동 여부만 재확인(WARNING #2 와 연동) |
| 8 | database | 중첩 `finally`(rollback 실패 + release 실패 동시 발생 시) 원인 에러가 유실될 수 있는 극히 낮은 확률의 잔여 리스크 | `:655-661` | 조치 불요(수용 가능한 트레이드오프). 필요 시 `Promise.allSettled` 검토 |
| 9 | side_effect/testing/documentation | 본 리뷰 대상 diff 와 무관하게, 리뷰 진행 중 `plan/in-progress/harness-review-gate-followups.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md` 두 파일이 워킹트리에서 수정 상태(M)로 관측됨 — 각 reviewer 는 이 파일들을 건드리지 않았다고 명시(Read/조회만 수행). 마무리 작업 중인 다른 프로세스(오케스트레이터/개발자)의 정상적인 동시 변경으로 추정 | `plan/in-progress/harness-review-gate-followups.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 통합 시 위 WARNING #2 로 반영됨(내용 대조 결과 죽은 링크 리스크 있음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 SQL 전부 파라미터 바인딩, 인젝션 표면 없음. 하드코딩 시크릿·인증 우회 없음 |
| requirement | NONE | plan 스코프와 diff 1:1 대응, spec §2.16/§2.20 line-level 일치, vacuous 아님. JSDoc plan 경로 INFO만 |
| scope | LOW | 핵심 코드는 스코프 이탈 없음. `--impl-prep` 이 무관 spec 스코프로 실행된 것은 1라운드에서 이미 처분된 WARNING(기록 유지) |
| side_effect | NONE | lifecycle 훅/트리거/NOTIFY 없어 부수 효과 경로 없음. 무관 plan 파일 변경 관측(기록만) |
| maintainability | NONE | 1라운드 WARNING/INFO 전원 조치 확인. 남은 INFO(픽스처 3중 반복, 46줄 테스트)는 기존 판단 유지 |
| testing | LOW | 1라운드 WARNING 회귀 검증 완료(해소). JSDoc plan 경로 미존재 등은 INFO |
| documentation | LOW | 1라운드 문서화 조치 4건 반영 확인. 스코프 밖 plan 트래커 시점 불일치 WARNING 1건 |
| database | NONE | 커넥션 누수 해소 확인, 트랜잭션/파라미터 바인딩 적절. 이중 실패 시 에러 유실 가능성은 INFO |
| concurrency | NONE | Jest 순차 실행, `test.concurrent` 미사용 — 동시 접근 없음. 리소스 정리 대칭적 |

## 발견 없는 에이전트

없음 — 9개 에이전트 전원이 최소 INFO 이상의 검증/관찰 기록을 남겼다(순수 "문제 없음" 판정 포함).

## 권장 조치사항

1. 마무리 커밋 전 순서 확인: 테스트 → `/ai-review` 수렴(Critical/Warning 0) → `--impl-done` → `plan/in-progress/column-guard-gaps.md` 를 `plan/complete/` 로 이동 → `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커의 "2026-09-20 해소" 문구가 실제 이동 이후에 커밋되는지 확인(WARNING #2).
2. `--impl-prep` consistency-check 가 무관한 spec 스코프로 실행된 사례(WARNING #1)는 이번 changeset 재작업이 필요 없으나, 재발 방지를 위해 "5개 checker 전원 리다이렉트 처리" 또는 "`--impl-prep` 이 단일 spec 파일을 target 으로 받을 수 있게" 하는 harness 개선을 별도 백로그 항목으로 등록할지 검토.
3. (선택) 부모 행(user/workspace/workflow) raw INSERT 3연쇄가 이제 3개 e2e 파일에서 반복된다 — 네 번째 파일이 같은 체인을 필요로 할 때 공유 헬퍼 추출을 고려.
4. 코드 자체는 별도 조치 없이 이번 라운드로 수렴 가능(Critical 0, 신규 코드 WARNING 0).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 누락 없음, 거짓 음성 위험 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(e2e 테스트 파일 1개)와 무관 |
  | architecture | router 판단상 이번 diff와 무관 |
  | dependency | 신규 의존성 변경 없음 |
  | api_contract | 공개 API/계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 대상 변경 없음 |
