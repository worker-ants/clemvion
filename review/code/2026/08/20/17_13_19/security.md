STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트가 제공한 diff(파일 1~24, 일부는 크기 제한으로 생략)를 기준으로 삼되, 생략된 핵심 로직
파일은 저장소에서 직접 열어 확인했다: `codebase/frontend/src/lib/utils/masked-markers.ts`,
`codebase/frontend/src/components/executions/rerun-modal.tsx`,
`codebase/backend/src/shared/utils/sanitize-error-message.ts`,
`codebase/backend/src/shared/utils/redact-stored-error.ts`,
`codebase/backend/src/modules/executions/executions.service.ts`(re-run 생성 경로 포함). 나머지
파일 대부분(105개+)은 이 브랜치가 누적한 `review/code/**`·`review/consistency/**` 세션 산출물로,
실제 애플리케이션 코드가 아니라 이전 리뷰 라운드의 기록이다 — 보안 관점에서 검토 대상이 아니다.

이번 changeset 의 핵심은 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 그 대가로 재제출
소비처 3곳(폼 프리필 `dynamic-form-ui.tsx`, Re-run 모달 `rerun-modal.tsx`, 에디터 히스토리 로드
`editor-toolbar.tsx`)에 "마스킹된 값이 그대로 재제출되는" 데이터 오염을 막는 프런트 가드를 추가한
것이다. 이는 기존에도 8라운드에 걸쳐 code-review + consistency-check 를 받은 결과물이다.

## 발견사항

