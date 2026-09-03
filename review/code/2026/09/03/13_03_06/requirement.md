# 요구사항(Requirement) 리뷰 — WS `auth.token_expired` 이월 INFO 5건 정리 (최종 수렴 확인)

## 검증 방법

- 리뷰 대상 diff(`origin/main`(`af41a3c6e`) 대비 `HEAD`(`a1984f196`))는 4개 커밋
  (`d73eff860` 은 이미 `origin/main` 에 있음 → `69aad5d5d` → `b75e6a76b` → `80ac92668` →
  `a1984f196`)의 누적 결과이며, 프롬프트에 함께 실린 `review/code/2026/09/03/{11_57_58,12_16_24,12_40_10}/**`
  는 **이전 3개 리뷰 라운드의 산출물**(코드 아님)이다. 실질 코드 변경은
  `codebase/backend/src/modules/websocket/{websocket-events.types.ts, websocket.gateway.ts,
  websocket.gateway.spec.ts}` 3개 파일과 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`.
- 세 라운드(`11_57_58`→`12_16_24`→`12_40_10`)가 이미 requirement 관점에서 각각 LOW→NONE→NONE 으로
  수렴했음을 확인했고, 이번 라운드는 그 뒤에 실제로 새 커밋(`a1984f196`, `12_40_10` WARNING 2건
  fix)이 얹힌 **최종 상태**를 독립적으로 재검증하는 4번째 라운드다.
- `Read` 로 `websocket.gateway.ts`(147-320행)·`websocket-events.types.ts`(270-316행)·
  `websocket.gateway.spec.ts`(692-920행) 전체를 직접 열어 현재 소스와 spec/plan 서술을 대조했다.
- `spec/5-system/6-websocket-protocol.md` §1.2(`:50-51`)·§4.6(`:874`)·Rationale
  `R-ws-socket-lifetime-binds-token`(`:1135-`)을 grep/Read 로 열어 lead time(60초)·payload shape
  (`{message, expiresAt}`)·"1회 emit" 요구·revoke 카브아웃 서술을 코드와 line-level 대조했다.
- `git diff 80ac92668 a1984f196 -- .../websocket.gateway.spec.ts` 로 3R(`a1984f196`) 실제 변경분이
  커밋 메시지 주장대로 **테스트 순서 단언 7줄뿐**이며 프로덕션 코드(`websocket.gateway.ts`,
  `websocket-events.types.ts`)는 `12_16_24` 상태 그대로임을 직접 확인했다.
- `grep -rn "#1270"`/`connectionStateRecovery` 로 이전 라운드가 지적한 두 WARNING(존재하지 않는
  PR 번호 인용, `connectionStateRecovery` 활성 여부 전제)이 각각 해소/유지됨을 재확인했다.
- 저장소 파일을 뮤테이션하지 않고 read-only 로만 조사했다(`git status --short` 로 세션 확인).

## 발견사항

- **[INFO]** 직전 3라운드가 지적한 결함이 현재 `HEAD` 에서 전부 해소돼 있음을 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:161-176`(`armExpiryTimers`
    JSDoc, 빈 줄 없이 선언 바로 위), `:230-234`(`clearExpiryTimers` 자신의 JSDoc), `:180-183`
    (`armExpiryTimers` 조기 `return` **이전**의 선제 `clearExpiryTimers` 호출);
    `websocket-events.types.ts:287-305`(`AuthTokenExpiredPayload` JSDoc → 인터페이스 → 신규
    `MSG_AUTH_TOKEN_EXPIRING` 상수 순서 복원);
    `websocket.gateway.spec.ts:875-880`(notice→cutoff 호출 순서를 `invocationCallOrder` 로 단언).
  - 상세: (1) JSDoc 오귀속 2건(1R 5명 독립 발견)은 `b75e6a76b` 에서 대상 선언 바로 위로 복원됐고
    `12_16_24` 가 지적한 "복원 시 남은 빈 줄"도 없다. (2) W3(조기 `return` 이 선제 해제보다 먼저
    도는 회귀)도 `:180-183` 에서 `if (...) return;` 보다 앞에 `clearExpiryTimers` 호출이 있어
    해소돼 있다. (3) `12_40_10` WARNING#1("이미 만료된 exp" 테스트가 notice→cutoff 순서를
    검증하지 않음)은 `a1984f196` 이 `emit.mock.invocationCallOrder[0] < disconnect.mock.invocationCallOrder[0]`
    단언을 추가해 닫았고, 커밋 메시지가 주장한 "뒤바꾸면 생존 → 조치 후 RED" 를 코드 검토로
    재현 가능한 형태임을 확인했다(로직상 두 `setTimeout` 등록 순서를 바꾸면 이 단언이 실패하는
    것이 성립). (4) `12_40_10` WARNING#2(`리뷰 2R W1` 라벨이 plan 안에서 15줄 간격으로 서로
    다른 두 사이클을 가리킴)는 plan 상단(`:25-33`)에 "라운드 라벨 범례"가 추가돼 원 PR 5라운드와
    서브사이클(세션 타임스탬프)을 명시적으로 분리했고, `grep -n "#1270" plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
    결과 0건으로 그 라운드가 예측해 쓴 존재하지 않는 PR 번호 참조도 지금은 문서 내 링크
    참조로 치환돼 있다(과거 리뷰 산출물 안의 `#1270` 언급은 그 시점의 역사 기록이라 남아있는
    것이 정상).
  - 제안: 없음(확인 목적 기록). 새 코드 fix 불필요.

