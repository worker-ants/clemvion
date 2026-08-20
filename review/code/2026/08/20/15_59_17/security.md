STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard (15_59_17)

## 컨텍스트

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃을 폐지하고,
재제출 소비처 3곳(폼 프리필 `dynamic-form-ui.tsx`, Re-run 모달 `rerun-modal.tsx`, 에디터
히스토리 로드 `editor-toolbar.tsx`)에 마스킹 마커 감지 가드를 추가한다. 이미 이 changeset 자체가
5라운드(`14_08_45` → `14_44_08` → `15_10_25` → `15_32_34` → 이번)의 code review 를 거쳤고, 그중
2개의 CRITICAL(object/array leaf 마스킹 우회, DTO JSDoc 계약 방치)과 다수의 requirement/testing
WARNING(값-기반 우회, touched-키 영구 해제, 무효 JSON 폴백 우회)이 이미 코드로 수정·재검증됐다.
이번 라운드는 애플리케이션 코드 최종 상태(`codebase/**` 23파일, 588+/154-)를 독립적으로 다시
읽어 재확인했다 — diff 대부분(`review/**`)은 이전 라운드들의 리포트 산출물이라 이번 관점의
검토 대상이 아니다.

## 재확인한 핵심 파일 (직접 Read)

- `codebase/frontend/src/components/executions/rerun-modal.tsx` — `splitMaskedParameters` /
  `blockedByMaskedInput`(2개 조건의 합: touched ∧ ¬hasMaskedMarkerLeaf, + object/array 필드
  coerce-실패 방어) 전문
- `codebase/frontend/src/lib/utils/masked-markers.ts` — `MASKED_MARKERS`/`isMaskedMarker`/
  `hasMaskedMarkerLeaf` 전문
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `SECRET_LEAK_PATTERNS`,
  `MAX_REDACT_DEPTH`, `deepRedactSecrets`/`deepRedactCore`
- `codebase/backend/src/shared/utils/redact-stored-error.ts` —
  `redactStoredDataForResponse`/`redactStoredErrorForResponse`
- `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution` /
  `toExecutionDto` / `findById` 의 `nodeExecutions[]` 마스킹 루프 전문(읽기 표면 표 포함)
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `jsonError` useMemo +
  Run/Save 버튼의 `disabled` 게이팅

## 발견사항

- **[INFO]** `inputOverride` 는 서버측에서 마스킹 마커 리터럴(`'***'` 등)을 값으로서 거부하지 않는다 — UI 우회 시 자기 자신의 재제출 오염만 재현 가능 (defense-in-depth 갭)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`reRun` 메서드의 `resolveTriggerParameters(schema, dto.inputOverride ?? {})` 호출부, `useOriginal` 분기)
  - 상세: 이 PR 이 추가한 마커 가드(스칼라 비움 + object/array leaf 검사 + coerce-실패 검사, `touchedMaskedKeys ∧ ¬hasMaskedMarkerLeaf`)는 전부 **프런트엔드 UI 상태**에 있다. `POST /executions/:id/re-run` 을 UI 를 거치지 않고 직접 호출하면(curl 등) `inputOverride` 에 `'***'` 문자열을 그대로 실어 보낼 수 있고, `resolveTriggerParameters` 는 타입·필수값만 검증하므로 이를 그대로 통과시켜 새 실행의 `Execution.inputData` 에 리터럴 `'***'` 가 실제 입력값으로 저장된다. 다만 이는 **기밀성 침해가 아니다** — 호출자는 애초에 이 실행에 대한 `editor` 이상 권한을 갖고(RBAC `@Roles('editor')` + `verifyOwnership`/`isOwnerOrAdmin` IDOR 가드가 이미 걸려 있음, `reRun` 본문에서 재확인) 자기 자신(또는 자신이 권한 있는 워크스페이스)의 새 실행 입력을 스스로 오염시킬 뿐이며, 타인의 데이터나 다른 워크스페이스로 새는 경로는 없다. 서버가 반환하는 값(`***`)이 실제 secret 을 노출하는 것도 아니다 — 순수하게 자기 자신을 향한 데이터 무결성 이슈다.
  - 이 갭은 **이번 PR 이 새로 만든 것이 아니라 기존부터 있던 것**이고, 이미 `plan/in-progress/eia-inputdata-marker-guard.md` 에 "`inputOverride` 서버측 마커 리터럴 거부"로 트래커 등재돼 있으며(`14_44_08` W6, `15_32_34` RESOLUTION 재확인), 직전 라운드들의 security reviewer 도 동일하게 INFO/조치 불요로 판정한 사안이다. 이번 재검토에서도 그 판단이 유효함을 확인했다 — CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: (선택, 이미 트래커 등재) `resolveTriggerParameters` 또는 그 직전에 `dto.inputOverride` 의 leaf 값이 `isMaskedMarker`/`hasMaskedMarkerLeaf` 와 정확히 일치하면 `INVALID_INPUT` 으로 얕게 거부하는 방어를 defense-in-depth 로 추가할 수 있으나, 이번 PR 의 범위(UI 정상 흐름 방어, EIA §R17 이 명시)를 벗어난다.

## 확인했으나 재지적하지 않는 것 (직전 라운드가 이미 CRITICAL 로 잡아 코드로 수정됨 — 재발 없음 실측)

