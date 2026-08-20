# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard (15_10_25)

## 컨텍스트

이 changeset 은 `Execution.inputData` egress 마스킹의 유일한 카브아웃을 닫는 정책 전환이다.
backend 는 `toResponseExecution`/`toExecutionDto`/`stop()` 세 응답 표면에
`redactStoredDataForResponse` 를 걸어 `Execution.inputData` 도 자격증명 값-패턴 마스킹 대상으로
편입시켰고, frontend 는 재제출 소비처 3곳(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드)에
마스킹 마커 감지 가드를 추가해 마스킹된 `'***'`/`[REDACTED]`/`[REDACTED_DEPTH]` 리터럴이 새
실행의 실제 입력으로 되쓰이는 것(왕복 오염)을 막는다. 마커 판별기(`isMaskedMarker`/
`hasMaskedMarkerLeaf`)는 `dynamic-form-ui.tsx` 에서 `codebase/frontend/src/lib/utils/masked-markers.ts`
로 승격돼 세 소비처가 공유한다. 이 라운드는 직전 두 라운드(`14_08_45`, `14_44_08`)에서
CRITICAL/WARNING 로 잡힌 항목(object/array leaf 우회, 값-기반 판정의 타입캐스팅 우회, 터치-기반
판정의 영구 해제 우회)이 실제로 조치됐는지 코드·테스트 레벨에서 재검증했다.

## 검증한 것

- **backend 세 표면 전수 확인**: `codebase/backend/src/modules/executions/executions.service.ts:1009`
  (`toResponseExecution`), `:1074`(`stop()` 의 `...rest` 스프레드), `background-runs.service.ts:305`
  (`redactStoredDataForResponse(row.inputData)`) 모두 `Execution`/`NodeExecution` 레벨에 동일하게
  `redactStoredDataForResponse` 를 적용한다. 캐너리 테스트 4건(①②⑧⑧-b,
  `executions.service.spec.ts`)이 "원문 통과" → "마스킹" 으로 방향이 정확히 반전돼 있고
  (`git diff` 로 직접 대조), 코드와 어긋나지 않는다.
- **object/array 안쪽 마커 우회(직전 CRITICAL) 재검증**: `hasMaskedMarkerLeaf`
  (`codebase/frontend/src/lib/utils/masked-markers.ts:64`)가 `dynamic-form-ui.tsx`
  (`initialValueFor`), `rerun-modal.tsx` 의 `splitMaskedParameters`, `editor-toolbar.tsx` 의
  `jsonError` 계산 세 곳 **전부**에서 쓰인다 — 직전 라운드처럼 한 소비처만 새 헬퍼를 쓰고 나머지가
  `isMaskedMarker`(정확 일치)에 머무는 비대칭이 이번엔 없다.
