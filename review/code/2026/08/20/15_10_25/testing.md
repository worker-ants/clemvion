STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard (15_10_25)

## 검토 방법

프롬프트가 크기 제한으로 다수 파일 diff 를 생략했으므로, `git diff origin/main...HEAD` 로
`codebase/**` 실제 diff 를 직접 열람했다. 이번 changeset 은 이미 두 차례 코드 리뷰 라운드
(`14_08_45` CRITICAL 2 + WARNING 7, `14_44_08` WARNING 8)를 거쳐 fix 가 반영된 상태다 — 본
라운드는 그 fix 가 실제로 반영됐는지와 신규 결함 유무를 재검증하는 성격으로 판단했다.

검증을 위해 다음을 직접 실행했다:
- `vitest run`(frontend, 변경 4개 테스트 파일): **84 passed**
- `jest`(backend, `executions.service.spec.ts` + `background-runs.service.spec.ts`): **71 passed**
- **뮤테이션 재현**: `rerun-modal.tsx` 의 `blockedByMaskedInput` 판정에서
  `hasMaskedMarkerLeaf(paramValues[k])` 절을 제거해(터치 여부만 보도록) 되돌렸더니, 신규 캐너리
  `[캐너리] 건드린 뒤 값이 다시 마커면 계속 막는다` **정확히 그 테스트만** RED 로 잡혔다(다른 26개는
  그대로 GREEN) — `RESOLUTION.md`(`14_44_08` W2)의 재검증 주장을 재현 확인했다. 파일은 원상 복구했고
  `git diff` 로 잔여 변경 없음을 확인했다.

## 발견사항

