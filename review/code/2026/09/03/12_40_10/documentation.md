# 문서화(Documentation) 코드 리뷰

## 검증 방법

이번 diff 는 (1) WS `auth.token_expired` 소켓 타이머 하드닝 3개 소스 파일, (2) 그 작업의 plan
트래커, (3) 이전 두 리뷰 라운드(`11_57_58`, `12_16_24`)가 새로 남긴 산출물 전체(29개 파일)로
구성된다. 두 선행 라운드의 documentation/maintainability 리뷰가 이미 JSDoc 오귀속(WARNING)과
JSDoc-선언 사이 빈 줄(INFO)을 지적했으므로, 이번 라운드에서는 "그 지적이 실제로 해소됐는가"를
**저장소 현재 상태를 직접 `Read` 로 열어** 재검증하는 데 집중했다(프롬프트 diff 만 보지 않음).

- `codebase/backend/src/modules/websocket/websocket.gateway.ts:140-235` 전문 확인
- `codebase/backend/src/modules/websocket/websocket-events.types.ts:280-315` 전문 확인
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 전문 확인
- `git status --short` — 리뷰 시작 시점 클린(과거 라운드가 관측했던 병렬 뮤테이션 잔여물 없음)

## 발견사항

- **[WARNING]** plan 트래커 안에서 `리뷰 2R W1` 라벨이 **서로 다른 두 리뷰 사이클의 서로 다른
  발견**에 중복 사용되어, 같은 태그가 같은 문서 안에서 두 가지를 가리킨다
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:158`(`**만료 타이머 지터
    (리뷰 2R W1, performance)**`)와 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:169`
    (`**셧다운 중 만료 콜백 미실행** (리뷰 2R W1)`)
  - 상세: 이 plan 파일은 두 개의 별개 리뷰 사이클을 함께 기록한다 — 원 PR `#1266` 의 5라운드
    `/ai-review`(`:90` "5라운드 — 신규 WARNING 8→5→4→3→0")와, 그 뒤 "이월 INFO 5건"을 닫는
    별도의 2라운드 서브사이클(`review/code/2026/09/03/11_57_58/` = 1R, `12_16_24/` = 2R). 두
    사이클 모두 라운드를 `1R`/`2R`/`4R` 로 축약해 부르는데(`:89` "리뷰 1R C2", `:118`/`:123`
    "리뷰 2R W5", `:129` "리뷰 4R W1", `:181` "리뷰 1R api_contract W6" — 전부 원 PR 5라운드
    리뷰), `:158` 과 `:169` 가 **정확히 같은 문자열 `리뷰 2R W1`** 을 서로 다른 대상에 쓴다.
    `:158`(지터, performance 카테고리)은 원 PR 5라운드 리뷰의 2번째 라운드 W1 을 가리키고,
    `:169`(셧다운 중 콜백 미실행)은 서브사이클 `12_16_24`(2R) 의 W1(`review/code/2026/09/03/
    12_16_24/SUMMARY.md` 의 유일한 WARNING, side_effect 카테고리)을 가리킨다. `:176-177` 의
    "1R RESOLUTION"·"2R reviewer" 도 같은 서브사이클을 가리키지만 링크가 없어(아래 두 번째
    항목 참고) 독자가 어느 "2R" 인지 원문 맥락(카테고리·주제) 으로만 구분해야 한다.
    이 라벨 충돌은 직전 라운드(`review/code/2026/09/03/12_16_24/documentation.md` INFO#2)가
    "커밋 메시지의 `리뷰 1R` 재사용이 `git log -S` 추적을 혼동시킨다"고 지적한 것과 **같은
    병의 재발**이다 — 그때는 커밋 메시지 1곳이었지만, 지금은 **plan 본문 안에서 11줄
    간격으로 동일 태그가 두 번 다른 대상에 쓰인다**는 점에서 더 직접적인 독자 혼동 소지다.
  - 제안: 서브사이클 라운드는 원 PR 5라운드와 구분되는 별도 표기(예: `서브 1R`/`서브 2R`,
    또는 세션 타임스탬프 `11_57_58`/`12_16_24` 자체를 라벨로 사용)로 바꿔 `:169`·`:176-177`
    를 정정한다. 원 PR 5라운드 쪽(`:89,118,123,129,158,181`)은 기존 관례이므로 그대로 두어도
    되나, 최소한 두 라벨 체계가 다르다는 한 줄 범례를 plan 상단에 추가하면 향후 재발을 막는다.

- **[INFO]** JSDoc 오귀속(WARNING, `11_57_58`)·JSDoc-선언 사이 빈 줄(INFO, `12_16_24`) 모두
  **현재 저장소 상태에서 완전히 해소됨을 직접 확인**(긍정 확인)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:147-235`
    (`expiryTimers` 필드 JSDoc 단일 블록, `armExpiryTimers` JSDoc 이 자신의 선언 바로 위,
    `clearExpiryTimers` 가 `armExpiryTimers` 뒤로 이동해 자신의 JSDoc 을 보유),
    `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-315`
    (`AuthTokenExpiredPayload` JSDoc 이 인터페이스 바로 위, `MSG_AUTH_TOKEN_EXPIRING` 이 인터페이스
    **뒤**에 자신의 JSDoc 과 함께 위치)
  - 상세: `Read` 로 두 파일을 전문 대조한 결과, 어느 JSDoc 블록도 중복·오귀속·`*/` 와 선언 사이
    빈 줄이 없다 — 3라운드에 걸쳐 지적된 문서-선언 인접성 문제가 최종적으로 완전히 정리됐다.
  - 제안: 없음(조치 완료 확인).

- **[INFO]** plan 트래커의 "이월 INFO 5건" 항목이 재발-재수정 하위 사이클을 교차 참조하도록
  보강됐고(`12_16_24` INFO#7 요청 반영), 뮤테이션 축 수 표기(3 vs 4)도 plan 전체에서
  "4축"으로 통일됨을 확인
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:93-113`
  - 상세: `:110-113` 이 "닫는 과정이 새 결함 3건을 만들었다"며 `69aad5d5d`→`11_57_58`
    라운드→`b75e6a76b` 정정 이력을 링크(`[11_57_58](../../review/code/2026/09/03/11_57_58/
    SUMMARY.md)`)와 함께 명시하고, `:94` 는 "뮤테이션 4축 RED"로 축 수를 통일했다(선행
    라운드가 지적한 plan-vs-RESOLUTION 3-대-4 불일치 해소).
  - 제안: 없음(조치 완료 확인). 다만 위 WARNING 과 연결되는 지점으로, `12_16_24`(서브
    2R) 라운드에는 `11_57_58` 과 같은 형태의 명시적 마크다운 링크가 plan 어디에도 없다
    (`grep '12_16_24' plan/...` 결과 0건). `:169-179` 의 "셧다운 중 만료 콜백 미실행" 항목이
    그 라운드의 유일한 근거인데 링크가 없어, 위 WARNING 의 라벨 정정과 함께 `12_16_24/
    SUMMARY.md` 링크를 추가하면 두 서브라운드의 문서화 수준이 대칭을 이룬다.

## 확인했으나 문제 없는 항목

- README/CHANGELOG: 이번 diff 는 이미 `#1266` 로 머지된 `auth.token_expired` 기능의 내부
  하드닝(private 필드·헬퍼 정리, `unref()`, wire 문구 상수화)일 뿐 API·설정·wire shape 를
  바꾸지 않는다. `CHANGELOG.md:36` 의 기존 "Unreleased — 소켓 수명이 토큰 수명에 종속된다"
  항목은 `{message, expiresAt}` shape 만 서술해 여전히 정합하고, 리터럴 문구 자체를 인용하지
  않으므로 갱신 불요.
- `MSG_AUTH_TOKEN_EXPIRING` 자체 JSDoc(단일 SoT 근거)·`clearExpiryTimers` JSDoc(무장·해제
  공유 절차 근거)·`expiryTimers` 필드 JSDoc(non-optional 근거)은 모두 내용이 정확하고 실제
  코드 동작과 1:1 대응한다.
- `websocket.gateway.spec.ts` 신규/보강 테스트(재무장 개별 단언, `exp` 없는 재무장, 음수
  clamp, unref 정밀 단언)의 인라인 주석은 각 단언이 **왜** 그 형태인지(합계가 아니라 개별,
  `>=2` 가 아니라 `toBe(2)`, clamp 자체는 지키지 않음을 명시)를 정확히 설명하며 코드와
  어긋나지 않는다.
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:169-179` 의 새 런북 항목은
  `12_16_24` 라운드가 지적한 "추적한다고 적으면서 추적처를 만들지 않았다"는 문제를 실제
  런북 항목 신설로 해소했다 — 자기반성 문구(`:176-179`)와 재개 신호(`:173-174`)가 함께 있어
  다음 사람이 재현할 수 있다.
- 이번 diff 로 새로 커밋된 `review/code/2026/09/03/{11_57_58,12_16_24}/**` 산출물 자체는 이
  저장소 관례(코드 리뷰 산출물은 `review/code/**` 에 보존)와 일치하며, RESOLUTION.md 가 각
  WARNING/INFO 의 조치·미조치 근거를 실측과 함께 남겨 향후 재판단에 필요한 근거가 보존된다.

## 요약

3라운드에 걸쳐 지적된 문서 결함(JSDoc 오귀속 2건, JSDoc-선언 사이 빈 줄 2건, "런북 추적 중"
허위 주장, plan-RESOLUTION 축 수 불일치, 재발 하위사이클 미교차참조)은 이번 diff 시점
저장소 상태에서 **전부 실제로 해소됐음을 직접 `Read` 로 확인**했다. 새로 발견한 것은 plan
트래커 내부의 라벨 충돌 1건이다 — 원 PR `#1266` 의 5라운드 리뷰와 "이월 INFO 5건" 서브사이클
2라운드가 둘 다 `1R`/`2R` 축약을 쓰는데, `:158` 과 `:169` 가 **동일 문자열 `리뷰 2R W1`** 을
서로 무관한 두 발견에 각각 붙였다. 직전 라운드가 이미 "같은 병"을 커밋 메시지 수준에서
지적했음에도 plan 본문에서 더 좁은 간격으로 재발했다는 점에서 WARNING 으로 올린다. 그 외에는
CHANGELOG/README 갱신 불요, 인라인 주석·JSDoc 품질 양호, 새 런북 항목 근거 확보 등 문서화
품질이 전반적으로 양호하다.

## 위험도

LOW
