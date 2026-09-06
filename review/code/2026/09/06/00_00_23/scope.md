# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `ExportWorkflowDto` 를 별도 `import` 문으로 추가해, 같은 모듈에서 온 `WorkflowDto` 와
  import 가 두 줄로 나뉜 상태가 그대로 남아 있다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14`
  - 상세: `import { ExportWorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';`
    가 바로 아래 `import { WorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';`
    와 같은 경로를 가리키는데도 합쳐지지 않았다. 직전 라운드(`review/code/2026/09/05/18_23_02/scope.md`)에서
    이미 같은 지적을 INFO 로 남겼고 이번 라운드까지 여러 커밋이 이어졌지만 이 두 줄은 그대로다.
    기능상 문제는 없는 스타일 수준의 흠이라 다른 항목에 밀려 방치된 것으로 보인다.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합. 매우 사소해 이번
    PR 을 막을 사유는 아니다.

- **[INFO]** 이 브랜치(`origin/main..HEAD`, 10개 커밋)는 실제 코드 변경(`codebase/**`, 31개 파일·
  1,432줄 추가)보다 훨씬 큰 `review/**` 산출물(10라운드 × 코드리뷰 9개 파일 + consistency-check
  5~7개 파일 ≈ 120개 이상 파일)을 함께 커밋하고 있다.
  - 위치: `review/code/2026/09/05/**`, `review/consistency/2026/09/05/**` 전체
  - 상세: 이는 프로젝트 규약(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/**`", developer SKILL
    §REVIEW WORKFLOW)이 요구하는 정상 절차이며 위반이 아니다. 다만 순수하게 "변경 범위" 관점에서는
    `git diff --stat` 상 150개 이상 파일이 걸려, 파일 개수만으로 이 PR 의 실제 코드 영향 범위를
    가늠하려는 리뷰어를 오도할 수 있다. 실질 코드 변경은 `codebase/backend/src/modules/{alerts,
    integrations,knowledge-base,schedules,triggers}`·`shared/testing`·`repo-guards`·`test/*.e2e-spec.ts`
    로 명확히 응집돼 있고, `git diff --stat -- codebase/` 로 이를 직접 확인했다.
  - 제안: 조치 불요. 참고용 관찰.

- **[INFO]** 보안 결함 수정(트리거/스케줄 회전 secret 유출, 컬럼 3곳+조인 1곳)과 계약 스윕(DTO
  선언 보정 다수 필드 + §5.4 금지-조합 래칫 신설)이 한 브랜치에 섞여 있다.
  - 위치: `CHANGELOG.md`, `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`sanitizeForResponse` 전체), `codebase/backend/src/modules/schedules/{schedules.controller.ts,
    schedules.service.ts}`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: CHANGELOG·plan 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 서술이
    명시하듯, 보안 결함은 "§5.4 검증자를 넓히는 스윕 도중 실측으로 발견"된 것이라 스윕과 분리해
    별도 PR 로 낼 이유가 약하다 — 발견 즉시 고치지 않으면 방금 넓힌 검증자가 그 결함을 놓친 채
    남는다. 다만 "보안 수정"과 "선언 보정"은 서로 다른 축의 "왜"라는 점은 이후 `git log` 추적
    시 인지해 둘 만하다(이 관찰은 직전 라운드 `18_23_02/scope.md` 에서도 동일하게 기록됐다).
  - 제안: 조치 불요. 참고용 관찰.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 참조 0곳인 내부 카운터인데도
  선언에 포함됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`consecutiveNetworkFailures` 필드, `IntegrationDto` 클래스 마지막 필드)
  - 상세: PR 자신의 주석과 plan 트래커(`IntegrationDto.consecutiveNetworkFailures 노출 중단 검토`
    항목)가 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다" 고 명시적으로 인정한다.
    스코프 판단이 스스로 문서화돼 있어 은닉된 확장이 아니며, "선언을 실제에 맞춘다"는 이번 PR
    원칙에 정확히 부합하는 최소 개입이다.
  - 제안: 조치 불요.

## 요약

`git log origin/main..HEAD`(10개 커밋)와 `git diff --stat origin/main..HEAD -- codebase/`(31개
파일, 1,432줄 추가/50줄 삭제)를 직접 대조해 확인한 결과, 코드 변경은 "§5.4 응답-계약 검증자
배선을 4→18개 DTO 로 넓히는 스윕"이라는 단일 목적에서 벗어나지 않는다. 대다수 변경(14개 e2e
spec 의 `assertMatchesContract`/`contractForDto` 배선, `response-contract.ts` 의 `allowMissing`
옵션·`contractForDto` 메모이제이션, 관련 unit 회귀)이 그 배선 자체이고, 나머지는 스윕 도중
실측으로 드러난 트리거/스케줄 회전 secret 유출(엔티티 컬럼 미스트립 + JSONB 3축 + 스케줄 조인을
통한 2차 유출) 수정과 5개 DTO 필드 선언 보정(wire 불변)이다. `triggers.service.ts`·
`schedules.{controller,service}.ts` 의 상당한 diff 도 전부 이 보안 수정에 직결되며, 각 변경마다
근거(FE 참조 수, 뮤테이션 테스트 RED/GREEN 실측, e2e 296~297건 통과)가 코드 주석·CHANGELOG·
plan 트래커에 함께 기록돼 있다. 손대지 않기로 한 항목(`CanvasSaveResultDto` 타입 미선언,
`consecutiveNetworkFailures` 제거, §5.4 스윕 2차 대상)은 새 백로그 항목으로만 등재됐지 코드는
건드리지 않았다 — 스코프 경계를 판단한 흔적이 산출물 자체에 남아 있다. `package.json`·CI
설정·lint 설정 등 `codebase/`·`CHANGELOG.md`·`plan/`·`review/` 외 영역은 전혀 건드리지 않았다.
후속 5개 커밋(리뷰 라운드별 fix)도 전부 직전 라운드 지적에 대한 대응이며 무관한 리팩터링이나
기능 확장은 관측되지 않았다. 드러난 흠은 `workflow-crud.e2e-spec.ts` 의 사소한 import 미병합
정도이고, 이는 여러 라운드를 거치는 동안에도 고쳐지지 않은 채 남아 있으나 위험도에 영향을
주지 않는다. 다만 실질 코드 diff(31파일) 대비 `review/**` 산출물(120개 이상 파일)이 훨씬
크다는 점은 이 PR 이 여러 리뷰 라운드를 거친 결과물임을 반영할 뿐 범위 위반은 아니다.

## 위험도

NONE
