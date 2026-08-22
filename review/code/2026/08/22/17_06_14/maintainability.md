# 유지보수성(Maintainability) 코드 리뷰

## 개요

이번 변경은 `POST /executions/:id/re-run` 의 최상위 `error.code` 를 자매 엔드포인트
(`POST /workflows/:id/execute` · `POST /workflows/:id/save`)와 동일한
`INVALID_TRIGGER_PARAMETERS` 로 통일하는 좁은 범위의 rename 이다. 실제 코드 변경은
`executions.service.ts` 의 문자열 리터럴 1곳 + 설명 주석 4줄, `executions.controller.ts` 의
Swagger `description` 1줄, 테스트 제목·단언 각 1곳, 유저 가이드 mdx 2곳이 전부다. 나머지
대부분(plan 문서 2개, consistency 리뷰 산출물 6개, spec 문서 6개)은 실행 코드가 아닌 문서라
"함수 길이·중첩·순환 복잡도" 류 지표는 해당하지 않는다. 셋 다 동일 검증 실패를 감싸던 코드가
지금까지 갈라져 있었던 **기존 불일치(drift)를 제거하는 방향**이라, 이 변경은 순수하게
유지보수성을 개선하는 쪽에 가깝다.

## 발견사항

- **[WARNING]** 정본 spec 표에 `#TBD_PR` 플레이스홀더가 그대로 남아 있다
  - 위치: `spec/conventions/error-codes.md:145` (Rename 이력 표, `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 행의 "PR" 컬럼)
  - 상세: `error-codes.md §5` 는 규약상 "Retired codes" 이력을 남기는 **정본(SoT)** 표다. 신설된 행의 "PR" 컬럼 값이 실제 PR 번호가 아니라 문자 그대로 `#TBD_PR` 이다. `plan/in-progress/eia-error-code-unify.md` 본문(작업 항목 절)에 "이 작업의 PR 번호를 쓴다"는 지시가 있고, 같은 plan 이 인용하는 consistency 리뷰(`naming_collision` INFO #8, `16_34_50`)도 이 위험을 사전에 지적했지만, 실제로 값을 채우는 단계는 아직 수행되지 않았다. 이 plan 은 `TEST WORKFLOW`·`/ai-review` 두 단계가 아직 미체크 상태라 머지 전이므로 지금 당장의 결함은 아니지만, 이 자리를 놓치고 머지되면 팀의 유일한 rename 이력 표에 존재하지 않는 PR 참조(`#TBD_PR`)가 영구히 남는다 — 정확히 이 spec 이 스스로 강조하는 "실측 가능한 근거"라는 원칙을 스스로 어기는 결과다.
  - 제안: push/머지 직전 체크리스트에 "`error-codes.md:145` `#TBD_PR` → 실제 PR 번호 치환"을 명시적 항목으로 추가하거나, PR 생성 직후 자동으로 채우는 절차를 밟을 것.

- **[WARNING]** rename 된 값을 실제로 검증하지 않는 테스트에 그 값을 제목으로 못박았다
  - 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:330`–`354` (테스트: `throws INVALID_TRIGGER_PARAMETERS when inputOverride fails trigger schema validation`)
  - 상세: 이번 diff 가 테스트 **제목**을 `throws INVALID_INPUT ...` → `throws INVALID_TRIGGER_PARAMETERS ...` 로 바꿨지만, 본문(347–353행)은 여전히 `rejects.toBeInstanceOf(BadRequestException)` 만 단언하고 실제 `code` 값은 어디서도 읽지 않는다. 파일 안에서 `body.code` 를 직접 단언하는 곳은 별도 시나리오(마스킹 값 재제출, 394–432행, 특히 422행)뿐이다. 이번 PR 의 전체 취지가 "셋 중 하나만 다른 코드를 냈던 drift 를 통일"이므로, 그 drift 를 만든 정확한 시나리오(스키마 검증 실패)에 대한 코드 값 회귀를 잡는 캐너리가 이 테스트 하나뿐인데, 그 테스트가 정작 코드 값을 검증하지 않는다. 파일 전체가 이 스타일(제목=의도 문서화, 본문=인스턴스 타입만 확인)을 일관되게 쓰고 있어 이 diff 가 새로 만든 결함은 아니지만, 제목이 더 구체적인 값을 명시적으로 주장하게 된 지금이 `body.code` 단언을 보강하기 좋은 시점이었다.
  - 제안: 353행 근처에 `const body = (err as BadRequestException).getResponse() as { code: string }; expect(body.code).toBe('INVALID_TRIGGER_PARAMETERS');` 형태의 단언을 추가해 제목이 주장하는 바를 본문이 실제로 지킨다.

- **[INFO]** 최상위 에러 코드 문자열이 3곳에 독립 리터럴로 중복돼 있고, 이번 rename 도 그 패턴을 그대로 유지한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:510`, `codebase/backend/src/modules/workflows/workflows.controller.ts:324`, `codebase/backend/src/modules/workflows/workflows.service.ts:931`
  - 상세: `'INVALID_TRIGGER_PARAMETERS'` 라는 동일 문자열이 컴파일 타임 단일 소스 없이 세 파일에 각각 하드코딩돼 있다. 애초에 이번 plan 이 고치는 drift(재-run 쪽만 `INVALID_INPUT` 으로 갈라짐) 자체가 "세 곳의 독립 리터럴이 시간이 지나며 서로 어긋난" 사례라, 같은 실패 모드가 재발할 여지가 구조적으로 남아 있다. 다만 이 패턴은 이번 diff 가 새로 만든 것이 아니라 이 코드베이스 전역의 기존 관례다(`modules/` 하위에서 `code: '<UPPER_SNAKE>'` 형태 리터럴이 60여 곳) — `nodes/core/error-codes.ts` 의 `ErrorCode` enum 은 노드 `output.error.code` 전용이고 HTTP 최상위 봉투 코드에는 대응하는 공유 상수가 없다. 이 PR 범위에서 고칠 사안은 아니며, 향후 유사 drift 재발 방지를 위한 별도 검토 대상으로만 남긴다.
  - 제안: 지금 당장 조치 불필요. 후속 검토(별도 plan)로 "HTTP 최상위 에러 코드 공유 상수화" 여부를 판단할 것.

- **[INFO]** `error-codes.md §5` 신규 행의 "비고" 셀이 표의 다른 행보다도 훨씬 길다
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: 신규 행의 마지막 열(비고)이 볼드·이탤릭이 섞인 장문 산문 한 덩어리(약 700자)로, 같은 표의 기존 행들(143·144·146행)도 이미 긴 편이지만 이번 행이 가장 조밀하다. 표 형식상 한 셀에 여러 논지(리스크 등급·판정 근거·잔여 위험 인수 시점)가 뭉쳐 있어 마크다운 렌더링 시 가로로 매우 길게 늘어난다. 기존 관례(다른 행도 장문)와 같은 방향이라 새로운 이탈은 아니다.
  - 제안: 강한 조치는 불요. 후속 편집 기회에 비고를 문장 3개 정도의 하위 불릿으로 표 아래에 각주 형태로 빼면 표 자체의 스캔성이 좋아진다.

## 요약

diff 자체는 매우 좁고(문자열 리터럴 1곳 rename + 부수 문서 동기화) 함수 길이·중첩·순환 복잡도
측면에서 새로 만든 문제가 없으며, 오히려 세 엔드포인트 간 최상위 에러 코드 불일치라는 기존
유지보수성 결함을 제거하는 개선이다. 실질적으로 주의가 필요한 것은 코드 자체가 아니라
(1) `error-codes.md` 정본 표에 남은 `#TBD_PR` 플레이스홀더가 머지 전에 채워지는지, (2) 이번에
제목이 구체화된 테스트가 실제로 그 값을 단언하지 않는다는 점 두 가지이며, 나머지는 codebase
전역 기존 관례를 그대로 따르는 낮은 우선순위 관찰 사항이다.

## 위험도

LOW
