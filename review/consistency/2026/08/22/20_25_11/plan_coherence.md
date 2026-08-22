# Plan 정합성 검토 — spec/4-nodes/7-trigger/ (impl-done)

## 발견사항

- **[INFO]** 트래커 항목 문구가 이후 커밋으로 한 단계 더 진행된 상태를 아직 반영하지 않음
  - target 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`ReRunRequestDto.inputOverride` Swagger `description`) — target spec 자체보다는 target 이 참조하는 코드 diff 범위
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"마커 재제출 거부 PR 의 이월 항목" 의 미체크 항목 `[ ]` **"마커 리터럴을 산문으로 재기술한 지점이 3곳 늘었다"** (`19_36_12` requirement W1 등재, 835~844줄)
  - 상세: 이 항목은 세션 `19_36_12` 시점 상태(마커 3종 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 를 Swagger description 에 verbatim 나열)를 근거로 등재됐다. 이후 같은 PR 의 후속 커밋(`4a1c8bc48` 20:05, `a578366c7` 20:25)이 그 description 을 "요약 + SoT 링크" 형식으로 두 차례 더 축약(304→236→129자)하면서, 세 곳(Swagger description·`REASON_TO_DETAIL` JSDoc·base 함수 JSDoc) 중 적어도 Swagger description 쪽은 더 이상 마커 리터럴 문자열을 나열하지 않는다 (`grep -rn 'REDACTED\|\*\*\*'` 세 파일 모두 0건, 실측 완료). 다만 "산문으로 규칙을 재기술하며 `@workflow/masked-markers` 로 링크하지 않는다" 는 핵심 우려 자체는 세 곳 모두 여전히 유효하다 — 리터럴이 아니라 **규칙 서술**이 대상이기 때문. 즉 항목의 결론(열어둔 채 `#1194` 흡수 대기)은 여전히 맞지만, 항목 서문의 "verbatim 나열" 뉘앙스가 현재 코드 상태보다 한 단계 뒤처졌다.
  - 제안: 차단 사유 아님 — blocking 은 아니지만, 다음에 이 항목을 편집할 때 "Swagger description 은 이후 두 라운드에 걸쳐 리터럴 나열 없이 축약됨(129자, SoT 링크만 유지)" 한 줄을 추가해 실측 드리프트를 없애면 좋다. target(spec) 자체를 바꿀 필요는 없다.

## 정합성 확인 (충돌 없음)

- 이 diff(4개 파일: `trigger-parameter.types.ts` JSDoc 4종·`resolve-trigger-parameters.ts` base 함수 JSDoc·`re-run.dto.ts` Swagger description·`workflows.controller.ts` 주석 한국어화)는 순수 코스메틱이며, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"마커 재제출 거부 PR 의 이월 항목" 이 명시적으로 예고한 4개 체크리스트 항목(786, 804, 809, 816줄)을 정확히 그 순서·범위로 닫는다. 각 항목이 "닫았다 (2026-08-22, `masked-marker-cosmetic-followups`)" 로 실측(0→1건 등)까지 남겨 target 코드와 1:1 대응된다.
- 선행 결정("두 Manual 엔드포인트 최상위 `error.code` 통일", 763줄)은 **이 브랜치 이전**(`eia-error-code-unify`, PR #1193, `origin/main` 에 이미 병합)에 사용자 승인을 거쳐 종결됐고, target spec (`1-manual-trigger.md` §6 에러 코드 표, 225행)이 그 결과(`INVALID_TRIGGER_PARAMETERS` 통일)를 정확히 반영한다. 이 diff 는 그 위에서만 코스메틱을 더할 뿐 재결정하지 않는다.
- 아직 열린 이월 항목들(`ExecutionsService.reRun` 137줄·6책임, `findMaskedResubmissions` 직접 단위테스트 부재, `swagger.md §3` 예외 문면 범위, `execute()` 의 DTO 미승격, `throwIfAny` phase 트레이드오프, `egress-masking.md` 정식 convention 부재)은 모두 이 diff 가 손대지 않는 영역이며, 각 항목 스스로 "지금 고치지 않는 이유"(스코프 밖·planner 턴 필요·후속 기회에 이식)를 명시하고 있어 diff 미착수가 곧 정합이다. 새로 무효화되거나 반영 누락된 후속 항목은 없다.
- `plan/in-progress/node-output-redesign/manual-trigger.md`(output shape 분석) 는 "현 spec 부합, 변경 없음" 결론이며 이 diff 의 범위(에러 코드/JSDoc)와 무관해 충돌 없음.
- `spec/4-nodes/7-trigger/providers/{discord,slack,telegram}.md` 는 이번 diff 대상이 아니며 target 번들에 포함된 것은 디렉토리 스캔 부산물로, plan 정합성 관점에서 관련 미해결 결정을 찾지 못함.

## 요약

이번 target 은 마스킹 마커 재제출 거부 기능(PR #1188~#1193 계열)의 순수 문서/주석 후속 정리이며, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "마커 재제출 거부 PR 의 이월 항목" 트래커가 정확히 이 작업 단위로 항목을 등록·체크하고 있어 plan-target 정합성이 매우 높다. 유일하게 지적할 점은 트래커의 미체크 항목 하나("마커 리터럴을 산문으로 재기술한 지점이 3곳")가 같은 PR 의 더 나중 커밋(Swagger description 재축약)으로 근거 문구가 살짝 뒤처졌다는 것뿐이며, 결론(열어두고 `#1194` 흡수 대기)에는 영향이 없다. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 중 어느 것도 발견되지 않았다.

## 위험도
LOW
