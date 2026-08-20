STATUS=success user_guide_sync review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `inputOverride` 마커 재제출 서버측 거부 (후속 라운드)

## 매트릭스 적재 · 변경 파일 확정

`.claude/config/doc-sync-matrix.json`(`rows[]` 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127~209행)을 SSOT 로 적재.

프롬프트가 제시한 29개 파일(코드 16 + plan 3 + review 산출물 10)을 확인한 결과, **`codebase/frontend/**` 경로는 단 하나도 포함되지 않는다**. 변경 set 은:

- backend `.ts`/`.spec.ts` 10개 — `execution-engine/{types,utils}`(`reject-masked-resubmission.*`, `trigger-parameter.types.ts`, `resolve-trigger-parameters.spec.ts`) · `executions.service.ts` · `workflows.controller.ts`(+ spec) · `shared/utils/sanitize-error-message.{ts,spec.ts}`(`isMaskedMarker`/`MASKED_MARKERS` export 승격) · `repo-guards/__tests__/{masked-reject-callers,production-build-devdep}*`(신규 저장소 가드·spec) · `tsconfig.build.json`(`repo-guards/**` build exclude)
- `CHANGELOG.md`, `plan/complete/spec-draft-inputoverride-marker-reject.md`, `plan/complete/spec-update-masked-reject-framing.md`(신규 — planner 턴 spec 정정), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크박스 종결 갱신)
- `review/code/2026/08/21/00_03_57/**` 10개 — **직전 라운드 자신의 산출물**(리뷰 대상 아님, 메타)

## trigger 매칭 결과

| 매트릭스 행 | 매칭 여부 | 판단 |
|---|---|---|
| 새 노드 추가 / 노드 schema 변경 | 불일치 | `codebase/backend/src/nodes/**` 무변경 |
| 신규 UI 문자열 (TSX) | 불일치 | `.tsx` 파일 0개 — 이번 라운드는 백엔드 전용 |
| 유저 가이드 신규 섹션 디렉토리 | 불일치 | 신규 `content/docs/<NN>-*/` 없음 |
| 통합/제공자 변경 | 불일치 | 해당 없음 |
| 백엔드 API 추가·변경 (`*.controller.ts`) | 매칭이나 기 검토·조치 불요 확정 (아래) | |
| 신규 errorCode 발행 (`nodes/core/error-codes.ts`) | 불일치(글로브 미스매치) — 아래 상세 | |
| 신규 warningCode 발행 | 불일치 | `warningRules` 무변경 |
| 인증·권한·세션 흐름 변경 | 불일치 | `auth/**` 무변경 |
| 표현식 언어 변경 | 불일치 | `expression-engine/**` 무변경 |
| 실행·디버깅 흐름 변경 (semantic) | 회색지대이나 기 검토 완료 확정 (아래) | |
| spec 신규/대규모 변경 | 이번 diff 범위 밖(spec 파일 자체는 이전 커밋에 이미 반영, plan 파일만 이번 diff) | |

## 발견사항

