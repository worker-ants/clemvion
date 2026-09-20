# 테스트(Testing) 리뷰 — rotate 동시성 lost-update, RESOLUTION 이후 재검토

## 스코프 메모

이번 라운드(`18_09_24`)의 diff(`origin/main...HEAD`)는 최초 구현(`5c694cc5f`/`f3ea25d02`) 위에
직전 리뷰(`review/code/2026/09/20/17_35_12`)의 WARNING 1·2·6·8 조치 커밋(`ab0988f7f`·`af6cc0d2c`·
`154e17d31`·`d532184f5`)까지 누적한 전체 범위다. 프롬프트가 파일 2~4(`integrations.service.spec.ts`,
`integrations.service.ts`, `integration-rotate-concurrency.e2e-spec.ts`)의 diff 본문을 크기 제한으로
생략해, `git diff origin/main...HEAD -- <각 파일>` 과 `Read` 로 실제 소스를 직접 열어 확인했다. 아래
위치는 전부 해당 소스 파일의 1-기준 실제 줄 번호다(조립 프롬프트 오프셋 아님).

## 검증 방법

직전 라운드 testing.md 가 WARNING 으로 지적한 두 커버리지 갭(`freshErrors` 재검증 삭제, `workspaceId`
스코핑 제거)에 대해 `ab0988f7f` 가 테스트를 추가했다고 주장하고, `RESOLUTION.md`/`_resolution_log.md` 가
그 뮤테이션 검증 결과를 기록해 두었다. 다만 그 검증은 **다음 커밋(`af6cc0d2c`)이 두 검증 블록을
`mergeAndValidateCredentials` 라는 하나의 공유 private 헬퍼로 합치기 전** 시점에 수행됐다 — 리팩터가
"두 호출부가 이제 같은 함수" 로 만들었으므로, 새 테스트가 리팩터 이후에도 여전히 판별력을 갖는지는
별도로 재확인이 필요한 지점이었다. 그래서 이번 라운드에서 직접 다음을 재실행했다:

1. `npx jest src/modules/integrations/integrations.service.spec.ts -t "동시 rotate"` → 4 passed (기존 GREEN 확인).
2. 리팩터 이후 상태에서 여전히 유효한 뮤턴트를 새로 하나 주입했다 — 락 안 호출부(`rotate()` 1182~1185줄)만
   `this.mergeAndValidateCredentials(fresh, body.credentials)` 대신 검증을 건너뛰는
   `{ ...fresh.credentials, ...body.credentials }` 인라인으로 치환(락 전 호출부는 그대로 둠 → 공유 헬퍼
   자체를 건드리지 않고 "누군가 락 안에서만 헬퍼 호출을 생략" 하는 시나리오를 재현). 저장소 파일을
   스크래치(`/private/tmp/.../scratchpad/mutbak/`)에 `cp` 로 먼저 백업한 뒤 적용했다(`git checkout` 미사용).
   → `1 failed, 138 skipped, 3 passed`, 실패한 테스트는 정확히 `락 안 재검증이 실패하면 커밋하지 않는다`
   (1429줄) 하나였다. 나머지 세 `동시 rotate` 테스트와 그 외 138개는 영향 없음. 뮤테이션 직후 `cp` 로
   즉시 원복하고 `git status --short` 로 클린 확인.
3. `npx jest src/modules/integrations` 전체 실행 → `19 suites / 567 tests` 전부 GREEN — `RESOLUTION.md` 의
   "19 suite / 567 test" 수치와 정확히 일치.
4. `_test_logs/e2e-20260920-180150.log` (커밋되지 않은 로컬 산출물, 저장소 안에 실재)를 열어
   `PASS test/integration-rotate-concurrency.e2e-spec.ts` 와 `Tests: 367 passed, 367 total` 를 직접
   확인 — `RESOLUTION.md` 의 e2e 실측 주장이 로그와 일치한다(허위 기재 없음).

## 발견사항

