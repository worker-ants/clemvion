# 보안(Security) 리뷰 — schedule-dup-delete (00_37_06)

## 검토 범위

실질 코드 변경은 4개 파일이다:

- `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 의 트리거 삭제 판정을 `affected` 기반으로 바꾸고, `NotFoundException` 리터럴 3중 복제를 `throwScheduleNotFound(): never` 헬퍼로 추출
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 위 변경에 대응하는 mock 계약 변경(`delete` 가 `affected` 를 반환) + 0-affected → 404 방어 분기 대조 테스트 2건 추가
- `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts` — advisory lock 을 직접 쥐어 동시 DELETE 겹침을 재현하는 신규 e2e
- `CHANGELOG.md` — 이번 수정 항목 문서화

나머지(`plan/in-progress/**`, `review/code/2026/09/21/00_06_01/**`, `review/consistency/2026/09/20/23_37_12/**`)는 plan 문서·이전 리뷰/consistency-check 산출물이며, 코드가 아니라 검토 대상에서 실질 보안 표면이 없다. 이 산출물들은 **직전 리뷰 라운드(`00_06_01`)의 SUMMARY#1~#4를 조치(commit `893dfeb7a`·`69889f74e`·`131296205`)한 결과**로, 그 라운드의 security 리뷰(`review/code/2026/09/21/00_06_01/security.md`)가 이미 이 서비스의 핵심 로직(락, 트랜잭션, 판정 분기)을 검토해 위험도 NONE 으로 판정한 바 있다. 이번 라운드의 diff는 그 판정 이후 추가된 헬퍼 추출·신규 테스트·CHANGELOG 뿐이므로, 아래는 그 갭만 재검증한 결과다.

## 관점별 확인

1. **인젝션**: `m.delete(Trigger, triggerId)`, `scheduleRepository.delete({ id, workspaceId })` 모두 TypeORM 파라미터화 API. e2e 신규 파일의 raw SQL(`pg_advisory_xact_lock(hashtext($1))`, `SELECT trigger_id FROM schedule WHERE id = $1` 등)도 전부 `$1` 플레이스홀더 바인딩 — 인젝션 경로 없음.
2. **하드코딩된 시크릿**: 없음. `token`/`accessToken` 은 e2e 테스트 안에서 `registerAndLogin` 로 런타임에 발급받는 값이며, 코드에 고정 자격증명 없음.
3. **인증/인가**: `remove()` 는 여전히 `findById(id, workspaceId)` 로 워크스페이스 스코프를 먼저 확인한 뒤에만 `triggerId` 를 얻으므로, 트랜잭션 안 `m.delete(Trigger, triggerId)` 가 `workspaceId` 재검사 없이 순수 PK 로 삭제해도 크로스테넌트 위험은 없다 — 이 설계는 이번 diff 이전부터 있던 것이고 직전 라운드에서 이미 INFO 로 확인됨(신규 회귀 아님).
4. **입력 검증**: 이번 diff 는 사용자 입력 처리 경로를 바꾸지 않는다(경합 판정 로직·에러 분기만 변경). 신규 방어 분기(`triggerId` 없음 → `scheduleRepository.delete` 의 `affected` 판정)도 사용자 입력을 직접 받지 않는다.
5. **OWASP Top 10**: 신규 취약점 없음. 동시 요청 중복 감사 문제는 무결성(logging integrity) 이슈였지 인가 우회는 아니었고, 이번 수정으로 오히려 "진 쪽" 요청이 감사·비밀 정리를 건너뛰게 되어 정합성이 개선됐다.
6. **암호화**: 해당 변경 없음.
7. **에러 처리**: 클라이언트로 나가는 응답은 `NotFoundException({code:'RESOURCE_NOT_FOUND', message:'Schedule not found'})` 로 일반화돼 있어 내부 정보 노출 없음. 서버 로그(`this.logger.error`, 349행 부근)에 `triggerId` 와 `err.message` 를 남기는 부분은 `git show eb94361cc^` 대조 결과 **이번 diff 이전부터 있던 코드**이며 이번 세션에서 새로 추가되지 않았다 — 서버 로그 한정이고 클라이언트에는 노출되지 않으므로 조치 불요.
8. **의존성 보안**: 신규 의존성 없음(`DeleteResult` 는 이미 사용 중이던 `typeorm` 의 기존 export).

## 발견사항

없음 — Critical/Warning 대상 보안 결함을 찾지 못했다.

- **[INFO]** 서버 로그에 트리거 삭제 실패 시 `err.message` 를 그대로 남긴다(신규 아님)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 의 `.catch((err: unknown) => {...})` 블록, `this.logger.error(...)` 호출
  - 상세: `git show eb94361cc^:codebase/backend/src/modules/schedules/schedules.service.ts` 로 대조하면 이 로그 문장은 이번 PR 이전부터 동일하게 존재했다. 클라이언트 응답은 `NotFoundException` 의 일반화된 메시지만 나가고, 이 로그는 서버 내부에서만 소비된다. 형제 경로(`TriggersService.remove()`)와 대칭이라는 주석대로 동일 패턴.
  - 제안: 조치 불요.

## 요약

이번 라운드의 diff는 CASCADE 로 인해 판정 기준이 형제 셋(#1369·#1370)과 다른 스케줄 삭제 경합 결함을 이미 검증된 "advisory lock + 락 보호 쓰기의 `affected` 판별" 패턴으로 닫은 직전 커밋(`eb94361cc`)에 대한 후속 조치(리터럴 헬퍼 추출, 방어 분기 실행 검증 테스트 2건, CHANGELOG 기록)로 구성된다. 모든 DB 작업이 TypeORM/파라미터화 raw SQL 로 이뤄져 인젝션 경로가 없고, 워크스페이스 스코프 검증은 삭제 진입점에서 선행되어 변경 후에도 유지되며, 클라이언트로 나가는 에러는 일반화된 메시지만 노출한다. 신규 테스트·e2e·CHANGELOG 는 코드 동작을 바꾸지 않는 검증/문서 추가일 뿐이라 보안 표면에 영향이 없다. 직전 리뷰 라운드가 이미 이 서비스 로직 전체를 NONE 판정했고, 이번 diff 는 그 판정을 뒤집을 요소를 도입하지 않는다.

## 위험도

NONE
