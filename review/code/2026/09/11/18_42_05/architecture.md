# 아키텍처 리뷰 — `impl-chat-channel-binder-t2` (2라운드, W1/W2 후속 조치 검증)

## 범위

이번 라운드의 diff 는 1라운드(`review/code/2026/09/11/18_04_36`) WARNING 1(콜백 URL 인자 순서)·
WARNING 2(`teardownChatChannel` adapter 경로 미실행)를 닫기 위한 후속 커밋
(`92f4b0607`)과, 1라운드 산출물 자체(`RESOLUTION.md`·`SUMMARY.md`·14개 관점 리포트·
`meta.json` 등)를 저장소에 커밋하는 변경, 그리고 plan 문서 갱신으로 구성된다. 실제 코드
변경은 두 파일에 집중된다.

1. `trigger-callback-url.ts` — `buildTriggerCallbackUrl(baseUrl, endpointPath)` 위치 인자를
   `{ baseUrl, endpointPath }` 이름 인자 객체로 전환. 두 호출부
   (`chat-channel-binder.service.ts` `setupChatChannel`, `triggers.service.ts`
   `rotateBotToken`)도 함께 갱신됐다.
2. `chat-channel-binder.service.spec.ts` (신규) — `teardownChatChannel` 전용 단위 테스트 4건.

`ChatChannelBinderService` 본체(`chat-channel-binder.service.ts`)·`triggers.service.ts`·
`triggers.module.ts` 자체의 구조는 1라운드에서 검증된 Extract-Class 리팩터링 그대로이며 이번
라운드에서 재변경되지 않았다(원본을 `Read`/`git diff 71feabeea HEAD`로 직접 대조해 1:1 이동임을
재확인 — `ChatChannelModule`이 `Trigger` 엔티티 타입만 참조하고 `TriggersModule`을 import 하지
않아 `#676`이 제거한 `chat-channel↔triggers` 순환도 재발하지 않았다).

## 검증한 것

- **인자 순서 결함의 처방 방식**: 1라운드 reviewer 는 "호출부에 두 번째 인자 단언 테스트를
  추가하라"고 제안했으나, 실제 처방은 **시그니처를 이름 인자 객체로 바꿔 순서 개념 자체를
  없앴다**(`trigger-callback-url.ts:48-56`). 이는 "테스트로 계속 지킨다" 대신 "애초에 위반이
  불가능한 형태로 만든다"는 더 강한 설계 원칙(파라미터 오브젝트 패턴)이며, `tsc`가 두 인자
  타입이 우연히 다를 때만 스왑을 잡던 취약한 방어(JSDoc 33-43행이 스스로 이 우연성을 지목)를
  구조적으로 제거한다. 이 저장소의 다른 2-인자 이상 헬퍼들과 비교해도 인자 성격이 서로
  구분되지 않는(둘 다 `string` 계열) 함수에 한정된 국소적 선택이라 과잉설계가 아니다.