- **object/array 내부 마커 우회(`14_08_45` CRITICAL 1)**: `hasMaskedMarkerLeaf` 가 중첩 구조를 재귀 순회하고, `rerun-modal.tsx`/`editor-toolbar.tsx` 양쪽 모두 `isMaskedMarker`(정확 일치) 대신 이 함수를 쓴다. `{"headers":{"apiKey":"***"}}` 형태가 뚫리지 않음을 코드로 재확인(`splitMaskedParameters` 의 `hasMaskedMarkerLeaf(v)` 분기, `jsonError` 의 `hasMaskedMarkerLeaf(parsed)`).
- **DTO JSDoc 계약 방치(`14_08_45` CRITICAL 2)**: `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc 주제문이 "값-패턴 마스킹 대상이다"로 현재형으로 재작성돼 있고, Swagger `description`(`nest-cli.json` `introspectComments:true` 로 공개 계약 문구가 됨)도 동일하게 갱신됨을 확인.
- **값-기반 우회(`14_08_45` WARNING 2, 스키마 지연 로드 시 `coerceInput("boolean","")` → `false`)**와 **touched-키 영구 해제(`14_44_08` WARNING 2)**: `blockedByMaskedInput` 이 "touched ∧ ¬hasMaskedMarkerLeaf(현재 값)" 두 조건의 **합**으로 판정해 두 우회 경로 모두 막힘을 코드로 재확인.
- **무효 JSON 폴백 우회(`15_32_34` WARNING 1)**: `isStructuredField(k) && typeof paramValues[k] === "string"` 세 번째 조건이 object/array 필드의 `coerceInput` 파싱 실패(raw 문자열 폴백) 상태를 잡아 차단이 풀리지 않음을 확인. 설령 이 조건이 없어도 backend `resolveTriggerParameters` 의 `isCoerceFailure` 가 `coerce_failed` 로 거부해 실제 오염(자격증명 마커가 실제 입력으로 저장)까지는 가지 않는 2차 방어가 있음도 재확인(`executions.service.ts` 의 `resolveTriggerParameters` 호출 catch 분기).
- **재귀 깊이 상한 / 클라이언트 DoS**: `hasMaskedMarkerLeaf`(frontend)에는 깊이 상한이 없으나, 이 함수가 순회하는 `Execution.inputData` 는 백엔드 `redactStoredDataForResponse` → `deepRedactSecrets` → `MAX_REDACT_DEPTH = 10` 을 이미 통과한 뒤라 REST/WS 로 도착하는 시점에 깊이가 10 으로 상한돼 있다(직접 `sanitize-error-message.ts` 로 확인). 에디터 JSON 텍스트 입력(사용자가 직접 타이핑/붙여넣기)은 이 상한 밖이지만, 그 입력의 유일한 소비자는 입력한 본인의 브라우저 탭이라 self-DoS 이상의 위험이 없다.
- **하드코딩된 시크릿**: diff 전체에서 실 자격증명 패턴(AKIA, `sk-`, PEM private key, `password=`/`secret=` 리터럴)을 grep 했으나 매치 없음. 테스트 파일의 `"sk-live-abc123"`/`"admin:pw"` 는 마스킹 동작을 검증하기 위한 가짜 fixture 로, 저장소 전반에서 반복 사용되는 기존 관례다.
- **인젝션(SQL/XSS/경로탐색)**: 이번 diff 는 신규 SQL 쿼리·`dangerouslySetInnerHTML`·파일 경로 조작을 추가하지 않는다. `executions.service.ts` 의 기존 쿼리는 모두 파라미터 바인딩(`:id`, `:...ids`)을 유지한다.
- **인증/인가**: `reRun`/`getChain`/`stop`/`findById` 의 워크스페이스 격리(`verifyOwnership`)·IDOR 방지(404 통일)·RR-PL-06 owner/admin 게이트는 이번 diff 가 손대지 않았고 그대로 유지됨을 확인.

## 요약

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 데이터 무결성/노출 방지 조치를 마무리하며, 이미 4라운드의 선행 리뷰에서 CRITICAL 2건(object/array leaf 우회, DTO 계약 방치)과 다수의 우회 경로(값-기반 판정, touched-키 영구 해제, 무효 JSON 폴백)를 실제로 코드로 잡아 수정했고, 이번 독립 재확인에서 그 수정들이 모두 최종 코드에 반영돼 재발하지 않았음을 직접 `Read` 로 확인했다. 백엔드 마스킹 관문(`toResponseExecution`/`toExecutionDto`/노드 레벨 루프/`background-runs.service.ts` 4곳)은 `Execution`·`NodeExecution` 레벨 모두 `inputData`를 covering 하고, `deepRedactSecrets` 의 깊이 상한(10)이 프런트 재귀 함수의 잠재적 DoS 표면도 사실상 무력화한다. 유일하게 남는 것은 서버가 UI 를 우회한 `inputOverride` 리터럴 마커를 거부하지 않는 defense-in-depth 갭인데, 이는 기밀성 침해가 아니고(자기 자신의 새 실행만 오염) 이미 이번 PR 범위 밖으로 트래커에 명시 등재된 기존 결정이라 INFO 로만 남긴다. 하드코딩된 시크릿, 신규 인젝션 표면, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러 처리 문제는 발견되지 않았다.

## 위험도

NONE
