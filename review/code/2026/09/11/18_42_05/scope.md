# 변경 범위(Scope) 리뷰 — impl-chat-channel-binder-t2 (2라운드, `18_42_05`)

## 검증 방법

`git log origin/main..HEAD` 로 3커밋(`a2e5b7e16` T2 이동, `7e9aaa736` plan 후속 등재,
`92f4b0607` 이번 라운드 리뷰 수정) 구성을 확인하고, `git diff origin/main --stat` 을 프롬프트의
36개 파일 목록과 전수 대조했다(완전 일치, 추가/누락 없음). 앞의 두 커밋은 직전 라운드
(`review/code/2026/09/11/18_04_36/scope.md`)가 이미 라인 단위로 검증해 위험도 NONE 을 냈으므로,
이번 라운드는 **그 뒤에 새로 얹힌 `92f4b0607` 델타**에 집중해 `git show 92f4b0607 --stat` 및
파일별 `git show` 로 실제 코드 변경분을 직접 대조했다. `git status --short` 로 세션 시작 시점
잔여 뮤테이션이 없음을 확인했다(이번 리뷰어는 저장소에 아무것도 쓰지 않았다 — 정적 대조만 수행).

## 발견사항

- **[INFO]** 이번 커밋(`92f4b0607`)이 건드리는 36개 파일 중 25개가 `review/code/2026/09/11/18_04_36/**`
  ·`review/consistency/2026/09/11/17_39_32/**` 산출물이고, 실제 애플리케이션 코드 변경은
  3개 파일(`chat-channel-binder.service.ts`·`trigger-callback-url.ts`·`triggers.service.ts`)
  각 수 줄뿐이다.
  - 위치: `git show 92f4b0607 --stat` 전체 파일 목록.
  - 상세: CLAUDE.md 표가 "코드 리뷰 산출물 → `review/code/<...>/`" 를 명시하므로 이 커밋에
    리뷰 산출물이 실려 있는 것 자체는 스코프 이탈이 아니다(정상 경로). 다만 실질 코드 변경
    대비 문서/산출물 비율이 매우 높아, diff 크기만 보고 "과도한 변경"으로 오판하기 쉬운 자리라
    다음 리뷰어를 위해 기록한다. 결함은 아니다.
  - 제안: 조치 불요.