- **[INFO]** `workflows.controller.ts`(`execute`)가 "백엔드 API 추가·변경" trigger 에 재차 매칭되나, 이번 라운드가 추가한 변경(`resolveTriggerParameters` → `resolveTriggerParametersRejectingMasked` 로 호출부 교체 + import 정리)은 **직전 라운드(`00_03_57`)가 이미 이 정확한 코드 경로를 심사해 "조치 불요"로 확정한 것과 동일 판단이 유효**하다
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts:311-318`, `codebase/backend/src/modules/executions/executions.service.ts:493-513`
  - 매트릭스 항목: "백엔드 API 추가·변경" — "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: 이번 라운드는 거부 로직 자체를 신설하지 않고, 이미 존재하던 `find + length 체크 + throw` 인라인 로직을 `reject-masked-resubmission.ts` 의 공유 헬퍼(`resolveTriggerParametersRejectingMasked`)로 리팩터링한 것뿐이다(라운드5~9는 그 헬퍼의 우회 형태 방지에 집중 — `Object.freeze` 플라시보 교정, `find` 재귀 깊이 상한, repo-guard 로 호출부 강제). `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` 는 포괄 서술로 이전부터 개별 코드를 열거하지 않으며, 사용자가 GUI 로 이 400 에 도달할 경로는 여전히 없다(프런트가 `hasMaskedMarkerLeaf` 로 선제 차단, 선행 PR #1180/#1181). 재확인 결과 `codebase/frontend/src/content/docs/05-run-and-debug/{run-results,running-a-workflow}.{mdx,en.mdx}` 는 이 UI 레벨 차단을 이미 정확히 문서화하고 있다(전 라운드 `14_44_08` 처분, 이번 diff 대상 아님).
  - 제안: 조치 불요. 직전 라운드 INFO 판단이 그대로 유지된다.

- **[INFO]** 신규 export `isMaskedMarker`/`MASKED_MARKERS`(`sanitize-error-message.ts`) 및 `MASKED_VALUE_RESUBMITTED` 코드가 `backend-labels.ts` `ERROR_KO` 에 미매핑 상태로 남지만, 매트릭스 `error-codes.ts` glob 트리거 범위 밖이며 형제 코드 3종과 동형 — 회귀 아님
  - 변경 파일: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150,164`(export 승격), `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`(신규 `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED`)
  - 매트릭스 항목: "신규 errorCode 발행 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 추가)"
  - 상세: `TriggerParameterErrorDetail.code` 는 `error-codes.ts` 의 노드 실행 실패 taxonomy 와 별개다(실행 시작 전 파라미터 검증). 재확인: `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 도 여전히 `ERROR_KO`/`WARNING_KO` 어디에도 없고(grep 0건), `rerun-modal.tsx` 의 `ERROR_CODE_TO_KEY` 는 최상위 `code`(`INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS`)만 보며 `details[].code` 개별 값은 애초에 소비하지 않아 항상 제네릭 토스트로 폴백한다 — 일반 사용자에게 영문이 노출되는 경로 자체가 없다. `export` 승격도 프런트 egress 마스킹(`isMaskedMarker`)과 백엔드 재제출 거부가 마커 리터럴 정의를 공유하기 위한 내부 리팩터이며, 매트릭스가 다루는 "사용자 가시 라벨/에러 메시지" 범주가 아니다.
  - 제안: 조치 불요(매트릭스 gate 밖). 직전 라운드가 제안한 "`TriggerParameterErrorDetail` 전용 매핑 정책이 필요하면 project-planner 턴에서 명문화" 는 여전히 유효한 선택지이나 이번 리뷰의 차단 사유는 아니다.

- 신규로 이번 라운드에서만 등장한 `repo-guards/__tests__/{masked-reject-callers,production-build-devdep}*` 4개 파일과 `tsconfig.build.json` 변경은 저장소 내부 정적 가드/빌드 설정으로, 매트릭스 어떤 trigger 에도 매칭되지 않는다(사용자 가시 표면 없음).

## 요약

이번 라운드(29개 변경 파일, `codebase/frontend/**` 0개)는 직전 라운드(`00_03_57`)가 이미 동일 사용자 가시 표면(마커 재제출 서버측 거부)을 검토해 CRITICAL 0·WARNING 0·INFO 2·NONE 으로 확정한 것의 **리팩터/하드닝 후속**이다. 매트릭스 21행 중 "백엔드 API 추가·변경" 1행만 형식적으로 재매칭됐으나 실사용 영향(GUI 도달 불가, swagger 포괄 서술 기존 패턴 유지)이 동일하게 확인돼 조치 불요로 유지된다. 신규 `MASKED_VALUE_RESUBMITTED` 코드는 `backend-labels.ts` 매핑 트리거(`error-codes.ts` 전용 glob) 밖이며 형제 코드와 동일한 기존 미매핑 상태를 공유한다. 신규 repo-guard 테스트·빌드 설정 변경은 사용자 가시 표면이 없어 매칭 대상이 아니다. 발견된 동반 갱신 누락 없음.

## 위험도

NONE
