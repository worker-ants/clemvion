# 요구사항(Requirement) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 3, `17_02_19`)

## 점검 방법

이 라운드는 이전 두 라운드(`review/code/2026/09/12/16_17_57`, `review/code/2026/09/12/16_39_18`)가
낸 CRITICAL 1 · WARNING 6 (누계) 에 대한 조치 결과(커밋 `d8ad68b25`, `e07521a27`)를 검증하는
자리다. 프롬프트 번들이 예산 초과로 파일 2(`chat-channel-input-rules.ts`)의 diff 를 자르고
다수의 과거 리뷰 산출물을 함께 실었으므로, `git diff origin/main..HEAD -- codebase/` 로 8개
애플리케이션 파일의 diff 전문을 직접 열어 대조했고, 다음을 실측했다:

- `chat-channel-input-rules.ts` 전체 diff — 헬퍼 추출(`throwInvalidField`/`hasField`/
  `rejectBlockedField`) 전후로 11개 `throw` 지점의 `field`/`message`/`details.code`/검사 순서가
  글자 단위로 보존됨을 확인 (behavior-preserving).
- `chat-channel-rejection-messages.const.ts`·`dto/chat-channel-config.dto.ts` — stale
  `TriggersService` 귀속 주석 정정이 실제 구조(`ba634a4b0`/`77f4a88e5` 이후 module-level 함수)와
  일치함을 확인.
- `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` — `grep -n "class ChatChannel.*IdentityDto"`
  로 `chat-channel-config.dto.ts:149` 의 `ChatChannelBotIdentityDto` 와 이름이 겹치지 않음
  (`ChatChannelRotateBotIdentityDto`) 확인. `spec/conventions/swagger.md §5-1`(`dto/responses/
  *-response.dto.ts`)과 파일 자리·이름이 정확히 일치함을 직접 Read 로 확인.
- `triggers.service.ts` `rotateBotToken` 의 실제 반환 객체(`botIdentity: mergedChannel.botIdentity
  ?? null`)와 `chat-channel/types.ts:55-61` 의 `ChatChannelConfig['botIdentity']`
  (`botId`·`username`·`teamId?`·`publicKey?`)를 신규 DTO 필드와 3자 대조 — 완전히 일치.
- `spec/5-system/15-chat-channel.md` §5.4(성공/실패 응답 표)를 직접 Read — `{ rotatedAt, triggerId,
  chatChannelHealth, botIdentity }` 4필드·404 `RESOURCE_NOT_FOUND` 행이 신규 DTO/컨트롤러 데코레이터와
  정확히 일치함을 확인.
- `dto/trigger-dto-validation.spec.ts` 신규 테스트가 `CustomValidationPipe` 실제 인스턴스
  (`pipe.transform`)를 태우는 것을 확인 — mock 대체가 아니라 실제 파이프 경유라 vacuous 가 아님.
- `chat-channel-input-rules.spec.ts` 신규/변경 케이스(`null`/`''` 두-층 등가성, `update` 모드 ×
  내부 필드 3종, provider label 스왑 검출)를 Read 로 전문 대조 — 각 단언이 실제로 판별 가능한
  fixture(교차 provider 길이, 반대 vendor 라벨 부재 확인 등)로 구성됨을 확인.
- `codebase/**` 8개 파일 전체에서 `TODO|FIXME|HACK|XXX` grep — 0건.

저장소 파일은 조회만 했다(`Read`/`git diff`/`grep`). 아무것도 수정하지 않았으므로 원복 대상 없음
— `git status --short` 결과도 본 리뷰 산출물 디렉터리 외 변경 없음.

## 발견사항

없음 (CRITICAL/WARNING 없음).

## 참고 (INFO, 조치 불요 — 대조 확인 목적)

