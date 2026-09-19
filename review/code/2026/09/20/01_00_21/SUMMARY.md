# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(리뷰 절차 스코프 불일치 1건, 테스트 코드 자원 정리 견고성 1건) 모두 프로덕션 코드 결함이 아니며 즉시 회귀를 유발하지 않음. forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | `--impl-prep` consistency-check 세션이 이 작업과 무관한 스코프(`spec/2-navigation/`)로 실행됐다. 5개 checker 중 4개(`plan_coherence`·`convention_compliance`·`naming_collision`·`side_effect`/`documentation`)가 무관함을 자체 지적했고, `rationale_continuity` 1개만 실제 관련 spec(`spec/1-data-model.md`)로 리다이렉트 블록을 받았다. 그 결과 이 작업과 무관한 WARNING 2건(`GET /api/folders`, `GET /api/triggers/:id/history` 응답 포맷 미문서화)이 이번 커밋에 영구 편입됐다 | `review/consistency/2026/09/20/00_34_58/meta.json:3-4`, `plan/in-progress/column-guard-gaps.md` 체크리스트 (requirement·side_effect·documentation 리뷰도 동일 사실을 INFO 로 자진 신고) | 다음에 "선례" 를 쓸 때 5개 checker 프롬프트 전부에 리다이렉트 블록을 일관 적용하거나, `--impl-prep` 이 다중 spec 폴더가 아닌 실제 관련 spec 파일을 target 으로 받을 수 있도록 호출 방식 개선. 이번 PR 코드(`entity-schema-declarations.e2e-spec.ts`) 자체의 결함은 아님 |
| 2 | testing | 신규 "기본값 왕복" 테스트에서 `qr.connect()`/`qr.startTransaction()` 호출이 `try` 블록 밖에 있어, `connect()` 성공 후 `startTransaction()` 이 실패하면 `finally` 의 `qr.release()` 가 실행되지 않아 커넥션이 반환되지 않을 수 있다. `finally` 안에서도 `rollbackTransaction()` 이 던지면 그 다음 `release()` 가 스킵되는 동일 유형 문제 존재 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-617` (connect/startTransaction), `:654-657` (finally release) | `connect()`/`startTransaction()` 을 `try` 안으로 옮기고, `finally` 에서 `if (qr.isTransactionActive) await qr.rollbackTransaction();` 로 방어한 뒤 `release()` 를 별도 방어(또는 `Promise.allSettled`)로 호출해 롤백 실패가 release 를 막지 않게 한다. 발생 확률은 낮지만 새면 이후 테스트들의 커넥션 풀 여유를 갉아먹는 flake 요인이 될 수 있다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `readOnlyDataSourceOptions()` 사용처 두 곳(568행 기존 테스트, 596행 신규 테스트)의 `try`/`finally` 관용구가 다르다 — `initialize()` 호출을 `try` 안/밖 어디에 두느냐가 다름. 논리적 결함은 아니나(밖에 있으면 실패 시 애초에 `finally` 미진입) 관용구 통일이 안 돼 있음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:568`, `:596` | 다음에 이 헬퍼를 또 쓸 때 한 관용구로 통일 검토. 이번 PR 조치 불요 |
| 2 | scope | `--impl-prep` 무관 스코프 실행으로 나온 WARNING 2건이 실제로 스펙 트래커(`spec-draft-nullable-notation-followups.md` 등)에 등재됐는지 이번 diff 범위에서 확인되지 않음 | `plan/in-progress/column-guard-gaps.md` 체크리스트 | 등재 완료 여부 별도 확인 — 안 됐다면 후속 유실 위험 |
| 3 | maintainability | 부모 엔티티(user→workspace→workflow) 생성용 원시 SQL INSERT 3연쇄가 `webhook-endpoint-reservation.e2e-spec.ts`, `external-interaction.e2e-spec.ts` 에도 각각 반복돼 있고 공유 헬퍼가 없음. 이번 diff 가 새로 만든 패턴은 아님(기존 파일별 자기완결 컨벤션을 따름) | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:613-630` | 4번째 e2e 파일이 같은 체인을 필요로 하면 `test/helpers/e2e-fixture.ts` 같은 공유 헬퍼로 추출 검토. 이번 PR 범위 밖 |
| 4 | maintainability | 신규 기본값 왕복 테스트가 부모 행 생성 + 두 엔티티(`ModelConfig`, `WorkflowAssistantSession`) 검증을 한 `it` 블록에서 순차 수행해 46줄로 늘어남. 두 컬럼이 같은 트랜잭션·부모 행을 공유해야 하는 시나리오라 분리하면 픽스처가 중복되므로 현재 구조가 부적절하진 않음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:613-658` | 조치 불요. 세 번째 컬럼이 추가되면 분리 재고 |
| 5 | testing | 부모 행(user/workspace/workflow)은 원시 SQL, 검증 대상 엔티티는 TypeORM `manager.create/save` 로 생성해 스타일이 혼재. 원시 SQL 이 세 테이블의 NOT NULL 컬럼 목록을 테스트에 재하드코딩하는 셈이라, 나중에 그 테이블에 기본값 없는 NOT NULL 컬럼이 추가되면 기본값 정정과 무관한 INSERT 실패로 이 테스트가 깨질 수 있음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:618-647` | 검증 대상이 아닌 세 테이블도 `manager.create/save` 로 만들면 스키마 변경에 더 강해짐. 실용적 트레이드오프로 이해 가능한 수준 |
| 6 | testing | 신규 테스트 두 건의 판별력(뮤턴트 확인 결과 — 읽기 전용 옵션 제거·두 default 제거 시 RED)이 코드 상 대조군(`COLUMN_LEVEL_SAMPLES` 처럼)이 아니라 plan 문서 서술에만 남아 있음 | `plan/in-progress/column-guard-gaps.md` 체크리스트, `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:594-658` | 조치 불요 — 회귀 테스트 자체는 유효. 참고 기록 |
| 7 | documentation | 파일 최상단 요약 JSDoc("컬럼 층은 양방향이다")이 이번에 추가된 두 신규 테스트(예방 계층 회귀·기본값 RETURNING 왕복)를 언급하지 않음. 각 테스트 바로 위 개별 JSDoc 은 정확하고 상세해 실질적 정보 손실은 작음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:14-34` | "컬럼 층은 양방향이다" 문단 끝에 두 신규 테스트의 존재·목적을 한 문장으로 추가 |
| 8 | side_effect | 신규 기본값 왕복 테스트가 공유 e2e DB 실 테이블(`user`/`workspace`/`workflow`)에 raw INSERT 수행. 트랜잭션 rollback 으로 격리되고, 대상 엔티티에 트랜잭션 밖으로 새는 `EventSubscriber`/`@AfterInsert` 훅이 없음을 확인(grep 0건) — 부수 효과 없음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:613-658` | 조치 불요. 프로세스가 rollback 이전에 강제 종료되는 경우의 잔존 리스크는 이 파일의 다른 트랜잭션 기반 테스트와 공통된 기존 리스크이며 이번 diff 신규 도입 아님 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 SQL 전부 파라미터 바인딩, 유일한 리터럴 SQL 은 고정 문자열. 프로덕션 인증/인가 경로 미포함. 오히려 읽기 전용 세션 강제 회귀 테스트로 방어 계층 보강 |
| requirement | NONE | 신규 테스트 2건이 트래커가 지정한 좁은 스코프(예방 계층 회귀·기본값 RETURNING 왕복)를 정확히 구현, 엔티티·마이그레이션·spec 과 line-level 일치. INFO 2건만(try/finally 관용구 불일치, `--impl-prep` 스코프 불일치) |
| scope | LOW | 핵심 코드 변경은 plan 이 선언한 범위와 정확히 1:1 대응해 스코프 이탈 없음. 다만 함께 커밋된 `--impl-prep` 세션이 무관 스코프(`spec/2-navigation/`)로 실행돼 무관 WARNING 2건이 혼입(WARNING #1) |
| side_effect | NONE | 상태 변경·시그니처·인터페이스·환경변수 변경 없음. raw INSERT 는 트랜잭션 rollback 으로 격리, EventSubscriber 훅 없음 확인 |
| maintainability | NONE | `log`→`sqlMemory` 개명, `readOnlyDataSourceOptions()` 헬퍼 추출로 오히려 개선. 원시 SQL 중복(기존 컨벤션)·테스트 함수 길이는 INFO 수준 |
| testing | LOW | 신규 테스트 2건이 트래커 빈칸을 정확히 메움, mock 미사용이 적절. `QueryRunner` connect/startTransaction 이 `try` 밖에 있어 실패 시 release 누락 가능(WARNING #2) |
| documentation | NONE | 개별 JSDoc·인라인 주석 정확성 우수(spec 섹션·커밋 번호 대조 전부 일치). 최상단 요약 JSDoc 이 신규 테스트 2건 미반영(INFO) |

## 발견 없는 에이전트

security — 위 표의 NONE 판정 사유 외 추가 지적 없음 (신규 취약점 미발견).

## 권장 조치사항

1. `testing` WARNING — 신규 "기본값 왕복" 테스트의 `qr.connect()`/`qr.startTransaction()` 을 `try` 블록 안으로 옮기고, `finally` 의 rollback 실패가 `release()` 를 막지 않도록 방어 로직 보강 (`codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-657`).
2. `scope` WARNING — 향후 `--impl-prep`/`--impl-done` "선례" 우회를 쓸 때 5개 checker 전부에 리다이렉트 블록을 일관 적용하거나, 실제 관련 spec 파일을 target 으로 받는 호출 방식으로 개선. 이번 PR 코드 자체의 결함은 아니므로 이 changeset 재작업은 불요.
3. (INFO, 선택) `scope` INFO #2 — 무관 스코프 실행으로 나온 spec 공백 WARNING 2건이 실제 트래커(`spec-draft-nullable-notation-followups.md`)에 등재됐는지 별도 확인.
4. (INFO, 선택) `documentation` INFO #7 — 파일 최상단 JSDoc 에 신규 테스트 2건 존재를 한 문장 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced whitelist 7명 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(e2e 테스트 파일 1개 + plan/review 문서)와 무관 |
  | architecture | router 판단 — 아키텍처 변경 없음 |
  | dependency | router 판단 — 신규 의존성 추가 없음 |
  | database | router 판단 — 스키마/마이그레이션 변경 없음(테스트 코드만) |
  | concurrency | router 판단 — 동시성 관련 변경 없음 |
  | api_contract | router 판단 — 공개 API/인터페이스 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 문서 동기화 대상 아님 |
