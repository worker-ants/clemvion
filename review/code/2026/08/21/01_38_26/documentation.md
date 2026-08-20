# 문서화(Documentation) 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 범위

실질 코드 변경 8개 파일 + CHANGELOG + spec 7곳(`spec_impact`) + plan 문서 2건. 나머지(`review/code/**`, `review/consistency/**` 산출물)는 과거 리뷰 라운드의 결과물이 이번 커밋에 그대로 실린 것뿐이라 문서화 관점 재검토 대상에서 제외했다(내용은 이미 각 라운드에서 자기 자신을 다룸).

핵심 신규/변경 파일을 직접 열어 diff 뿐 아니라 전체 컨텍스트로 확인했다:
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`
- `CHANGELOG.md`, spec 7곳, `plan/complete/spec-draft-inputoverride-marker-reject.md`, `plan/complete/spec-update-masked-reject-framing.md`

## 발견사항

- **[INFO]** 같은 `try/catch` 블록 안에 신규 한국어 인라인 주석과 기존 영어 인라인 주석이 언어를 달리해 공존한다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 신규 주석 게이트 314-316(`// 마스킹된 값이 그대로 재제출됐는가 ...`), 바로 아래 미변경 컨텍스트 게이트 320-322(`// `details` so GlobalExceptionFilter surfaces the per-field breakdown ...`)
  - 상세: 이 diff 가 새로 도입한 문제는 아니고(영어 줄은 컨텍스트 라인, 미변경) 이전 라운드(`review/code/2026/08/21/00_03_57/maintainability.md`)에서도 이미 INFO 로 등재되어 조치 불요로 처분된 항목이다. 이번 라운드에도 그대로 남아 있어 재확인 차 등재한다 — 이 저장소 최근 커밋 다수가 서술형 근거 주석을 한국어로 쓰는 쪽으로 수렴 중이라, 다음에 이 `try/catch` 블록을 여는 사람이 어느 언어로 이어써야 할지 판단 근거가 없다.
  - 제안: 필수 아님(이전 라운드 처분과 동일). 다음에 이 블록을 편집할 기회가 있으면 영어 줄도 한국어로 통일 검토.

- **[INFO]** `reject-masked-resubmission.ts` 상단 docstring의 "이 함수를 쓰는 곳은 re-run 과 `POST /workflows/:id/execute` 둘뿐이다" 서술이 실제 소비처와 일치하는지 확인함 — 불일치 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 함수 `resolveTriggerParametersRejectingMasked` 상단 docstring(게이트 23-32)
  - 상세: `executions.service.ts:499`, `workflows.controller.ts:317` 두 호출부만 실제로 이 함수를 import·호출하며, `hooks.service.ts`·`schedule-runner.service.ts`는 여전히 기존 `resolveTriggerParameters`를 직접 호출한다(grep으로 잔여 참조 없음 확인). 문서가 코드와 정확히 정합한다 — 발견사항이 아니라 검증 결과로 기록.

## 요약

이번 diff의 문서화 수준은 이 저장소 최근 시리즈 중에서도 특히 높다. 신규 핵심 파일(`reject-masked-resubmission.ts`, 그 spec)은 "왜 필요한가 / 범위 / 왜 resolve를 감싸는가(검사 시점) / 경계 두 가지"를 각각 별도 섹션으로 나눠 JSDoc에 근거와 함께 남겼고, 초판이 뚫렸던 세 갈래(boolean 완전 우회·number 안내 오선점·defaultValue 과잉 차단)를 표로 정리해 "왜 지금 이 순서인가"를 코드 옆에 고정했다. `sanitize-error-message.ts`의 `isMaskedMarker`/`MASKED_MARKERS` export 승격 지점에도 "왜 복제하지 않고 공유하는가"를 명시했고, 새 판정 로직이 프런트 미러와 같은 경계(정확 일치·깊이 상한)를 갖는 이유도 각 함수 docstring에 남아 있다. `trigger-parameter.types.ts`의 신규 enum 값도 `coerce_failed` 재사용을 기각한 근거를 doc comment로 명시해 다음 사람의 오분기를 예방한다. spec 문서 7곳(§R17·error-handling·replay-rerun·manual-trigger·data-model·execution·webhook)은 전부 실제 diff와 대조해 정합함을 확인했다 — 특히 `1-manual-trigger.md`의 검사 시점 서술("전후 2단계")과 응답 봉투 문장("Manual·Webhook·Manual re-run")이 구현과 정확히 일치하고, `## Rationale`에 "왜 '직후' 한 지점만 보면 위험한가"를 표로 승격해 재발을 막았다. CHANGELOG는 최상단에 배치되어 있고 직전 커밋(#1188)의 예고와 연결고리를 명시했다. 유일하게 남는 항목은 이전 라운드에서 이미 조치 불요로 처분된 언어 혼재 인라인 주석 1건(INFO)뿐이며, 이는 이번 diff가 만든 문제가 아니다. README나 별도 환경변수·설정 옵션 추가는 없어 해당 항목은 대상 외다.

## 위험도

NONE
