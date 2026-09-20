# 보안(Security) 코드 리뷰

## 범위

이번 변경은 `SchedulesService.remove()` 의 동시 DELETE 두 건이 `schedule.deleted` 감사 행을 두 번 남기던
결함을 고치는 **동시성/감사-무결성 정정**이다. 리뷰 대상 13개 파일 중 실제 코드는 3개
(`schedules.service.ts`, `schedules.service.spec.ts`, `schedule-delete-concurrency.e2e-spec.ts`)이고,
나머지 10개는 `plan/**`·`review/consistency/**` 산출물(마크다운/JSON 메타 문서)로 실행 코드가 아니다 —
보안 관점에서 점검할 표면(인젝션·인증·시크릿 등)이 존재하지 않아 정상 스캔했으나 발견사항 없음.

## 발견사항

- **[INFO]** 삭제 실패 로그에 내부 식별자와 원본 에러 메시지를 그대로 남긴다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:346-350` (`this.logger.error(...)`)
  - 상세: `trig-halt` 류의 `triggerId` 와 `err.message` 를 서버 로그(`Logger.error`)에 그대로 싣는다. 클라이언트로
    반환되는 예외(`NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' })`, 336-337·372-377행)는
    일반화된 메시지만 담아 정보 노출은 없다. 로그는 서버 내부에만 남고, 형제 경로(`TriggersService.remove()`,
    #1369/#1370)도 동일 패턴을 이미 쓰고 있어 이번 diff 가 새로 만든 노출 표면이 아니다 — 참고용 기록.
  - 제안: 현행 유지로 충분. 로그 수집/보관 정책(누가 열람 가능한지)은 이 diff 범위 밖.

- **[INFO]** 트리거 삭제(`m.delete(Trigger, triggerId)`)가 트랜잭션 내부에서 `workspaceId` 로 재스코프되지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:329` (`const { affected } = await m.delete(Trigger, triggerId);`)
  - 상세: `triggerId` 는 이 함수 진입부에서 `findById(id, workspaceId)`(300행대, diff 밖 기존 코드)로 이미
    workspace-scoped 조회를 거친 `schedule.triggerId` 이므로 실제 크로스-테넌트 위험은 없다. 다만 이 삭제
    호출 자체는 PK(`triggerId`)만으로 동작해 재스코프를 트랜잭션 안에서 재확인하지 않는다 — 이 diff 가
    새로 만든 것이 아니라 원래 코드(`await m.delete(Trigger, triggerId);`)의 스코프 방식을 그대로 유지한
    것이며, `affected` 판별자 도입은 이 관점에 영향을 주지 않는다. 신규 결함 아님, 기록만 남김.

## 긍정적으로 확인한 점

- 모든 DB 조작이 TypeORM repository/QueryBuilder 파라미터 바인딩을 통하며, raw SQL 이 개입하는 e2e 테스트
  (`schedule-delete-concurrency.e2e-spec.ts`)도 `$1` 플레이스홀더로 매개변수화되어 SQL 인젝션 표면이 없다
  (`SELECT trigger_id FROM schedule WHERE id = $1` 등).
- 클라이언트로 반환되는 에러는 `{ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' }` 로 일관되게
  일반화되어 있고, 존재 여부·타이밍을 통한 정보 노출(사용자 열거 등)을 유발하지 않는다.
- 이 diff 의 핵심 변경(`m.delete(Trigger, triggerId)` 의 `affected` 를 advisory lock 안에서 판별자로 삼아
  진 쪽을 404 로 끝내고, `.catch` 에서 `NotFoundException` 을 구분해 거짓 경보 로그를 남기지 않음)은
  경합 상태에서 감사 로그(`audit_log`)가 이중으로 남던 것을 막는다 — 이는 보안/컴플라이언스 관점에서
  감사 추적의 무결성을 개선하는 방향이며 새로운 취약점을 만들지 않는다.
- 비밀(트리거 서명 시크릿) 삭제(`deleteTriggerSecretsAfterCommit`)는 트랜잭션이 실제로 트리거 행을 지운
  뒤(커밋 후)에만 호출되도록 순서가 유지되어, 패자 쪽 요청이 이미 삭제된 비밀을 중복 삭제하거나 살아있는
  트리거의 비밀을 잘못 지우는 경로가 없다.
- 하드코딩된 시크릿/자격증명 없음. e2e 테스트의 `BASE_URL` 은 환경변수 기본값(`http://backend-e2e:3011`)일 뿐
  민감정보가 아니다.
- advisory lock 에 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)이 있어 동시 삭제 경합이 무한 대기로 이어지는
  DoS 벡터가 없다(기존 코드 유지).

## 요약

이번 변경은 스케줄 삭제 경로의 동시성 결함(중복 감사 로그)을 닫는 정정이며, 인젝션·인증/인가 우회·
시크릿 하드코딩·안전하지 않은 암호화·민감정보 노출 등 OWASP Top 10 관점에서 새로 도입된 취약점은
발견되지 않았다. 오히려 감사 로그 무결성을 개선하는 방향이다. 위에 남긴 두 건은 모두 기존 코드의
설계(로그 상세도, PK 기반 삭제 스코프)를 그대로 유지한 INFO 성격이며 이 diff 가 새로 만든 문제가 아니다.

## 위험도

NONE
