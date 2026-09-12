# 변경 범위(Scope) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 6 누적 diff)

## 발견사항

없음.

## 근거 (검증 절차)

`origin/main`(`c9bc5dca6`) 대비 `HEAD`(`f978f8d77`)의 전체 diff(90개 변경 파일, 그중 실제
애플리케이션/테스트 코드 14개 — `codebase/**`)를 `plan/in-progress/chat-channel-rules-cleanup.md`
의 작업표 6항목 + 각 라운드 `RESOLUTION.md`가 선언한 조치와 1:1 대조했다.

- **`chat-channel-input-rules.ts`**(`git diff origin/main...HEAD` 전문 확인): `throwInvalidField`
  · `hasField` · `rejectBlockedField` 헬퍼 도입과 11개 호출부 치환(작업 #1·#2), 헤더 주석에
  출력측 책임·falsy-guard 사유 추가(작업 #3) 외의 로직 변경 없음. 응답 봉투 형태(`code`·
  `message`·`details.field`·`details.code`)는 전 호출부에서 그대로 보존된다.
- **`chat-channel-input-rules.spec.ts`**: `as never` 제거, `mode:'update'` 내부 필드 3종 조합,
  provider label 스왑 검출, `null`/`''` 두-층 등가성 케이스 — 작업 #5 및 plan §설계 판단 (3)이
  요구한 테스트와 정확히 대응.
- **`chat-channel-rejection-messages.const.ts`** · **`dto/chat-channel-config.dto.ts`**: stale
  `TriggersService` 귀속 주석 3곳을 `chat-channel-input-rules` 로 정정한 문면 수정뿐(작업 #4).
  실 코드·타입·검증 로직 변경 없음.
- **`triggers.controller.ts`**: `@ApiUnauthorizedResponse`·`@ApiNotFoundResponse`·
  `@ApiOkWrappedResponse` 추가와 반환 타입을 `Awaited<ReturnType<...>>` → 신규 DTO 로 교체(작업
  #6). 추가된 import 는 실제 사용되는 `ChatChannelRotateBotTokenDto` 하나뿐.
- **`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`**(신규): `rotateBotToken` 이
  실제로 돌려주는 형태(`triggers.service.ts:991-997`)를 필드 단위로 그대로 미러링 — 새 기능이
  아니라 기존 런타임 응답의 swagger 문서화다. 커밋 이력(`d8ad68b25`→`e07521a27`)을 보면 처음
  평평한 `dto/`에 뒀다가 `swagger.md §5-1` 규약 위반 지적(라운드 2 WARNING)을 받고
  `dto/responses/`로 옮긴 것 — 이 이동도 지적에 대한 직접 대응이지 별도 스코프 확장이 아니다.
- **`triggers.service.ts`**: `botIdentity` 반환 타입 선언을 손으로 다시 적던 것에서
  `NonNullable<ChatChannelConfig['botIdentity']>` 참조로 교체 — 라운드 1 WARNING(`publicKey`
  누락으로 선언이 실제보다 좁았음)에 대한 직접 수정.
- **`triggers.service.spec.ts`** · **`dto/trigger-dto-validation.spec.ts`**: 각각 라운드 5
  WARNING(부가 identity 필드 회귀 테스트 부재)과 작업 #5/설계 판단(3)이 요구한 "DTO 층 provider
  필수 고정" 테스트 — 둘 다 대응하는 지적/작업 항목이 명확하다.
- **`repo-guards/__tests__/dto-class-name-collision{-guard,.spec}.ts` + fixtures 3개**(신규):
  라운드 1에서 이 PR 자신이 낸 CRITICAL(swagger DTO 클래스명 충돌)의 재발 방지 가드다
  (`review/code/2026/09/12/17_02_19/RESOLUTION.md` W1). 이 저장소가 이미 채택한 "세 번째 재발이면
  코드로 고정" 규율의 적용이고, 기존 형제 가드(`dto-jsdoc-citation-guard.ts` 등)와 파일명 패턴
  (`*-guard.ts` + `*.spec.ts` + `fixtures/`)이 동일해 신규 관례를 만들지 않았다. 스캔 대상도
  `*.dto.ts` 클래스명 충돌 하나로 좁게 유지되어 기능 확장(over-engineering)으로 보기 어렵다.
- **`plan/in-progress/chat-channel-rules-cleanup.md`**(신규) · **`spec-draft-nullable-notation-followups.md`**
  편집: 트래커 항목 체크 처리(작업 완료분) + 신규 후속 항목 등재(rotate-bot-token 404 문서
  오기, `ParseUUIDPipe` 부재, glob 이 `dto/responses/`를 못 잡는 문제 등)만 하고 그 자체를
  구현하지 않았다 — 권한 밖(planner 축) 변경을 시도하지 않았다는 증거.
- **`review/code/2026/09/12/{16_17_57,16_39_18,17_02_19,17_23_34,17_39_51}/**`,
  **`review/consistency/2026/09/12/15_53_35/**`**: 각 라운드 `/ai-review` 및 착수 전 의무
  `/consistency-check --impl-prep` 산출물이다. CLAUDE.md·plan §정지 규칙이 요구하는 표준 프로세스
  산출물이며 무관한 추가가 아니다. 각 라운드 `RESOLUTION.md`를 열어 그 라운드가 지적한 항목과
  다음 라운드/커밋(`d8ad68b25`·`e07521a27`·`3c9f4dd12`·`01f03524c`·`f978f8d77`)의 diff 가 정확히
  대응함을 커밋 메시지·diff 양쪽으로 확인했다(예: `01f03524c`는 `17_23_34` WARNING이 지적한 "bare
  인용 5곳"만 고쳤고 diff 도 정확히 그 5곳 + 리뷰 산출물뿐).
- `spec/**` 변경 없음 — plan frontmatter `spec_impact: none`과 일치.
- 포맷팅·불필요 임포트·설정 파일에 대한 drive-by 변경 없음. `git diff --stat`로 전체 90개 파일
  경로를 열거해 `codebase/backend/src/modules/triggers/**`·`codebase/backend/src/repo-guards/**`·
  `plan/in-progress/**`·`review/{code,consistency}/**` 네 범주 밖의 파일이 없음을 확인했다.

뮤테이션·저장소 쓰기: 이 리뷰는 저장소 파일을 수정하지 않았다(`git status --short`로 조회만
수행 — 결과는 이 리뷰 세션 자신의 출력 디렉터리 `review/code/2026/09/12/17_52_34/`만 untracked로
표시됨, 다른 잔여물 없음). 원복 불필요.

## 요약

이번 라운드까지 누적된 diff(6개 커밋)를 plan 작업표 및 각 라운드 `RESOLUTION.md`와 전수
대조한 결과, 모든 코드 변경이 원래 6개 작업 항목 또는 그 항목들에 대한 이후 라운드의
CRITICAL/WARNING 지적에 정확히 대응한다. 신규로 늘어난 것처럼 보이는 항목(응답 DTO 파일,
DTO 클래스명 충돌 가드, 추가 테스트 케이스)은 전부 리뷰가 발견한 이 PR 자신의 결함에 대한
동일 턴 수정 의무(CLAUDE.md "구현 완료 후 자동 review/fix는 상시 승인된 강제 의무")의 산물이지,
의도 밖 리팩토링·기능 확장·무관한 파일 수정이 아니다. 포맷팅·주석·임포트·설정 변경도 각각
근거가 명확한 실질 변경(stale 귀속 정정, 실제 사용 import, swagger 데코레이터)뿐이며 드라이브바이
정리는 발견되지 않았다.

## 위험도

NONE
