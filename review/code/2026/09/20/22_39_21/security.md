# Security Review — 트리거 동시 DELETE 감사 중복 수정 + 후속 RESOLUTION(SUMMARY#3/#4) 반영

## 발견사항

없음 (Critical/Warning 대상 없음).

### 검토 세부

- **인증/인가**: `TriggersService.remove()` 는 기존과 동일하게 `findById(id, workspaceId)` 로 워크스페이스
  범위 조회를 하고, 신규 추가된 락 안 재조회(`m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } })`,
  `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()`)도 동일하게 `workspaceId` 스코프를
  유지한다. 다른 워크스페이스의 트리거 id 로는 재조회가 걸리지 않아 크로스-테넌트 접근·인가 우회가 생기지 않는다.
- **인젝션**: 재조회는 TypeORM `findOne({ where: {...} })` 객체 스타일로 파라미터 바인딩되어 SQL 인젝션 경로가
  없다. 신규 e2e(`codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`)의 raw SQL 도
  `pg_advisory_xact_lock(hashtext($1))`(락 획득)과 `WHERE resource_id = $1`(감사 카운트 조회) 모두 `$1`
  파라미터 바인딩을 쓴다. lock key 생성 함수 `triggerConfigLockKey()`(`trigger-config-lock.ts`, 이번 diff
  밖의 기존 헬퍼)는 단순 문자열 연결이지만 그 결과가 쿼리 파라미터로만 전달되므로 인젝션 벡터가 아니다.
- **에러 처리 / 정보 노출**: 락 뒤 행 부재 시 `throwTriggerNotFound()`(일반 메시지 `'Trigger not found'`,
  `code: 'RESOURCE_NOT_FOUND'`)만 클라이언트에 반환되고 내부 사유는 노출되지 않는다. `.catch` 블록의
  `this.logger.error(...)`는 `err.message`를 포함하지만 서버 사이드 로그로만 남고 HTTP 응답에는 실리지
  않는다 — 형제 워크플로/워크스페이스 삭제 수정과 동일한 패턴이라 신규 노출 표면이 아니다. 오히려 이번
  diff 는 `if (err instanceof NotFoundException) throw err;` 를 추가해 "정상적인 경합 패배(404)"를
  "반쯤 삭제된 상태" 오류 로그로 잘못 승격시키던 거짓 경보를 없앤 개선이다. 후속 SUMMARY#4 로 추가된
  단위 테스트(`triggers.service.spec.ts` "remove() — genuine 삭제 실패는 반쯤 삭제된 상태를 logger.error 로
  남긴다")는 이 구분이 실제로 지켜지는지(404 케이스는 로그 없음, genuine 실패만 로그) 뮤테이션으로 검증한
  것으로, 로그 정확성 측면에서 개선이지 보안 결함이 아니다.
- **하드코딩된 시크릿**: 신규/변경 코드·테스트에 하드코딩된 API 키·비밀번호·토큰 없음. e2e 는
  `registerAndLogin` 으로 런타임에 JWT 를 발급받고, endpoint path 는 `crypto.randomUUID()` 로 생성한다.
- **후속 RESOLUTION 커밋 검토** (이번 라운드가 추가로 담은 두 코드 커밋):
  - `931877519`(SUMMARY#3): e2e 의 advisory lock key 를 문자열 리터럴에서 `triggerConfigLockKey` import 로
    교체. 동작 변경 없이 기존에 이미 export 된 순수 함수를 재사용하는 리팩터라 보안적으로 중립.
  - `4abc730cb`(SUMMARY#4): genuine 삭제 실패 시 `logger.error` 호출 자체를 단언하는 신규 단위 테스트
    추가. 테스트 전용 변경이며 mock 기반이라 프로덕션 코드·공격 표면에 영향 없음.
- **동시성 수정의 보안적 함의**: 이 변경은 advisory lock 획득과 행 존재 확인 사이의 TOCTOU 간극을 닫아,
  동시 DELETE 경합에서 패자가 이중으로 감사 로그·비밀 정리(`releaseSecretsAfterCommit`)를 수행하지 않도록
  한다(신규 단위 테스트가 `repo.remove`/`audit.record`/`deleteByPrefix` 모두 미호출을 단언). 감사 추적
  신뢰성 저하를 막는 수정이며 새로운 인가 우회나 자원 누수 경로를 만들지 않는다.
  - 다만 이 diff 는 **외부 provider teardown(chat-channel 등) 중복 호출**은 닫지 않는다(락 밖·무락
    선조회 직후 실행되는 `releaseExternal` 이 동시 DELETE 두 건 모두에서 호출됨). 이는 이전 라운드
    (`review/code/2026/09/20/22_07_23` side_effect/concurrency WARNING #1)에서 이미 지적·실측(500 유발이나
    처리 중단으로는 이어지지 않는 best-effort·실패 삼킴 구조)되었고, `plan/in-progress/trigger-dup-delete.md`
    "이 PR 이 하지 않는 것"과 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 후속
    항목으로 명시적으로 등재되어 있다. 새 결함이 아니라 이미 문서화된 잔여 노출이므로 여기서는 재플래그하지
    않는다(WARNING 아님).
  - `SchedulesService.remove()`(`schedules.service.ts:345`, `scheduleRepository.remove` 가 락·재조회 없이
    호출됨) 자신의 스케줄 행 삭제도 같은 형태의 감사 중복 가능성이 남아 있다는 사실이 이번 diff 의 plan/
    tracker 문서(파일 5, 6)에 정확히 기록되어 있다 — 이번 PR 의 코드 변경 범위(트리거 자리) 밖이며, 별도
    developer 항목으로 등재되어 은폐되지 않았다.
- **문서/plan/JSON 산출물 (파일 1, 5~30)**: CHANGELOG·plan·이전 리뷰 라운드(`22_07_23`, `21_43_47`)의
  SUMMARY/RESOLUTION/각 reviewer 산출물·JSON 상태 파일을 훑었다. 하드코딩된 시크릿·자격증명·평문 토큰
  없음. 언급되는 `secretRef`/`botToken`/`notification_secret_v2` 등은 모두 서술(architecture 설명)이지
  실값이 아니다.
- **의존성**: 신규 의존성 추가 없음 (`@jest/globals`, `pg`, `supertest`, `node:crypto` 모두 기존 사용 패턴).

### 뮤테이션 검증 관련 메모

이 리뷰는 병렬 fan-out 정책에 따라 저장소 파일을 직접 뮤테이션하지 않았다(읽기 전용 검토로 충분히
판단 가능했다). `git status --short` 로 확인한 결과 이 세션이 만든 잔여 변경은 없다.

## 요약

이번 변경(트리거 삭제 advisory lock 뒤 재조회 추가 + 형제 리뷰 라운드의 RESOLUTION 커밋 2건)은 보안
관점에서 새로운 취약점을 도입하지 않는다. 워크스페이스 스코프 검증이 신규 쿼리에도 그대로 유지되고,
모든 쿼리가 파라미터 바인딩되어 있으며, 에러 응답은 일반화된 메시지만 노출하고 상세 사유는 서버 로그
에만 남는다(오히려 거짓 경보를 줄여 로그 신뢰성을 개선했다). 하드코딩된 시크릿, 인증/인가 우회, 인젝션
벡터는 발견되지 않았다. 이미 문서화된 외부 provider teardown 중복 호출·`SchedulesService.remove()` 잔여
노출은 이번 diff 의 스코프 밖으로 명시적으로 분리·등재되어 있어 은폐가 아니다.

## 위험도

NONE
