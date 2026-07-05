### 발견사항

- **[INFO]** V-13 하향은 과거 audit 권장안을 그대로 이행한 것 — 무근거 번복 아님
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` "V-13 [minor] 캔버스 요약 summaryTemplate — spec 하향"
  - 과거 결정 출처: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-13 항목 (spec 하향 옵션에 "장점: 빠름. 단점: 캔버스 정보 밀도 약속 철회." + "권장: spec 하향(부분) + 코드 위생")
  - 상세: 프롬프트가 언급한 "캔버스 정보 밀도 약속"은 `spec/**` 의 `## Rationale` 섹션에 박힌 합의 원칙이 아니라, 6-10 cross-audit plan 문서의 트레이드오프 서술 문구다. 즉 target 이 기각하는 것은 spec 의 `## Rationale` 결정이 아니라, "요약이 표시되어야 한다"는 §8/§11/§8 본문의 사실 서술(구현되지 않은 약속)이며, 원 audit 자체가 이미 "spec 하향(부분)"을 권장 옵션으로 명시했다. 근거(`getConfigSummary`가 `summaryTemplate` 없으면 렌더 자체를 하지 않음, `text-classifier.schema.ts` 만 필드 보유)도 target 이 직접 코드로 재검증했다. 따라서 이는 기각된 대안의 재도입이 아니라 **이미 승인된 정직화 옵션의 실행**이다.
  - 제안: 없음(현행 유지). 다만 target 의 "근거(재검증)" 문구가 6-10 plan 을 명시적으로 인용하면 연속성 추적이 더 쉬워진다(선택 사항).

- **[WARNING]** 캔버스 요약 하향이 `spec/3-workflow-editor/0-canvas.md §5.3.4` SoT 표와 불일치하게 됨 — 미갱신
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` "변경 1/2/3" (`0-common.md §8`, `1-ai-agent.md §11`, `3-information-extractor.md §8` 하향)
  - 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md` §5.3.4 "노드별 요약 포맷" 표 — "포맷 SoT 는 각 노드 spec 의 `summaryTemplate` 이다" 라고 명시하면서도, 자체 표 안에 `AI Agent | {모델} · {N} tools · {N} KB`, `Info Extractor | {모델} · {N} fields` 를 구현된 사실처럼 재열거하고 있음
  - 상세: `0-canvas.md` 는 각 노드 spec 을 SoT 로 참조 위임하지만 자신도 동일 표를 중복 보유한다. target 이 `0-common.md`/`1-ai-agent.md`/`3-information-extractor.md` 세 곳만 Planned 로 하향하고 `0-canvas.md §5.3.4` 는 spec_impact·변경 목록 어디에도 포함하지 않아, 하향 이후에도 캔버스 문서는 여전히 "구현된 것처럼" 두 행을 보여준다. Rationale 연속성 자체를 침해하진 않지만(하향 결정은 정당), 결정을 뒤집으면서 그 결정이 참조되는 다른 SoT 사본을 갱신하지 않아 문서 간 불일치가 새로 생긴다.
  - 제안: `0-canvas.md §5.3.4` 표의 AI Agent/Info Extractor 행도 동일하게 "(구현 예정 — 요약 미표시)" 로 정정하거나, 최소한 각주로 "§8/§11/§8 Planned 하향 참조" 를 추가. spec_impact 목록에 `spec/3-workflow-editor/0-canvas.md` 추가 검토.

- **[WARNING]** dry-run execution-level 배지 노트가 §9.2 의 "표시용/제어용 역할 분리" 문면과 정면 배치되는데 새 Rationale 갱신이 없음
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` "변경 6 — `spec/5-system/13-replay-rerun.md §7.4`"
  - 과거 결정 출처: `spec/5-system/13-replay-rerun.md §9.2` "dry-run 표기 — NodeExecution `_dryRun` + Execution `dry_run` 컬럼" — "즉 NodeExecution `_dryRun` 은 **결과 표시용(UI 식별)**, Execution `dry_run` 은 **실행 제어용(엔진 주입·복원)**으로 역할이 분리된다."
  - 상세: §9.2 는 두 컬럼의 책임을 "표시(UI)" vs "제어(엔진)" 로 이분법적으로 명문화했다. target 의 변경 6 은 §7.4(dry-run 결과 표시)에 "실행 상세 페이지는 `Execution.dry_run`(§9.2, execution-level)도 반영해 배지를 표시" 라는 노트를 추가하는데, 이는 실행 제어용으로 분리 서술된 `dry_run` 컬럼을 표시(UI) 목적에도 사용한다는 의미라 §9.2 문면과 글자 그대로는 충돌한다. 다만 실제 코드(`result-detail.tsx:829-838` `executionDryRun` prop, `page.tsx:402/438/457` `execution.dryRun` 소비, `execution-detail-waiting.test.tsx:313` 회귀 테스트 주석 "dry-run 실행의 비-effect 노드도 배지 표시")는 이미 이 동작을 구현·테스트하고 있어, target 의 노트는 새 설계 도입이 아니라 **기존 구현을 spec 에 반영**하는 것으로 보인다. 문제는 target 이 §7.4 에만 노트를 추가하고 §9.2 본문의 "역할 분리" 서술 자체는 갱신하지 않아, 두 섹션이 "표시는 NodeExecution 마커만" vs "표시는 Execution 컬럼도 포함" 으로 상충된 채 병존하게 된다.
  - 제안: §9.2 의 "역할 분리" 문장을 "NodeExecution `_dryRun` 은 노드별 결과 표시, Execution `dry_run` 은 실행 제어(엔진 주입·복원) **및 비-effect 노드의 execution-level 배지 표시**를 겸한다" 정도로 함께 갱신하거나, 최소 §9.2 말미에 "§7.4 참조 — execution-level 배지 노출은 §7.4 로 위임" 각주 추가. 두 섹션이 같은 문서 안에서 서로 다른 진술을 하는 상태로 남기지 않을 것.

- **[INFO]** V-05 masking Rationale 신설은 기존 결정과 무충돌, 신규 근거 정확
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` "변경 5 — `14-execution-history.md ## Rationale`"
  - 과거 결정 출처: 없음 (신규 Rationale)
  - 상세: `14-execution-history.md` 의 기존 R-1~R-4 는 role-gating 이나 Config 탭 노출 정책을 다룬 적이 없다. target 이 인용하는 `handler-output.adapter.ts` 의 `maskSensitiveFields(r.config ?? {})` 도 실제 코드에 존재해(§confirmed) 근거가 정확하다. 새 결정을 뒤집는 것이 아니라 빈 자리를 채우는 것이라 연속성 문제 없음.
  - 제안: 없음.

### 요약
target 문서의 핵심 변경(V-13 캔버스 요약 하향)은 기존 spec 의 `## Rationale` 을 무근거로 뒤집는 것이 아니라, 6-10 cross-audit plan 이 이미 제시한 "spec 하향(부분)" 권장 옵션을 코드 재검증을 거쳐 실행하는 정당한 정직화다 — CRITICAL 급 위반은 없다. 다만 두 가지 정합 공백이 있다: (1) 캔버스 요약 하향이 `spec/3-workflow-editor/0-canvas.md §5.3.4` 의 동일 표 사본까지는 미치지 못해 두 문서가 서로 다른 사실을 말하게 되고, (2) dry-run execution-level 배지 노트(§7.4)가 §9.2 에 이미 명문화된 "표시용/제어용 역할 분리" 문면과 글자 그대로 상충한다 — 실제로는 기존 구현(코드·테스트)을 spec 에 반영하는 것이라 설계 자체의 번복은 아니지만, §9.2 본문을 함께 갱신하지 않아 같은 문서 내에서 두 섹션이 다른 이야기를 하는 상태가 새로 생긴다. V-18 종결·V-05 masking Rationale 신설·V-14 각주 보강은 기존 결정과 충돌 없이 정합하다.

### 위험도
LOW
