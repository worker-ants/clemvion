# 문서화(Documentation) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 검토 범위

실질 코드 변경(diff 상 16개 실체 파일):
- `CHANGELOG.md`
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts`
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` / `.spec.ts`
- `plan/complete/spec-draft-inputoverride-marker-reject.md` (신규)
- `plan/complete/spec-update-masked-reject-framing.md` (신규)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
  `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/5-system/12-webhook.md`,
  `spec/5-system/13-replay-rerun.md`, `spec/5-system/14-external-interaction-api.md`,
  `spec/5-system/3-error-handling.md`

나머지(`review/code/2026/08/21/00_03_57/**` ~ `02_29_01/**`, `review/consistency/2026/08/20~21/**`)는
이전 라운드가 이미 검토·처분한 산출물을 그대로 커밋에 실은 것뿐이라(round 6 수렴, 커밋
`c8dadb041` 등) 신규 문서화 검토 대상에서 제외했다.

이 PR 은 이미 6라운드에 걸친 코드 리뷰·consistency-check 를 거쳤고, 발견사항 대부분이
docstring/Rationale/CHANGELOG/spec 정정으로 직접 처분되어 있다. 아래는 그 이후에도 남아
있는 것만 적는다.

## 발견사항

- **[INFO]** `ReRunRequestDto.inputOverride` 의 Swagger `description` 이 새 예약어 제약을
  반영하지 않는다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `inputOverride`
    필드의 `@ApiPropertyOptional({ description: ... })` (게이트 18~22, 이번 diff 미포함 —
    본 PR 이 건드리지 않은 기존 줄)
  - 상세: 현재 문구는 `"useOriginalInput=false 일 때 사용할 입력. Manual Trigger
    parameters 스키마와 호환 (resolveTriggerParameters 검증)"` 뿐이고, 마스킹 마커
    세 문자열(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)이 값 자리에서 예약어가 되어
    400(`MASKED_VALUE_RESUBMITTED`)으로 거부된다는 사실은 Swagger 문서 어디에도
    없다. `POST /workflows/:id/execute` 쪽 `parameterValues` 는애초에 인라인 타입
    (`Record<string, unknown>`)이라 `@ApiProperty` 자체가 없어 같은 문제가 구조적으로
    존재한다. 다만 이 항목은 신규 결함이 아니라 직전 라운드(`01_15_47` RESOLUTION.md
    미조치 INFO #5)가 이미 발견하고 "기존 문서화 관행과 일치, 외부 소비자 부재 확인됨,
    다음 DTO 편집 기회에" 로 명시적으로 유예한 것과 동일 항목이다 — 재지적이 아니라
    미해소 상태 확인.
  - 제안: 이번 PR 스코프에서 강제할 사안 아님. 다음에 `ReRunRequestDto` 또는 execute
    엔드포인트의 body 타입을 정식 DTO 로 승격할 기회가 있으면 `description` 에 예약어
    제약을 한 줄 추가.

- **[INFO]** `workflows.controller.ts` 의 신규 한국어 인라인 주석 바로 아래에 기존 영어
  인라인 주석이 남아 언어가 섞인다 (comment-accuracy 자체는 문제 없음, 스타일 불일치)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute`
    메서드의 `try { parameters = resolveTriggerParametersRejectingMasked(...) } catch`
    블록. 신규 3줄 한국어 주석 바로 아래 기존 `// \`details\` so GlobalExceptionFilter
    surfaces the per-field breakdown ...` 영어 3줄이 그대로 남아 있다(이 영어 줄 자체는
    이번 diff 가 만든 게 아니라 컨텍스트 라인).
  - 상세: 두 주석 모두 내용은 정확하다(오래된/틀린 주석 아님) — 다만 이 저장소 최근
    커밋들은 서술형 근거 주석을 한국어로 쓰는 쪽으로 수렴하는 추세라, 같은 `try/catch`
    블록 안에서 언어가 갈리면 다음에 이 블록을 여는 사람이 어느 언어로 이어써야 할지
    헷갈릴 수 있다. maintainability 리뷰(동일 라운드)도 같은 지점을 INFO 로 이미 지적했다
    — 중복 등재이며 강제 사안 아님.
  - 제안: 필수 아님. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일 검토.

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 두 체크박스
  종결 표기가 CLAUDE.md `plan-lifecycle` 관례상 이 파일 자체가 아직 `in-progress` 인 것과
  약하게 어긋난다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `[x]
    inputOverride 서버측 마커 리터럴 거부` / `[x] Execution.inputData 응답 의미 반전의
    외부 소비자 확인` 두 항목
  - 상세: 두 항목 모두 `[x]`로 체크되고 "→ 종결"/"→ 확인했으나 없음" 근거가 명시돼 있어
    항목 자체의 정합성은 문제없다. 다만 파일 전체는 여전히 `plan/in-progress/` 에 있고
    frontmatter `status` 도 (본 diff 에서 안 바뀜) `in-progress` 로 남아 있다 — 이 항목이
    이 파일의 마지막 open 항목이 아니라면(다른 미체크 항목이 더 있는지는 이 프롬프트에
    실린 diff 범위 밖) 문제 없으나, 만약 이번 두 항목이 사실상 마지막 open 항목이었다면
    `plan/complete/` 로의 이동이 이 diff 에서 누락된 것일 수 있다. `01_15_47` RESOLUTION.md
    미조치 항목 #9("planner plan status: in-progress — plan 정리 대상, 이 PR 의 plan 이동에서
    함께 처리")가 정확히 이 우려를 이미 등재해 두었다.
  - 제안: 이 파일에 다른 미체크 `[ ]` 항목이 남아 있는지 확인하고, 없다면 plan-lifecycle
    규약대로 `plan/complete/` 로 이동 + frontmatter `status: complete` 갱신. 있다면 조치
    불요.

## 요약

핵심 구현(`reject-masked-resubmission.ts`)과 타입 확장(`trigger-parameter.types.ts`)은
JSDoc 밀도가 매우 높다 — 왜 필요한지, 왜 raw/resolve 두 단계로 나눴는지, 왜 webhook·schedule
을 제외했는지, 왜 `coerce_failed` 를 재사용하지 않았는지가 전부 근거와 함께 문서화되어
있고, 과거 세 라운드에 걸쳐 반증된 설계(resolve 결과만 검사·`Object.freeze(Set)`)에는
"이 설계는 이런 이유로 틀렸다"는 반증 노트까지 남겨 재발을 막는다. CHANGELOG 신규 항목은
범위·근거·트레이드오프를 서술형으로 담아 기존 관례와 일치하고, spec 7개 파일(§R17 카탈로그·
manual-trigger §6·webhook §5.2·replay-rerun §8.1/§10.2·error-handling §1.7·data-model·
editor §2.2)이 검사 시점("전후 2단계")·적용 범위("Manual 실행 경로 전체, 재제출뿐 아니라
직접 입력도 포함")를 코드와 정확히 동기화하고 있다 — 이전 라운드가 지적한 stale 서술
3곳(§6 검사 시점 "직후", 3-error-handling.md·12-webhook.md 의 "재제출 경로 한정")은 이번
diff 에서 이미 정정돼 있음을 실물로 확인했다. 신규 테스트 파일들도 각 케이스가 어떤 과거
CRITICAL/WARNING 을 고정하는 캐너리인지 docstring 으로 명시해 가독성이 높다. 남은 항목은
전부 이미 이전 라운드가 발견·유예 근거를 남긴 INFO 성격(미조치 Swagger 설명, 잔존 영어
주석 하나, plan 이동 확인)뿐이며 신규로 발견된 심각한 문서화 결함은 없다.

## 위험도

NONE