- **teardown 경로 테스트 격리**: `chat-channel-binder.service.spec.ts`는 `Test.createTestingModule`
  없이 `new ChatChannelBinderService(...)`로 직접 생성자 주입한다(같은 폴더
  `chat-channel-token-rotator.service.spec.ts` 관례 재사용, 파일 헤더 17행이 근거를 명시). 이는
  1라운드 architecture.md INFO 3번째 항목("클래스 경계가 실재하는데도 테스트 격리에 활용하지
  않는다")이 지적한 것과 정확히 반대 방향의 조치다 — `TriggersService`를 통째로 부트스트랩하지
  않고 `ChatChannelBinderService`만 단독으로 검증해, Extract-Class 리팩터링이 만든 클래스 경계를
  테스트 설계에도 실제로 활용한 사례다. `setupChatChannel`은 여기서 다시 다루지 않는다는 결정도
  헤더에 근거(뮤테이션 3종 RED 실측)와 함께 명시돼 있어 "같은 사실을 두 곳에서 단언해 정본이
  갈리는" 중복을 피했다.
- **모듈 경계 재확인**: `triggers.module.ts`에서 `ChatChannelBinderService`는 여전히
  `providers`에만 있고 `exports`에는 없다(`triggers.module.ts:47-54`). 컨트롤러는 이 클래스를
  참조하지 않아 `Controller → TriggersService → ChatChannelBinderService` 단방향 레이어 순서가
  유지된다.

## 발견사항

- **[INFO]** 파라미터 오브젝트 전환이 `trigger-callback-url.ts` 한 함수에만 적용돼, 같은
  디렉터리의 자매 모듈(`chat-channel-input-rules.ts`)과 인자 전달 스타일이 갈린다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts` 함수 시그니처
    (`export function buildTriggerCallbackUrl({ baseUrl, endpointPath }: {...})`)
  - 상세: `chat-channel-input-rules.ts`의 `assertChatChannelInputSafe`/`stripChatChannelPlaintext`
    등은 여전히 위치 인자를 쓴다(단, 그쪽은 인자가 1~2개이고 타입이 서로 뚜렷이 달라 스왑
    위험이 낮다는 점에서 근거가 다르다는 것은 JSDoc이 스스로 밝히고 있다). 지금은 국소적이고
    정당화된 비대칭이지만, "이 폴더의 헬퍼 함수는 이름 인자를 쓴다"는 암묵적 관례로 오인되면
    다음 함수 작성 시 임의로 갈릴 수 있는 자리다.
  - 제안: 조치 불요 — 이미 JSDoc(33-43행)에 "왜 이 함수만"이라는 근거가 있어 다음 사람이
    맥락 없이 따라 하지 않도록 방어돼 있다. 관례로 굳히려면 향후 2개 이상 유사 유틸이 생길 때
    코딩 컨벤션 문서화를 고려.

- **[INFO]** 1라운드 리뷰 산출물(`RESOLUTION.md`·14개 관점 `.md`·`meta.json`·`_retry_state.json`)
  을 `review/code/2026/09/11/18_04_36/`에 그대로 커밋해, 코드 변경과 프로세스 산출물이 같은
  커밋/PR 스코프에 함께 들어간다.
  - 위치: `review/code/2026/09/11/18_04_36/*` (파일 11~22)
  - 상세: `CLAUDE.md`의 정보 저장 위치 표에 따르면 코드 리뷰 산출물은 `review/code/**`에
    보관하는 것이 정책이므로 저장 위치 자체는 맞다. 다만 이 디렉터리를 커밋함으로써 이번
    아키텍처 리뷰(2라운드)의 diff 안에 "1라운드 아키텍처 리뷰 자기 자신의 산출물"이 포함돼,
    리뷰 대상과 리뷰 이력이 같은 diff 에 뒤섞인다. 이는 결함이 아니라 이 저장소의 정착된
    관행(`feedback_review_fix_stale_loop.md`가 이미 "review/ 는 SoT 아님"·"리뷰 산출물 커밋"
    패턴을 다룸)과 일치하지만, 향후 리뷰어가 "이 diff 가 코드 변경인지 프로세스 기록인지"를
    구분할 때 파일 경로 프리픽스(`review/`)로 걸러야 한다는 점만 기록해 둔다.
  - 제안: 조치 불요(정책 일치, 정보성 기록).

## 요약

이번 라운드는 1라운드 아키텍처 리뷰가 이미 LOW 로 판정한 순수 이동(Extract-Class) 구조에
새로운 코드 재설계를 더하지 않고, 그때 지적된 두 취약점을 각각 원리적으로 더 강한 방식으로
닫았다 — 인자 순서 결함은 테스트를 얹는 대신 시그니처를 파라미터 오브젝트로 바꿔 위반
자체를 불가능한 형태로 만들었고, teardown 경로는 신규 전용 스펙 파일을 `new`로 직접 주입해
1라운드가 지적한 "클래스 경계가 있는데 테스트 격리에 못 쓴다"는 관찰을 실제로 해소하는
방향으로 움직였다. 모듈 exports·순환 의존·레이어 순서는 1라운드 이후 변경되지 않았고 직접
재확인한 결과도 동일하다. 새로 발견된 사항은 모두 INFO 수준이며 이번 PR을 막을 사유가 아니다.

## 위험도

NONE
