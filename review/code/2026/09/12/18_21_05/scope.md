# 변경 범위(Scope) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (7회차 종합)

## 검증 방법

`git diff origin/main..HEAD -- codebase/ plan/` 로 실제 코드/plan 변경분만 추출해 16개 파일
전체를 직접 열람했다(프롬프트 번들은 예산 제한으로 diff 일부를 생략했으므로 원본을 대조).
나머지 `review/**` 신규 파일 26개는 이전 6개 라운드(`16_17_57` ~ `17_52_34`)의 리뷰·해소 산출물
및 `--impl-prep`/`--impl-done` 의 consistency-check 산출물로, 프로세스가 의무화한 표준 산출물이다
— 저장소를 수정하지 않았으므로 뮤테이션 원복 대상도 없다(`git status --short` 조회만).

`plan/complete/chat-channel-rules-cleanup.md`(신규)의 "왜 이 턴인가"·"작업" 표와 diff 를 1:1
대조했다.

## 발견사항

- **[INFO]** `repo-guards/__tests__/dto-class-name-collision{,-guard}.ts` + fixtures 3개(파일
  10~14)는 plan 의 원 작업표(#1~#6)에 없던 항목이다.
  - 위치: `plan/complete/chat-channel-rules-cleanup.md` 체크리스트 — "**7. `repo-guards` DTO
    클래스명 충돌 가드** — 작업표에 없던 항목" 으로 스스로 표기.
  - 상세: 이 가드는 이 PR **자신이** 라운드 1(`16_17_57`)에서 낸 CRITICAL(동명 클래스
    `ChatChannelBotIdentityDto` 충돌로 `@nestjs/swagger` 스키마 상호 덮어쓰기)의 재발 방지책으로,
    라운드 3(`17_02_19`) 리뷰가 "1회성 grep 스크립트로만 해소 확인한 것은 불충분" 이라고 요구해
    추가됐다. 원 계획엔 없었지만 (a) 이 PR 이 스스로 만든 결함의 재발 방지이지 무관한 기능
    추가가 아니고, (b) plan 체크리스트에 별도 번호(7)로 명시돼 은폐 없이 투명하게 기록됐으며,
    (c) 스캔 범위를 `modules/`·`common/` 두 디렉터리로 실측 제한하고 fixture 를 별도 디렉터리에
    격리하는 등 최소 침습으로 구현됐다. "요청 이상의 변경" 요건에는 형식상 해당하지만, 변경
    자체의 존재와 근거가 산출물에 명시돼 있어 은폐형 스코프 확장은 아니다.
  - 제안: 조치 불요 — 이미 투명하게 기록·정당화됐다. 참고로 `swagger.md §5-1` 에 이 불변식을
    규약 프로즈로 등재하는 후속 항목이 이미 트래커(`plan/in-progress/
    spec-draft-nullable-notation-followups.md`)에 planner 축으로 별도 등재돼 있다.

- **[INFO]** 신규 응답 DTO 파일이 최초 판본(`dto/chat-channel-rotate-bot-token.dto.ts`, 평평한
  자리)에서 라운드 2(`16_39_18`) 도중 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
  로 재배치됐다 — 이는 파일 5(경로 자체)의 변경이며 스코프 내 작업 #6 의 세부 결정에 해당한다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
  - 상세: reviewer 의 권고(요약: "코드를 되돌리지 말라")와 반대 방향으로 개발자가 결정을
    뒤집었는데, `RESOLUTION.md`(`16_39_18`)에 두 자리에 대한 spec-link glob 매칭표를 실측으로
    남기고 규약(`swagger.md §5-1`) 우선 원칙을 근거로 제시했다. 결정 번복 자체가 스코프 이탈은
    아니며(같은 작업 항목 #6 내부의 배치 결정), 근거가 문서화돼 있어 조용한 변경은 아니다.
  - 제안: 조치 불요.

이상 두 건 모두 **스코프 위반이 아니라 "계획에 없었지만 근거를 남긴 확장"** 으로 판단해 INFO
로 남긴다. 아래 항목들은 명확히 스코프 내다.

## 근거 — 스코프 내 확인

- **`chat-channel-input-rules.ts`**: `git diff` 전체를 대조한 결과 `throwInvalidField`/
  `hasField`/`rejectBlockedField` 세 헬퍼 도입과 11개 호출부 치환은 기존
  `BadRequestException({code, message, details})` 블록을 글자 단위로 함수 호출로 옮긴 것뿐이다
  — `field`/`message`/조건문 순서 어디에도 로직 변경이 없다(삭제 89줄=추가 헬퍼 정의+주석
  분량과 상쇄, 순수 치환). 헤더 주석 확장(출력측 책임 명시)·falsy-guard 사유 주석 추가는 plan
  작업 #3 그대로.
- **`chat-channel-input-rules.spec.ts`**: `as never` 제거, `mode:'update'` 내부 필드 3종 케이스,
  provider label 스왑 검출(`ownLabel`/`otherVendor`), `null`/`''` 두-층 등가성 케이스 — plan 작업
  #5 (a)(b)(e) + 라운드별 리뷰가 요구한 회귀 테스트와 정확히 대응. 검증 로직 자체(제품 코드)
  변경 없음.
- **`chat-channel-rejection-messages.const.ts`· `dto/chat-channel-config.dto.ts`**: `TriggersService`
  귀속을 가리키던 stale 주석 3곳만 문면 수정(작업 #4). 타입·검증 로직 변경 없음.
- **`triggers.controller.ts`**: 신규 import 는 실제 사용되는 `ChatChannelRotateBotTokenDto`
  하나뿐이며, 추가된 데코레이터(`@ApiUnauthorizedResponse`·`@ApiNotFoundResponse`·
  `@ApiOkWrappedResponse`)와 반환 타입의 DTO 화는 모두 작업 #6(swagger 응답 문서화)의 범위
  안이다. 엔드포인트 로직(`newBotToken` 검증·서비스 호출)은 무변경.
- **`triggers.service.ts`**: `botIdentity` 필드 타입 선언 1줄만 `NonNullable<ChatChannelConfig
  ['botIdentity']>` 로 변경 — `ChatChannelConfig` 는 이미 import 돼 있던 타입이라 신규 import
  없음. 라운드 1 W1(선언이 실제 반환보다 좁음)의 직접 조치.
- **`triggers.service.spec.ts` · `dto/trigger-dto-validation.spec.ts`**: 추가된 두 `it.each` 블록
  모두 위 코드 변경(각각 `botIdentity` 부가 필드 보존, `provider` PATCH 필수 상속)을 고정하는
  회귀 테스트이며, plan 이 그 근거를 요구한 자리와 1:1 대응.
- **`plan/in-progress/spec-draft-nullable-notation-followups.md`**: 2,900줄대 공유 트래커에서
  diff 는 이 작업이 참조·완결한 항목(체크 처리 3건)과 신규 등재 6건(가드/규약 갭/frontend
  미소비/MDX 오기/`ParseUUIDPipe`/glob 갭)에 정확히 국한된다. `git diff` 로 확인한 헝크가 모두
  이 세션이 언급한 항목 주변에만 있고, 트래커의 다른 수백 개 항목은 건드리지 않았다.
- **포맷팅·임포트·설정**: drive-by 포맷팅 변경 없음(`git diff -w` 기준 실질 변경과 공백 변경이
  섞인 헝크 없음). 불필요한 import 추가/삭제 없음(신규 import는 모두 실제 사용처가 있음을
  개별 확인). 설정 파일(`tsconfig`, `package.json`, ESLint 설정 등) 변경 없음.
- **`spec/**` 변경 없음** — plan frontmatter `spec_impact: none` 과 일치, developer 권한 경계
  준수.

뮤테이션·저장소 쓰기: 이 리뷰는 저장소 파일을 수정하지 않았다. `git status --short` 로 확인.

## 요약

실제 코드/plan diff(`origin/main..HEAD` 의 `codebase/**`+`plan/**`, 16개 파일)는 plan 문서가
선언한 6개 작업 항목 및 각 라운드 리뷰가 요구한 회귀 테스트에 정확히 대응한다. 유일하게
원 작업표를 벗어난 항목은 `repo-guards` DTO 클래스명 충돌 가드(작업 #7)인데, 이는 이 PR
자신이 라운드 1에서 만든 CRITICAL 의 재발 방지책으로 plan 체크리스트에 별도 번호로 투명하게
기록됐고 스캔 범위를 최소로 좁혔다 — 은폐형 스코프 확장이 아니라 근거를 남긴 확장이다. 응답
DTO 의 최종 배치(`dto/responses/`)도 같은 작업 항목(#6) 내부의 위치 결정으로, reviewer 권고와
다른 선택을 했지만 실측 근거를 남겼다. 의도 밖 리팩토링·무관한 파일 수정·불필요한 포맷팅/
주석/임포트/설정 변경은 발견되지 않았다. `review/**` 26개 신규 파일은 이전 라운드의 리뷰·
`consistency-check` 산출물로 프로세스가 요구하는 표준 산출물이며 무관한 추가가 아니다.

## 위험도

NONE
