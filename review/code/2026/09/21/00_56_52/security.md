# 보안(Security) 코드 리뷰 — schedule-dup-delete (00_56_52)

## 검토 범위

실질 코드 변경은 3개 파일이다: `codebase/backend/src/modules/schedules/schedules.service.ts`(`remove()` 의 트리거 삭제 판정을 `affected === 0` 명시 비교로), `codebase/backend/src/modules/schedules/schedules.service.spec.ts`(대응 유닛 테스트), `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`(신규 e2e). `CHANGELOG.md`·`plan/in-progress/*.md` 2건은 문서, 나머지(파일 7~42)는 `review/code/2026/09/21/00_06_01/**`·`review/code/2026/09/21/00_37_06/**`·`review/consistency/2026/09/20/23_37_12/**`의 이전 라운드 산출물로 실행 코드가 아니다.

이번 라운드는 직전 두 라운드(`00_06_01`, `00_37_06`)의 security 리뷰가 모두 위험도 **NONE**으로 판정한 뒤 그 결과를 반영해 누적된 최종 상태(`affected === 0` 명시 비교로 교체 완료)이다. 실제 파일(`Read`)로 대조한 결과 `codebase/backend/src/modules/schedules/schedules.service.ts`의 현재 상태가 diff 최종본과 일치함을 확인했다.

## 관점별 확인

1. **인젝션**: `m.delete(Trigger, triggerId)`, `scheduleRepository.delete({ id, workspaceId })` 모두 TypeORM 파라미터화 API. 신규 e2e의 raw SQL(`pg_advisory_xact_lock(hashtext($1))`, `SELECT trigger_id FROM schedule WHERE id = $1`, `SELECT COUNT(*)::text ... WHERE resource_id = $1`)도 전부 `$1` 플레이스홀더 바인딩 — 인젝션 경로 없음.
2. **하드코딩된 시크릿**: 없음. e2e의 `token`/`accessToken`은 `registerAndLogin`으로 런타임에 발급받고, `BASE_URL`은 환경변수 기본값(`http://backend-e2e:3011`)일 뿐 자격증명이 아니다.
3. **인증/인가**: `remove()`는 `findById(id, workspaceId)`로 워크스페이스 스코프를 먼저 확인한 뒤에만 `schedule.triggerId`를 얻으므로, 트랜잭션 안 `m.delete(Trigger, triggerId)`가 PK만으로 삭제해도 크로스테넌트 위험은 없다 — 이 설계는 diff 이전부터 있던 것이고(`triggerId`는 이미 workspace-scoped 조회 결과) 신규 회귀가 아니다. `else` 분기의 `scheduleRepository.delete({ id, workspaceId })`도 명시적으로 `workspaceId` 재스코프한다.
4. **입력 검증**: 이번 diff는 판정 로직(`affected` 비교)·에러 분기만 바꾸며 사용자 입력 처리 경로 자체를 바꾸지 않는다.
5. **OWASP Top 10**: 신규 취약점 없음. 원 결함(동시 DELETE 두 건이 `schedule.deleted` 감사 행을 중복 기록)은 감사 무결성 이슈였지 인가 우회는 아니었고, 이번 수정으로 진 쪽 요청이 비밀 정리·감사 기록을 건너뛰게 되어 오히려 정합성이 개선됐다.
6. **암호화**: 관련 변경 없음.
7. **에러 처리**: 클라이언트로 나가는 응답은 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' })`로 일관되게 일반화돼 있어 내부 정보 노출이 없다. 서버 로그(`this.logger.error`, `remove()`의 `.catch` 블록)에 `triggerId`와 `err.message`를 남기는 부분은 이번 diff 이전부터 있던 기존 코드(직전 라운드가 `git show eb94361cc^`로 대조 확인)이며, 서버 내부 로그에만 남고 클라이언트에는 노출되지 않는다.
8. **의존성 보안**: 신규 의존성 없음(`DeleteResult`는 이미 사용 중이던 `typeorm`의 기존 export).

## 발견사항

없음 — Critical/Warning 대상 보안 결함을 찾지 못했다.

- **[INFO]** 락 안 `m.delete(Trigger, triggerId)` 실패 시 서버 로그에 `triggerId`와 원본 에러 메시지를 그대로 남긴다 (신규 아님, 참고용 기록)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()`의 `.catch((err: unknown) => { ... this.logger.error(...) })` 블록
  - 상세: 클라이언트로 반환되는 예외는 일반화된 메시지만 담고, 이 로그는 서버 내부에서만 소비된다. 형제 경로(`TriggersService.remove()`, #1369/#1370)도 동일 패턴이며 이번 diff가 새로 만든 노출 표면이 아니다.
  - 제안: 현행 유지로 충분. 로그 수집/보관 정책(누가 열람 가능한지)은 이 diff 범위 밖.

## 요약

이번 diff는 `SchedulesService.remove()`의 동시 DELETE 감사 중복 결함을, 이미 검증된 "advisory lock + 락 보호 쓰기의 `affected === 0` 명시 판별" 패턴(형제 PR #1369·#1370과 동일 형태, 자매 함수 `rewriteTriggerConfigLocked`의 결정과도 일치)으로 닫는다. 모든 DB 작업이 TypeORM 파라미터화/바인딩된 raw SQL로 이뤄져 인젝션 경로가 없고, 워크스페이스 스코프 검증은 삭제 진입점(`findById`)에서 선행되어 트랜잭션 내부 PK 기반 삭제에도 크로스테넌트 위험이 없다. 클라이언트로 나가는 에러는 일반화된 메시지만 노출하며, 서버 로그의 내부 정보 노출은 이번 diff 이전부터 존재한 기존 패턴이다. 하드코딩된 시크릿·안전하지 않은 암호화·평문 전송·신규 의존성 취약점은 발견되지 않았다. 직전 두 라운드(`00_06_01`, `00_37_06`)의 security 리뷰가 이미 이 서비스 로직 전체를 NONE으로 판정했고, 이번 diff(최종 `=== 0` 명시 비교 반영본)는 그 판정을 뒤집을 요소를 도입하지 않는다.

## 위험도

NONE
