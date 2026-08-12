# 테스트(Testing) Review

## 발견사항

- **[WARNING]** `storeEntry()` catch 블록의 `logger.warn` 호출을 지워도 전체 테스트가 GREEN — 파일 자신의 확립된 관행(응답만 단언하면 로그-제거 뮤테이션을 못 잡는다)을 이번 diff 의 신규 테스트 2건만 따르지 않는다. **뮤테이션 실측으로 확인.**
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:228-233` (`storeEntry` 의 `catch (err) { this.logger.warn(...); return; }`) / 테스트: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:676`, `:701`
  - 상세: 같은 파일의 Redis 런타임 장애 describe 블록(`get()` reject 테스트, `set()` reject 테스트)은 각각 `jest.spyOn(Logger.prototype, 'warn')` 으로 warn 호출 자체를 단언하며, 그 이유를 주석으로 명시한다 — "응답만 단언하면 `catchError` 안의 `logger.warn` 한 줄을 지워도 그대로 GREEN 이라, 장애가 조용해지는 변경을 못 잡는다"(spec.ts:550-551), "`.catch(() => {})` 로 조용히 삼키기는 응답 단언만으로는 안 잡힌다 … `.catch()` 가 실제로 warn 을 남겼다는 증거를 함께 단언한다"(spec.ts:628-632). 그런데 이번 diff 가 새로 추가한 두 테스트(직렬화 실패 error 채널/성공 채널)는 `redis.set` 미호출과 원 예외 전파만 단언하고 `storeEntry` catch 블록 안의 `logger.warn` 호출은 전혀 검증하지 않는다.
    직접 뮤테이션으로 확인했다 — `storeEntry` 의 `catch (err) { this.logger.warn(...); return; }` 를 `catch (err) { return; }` 로 바꿔 로그만 제거한 뒤 `npx jest idempotency.interceptor.spec.ts` 를 돌리면 **25/25 그대로 통과**(원본 파일로 즉시 복원, `git status` 로 변경 없음 확인). 이 클래스의 docstring 은 "직렬화 실패도 삼켜야 한다"·"fail-open" 을 반복해서 강조하는데, 그 fail-open 이 조용해지는 변경(운영에서 이 실패를 알아챌 유일한 수단인 warn 로그가 사라지는 회귀)을 이 diff 의 어떤 테스트도 잡지 못한다 — 같은 파일 안에서 sibling 코드 경로(GET/SET 실패)는 정확히 이 뮤테이션 클래스를 막도록 설계됐는데, 신규로 추가한 세 번째 fail-open 분기(직렬화 실패)에는 그 방어가 빠졌다.
  - 제안: 두 신규 테스트(또는 그중 하나) 에 `jest.spyOn(Logger.prototype, 'warn')` 를 추가해 `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cache 직렬화 실패'))` 를 단언한다. 기존 두 fail-open 테스트와 동일한 패턴이라 비용이 낮다.

- **[WARNING]** 직전 라운드(`18_07_36`) RESOLUTION 이 "캐시 엔트리 내부 `responseJson` 손상 무방비" 를 **"plan 백로그에 기록"** 하겠다고 처분했는데, 그 기록이 실제로는 존재하지 않는다 — 같은 커밋 안에서 약속과 결과가 어긋난다.
  - 위치: `review/code/2026/08/12/18_07_36/RESOLUTION.md:55` (처분 표 — "INFO 1 … 유예 — plan 백로그에 기록") / `plan/in-progress/backend-lint-gate-broken-on-main.md:561-562` (실제로 존재하는 유일한 인접 백로그 항목, `readKey`/`hashBody` 경계값 — `responseJson` 손상은 언급 없음)
  - 상세: `RESOLUTION.md`(`18_07_36`)와 그 처분을 반영한 `plan/in-progress/backend-lint-gate-broken-on-main.md` 편집은 **동일 커밋**(`147075a51`)에서 함께 만들어졌다(`git log --oneline -- review/code/2026/08/12/18_07_36/RESOLUTION.md` 로 확인). 그런데 그 커밋이 만든 plan diff 70줄 안에 `responseJson` 손상 관련 문구는 없다 — `plan/` 전체를 `grep -rn "responseJson"` 해도 무관한 spec 표 인용문 한 곳(`spec-draft-eia-r8-alignment.md:53-54`, 필드명 나열일 뿐)만 걸린다. 즉 이번 diff(round `18_37_45`) 가 최종 리뷰 대상으로 삼는 plan 상태에는, 인터셉터의 캐시 재현 경로(`idempotency.interceptor.ts:137`, `:143`)가 여전히 안고 있는 실제 갭 — `cached.responseJson` 자체가 손상된 경우 `JSON.parse` 가 무방비로 throw 해 그 요청만 500 이 되는 경로 — 을 추적할 자리가 어디에도 없다. 이 프로젝트가 이미 반복 학습한 "미룬 항목은 그 턴에 plan 에 적어라 — '이미 기록됨' 주장이 거짓이었다" 패턴과 정확히 같은 모양이다. 코드 결함이 아니라 **커버리지 갭의 추적 유실**이라 이번 PR 을 막을 사안은 아니지만, 이대로 `complete/` 로 넘어가면 이 갭 자체가 영구히 사라진다.
  - 제안: `plan/in-progress/backend-lint-gate-broken-on-main.md:561` 의 `readKey`/`hashBody` 경계값 항목 옆(또는 새 항목)에 "캐시 엔트리 내부 `responseJson` 손상 — `intercept()` 137·143행의 무방비 `JSON.parse`, 선재 갭(`18_07_36` testing INFO 1)" 한 줄을 실제로 추가한다.