- **[INFO]** 재제출 오염 방지가 클라이언트 가드에만 의존하고, 서버(`inputOverride`)는 마스킹
  마커 리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 거부하지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (re-run 함수 내
    `resolveTriggerParameters(schema, dto.inputOverride ?? {})` 호출부, 480~505행대) —
    프런트 가드는 `codebase/frontend/src/components/executions/rerun-modal.tsx:368-375`
    (`blockedByMaskedInput`)과 `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`
    (`hasMaskedMarkerLeaf(parsed)` 체크, diff 상 107~117행)
  - 상세: 이번 PR 의 방어(`blockedByMaskedInput`, `hasMaskedMarkerLeaf` 체크)는 전부 프런트
    React 컴포넌트 안에 있다. 정상 UI 흐름에서는 마스킹된 값이 남아 있으면 Re-run/Run 버튼이
    비활성화되지만, API 를 직접 호출(devtools, curl, 자동화 스크립트 등)하면 이 가드를 우회해
    `inputOverride.parameters.<key> = "***"` 를 그대로 서버에 보낼 수 있다. 서버 쪽
    `resolveTriggerParameters`/`isCoerceFailure` 는 타입·필수값 검증만 하고 값이 마스킹 마커
    리터럴과 정확히 같은지는 검사하지 않으므로, 그 값이 그대로 새 `Execution.inputData` 로
    저장되고 후속 노드 실행에 실제 입력값으로 쓰일 수 있다(원래 이 PR 이 막으려던 "조용한 데이터
    오염"과 같은 결과가, 신뢰 경계 밖 호출자에게는 그대로 열려 있다).
  - 참고: 이 갭은 이번 diff 가 새로 만든 것이 아니라 이미 저장소가 인지하고 있다 —
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322`
    ("`inputOverride` 서버측 마커 리터럴 거부", 2026-08-20 등재, `14_44_08` W6)에 defense-in-depth
    항목으로 트래커 등재돼 있고, 여러 라운드의 review/RESOLUTION 에서 "이번 PR 범위 밖"으로
    명시적으로 defer 됐다. 클라이언트 검증만으로 서버 측 데이터 무결성 불변식을 강제하는 패턴
    자체는 계속 남는 리스크이므로 재확인 차원에서 기록한다(자격증명 자체의 노출/유출은 아니고,
    이미 마스킹된 이후의 재제출 데이터 오염 범주다).
  - 제안: 트래커 항목대로 `inputOverride` 파싱 시 `isMaskedMarker`/`hasMaskedMarkerLeaf` 와
    동일한 판정을 서버측에도 얕게 추가해, 값이 마커 리터럴과 정확히 일치하면
    `INVALID_INPUT`(또는 별도 코드)으로 거부하는 것을 권장. (이번 PR 의 스코프는 아님.)

이 외에는 신규/변경 코드에서 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 암호화 약화, 에러 메시지
정보 노출, 취약 의존성 관련 문제를 발견하지 못했다. 구체적으로 확인한 사항:

- **마스킹 커버리지**: `redactStoredDataForResponse`(→ `deepRedactSecrets`)가 `Execution.inputData`·
  `NodeExecution.inputData`·`outputData` 세 표면 모두에 동일하게 적용되도록 통일됐음을
  `executions.service.ts`(1010, 1075행)와 `background-runs.service.ts`(305행 근방)에서 직접
  확인. 기존 웹훅 ingestion 마커(`[REDACTED]`)는 `isMaskedMarker` 멱등 처리로 재마스킹되지
  않아 12-webhook §5.3 계약과 충돌하지 않는다(`sanitize-error-message.ts:150-158`,
  `284`행).
- **깊이 상한(DoS 방어)**: `hasMaskedMarkerLeaf`(프런트, `masked-markers.ts:88-111`)가 backend
  `MAX_REDACT_DEPTH`(10, `sanitize-error-message.ts:112`)와 동일한 상한을 미러해, 신뢰되지 않은
  사용자 JSON 입력(`editor-toolbar.tsx` "Run with Input" 텍스트에어리어)에 대한 무제한 재귀로 인한
  스택 오버플로/렌더 크래시를 방지한다. 값 검사가 깊이 검사보다 먼저 수행돼(`scanForMarker`
  99~101행) 상한 경계에 놓인 치환 마커를 놓치는 off-by-one/fail-open 도 없다.
- **정확 일치 판정의 의도된 경계**: `isMaskedMarker`가 값 전체 일치만 보고 substring/prefix 매칭을
  쓰지 않아 `a***b`류 정상 값을 오탐으로 차단하지 않는다 — 반대로 부분 치환된 값(예:
  `scheme://***@host`)은 감지되지 않지만 그 값은 이미 자격증명이 제거된 상태라 노출 위험은
  없고, 저장소 컨벤션 문서가 이 경계를 명시적으로 caveat 처리했다.
- **프로토타입 오염**: `rerun-modal.tsx`의 `setParamValues((prev) => ({ ...prev, [key]: value }))`
  는 객체 리터럴의 계산된 프로퍼티 키라 `key === "__proto__"` 여도 `Object.prototype`
  을 오염시키지 않는다(스펙상 `CreateDataPropertyOrThrow`, `[[Set]]` 아님). `key` 자체도
  스키마에서 도출된 필드명이라 임의 사용자 입력이 아니다.
- **XSS**: 신규 UI 문자열(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`)은
  전부 `t()` i18n 경유로 `<p role="alert">{t(...)}</p>` 텍스트 노드로 렌더되며
  `dangerouslySetInnerHTML` 등 raw HTML 삽입 경로가 없다.
- **인가**: Re-run 경로의 `RR-PL-06`(타인 실행은 워크스페이스 owner/admin 만) 권한 체크,
  `background-runs.service.ts`의 워크스페이스 멤버십 게이트는 이번 diff 로 변경되지 않았고
  주석(코멘트)만 갱신됐다 — 로직 자체 변경 없음을 diff 로 확인.
- **하드코딩 시크릿/테스트 픽스처**: `background-runs.service.spec.ts`의 `sk-live-abc123`,
  `admin:pw` 등은 마스킹 동작을 검증하는 합성 테스트 픽스처이며 실제 자격증명이 아니다.

## 요약

이번 changeset 은 이미 마스킹된 값이 재제출 경로로 되돌아와 새 실행의 실제 입력값을 오염시키는
문제(§EIA R17 카브아웃 폐지의 전제조건)를 정확 일치 마커 판별 + 깊이 상한 + 세 소비처 전수 가드로
견고하게 닫았다. backend 읽기 경로(`ExecutionsService`/`BackgroundRunsService`)의 마스킹 적용도
`outputData`/`error`와 동일한 헬퍼로 통일돼 표면 간 불일치가 없다. 인젝션·하드코딩 시크릿·인가
우회·암호화 약화·에러 메시지 정보 노출 등 새로 도입된 취약점은 발견하지 못했다. 유일하게 짚을
점은 이 새 데이터-무결성 방어가 전적으로 클라이언트 측에만 있고 서버(`inputOverride`)는 마스킹
마커 리터럴을 여전히 유효한 입력값으로 수용한다는 점인데, 이는 이번 PR 이 만든 결함이 아니라
이미 트래커에 defense-in-depth 항목으로 등재·defer 된 기지 사안이라 INFO 로 기록한다.

## 위험도

LOW
