# Cross-Spec 일관성 검토 — spec-draft-cross-audit-doc-batch (재검증)

검토 대상: `plan/in-progress/spec-draft-cross-audit-doc-batch.md`
검토 초점: 직전 라운드(19_19_53) WARNING — "변경 4 가 위임하는 SoT(`3-execution.md §10.6.1`) 자체가 stale (Meta/Port/Status/References 탭 누락)" 이 이번 draft 수정(변경 4a 신설 + `spec_impact` 에 `3-execution.md` 추가)으로 해소됐는지.

## 발견사항

- **[INFO]** 위임 체인은 정합하나, 동일 문서 내 `EH-DETAIL-03` 요구사항 ID 테이블은 갱신 대상에서 빠짐
  - target 위치: 변경 4b (`### 변경 4b — spec/2-navigation/14-execution-history.md §3.3 노드 결과 패널`)
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` 라인 54 `EH-DETAIL-03` (실행 상세 페이지 요구사항 ID 테이블) — "노드 상세 서브 탭: Preview / Input / Output / Config / Error. AI 노드는 LLM Usage 탭 추가. AI Multi Turn … Response / Request / LLM Usage 구성으로 전환" 이라고 §3.3(라인 268)과 **동일하게 불완전한 탭 열거**를 반복한다.
  - 상세: 변경 4b 는 §3.3 본문 서술만 §10.6.1 로 위임하는 참조 문구를 추가하도록 지시하고, 같은 문서의 `EH-DETAIL-03` 요구사항 ID 행은 언급하지 않는다. 결과적으로 §3.3 은 위임되어 정합해지지만, `EH-DETAIL-03` 은 여전히 Meta/Port/Status/References 를 열거하지 않는 stale 텍스트로 남는다 — 같은 문서 안에 "위임된 최신 서술"과 "구식 요구사항 ID 서술"이 공존하게 된다. CRITICAL 급 모순(요구사항 ID 자체의 의미 충돌)은 아니며, `EH-DETAIL-03` 이 명시적으로 "Config/Error 까지만" 이라고 닫힌 목록을 주장하는 것도 아니라서(추가 탭 존재를 부정하지 않음) 실질적 충돌보다는 표현 갱신 누락에 가깝다.
  - 제안: 변경 4b 범위에 `EH-DETAIL-03` 행도 포함 — 예: "AI 노드는 LLM Usage 탭 추가(그 외 조건부 탭은 §10.6.1 SoT 참조)" 로 짧게 정정하거나, 최소한 이번 라운드에서는 후속 InfoO로 남겨도 무방(차단 사유 아님).

- **[INFO]** 변경 4a 의 "Port" 탭 설명 문구(`port selector 존재 시`)가 실제 UI 성격과 약간 어긋남
  - target 위치: 변경 4a, "Port(port selector 존재 시)" 표현
  - 충돌 대상: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:269` — `hasPort = !messageLevel && unwrapped.port != null`
  - 상세: 코드상 `Port` 탭은 `NodeHandlerOutput.port` 원시값(`string | string[]`, `spec/conventions/node-output.md` Principle 5)을 존재 시 노출하는 디버그/열람용 탭이며, 사용자가 무언가를 "선택"하는 selector UI 가 아니다(같은 파일의 "Call selector" 와는 다른 개념). draft 의 "selector" 라는 단어가 실제 spec 본문 작성 시 그대로 옮겨지면 Call selector 와 혼동될 여지가 있다.
  - 제안: 실제 spec 본문 작성 시 "Port — 노드가 `port` 값을 반환했을 때 그 값을 표시" 정도로 표현하고 "selector" 단어는 피할 것. draft 자체 문구는 방향(조건: `port` 존재)이 코드와 일치하므로 changed 방향은 유지.

## 재검증 결과 요약 (직전 WARNING 대비)

직전 WARNING 의 핵심 지적 — "위임 대상 SoT(§10.6.1) 자체가 Meta/Port/Status/References 미열거 상태이고, `spec_impact` 에 `3-execution.md` 가 없어 이번 배치에서 갱신되지 않는다" — 는 이번 draft 수정으로 해소됐다.

- `spec_impact` 리스트(라인 32)에 `spec/3-workflow-editor/3-execution.md` 추가 확인.
- 변경 4a 가 신설되어 §10.6.1 탭 표(실제 라인 495-504, draft 표현 "라인 502 근처"는 대략 일치) 자체에 Meta/Port/Status/References 4탭을 조건부 노출로 직접 추가하도록 지시 — SoT 를 실제로 갱신.
- 변경 4b 는 그 갱신된 SoT 로 위임하는 참조 문구만 추가 — 위임 체인(§3.3 → §10.6.1) 자체는 이제 방향이 맞다(§10.6.1 이 먼저 갱신되고, §3.3 이 그것을 참조).
- 4탭 조건은 코드(`result-detail.tsx:255-271`)와 대조 시 정확: `hasMeta`(`!messageLevel && meta 존재 && 비어있지 않음`) / `hasPort`(`!messageLevel && port != null`) / `hasStatus`(`!messageLevel && status != null`) / `hasReferences`(`aiNode && aiMetadata 존재 && (ragSources 또는 ragDiagnostics.attempted, 메시지 레벨은 assistant 선택 시로 한정)`) — draft 의 "관찰성 meta 존재 시"/"status directive 존재 시"/"AI 노드 KB 시도 시" 서술과 실질적으로 부합한다. 4필드(`meta`/`port`/`status`) 자체도 `spec/conventions/node-output.md` Principle 0/2/4/5 의 `NodeHandlerOutput` 5필드 정의와 정확히 대응해 다른 convention 과의 충돌도 없다.
- 부가 확인: PR #817(`4fd6fa4df`) 커밋 메시지는 당시 "spec 변경 불요(EH-DETAIL-03·§3.3/§3.4 이미 ✅)" 라고 판단했으나, 실제로 그 커밋은 `spec/` 파일을 전혀 건드리지 않았고 §10.6.1 에는 4탭이 여전히 없다 — 이는 draft 의 "PR #817 파생 spec-doc 부채" 진단이 옳았다는 교차 증거이며, 이번 재검증에서 새로운 모순은 아니다.

남은 것은 CRITICAL/WARNING 이 아닌 INFO 2건(EH-DETAIL-03 표 갱신 누락, "port selector" 표현 정정)뿐이며 둘 다 위임 체인의 근본 정합성을 해치지 않는다.

## 요약

직전 라운드 WARNING(SoT stale 위임)은 draft 의 변경 4a 신설 + `spec_impact` 확장으로 실질적으로 해소됐다. §3.3 → §10.6.1 위임 체인은 이제 갱신 순서(§10.6.1 선-갱신 → §3.3 참조)가 올바르고, 추가되는 4탭(Meta/Port/Status/References)의 조건은 `result-detail.tsx:255-271` 코드 및 `spec/conventions/node-output.md` 의 `NodeHandlerOutput` 필드 정의와 정확히 일치한다. 남은 간극은 같은 문서 내 `EH-DETAIL-03` 요구사항 ID 테이블이 여전히 구식 탭 목록을 반복하는 점과, "port selector" 라는 draft 자체 표현이 실제 UI 성격(선택 UI 아닌 값 표시)과 약간 어긋나는 점으로, 둘 다 표현 수준의 INFO 이며 채택을 막을 사유가 아니다.

## 위험도

LOW
