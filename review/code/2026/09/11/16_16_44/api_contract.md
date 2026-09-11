# API 계약(API Contract) 리뷰

## 검증 방법 (요약)

리뷰 대상 diff 는 `3796c7308`(base) 이후 3개 커밋(`2ae81077c` 순수 이동 → `6dc2b7d60`
전용 spec 12건 + 트래커 정정 → `81d2a8c18` 뮤테이션 커버리지 공백 보강 + JSDoc 각주 1줄)의
누적분이다. 저장소 트리에는 아무것도 쓰지 않고 `git show`/`git diff`/`Read`/`grep` 읽기 전용
명령으로만 확인했다.

- `git diff 3796c7308..81d2a8c18 --stat -- codebase/backend/src/modules/triggers/dto/
  codebase/backend/src/modules/triggers/triggers.controller.ts …` → **출력 없음**. DTO·컨트롤러·
  라우트 정의는 이 3커밋 어디에도 포함되지 않는다.
- `git show 6dc2b7d60 -- .../chat-channel-input-rules.ts` → **빈 diff**. 이 커밋은 `.spec.ts`
  12케이스 신규 추가와 plan/tracker 문서 정정만 포함하며 런타임 코드는 한 글자도 바꾸지 않았다.
- `git show 81d2a8c18 -- .../chat-channel-input-rules.ts` → 변경분은 `translateSetupChannelError`
  JSDoc 에 "discord verify_key 불일치는 502 로 떨어진다" 라는 **주석 6줄 추가뿐**이고, 함수 본문·
  분기·에러 페이로드·정규식은 한 글자도 바뀌지 않았다. 같은 커밋의 나머지 diff(`.spec.ts` 99줄)는
  전부 `it.each` 교차 케이스·대칭 필드 테스트 추가다.
- `2ae81077c`(T1 이동) 자체의 계약 무변화는 이전 라운드(`review/code/2026/09/11/15_31_54/
  api_contract.md`)가 이동 전/후 함수 본문을 줄 단위로 대조해 이미 확인했고, 이번 라운드에서
  `git show`로 그 확인 범위(에러 봉투 형태·HTTP 상태 코드·provider 분기·오버로드 바인딩)를
  재대조해도 달라진 것이 없다.
- 즉 이번 diff 전체 구간(커밋 이력 기준)에서 **런타임 요청/응답 동작을 바꾸는 코드 변경은
  0줄**이다. 유일한 소스 변경은 이동(파일 위치)과 문서화(주석) 뿐이다.

### 관측된 저장소 이상 상태 (내가 만든 것 아님 — 참고용 보고)

리뷰 종료 직전 `git status --short` 를 반복 실행하는 중, `codebase/backend/src/modules/
triggers/chat-channel-input-rules.ts` 가 **working tree 에서 순간적으로 modified(`M`) 상태**로
나타났다가 다시 clean 으로 돌아오는 것을 두 차례 관측했다. `git diff` 로 그 순간의 내용을 보니
`assertInboundSigningPlaintextByProvider` 의 slack/discord 정규식(`SLACK_SIGNING_SECRET_REGEX`
↔ `DISCORD_PUBLIC_KEY_REGEX`)이 서로 뒤바뀐 상태였다 — 이는 커밋 `81d2a8c18` 메시지가 기술한
"정규식 스왑 뮤턴트"와 정확히 일치하는 패턴이다. 이 리뷰는 **병렬 fan-out** 이라 다른 reviewer
가 같은 워킹트리에서 사전 승인된 뮤테이션-검증 절차(원본을 고쳤다가 `cp` 로 원복)를 수행 중인
것으로 판단된다. 나는 이 파일을 Read/`git show` 로만 읽었고 Edit/Write 로 건드리지 않았으며,
`git checkout`/`restore` 도 실행하지 않았다. 본 보고서의 판정은 **커밋된 이력**(`git show`)을
근거로 하므로 이 일시적 working-tree 상태의 영향을 받지 않는다. 다음 사람이 이 잔여물을 진짜
결함으로 오인하지 않도록 기록해 둔다.

## 발견사항

이 diff 범위 안에서 API 계약 관점의 **행위 변화는 관측되지 않았다.**

- **[INFO]** 정규식 스왑 뮤턴트를 잡는 테스트가 추가되어, `SLACK_SIGNING_SECRET_REGEX`/
  `DISCORD_PUBLIC_KEY_REGEX` 분기(관점 5 — 요청 검증)의 회귀 방지력이 실측으로 강화됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (교차 케이스
    `it.each` 블록, 커밋 `81d2a8c18` 신규 추가분) · 대상 로직은
    `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:267,279`
    (`SLACK_SIGNING_SECRET_REGEX.test`/`DISCORD_PUBLIC_KEY_REGEX.test`)
  - 상세: 커밋 메시지가 밝히듯 이전 테스트는 slack(hex32)만 유효/무효로 검증해 "정규식이 두
    provider 간 뒤바뀌는" 뮤테이션도 GREEN 이었다. 이번 라운드는 한쪽의 유효값을 다른 쪽에
    넣는 교차 케이스를 추가해 그 뮤턴트를 RED 로 전환시켰다 — 코드(계약) 자체는 바뀌지 않았고
    테스트 신뢰도만 올라갔으므로 API 계약 관점에서는 위험 요인이 아니라 긍정적 보강이다.
  - 제안: 없음 — 조치 불요, 기록용 확인.

