# 부작용(Side Effect) 리뷰 — `raceUnderHeldLock()` + 「검사 범위를 리스트로 좁힌」 라운드 2 fix

## 검토 범위와 방법

이번 라운드(`21_03_52`)는 이전 두 ai-review 라운드(`20_26_50`, `20_45_43`)가 이미 부작용 관점에서
검토를 마친 상태 위에서, 그 라운드들의 지적을 반영한 마지막 커밋
`905e1f696`(`docs(test): 내가 넣은 검사의 주장이 실제 범위보다 넓었다`)을 포함한 전체 브랜치
diff(`git diff origin/main...HEAD`)를 대상으로 한다. `git show 905e1f696 -- codebase/backend/test/helpers/concurrency.ts`
로 마지막 커밋의 순 변경분을 단독 확인했고, `codebase/backend/test/helpers/concurrency.ts` 전체를
`Read` 로 열어 프롬프트 게이트 줄 번호와 실제 파일 줄 번호가 일치함을 확인했다(1:1 일치, 별도 오프셋 없음).
9개 `*-delete-concurrency.e2e-spec.ts`(11 블록, `webauthn-credential` 두 블록 포함)의 diff 도
`git diff` 로 재조회해 헬퍼 치환 외 다른 변경이 없음을 확인했다. 저장소는 뮤테이션하지 않았다 —
`git status --short` 결과는 이 세션 자신의 출력 디렉터리(`review/code/2026/09/21/21_03_52/`)뿐이다.

## 발견사항

- **[INFO]** 신규 공용 헬퍼의 모듈 로드 시점 검사(fail-fast)가, 그 상수와 무관한 8개 e2e 스위트의
  로드 가능 여부까지 여전히 함께 묶는다 — 라운드 2 fix 는 이 결합 자체가 아니라 "검사 범위 문구"만 좁혔다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:12-14`(`KNOWN_LOCK_TIMEOUTS_MS` 선언, `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 단일 항목) 및 `:29-36`(모듈 최상위 `for...of` + `throw`)
  - 상세: `raceUnderHeldLock` 을 import 하는 9개 파일(`auth-config-` · `integration-` · `member-remove-` · `model-config-` · `schedule-` · `trigger-` · `webauthn-credential-` · `workflow-` · `workspace-delete-concurrency.e2e-spec.ts`) 전부가, 함수 호출 시점이 아니라 **모듈 평가 시점**에 이 `for` 루프를 실행한다. `KNOWN_LOCK_TIMEOUTS_MS` 관계(`VACUITY_GUARD_MS < TRIGGER_DELETE_LOCK_TIMEOUT_MS`)가 깨지면, 트리거/스케줄과 무관한 나머지 7개 스위트까지 "락 관계가 역전됐다"는 트리거 전용 에러 메시지로 함께 import 실패한다. 이 결합은 직전 라운드(`20_45_43/architecture.md`)가 WARNING 으로 지적했고, 마지막 커밋(`905e1f696`)의 커밋 메시지가 "받아들이지 않는다 — drift 를 막는 정상 수단이고 컴파일 에러로 즉시 시끄럽게 깨진다"는 근거로 명시적으로 반려했다. 실제로 고쳐진 것은 "assert 가 프로덕션 **전체** 최소 상한을 검사한다"던 JSDoc 의 과장 문구뿐이고(범위를 `KNOWN_LOCK_TIMEOUTS_MS` 로 명시), 모듈 로드 시점에 9개 스위트가 한 상수에 함께 걸리는 부작용의 **모양 자체는 변경 전과 동일**하다. 값이 둘 다 리터럴 상수(런타임 입력 없음)이고 실패가 즉시·명확한 에러 메시지로 드러나는 의도된 fail-fast 설계라 심각도는 낮다.
  - 제안: 조치 불요(저자가 이미 근거를 남기고 명시적으로 반려한 항목). 재지적은 "라운드 3 에서 다시 새로 생긴 문제"가 아니라 "라운드 2 fix 가 문구만 좁혔을 뿐 그 부작용 형태 자체는 남아 있다"는 사실을 기록하기 위함이다.

