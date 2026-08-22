# 요구사항(Requirement) Review — masked-marker-cosmetic-followups

## 스코프 확인

본 diff 는 4개 backend 코드 파일(1~4) + plan 문서 2개(5~6) + consistency-check 산출물 8개(7~14, 생성물) +
spec frontmatter 1개(15) 로 구성된다. **코드 파일 1~4 는 전부 주석/JSDoc/Swagger `description` 문자열
변경뿐이며 실행 로직·시그니처·분기·반환값 변경이 0줄이다** (plan 자체가 "코스메틱 4건, 실행 동작
무변경" 으로 명시한 대로). 따라서 본 리뷰는 "새 동작이 의도대로 구현됐는가" 가 아니라 **새로 적힌
문서 내용이 실제 코드 동작·spec 본문과 line-level 로 정확한가**에 집중했다.

## 검증 방법

프롬프트 diff 만으로 판단하지 않고 워크트리의 실제 소스를 열어 대조했다:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (wrapper 구현 전문)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` + `codebase/packages/masked-markers/src/index.ts` (`isMaskedMarker` = `MASKED_MARKERS.includes(v)`, 정확 일치)
- `codebase/backend/src/modules/executions/executions.service.ts` (re-run 400 처리 실측)
- `spec/conventions/error-codes.md` (필드 코드 표)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` + 형제 spec (AST 기반 판정 로직·기존 캐너리 테스트)
- `npx jest src/repo-guards/__tests__/masked-reject-callers.spec.ts` 실행 → **15/15 통과** (JSDoc 블록 주석 안의 함수명이 오탐을 일으키지 않는다는 캐너리 포함, 새 JSDoc 이 가드를 무력화하지 않음을 직접 확인)

## 발견사항

### [INFO] 파일 1 (`trigger-parameter.types.ts`) — `REASON_TO_DETAIL` 신규 JSDoc 3건, 코드·spec 과 정합
- 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-56` (게이트 기준)
- 상세: `missing_required`/`coerce_failed`/`invalid_schema` 에 대한 신규 JSDoc 이 "사용자가 취할 행동" 기준 서술을 담고 있다. `spec/conventions/error-codes.md:126-129` 의 필드 코드 표(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)와 `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 표의 발생 조건 서술이 JSDoc 내용과 일치한다. `invalid_schema` 를 "입력이 아니라 트리거 노드 설정을 고쳐야 한다"고 설명한 부분도 실제로 `validateTriggerParameterSchema`(저장 시점, `resolve-trigger-parameters.ts:61-98`)가 스키마 구조(이름 규칙·중복·타입 enum)만 검사하는 것과 일치한다. 순수 문서 추가이며 부정확한 서술 없음.
- 제안: 없음 (정합 확인됨).

### [INFO] 파일 2 (`resolve-trigger-parameters.ts`) — base/wrapper 역참조 JSDoc, 가드 무력화 없음 확인
- 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:108-123` (게이트 기준)
- 상세: 신규 JSDoc 이 wrapper `resolveTriggerParametersRejectingMasked` 를 `{@link}` 로 역참조하고 "base 에 검사를 넣지 않은 것은 의도" 라는 설명 + CI 가드 `masked-reject-callers-guard.ts` 를 근거로 든다. 실측: (1) 이 base 파일 자신은 `ALLOWED_DIRECT_CALLERS` 목록에 이미 등재돼 있어 이 JSDoc 이 가드를 트립시켜도 오탐 위험이 없고, (2) 가드는 AST `ts.isIdentifier` 기반이라 주석 텍스트는 애초에 식별자 노드가 아니다(가드 자신의 회귀 테스트에 "JSDoc 블록 주석 속 예시는 사용으로 오인하지 않는다" 캐너리가 이미 존재), (3) `masked-reject-callers.spec.ts` 를 직접 실행해 **15/15 GREEN** 확인. wrapper 가 실제로 base 를 감싸는 동작(raw 우선 검사 → base 위임 → resolve 후 재검사)도 `reject-masked-resubmission.ts:56-75` 와 일치.
- 제안: 없음 (정합 확인됨).

### [INFO] 파일 3 (`re-run.dto.ts`) — Swagger description 신규 서술, 실제 거부 로직과 정확히 일치
- 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` (게이트 기준)
- 상세: "마커 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 은 이 필드의 예약어" + "정확 일치 시 400 `INVALID_TRIGGER_PARAMETERS` + `details[].code=MASKED_VALUE_RESUBMITTED`" + "부분 일치(`a***b`)는 통과" 세 주장 전부 코드로 직접 확인됨: `isMaskedMarker` = `MASKED_MARKERS.includes(v)`(정확 일치, `masked-markers/src/index.ts:55-57`), 마커 3종 값(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`, `masked-markers/src/index.ts` export), `executions.service.ts:499-517` 가 `useOriginalInput=false` 분기에서 정확히 이 코드/details 로 400 을 던짐. 설명이 "useOriginalInput=false 일 때" 로 스코프를 정확히 좁혀 적었다.
- 제안: 없음. (참고: 구 설명에 있던 "`resolveTriggerParameters` 검증" 문구는 이번 diff 로 삭제됐다 — `inputOverride` 는 실제로 wrapper `resolveTriggerParametersRejectingMasked` 를 거치므로 오히려 이전 문구가 부정확했고, 이번 삭제가 정확도를 낮추지 않는다.)

### [INFO] 파일 4 (`workflows.controller.ts`) — 주석 한국어 번역, 정보 손실 없음
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:320-322` (게이트 기준)
- 상세: 영문 주석("`details` so GlobalExceptionFilter surfaces the per-field breakdown …")을 한국어로 교체하면서 "`errors` 가 아니라 `details` 다" 라는 대조 정보를 오히려 추가했다. `GlobalExceptionFilter` 가 `details` 만 읽는다는 서술은 자매 호출부 `executions.service.ts:506-516` 의 동일 주석과 논리적으로 일치(두 곳 다 같은 `details[]` 계약을 명시). TODO/FIXME/HACK 류 미완성 표식 없음.
- 제안: 없음.

### [INFO] 파일 15 (`spec/4-nodes/7-trigger/1-manual-trigger.md`) — frontmatter `code:` 보강, 선행 consistency WARNING 해소
- 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:10` (게이트 기준, frontmatter `code:` 목록)
- 상세: `executions.service.ts` 를 `code:` 목록에 추가했다. 이는 같은 diff 안의 `review/consistency/2026/08/22/19_03_59/SUMMARY.md` WARNING #1(§6 표가 인용하는 파일이 frontmatter 에 없다)을 정확히 해소하는 변경이며, 실제로 `executions.service.ts` 가 §6 표가 서술한 대로 `resolveTriggerParametersRejectingMasked` 를 호출해 `INVALID_TRIGGER_PARAMETERS` 를 던진다(파일 3 검증 항목과 동일 근거)는 것도 실측 확인했다. spec 본문(§6 표·Rationale)은 이 diff 에서 변경되지 않았고 frontmatter 만 갱신됐다 — spec-code-paths 가드가 이제 이 파일도 SoT 로 인식한다.
- 제안: 없음 (WARNING 해소 확인).

### [INFO] 파일 5·6 (plan 트래커) — 체크박스 상태와 실제 diff 내용 1:1 대응
- 위치: `plan/in-progress/masked-marker-cosmetic-followups.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- 상세: 4건의 "코스메틱" 항목(Swagger/base JSDoc/REASON_TO_DETAIL JSDoc/주석 언어)이 트래커의 `[x]` 전환과 실제 diff(파일 1~4) 사이에 누락·과잉 없이 대응한다. "함께 하지 않는 것" 절이 나열한 3개 항목(`findMaskedResubmissions` 단위 테스트 부재·`throwIfAny` 회귀 테스트 부재·`ExecutionsService.reRun` 구조)은 실제로 이번 diff 에 포함되지 않았다(파일 1~4 코드 diff 로 확인) — 스코프 서술과 실제 변경이 일치한다.
- 제안: 없음.

### [INFO] 파일 7~14 (consistency-check 산출물) — CRITICAL/WARNING 0, SUMMARY 의 WARNING #1 은 이번 diff 로 해소됨
- 위치: `review/consistency/2026/08/22/19_03_59/*`
- 상세: 5개 checker 전원 CRITICAL 0, WARNING 1건(위 파일 15 항목과 동일 사안)이며 그 WARNING 은 이번 diff 안에서 이미 조치됐다. 이 파일들 자체는 리뷰 세션의 생성물이라 요구사항 충족 판단 대상이 아니라고 보되, 본문 인용 사실관계(예: `masked-reject-callers-guard.ts` 가 AST 기반이라는 서술)를 직접 코드 대조로 재검증해 정확함을 확인했다.
- 제안: 없음.

## 요약

이번 diff 는 이름 그대로 **코스메틱 문서 변경 4건**(Swagger description·base JSDoc·`REASON_TO_DETAIL` JSDoc 3종·주석 언어 통일)이며 실행 코드 라인 변경이 없다. 새로 적힌 모든 문서 주장(마커 3종·정확 일치 판정·400 응답 코드/`details[].code`·wrapper/base 책임 분리·CI 가드 강제 방식)을 실제 구현 파일(`reject-masked-resubmission.ts`, `sanitize-error-message.ts`, `masked-markers` 패키지, `executions.service.ts`, `masked-reject-callers-guard.ts`)과 spec 본문(`1-manual-trigger.md §6`, `error-codes.md`)에 대조한 결과 전부 정확했다. 특히 우려됐던 "base 파일 JSDoc 에 wrapper 이름이 처음 등장하면 CI 가드가 오탐할 수 있다"는 리스크는 가드가 AST 식별자 기반(주석 트리비아 미탐지)이고 이미 회귀 테스트로 고정돼 있음을 직접 실행(15/15 GREEN)으로 확인해 근거 없음을 재검증했다. spec 은 frontmatter `code:` 목록 보강 1건만 변경됐고 이는 선행 consistency-check WARNING 을 정확히 해소한다. CRITICAL/WARNING 급 결함을 발견하지 못했다.

## 위험도

NONE