- **[INFO]** 핵심 기능이 spec `R-ws-socket-lifetime-binds-token`/§1.2/§4.6 과 line-level 로
  계속 일치함
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:145`(`TOKEN_EXPIRY_LEAD_MS = 60_000`,
    spec §1.2 `:50` "만료 60초 전"과 일치), `:176-228`(`armExpiryTimers`), `:301-319`(`handleDisconnect`
    → `clearExpiryTimers` 위임); `websocket-events.types.ts:283-305`(`AuthTokenExpiredPayload
    { message, expiresAt }`, spec §4.6 `:874` shape 와 일치, `expiresAt` 의미도 "이 소켓이 강제
    종료되는 시각"으로 spec 문구와 동일).
  - 상세: `connectionStateRecovery` 는 코드베이스 전체에서 게이트웨이 설정에 존재하지 않음을
    grep 으로 재확인했다 — 재무장(rearm) 테스트가 검증하는 경로가 "현재 도달 불가, 향후 대비"
    라는 plan/코드 서술의 전제가 그대로 유효하다. `exp` 판별도 `typeof !== 'number' ||
    !Number.isFinite(...)` 로 falsy(`exp === 0`) 를 오분류하지 않는다.
  - 제안: 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 마커 없음(3개 소스 파일 전수 grep, 0건). 반환값·에러 경로도
  모든 분기(정상/조기 return)에서 정의된 동작(`void`)을 가지며 예외를 흘리지 않는다.
  - 위치: 변경 파일 전체
  - 제안: 없음.

- **[INFO]** 유일하게 남은 잔여 항목("배포 런북"이 아직 실체 문서가 아니며 참조가 plan
  안에 4건 누적)은 코드 결함이 아니라 이미 `12_40_10` requirement 라운드가 확인한 것과 동일한
  **의도적으로 근거·재개 신호를 명시한 유예**다 — 새 항목이 아니다.
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:179-198`
  - 제안: 없음(참고 기록). 다섯 번째 참조가 생기면 실제 ops 문서로 수렴시키겠다는 plan 자체의
    임계값 서술을 그대로 유지.

## 요약

이번 diff(4커밋 누적, `a1984f196` 이 최종)는 3라운드(`11_57_58`→`12_16_24`→`12_40_10`)에 걸쳐
requirement 관점에서 발견된 모든 WARNING(JSDoc 오귀속 2건, `armExpiryTimers` 조기 `return`
회귀, notice→cutoff 순서 미검증, plan 라벨 충돌+존재하지 않는 PR 번호 인용)이 현재 `HEAD` 에서
**전부 코드/문서로 해소돼 있음**을 독립적으로(직접 `Read`·`git diff`·`grep` 재확인, 뮤테이션
재실행 없이 정적 대조) 확인했다. 핵심 기능(소켓 수명을 토큰 수명에 종속시키는 `auth.token_expired`
사전 통지 1회 emit + 만료 시 `disconnect()`, 타이머 쌍 해제)은 spec §1.2·§4.6·Rationale
`R-ws-socket-lifetime-binds-token` 과 line-level 로 일치하며, TODO/FIXME 류 미완성 표식이나 새로운
엣지 케이스 누락은 발견되지 않았다. 남은 유일한 항목("배포 런북" 미실체화)은 새 발견이 아니라
이미 근거·재개 조건이 명시된 기존 유예 항목이다. 새로운 CRITICAL/WARNING 없음 — 이번 라운드에서
요구사항 관점의 추가 조치는 불필요하다.

## 위험도

NONE

## 부록 — 리뷰 중 관측한 워킹트리 이상 상태 (내가 만든 변경 아님)

리뷰 종료 직전 `git status --short` 로 확인한 결과, `codebase/backend/src/modules/websocket/websocket.gateway.ts`
에 **커밋되지 않은 워킹트리 수정**이 있었다 — `notice`/`cutoff` 두 `setTimeout` 블록의 **등록 순서를
서로 바꾸는** 변경으로, `websocket.gateway.spec.ts:875-880`(`a1984f196` 이 추가한
`invocationCallOrder` 순서 단언, 본 리포트 위 발견사항 참조)이 정확히 무는 뮤테이션 형태와 일치한다.
본 리뷰는 이 파일을 뮤테이션하지 않았다(read-only 로만 조사) — 동시에 같은 워킹트리를 읽는 다른
reviewer 가 그 단언을 검증하려고 건 뮤테이션을 진행 중인 상태를 그 순간에 관측한 것으로 보인다.
프롬프트 규약에 따라 `git checkout`/`restore` 로 되돌리지 않았고 이 파일도 건드리지 않았다 — 위
발견사항·위험도는 **커밋된 `HEAD`(`a1984f196`) 기준**이며 이 일시적 워킹트리 상태와 무관하다.
다음 라운드에서 같은 파일이 또 흔들리면 그때는 실제 레이스로 승격해 조사할 것.
