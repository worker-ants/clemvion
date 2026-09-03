# 테스트(Testing) 리뷰 — WS `auth.token_expired` 이월 INFO 정리 (3라운드 누적 diff)

## 컨텍스트

이 diff 는 이미 2라운드(`review/code/2026/09/03/11_57_58`, `12_16_24`)를 거친 상태다. 두 라운드
모두 testing 관점에서 상세히 검토됐고(JSDoc 오귀속 복원, rearm 개별 단언, cutoff 음수-clamp
테스트 추가, unref 정밀화 등), 이번 라운드에 제출된 코드는 그 조치가 전부 반영된 최종 상태다.
실제 파일(`Read`)로 재확인해 프롬프트 조립본의 착시가 아님을 검증했다. 이번 리뷰는 그 위에서
**새로 남은 갭**을 찾는 데 집중했다.

## 검증 방법 (뮤테이션, 저장소 밖 백업 후 원복)

`codebase/backend/src/modules/websocket/websocket.gateway.ts` 원본을 scratch 디렉터리(`mktemp`
계열 세션 스크래치)로 `cp` 백업 → 저장소 파일을 직접 뮤테이션 → 테스트 실행 → `cp` 로 원복 →
`diff`+`git status --short` 로 잔여물 없음 확인. 아래 1건을 직접 재현했다.

| 뮤테이션 | 대상 | 전체 스위트(72개, `--runInBand`, 필터 없음) 결과 |
|---|---|---|
| `armExpiryTimers` 내부 `notice`(사전 통지) `setTimeout` 블록과 `cutoff`(강제 종료) `setTimeout` 블록의 **선언 순서를 통째로 교환**(각 블록의 delay·콜백 내용은 그대로, 등록 순서만 뒤바꿈) | `websocket.gateway.ts:203-220` | **72/72 GREEN — 생존**(3회 반복 확인) |

원복 확인: `diff` 결과 0바이트, `git status --short` 에 해당 파일 무변경으로 확인.

> **방법론 메모**: 처음에 `-t "만료"`(describe 타이틀 매칭이라 10개 테스트만 포함)로 필터링해
> 돌렸을 때는 rearm 관련 2개 테스트가 실패했다. 그런데 **필터 없는 전체 파일 실행(72개)은 3회
> 반복 모두 GREEN** 이었다 — `-t` 필터가 실제 스위트 실행과 다른(오탐) 결과를 냈다. 뮤테이션
> 유효성 판단은 반드시 **필터 없는 전체 스위트**로 최종 확인해야 한다는 것을 이 세션에서 다시
> 확인했다. 아래 발견사항은 필터 없는 전체 실행 결과를 근거로 한다.

## 발견사항

- **[WARNING]** `이미 만료된 exp 로 연결하면 즉시 끊는다` 테스트는 "통지가 종료보다 먼저 발생한다"는
  순서 계약을 검증하지 않는다 — 위 뮤테이션(등록 순서 교환)이 필터 없는 전체 스위트에서 **생존**을
  확인했다.
  - 위치: 테스트 `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:859-874`;
    소스 `codebase/backend/src/modules/websocket/websocket.gateway.ts:203-209`(`notice` 타이머
    생성)·`:214-220`(`cutoff` 타이머 생성)
  - 상세: 일반적인 경우(`secondsFromNow` 가 lead time 보다 충분히 크거나, `894`행 테스트처럼
    `notice` 만 클램프되고 `cutoff` 는 여전히 양수인 경우)는 두 타이머의 지연값이 서로 다르므로
    Node 의 시간 기반 스케줄링이 자연히 순서를 강제한다. 그런데 `859`행 테스트처럼 `exp` 가
    **이미 완전히 과거**여서 `untilNotice`·`untilCutoff` 가 **둘 다** `Math.max(0, …)` 로 0 에
    클램프되는 경우, 두 타이머는 같은 목표 시각을 갖는 **동시 도달(tie)** 상태가 되고, 이때
    실행 순서는 Node 런타임이 **등록(생성) 순서**로 결정한다(FIFO). 현재 소스는 `notice` 를
    먼저 생성해 "통지 먼저, 그다음 종료"를 우연이 아니라 등록 순서로 보장하고 있는데, 그 등록
    순서를 뒤바꾸는 리팩터(예: 가독성 개선을 이유로 두 블록을 재배치)가 있어도 `859`행 테스트는
    `emit`·`disconnect` 가 **각각 호출됐다는 사실**만 단언할 뿐 **어느 것이 먼저인지**는 단언하지
    않으므로 계속 GREEN 이다 — 실측으로 확인(위 표). 이 코드의 주석 자체가 "즉시 통지 + 즉시
    종료"(865행 근처)를 관측 가능한 동작으로 명시하고 있고, 통지-후-종료라는 계약이 이 기능의
    핵심 설계 근거(§1.2, "재발급 창을 준다")이므로, 그 순서가 깨지는 리팩터를 지금은 아무 테스트도
    잡지 못한다.
  - 제안: `859`행 테스트에 `emit`·`disconnect` 두 mock 의 `mock.invocationCallOrder`(또는
    `jest.fn()` 호출 시각 스탬프) 를 비교하는 단언을 추가하거나, 두 mock 을 하나의 공유
    호출-순서 배열(`const order: string[] = []`)에 push 하도록 구성해
    `expect(order).toEqual(['emit', 'disconnect'])` 형태로 순서를 직접 고정한다.