- **[INFO] WARNING 1·2(락 안 재검증·`workspaceId` 스코핑) 조치가 후속 리팩터 이후에도 판별력을 유지함 — 직접 재검증**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1381`(`임계 구간은 트랜잭션 + pessimistic_write 락...`), `:1429`(`락 안 재검증이 실패하면 커밋하지 않는다...`); 대상 코드 `codebase/backend/src/modules/integrations/integrations.service.ts:1182-1185`
  - 상세: `ab0988f7f` 시점에는 락 전/락 안 검증 로직이 아직 분리된 인라인 블록이었지만, 바로 다음 커밋 `af6cc0d2c` 가 둘을 `mergeAndValidateCredentials` 공유 헬퍼로 합쳤다. 공유화 이후에는 "검증 로직 자체를 지우는" 뮤턴트가 락 전 호출부에도 함께 영향을 줘 기존(이번 PR 이전부터 있던) 구조 검증 실패 테스트가 대신 잡아줄 수 있어, 새로 추가된 두 단언이 여전히 **독자적인** 판별력을 갖는지 불분명했다. 위 "검증 방법" 2번으로 직접 확인한 결과, "락 안 호출부만 헬퍼를 우회" 하는 뮤턴트(리팩터 후 실제로 있을 법한 실수 — 예: 트랜잭션 콜백을 나중에 인라인 최적화하며 검증 호출을 빠뜨리는 경우)는 다른 141개 테스트에 영향을 주지 않고 정확히 신규 테스트(1429줄) 하나만 RED 로 만들었다. 즉 두 WARNING 의 조치는 리팩터 이후에도 유효하다.
  - 제안: 없음 — 조치 확인. 다만 일반적으로, 뮤테이션으로 정당화한 테스트를 추가한 직후 같은 PR 안에서 그 코드를 리팩터링할 때는(이번처럼 순서가 우연히 안전했더라도) 리팩터 후 뮤턴트를 한 번 더 돌려보는 습관을 남겨 두면 "합쳐진 함수라 개별 갭이 사라졌다" 는 착시를 조기에 잡을 수 있다.

- **[INFO] e2e `try/finally`(WARNING 6) 조치가 변수 스코프·정상 경로 no-op 양쪽에서 안전함**
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:86-159` (`await locker.query('BEGIN')` ~ `finally { ROLLBACK; pending?.catch(...) }`)
  - 상세: `pending` 은 `try` 진입 전에 `let pending: ... | undefined` 로 선언되고 `SELECT ... FOR UPDATE` 이후에야 대입된다. `finally` 는 `pending?.catch(() => undefined)` 로 optional chaining 을 쓰므로, 락 확보 자체가 실패해 `pending` 이 끝내 대입되지 못한 극단적 경로에서도 `ReferenceError` 없이 안전하다. 정상 경로(assertion 전부 통과 후 `COMMIT` 도달)에서는 `finally` 의 `ROLLBACK` 이 이미 커밋된 트랜잭션에 대해 no-op 으로 끝나(주석이 이를 명시) 이중 처리 문제가 없다. 직전 라운드가 지적한 "assertion 실패 시 트랜잭션·pending 미정리" 위험이 구조적으로 닫혔다.
  - 제안: 없음.

- **[INFO] `RESOLUTION.md`/`_resolution_state.json` 의 실측 수치(뮤테이션 결과·unit 567·e2e 367)가 재현 가능하고 로그와 일치함**
  - 위치: `review/code/2026/09/20/17_35_12/RESOLUTION.md:27-32`, `review/code/2026/09/20/17_35_12/_resolution_state.json:47-49`; 대조 대상 `codebase/backend/_test_logs/e2e-20260920-180150.log`(저장소 내 로컬 산출물)
  - 상세: 위 "검증 방법" 3·4에서 직접 재실행/열람해 "19 suite / 567 test", "e2e 367/367 GREEN(대상 spec 포함)" 두 수치 모두 확인했다. 부풀리거나 잘못 옮겨 적은 수치는 없었다.
  - 제안: 없음 — 조치 불요, 참고 기록.

- **[INFO] 새 커버리지 갭 재발 없음 — `assertCanRotate`/`mergeAndValidateCredentials` 리팩터(WARNING 3·4·5) 자체는 별도 단위 테스트를 요구하지 않음**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1082-1093`(`assertCanRotate`), `:1100-1119`(`mergeAndValidateCredentials`)
  - 상세: 두 메서드는 `private` 이고 `rotate()` 를 통해서만 도달 가능하다. 리팩터 전/후 로직이 문자 그대로 동일함을 `git show ab0988f7f:.../integrations.service.ts` 와 현재 파일을 대조해 확인했고(락 전 `entity`/락 안 `fresh` 두 호출부 각각 그대로 이동), 기존 rotate() 블랙박스 테스트 전체(567개 중 관련 스위트)가 리팩터 후에도 전부 GREEN 이라는 사실 자체가 회귀 없음의 증거다. private 헬퍼를 별도로 화이트박스 테스트할 필요는 없다 — NestJS 서비스 계층에서 공개 계약(rotate()) 을 통한 테스트가 관례와 일치한다.
  - 제안: 없음.

## 요약

직전 라운드가 지적한 두 테스트 WARNING(락 안 재검증 `freshErrors`, 락 안 재읽기 `workspaceId` 스코핑)은 `ab0988f7f` 가 추가한 단언으로 해소됐고, 이번 라운드에서 그 조치가 **바로 다음 커밋의 리팩터(`af6cc0d2c`, 두 검증 로직을 공유 헬퍼로 통합)에도 불구하고 독자적 판별력을 유지하는지**를 새 뮤턴트(락 안 호출부만 헬퍼 우회)로 직접 재검증했으며, GREEN 141 / RED 1(신규 테스트만) 로 확인했다. e2e WARNING(6, `try/finally`)도 변수 스코프·정상 경로 no-op 양쪽에서 안전하게 구현됐다. `RESOLUTION.md` 가 주장한 뮤테이션·unit(567)·e2e(367, 대상 spec PASS 포함) 수치는 실제 재실행/로그 대조로 모두 일치했다 — 과장되거나 잘못 옮겨진 실측 주장은 없었다. 새로 도입된 Critical/Warning 급 테스트 결함은 발견하지 못했다.

## 위험도

NONE
