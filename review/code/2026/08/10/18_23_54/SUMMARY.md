# ai-review SUMMARY — `18_23_54` (forced 7 전원 실행)

대상: `claude/webchat-reload-rest-branches` vs `origin/main`. 단일 세션(`REVIEW_BATCH_SIZE=500`).

## 집계

| reviewer | Critical | Warning | Info | 위험도 |
|---|---|---|---|---|
| side_effect | 0 | 0 | 2 | NONE |
| requirement | 0 | 0 | 4 | NONE |
| scope | 0 | 0 | — | NONE |
| maintainability | 0 | 1 | 4 | LOW |
| security | 0 | 1 | 1 | MEDIUM |
| documentation | **1** | 2 | 2 | HIGH |
| testing | **1** | 1 | 1 | CRITICAL |
| **합계** | **2** | **5** | **14** | **HIGH** |

## 직전 라운드 처분은 전부 확인됐다

- **side_effect**(자기 WARNING 재검증): 플래그 클리어 순서 이동이 새 부작용을 만들지 않는다.
  `already_owned`/`no_client` 에서도 플래그를 지우는 것이 세 반환값 모두에서 옳고, throw 후
  재시도는 busy loop 가 아니라 갱신 주기에 종속된 유계 재시도다.
- **requirement**: 두 동작 변경이 §3.1-2·§R4 와 여전히 일치하고 `status: implemented` 도 흔들리지
  않는다.
- **scope**: `17_55_57` RESOLUTION 의 처분 주장을 `git show` 로 항목별 대조 + **뮤테이션 3종을
  직접 재현**해 전부 일치 확인. 새로 분리 등재한 잔여도 정당한 out-of-scope 이연으로 판정.

## Critical

### C1 (testing) — 내 회귀 테스트가 실행 환경에 따라 갈린다

§R4 통합 회귀가 **콜드 transform 캐시에서 4/4 FAIL, 웜에서 10/10 PASS**(동일 바이트 소스).
`vi.useFakeTimers({ shouldAdvanceTime: true })` 가 가상 시계를 실경과시간에 얹는데 스케줄(6초)과
검증 창(10·20초)이 같은 자릿수라 **실행 속도가 결과를 정했다**.

더 나쁜 함의: 그 flake 가 의도한 뮤턴트(낙관적 클리어 복원)의 실패와 **파일:라인·메시지까지
동일**하다. "뮤테이션 RED 를 봤다" 는 관측이 진짜 검출인지 노이즈인지 구분되지 않는다 — 이
테스트는 자신이 지키려는 결함 클래스에 대해 **신뢰할 수 없는 오라클**이었다. 앞으로 CI 에서
가끔 빨개지면 "flaky, 재실행" 으로 넘겨져 진짜 회귀를 삼킬 위험도 함께 지적됐다.

### C2 (documentation) — 계약 JSDoc 이 자기 자신과 모순

`seedWaitingFromStatus` JSDoc 이 "재차 실패가 그 **외** 이유면 `"continue"`" 라고 적은 바로 다음
줄에서 같은 경우를 `"refresh_deferred"` 로 서술한다. `git blame` 상 `refresh_deferred` 갈래를
도입하면서 15분 전에 쓴 문장을 **지우지 않고 아래에 상충하는 새 문장을 이어 붙인** 것.
그 stale 값(`"continue"`)은 정확히 `16_42_07` 에서 CRITICAL 로 잡힌 "거부된 토큰으로 SSE 를
여는" 그 버그의 반환값이다 — **두 라운드를 들여 없앤 문장이 함수 계약 문서 안에 되살아나 있었다.**

## Warning

| # | reviewer | 내용 |
|---|---|---|
| W1 | security | 내가 추가한 catch 의 `console.warn` 이 **토큰이 실린 URL** 을 그대로 찍을 수 있다(`openStream` 은 쿼리에 토큰을 넣은 뒤 `EventSource` 를 만든다). 공개 사이트 임베드라 호스트 페이지 스크립트도 콘솔을 읽는다 |
| W2 | testing | `isTerminalAuthError` 의 `instanceof EiaError` 가드를 지워도 **429/429 초록** — 비-종단 케이스가 전부 `.status` 자체가 없어 가드가 장식이었다 |
| W3 | maintainability | `start()`/`applyConfig` 의 꼬리 4단계 블록이 여전히 리터럴 복제 — "가드를 한쪽에만" 의 다음 자리 |
| W4 | documentation | plan 상단 색인 표가 리네임된 절(`§미해결`→`§해소됨`)을 옛 이름으로 가리킨다 |
| W5 | documentation | `plan/complete` 각주가 "spec 6문서 전부 `implemented` 는 더 이상 참이 아니다" 를 현재형으로 단정한 채 남아 **다시 거짓**이 됐다 |

## 이 라운드의 성격

동작 결함은 0 이다(side_effect·requirement·scope 전부 NONE). 남은 것은 **내 검증 장치와 내
서술이 못 미더웠다**는 두 축이다:

- C1·W2 — 테스트가 각각 "환경에 따라 갈린다", "지워도 안 잡힌다". 둘 다 GREEN 이 증거가 아니었다.
- C2·W4·W5 — 같은 사실을 복제한 자리 세 곳이 서로 다른 시점에 굳어 있었다.

**세 번 다 "고친 뒤 인접 자리를 안 봤다" 는 같은 뿌리다.** 이번엔 코드가 아니라 검증과 문서에서
났다.

## RISK: HIGH
## CRITICAL_COUNT: 2
## WARNING_COUNT: 5