- **[INFO]** `KNOWN_LOCK_TIMEOUTS_MS` 목록이 사람이 갱신해야 하는 수동 레지스트리라는 한계가 이제 코드 주석으로 명시됐지만, 신규 항목 누락을 감지하는 자동 장치는 없다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:7-10`(JSDoc: "여기 있는 것만 검사된다 … 추가하지 않으면 검사는 통과하지만 그 호출부의 가드는 오탐한다")
  - 상세: 라운드 2 fix 는 "전역 최솟값" 이라는 과장을 "알려진 목록뿐" 이라는 정확한 문구로 좁혀 architecture reviewer 의 INFO(문서된 보장 > 실제 구현 범위 갭)를 해소했다 — 방향은 옳다. 다만 그 결과 이 검사는 여전히 **사람이 등재해야 통하는 화이트리스트**이고, 열 번째 호출부가 이 목록에 자신의 타임아웃 상수를 추가하지 않으면(주석은 "추가해야 한다"고 권고할 뿐 강제하지 않음) 공허성 가드가 조용히 오탐할 수 있는 경로가 코드 레벨에서 완전히 막히지는 않았다.
  - 제안: 현재 9개 호출부에는 결함이 아니다(실측된 마진 안). 이 리뷰의 스코프를 막을 사안은 아니며, 문서화된 한계이므로 추가 조치는 다음 호출부 추가 시점의 관례(convention)로 남겨두는 것으로 충분하다.

## 확인한 항목 (문제 없음 — 라운드 1·2 판정 재확인)

- **시그니처/인터페이스**: `raceUnderHeldLock()` 은 신규 export 이며 기존 공개 함수 시그니처를 바꾸지 않는다. 라운드 3 의 유일한 코드 변경(`905e1f696`)도 함수 시그니처(`locker, lock, fires`)·반환 타입(`Promise<T[]>`)을 그대로 유지한다 — `@throws`/`@example` 주석 보강과 모듈 최상위 검사 로직 리팩터뿐이다.
- **호출부 무변경**: 9개 e2e spec 파일은 이번 라운드(`905e1f696`)에서 전혀 수정되지 않았다(`git show --stat`으로 확인 — 변경 파일은 `concurrency.ts` + review 산출물뿐). 라운드 1(`8b3c81f7c`)에서 이미 검증된 락 순서·발사 순서·assertion 값이 그대로다.
- **트랜잭션/DB 부작용**: `BEGIN → lock.sql → Promise.all(fires) → Promise.race 공허성 가드 → COMMIT`, `finally` 의 `ROLLBACK`(no-op 커버)+`pending?.catch` 구조는 라운드 3 에서 손대지 않았다(`concurrency.ts:88-116`, 함수 본문 자체는 무변경 — 변경분은 함수 위 모듈 스코프뿐).
- **전역 변수**: `KNOWN_LOCK_TIMEOUTS_MS`·`VACUITY_GUARD_MS` 모두 모듈 스코프 `const`(불변 배열/불변 리터럴)이며 실행 중 재할당되지 않는다 — mutable 전역 아님.
- **환경 변수**: 이번 diff 에서 `process.env` 읽기/쓰기 변경 없음.
- **네트워크 호출**: `fireDelete`/`fireRemove`/`fireLeave` 의 `supertest` 호출 경로는 라운드 3 에서 전혀 건드리지 않았다.
- **파일시스템 부작용**: 코드 diff(`concurrency.ts`, `PROJECT.md`, 9개 spec, `plan/in-progress/e2e-race-helper.md`) 자체는 fs 를 건드리지 않는다. 함께 포함된 `review/code/2026/09/21/{20_26_50,20_45_43}/**`·`review/consistency/2026/09/21/19_59_55/**` 는 프로젝트가 강제하는 `/ai-review`·`consistency-check --impl-prep` 게이트의 정상 산출물로, 각 산출물을 만든 게이트 실행 시점의 커밋(`c95a983ac`/`6b29435ac`)에 정확히 동봉돼 있어 예상 밖의 생성이 아니다.
- **`@example` 정정**: `.sort()` → `.sort((a, b) => a - b)` 로 바뀐 것은 JSDoc 예시 코드일 뿐 실행되는 헬퍼 코드가 아니다 — 런타임 부작용과 무관한 문서 정정.
- **`codebase/backend/src/**` 변경 0 유지**: 전체 브랜치(`c95a983ac`~`905e1f696`)를 통틀어 프로덕션 코드 변경이 없다 — `TRIGGER_DELETE_LOCK_TIMEOUT_MS` import 는 읽기 전용이며 프로덕션 파일을 수정하지 않는다.

## 요약

라운드 3 의 실질 코드 변경은 `codebase/backend/test/helpers/concurrency.ts` 모듈 최상위의 fail-fast 검사를 "프로덕션 전체 최소 상한" 이라는 과장된 JSDoc 주장에서 "`KNOWN_LOCK_TIMEOUTS_MS` 에 등재된 것만" 이라는 정확한 범위로 좁힌 문서·검사-형태 정정과, `@throws`/`@example` JSDoc 보강뿐이다. 9개 e2e spec 호출부와 헬퍼 함수 본문(트랜잭션 경계·발사 순서·공허성 가드·`finally` 정리)은 이번 라운드에서 전혀 건드리지 않았고, 이전 두 라운드가 검증한 결론(신규 export·불변 모듈 상수·프로덕션 코드 무변경·assertion 무변경)이 그대로 유지된다. 유일하게 남는 주목점은 architecture reviewer 가 WARNING 으로 지적했던 "모듈 로드 시점 검사가 트리거와 무관한 8개 스위트까지 함께 묶는다"는 결합이 이번 fix 로 완전히 해소되지 않고 **문구만 정확해졌을 뿐 구조는 그대로**라는 것인데, 저자가 커밋 메시지에서 이를 인지하고 "정상 수단·즉시 시끄러운 실패"라는 근거로 명시적으로 반려한 의도된 설계다. 새로 도입된 CRITICAL/WARNING 급 부작용은 없다.

## 위험도

NONE
