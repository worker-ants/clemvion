# API 계약(API Contract) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (3차, 01_15_47)

## 검토 범위 및 방법

이 diff 는 동일 세션에서 이미 두 차례(`00_03_57`, `00_39_27`) API 계약 관점 리뷰를 받은
코드의 후속 라운드다. 실질 프로덕션 코드는 8개 파일(`trigger-parameter.types.ts`,
`reject-masked-resubmission.ts`(+spec, 신규), `executions.service.ts`(+`-rerun.service.spec.ts`),
`workflows.controller.ts`(+`.spec.ts`), `sanitize-error-message.ts`)이고 나머지 71개는
CHANGELOG·plan·spec·이전 리뷰 산출물이다. 이번 라운드가 실제로 추가한 코드 diff 는
`RESOLUTION.md`/체크박스 갱신·spec 정정(`1-manual-trigger.md`·`12-webhook.md`·
`13-replay-rerun.md`·`14-external-interaction-api.md`·`1-data-model.md`·`3-error-handling.md`)뿐이라,
API 표면 자체(코드 8곳)는 `00_39_27` 검증 시점과 실질적으로 동일하다.

과거 두 라운드를 재판정하지 않고, 워크트리의 실제 파일(`reject-masked-resubmission.ts`,
`trigger-parameter.types.ts`, 두 호출부, `http-exception.filter.ts`, `re-run.dto.ts`,
`executions.controller.ts`)을 직접 `Read`/`Grep` 으로 열어 (a) 이전 CRITICAL/WARNING 이
실제로 해소된 상태인지, (b) 이번에 새로 들어간 spec 문서가 코드와 어긋나는 곳이 없는지
독립적으로 확인했다.

## 발견사항

