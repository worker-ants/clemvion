# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `ExportWorkflowDto` 를 `WorkflowDto` 와 별도 `import` 문으로 추가해, 같은 모듈
  경로에서 온 두 심볼의 import 가 두 줄로 나뉜다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14`
  - 상세: 기능상 문제는 없고 이 스윕의 목적(계약 배선)과 무관한 부수적 스타일 잔여물이다.
    직전 두 라운드(`review/code/2026/09/05/18_23_02/scope.md`,
    `review/code/2026/09/05/22_48_39/scope.md`)에서 이미 같은 지적이 있었고 "조치
    불요(사소)"로 이월된 항목 — 새 결함이 아니라 재확인이다.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합 가능하나, 이번
    PR 을 막을 사유는 아니다.

- **[INFO]** `SchedulesController.toResponse()` 의 지역 변수명이 `t` 로, 이 컨트롤러의 다른
  코드(`workspaceId`, `id` 등 서술적 이름)와 비교해 축약돼 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` (`const t = schedule.trigger;`,
    `toResponse()` 메서드 본문)
  - 상세: 이번 PR 의 보안 목적(조인된 트리거 엔티티 전체가 새는 것을 참조 4필드로 좁힘)을
    담당하는 핵심 자리인데 변수명이 짧아 가독성이 약간 떨어진다. 직전 두 라운드에서 이미
    지적·이월된 항목 — 스코프 위반이 아니라 네이밍 스타일이다.
  - 제안: 조치 불요(이월 유지).

- **[INFO]** 보안 결함 수정(트리거/스케줄 회전 secret 유출 차단 2건 + `triggerToken` 스트립)과
  응답-계약 검증자 배선 확대(4→18 DTO)·선언 보정(24필드)·§5.4 금지-조합 래칫 신설이 한
  PR 에 섞여 있다.
  - 위치: `CHANGELOG.md`, `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`sanitizeForResponse` 전체), `codebase/backend/src/modules/schedules/schedules.controller.ts`
    (`toResponse()`), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
    (`findOptionalNullableResponseFields` 신설)
  - 상세: 범위 위반은 아니라고 판단한다 — `CHANGELOG.md` 와
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 양쪽이 명시하듯 "검증자를
    넓히는 스윕 도중 실측으로 발견된" 결함들이라, 발견 직후 같은 PR 에서 고치지 않으면 방금
    넓힌 검증자가 그 결함을 그대로 놓친 채 남는다. 커밋 단위(`dfb2664af`·`cb17f08709`·
    `a6f582680`·`67881bbd4`·`7e85da873`·`66a2510fd`·`48704becd`)가 이미 "왜"별로 나뉘어 있어
    `git log` 상으로는 축 구분이 가능하다.
  - 제안: 조치 불요. 참고용 관찰.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 참조 0곳인 내부
  카운터인데도 이번 PR 의 선언 범위에 포함됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`consecutiveNetworkFailures` 필드 및 그 위 JSDoc)
  - 상세: DTO 자신의 주석과 plan 트래커(`IntegrationDto.consecutiveNetworkFailures 노출
    중단 검토` 항목)가 이 필드를 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다"
    고 스스로 명시한다. 즉 범위 판단이 산출물 자체에 문서화돼 있어 은닉된 확장이 아니라
    "선언을 실제에 맞춘다"는 이번 PR 의 원칙에 부합하는 최소 개입이다.
  - 제안: 조치 불요.

- **[INFO]** 이 라운드(`23_30_00`)가 새로 대상에 포함한 마지막 두 커밋(`66a2510fd`
  `triggerToken` 스트립, `48704becd` 열린 map e2e 보강)도 확인했다 — 둘 다 같은 §1.1
  규범("세 필드 열거, 응답 노출 금지")을 마저 지키는 작업이고 새 파일·새 축을 만들지
  않았다(`triggers.service.ts`/`triggers.service.spec.ts`/
  `chat-channel-trigger-create.e2e-spec.ts` 세 파일에 국한).
  - 위치: `git show 66a2510fd`, `git show 48704becd`
  - 상세: 참고용 확인 사항 — 발견사항 아님.
  - 제안: 없음.

## 요약

`sweep-response-contract` 워크트리 이름대로, 응답-계약 검증자(§5.4)의 배선을 4개에서 18개
DTO 로 넓히는 단일하고 응집력 있는 작업이다. `origin/main`(merge-base `9a9c024a6`) 대비
`review/**`·`plan/**` 를 제외한 실제 코드 변경은 정확히 31개 파일(`git diff --stat` 실측,
1423 insertions/50 deletions)이며, 전부 (1) `assertMatchesContract`/`contractForDto` 를
14개 e2e 스펙에 배선, (2) `response-contract.ts` 의 `allowMissing` 옵션 신설과
`contractForDto` 메모이제이션, (3) §5.4 "required:false + nullable:true" 금지 조합을 잡는
정적 래칫 가드 신설(+ 양성 대조군 fixture, `repo-guards/__tests__/fixtures/dto/responses/`),
(4) 그 스윕이 실측으로 드러낸 5개 DTO 24개 필드의 선언 보정(wire 불변), (5) 스윕이 드러낸
세 건의 실제 보안 결함 — 트리거 회전 secret 2컬럼(`notificationSecretV2`·
`chatChannelTokenV2`) 유출, 스케줄 응답에 조인된 트리거 엔티티 전체 노출,
`config.interaction.triggerToken` 잔여 유출 — 수정과 그 회귀 테스트(unit + e2e 양쪽)로
수렴한다. `package.json`/`tsconfig`/`eslint`/CI yml 등 설정 파일 변경은 전무함을 실측
확인했고, DTO·서비스·컨트롤러·정적 가드·e2e 파일 전부 이번 스윕의 직접 산물이다.
`CHANGELOG.md` 와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 양쪽에 각
결정의 배경(FE 참조 수 실측, 뮤테이션 테스트로 확인한 판별력, 이전 라운드 리뷰/consistency
지적 번호까지)이 빠짐없이 기록돼 있고, 손대지 않기로 한 항목(`CanvasSaveResultDto` 타입
미선언, `consecutiveNetworkFailures` 제거, §5.4 스윕 2차 대상)은 새 백로그 항목으로만
등재됐지 코드는 건드리지 않았다 — 스코프 경계를 판단한 흔적이 산출물 자체에 남아 있다.
이 diff 에는 `review/code/**`·`review/consistency/**` 아래의 이전 검토 라운드 산출물
(18_23_02 ~ 22_48_40, 총 133개 파일) 도 포함돼 있는데, 이는 이 저장소의 표준 워크플로
(구현 완료 후 강제 `/ai-review` + critical/warning fix 를 반복하는 다회 라운드, 산출물은
`review/code/<타임스탬프>/` 에 커밋)가 남기는 기대된 축적물이지 스코프 이탈이 아니다.
드러난 흠은 전부 이전 라운드가 이미 INFO 로 확인·이월 처리한 사소한 항목(import 분리,
변수명 축약)뿐이며, 이번에 새로 대상에 들어온 마지막 두 커밋(`66a2510fd`·`48704becd`)도
같은 §1.1 규범을 마저 지키는 작업으로 새 축을 만들지 않는다. 의도 밖 리팩토링·무관한
파일 수정·불필요한 기능 확장·포맷팅 혼입은 관측되지 않았다.

## 위험도

NONE
