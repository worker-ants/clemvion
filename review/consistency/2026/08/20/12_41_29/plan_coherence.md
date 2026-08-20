# Plan 정합성 검토 — spec-draft-inputdata-egress-masking.md

## 발견사항

- **[WARNING] 형제 plan `eia-inputdata-marker-guard.md` 의 `spec_impact`·체크리스트가 target 의 확장된 7파일 스코프를 반영하지 못했다**
  - target 위치: `plan/in-progress/spec-draft-inputdata-egress-masking.md` frontmatter `spec_impact`(L8–15, 7개 파일) 및 "미러 전수" 표(L32–40, #1~#7) — "전수 스캔" 으로 `12-webhook.md`·`6-websocket-protocol.md`·`4-nodes/1-logic/12-background.md` 3개를 새로 추가했다고 명시
  - 관련 plan: `plan/in-progress/eia-inputdata-marker-guard.md` frontmatter `spec_impact`(L8–12, 4개 파일만) 및 "## 범위" 의 `- [ ] **planner 턴**"` 체크리스트 항목(L109–111, `1-data-model.md`·`13-replay-rerun.md`·`3-workflow-editor/3-execution.md` 3개 spec 문서만 명시)
  - 상세: target(planner 턴 산출물)은 impl-prep(`12_08_46`)이 지목한 4개 파일에서 출발해 전수 스캔으로 `12-webhook.md`(§5.3 "유일한 방어" 캐비엇) · `6-websocket-protocol.md`(§4.1 "가르는 축은 레벨") · `4-nodes/1-logic/12-background.md`(§8.2 카브아웃 시제) 3곳을 추가로 찾아 자기 frontmatter 를 7개 파일로 확장했다. 그런데 이 작업을 발주한 형제 plan(같은 worktree, developer 소유) `eia-inputdata-marker-guard.md` 는 여전히 `spec_impact` 4개·"planner 턴" 체크리스트도 3개 spec 문서만 나열한다. target 이 승인·반영된 뒤에도 이 형제 문서를 갱신하지 않으면, 실제로 커밋될 spec diff(7파일)와 developer plan 이 선언한 범위(4파일)가 어긋난 채로 남는다. 이 저장소는 `spec_impact` 를 Gate C 로 강제하고 실제 diff 와의 drift 를 여러 차례 크리티컬로 다뤄 온 이력이 있다(예: `eia-terminal-payload.md` 가 같은 이유로 두 차례 `spec_impact` 를 확장당함).
  - 제안: target 문서 자체를 손댈 필요는 없으나, 이 draft 가 승인되어 spec 에 반영되는 시점(또는 그 직전)에 `eia-inputdata-marker-guard.md` 의 frontmatter `spec_impact` 에 `spec/5-system/12-webhook.md`·`spec/5-system/6-websocket-protocol.md`·`spec/4-nodes/1-logic/12-background.md` 3개를 추가하고, "planner 턴" 체크리스트 항목도 동일하게 갱신할 것.

- **[INFO] target 의 §R17 "미러 전수" 표가 같은 문서 내 "프리필 왕복" 문단(L1567–1578, `14-external-interaction-api.md`)의 결론 문장은 인용만 하고 갱신 대상에서 빠뜨렸다**
  - target 위치: `spec-draft-inputdata-egress-masking.md` 의 "④ §R17 — 잔여 ② 종결" 절(변경 대상으로 1527·1539·1542·1549·1569·1620·1642 행만 명시)
  - 관련 plan: 없음(같은 target 문서·같은 spec 파일 내부 자기정합성 이슈라 plan 코퍼스와의 충돌은 아니며, cross_spec/rationale_continuity 축에 더 가깝다 — 참고용으로만 남긴다)
  - 상세: 현재 spec 의 1567–1578행("프리필 왕복" 블록)은 *"판단 기준: 마스킹 대상이 외부로도 나가는가를 먼저 본다 — 나가면 마커 가드, 안 나가면 카브아웃이 값싸다. **두 사례가 정확히 그 두 갈래다.**"* 라고 적고, `Execution.inputData`(카브아웃)와 폼 `defaultValue`(마커 가드)를 정확히 그 "두 갈래" 의 대응 사례로 든다. target 이 §R17 잔여 ②를 닫으면 `Execution.inputData` 도 마커 가드 쪽으로 넘어가 두 사례가 더 이상 "정확히 두 갈래"로 갈리지 않는다 — 이 문장이 stale 해진다. target 의 인용 목록에 1569행(같은 블록 내부)은 있지만 결론 문장이 있는 1575–1576행은 없다.
  - 제안: §R17 반영 시 이 문단도 "두 사례가 정확히 그 두 갈래다" 를 재작성 대상에 포함할 것(예: "판단 기준은 그대로이나 두 사례 모두 지금은 마커 가드로 수렴한다" 류로 정정). plan-coherence 범위 밖일 수 있어 INFO 로만 남긴다.

## 요약

target 은 `--impl-prep`(`12_08_46`) 이 지목한 결정 번복 우려를 §R17 의 기존 "닫는 조건"(마커 가드 선행)이 실제로 충족됐다는 근거로 정면 대응했고, 4개 문서에서 7개 문서로 미러 범위를 스스로 재실측해 확장한 점, 그리고 spec 이 구현보다 먼저 머지되는 창을 "같은 브랜치/PR 착지" 로 명시 차단한 점 모두 이 저장소의 plan 관행과 정합적이다. 실측 대조 결과 target 이 인용한 "현재 서술" 7곳은 전부 실제 spec 파일 내용과 정확히 일치했다. 유일한 실질 결함은 target 자신이 아니라, 이 작업을 발주한 형제 plan `eia-inputdata-marker-guard.md` 가 target 의 확장된 7파일 스코프를 아직 반영하지 못해 developer 재개 시점에 `spec_impact` drift 를 남긴다는 점이다 — 사소한 문서 갱신으로 해소 가능하다.

## 위험도
LOW