- **[INFO]** `translateSetupChannelError` 의 알려진 예외(discord verify_key 불일치 → 502)가
  JSDoc 에 명시되어 다음 소비자가 계약 부정확성을 코드만 읽고도 알 수 있게 됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:299-303`
  - 상세: 이 커밋(`81d2a8c18`) 이전부터 존재하던 결함(discord verify_key 불일치 시 의도한 400
    `BOT_TOKEN_INVALID` 대신 502 `CHAT_CHANNEL_SETUP_FAILED` 로 fallback)을 **현재 동작 그대로
    캐너리 테스트로 고정**하고, 그 사실을 함수 JSDoc 에도 적었다. 실제 수정(HTTP 상태 코드 변경)은
    이번 diff 범위 밖이며 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에
    별도 항목(근본 처방 후보 포함)으로 등재돼 있다 — 이전 라운드(`/ai-review`
    `review/code/2026/09/11/15_31_54`)가 이미 발견한 W3 항목의 후속 조치다.
  - 제안: 없음(이번 diff 범위 밖). 후속 커밋에서 상태 코드를 400 으로 정정할 때, 그 변경은
    **기존 클라이언트가 502 를 재시도 가능한 서버 오류로 취급하고 있었을 가능성**을 감안해
    "버그 수정" 성격이라도 API 응답 계약 변경으로 별도 리뷰가 필요함을 남겨 둔다.

점검 관점 1~8 (하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL/경로 설계·페이지네이션·
인증/인가)을 개별 대조한 결과, 이번 diff(누적 3커밋)로 인해 새로 생기거나 깨지는 것은 없다:

1. 하위 호환성 — 엔드포인트·요청/응답 스키마·상태 코드 무변경. Breaking change 없음.
2. 버전 관리 — 해당 없음(버전 표면 미접촉).
3. 응답 형식 — `BadRequestException` 페이로드 구조(`code`/`message`/`details.field`/
   `details.code`) 동일 유지.
4. 에러 응답 — 판정 로직·HTTP 상태 코드 조합(400 `VALIDATION_ERROR`/`BOT_TOKEN_INVALID`,
   502 `CHAT_CHANNEL_SETUP_FAILED`) 바이트 단위로 동일. 알려진 부정확성(discord 502) 은 이번
   diff 이전부터 존재했고 이번 라운드는 그것을 문서화·캐너리화했을 뿐 수정하지 않았다.
5. 요청 검증 — 6개 검증 함수의 판정 로직(순서·조건·정규식)은 무변경. 이번 라운드는 그 로직을
   검증하는 **테스트만** 강화했다(정규식 스왑·대칭 필드·조기 반환 등 커버리지 공백 보강).
6. URL/경로 설계 — 컨트롤러·라우트 파일이 이번 3커밋 어디에도 포함되지 않음(`git diff --stat`
   0건 확인).
7. 페이지네이션 — 무관 영역.
8. 인증/인가 — 컨트롤러 가드 무변경.

## 요약

이번 diff(`3796c7308..81d2a8c18`, 3커밋 누적)는 이전 라운드가 확인한 T1 순수 이동
(`chat-channel-input-rules.ts` 추출)에 이어, 그 이동으로 처음 드러난 사실 오류("planner 항목
등재" 미이행)를 정정하고 신규 전용 단위 테스트 12건 + 뮤테이션이 지적한 커버리지 공백(정규식
스왑·대칭 필드·조기 반환 경로)을 닫는 **테스트·문서 강화 커밋 2개**를 추가한 것이다. 런타임
요청 검증 로직·에러 응답 봉투·HTTP 상태 코드·라우트·DTO·컨트롤러는 이 3커밋 전체 구간에서
한 글자도 바뀌지 않았다(`git diff --stat` 로 DTO/컨트롤러 변경 0건, `git show` 로
`chat-channel-input-rules.ts` 소스 변경이 JSDoc 주석 6줄뿐임을 확인). 리뷰 도중 다른 병렬
reviewer 의 사전 승인된 뮤테이션-검증 절차로 보이는 일시적 working-tree 변형(정규식 스왑)을
관측했으나 내가 만든 것이 아니고, 본 판정은 커밋 이력 기준이라 영향받지 않는다. API 계약(요청
검증, 에러 응답 형식, 하위 호환성, 인증/인가, 라우팅) 관점에서 영향을 주는 변경은 없다.

## 위험도

NONE
