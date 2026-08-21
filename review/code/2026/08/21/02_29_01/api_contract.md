# API 계약(API Contract) 리뷰 — 마스킹 값 재제출 서버측 거부 (EIA §R17, 6라운드째)

## 검토 범위와 방법

이번 프롬프트는 `origin/main...HEAD` 전체 diff(124 files)를 담고 있으며, 그중 API 표면(HTTP
라우트·요청/응답 스키마·인증/인가)에 실제로 영향을 주는 애플리케이션 코드는 아래 8개 파일뿐임을
`git diff --stat` 및 실물 `Read` 로 확인했다(나머지는 `CHANGELOG.md`/`spec/**`/`plan/**`/
`review/code/2026/08/21/{00_03_57,00_39_27,01_15_47,01_38_26,02_04_38}/**` 산출물로, 이전
5라운드가 이미 처리한 리뷰 이력이거나 문서 정정이다):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

`codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`/`.spec.ts` (신규)는
소스 트리를 스캔하는 internal architecture 가드로, HTTP 라우트·DTO·인증과 무관해 API 계약
관점 대상에서 제외했다(런타임 요청 경로에 포함되지 않음).

이전 5라운드(`00_03_57`→`00_39_27`→`01_15_47`→`01_38_26`→`02_04_38`)의 api_contract 리뷰가
CRITICAL 1건(boolean 마커 완전 우회, 검사 시점 결함)과 WARNING 다수(호출부 최상위 `error.code`
drift 지적 등)를 냈고, 후속 커밋에서 전부 수정·재검증됐음을 아래 파일 실물 대조로 확인했다:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` —
  `resolveTriggerParametersRejectingMasked`(raw 우선 검사 → resolve → resolve 후 재검사 2단계),
  `findMaskedResubmissions`/`hasMaskedLeaf`(정확 일치·`MAX_REDACT_DEPTH` 상한, 값 검사가 깊이
  검사보다 선행)
- `codebase/backend/src/modules/executions/executions.service.ts:493-514`(`reRun` catch 블록,
  `code: 'INVALID_INPUT'` + `details: toTriggerParameterErrorDetails(err.errors)`)
- `codebase/backend/src/modules/workflows/workflows.controller.ts:311-325`(`execute` catch 블록,
  `code: 'INVALID_TRIGGER_PARAMETERS'` + `details: toTriggerParameterErrorDetails(err.errors)`)
- 이번 라운드의 순증분(직전 `02_04_38` 대비)은 `sanitize-error-message.ts` 의
  `MASKED_MARKERS`(`ReadonlySet<string>` → `readonly string[] + Object.freeze`)와 repo-guard
  두 파일뿐이며, 둘 다 HTTP 요청/응답 계약을 바꾸지 않는다.

## 발견사항

- **[INFO]** 두 Manual 실행 진입점의 최상위 `error.code` 가 여전히 다르다(`INVALID_INPUT` vs
  `INVALID_TRIGGER_PARAMETERS`) — 이 PR 이 만든 drift 가 아니며 spec 에 명문화되어 있음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:505`
    (`code: 'INVALID_INPUT'`) / `codebase/backend/src/modules/workflows/workflows.controller.ts:319`
    (`code: 'INVALID_TRIGGER_PARAMETERS'`)
  - 상세: 두 엔드포인트가 같은 `TriggerParameterValidationException`/`toTriggerParameterErrorDetails`
    를 공유해 `details[].code`(`MASKED_VALUE_RESUBMITTED` 포함 4종)는 완전히 수렴했지만, 최상위
    봉투 `code` 는 호출부별로 다르다. 이 drift 는 이번 기능이 새로 추가한 `masked_value_resubmitted`
    reason 이전부터 존재했다(`missing_required`/`coerce_failed`/`invalid_schema` 세 reason 도
    동일 헬퍼로 매핑되고 동일하게 갈렸다) — 이번 diff 는 그 위에 네 번째 reason 을 얹었을 뿐 새
    drift 를 만들지 않았다. `spec/5-system/3-error-handling.md:189-193` 에 "Manual 실행 경로...
    `INVALID_TRIGGER_PARAMETERS`, 그리고 Manual re-run 경로... `INVALID_INPUT`... 도 동일 헬퍼를
    쓴다" 로 명문화돼 있어 다음 사람이 통일된 설계로 오인할 여지도 낮다. 최상위 `code` 로 분기하는
    클라이언트만 두 갈래 처리가 필요하고, `details[].code` 로 분기하는 클라이언트는 영향이 없다.
  - 제안: 조치 불요(이전 라운드에서 반복 확인·처분 완료). 두 봉투를 통일하려면 기존 클라이언트가
    보는 최상위 코드 자체가 바뀌므로 별도 breaking-change 결정이 필요해 이 PR 스코프 밖이 맞다.