- **[INFO]** `plan/in-progress/chat-channel-rules-cleanup.md` 의 체크리스트가 실제 완료 상태를
  아직 반영하지 않는다.
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md` — `## 체크리스트` 섹션 (`- [ ] 1~4
    (프로덕션)` · `- [ ] 5 (테스트 보강)` · `- [ ] 6 (swagger)` · `- [ ] run-test-all.sh 4단계` ·
    `- [ ] /ai-review + --impl-done` · `- [ ] 트래커 항목 종결` · `- [ ] plan/complete/ 이동`)
  - 상세: 작업 #1~#6 은 diff·`RESOLUTION.md`(`review/code/2026/09/12/16_17_57`,
    `review/code/2026/09/12/16_39_18`)·짝 트래커(`spec-draft-nullable-notation-followups.md`)의
    `[x]` 처리로 실질적으로 완료되었음이 이미 실측되는데, 이 plan 문서 자신의 체크박스는 아직
    전부 미체크다. 다만 이 문서의 §정지 규칙이 "라운드가 `codebase/**` 수정 0 으로 끝나야 수렴"
    이라고 스스로 선언해 두었고, 본 라운드(`17_02_19`)가 바로 그 수렴 여부를 판정하는 자리다 —
    즉 이 체크리스트는 **수렴이 확정된 뒤 마지막에 일괄 체크 + `plan/complete/` 이동과 함께
    처리하는 설계**로 읽힌다(레포 관례상 "체크와 이동은 한 동작"). 코드 결함이 아니라 이 세션의
    다음 단계(본 리뷰가 CRITICAL/WARNING 0 으로 나오면 체크 처리 + 이동)로 자연스럽게 이어지는
    지점이라 별도 조치를 요구하지 않는다.
  - 제안: 본 라운드가 CRITICAL/WARNING 0 으로 수렴한다면, 이 응답을 근거로 체크리스트 전체를
    체크하고 `plan/complete/` 로 이동할 것 (plan 자신의 §정지 규칙이 요구하는 절차).

- **[INFO]** `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 부재, POST 바디 `@ApiBody()`
  부재 — 이전 두 라운드가 이미 지목했고(스코프 밖, PR 이전부터 존재) 트래커에 등재됨. 이번
  라운드에서도 diff 미변경 확인, 재지적 불필요.

## 요약

라운드 1(`16_17_57`)의 CRITICAL(신규 응답 DTO 클래스명 `ChatChannelBotIdentityDto` 충돌)과
WARNING(문서가 실응답보다 좁음/`@ApiUnauthorizedResponse` 누락/서비스 층 `null`·`''` 미검증),
라운드 2(`16_39_18`)의 WARNING(응답 DTO 배치가 `swagger.md §5-1` 관례 위반/plan 뮤테이션 개수
불일치/orphan JSDoc) 모두 코드·plan 문서를 직접 열어 필드 단위·문구 단위로 재검증한 결과 실제로
해소되어 있다. 최종 diff(8개 애플리케이션 파일, `+322/-104`)는 (1) `chat-channel-input-rules.ts`
의 11개 에러 봉투 생성 지점을 `throwInvalidField`/`hasField`/`rejectBlockedField` 세 헬퍼로 옮기는
동작 보존 리팩터, (2) stale `TriggersService` 귀속 주석 3곳 정정, (3) `rotateBotToken` 의 응답
swagger 문서화(신규 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`, 404/200
데코레이터, 컨트롤러 반환 타입의 DTO 화)로 구성된다. spec(`spec/5-system/15-chat-channel.md`
§5.4·§5.4.1·§5.4.1.2, R-CC-21)과 line-level 로 대조한 결과 함수 시그니처·에러 코드·`details.field`·
응답 필드·상태 코드 어디에도 불일치가 없다. `incoming.provider &&` falsy-guard 를 "도달 불가"로
선언한 판단은 `ChatChannelUpdateConfigDto` 가 `OmitType` 으로 `provider` 의 `@IsIn` 을 상속한다는
사실을 직접 코드로 확인해 타당함을 재확인했고, 그 근거를 뒷받침하는 DTO 계층 테스트도 실제
`CustomValidationPipe` 를 태워 vacuous 하지 않다. TODO/FIXME/HACK/XXX 없음. 유일하게 남는 관찰은
plan 문서 자신의 체크리스트가 아직 완료 표시 전이라는 점인데, 이는 이 세션이 스스로 선언한
"수렴 판정 후 일괄 체크 + `plan/complete/` 이동" 절차의 자연스러운 중간 상태로 판단되어 별도
결함으로 등재하지 않는다. Critical/Warning 없이 수렴 가능한 상태로 판단한다.

## 위험도

NONE
