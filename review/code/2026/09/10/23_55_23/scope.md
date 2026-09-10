# 변경 범위(Scope) 코드 리뷰

## 발견사항

- **[INFO]** 리뷰 산출물(`review/code/2026/09/10/23_21_57/api_contract.md`)이 "컨트롤러 파일은 이번 diff 에 포함되지 않았다"고 적어 두었으나, 실제 최종 diff에는 `codebase/backend/src/modules/triggers/triggers.controller.ts` 의 `@ApiBadRequestResponse` 설명 변경이 포함돼 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:122`(`@ApiBadRequestResponse` description) / `review/code/2026/09/10/23_21_57/api_contract.md` 6번째 항목
  - 상세: `api_contract.md` 는 첫 라운드 리뷰(23:21:57) 시점의 스냅숏이라 그 시점엔 컨트롤러가 안 바뀐 게 맞았다. 이후 `RESOLUTION.md` 항목 #5 가 같은 CRITICAL/WARNING 라운드에서 컨트롤러의 `@ApiBadRequestResponse` 문구를 실제로 갱신했다(`771801fca`). 즉 산출물(문서)과 최종 코드 상태 사이에 스냅숏 시차가 남아 있다 — 코드 자체의 스코프 위반은 아니고, "리뷰-수정 워크플로가 남긴 흔적"이다. 스코프 관점에서 문제될 것은 없지만 다음 사람이 `api_contract.md` 만 보고 "컨트롤러 Swagger 는 안 고쳤다"고 오판할 수 있어 기록해 둔다.
  - 제안: 조치 불필요(정보성). 필요하면 `RESOLUTION.md` 에 "api_contract.md 의 해당 항목은 이후 커밋으로 해소됨"이라는 각주를 한 줄 추가하면 향후 혼동을 줄일 수 있다.

## 확인한 것 — 스코프 위반 없음

- `git diff --stat origin/main...HEAD` 로 전체 변경 파일을 확인한 결과, 코드 변경은 `codebase/backend/src/modules/triggers/**`(DTO·컨트롤러·서비스·spec) 와 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 로 한정돼 있고, `spec/**` 는 **전혀 손대지 않았다**. plan 문서(`plan/in-progress/impl-chat-channel-patch-token.md` "발견한 경계" 절)가 R-CC-21 산문이 telegram carve-out 을 넓게 포괄 못 한다는 것을 발견했지만, 자기-반증형 소정정 조건 1(developer 자신이 그 문장을 쓴 것)이 성립하지 않는다는 이유로 **planner 턴으로 명시 위임**했다 — 이는 스코프를 정확히 지킨 판단이다.
- `ChatChannelUpdateConfigDto` 신설(`chat-channel-config.dto.ts`)은 PATCH 전용 DTO 필요성(D-1)에 정확히 대응하고, `OmitType` 사용·`Patch` 대신 `Update` 접두 선택 근거가 JSDoc 에 남아 있다. 추가된 `OmitType` import 는 실제로 사용된다 — 미사용 import 아님.
- `trigger-dto-validation.spec.ts` 에 추가된 `CustomValidationPipe`/`ArgumentMetadata`/`BadRequestException` import 는 모두 새 `describe` 블록에서 사용된다 — 불필요한 import 아님.
- `update-trigger.dto.ts` 는 `ChatChannelConfigDto` → `ChatChannelUpdateConfigDto` 타입 교체 한 곳만 변경됐고, `create-trigger.dto.ts` 는 diff 에 전혀 등장하지 않는다 — 생성 경로 무회귀가 실제로 지켜졌다.
- `triggers.controller.ts` 변경은 `@ApiBadRequestResponse` 설명 텍스트 확장 한 곳뿐이고, 라우트·데코레이터·권한(`@Roles`) 등은 그대로다.
- `triggers.service.ts` 의 255줄 추가는 전부 이번 작업(D-1/D-2/D-3 + 리뷰가 찾은 fail-open CRITICAL 수정)에 직결된다 — `assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`, `ChatChannelInput`/`ChatChannelInputMode` 타입, `setupChatChannel` 의 `storeUserSuppliedSecrets`/`preservedInboundSigningRef` 게이팅. import 블록 중간에 끼어 있던 `type` 선언 2개(초기 리뷰 WARNING)는 최종 코드에서 import 블록 뒤로 옮겨져 있음을 직접 확인했다(현재 파일 33-70행) — 리뷰 지적이 실제로 반영된 것이지 남아 있는 위반이 아니다.
- `triggers.service.spec.ts` 의 대량 diff(576줄)는 대부분 기존 `service.update()` 호출을 `service.create()`(`createWithChannel` 헬퍼)로 재조준한 것과 신규 PATCH 전용 `describe` suite 추가다. DTO 계약이 바뀌어(PATCH 가 `botToken` 을 더 이상 안 받음) 기존 테스트가 성립할 수 없게 된 것에 대한 필연적 재작성이며, 임의의 리팩토링이 아니다.
- `trigger-workflow-ref.e2e-spec.ts` 변경은 캐너리 바디에서 `botToken` 을 제거하고 그 배경을 설명하는 주석 블록을 교체한 것뿐 — 이 캐너리가 원래 지키던 축(`workflow` 관계 유무)은 그대로 유지된다.
- `plan/in-progress/impl-chat-channel-patch-token.md`, `review/code/2026/09/10/23_21_57/**`, `review/consistency/2026/09/10/{21_37_56,22_45_26}/**` 는 이 프로젝트의 SDD+TDD 워크플로(CLAUDE.md `## 개발 방법론`, developer SKILL §REVIEW WORKFLOW)가 강제하는 산출물이며, 임의로 끼워 넣은 무관한 파일이 아니다.
- 포맷팅 관점: `triggers.service.ts` import 블록 뒤에 빈 줄 하나가 추가된 것 외에는 diff 전체에 의미 없는 공백/줄바꿈 변경이 섞여 있지 않다. 그 빈 줄도 새로 추가된 `type` 선언 블록과 기존 import 를 시각적으로 분리하려는 의도적 변경으로, 실질 변경과 뒤섞인 무의미한 리포맷이 아니다.
- `git status --short` 로 확인한 결과 이번 리뷰 세션이 만든 두 산출물 디렉터리(`review/code/2026/09/10/23_55_23/`, `review/consistency/2026/09/10/23_54_09/`) 외에 저장소에 잔여 mutation 이나 `.bak` 파일은 없다.

## 요약

전체 diff(코드 7파일 + plan/review 산출물)는 plan 문서(`impl-chat-channel-patch-token.md`)와 `RESOLUTION.md` 가 명시한 작업 범위 — PATCH 전용 `ChatChannelUpdateConfigDto` 도입(D-1), `setupChatChannel` 의 사용자-비밀 쓰기 게이팅(D-2), ref 재유도 회귀 고정(D-3), 그리고 그 구현 리뷰 과정에서 발견된 `inboundSigningRef` fail-open CRITICAL 의 즉시 수정 — 을 정확히 벗어나지 않는다. `spec/**` 는 전혀 건드리지 않았고, R-CC-21 산문의 더 넓은 문제는 자기-반증형 소정정 조건 불충족을 근거로 planner 턴에 명시적으로 위임했다. 테스트 파일의 대규모 변경은 DTO 계약 변경에 따른 필연적 재조준이며, import·주석·포맷팅 변경도 모두 실질 변경에 직결된다. 유일하게 기록할 만한 것은 리뷰 산출물(`api_contract.md`)이 이전 라운드 스냅숏이라 이후 커밋의 컨트롤러 수정을 반영하지 못한 점인데, 이는 코드 스코프 위반이 아니라 리뷰 워크플로의 시차일 뿐이다.

## 위험도

NONE