- **[INFO]** `ReRunRequestDto.inputOverride` 의 Swagger description 이 새 예약어 제약(마스킹
  마커 세 문자열 거부)을 언급하지 않는다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-25`
    (`@ApiPropertyOptional({ description: '... Manual Trigger parameters 스키마와 호환
    (resolveTriggerParameters 검증)' ...})`)
  - 상세: 실제 검증 함수는 `resolveTriggerParametersRejectingMasked` 로 대체됐고 `'***'`/
    `'[REDACTED]'`/`'[REDACTED_DEPTH]'` 는 이제 값 자리에서 예약어가 되어 400 을 유발하지만,
    Swagger 설명 문자열은 옛 함수명만 언급하고 이 신규 제약을 서술하지 않는다. 이전 라운드
    (`01_15_47`)가 "외부 Swagger 소비자 부재 확인됨"을 근거로 유예 처분했고 이번 라운드도 그
    상태 그대로임을 재확인했다.
  - 제안: 조치 불요(유예 유지, 즉시성 낮음). 다음에 이 DTO 를 편집할 기회에 한 줄 보강 권장.

- **[INFO]** 이번 breaking change(마스킹 마커 리터럴 값 거부)는 두 공개 엔드포인트의 요청
  유효값 집합을 좁히지만, 문서화·영향 확인이 완료된 상태로 관리됨
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    (`resolveTriggerParametersRejectingMasked`, 호출부는 `executions.service.ts:499`,
    `workflows.controller.ts:317`)
  - 상세: `POST /workflows/:id/execute` 의 `parameterValues`·`POST /executions/:id/re-run` 의
    `inputOverride` 에서 종전에는 값이 마스킹 마커 세 문자열과 정확히 일치해도 정상 입력으로
    수락됐으나, 이제 400(`MASKED_VALUE_RESUBMITTED`)으로 거부된다. `CHANGELOG.md` 최상단에
    범위(재제출뿐 아니라 Manual 실행 전체)·근거가 명시돼 있고, 저장소 밖 소비자 부재는
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(저장소 소유자 직접 확인)로
    기록돼 있다.
  - 제안: 조치 불요. 참고 등재만.

## 관점별 요지

1. **하위 호환성**: 위 세 번째 항목 참조 — breaking 이지만 통제된 형태(CHANGELOG+spec+소비자
   부재 확인)로 문서화됨.
2. **버전 관리**: API 버전 스킴 부재는 선존 구조(이 diff 밖) — 변경 없음.
3. **응답 형식**: `error.details[]` 3속성(`field`/`code`/`message`) 스키마를 기존 3개 reason과
   동일 포맷으로 확장. `re-run` 경로의 선존 결함(`errors` 키로 던져 `GlobalExceptionFilter` 가
   못 읽던 문제, `http-exception.filter.ts` 는 `resp.details`/`nested?.details` 만 조회)이 이번
   변경으로 `details` 키로 교정돼 자매 호출부(`workflows.controller.ts`)와 형식이 통일됐다 —
   회귀 캐너리(`executions-rerun.service.spec.ts` "[회귀] 거부 응답이 details[] 로...")로 고정.
4. **에러 응답**: HTTP 400(`BadRequestException`)이 검증 실패에 적절. 최상위 `code` drift는 위
   INFO 참조.
5. **요청 검증**: `resolveTriggerParametersRejectingMasked` 가 raw 우선 검사(coerce 전) →
   resolve → resolve 후 재검사의 2단계 구조로 요청 바디 검증을 강화했다. 정확 일치만 판정해
   `a***b` 같은 정상 값을 과잉 차단하지 않는 경계가 캐너리 3곳(단위/두 컨트롤러 스펙)으로
   고정돼 있다. `ReRunRequestDto`/`execute` DTO 자체의 얕은 타입 검증 수준은 이 diff 범위 밖.
6. **URL/경로 설계**: 신규 엔드포인트 없음. 기존 두 엔드포인트의 내부 검증 로직만 변경.
7. **페이지네이션**: 해당 없음(목록 API 아님).
8. **인증/인가**: 두 컨트롤러 메서드 모두 기존 워크스페이스 소유권/권한 체크
   (`findById(id, workspaceId)`)가 마스킹 검사보다 먼저 수행되는 순서가 유지됨을 실물 코드로
   확인 — 인가 우회 신규 표면 없음.

## 요약

이번 라운드까지 포함한 전체 diff 에서 API 표면에 실제로 영향을 주는 코드는 8개 파일로 좁게
유지되며, Manual 실행 경로 두 엔드포인트(`POST /executions/:id/re-run`,
`POST /workflows/:id/execute`)에 서버측 2차 방어층(마스킹 마커 리터럴 값 거부)을 추가하는
의도된 breaking change다. 앞선 5라운드가 CRITICAL 1건(검사 시점 결함으로 인한 boolean 완전
우회)과 다수 WARNING 을 잡아 전부 수정·재검증했고, 이번 라운드의 순증분(`sanitize-error-message.ts`
의 `MASKED_MARKERS` freeze 방식 교정, internal repo-guard 2파일)은 API 계약에 영향을 주지
않는다. 남은 항목은 전부 INFO 로, 두 엔드포인트의 최상위 `error.code` drift(선존, spec에
명문화)와 Swagger description 미보강(외부 소비자 부재 확인, 유예)뿐이며 둘 다 이전 라운드부터
반복 확인·의도적 유예 처분된 상태다. `error.details[]` 스키마는 일관되게 확장됐고, `errors`→
`details` 봉투 교정으로 오히려 두 호출부 간 응답 형식 일관성이 개선됐다.

## 위험도

LOW
