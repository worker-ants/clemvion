# 변경 범위(Scope) 리뷰

## 컨텍스트 확인

리뷰 대상 diff 는 두 개의 별도 커밋을 합친 것이다(`git log`로 확인):

- `69aad5d5d fix(ws): 이월 INFO 5건을 한 번에 닫았다` — `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
  의 "이월 INFO — 다음에 이 파일을 만질 때 함께 정리" 항목(5건: cutoff clamp 주석·`expiryTimers`
  non-optional화·`MSG_AUTH_TOKEN_EXPIRING` 상수 승격·`armExpiryTimers` 선제 해제·`.unref()`)을
  그대로 이행.
- `b75e6a76b fix(ws): 리뷰 1R — 새 심볼을 JSDoc 과 그 대상 사이에 끼워 넣었다` — 직전 커밋에 대한
  1차 `/ai-review`(위험도 MEDIUM·Critical 0·Warning 3)의 W1/W2(JSDoc 오귀속)·W3(재무장 시
  선제 해제가 조기 return 뒤에 도는 조합 누락) 및 INFO 3건을 수정. 이 커밋에 review 산출물
  `review/code/2026/09/03/11_57_58/**`(15개 파일) 커밋 포함.

## 발견사항

- **[INFO]** JSDoc 재배치 과정에서 빈 줄 2곳 신설 — 실질 영향 없음(검증됨)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `armExpiryTimers` JSDoc
    끝(`*/`)과 `private armExpiryTimers(` 선언 사이 (diff 게이트 `176`행, 빈 줄 삽입).
    `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `AuthTokenExpiredPayload`
    JSDoc 끝과 인터페이스 선언 사이(diff 게이트 `302`행, 빈 줄 삽입).
  - 상세: W1/W2("새 심볼이 JSDoc 과 대상 선언 사이에 끼어 orphan JSDoc 을 만들었다")를 고치는
    과정에서 재배치된 JSDoc 과 원래 대상 선언 사이에 빈 줄이 하나씩 새로 생겼다. TypeScript
    컴파일러 API(`ts.getJSDocCommentsAndTags`)로 직접 확인한 결과 **빈 줄이 있어도 JSDoc 은
    해당 선언에 정상 귀속된다** — 즉 이번 수정의 목적(JSDoc 재귀속)은 달성됐고 이 빈 줄은
    기능적으로 무해한 순수 포맷팅 부산물이다. 다만 파일 내 다른 JSDoc-선언 쌍(예:
    `clearExpiryTimers`, `MSG_AUTH_TOKEN_EXPIRING`)은 빈 줄 없이 바로 붙어 있어 스타일이
    일관되지 않는다.
  - 제안: 실질 문제 아님. 다음에 이 파일을 만질 때 정리해도 되는 수준의 트리비얼 포맷 편차.

- **[INFO]** 병렬 리뷰로 인한 워킹트리 일시 오염 관측 — 이 diff 와 무관, 현재는 해소됨
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts` (파일 전체, 특정
    줄 아님 — 관측 시점의 `git diff` 출력)
  - 상세: 리뷰 도중 `git status --short` 확인 시 이 파일에 커밋되지 않은 수정이 존재했다
    (`MSG_AUTH_TOKEN_EXPIRING` 리터럴이 `'Access token expires soon — refresh and reconnect.'`
    → `'Access token will expire soon — refresh and reconnect.'` 로 1단어 치환). 이는 리뷰
    대상 diff(두 커밋)에 없는 내용이며, RESOLUTION.md/plan 이 주장하는 "메시지 상수 값 변경 →
    뮤턴트 RED" 를 검증 중인 **다른 병렬 reviewer 의 뮤테이션 산출물**로 추정된다. 이 reviewer 는
    저장소 파일에 직접 쓰지 않고 관찰만 했으며, 재확인 시점(`git status --short`)에는 이미
    원상 복구되어 있었다 — 조용히 넘기지 말라는 규약에 따라 관측 사실만 기록한다. 실제 코드
    scope 결함이 아니다.
  - 제안: 조치 불요(이미 해소). 후속 라운드에서 같은 파일에 이유 불명의 diff 가 다시 보이면
    이 기록을 참고할 것.

## 범위 정합성 평가 (핵심)

- **plan 체크리스트 ↔ 코드 diff 1:1 대응**: `armExpiryTimers`/`clearExpiryTimers`/
  `MSG_AUTH_TOKEN_EXPIRING`/`expiryTimers` 타입/`.unref()`/`Math.max` 주석까지, plan 이 명시한
  5개 이월 INFO 항목과 실제 diff 의 변경 지점이 정확히 일치한다. 항목 외 추가 변경 없음.
- **`clearExpiryTimers` 신규 추출(private method)**: 별도 기능이 아니라 (a) `expiryTimers` 맵을
  optional→non-optional 로 좁히면서 `handleDisconnect` 의 방어적 `if (timers.notice)` 분기가
  불필요해진 것, (b) `armExpiryTimers` 진입부에 선제 해제 호출이 새로 필요해진 것 — 두 항목이
  동시에 요구하는 "무장·해제 두 자리가 같은 절차를 쓴다"는 리팩터로, 5개 이월 항목에 직접
  종속된 필연적 변경이다. 임의의 드라이브바이 리팩토링이 아니다.
  `handleDisconnect` 쪽은 동일 로직을 호출부로 치환한 것뿐 — 동작 변화 없음(diff 로 확인).
- **테스트 4건 추가**(`websocket.gateway.spec.ts`): 각각 항목 3(상수 일치)·항목 4(재무장 시
  해제, exp 有/無 두 조합)·항목 5(unref)에 정확히 대응. 항목 1(주석)·항목 2(타입)는 컴파일
  타임/문서성 변경이라 런타임 테스트가 불필요 — 테스트 부재가 스코프 이탈이 아니다.
  import 추가(`MSG_AUTH_TOKEN_EXPIRING`)도 그 테스트에서 즉시 소비된다(미사용 임포트 없음).
- **review 산출물 커밋 포함**(`review/code/2026/09/03/11_57_58/**` 15개 파일, `b75e6a76b`):
  CLAUDE.md 가 명시한 "코드 리뷰 산출물 → `review/code/**`" 저장 규약 및 developer SKILL 의
  구현 완료 후 `/ai-review` 강제 워크플로에 따른 정상 산출물이다. 직전 라운드가 자신의 코드를
  리뷰해 낸 SUMMARY/RESOLUTION 을 그 fix 커밋에 동봉하는 것은 이 저장소의 확립된 관행(다른
  커밋들도 동일 패턴)이며, 무관한 파일 혼입이 아니다.
- **plan 파일 diff**: 이월 INFO 체크박스 문구를 완료 서술로 교체 — 코드 변경과 1:1 대응하는
  진행 기록 갱신. `spec_impact: none`, `owner: developer` 등 frontmatter 는 무변경. 범위 밖
  섹션(예: "머지 후 planner 턴") 은 diff 에 포함되지 않음(컨텍스트로만 인용됨 — 게이트 `107`행은
  변경 없는 문맥 줄임을 원본 diff 마커로 확인).
- **불필요한 리팩토링/기능 확장/무관한 파일/설정 변경**: 없음. import 재정렬은 신규 심볼 추가에
  종속된 최소 변경. 주석 추가는 전부 이번 라운드가 고친 이유를 설명하는 근거 주석으로, 이
  저장소의 기존 관례(코드 내 리뷰 라운드 인용)와 일치.

## 요약

두 커밋 모두 각자 선언한 목적(plan 의 이월 INFO 5건 이행, 그리고 그 fix 에 대한 1차 리뷰가
지적한 W1/W2/W3 + INFO 3건 수정)에 정확히 대응하는 diff 만 포함하고 있다. 신규 `private`
메서드 추출은 선언된 항목들이 요구하는 필연적 결과이며, 테스트·임포트·주석 변경도 전부 그
범위 안에서 설명 가능하다. review 산출물을 코드 fix 와 같은 커밋에 넣은 것도 이 프로젝트의
문서화된 워크플로다. 실질적 스코프 이탈은 발견되지 않았다. 리뷰 중 관측한 두 건(JSDoc 앞
빈 줄 신설, 병렬 리뷰의 일시적 워킹트리 뮤테이션)은 둘 다 기능적으로 무해하며 이미 자체
해소되었거나 검증으로 무해함이 확인되어 INFO 로만 기록한다.

## 위험도
NONE