- **[INFO]** Re-run 모달을 같은 인스턴스에서 다른 실행으로 재사용하는 경로(모달이 열린 채로 `original`
  prop 만 바뀌는 경우)에 대한 상태 리셋 테스트가 없다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:234-242` (`useEffect(..., [open, originalParameters])` — `touchedMaskedKeys`/`paramValues` 리셋), 대응 테스트 `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:537` (`describe("ReRunModal — 마스킹 마커 왕복 차단")`)
  - 상세: 신규 8개 테스트는 전부 매번 새로 `renderModal(...)` 을 호출해 마운트하는 방식이라, "모달이 열린 채로 다른 실행으로 전환"되는 경로는 어느 테스트도 행사하지 않는다. 리셋은 `open` 이 `true` 로 바뀌는 시점에만 실행되므로(`useEffect` 의존성이 `[open, originalParameters]`), 만약 호출부가 `open` 을 유지한 채 `original` 만 교체하는 사용 패턴이 생기면 `touchedMaskedKeys`(이번 PR 이 새로 추가한 state)가 이전 실행의 터치 기록을 들고 새 실행의 `maskedKeys` 판정에 섞여 들어갈 수 있다. 실제 호출부(실행 히스토리 목록)가 항상 모달을 닫았다 다시 여는 방식이라면 실질 위험은 낮지만, 이 가정 자체를 고정하는 테스트는 없다.
  - 제안: `rerender` 로 같은 모달 인스턴스에 `open=true` 를 유지한 채 `original` 만 바꾸는 케이스, 혹은 최소한 "닫혔다 다시 열림" 시나리오(`open: false → true`, 다른 `original`)에서 `touchedMaskedKeys` 가 초기화되고 새 실행의 마스킹 키만 반영됨을 단언하는 테스트 1개를 추가하면 이 가정이 회귀에도 고정된다.

- **[INFO]** `Execution.inputData` egress 마스킹 반전에 대한 e2e(HTTP 왕복) 수준의 직접 검증이 없다 — unit 레벨(`ExecutionsService` 메서드 직접 호출)에만 있다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1109-1424`(단위 테스트, repository mock) 대비 `codebase/backend/test/*.e2e-spec.ts`(실제 Nest 앱 + supertest)
  - 상세: `re-run.e2e-spec.ts`(`170`행 부근, `B. re-run (inputOverride, useOriginalInput=false)`)는 재실행 후 `inputData` 가 manual-trigger 형태로 재구성되는지는 검증하지만 자격증명 패턴 문자열(`sk-live-...`, `postgres://user:pass@host` 류)을 입력값으로 쓰지 않아 새 마스킹 경로를 행사하지 않는다. `webhook-trigger.e2e-spec.ts` 의 마스킹 단언(`112`행, `A2`)은 **ingestion 시점** `[REDACTED]` 헤더 마스킹(다른 계층, `12-webhook §5.3`)이지 이번 PR 이 새로 건 **egress 값-패턴** 마스킹(`redactStoredDataForResponse`)이 아니다. `GET /executions/:id` 실 응답에서 자유 텍스트 자격증명이 실제로 `***` 로 가려져 나가는지를 확인하는 e2e 는 이번 diff 범위에 없다.
  - 참고: `outputData`/`error` 의 동일한 egress 마스킹(선행 PR #1179/#1180)도 e2e 커버리지가 없는 것으로 보여, 이번 PR 이 새로 만든 격차라기보다 이 저장소가 이 계층 전체에서 지속해 온 패턴이다 — unit 레벨 재현이 실제 서비스 메서드를 직접 호출해 mock 아래 계층(레포지토리)만 대체하므로 실질 위험은 낮다고 판단해 WARNING 이 아닌 INFO 로 남긴다.
  - 제안: (선택) 기존 `re-run.e2e-spec.ts` 케이스 B 의 원본 실행 `inputData` 에 자격증명 패턴 문자열을 하나 심어, 재실행 대상이 아니라 "원본 실행 자체를 조회했을 때" 응답이 마스킹되는지를 확인하는 e2e 어서션을 추가하면 unit↔e2e 갭이 닫힌다.

- **[INFO]** 클라이언트 측 제출 함수(`handleSubmit`/`handleRunWithInput`)에 버튼 `disabled` 외의 내부 가드가 없고, 이를 우회하는 경로에 대한 테스트도 없다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:351`(`handleSubmit`, `blockedByMaskedInput` 미참조) / `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:290`(`handleRunWithInput`, `jsonError` 미참조) — 둘 다 버튼의 `disabled={... || blockedByMaskedInput}` / `disabled={isRunning || jsonError != null}` 로만 막힌다
  - 상세: RTL 의 `fireEvent.click` 은 `disabled` 버튼에서 자연히 핸들러를 트리거하지 않으므로 현재 테스트 스위트는 이 경로를 문제없이 통과하지만, 이는 "가드가 있다"를 증명하는 테스트가 아니라 "disabled 버튼 클릭은 원래 아무 일도 안 한다"는 브라우저 기본 동작을 재확인하는 것에 가깝다. 두 함수 자체는 호출되면 마스킹 여부와 무관하게 그대로 제출한다. 이미 `review/code/2026/08/20/14_44_08/security.md` 가 이 갭을 "클라이언트 단 강제, 서버 재검증 없음" INFO 로 판정했고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커(`14_44_08` W6)에 defer 로 등재돼 있어 신규 지적은 아니다 — 테스트 관점에서만 보면, 이 defer 결정이 실제로 "UI 우회 시 그대로 통과한다"는 동작과 일치하는지를 직접 확인하는 테스트(예: `blockedByMaskedInput=true` 상태에서 `handleSubmit()` 을 직접 호출해 API 가 호출됨을 확인)가 없어, 이 defer 전제 자체가 코드 변경으로 조용히 깨져도(예: 누군가 실수로 disabled 로직만 남기고 API 콜을 다른 진입점에 추가) 캐치되지 않는다.
  - 제안: 조치 불요에 가깝다(트래커에 이미 등재, 설계 결정). 다만 이 전제를 명시적으로 고정하고 싶다면 "차단 상태에서 `handleSubmit`/`handleRunWithInput` 을 직접 호출하면 그래도 API 가 호출된다(=UI 레벨 방어일 뿐)"를 캐너리로 남겨, 이후 누군가 "이미 막혀 있으니 서버 가드는 불필요"라고 오판하지 않도록 할 수 있다.

## 긍정적으로 확인된 점

- `rerun-modal.test.tsx`/`editor-toolbar-run-input.test.tsx`/`masked-markers.test.ts` 신규 테스트는 전부 **양방향**(마커 차단 + 비-마커 통과)과 **경계**(정확 일치 vs 부분 포함 오탐 방지, `a***b`/`***bold***` 캐너리)를 동시에 고정한다 — 두 차례 리뷰가 CRITICAL 로 잡았던 "한쪽만 단언해 반대 방향 회귀를 못 잡는" 패턴이 없다.
- 에디터 히스토리 로드 테스트는 textarea 직접 주입이 아니라 `Load from History` 버튼 클릭 → `getById` → `JSON.stringify` → `setJsonInput` 실제 유입 경로로 재현한다(`14_08_45` W5 반영 확인, `editor-toolbar-run-input.test.tsx` "실제 유입 경로" 테스트).
- object/array leaf 마커(직전 CRITICAL 회귀 클래스)와 마스킹 키 2개 이상 동시 존재(`some`→`every` 뮤테이션을 가르는 케이스), 재-마스킹 후 재차단 등 이 시리즈가 실제로 겪은 회귀 클래스마다 전용 캐너리가 있다 — 직접 뮤테이션으로 그중 하나(`[캐너리] 건드린 뒤 값이 다시 마커면 계속 막는다`)를 재현해 실효성을 확인했다.
- backend `executions.service.spec.ts` 의 `①②⑤⑥-b⑧⑧-b` 캐너리가 `Execution` 레벨·노드 레벨 양쪽에서 마스킹 방향을 전수 고정하고 있고, 실행 결과 71/71 통과.
- `masked-markers.ts` 공용 유틸의 단독 단위 테스트(`masked-markers.test.ts`)가 신설돼, 종전엔 컴포넌트 렌더를 통한 간접 검증만 있던 non-string 입력 경로(`123, null, undefined, true, {}, []`)를 직접 행사한다 — `14_08_45` INFO-6 반영.

## 요약

이번 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 보안·데이터 무결성 결정을
세 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 걸쳐 구현하면서, 이미 두 차례의 코드
리뷰 라운드(CRITICAL 2건 포함)를 거쳐 지적된 결함 클래스마다 전용 회귀 테스트를 추가했다. 직접
실행한 결과(frontend 84/84, backend 71/71 전부 통과)와 뮤테이션 재현(판정 조건 하나를 제거하자
정확히 그 조건을 겨눈 캐너리만 RED)으로 테스트의 실효성을 재확인했다. 남은 갭은 전부 INFO
수준이다 — 모달 재사용 시 상태 리셋의 명시적 테스트 부재, unit 레벨에만 있고 e2e 왕복 검증이 없는
egress 마스킹(선행 PR 들과 동일한 저장소 전체 패턴), 그리고 이미 트래커에 defer 로 등재된 클라이언트
전용 강제(서버 재검증 없음)의 전제를 고정하는 테스트 부재다. 셋 다 이번 PR 을 막을 사안이 아니다.

## 위험도

LOW
