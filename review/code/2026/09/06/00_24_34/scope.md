# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `ExportWorkflowDto` 를 별도 `import` 문으로 추가해, 같은 모듈에서 온 `WorkflowDto` 와
  import 가 두 줄로 나뉜 상태가 이번 라운드까지도(총 7라운드 이상) 그대로 남아 있다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14`
  - 상세: `import { ExportWorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';`
    가 바로 아래 `import { WorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';`
    와 완전히 같은 경로를 가리키는데도 합쳐지지 않았다. `review/code/2026/09/05/18_23_02/scope.md`
    에서 처음 지적된 뒤 `19_08_18`·`20_45_37`·`21_40_37`·`22_24_58`·`22_48_39`·`00_00_23` 라운드를
    거치는 동안에도 이 두 줄만은 그대로다 — 매 라운드 더 큰 WARNING 에 밀려 방치된 것으로 보인다.
    기능상 문제는 없는 스타일 수준의 흠이다.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합. 여러 라운드째 재발하는
    사소한 잔여물이라는 점만 기록해 두며, 이번 PR 을 막을 사유는 아니다.

- **[INFO]** 이 브랜치(`9a9c024a6..HEAD`, 6개 커밋)는 실제 코드 변경(`codebase/**`+`CHANGELOG.md`+
  `plan/**`, 33개 파일·1,762줄 추가)보다 훨씬 큰 `review/**` 산출물(175개 파일·약 15,600줄)을
  함께 커밋하고 있다.
  - 위치: `review/code/2026/09/05/**`, `review/code/2026/09/06/00_00_23/**`,
    `review/consistency/2026/09/05/**`, `review/consistency/2026/09/06/00_01_16/**`
  - 상세: `CLAUDE.md`("코드 리뷰 산출물 → `review/code/**`")·developer SKILL §REVIEW WORKFLOW 가
    요구하는 정상 절차이며 위반이 아니다. `git diff --stat 9a9c024a6..HEAD -- codebase/ CHANGELOG.md
    plan/` 로 실질 코드 diff 만 직접 대조했다 — 33개 파일에 완결히 응집돼 있다
    (`modules/{alerts,integrations,knowledge-base,schedules,triggers}`·`shared/testing`·
    `repo-guards`·`test/*.e2e-spec.ts`). 직전 라운드(`00_00_23/scope.md`)에서 이미 동일하게 관찰된
    사실이라 새 정보는 아니다.
  - 제안: 조치 불요. 참고용 관찰.

- **[INFO]** 이번 라운드에 새로 반영된 커밋(`e018a176f`, "리팩터가 사각지대를 하나 드러냈다 —
  정화 4축 분해 + chatChannel unit")은 순수하게 직전 코드 리뷰(`00_00_23`) WARNING 3건에 대한
  응답이다 — 새 기능·새 파일·새 엔드포인트 없음.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`(`sanitizeForResponse`
    5책임 분해: `stripChatChannelSecrets`/`stripInteractionSecrets`/
    `stripNotificationSigningSecrets`/`deleteSecretColumns`/`narrowWorkflowRef` 로 순수 함수
    추출, W2), `.../integration-response.dto.ts`(`appUrl` JSDoc 의 "cafe24 전용" 오기 정정
    — MakeShop 도 채움, W1), `triggers.service.spec.ts`(JSDoc 위치 재배치 + `chatChannel` 축
    fixture 보강, W3)
  - 상세: `git show e018a176f`로 diff 를 직접 대조 확인 — 함수 추출은 기존 `sanitizeForResponse`
    내부 로직을 그대로 옮긴 리팩터(동작 변경 없음, mutation testing 표로 5/5 축 회귀 확인)이고,
    `appUrl` 문서 정정은 spec(`4-integration.md §9.1`)과 실제 코드(`INTEGRATION_DERIVED_REGISTRY`
    의 makeshop 분기)를 대조해 코드 주석만 낡아 있던 것을 바로잡은 것이다. 새 스코프 확장 없음.
  - 제안: 조치 불요.

- **[INFO]** 보안 결함 수정(트리거/스케줄 회전 secret 유출 4곳)과 계약 스윕(§5.4 검증자 배선
  4→18개 DTO + 필드 선언 보정 24개 + 금지-조합 래칫 신설)이 한 브랜치에 섞여 있다.
  - 위치: `CHANGELOG.md`, `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`sanitizeForResponse` 전체), `codebase/backend/src/modules/schedules/{schedules.controller.ts,
    schedules.service.ts}`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: CHANGELOG·plan 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)
    서술대로 "§5.4 검증자를 넓히는 스윕 도중 실측으로 발견된" 결함이라 분리 발행할 이유가 약하다
    — 발견 즉시 고치지 않으면 방금 넓힌 검증자가 그 결함을 놓친 채 남는다. 이 관찰은 이전 다섯
    라운드(`18_23_02`·`00_00_23` 포함)의 scope 리뷰에서도 동일하게 기록됐고 판단이 바뀔 근거가
    없다.
  - 제안: 조치 불요. 참고용 관찰.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 참조 0곳인 내부 카운터인데도
  선언에 포함됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`consecutiveNetworkFailures` 필드)
  - 상세: PR 자신의 주석과 plan 트래커(`IntegrationDto.consecutiveNetworkFailures 노출 중단 검토`
    항목)가 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다" 고 명시적으로 인정한다.
    스코프 판단이 스스로 문서화돼 있어 은닉된 확장이 아니다.
  - 제안: 조치 불요.

## 요약

이 라운드는 6라운드째 이어지는 `sweep-response-contract` 브랜치의 최신 상태를 리뷰했다.
`git diff --stat 9a9c024a6..HEAD -- codebase/ CHANGELOG.md plan/` 로 실질 코드 변경만 직접
집계한 결과 33개 파일·1,762줄 추가/62줄 삭제이며, 전부 "§5.4 응답-계약 검증자 배선을 4→18개
DTO 로 넓히는 스윕" 이라는 단일 목적과 그 과정에서 실측으로 드러난 트리거/스케줄 회전 secret
유출 수정, 관련 DTO 필드 선언 보정(wire 불변)에 수렴한다. 이번 라운드에 새로 반영된 커밋
(`e018a176f`)은 직전 코드 리뷰(`00_00_23`)의 WARNING 3건(순수 함수 5분해·JSDoc 오기 정정·
JSDoc 위치 재배치)에 대한 응답일 뿐 새 스코프를 열지 않는다 — `git show` 로 diff 를 직접
대조해 기존 로직의 순수 리팩터임을 확인했다. `codebase/`·`CHANGELOG.md`·`plan/`·`review/` 외
영역(`package.json`·CI 설정·lint 설정 등)은 이번에도 전혀 건드리지 않았다. 드러난 흠은
`workflow-crud.e2e-spec.ts` 의 사소한 import 미병합 하나뿐이며, 7라운드 가까이 고쳐지지 않은
채 방치돼 있으나 스타일 수준이라 위험도에 영향을 주지 않는다. `review/**` 산출물(175개 파일)이
실질 코드 diff 보다 훨씬 크지만 이는 프로젝트 규약이 요구하는 리뷰 라운드 누적 결과일 뿐 범위
위반이 아니다.

## 위험도

NONE
