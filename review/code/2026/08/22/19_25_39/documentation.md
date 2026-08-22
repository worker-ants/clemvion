# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `POST /workflows/:id/execute` 는 `re-run` 과 동일한 마스킹 마커 거부 규칙(`resolveTriggerParametersRejectingMasked`)의 적용 대상인데, 그 사실이 이 엔드포인트의 OpenAPI 문서 어디에도 나타나지 않는다 — 이번 diff 로 형제 엔드포인트(`re-run.dto.ts`)만 상세히 문서화되어 비대칭이 더 두드러진다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:275-279` (`execute()` 의 `@Body()` 가 `@ApiProperty`/DTO 없는 인라인 타입 `{ input?; parameterValues?; }`), `@ApiOperation` 은 `:245-248`
  - 상세: `execute()` 핸들러 본문(`:314-317`, "마스킹된 값이 그대로 재제출됐는가 — … 마커 세 문자열은 Manual 파라미터의 예약어다(프런트도 동일 규칙)")과 spec `1-manual-trigger.md §6`(“가드의 범위 — Manual 실행 경로 전체다 … `POST /workflows/:id/execute` 의 파라미터”)은 이 엔드포인트도 거부 대상임을 명확히 한다. 그런데 Swagger 상으로는 `parameterValues` 필드에 `@ApiProperty`/`description` 이 전혀 없어 이번 PR 이 `re-run.dto.ts` 에 추가한 "마커 3종은 예약어" 설명이 이 엔드포인트에는 조금도 반영되지 않는다. OpenAPI 스펙만 보고 통합하는 클라이언트는 `re-run` 은 경고를 받지만 `execute` 는 아무 단서 없이 `400 MASKED_VALUE_RESUBMITTED` 를 만난다.
  - 제안: 이번 PR 스코프(plan `masked-marker-cosmetic-followups.md` §대상)를 벗어나므로 즉시 수정은 불요하나, `execute()` 의 `body` 를 향후 DTO 로 승격하거나 `@ApiBody`/`@ApiExtraModels` 로 `parameterValues` 를 문서화할 때 같은 예약어 설명을 이식하도록 트래커(`spec-sync-external-interaction-api-gaps.md` 또는 신규 항목)에 한 줄 남겨 두는 것을 권장.

- **[INFO]** `workflows.controller.ts` 의 한/영 주석 혼재 정리가 plan 이 스스로 명시한 대로 "같은 try/catch 블록" 으로 좁게 스코프됐고, 그 결과 같은 `execute()` 메서드 안에 여전히 영문 주석이 남아 있다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:294`(`// Verify workflow belongs to workspace`), `:297-299`(`// Resolve trigger parameters against …`), `:332-335`(`// Stamp the trigger-source marker …`)
  - 상세: `plan/in-progress/masked-marker-cosmetic-followups.md` 는 "실측: 해당 try/catch 블록의 한글 없는 주석 줄 0건" 이라고 정확히 검증했고 그 좁은 주장 자체는 참이다. 다만 같은 메서드·같은 파일 안에 위 세 군데 영문 주석이 그대로 남아 있어, 파일 전체 관점에서는 한/영 혼재가 해소된 것이 아니라 국지적으로만 해소됐다. 의도된 스코프 축소(코스메틱 PR 유지)이므로 결함은 아니지만, 다음에 이 파일을 손댈 때 재부상할 항목으로 트래커에 남겨 둘 만하다.

- **[INFO]** 신규 JSDoc·Swagger 서술은 소스 코드와 대조 검증한 결과 전부 정확했다 (긍정 기록).
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:108-124`(base JSDoc의 wrapper 역참조), `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-24`(Swagger description)
  - 상세: `{@link resolveTriggerParametersRejectingMasked}` 참조 대상(`reject-masked-resubmission.ts:56`)·CI 가드 경로(`repo-guards/__tests__/masked-reject-callers-guard.ts`)·"부분 일치(`a***b`)는 통과한다" 주장(`reject-masked-resubmission.ts` `hasMaskedLeaf`/`findMaskedResubmissions` 의 정확 일치 판정과 일치) 모두 실제 구현과 일치함을 직접 열어 확인했다. `spec/5-system/14-external-interaction-api.md §R17` 인용도, 헤딩 제목만 보면 다른 주제(`getStatus` 노출)처럼 보이지만 실제로는 그 섹션이 마스킹 마커 재제출 거부 규칙의 정본 서술을 담고 있어(§R17 "잔여 ② 해소" 하위 항목, `:1568-1617`) 인용이 정확하다.

- **[INFO]** `trigger-parameter.types.ts` 의 `REASON_TO_DETAIL` JSDoc 밀도 비대칭 해소는 "사용자가 취할 행동" 기준으로 4종 모두 일관되게 서술되어 내부 정합성이 좋다.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71`
  - 상세: `missing_required`(필드를 채운다)·`coerce_failed`(타입을 맞춘다)·`invalid_schema`(입력이 아니라 트리거 노드 설정을 고친다)·`masked_value_resubmitted`(기존, 가려진 값을 다시 입력하라)가 같은 "행동 기준" 틀로 통일됐고, `validateTriggerParameterSchema`(이름 규칙·중복·타입 enum 검증)의 실제 동작과도 부합한다. 결함 없음.

- **[INFO]** spec frontmatter `code:` 갱신(`spec/4-nodes/7-trigger/1-manual-trigger.md:10`)이 직전 consistency-check WARNING(`review/consistency/2026/08/22/19_03_59/SUMMARY.md` WARNING #1 — `executions.service.ts` 가 어느 `code:` 목록에도 없음)을 정확히 해소했다. 새 항목이 실제 파일 경로(`codebase/backend/src/modules/executions/executions.service.ts`, 실존 확인)와 일치.

## 요약

이번 PR 은 코드 변경 없이 문서(JSDoc·Swagger·주석·spec frontmatter)만 보강하는 "코스메틱 4건" 이며, 추가된 서술을 실제 구현·CI 가드·spec 문서와 하나하나 대조한 결과 전부 정확했다 — 지어낸 참조나 오래된 주장은 발견되지 않았다. 유일하게 실질적인 지적은 `re-run.dto.ts` 에 새로 추가된 "마스킹 마커 예약어" Swagger 설명이 동일한 서버측 거부 규칙이 적용되는 형제 엔드포인트(`POST /workflows/:id/execute`)에는 전혀 반영되지 않아 API 문서 비대칭이 이번 diff 로 더 두드러진다는 점이다(WARNING, 스코프 밖이라 즉시 수정 불요하나 후속 추적 권장). `workflows.controller.ts` 의 한/영 주석 통일은 plan 이 명시한 대로 try/catch 블록 안으로 의도적으로 좁게 스코프되어, 같은 메서드 내 다른 영문 주석은 잔존한다(INFO, 의도된 범위 축소).

## 위험도
LOW
