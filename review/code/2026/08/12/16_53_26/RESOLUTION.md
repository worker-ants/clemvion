# RESOLUTION — `16_53_26`

리뷰 결과: **CRITICAL 0 / WARNING 1 / RISK MEDIUM**. reviewer 7명 실행, 강제 7명 전원 결과
확보(`forced_missing: []`, `unfinished: []`).

직전 라운드의 CRITICAL(409/410 dead code)은 **해소 확인**됐다 — requirement·scope·
maintainability·documentation reviewer 가 각각 코드 실행(jest 21/21, eslint/tsc 0)과 소스
대조로 독립 검증했다.

---

## WARNING #1 (testing) — **또 자매 자리를 빼먹었다** → 조치

`409`·`410`·`5xx`·`404` 는 error 채널로 바꿨는데 **`400` 만 옛 형태(성공 채널 + statusCode
프리셋)로 남겨 뒀다.** 리뷰어가 실측까지 붙였다: `isErrorStatusCacheable` 에 `=== 400` 을
잘못 추가해도 **이 스위트의 어떤 테스트도 RED 가 되지 않는다.**

즉 직전 라운드에서 배운 "mock 이 만드는 상태 ≠ 시스템이 실제로 만드는 상태" 원칙을
**같은 파일 안에서 한 케이스에만 적용하지 않은** 것이다. 이 세션에서 이 패턴이 **두 번째**다
(앞서 SET 경로에 warn 단언을 넣고 GET 에 빠뜨린 건과 같은 형태).

**조치**: `makeThrowingHandler(new BadRequestException(...))` 로 교체.
**뮤테이션 재실측**: `isErrorStatusCacheable` 에 `=== 400` 추가 → **1 RED**(그 테스트).
리뷰어가 "아무도 안 잡는다" 고 실측한 갭이 닫혔다.

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 3 | 캐시 재현 시 `requestId` 는 매번 새로 발급 — CHANGELOG 의 "동일 응답 재현" 이 그 예외를 언급 안 함 | **조치** — CHANGELOG 에 한 줄 추가. `statusCode`·`code`·`message` 가 재현 대상이고 `requestId` 는 아니라고 명시 |
| 10 | `410` 테스트가 payload 미단언(409 는 함) | **조치** — `responseJson` 단언 추가로 대칭화 |
| 1 | 캐시 키가 execution/인증 미스코프 — 이번 fix 로 **이론상 위험에서 실제 활성 경로로 전환** | **유예, 다만 우선순위 상향 기록** — plan 백로그에 이미 있고, 이번 변경으로 값이 올라갔음을 RESOLUTION 에 남긴다 |
| 2 | `err.getResponse()` 무검증 직렬화 | 조치 불요 — 현재 두 예외는 고정 코드만 담는다. `interaction.service.ts` 의 409/410 throw 지점이 바뀔 때 재확인 |
| 4·5·6 | `JSON.parse` 중복 · 팩터링 비대칭 · `intercept()` 길이 | **유예** — 전부 선택적 개선. 지금 손대면 이번 재설계의 diff 를 흐린다 |
| 7 | error-채널 테스트의 `statusCode: 202` 가 no-op 인자 | 조치 불요 — 대조 목적이 헬퍼 docstring 에 설명돼 있다 |
| 8 | 클래스 상단 요약에 에러 채널 캐시 bullet 없음 | 조치 불요 — `cacheTapped` docstring 이 정확히 서술한다 |
| 9 | `Idempotency-Key` e2e 부재 | **유예** — plan 등재됨. 리뷰어도 "이번 PR 을 막을 사유 아님" |

## 검증

- eslint **0 errors / 0 warnings**
- backend unit **418 suites / 8529 passed / 1 skipped** (테스트 수 불변 — 기존 테스트를
  error 채널로 **교체**한 것이라 신규 케이스가 아니다)

## 수렴 판단

| 라운드 | CRITICAL | WARNING | 성격 |
|---|---|---|---|
| `16_29_45` | **1** | 5 | dead code + vacuous test |
| `16_53_26` | 0 | 1 | **같은 클래스의 자매 자리 누락** |

CRITICAL 은 해소됐고 이번 WARNING 은 그 fix 를 한 케이스에 덜 적용한 것이었다. 남은 INFO 는
선재이거나 선택적 개선이다. 다음 라운드는 이 커밋을 덮는 확인용이다.
