# 보안(Security) 코드 리뷰

## 범위

이번 diff 는 `SchedulesService.remove()` 의 동시 DELETE 두 건이 `schedule.deleted` 감사 행을 두 번
남기던 결함(형제 PR #1369·#1370 과 같은 결함 클래스, CASCADE 로 판정 대상만 다름)을 닫는 동시성/
감사-무결성 정정과, 그에 대한 이전 라운드(00_06_01, 00_37_06, 00_56_52) 리뷰의 후속 조치
(`throwScheduleNotFound()` 헬퍼 추출, `affected === 0` 명시 비교 전환, null/undefined 대조군 테스트
추가, CHANGELOG 반영)로 구성된다. 실행 코드가 있는 파일은 3개
(`schedules.service.ts`, `schedules.service.spec.ts`, `schedule-delete-concurrency.e2e-spec.ts`)이고
나머지는 `plan/**`·`review/**` 산출물(마크다운/JSON)로 보안 스캔 대상 표면이 없다.

직접 실행(`Read`)한 현재 파일 내용, `git show`(2879e88c7, 210808701)로 이번 라운드에 추가된 diff,
`git status --short`(작업 트리에 이번 리뷰 산출물 디렉터리 외 잔여 변경 없음)를 확인했다.

## 발견사항

- **[INFO]** 삭제 실패 로그에 내부 식별자와 원본 에러 메시지를 그대로 남긴다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 의 `.catch` 블록,
    `this.logger.error(...)` 호출부 (약 353행대)
  - 상세: `triggerId` 와 `err.message` 를 서버 로그(`Logger.error`)에 남긴다. 클라이언트로 반환되는
    예외는 `{ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' }` 로 일반화되어 있어 API 응답을
    통한 정보 노출은 없다. 형제 경로(`TriggersService.remove()`, #1369/#1370)도 동일 패턴이라 이 diff 가
    새로 만든 노출 표면이 아니다.
  - 제안: 현행 유지로 충분. 로그 접근 통제는 이 diff 범위 밖.

- **[INFO]** 트리거 삭제(`m.delete(Trigger, triggerId)`)가 트랜잭션 내부에서 `workspaceId` 로
  재스코프되지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 내
    `const { affected } = await m.delete(Trigger, triggerId);` 줄
  - 상세: `triggerId` 는 함수 진입부 `findById(id, workspaceId)`(diff 밖 기존 코드, `findById` 정의는
    136-143행)로 이미 workspace-scoped 조회를 거친 `schedule.triggerId` 이므로 실제 크로스-테넌트
    위험은 없다. PK 단독 삭제라는 스코프 방식 자체는 이 diff 이전부터 있던 기존 코드이며, 이번에 추가된
    `affected === 0` 판별자 도입은 이 관점에 영향을 주지 않는다. 신규 결함 아님.

- **[INFO]** `affected` 가 `null`/`undefined`(드라이버가 보고하지 않음)일 때 삭제가 실제로 일어났다는
  보장 없이 감사 기록·비밀 정리까지 그대로 진행한다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — 두 `if (affected === 0) this.throwScheduleNotFound();` 판정부(트리거 경로·`triggerId` 없는 방어 분기)
  - 상세: `!affected` → `affected === 0` 전환(커밋 `2879e88c7`)은 "모른다(null/undefined)를 없다(0)로
    읽지 않는다"는 자매 함수 `rewriteTriggerConfigLocked` 의 기존 정책을 그대로 따른 것이고, 새 대조군
    테스트(커밋 `210808701`)가 이 분기를 실제로 실행 검증한다. 감사 로그 무결성 관점에서는 "드라이버가
    보고하지 않는 극히 드문 경우 삭제되지 않았는데도 감사가 남을 수 있다"는 이론적 잔여가 있으나, 이는
    이미 검증된 형제 서브시스템의 정책을 일관되게 적용한 결과이며 이 diff 가 새로 도입한 위험이 아니다.

## 긍정적으로 확인한 점

- 모든 DB 조작이 TypeORM repository API(`m.delete(Trigger, triggerId)`,
  `this.scheduleRepository.delete({ id, workspaceId })`)를 통하며, `schedule-delete-concurrency.e2e-spec.ts`
  의 raw SQL 도 전부 `$1` 플레이스홀더로 파라미터화되어(`SELECT trigger_id FROM schedule WHERE id = $1`,
  `pg_advisory_xact_lock(hashtext($1))`, 감사/스케줄 잔존 확인 쿼리) SQL 인젝션 표면이 없다.
- `findById`·else 분기 삭제 모두 `{ id, workspaceId }` 로 스코프되어 있어 테넌트 격리가 유지된다.
- 클라이언트로 반환되는 에러는 `throwScheduleNotFound()` 헬퍼(신규 추출)를 통해
  `{ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' }` 로 항상 일관되게 일반화되며, 트리거
  존재 여부·타이밍 차이를 통한 열거(enumeration) 공격 표면을 만들지 않는다.
- `.catch` 에서 `NotFoundException` 을 먼저 분리해 재던짐으로써, 동시 삭제로 인한 정상적인 패자 케이스가
  "반쯤 삭제됨" 경고 로그로 오분류되지 않는다 — 로그 기반 운영 대응의 신호 대 잡음비를 개선한다.
- 비밀 삭제(`deleteTriggerSecretsAfterCommit`)는 트랜잭션이 트리거 행을 실제로 지운 뒤(커밋 후)에만
  호출되도록 순서가 유지되어, 패자 요청이 이미 지워진 비밀을 중복 삭제하거나 살아있는 트리거의 비밀을
  잘못 지우는 경로가 없다.
- advisory lock(`acquireTriggerConfigLock`)에 타임아웃(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)이 있어 동시
  삭제 경합이 무한 대기로 이어지는 DoS 벡터가 없다(기존 코드 유지, 이 diff 가 변경하지 않음).
- 하드코딩된 시크릿/자격증명 없음 — `grep` 으로 3개 코드 파일을 전수 확인, `SecretResolverService` 는
  추상화 계층 참조일 뿐 리터럴 값이 아니다. e2e 의 `BASE_URL` 기본값(`http://backend-e2e:3011`)도
  민감정보가 아니다.
- 뮤테이션 검증(커밋 메시지 인용): `affected === 0` 판정을 지우는 뮤턴트가 RED 로 죽고, 되돌리는
  뮤턴트(`=== 0` → `!affected`)가 이번 라운드에서 추가된 대조군 2건으로 GREEN→RED 전환됨을 실측 —
  판정 로직이 테스트로 실제 보호되고 있음을 뒷받침한다.
- 작업 트리 확인: `git status --short` 결과 이번 리뷰 산출물 디렉터리(`review/code/2026/09/21/01_16_46/`)
  외 잔여/오염된 변경 없음.

## 요약

이번 diff 는 스케줄 삭제 경로의 동시성 결함(감사 로그 중복)을 닫고, 이전 리뷰 라운드에서 지적된
maintainability(리터럴 3중 복제) 및 concurrency(truthiness→명시 비교) 항목을 후속 조치한 것이다.
모든 DB 접근이 파라미터화되어 있고, 테넌트 스코핑이 유지되며, 클라이언트 노출 에러는 일반화되어 있고,
새로 도입된 하드코딩 시크릿이나 인증/인가 우회 경로는 없다. 오히려 감사 로그 무결성을 개선하는 방향의
변경이다. 남긴 세 건은 모두 기존 코드/정책을 그대로 유지·적용한 INFO 성격이며 이 diff 가 새로 만든
취약점이 아니다.

## 위험도

NONE
