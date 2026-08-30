# 보안(Security) 코드 리뷰

## 발견사항

없음. 이번 diff 를 8개 관점(인젝션·시크릿·인증인가·입력검증·OWASP Top10·암호화·에러처리·의존성) 전부 대조했고, 새로 도입된 취약점은 발견되지 않았다.

### 확인한 근거

- **SQL 인젝션**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `updateExecutionStatus` else 분기(신규 트랜잭션 래핑 부분, 대략 8698~8734행)는 기존과 동일하게 `$1`~`$8` 파라미터 바인딩만 쓰고, 문자열 보간은 `elseStatusesSql`(`NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL`, 522행·543행에 선언된 `Object.values(ExecutionStatus)` 기반 **static 상수**)뿐이다. 사용자 입력이 SQL 문자열에 직접 섞이는 경로는 없다. 이번 변경은 이 UPDATE 를 `this.dataSource.transaction(async (manager) => { manager.query(...) })` 로 옮긴 것뿐이라 인젝션 표면 자체가 바뀌지 않았다.
- **하드코딩된 시크릿**: `CHANGELOG.md`, `execution-engine.service.ts`/`.spec.ts`, `plan/**`, `review/**`, `spec/**` 전 파일에서 API 키·비밀번호·토큰·인증서 패턴을 grep 했으나 코드성 시크릿은 없었다(`plan/in-progress/update-returning-tuple-shape.md` 등에서 "secret-store.md" 라는 **문서 파일명**을 인용한 것뿐).
- **인증/인가**: 이번 diff 는 `updateExecutionStatus` 내부 트랜잭션 경계와 `finishStatusTransition` 헬퍼 추출뿐으로, 인증/인가 검사 로직에는 손대지 않았다. 상태 전이 자체는 기존과 동일하게 `assertTransition` + `status IN (...)` guarded UPDATE 로 지켜진다.
- **입력 검증**: 함수 인자(`execution`, `newStatus`, `linkedNodeExec`, `opts`)는 이미 내부 서비스 계층에서 타입이 고정된 값이고, HTTP 경계의 사용자 원본 입력이 아니다. `execution.outputData`/`resumeCallStack`/`error` 는 `JSON.stringify` 로 파라미터 바인딩되어 SQL 문자열에 섞이지 않는다(기존과 동일).
- **에러 처리**: `updateReturningRows` 가 shape 위반 시 던지는 `Error` 메시지에 `execution.id`/`newStatus` 가 포함되지만(`update-returning-rows.ts:66-68`), 이 헬퍼와 그 호출 형태는 이번 diff 이전부터 존재했고 이번 변경이 새로 노출 표면을 넓히지 않았다. execution id 는 비밀정보가 아니며, 이 예외가 HTTP 응답으로 그대로 나가는지는 이번 diff 범위 밖(글로벌 예외 필터 담당)이라 새로운 결함으로 보지 않는다.
- **의존성 보안**: 이번 diff 는 `package.json`/lockfile 변경이 없다. TypeORM `dataSource.transaction` API 사용은 기존에도 짝-전이(`linkedNodeExec`) 분기가 쓰던 것과 동일한 관용구를 else 분기에도 맞춘 것뿐이다.
- **오히려 개선된 지점**: 이 변경은 shape 가드가 발동했을 때 이미 커밋된 UPDATE 를 롤백하지 못해 "DB 는 terminal 인데 종결 이벤트가 유실되는" 정합성 결함을 트랜잭션 래핑으로 닫는다 — 가용성/무결성 측면에서 방어적 개선이다.

review/code/2026/08/30/17_36_15/security.md(선행 라운드, 같은 코드 변경에 대한 리뷰)도 동일하게 위험도 NONE 으로 판정했으며, 이번 독립 재검토도 그 결론과 일치한다.

이번 diff 에 함께 포함된 `plan/in-progress/*.md`, `spec/**/*.md`, `review/code/2026/08/30/17_36_15/**`, `review/consistency/2026/08/30/17_49_59/**` 등은 문서/plan 그루밍·이전 리뷰 세션 산출물이며 실행 코드가 아니라 보안 표면에 영향이 없다.

## 요약

이번 변경은 `ExecutionEngineService.updateExecutionStatus` 의 else 분기 guarded UPDATE 를 `dataSource.transaction` 으로 감싸 shape-위반 throw 시 실제 롤백을 보장하도록 만든 정합성 fix 이며, SQL 은 처음부터 끝까지 파라미터 바인딩만 쓰고 문자열 보간 대상은 사용자 입력이 아닌 static enum 상수뿐이라 인젝션 위험이 없다. 시크릿 하드코딩, 인증/인가 우회, 입력 검증 누락, 안전하지 않은 암호화, 의존성 취약점 등 다른 OWASP Top 10 항목에서도 이번 diff 가 새로 만든 문제는 없었다. 오히려 "가드가 발동한 순간 무기한 대기가 생기는" 정합성 결함을 닫아 안정성이 개선됐다.

## 위험도
NONE
