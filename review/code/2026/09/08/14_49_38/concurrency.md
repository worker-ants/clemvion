# 동시성(Concurrency) 코드 리뷰

## 발견사항

이번 배치(B-1~B-8, 51개 파일 diff)는 대부분 문서(`CHANGELOG.md`, `PROJECT.md`, plan 파일), 테스트/가드(`*.spec.ts`, `*-guard.ts`), 타입 개명(`WorkflowVersionDetailProjection`), DB 컬럼 투영(`WorkspacesService.listMembers`), 순수 정적 분석 헬퍼(`source-scan.ts`)로 구성되어 있고, 동시성 문제가 발생할 수 있는 공유 가변 상태·락·스레드/워커 도입은 없다. 동시성 관점에서 실제로 살펴볼 가치가 있는 유일한 축은 "DB unique constraint race window" 처리 코드였다.

- **[INFO]** unique-violation race 처리 로직은 순수 리팩터(SoT 통합)이며 동작 변화 없음 — 확인만
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts`(`GlobalExceptionFilter.catch`, `isUniqueViolation` 로컬 함수를 `pg-error.ts`의 `isPostgresUniqueViolation`으로 교체), `codebase/backend/src/modules/integrations/integration-oauth.service.ts`(`createPrivatePendingIntegration`·`handleMakeshopInstall`의 `catch (err)` 블록, 손으로 짠 `constraint = err.constraint ?? err.driverError?.constraint` 추출을 `pgErrorConstraint(err)`로 교체)
  - 상세: 두 자리 모두 "애플리케이션 단 사전 체크 통과 후 동시 두 요청이 모두 INSERT를 시도해 DB의 UNIQUE 제약(`STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 등)에서 걸리는" race window를 다룬다. 이는 app 레벨 락이나 TOCTOU 취약 조건부 UPDATE가 아니라 **DB가 원자적으로 강제하는 unique 제약을 catch해 409로 변환**하는 정석적인 낙관적 동시성 처리 패턴이며, 이번 diff는 그 판정 로직(`err.code`/`err.driverError.code`·`err.constraint`/`err.driverError.constraint` 두 표면 흡수)을 `pg-error.ts` 헬퍼로 중복 제거했을 뿐 판정 결과·분기 흐름은 동일하다(`pgErrorConstraint`가 기존 인라인 코드와 동일한 fallback 순서를 그대로 구현). `GlobalExceptionFilter`는 NestJS 싱글턴이지만 `catch()` 메서드 내부 상태는 전부 지역 변수이고 `this`에 가변 필드를 쓰지 않으므로 동시 요청 간 상태 공유·경쟁 문제가 없다. 신규 e2e 테스트(`codebase/backend/test/webhook-trigger.e2e-spec.ts` B4)도 같은 클래스의 기존 프로덕션 코드(`triggers.service.ts`의 `rethrowEndpointPathConflict`, 이번 diff의 수정 대상 아님)가 실제 DB에서 올바르게 409로 변환되는지 처음으로 검증했고, 결과는 정상이었다.
  - 제안: 조치 불요. 이 패턴(낙관적 삽입 + DB 제약 catch)은 애플리케이션 레벨 뮤텍스보다 안전한 동시성 처리 방식이며 이번 diff가 이를 약화시키지 않았다.

- **[INFO]** `.claude/test-stages.sh`의 `_cmd_typecheck_ratchets()`가 두 독립적인 typecheck 스크립트를 `&&`로 순차 실행 — 애플리케이션 동시성과 무관
  - 위치: `.claude/test-stages.sh` (`_cmd_typecheck_ratchets`, `cmd_build()` 호출부)
  - 상세: CI/로컬 빌드 파이프라인 단계이며 런타임 애플리케이션 코드의 동시성 모델과는 무관하다. 두 스크립트(backend/frontend typecheck ratchet)는 서로 다른 프로세스이므로 데드락·경쟁 조건 대상이 아니다(단순 순차 실행 시간 문제이며 성능 리뷰 영역).
  - 제안: 조치 불요(참고용 기록).

## 요약

이번 diff에서 신규로 도입되거나 수정된 공유 가변 상태, 락/뮤텍스, async/await 사용, Promise 체인, 스레드/커넥션 풀 관리는 없다. 동시성과 접점이 있는 유일한 코드(전역 예외 필터·OAuth 서비스의 unique-violation race 처리)는 기존에 이미 올바르게 구현되어 있던 "낙관적 삽입 + DB 제약 위반 catch" 패턴을 `pg-error.ts` SoT로 중복 제거한 순수 리팩터로, 판정 로직·분기 결과에 변화가 없음을 직접 코드 대조로 확인했다. DB 투영으로 바뀐 `WorkspacesService.listMembers`도 단일 쿼리·단일 요청 스코프라 동시성 이슈가 없다. 종합적으로 동시성 관점의 리스크는 발견되지 않았다.

## 위험도

NONE