- **차단 판정 이중 조건(직전 WARNING) 재검증**: `rerun-modal.tsx:345`
  (`blockedByMaskedInput = !useOriginalInput && maskedKeys.some((k) => !touchedMaskedKeys.has(k) ||
  hasMaskedMarkerLeaf(paramValues[k]))`)가 "건드렸는가" 와 "현재 값에 마커가 없는가" 를 **AND**
  로 요구한다 — 값 하나만 보면 스키마 지연 도착 시 `coerceInput` 우회에 뚫리고, 터치만 보면
  건드린 뒤 값을 다시 마커로 되돌려도 영구 해제되는 두 개별 우회를 동시에 막는다. 대응 테스트
  캐너리(`rerun-modal.test.tsx` "건드린 뒤 값이 다시 마커면 계속 막는다", "마스킹 키가 둘이면
  하나만 채워도 계속 막힌다")도 존재한다.
- **하드코딩 시크릿**: 없음. 테스트에 등장하는 `sk-live-abc123`, `admin:pw` 등은 마스킹 검증용
  더미 픽스처(기존 관행)이며 실제 자격증명이 아니다.
- **인젝션(SQL/XSS/경로탐색)**: 신규 코드는 순수 문자열/JSON 비교(`Set.has`, 재귀 순회)와 React
  상태 갱신뿐이며, 원시 HTML 삽입(`dangerouslySetInnerHTML`)이나 동적 쿼리 문자열 조합이 없다.
  해당사항 없음.
- **암호화/평문 전송**: 관련 변경 없음.

## 발견사항

- **[INFO]** 마스킹-마커 재제출 차단이 클라이언트에서만 강제되고, 두 제출 핸들러 모두 자체
  재검증 없이 버튼의 `disabled` 상태에만 의존한다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` (`handleSubmit`,
    L351 부근 — `blockedByMaskedInput` 을 참조하지 않고 바로 `executionsApi.reRun` 호출),
    `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (`handleRunWithInput`,
    L290-317 — `jsonError`/`hasMaskedMarkerLeaf` 재확인 없이 `workflowsApi.execute` 호출. 같은
    파일의 `handleSaveDataset` L173 은 `jsonError != null` 을 핸들러 안에서 재확인하는데
    `handleRunWithInput` 은 그 패턴을 따르지 않는다)
  - 상세: 두 진입점 모두 실제 제출 로직은 버튼의 `disabled={... || blockedByMaskedInput}` /
    `disabled={isRunning || jsonError != null}` 에 의해서만 막힌다. `executionsApi.reRun`,
    `workflowsApi.execute` 서버 측 핸들러(`resolveTriggerParameters` 등)는 마스킹 마커
    리터럴(`'***'`, `[REDACTED]`)인지 여부를 검증하지 않으므로, DOM 이벤트를 우회해 핸들러를
    직접 호출하거나(devtools console) UI 를 거치지 않고 API 를 직접 호출하면(curl 등, 정상 인증된
    사용자) 이 PR 이 막으려던 왕복 오염(마스킹된 `'***'` 가 새 실행의 실제 입력으로 저장됨)이
    그대로 재현된다.
  - 판단: **기밀성 침해는 아니다** — 이 값은 이미 서버가 자격증명으로 판별해 지운 값이라
    노출되는 정보가 없고, 영향은 "새 실행에 리터럴 마스킹 문자열이 저장된다"는 데이터 무결성
    문제로 국한된다. `handleSubmit`/`handleRunWithInput` 안에서 한 줄
    (`if (blockedByMaskedInput) return;` / `if (jsonError != null) return;`) 재확인을 추가하면
    "버튼 disabled 우회" 클래스는 막히지만, curl 등 UI-우회 경로는 서버측 검증 없이는 근본적으로
    막히지 않는다 — 이 갭은 이번 PR 이 새로 만든 것이 아니라 §R17 이 처음부터 "UI 정상 흐름
    방어" 로 범위를 명시한 기존 defer 결정이며, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    에 별도 항목(`inputOverride` 서버측 마커 리터럴 거부, `14_44_08` W6)으로 이미 등재돼 있다.
    독립적으로 도달한 결론이 직전 라운드 security 리뷰(INFO)와 일치한다.
  - 제안: 조치 불요(이번 PR 스코프 밖, 트래커 등재됨). defense-in-depth 를 원하면 두 핸들러
    안에 즉시 return 가드를 추가하고, 서버 측에서는 `inputOverride`/`parameterValues` 값이
    `MASKED_MARKERS` 리터럴과 정확히 일치할 때 `INVALID_INPUT` 을 반환하는 얕은 체크를 트래커
    항목대로 검토.

- **[INFO]** `hasMaskedMarkerLeaf` 재귀 순회에 깊이 상한이 없음 — backend 대응 함수는 있음
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:64` (`hasMaskedMarkerLeaf`)
  - 상세: backend 의 동급 재귀 마스커는 `MAX_REDACT_DEPTH = 10`
    (`codebase/backend/src/shared/utils/sanitize-error-message.ts`)으로 스택 오버플로를 명시적으로
    방어하는데, 이 프런트 미러는 깊이 제한 없이 재귀한다. 다만 이 함수가 순회하는 데이터는 이미
    backend 의 깊이-제한 마스커를 통과해 응답으로 내려온 `Execution.inputData`/`formConfig`
    이므로 서버가 만드는 구조 자체는 유계이고, 순회는 사용자 자신의 브라우저 탭에서만 실행돼
    영향 범위가 자기 자신으로 국한된다(서버 자원 소모 없음). 실질 위험은 낮다.
  - 제안: 조치 불요에 가깝다. 방어적 일관성을 원하면 backend 와 동일한 `MAX_REDACT_DEPTH` 상수를
    프런트에도 미러해 깊이 초과 시 조기 반환(보수적으로 `true` 반환 — 미탐보다 오탐이 안전한
    방향과 일치)하도록 보강할 수 있다.

## 요약

이 changeset 의 핵심 보안 성격은 egress 마스킹 카브아웃 폐지와 그 카브아웃이 열려 있는 동안
위험했던 "마스킹 값이 재제출돼 새 실행의 실제 입력이 되는" 왕복 오염을 막는 방어 가드다.
backend 세 응답 표면(`toResponseExecution`/`toExecutionDto`/`stop`)이 `Execution.inputData` 를
`NodeExecution.inputData` 와 동일 규칙으로 마스킹하도록 정확히 전환됐고, 대응 캐너리 테스트가
방향을 올바르게 고정한다. frontend 는 직전 두 라운드가 지적한 CRITICAL(object/array leaf 우회)과
WARNING(값-기반/터치-기반 각각의 단독 판정 우회)을 세 소비처 전부에서 일관되게 재조치했다 —
새로운 하드코딩 시크릿·인젝션·인증/인가 우회·평문 전송·안전하지 않은 암호화는 발견되지 않았다.
유일한 잔여 관찰은 두 건 모두 INFO 다: (1) 마스킹-마커 재제출 차단이 클라이언트 UI 레벨에서만
강제되고 서버측 재검증이 없다는 점(기밀성 영향 없음, 이미 별도 트래커 항목으로 등재된 기존
defer 결정과 일치), (2) 프런트 마커 순회 함수가 backend 와 달리 재귀 깊이 상한이 없다는 점(자기
탭 한정, 서버 자원과 무관). 둘 다 이번 PR 을 막을 사안이 아니다.

## 위험도

NONE