- **[INFO]** `expSeconds` 가 `NaN`/`Infinity` 인 경로는 여전히 명시 테스트가 없다 (이월, 우선순위
  낮음 — 새 결함 아님)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:185`
    (`typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)`)
  - 상세: 이전 두 라운드(`11_57_58`, `12_16_24`) testing 리뷰가 이미 동일 갭을 지적했고, 팀은
    "`undefined` 케이스와 동일한 조기 return 경로라 우선순위 낮음"으로 판단을 유지했다(round-2
    RESOLUTION #6). 새로 발견한 것은 아니며 재확인만 한다 — 판단 유지에 이견 없음.
  - 제안: 조치 불요(기존 판단 유지). 필요 시 `exp: NaN` 1케이스만 추가.

## 회귀·격리·가독성 (문제 없음, 확인)

- 신규 테스트 5종(메시지 상수 이중 단언, rearm 개별 단언, exp-less rearm, 음수-clamp 즉시종료,
  unref 정밀 단언)은 각각 고유 `client.id` 를 쓰고, 최상위 `beforeEach` 가 `TestingModule` 을
  매번 재생성해 `expiryTimers` Map 이 테스트 간 누수되지 않는다 — 독립 실행 가능함을 확인했다
  (전체 스위트를 3회 반복 실행해도 동일하게 72/72, flake 없음).
- `handleDisconnect` 를 만료 타이머가 없는 소켓(암묵적으로 `armExpiryTimers` 를 거치지 않은
  `client-1`)에 호출하는 기존 테스트(`websocket.gateway.spec.ts:986-998`)가 `clearExpiryTimers`
  의 `if (!timers) return;` 조기 반환 분기를 암묵적으로 커버한다 — 크래시 없이 통과하는 것 자체가
  방어 성립의 증거. 명시적 단언은 아니지만 새로 조치가 필요한 갭은 아니라고 판단(이전 라운드
  판단과 동일).
- `MSG_AUTH_TOKEN_EXPIRING` 문구 리터럴이 소스·테스트 두 곳에 이중 관리되는 것은 "관측 가능한
  wire 계약을 의도적으로 못박는다"는 설계 트레이드오프로, 이전 라운드가 이미 뮤테이션으로 실효성을
  검증했고 이번에도 이견 없음.

## 리뷰 스코프 밖

`review/code/2026/09/03/{11_57_58,12_16_24}/*.md`, `*.json` (이전 라운드 산출물)은 애플리케이션
코드가 아니어서 테스트 관점 분석 대상이 아니다. 워크트리에 별도로 존재하는
`sessions.service.spec.ts`, `test/users-change-password.e2e-spec.ts` 변경은 이번 `testing.md`
프롬프트의 리뷰 대상 파일 목록(파일 1~4)에 포함되지 않아 스코프 밖으로 판단했다.

## 요약

이월 INFO 정리 자체는 2라운드에 걸쳐 촘촘히 검증됐고(뮤테이션 다축 RED, JSDoc 복원, 개별 단언
정밀화) 이번 라운드에서도 회귀·격리·가독성 문제는 발견되지 않았다. 다만 이번 라운드에서 직접
뮤테이션(등록 순서 교환)을 필터 없는 전체 스위트로 검증한 결과, "이미 만료된 토큰으로 연결하면
통지가 종료보다 먼저 나간다"는 계약이 순서 단언 없이 존재-단언(existence assertion)으로만
지켜지고 있어 향후 리팩터가 그 순서를 조용히 뒤집어도 현재 테스트는 잡지 못한다(WARNING 1건,
실측 확인). 그 외 이월된 `NaN`/`Infinity` 커버리지 갭은 기존 판단(우선순위 낮음)을 유지한다.
차단 사유는 없다.

## 위험도

LOW
