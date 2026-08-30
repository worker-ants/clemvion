# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus` else 분기의 guarded raw UPDATE 를 `this.dataSource.transaction()` 으로 감싸도록 변경 (기존 `this.executionRepository.query()` 단발 호출 → `manager.query()` 트랜잭션 내부 호출).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 변경을 검증하는 테스트 mock 배선(`mockTxManagerQuery` 가 `UPDATE execution` SQL 을 기존 `mockExecutionRepo.query` 로 위임) 및 신규 테스트 2건(롤백 관측, 정상 경로 트랜잭션 경유 확인) 추가.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`, `plan/in-progress/update-returning-tuple-shape.md` — 문서(plan 트래커) 체크박스·서술 갱신, 코드 변경 없음.

## 발견사항

발견된 보안 취약점 없음. 점검한 항목별 근거:

- **SQL 인젝션**: 변경된 UPDATE 문은 기존과 동일하게 `$1`~`$8` 파라미터 바인딩을 그대로 사용한다 (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `updateExecutionStatus`). SQL 문자열에 직접 삽입되는 유일한 비-파라미터 부분은 `${elseStatusesSql}` 인데, 이는 `NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 정적 상수(같은 파일 522~552행, `Object.values(ExecutionStatus)` — enum 값만으로 구성)로, 사용자 입력이 개입할 여지가 없다. 이번 diff 는 이 조립 방식 자체를 바꾸지 않고 기존 쿼리를 트랜잭션 콜백 안으로 옮긴 것뿐이라 인젝션 표면에 변화가 없다.
- **하드코딩된 시크릿**: 신규/변경 코드 어디에도 자격증명·토큰·키 리터럴 없음.
- **인증/인가**: 변경은 이미 인가된 실행 컨텍스트 내부의 상태 전이 로직이며, 인가 검증 경로(`WHERE status IN (...)` 가드)는 변경 전과 동일하게 유지된다. 오히려 트랜잭션화로 인해 "가드가 막으려던 상태(불일치 반영)가 가드 발동 순간에 발생"하던 기존 결함이 닫힌다 — throw 시 UPDATE 가 롤백되어 DB 상태와 애플리케이션 관측이 다시 일치한다.
- **입력 검증**: 이 변경은 사용자 입력 처리 경로가 아니라 내부 실행 엔진의 DB 쓰기 방식(트랜잭션 스코프)만 바꾼다. 새로 검증이 필요한 입력 지점 없음.
- **에러 처리**: 변경의 핵심 목적 자체가 에러 처리 개선이다 — 이전엔 `updateReturningRows` 가 shape 위반에 throw 해도 이미 커밋된 UPDATE 를 되돌릴 수 없어 "DB 는 terminal, 종결 이벤트는 미발행, stuck-recovery 스캔에도 안 잡힘"이라는 관측 불가능한 상태가 남았다. 트랜잭션으로 감싸 throw 가 UPDATE 를 롤백하게 함으로써 이 창(window)을 닫았다. 에러 메시지에 민감정보를 노출하는 신규 코드는 없다(`updateReturningRows` 호출부 로그 문자열은 `execution.id`/상태값만 포함).
- **암호화**: 해당 없음(암호화·해시 로직 변경 없음).
- **의존성**: 신규 의존성 추가 없음. `dataSource.transaction()` 은 기존에도 짝 전이(`linkedNodeExec`) 분기에서 이미 사용 중이던 TypeORM API 로, 사용 패턴을 일관되게 확장한 것뿐이다.
- **테스트 파일(`execution-engine.service.spec.ts`)**: mock 전용 변경이며 프로덕션 경로에 영향 없음. `mockTxManagerQuery` 가 `UPDATE execution` 패턴 매칭 후 기존 `mockExecutionRepo.query` 로 위임하는 방식도 테스트 인프라 내부 로직이라 보안 영향 없음.

## 참고 (보안 인접, 참고용 — 등급 부여 대상 아님)

- 트랜잭션 스코프가 넓어지며 해당 UPDATE 가 커넥션 풀 커넥션을 짧게나마 트랜잭션 컨텍스트에서 점유하게 되지만, 단일 UPDATE + RETURNING 뿐이라 장기 잠금이나 DoS 성 자원 고갈 우려는 없다고 판단된다(가용성 관점 참고 사항이며 보안 취약점은 아님).

## 요약

이번 diff 는 `updateExecutionStatus` else 분기의 guarded UPDATE 를 트랜잭션으로 감싸 "shape 위반 throw 가 이미 커밋된 UPDATE 를 되돌리지 못하던" 데이터 정합성 결함을 닫는 변경이다. SQL 은 기존과 동일하게 파라미터 바인딩되고, 비-파라미터 부분(`elseStatusesSql`)은 enum 기반 정적 상수로 사용자 입력과 무관하다. 인증/인가·시크릿·입력검증·암호화·의존성 어느 항목에서도 신규 취약점이나 회귀가 발견되지 않았고, 오히려 에러 처리(롤백 보장)가 개선되었다. 함께 포함된 spec 파일 변경과 plan 문서 변경도 보안 영향이 없다.

## 위험도

NONE
