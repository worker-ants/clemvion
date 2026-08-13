# 테스트(Testing) 리뷰 — `idempotency.interceptor` statusCode 범위 검증 + 경계값 테스트 (누적 상태, `01_31_17`)

## 검토 범위 및 방법

이번 세션(`01_31_17`)의 diff 는 실질적으로 (1) `CHANGELOG.md`, `idempotency.interceptor.ts`,
`idempotency.interceptor.spec.ts`, `plan/in-progress/backend-lint-gate-broken-on-main.md` 의
누적 코드/테스트 변경과 (2) 그 코드를 대상으로 이미 3라운드(`23_48_38` → `00_54_18` → `01_10_52`)
진행된 `/ai-review` testing 결과·RESOLUTION 산출물이다. 코드/테스트 변경분은 `git diff
origin/main...HEAD` 로 실제 소스를 직접 열어 확인했고(prompt 의 spec.ts diff 는 크기 제한으로
생략돼 있었다), 각 라운드의 WARNING/INFO 가 실제로 반영됐는지 소스 대조로 재검증했다.

## 발견사항

- **[INFO]** (긍정) 경계값 테스트 구조가 목적별로 정확히 하나씩 겨냥돼 있고 격리도 잘 되어 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1224-1467` (`describe('IdempotencyInterceptor — readKey / hashBody 경계값', …)`)
  - 상세: 키 길이 상한 200/201(경계 양쪽 한 `it` 에 결합, 의도 명시), 공백뿐인 키 2종(`it.each`), trim 동등성, 배열 헤더(타입 방어) vs 조인 문자열(실제 도달 경로) 분리, 키 순서 의존, body `undefined`/`null` 동등성, `statusCode` 무효 5종(`it.each` — 음수/0/99/600/200.5) + 유효 경계 2종(100/599)까지 커버한다. `beforeEach`/`afterEach` 가 파일에 전혀 없고(grep 확인) 각 `it` 이 `makeRedis()`/`makeContext()`/`makeCallHandler()` 를 직접 새로 만들어 상태를 공유하지 않으므로 테스트 간 순서 의존이 없다 — 독립 실행 가능.
  - 조치 불요.

- **[INFO]** (긍정) `Logger.prototype.warn` spy 격리(`try/finally`)가 파일 전체 11곳 모두 일관되게 적용돼 있다
  - 위치: `idempotency.interceptor.spec.ts:535, 604, 640, 665, 739, 849, 931, 985, 1018, 1182, 1400` (선언) 대응 `mockRestore()`: `564, 631, 656, 693, 776, 870, 952, 1011, 1038, 1209, 1427`
  - 상세: `jest.config.ts` 에 `restoreMocks`/`clearMocks` 안전망이 없어(확인 완료) 이 규율이 유일한 격리 수단인데, 11개 선언 전부가 `mockRestore()` 짝을 갖는다. 23_48_38 라운드가 지적했던 `spec.ts:512-539` 자리(당시 신규 테스트가 이 패턴을 빠뜨렸던 곳)도 현재 소스에서는 짝이 맞는 것으로 확인된다(현재 라인 535/564).
  - 조치 불요 — 다만 향후 새 `warnSpy` 를 추가할 때 이 짝이 계속 수동으로 지켜져야 하는 구조라는 점은 maintainability 쪽 `withWarnSpy()` 헬퍼 제안(기존 라운드에 이미 등재, 유예됨)과 같은 리스크 계열이다.

- **[INFO]** 뮤테이션 테스트 결과가 전부 자기보고(self-reported)이며 이번 리뷰에서 실제로 재실행하지는 않았다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:687-715` (뮤턴트 10개/5개 사살 주장), `review/code/2026/08/13/00_54_18/RESOLUTION.md:9-31`
  - 상세: 다만 이 주장들은 두 개의 **독립적인 이전 testing 라운드**(`00_54_18`, `01_10_52`)가 각각 다른 뮤턴트(`>= 100 → >= 50`)를 직접 주입해 재현/반증한 뒤 원복까지 확인한 기록이 남아 있고(`review/code/2026/08/13/01_10_52/testing.md:18`), 이번 세션에서 소스를 직접 읽어 그 결과와 일치하는 코드 상태(99 경계 케이스 존재, `isHttpStatusCode` 정수+범위 검사)를 확인했다. 완전히 새로 재실행하지 않았다는 점만 기록해 둔다 — 위험도에는 반영하지 않는다(이미 2회 독립 검증됨).

- **[INFO]** `readKey`/`hashBody` 는 module-private 라 전부 `intercept()` 경유로만 테스트된다 — 의도된 설계
  - 위치: `idempotency.interceptor.spec.ts:25-26` (모듈 docstring: "헬퍼가 전부 module-private 라 전부 intercept() 를 통해 본다 — 헬퍼 직접 호출은 호출부 테스트가 아니다.")
  - 상세: 테스트 용이성 관점에서 내부 헬퍼를 export 하지 않고 호출부(공개 계약)로만 검증하는 선택은 구현 세부사항에 결합되지 않는 바람직한 테스트 구조다. 대가로 각 `it` 이 `intercept()` 전체 파이프라인(RxJS `lastValueFrom`, mock ExecutionContext 등)을 거쳐야 해 개별 순수 함수 단위 테스트보다는 다소 무겁지만, 이 파일의 다른 블록들과 일관된 방식이라 새로운 문제는 아니다.
  - 조치 불요.

## 이전 라운드 testing WARNING 반영 상태 (소스 재확인)

| 라운드 | WARNING | 반영 확인 |
|---|---|---|
| `00_54_18` #1 | 하한(100) 바로 아래(99) 무효 케이스 부재 — 뮤턴트 생존 | `spec.ts:1391` `['하한 바로 아래(99)', 99]` 추가 확인 |
| `00_54_18` #2 | "헤더 배열=중복 헤더" 주석이 사실과 다름(실측: 조인 문자열) | `spec.ts:1286-1329` 주석 정정 + 조인 문자열 별도 테스트(`:1312-1329`) 추가 확인 |
| `01_10_52` INFO | `hashOf` 가 사전 단언 없이 `mock.calls[0][1]` 인덱싱 | `spec.ts:1377-1378` `toHaveBeenCalledTimes(1)` 선단언 확인 |

세 건 모두 코드에 실제로 반영돼 있음을 직접 읽어 확인했다. 새로 발견된 회귀나 커버리지 갭은 없다.

## 요약

이 diff 의 테스트 변경(`readKey`/`hashBody` 경계값 describe 블록, `isHttpStatusCode()` 대응 `it.each`)은 세 라운드에 걸친 뮤테이션 기반 자기검증(초기 10개 뮤턴트 → 리뷰어가 하한-확대 뮤턴트로 반증 → 99 경계 추가 → 독립 재검증)을 거쳤고, 각 단계의 수정이 현재 소스에 실제로 반영돼 있음을 이번 세션에서 직접 재확인했다. 경계값 커버리지(키 길이 200/201, statusCode 99/100/599/600, 정수 아님, 공백뿐인 키, trim, 배열 vs 조인 헤더, body nullish 동등성, 키 순서 의존)가 촘촘하고, 각 `it`/`it.each` 가 독립된 mock 을 구성해 테스트 격리가 확보돼 있으며, `Logger.prototype.warn` spy 는 `jest.config.ts` 에 안전망이 없음에도 11곳 전부 `try/finally` 로 일관되게 보호돼 있다. 새로 지적할 CRITICAL/WARNING 급 커버리지 갭이나 격리 문제, mock 오용은 발견하지 못했다.

## 위험도

NONE