- **[INFO]** 위 두 WARNING 은 병합을 막을 사안이 아니지만, 나머지 테스트 설계는 이번 라운드까지 5차례 리뷰를 거치며 상당히 성숙했다 — 아래는 확인만 하고 조치 불요.
  - `makeThrowingHandler` 도입으로 409/410 을 실제 서비스가 던지는 error 채널로 행사(`spec.ts:101-105`), 그 근거를 `interaction.service.ts:253,431,478,505` 의 실제 throw 형태(`{ error: { code } }`)와 대조해 mock payload 형태가 일치함을 확인했다.
  - 신규 e2e(`IDEM-1`/`IDEM-2`/`IDEM-3`, `external-interaction.e2e-spec.ts:369-563`)가 상태코드만이 아니라 **Redis 엔트리 자체**를 직접 조회해 단언한다 — 상태코드만 비교하는 최초 시도는 두 구현을 못 가르는 fixture 였다는 것을 뮤테이션으로 확인 후 교체한 이력이 plan 에 남아 있고(`backend-lint-gate-broken-on-main.md:544-547`), 이는 이 프로젝트가 반복 학습한 "분기를 못 가르는 fixture" 결함 클래스를 스스로 잡아낸 사례다.
  - 각 신규 `it` 블록이 `makeRedis()`/`makeInterceptor()` 를 매번 새로 생성해 테스트 간 상태 공유가 없다(격리 양호). e2e 도 매 테스트가 `randomUUID()` 로 workflow/execution/idempotencyKey 를 새로 발급해 순서 의존이 없다.
  - `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 25 테스트 전체 GREEN 확인(`npx jest idempotency.interceptor.spec.ts`), 변경된 두 소스·테스트·e2e 파일 모두 `tsc --noEmit` 에서 신규 타입 오류 없음(리포트된 5건은 이 diff 와 무관한 `interaction-token.service.spec.ts`/`interaction.service.spec.ts` 의 기존 오류).

## 요약

이번 diff(§R8 캐시 재설계 최종 라운드)는 단위 테스트(`makeThrowingHandler` 로 실제 error 채널 재현) 와 e2e(`IDEM-1`~`IDEM-3`, Redis 엔트리 직접 관측)로 핵심 계약을 충실히 검증하고 있고, 격리·가독성·mock 정합성도 양호하다. 다만 두 가지는 이번 diff 자신이 만든 새 표면에 대한 검증 공백이다 — (1) `storeEntry` catch 블록의 `logger.warn` 이 파일 자신이 확립한 관행(warn 호출을 spy 로 단언해 로그-제거 뮤테이션을 잡는다)을 따르지 않아 실제로 뮤테이션이 25/25 GREEN 으로 생존했고, (2) 직전 라운드가 "plan 백로그에 기록하겠다" 고 처분한 `responseJson` 내부 손상 갭이 실제로는 기록되지 않아 이번 PR 이 최종 상태로 남길 plan 에 그 갭의 흔적이 없다. 둘 다 코드 결함이 아니라 커버리지/추적 갭이라 병합을 막을 필요는 없지만, 후자는 이 세션에서 이미 여러 차례 지적된 "약속한 처분이 실제로 반영됐는지 확인" 원칙이 재차 깨진 사례라 가볍게 넘기기 어렵다.

## 위험도

MEDIUM
