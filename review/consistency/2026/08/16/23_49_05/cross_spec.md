# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 발견사항

- **[CRITICAL] EIA §R17 의 `inputData`/`outputData` egress 마스킹 확대가 Re-run 모달·Mock Input "Load from History" 의 재제출(read-then-resubmit) 경로를 오염시킨다**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "적용 범위는 총칭이 아니라 열거다" 불릿 (표면 ①`findById` ②`getChain` ③`stop` ④`toExecutionDto`(목록) ⑤`nodeExecutions[]` ⑥`BackgroundRunsService.toNodeExecutionDto`) — 이번 diff 로 `error` 단일 컬럼에서 `inputData`/`outputData` 두 컬럼까지 넓어짐. 구현: `codebase/backend/src/modules/executions/executions.service.ts` (`toResponseExecution`/`toExecutionDto`), `codebase/backend/src/shared/utils/redact-stored-error.ts` (`redactStoredDataForResponse`).
  - 충돌 대상:
    - `spec/5-system/13-replay-rerun.md` §10.2 "Re-run 모달" — "입력 데이터 폼 | 원본의 `inputData.parameters`" 로 명시, 기본 상태는 "원본 입력 그대로 사용" 토글 **OFF**(편집 가능)이고 Rationale "왜 B2(원본 미리보기 + 편집)가 기본인가"는 "디버그·재현은 입력 미세 조정으로 결과 차이를 비교하는 흐름"을 전제로 한다.
    - `spec/3-workflow-editor/3-execution.md` §2.2 "히스토리 로드" — `GET /executions/workflow/:id`(=마스킹 대상 ④ `toExecutionDto`) 로 받은 이전 실행의 `inputData` 를 Mock Input textarea 에 그대로 적재해 "Run with Input" 으로 재실행.
  - 상세: 코드로 실측한 인과 사슬은 다음과 같다.
    1. `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/[executionId]/page.tsx:465-472` 가 `ReRunModal` 에 `original.inputData = execution.inputData` (즉 `GET /api/executions/:id` → `findById` → 마스킹된 값)를 그대로 넘긴다.
    2. `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `extractParameters(original.inputData)` 가 `originalParameters` 를 뽑고, `paramValues` state 의 초기값으로 쓰인다(:177-184). 기본 `useOriginalInput = false`(:181, spec §10.2 기본값 OFF 와 일치).
    3. `handleSubmit`(:279-286) 은 `useOriginalInput=false` 이면 `inputOverride: paramValues` 를 **그대로** `POST /executions/:id/re-run` 에 보낸다.
    4. 백엔드 `executions.service.ts` 의 `reRun`(:470-494) 은 `useOriginal=false` 분기에서 클라이언트가 보낸 `dto.inputOverride` 를 `resolveTriggerParameters` 로 **검증만** 하고 그대로 새 Execution 의 input 으로 쓴다. (반대로 `useOriginal=true` 분기는 `original.inputData`(:473) — 이건 **raw entity 직접 조회**(`this.executionRepository...`, :418)라 마스킹을 타지 않는다 — 이 경로는 안전하다.)
    5. 즉 사용자가 모달을 열고 마스킹된 필드(예: 워크플로 작성자가 Manual Trigger 파라미터로 정의한 `password`/`apiKey`/`token`/`secret`/`authorization`/`cookie` 등 `CREDENTIAL_KEY_PATTERN`(`codebase/backend/src/shared/utils/sanitize-error-message.ts:84-85`) 일치 키, 또는 `Bearer …`/JWT/자격증명 포함 URI 같은 값-패턴 매치 필드)를 **건드리지 않고 "재실행"을 누르면**, 문자열 리터럴 `"***"` 가 그대로 새 Execution 의 실제 입력값으로 제출된다. 이는 표시상의 "가려짐"이 아니라 **재실행된 워크플로의 실제 동작을 바꾸는 값 오염**이다.
    6. 같은 인과가 Mock Input "Load from History"(`3-execution.md` §2.2, `editor-toolbar.tsx`)에도 적용된다 — `GET /executions/workflow/:id` 목록 응답의 `inputData` 가 이제 마스킹돼 있고, 이를 textarea 에 적재한 뒤 "Run" 하면 같은 방식으로 `***` 가 실제 입력으로 흘러간다.
    7. `plan/in-progress/eia-fanout-and-internal-data-masking.md` §"부작용 — 디버깅 가시성이 줄어드는 자리 (수용된 trade-off)" 는 이 확장을 "실행 상세 API 의 `inputData`/`outputData`: 원문 → 마스킹, **디버깅 가시성 축소**"로만 프레이밍하고 수용했다 — 즉 **"덜 보임"** 문제로만 분석했지, "그 마스킹된 값이 Re-run/Mock-Input 재제출 경로를 통해 **실제 실행 입력으로 되먹임**된다"는 시나리오는 어느 spec 문서에도 언급·검토되지 않았다. `13-replay-rerun.md`/`3-execution.md` 쪽에도 이번 diff 로 인한 캐비엇이 추가되지 않았다.
  - 제안: 다음 중 하나를 명시적으로 결정하고 두 spec 을 함께 갱신해야 한다.
    (a) Re-run 모달·Mock Input 히스토리 로드가 쓰는 프리필 소스를 마스킹 우회 전용 내부 엔드포인트/필드로 분리한다(예: 편집 대상 프리필은 `findById` 대신 별도 unmask 경로 사용 — 단, 이는 §R17 의 "workspace 멤버 전원이 열람 가능"이라는 마스킹 근거와 충돌하지 않도록 권한 축을 재검토해야 함).
    (b) 프론트가 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)를 감지해 해당 필드를 read-only 로 강제하거나 제출을 막고 경고를 띄운다(백엔드가 마스킹 마커 상수 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 를 이미 export 하므로 프론트에서 재사용 가능).
    (c) 최소한 `13-replay-rerun.md` §10.2 와 `3-execution.md` §2.2 에 "마스킹된 필드는 재입력이 필요하다"는 캐비엇과, 이 두 경로가 §R17 마스킹의 알려진 잔여 리스크임을 명문화한다.
    어느 쪽을 택하든 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 의 "수용된 trade-off" 서술도 이 되먹임 시나리오를 반영해 갱신해야 한다.

- **[INFO] `execution.node.*` WS 이벤트 필드명 `nodeName`→`nodeLabel` 정정은 다른 spec 영역과 이미 정합했다 (참고용, 조치 불요)**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 표 (`nodeName` → `nodeLabel` 정정 + "2026-08-16 정정 완료" note)
  - 충돌 대상: 없음 — `spec/3-workflow-editor/3-execution.md:658` ("`nodeType`, `nodeLabel`, `output` 필드가 포함된다")과 `spec/conventions/conversation-thread.md` 전반이 이미 `nodeLabel` 을 전제하고 있었다.
  - 상세: 이번 정정은 기존에 존재하던 문서 간 drift(6-websocket-protocol.md 만 `nodeName` 으로 낡아 있던 상태)를 해소하는 방향이라 새로운 충돌을 만들지 않는다. `spec/5-system/3-error-handling.md:249` 의 `nodeName` 은 별개 문맥(§2.2 일반 REST 에러 응답 예시, WS 이벤트 표와 무관)이라 이번 변경의 영향 범위 밖이다.
  - 제안: 조치 불요. (참고: `3-error-handling.md` §2.2 예시가 실제 구현과 정합한지는 이번 diff 스코프 밖이라 별도 확인 권장 — 본 리뷰의 판정에는 영향 없음.)

## 요약

이번 diff 는 `Execution.error`/`inputData`/`outputData` egress 마스킹을 WS emit·내부 REST 읽기 6개 표면으로 정합성 있게 확장하고, 각 코드 변경마다 spec 캐비엇(§R17, WS §4.1)을 촘촘히 동반 갱신해 이 저장소가 반복 겪어온 "자매 표면 누락" 패턴 자체는 잘 방어했다. 다만 이 확장이 `inputData`/`outputData` 라는 **"보안 관측"과 "기능적 재사용"을 겸하는 컬럼**까지 덮으면서, `13-replay-rerun.md`(Re-run 모달)와 `3-workflow-editor/3-execution.md`(Mock Input 히스토리 로드)가 이미 공식화해 둔 "동일 값을 읽어 편집 후 재제출"이라는 UI 계약과 정면으로 충돌한다 — 코드 추적으로 확인한 바, 마스킹된 자리를 사용자가 건드리지 않고 제출하면 리터럴 `***` 가 실제 재실행 입력값으로 들어간다. 이 되먹임 경로는 새로 작성된 계획 문서의 "수용된 trade-off" 분석(가시성 축소로만 프레이밍)에도, 대상 두 spec 문서에도 반영돼 있지 않아 명시적 결정이 필요하다.

## 위험도

HIGH
