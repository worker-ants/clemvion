# 문서화(Documentation) 코드 리뷰

## 리뷰 대상 정리

이 diff 는 (1) EIA 내부 읽기 경로 egress 마스킹 실 코드 6개 파일(`redact-stored-error.ts` 신설 +
`executions.service.ts` / `background-runs.service.ts` / DTO 2개 + 테스트), (2) 그 결정을
반영한 spec 6개 문서(`1-data-model.md` · `2-navigation/14-execution-history.md` ·
`4-nodes/1-logic/12-background.md` · `5-system/14-external-interaction-api.md` ·
`5-system/6-websocket-protocol.md` · `conventions/secret-store.md`), (3) `CHANGELOG.md`,
(4) plan 라이프사이클 이동 6건 + 신규 plan 1건, (5) `.claude/docs/plan-lifecycle.md`
`pending_plans` 신규 절, (6) 이 PR 자체가 이미 거친 2라운드 `/ai-review` + 4라운드
`--spec`/consistency 세션 산출물(review/**)로 구성된다.

이 changeset 은 이미 동일한 문서화(Documentation) 관점으로 **두 라운드** 검토됐다
(`review/code/2026/08/16/17_12_34/documentation.md`, `review/code/2026/08/16/17_35_49/documentation.md`).
두 라운드가 낸 WARNING 6건(CHANGELOG 미갱신·plan 체크박스 stale·CHANGELOG 링크 깨짐·
`stop`/`stopInternal` JSDoc 위치·plan 문서 3줄 중복·`plan-lifecycle.md` 실측 수치 stale)을
현재 HEAD 에서 전수 재확인했다 — **전부 실제로 반영돼 있다**:

- `CHANGELOG.md:15` — `[데이터 모델 §2.14](./spec/1-data-model.md)` 링크가 완성돼 있음 (grep 확인).
- `executions.service.ts:791-819`(`stop`) / `:821-830`(`stopInternal`) — TOCTOU/원자 UPDATE
  계약 설명이 실제 로직이 있는 `stopInternal` 쪽으로 옮겨져 있고, `stop` 은 "마스킹 관문"
  설명 + `{@link stopInternal}` 교차 참조만 남음.
- `plan/in-progress/eia-internal-rest-error-masking.md` — `toTerminalErrorPayload` 관련
  3줄 문단 중복이 grep 결과 1곳만 남아 해소됨.
- `.claude/docs/plan-lifecycle.md:88` — "spec 레벨 17건 · plan 레벨 4건" 을 frontmatter-only
  파싱 스크립트로 HEAD 기준 재현하면 정확히 `spec 17 · plan 4` 로 일치(4건에 이 PR 이
  신설하는 `eia-internal-rest-error-masking.md` 포함).

또한 사실 주장(“`GET /api/executions/:id`·`background-runs` 컨트롤러에 `@Roles` 게이트
없음”)도 `executions.controller.ts:63`·`background-runs.controller.ts:24` 실 데코레이터와
직접 대조해 정확함을 재확인했다. spec 6개 문서 사이 상대경로 링크(`../1-data-model.md`,
`../../5-system/14-external-interaction-api.md`, `./14-external-interaction-api.md` 등)도
파일 위치 기준으로 전부 유효하게 해석됨을 확인했다.

## 발견사항

- **[INFO]** `pending_plans` (plan 레벨) 의 신규 정의가 "선행/의존(먼저 닫혀야 하는)" 인데,
  이 PR 이 신설하는 plan 자신의 실제 용례는 "정본 트래커로의 역참조" 에 가깝다 — 이미
  같은 PR 의 consistency 라운드가 인지하고 "정정 불요" 로 판정한 사안이라 참고용으로만 남긴다
  - 위치: `.claude/docs/plan-lifecycle.md:80-81` (정의: *"이 plan 이 착수·완료하기 위해 먼저
    닫혀야 하는 선행/의존 plan"*), `plan/in-progress/eia-internal-rest-error-masking.md:8-9`
    (`pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`)
  - 상세: `eia-internal-rest-error-masking.md` 는 체크리스트상 사실상 완료 상태(`push 게이트
    통과` 한 줄만 미완료)인데, 그 문서가 가리키는 "선행 plan" 인
    `spec-sync-external-interaction-api-gaps.md` 는 이 PR 과 무관한 다수의 열린 항목을 가진
    장기 그루밍 트래커라 가까운 시일 내 닫히지 않는다. 정의 문구를 문자 그대로 읽으면
    "이 plan 은 완료하기 위해 그 트래커가 먼저 닫혀야 한다" 가 되어 실제 의도(*"이 항목은
    그 트래커의 I1/D 항목을 집행하는 자식 작업"*)와 어긋난다. 같은 패턴이 `spec-draft-eia-
    error-masking-catalog.md`(`status: complete`)에도 선례로 있어, 이번 PR 이 처음 만든
    문제는 아니다. 이미 이 PR 의 consistency 라운드(`review/consistency/2026/08/16/17_35_13/
    plan_coherence.md`, SUMMARY INFO#7)가 정확히 이 불일치를 지적했고 "기존 선례 있고 build
    guard 없어 실질 피해 없음 → 정정 불요, `.claude/docs/plan-lifecycle.md §4` 에 세 번째
    용례로 추가하는 것은 선택" 으로 명시적으로 판정을 내렸다.
  - 제안: 이미 내려진 판정(정정 불요)에 동의하며 추가 조치를 요구하지 않는다. 다만 다음에
    누군가 `pending_plans` 정의를 다시 다듬을 기회가 있으면, "완료를 문자 그대로 막는
    prerequisite" 와 "정본 트래커로의 informational cross-link"(현재 관측되는 실제 지배적
    용례) 두 갈래를 구분해 두면 향후 tooling 이 이 필드를 완료 게이팅에 쓰려 할 때 오해를
    막을 수 있다.

## 참고 (확인했으나 문제 없음)

- 응답 DTO 4곳(`execution-response.dto.ts` `ExecutionDto.error`/`NodeExecutionSummaryDto.error`,
  `background-run-response.dto.ts` `BackgroundRunNodeExecutionDto.error`)의 Swagger
  `description` 이 마스킹 부수효과 + SoT 포인터(EIA §R17)를 명시하도록 갱신돼 있다 —
  이번 PR 의 consistency 라운드(`17_35_13`)가 낸 WARNING 1건을 같은 턴에 반영한 결과다.
- `spec/1-data-model.md` §2.14 Execution.error 표에 "응답 마스킹" 행이 추가돼 EIA §R17 로
  역참조한다 — consistency 라운드 INFO#6 반영 결과.
- `spec/4-nodes/1-logic/12-background.md` frontmatter `code:` 에 `redact-stored-error.ts` 가
  등재돼 있다 — consistency 라운드 INFO#1 반영 결과.
- 신규 함수 `redactStoredErrorForResponse`(`shared/utils/redact-stored-error.ts`) JSDoc 이
  "왜 필요한가"·"왜 `toTerminalErrorPayload` 를 안 쓰나"·"보장의 경계"(값 예시 표 포함)·
  `@param`/`@returns` 까지 갖췄고, 그 문서가 주장하는 형태 보존·경계 사례는
  `redact-stored-error.spec.ts` 의 레거시 문자열/숫자 캐너리 테스트로 실제 고정돼 있다
  (JSDoc 이 약속하고 테스트가 검증하는 관계가 성립).
- `executions.service.ts` 의 `ResponseExecution`/`ResponseNodeExecution` 타입, `toResponseExecution`,
  `stop`/`stopInternal` 분리 각각의 JSDoc 이 "왜 이 구조로 나눴는지" 를 실제 코드 구조(반환
  지점 개수, 관문 위치)와 정확히 대응하도록 설명한다.
- `CHANGELOG.md` 신규 `## Unreleased` 항목은 기존 관행(이 계열 직전 6개 커밋)과 동일한
  형식 — wire 변화·잔여 갭·DB 원문 보존 caveat 를 모두 포함.

## 요약

이 diff 의 문서화 상태는 이례적으로 높은 수준이다. 신규 공개 함수·타입의 JSDoc, 변경된
응답 계약을 설명하는 인라인 주석, 6개 spec 문서 동기화, CHANGELOG, plan 라이프사이클 이동이
모두 같은 턴에 정확히 맞물려 있고, 이미 두 라운드의 `/ai-review`(documentation 관점 포함)와
네 라운드의 consistency 검토를 거치며 발견된 문서 관련 결함(CHANGELOG 누락·깨진 링크·stale
JSDoc 위치·중복 문단·stale 통계·DTO Swagger 미갱신)이 전부 이번 HEAD 에서 실제로 해소됐음을
직접 대조로 재확인했다. 유일하게 남는 것은 `pending_plans` 신규 정의와 실제 용례 사이의
미세한 의미 불일치인데, 이는 이미 같은 PR 의 consistency 라운드가 인지하고 "정정 불요" 로
명시적으로 판정한 사안이라 참고 기록(INFO) 수준으로만 남긴다.

## 위험도

NONE
