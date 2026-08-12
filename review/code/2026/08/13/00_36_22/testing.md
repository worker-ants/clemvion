# 테스트(Testing) 리뷰 — `00_36_22`

## 검증 방법

정적 리뷰에 더해 실측했다:

- `npx jest idempotency.interceptor.spec.ts` 실행 → **41/41 통과**, 커밋 메시지(`c51809a0b`)가
  주장한 수치와 일치.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 전체와
  `.spec.ts` 전체(1202줄)를 직접 읽고, `git diff origin/main..HEAD --stat`/`git diff -- <file>`
  로 실제 diff 범위를 재확인했다(프롬프트가 두 핵심 파일의 diff 를 크기 제한으로 생략했기 때문).
- 이 PR 은 이미 4라운드(`23_24_08`→`23_36_13`→`23_48_38`→`00_20_20`) 리뷰를 거치며 testing
  관점 WARNING 을 매 라운드 즉시 조치해 왔다(형제 테스트 단언 비대칭, `describeShape()` 뮤테이션
  생존, fixture 다중조건 위반 등). 아래는 그 이력과 **중복되지 않는** 새 관측만 적는다.

## 발견사항

- **[INFO]** 콘솔에 `Logger.warn` 이 새는 테스트가 diff 범위 밖에 **2건 더** 있다 — 이번 PR 이
  만든 것도 아니고 이번 PR 이 건드린 코드도 아니다(참고용 기록, 조치 요구 아님)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
    — `` it('`get()` 이 reject 하면 캐시 미스로 취급해 새 응답을 적재한다', …) ``,
    `` it('비-Error 값으로 reject 해도 로그 조립이 죽지 않는다', …) `` (두 `describe`
    `IdempotencyInterceptor (Redis 런타임 장애 fail-open)` 블록 안)
  - 상세: `npx jest` 실행 로그에 `IdempotencyInterceptor cache GET 실패 — fail-open: ECONNRESET`
    / `…: connection lost` 두 줄이 실제로 찍힌다. 두 테스트 모두 `redis.get.mockRejectedValue(...)`
    로 GET 실패 경로(`catchError` 안의 `this.logger.warn(...)`)를 실행하는데
    `jest.spyOn(Logger.prototype, 'warn')` 을 두지 않는다. `git show origin/main:<path> | grep`
    로 확인한 결과 두 테스트는 이번 diff 이전부터 이미 이 상태였고 `git diff origin/main..HEAD --
    <path>` 에도 나타나지 않는다 — **이번 PR 이 새로 만든 부작용도, 이번 PR 이 손댄 자리도 아니다.**
    같은 파일의 다른 6개 GET/SET/직렬화/엔트리/payload 실패 테스트는 전부 `try/finally` +
    `warnSpy` 로 이 문제를 이미 막고 있어(격리 관례가 잘 지켜지는 파일이라는 뜻이기도 하다),
    두 자리만 예외로 남아 있다. 이 정확한 결함 클래스(진단되지 않은 새 로그 부작용을 실행하는
    기존 테스트)는 이 세션의 `23_24_08`·`23_36_13` side_effect 리뷰가 **다른** 자리(엔트리 손상
    테스트, 지금은 warn 이 추가돼 형제 패턴을 따름)에서 이미 지적했고 WARNING 문턱 아래로
    판정돼 조치 없이 넘어갔다 — 이번 2건도 같은 성격·같은 우선순위다.
  - 제안: 조치 불필요(diff 범위 밖). 다음에 이 describe 블록을 만질 일이 생기면 두 테스트에도
    `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 을 `try/finally` 로 붙여
    파일 전체의 격리 관례를 완성하는 정도로 충분하다.

## 그 외 확인한 항목 (이번 diff 범위, 문제 없음)

- **커버리지**: `discardCorruptEntry()` 의 두 호출부(`엔트리`/`payload`)와 그 안의 형태 검사
  (`isIdempotencyEntry()`)가 8개 `it.each` fixture(null·숫자·배열·문자열·필드 누락·필드별 단일
  타입 불일치 3건)로 정밀하게 덮인다. `describeShape()` 의 세 분기(`null`/`array`/`typeof`
  fallback)도 각 fixture 의 `expectedShape` 단언으로 전부 관측된다.
- **파싱 순서 계약**: `payload 파싱이 bodyHash 판정보다 뒤` 라는 새 불변식이 전용 캐너리
  테스트(`안쪽이 깨졌어도 body 가 다르면 여전히 409`)로 고정돼 있고, plan 문서(L644-647)에
  적힌 대로 순서 반전 뮤턴트를 **인덱스 비교로 선검증**한 뒤에야 그 테스트가 실제로 RED 가
  됨을 확인한 이력이 있다 — 무효 뮤턴트 함정을 스스로 피한 드문 케이스.
- **에러 채널 자매 커버리지**: payload 손상 방어가 성공 채널(`statusCode:200`)과 에러 재현
  채널(`statusCode:409`) 양쪽에서 동형으로 단언된다(응답값뿐 아니라 `warnSpy`·`redis.set`
  호출·재적재 값까지) — 이전 라운드가 지적한 "응답만 보면 주장을 증명 못 한다" 문제가 이번
  diff 시점 기준으로는 이미 해소된 상태로 들어와 있다.
- **격리**: 신규 6개 테스트 전부 `Logger.prototype.warn` spy 를 `try/finally` 로 감싸
  `mockRestore()` 하고, `redis`/`interceptor`/`handler` 를 테스트마다 새로 만들어 공유 상태가
  없다. `jest.config.ts` 에 `restoreMocks` 안전망이 없는 이 파일에서 필수적인 패턴이고
  일관되게 지켜진다.
- **회귀**: 기존 캐시 히트/충돌/스코프/`3xx` 미캐시/`HttpException` 아닌 예외 테스트는 이번
  리팩터(`processFresh`/`discardCorruptEntry` 추출, `cachedPayload` 단일 파싱) 이후에도 동일한
  happy-path 를 그대로 검증하며 41/41 GREEN — 실행으로 확인.
- **Mock 적절성**: `RedisStub` 은 실제 프로덕션 코드가 호출하는 두 메서드(`get`/`set`)만
  노출하고, `makeThrowingHandler`/`makeCallHandler` 는 성공 채널·에러 채널을 실제 파이프라인과
  같은 형태로 재현한다(`16_29_45` CRITICAL 교훈이 반영된 관례).

## 요약

이번 diff(`idempotency.interceptor.ts`/`.spec.ts`, "캐시 엔트리 안쪽 `responseJson` 손상 →
500 마스킹 방지")는 이미 4라운드의 testing 전용 리뷰를 거치며 형제 테스트 단언 비대칭·뮤테이션
생존 헬퍼·fixture 다중조건 위반 같은 실질 결함을 그때마다 실측(무수정 프로브·뮤테이션)으로
확인하고 닫아 왔다. 이번 라운드에서 소스·테스트 전문을 독립적으로 다시 읽고 `jest` 를 직접
실행해 41/41 GREEN 을 재확인했으며, 새로 발견한 것은 diff 범위 밖의 낮은 우선순위 INFO
(기존 2개 테스트가 `Logger.warn` 콘솔 노이즈를 낸다) 하나뿐이다 — 이번 PR 이 만든 것도 손댄
것도 아니라 조치를 요구하지 않는다. 형태 검증·파싱 순서 계약·에러/성공 채널 자매 커버리지
모두 mutation-validated 상태로 들어와 있어 커버리지 갭이나 vacuous 단언은 확인되지 않았다.

## 위험도

NONE