- **[INFO]** (검증 완료) 이전 CRITICAL(`boolean` 파라미터 완전 우회)·WARNING(`number`/`object`
  잘못된 안내)이 `resolveTriggerParametersRejectingMasked` 의 raw-우선 → resolve →
  resolve-후-재검사 순서로 실제 해소돼 있음을 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:56-75`
  - 상세: `findMaskedResubmissions(schema, rawSource, rawSource)`(①, line 62)가
    `resolveTriggerParameters` 호출(coerce 지점, line 68)보다 먼저 실행되고,
    `throwIfAny(rawHits)`(line 66)가 ①에서 걸리면 resolve 자체를 시도하지 않아
    `coerce_failed` 가 섞여 안내를 흐리지 않는다. object/array 를 JSON 문자열로 보낸
    경우를 위한 ②(line 72)도 대상 키 필터(`rawSource` 기준, line 119)를 공유해
    `defaultValue` 과잉 차단이 재현되지 않는다.

- **[INFO]** 신규 spec 문서(`1-manual-trigger.md` §6·Rationale, `12-webhook.md` §5.2,
  `13-replay-rerun.md` §8.1·§10.2, `14-external-interaction-api.md` §R17,
  `3-error-handling.md` §1.7, `1-data-model.md`)가 실제 구현·응답 봉투와 정합함을 확인
  - 상세: §6 표의 "adapter 전후 2단계(raw 우선 검사 → resolve → resolve 후 재검사)" 서술은
    위 코드 순서와 정확히 일치한다. `error-handling.md:189` 의 4종 필드 코드
    (`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`)
    나열도 `trigger-parameter.types.ts` 의 `REASON_TO_DETAIL` 매핑 4항목과 정확히 대응한다.
    `13-replay-rerun.md:246` 이 re-run 경로의 top-level 코드를 `INVALID_INPUT` 으로,
    `error-handling.md:80`·`191` 이 execute/저장 경로는 `INVALID_TRIGGER_PARAMETERS`, re-run 은
    `INVALID_INPUT` 로 명시해 실물 코드(`executions.service.ts:506`
    `code: 'INVALID_INPUT'` / `workflows.controller.ts` `code: 'INVALID_TRIGGER_PARAMETERS'`)와
    일치한다 — 두 엔드포인트가 같은 실패 사유에 다른 top-level `code` 를 쓰는 것은 신규
    비일관이 아니라 **기존에 이미 그랬던 것을 spec 이 뒤늦게 명문화**한 것이고,
    `error-handling.md:80` 은 그 이유(발행 중인 코드의 rename-stability, `conventions/error-codes.md`)까지
    명시한다.

- **[INFO]** Swagger(OpenAPI) 표면의 요청/응답 설명 문구는 이번 마스킹-마커 예약어화를
  언급하지 않는다 — `spec/` 내부 문서만 이를 서술한다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-25`
    (`inputOverride` 의 `@ApiPropertyOptional` description — "Manual Trigger parameters
    스키마와 호환" 까지만 적고 마커 리터럴 거부는 언급 없음),
    `codebase/backend/src/modules/executions/executions.controller.ts:273-275`
    (`@ApiBadRequestResponse({ description: 'INVALID_INPUT / RERUN_DRY_RUN_NOT_APPLICABLE' })`),
    `codebase/backend/src/modules/workflows/workflows.controller.ts:254`
    (`@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })`)
  - 상세: 이 세 문구는 이번 diff 로 변경되지 않은 기존 문구이고, 이 저장소의 기존
    패턴(`details[].code` 개별 열거값을 top-level `@ApiBadRequestResponse` description 에
    나열하지 않는 관행)과 일치하므로 **드리프트는 아니다**(`00_39_27` 라운드가 이미
    "Swagger 문서에 드리프트 없음" 으로 확인한 지점과 같은 결). 다만 이번 변경이 만드는
    실질적 API 계약 좁힘 — 리터럴 `'***'`/`[REDACTED]`/`[REDACTED_DEPTH]` 가 Manual 트리거
    파라미터 값 자리에서 **예약어**가 되어 400 을 유발한다는 사실 — 은 저장소 내부 `spec/`
    문서에만 상세히 기술돼 있고, 생성된 OpenAPI/Swagger 문서(외부 API 소비자가 실제로
    참조할 표면)만 보는 클라이언트 개발자는 이 제약을 알 방법이 없다.
  - 제안: 강제 사안은 아니다(기존 컨벤션과 일치, 외부 소비자 부재가 이미 확인됨 —
    `spec-sync-external-interaction-api-gaps.md` W5). 다만 다음에 이 두 DTO/데코레이터를
    손댈 기회가 있으면 `inputOverride`/`parameterValues` description 에 "마스킹 마커
    (`***` 등) 리터럴은 거부됩니다" 한 줄을 추가해 두면 향후 이 엔드포인트를 처음 접하는
    외부 통합자가 Swagger 만으로도 이 제약을 알 수 있다.

- **[INFO]** `errors` → `details` 봉투 교정이 `GlobalExceptionFilter` 계약과 정합함을 재확인
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (73행 부근,
    `details = resp.details ?? nested?.details;`)
  - 상세: 필터는 `code`/`message`/`details` 세 키만 명시적으로 읽으므로, 종전
    `errors: err.errors` 는 응답 바디에 실린 적이 없는 죽은 키였다 — 이번 교정은
    기존 클라이언트를 깨뜨릴 수 없는 순수 버그 수정이다(이전 라운드 판정과 동일 결론,
    이번에도 재확인).

## 스코프 밖 확인

- 인증/인가(`@Roles('editor')`), 페이지네이션, API 버전 관리(이 프로젝트는 버전
  스킴이 없다), URL/경로 설계 — 이번 diff 로 변경 없음.
- 마커 리터럴 예약어화라는 하위 호환성 좁힘 자체(외부 소비자 부재 확인·릴리스 노트
  판단)는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W5/W6 로 이미
  등재·종결됐고 이번 라운드가 그 판단을 바꿀 근거는 없다.

## 요약

이번 라운드에서 코드(8개 파일) 자체는 `00_39_27` 시점과 실질적으로 동일하며, 이전
두 라운드가 지적한 CRITICAL(`boolean` 마스킹 마커 완전 우회)·WARNING(`errors`→`details`
봉투 유실 등)은 실물 코드로 재확인한 결과 모두 해소돼 있다. 이번에 추가된 산출물은
주로 spec 문서 6곳의 정정(검사 시점 "전후 2단계" 명문화, "재제출 한정" → "Manual 실행
경로 전체" 프레이밍 정정, 4종 에러 코드 카탈로그 등재)과 plan 트래커 종결이며, 직접
대조한 결과 실제 코드·응답 봉투와 어긋나는 곳이 없다. 유일하게 신규로 짚을 만한 것은
Swagger/OpenAPI 표면이 이 마커-예약어화 제약을 문구로 노출하지 않는다는 점인데, 이는
이 저장소의 기존 문서화 관행과 일치하고 외부 소비자 부재가 이미 확인된 상태라 강제
조치 대상은 아니다. CRITICAL·WARNING 신규 발견 없음.

## 위험도

LOW
