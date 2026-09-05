# 변경 범위(Scope) 리뷰 — `review/code/2026/09/05/20_45_37`

## 방법

`git diff origin/main...HEAD --stat` 로 PR 전체 diff(74개 파일, `codebase/**` 29개 +
`CHANGELOG.md` + `plan/in-progress/**` 1개 + `review/code|consistency/**` 43개)를 확보하고,
prompt 에서 생략된 `triggers.service.ts`·`swagger-dto-contract.spec.ts` 전체 diff 를 직접
`git diff` 로 열어 대조했다. 포맷팅만 다른지 확인하려고 `-w` 옵션으로도 재비교했다.

## 발견사항

- **[INFO]** 이 PR 은 "트리거 회전 secret 유출 수정" 외에 (1) 5개 DTO 의 23필드 선언
  추가, (2) `swagger-dto-contract-guard.ts` 세 번째 축(`required:false`+`nullable:true`
  래칫, 78건) 신설, (3) `response-contract.ts` 에 `contractForDto` 메모이제이션 +
  `allowMissing` 옵션 신설, (4) 14개 엔드포인트에 대한 `assertMatchesContract` 배선까지
  포함해 표면적으로는 "secret 유출 수정" 보다 훨씬 넓다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
    (`findOptionalNullableResponseFields`) · `codebase/backend/src/shared/testing/response-contract.ts`
    (`contractForDto`, `ContractCheckOptions.allowMissing`)
  - 상세: 각 확장은 `CHANGELOG.md`("§5.4 스윕이 검출")와
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "스윕 1차" /
    "스윕 1차의 자기 반박" 절에 근거가 명시돼 있다 — (1)은 FE 가 이미 소비 중인 필드를
    선언에 맞춘 것(wire 무변), (2)는 **이 PR 자신의 첫 판**이 만든 회귀(23필드를 금지
    조합으로 선언)를 잡아낸 래칫, (3)은 14곳에 반복 배선하며 발생하는 부트스트랩 비용을
    줄이는 필요조건, (4)는 "§5.4 응답-계약 검증자를 넓힌다"는 과제명 자체가 요구하는
    작업이다. 즉 스코프 확장이 아니라 **원 과제 정의(스윕)에 포함된 항목**으로 보인다.
  - 제안: 없음(정보 제공). 다만 커밋 메시지/PR 제목이 "secret 유출 수정" 만을 내세운다면
    리뷰어·후속 독자가 스코프를 오인할 수 있으니, PR 설명에 "응답-계약 스윕 1차 + 그
    과정에서 발견한 secret 유출 수정"처럼 상위 과제를 먼저 명시할 것을 권한다.

- **[INFO]** `review/code/2026/09/05/{18_23_02,19_08_18}/**` (10개 파일) 과
  `review/consistency/2026/09/05/{18_23_03,19_08_19}/**` (18개 파일) 이 이번 diff 에
  그대로 포함돼 있다.
  - 위치: `review/code/2026/09/05/18_23_02/RESOLUTION.md` 외 다수(`git diff --stat` 확인)
  - 상세: 프로젝트 컨벤션(`CLAUDE.md` "정보 저장 위치")상 코드 리뷰·일관성 검토 산출물은
    `review/**` 에 커밋되는 것이 표준 워크플로다. 내용을 열어 확인한 결과도 이번 PR 의
    직전 라운드(18_23_02→19_08_18, 18_23_03→19_08_19) fix/재검토 이력이며 무관한 내용은
    없었다.
  - 제안: 없음 — 컨벤션에 부합하는 산출물이라 스코프 이탈 아님.

- **[INFO]** `codebase/backend/src/modules/schedules/schedules.service.ts` 에서
  `saved.trigger = savedTrigger;` 대입을 `if (isActive)` 블록 밖으로 끌어올린 1줄 변경이
  포함돼 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:203` (게이트 기준,
    `create` 메서드)
  - 상세: 요청 스코프("trigger 참조 좁히기 + secret 유출 차단")와 직접 관련 없어 보이지만,
    같은 파일의 인접 주석과 스윕 과정에서 발견된 실제 결함("`isActive:false` 로 만들면
    트리거 행은 있는데 응답 키가 사라진다")을 고치는 것으로 명시돼 있고, 이 PR 이 새로
    추가한 `schedule-trigger.e2e-spec.ts` 회귀 테스트가 이 동작을 검증한다. 곁다리
    리팩토링이 아니라 스윕 도중 드러난 실제 버그의 최소 수정으로 판단된다.
  - 제안: 없음.

- **[INFO]** 포맷팅 변경 혼입 여부를 `-w`(공백 무시) diff 로 대조한 결과, `codebase/`
  범위에서 삽입 8줄·삭제 8줄만 차이 나며, 이는 `triggers.service.ts` 의
  `sanitizeChatChannelForResponse` → `sanitizeForResponse` 리네임과 로직 재구성에 따른
  줄바꿈 재배치로 보인다(별도 드라이브바이 포맷팅 커밋 아님).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`
  - 제안: 없음.

- **[INFO]** import 변경은 전부 새로 추가한 코드가 실제로 참조하는 심볼
  (`assertMatchesContract`/`contractForDto`/해당 Dto, `Schedule` 타입,
  `TriggerChatChannelHealth`/`TriggerNotificationHealth`)뿐이며, 미사용 import 추가나
  정리성 재배치는 발견되지 않았다.

## 요약

`git diff origin/main...HEAD --stat` 로 전체 29개 codebase 파일 + CHANGELOG + plan 파일을
확인한 결과, 무관한 파일·설정·포맷팅 변경은 없었다. 표면적으로는 "secret 유출 수정" 보다
훨씬 넓은 변경(DTO 23필드 선언, 신규 정적 가드 축, 검증자 메모이제이션, 14개 엔드포인트
배선)이 섞여 있지만, `CHANGELOG.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`
에 각 확장의 근거(FE 소비 중이라 선언만 맞춤/wire 무변, 이 PR 자신의 회귀를 잡는 래칫,
반복 배선 비용을 줄이는 필요조건)가 명시돼 있어, 스코프 이탈이 아니라 "§5.4 응답-계약
검증자 스윕"이라는 상위 과제 정의 안에 있는 항목들로 판단된다. `consecutiveNetworkFailures`
제거·`CanvasSaveResultDto` 타입 개선·§5.4 스윕 2차 등 즉시 손댈 수 있었지만 관련 있는
항목들은 실제로 손대지 않고 `plan/in-progress/**` 에 후속으로만 등재해 스코프 규율을
지켰다. `review/**` 산출물 43개는 프로젝트 컨벤션상 커밋 대상이라 별건 아니다.

## 위험도
LOW