- **[INFO]** `trigger-callback-url.ts` JSDoc 안의 기존 수치 서술("9개 모듈")이 "14블록"으로
  정정됐다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:29` (`git show 92f4b0607`
    diff 상 `-` 줄 "9개 모듈" → `+` 줄 "14블록").
  - 상세: 이번 커밋의 주 목적(인자를 이름 기반으로 바꿔 순서 실수를 형태로 제거)과 직접
    관련된 파일을 편집하는 김에 이미 부정확했던 카운트를 정정한 것으로, 별도 관심사를 끌어들인
    것이 아니라 **같은 문단·같은 화제(왜 통합을 보류했는가)** 안에서의 정정이다. 범위 이탈로
    보지 않는다.
  - 제안: 조치 불요.

## 항목별 점검 결과 (이번 델타 `92f4b0607` 기준)

1. **의도 이상의 변경**: 없음. 커밋 메시지가 예고한 정확히 두 가지(W1: `buildTriggerCallbackUrl`
   시그니처를 위치 인자 → 이름 인자로 변경 + 신규 `trigger-callback-url.spec.ts` 7케이스, W2:
   `teardownChatChannel` adapter 경로를 겨냥한 `chat-channel-binder.service.spec.ts` 4케이스
   신설)만 코드에 반영됐다. `chat-channel-binder.service.ts`/`triggers.service.ts` 의 실제 diff는
   호출부 2곳을 위치 인자에서 named 객체 리터럴로 바꾼 것뿐이고(`git show 92f4b0607` 로 직접
   대조), 그 외 로직·조건·에러 처리는 한 글자도 바뀌지 않았다.
2. **불필요한 리팩토링**: 없음. 시그니처를 named-args 로 바꾼 것은 리뷰 W1 이 지적한 "인자
   스왑 뮤턴트가 타입 시스템의 우연한 보호에만 기대고 있다"는 근거에 대한 **직접 대응**이며,
   플랜(`impl-chat-channel-binder-t2.md` 체크리스트)에도 그렇게 기록돼 있다. 범위 밖 정리는
   없다.
3. **기능 확장**: 없음. 신규 분기·신규 필드·신규 엔드포인트 없음 — 함수 시그니처 형태만
   바뀌었고 두 호출부 모두 동일한 인자 값을 넘긴다(`git show` 대조: `baseUrl`/`endpointPath`
   값 불변).
4. **무관한 수정**: 없음. 애플리케이션 코드 변경은 `codebase/backend/src/modules/triggers/`
   3개 파일에 한정되고, `chat-channel/`·`secret-store/` 등 다른 모듈은 미변경.
5. **포맷팅 변경**: 없음. `git diff origin/main` 에서 순수 공백/빈 줄만 바뀐 라인은 25건인데
   전부 신규 파일(`chat-channel-binder.service.ts`, 이동으로 생긴 292줄 파일) 내부 구조상의
   빈 줄이거나 삭제된 원본 블록(`triggers.service.ts` 258줄 삭제분) 안의 빈 줄이며, 별도의
   drive-by 재포맷 흔적은 없다.
6. **주석 변경**: `trigger-callback-url.ts` JSDoc 에 "인자를 이름으로 받는 이유" 단락이
   추가됐다 — 시그니처 변경과 1:1로 대응하는 필요한 주석이며 무관한 주석 첨삭이 아니다. 위
   INFO 항목(수치 정정)도 같은 문단 내 정정.
7. **임포트 변경**: 신규/삭제 없음. 두 호출부 모두 기존 `buildTriggerCallbackUrl` import 를
   그대로 쓰고 호출 인자 형태만 바뀌었다.
8. **설정 변경**: 없음. `.env`/`tsconfig`/CI 워크플로/`package.json` 변경 없음(이번 델타에
   포함된 파일 목록에 해당 경로 없음).

plan 파일 2건(`impl-chat-channel-binder-t2.md`, `spec-draft-nullable-notation-followups.md`)의
변경은 이번 라운드에 실제로 한 조치(체크리스트 갱신·신규 백로그 항목 등재)를 정확히 반영하며,
새 결정이나 범위 확장을 끌어들이지 않는다 — `spec-draft-nullable-notation-followups.md` 에 추가된
"구조 정리 4건" 항목도 이번 diff 가 실제로 관측·이관한 INFO 를 트래커에 옮긴 것뿐(코드 자체는
그 4건을 손대지 않음).

## 요약

이번 라운드(`92f4b0607`)는 직전 `/ai-review`(`18_04_36`)가 낸 WARNING 2건(콜백 URL 인자 순서
방어의 우연성, `teardownChatChannel` adapter 경로 미검증)만을 정확히 겨냥한 최소 변경이다.
실제 애플리케이션 코드 diff 는 시그니처를 named-args 로 바꾼 것과 그에 따른 호출부 2곳 갱신뿐이고,
로직·조건·에러 처리·DI 배선은 전혀 바뀌지 않았다. 신규 테스트 파일 2개는 커밋이 예고한 정확히
그 갭(콜백 URL 조립 규칙, teardown adapter 호출+best-effort catch)만을 단언한다. 커밋에 실린
25개 리뷰 산출물 파일은 프로젝트 규약상 정상 경로(`review/code/**`, `review/consistency/**`)에
쓰인 프로세스 증적이라 스코프 이탈이 아니다. 앞선 두 커밋(T2 이동 자체)은 직전 라운드 scope
리뷰가 이미 라인 단위로 NONE 판정했고, 이번 라운드가 재검토한 결과도 그 판정과 상충하지 않는다.
범위를 벗어나는 리팩토링·기능 확장·무관한 수정·포맷팅 노이즈·불필요한 주석/임포트/설정 변경 중
어느 것도 발견되지 않았다.

## 위험도

NONE
