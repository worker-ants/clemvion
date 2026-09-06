# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `ExportWorkflowDto` 를 `WorkflowDto` 와 별도 `import` 문으로 추가해, 같은 모듈에서
  오는 두 심볼의 import 가 두 줄로 나뉜다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` 13~14번째 줄 (`import { ExportWorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';` 바로 아래 `import { WorkflowDto } from '...';`)
  - 상세: 기능상 문제는 없고 계약 배선 자체와 무관한 스타일 수준의 잔여물이다. `review/code/2026/09/05/18_23_02/scope.md` 에서 이미 같은 항목이 INFO 로 지적됐고 "조치 불요" 로 처분됐는데, 이후 라운드에서도 병합되지 않고 그대로 남아 있다.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합 가능하나 매우 사소해 PR 을 막을 사유는 아니다.

- **[INFO]** 보안 결함 수정(트리거 회전 secret 유출, 2경로)과 응답-계약 배선 스윕(§5.4, 18개 DTO), 그리고 선언 지연 23필드 보정이 한 PR 에 섞여 있다.
  - 위치: `CHANGELOG.md` (Unreleased 섹션 전체), `codebase/backend/src/modules/triggers/triggers.service.ts` (`sanitizeForResponse` 관련 전체 hunk), `codebase/backend/src/modules/schedules/schedules.controller.ts` (`toResponse` 신설)
  - 상세: 범위 위반은 아니라고 판단한다 — CHANGELOG·`plan/in-progress/spec-draft-nullable-notation-followups.md` 서술이 일관되게 "§5.4 스윕을 넓히는 도중 실측으로 드러난" 결함이라고 명시하며, 발견 즉시 고치지 않으면 방금 넓힌 검증자 자신이 그 결함을 놓친 채로 남는다는 논리도 합당하다. `git diff origin/main..HEAD` 로 실제 코드 diff(34개 파일, +1909/-62)를 직접 대조한 결과 스코프 밖 파일·의도치 않은 리팩토링·무관한 설정 변경은 발견되지 않았다. 다만 "이 커밋이 보안 픽스다"라는 사실이 24개 필드 선언·200여 개 review 산출물 파일에 가려질 수 있다는 점은 리뷰어가 인지해 둘 만하다.
  - 제안: 조치 불요. 참고용 관찰.

- **[INFO]** `TriggerDto.chatChannelHealth`/`notificationHealth` 등 7필드, `IntegrationDto.consecutiveNetworkFailures` 등은 "이미 응답에 실려 나가고 있었다"는 근거로 선언에 포함됐다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
  - 상세: PR 자신의 주석과 CHANGELOG·plan 트래커가 "선언이 현실에 뒤처져 있던 필드를 실제에 맞춘다(wire 불변)"는 원칙을 명시적으로 반복하고, `consecutiveNetworkFailures` 처럼 FE 미소비·제거 후보인 필드는 제거하지 않고 별도 백로그 항목(`plan/in-progress/...`)으로만 등재했다. 스코프 판단이 산출물 자체에 남아 있어 은닉된 기능 확장이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/**`·`review/consistency/**` 아래 약 218개 파일(과거 12개 회차의 RESOLUTION/SUMMARY/개별 reviewer 산출물)이 이번 diff 에 포함되어 있다.
  - 위치: `review/code/2026/09/05/*` ~ `review/consistency/2026/09/06/00_48_52/*` 전체
  - 상세: 실제 코드 변경(34개 파일)에 비해 압도적으로 많은 파일 수이지만, 이는 프로젝트 컨벤션(`review/` 는 gitignore 대상이 아니며 각 리뷰 라운드 산출물이 브랜치와 함께 커밋됨, CLAUDE.md "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무")에 부합하는 정상적인 반복 수정 이력이지 스코프 이탈이 아니다.
  - 제안: 조치 불요.

## 요약

`sweep-response-contract` 워크트리 이름 그대로, 응답-계약 검증자(§5.4)의 런타임 배선을 4→18개 DTO 로 넓히는 단일 작업이 실제 코드 diff(`origin/main..HEAD`, 34개 파일, +1909/-62)의 전부다. `git diff` 로 직접 대조한 결과, 14개 e2e spec 의 `assertMatchesContract`/`contractForDto` 배선, `response-contract.ts` 의 `allowMissing` 옵션·메모이제이션, `schedule-trigger-ref.ts`/`optional-nullable.fixture.ts` 신설, 관련 unit 3건이 그 배선 자체이고, 스윕 도중 실측으로 드러난 트리거 회전 secret 2경로 유출(`triggers.service.ts` `sanitizeForResponse`, `schedules.controller.ts` `toResponse`)에 대한 보안 수정과 5개 DTO 24개 필드의 선언 보정(wire 불변)이 그 발견에 곧바로 뒤따른다. `swagger-dto-contract-guard.ts` 의 required/nullable 금지-조합 3번째 축 추가도 같은 스윕이 자기 반증한 결함(§5.4 금지 조합을 17필드에서 넓힘)을 막는 래칫이라 스코프 내다. 나머지 218개 변경 파일은 전부 이전 리뷰 라운드들의 `review/code`·`review/consistency` 산출물이며 프로젝트 컨벤션상 정상적으로 누적 커밋된 이력이다. 드러난 흠은 `workflow-crud.e2e-spec.ts` 의 사소한 import 미병합(이전 라운드에서 이미 INFO 처분) 정도이며, 의도 밖 리팩토링·무관한 파일 수정·불필요한 기능 확장·포맷팅 혼입은 관측되지 않았다.

## 위험도
NONE
