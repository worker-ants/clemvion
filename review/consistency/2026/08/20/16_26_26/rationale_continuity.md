### 발견사항

없음. 본 브랜치는 `spec/5-system/14-external-interaction-api.md` `## Rationale` §R17 이 명시적으로 등재해 둔 **미결(잔여 ②) 항목을 조건 충족 후 정식으로 닫는** 변경이며, 검토한 4 개 관점 모두에서 위반을 찾지 못했다.

- **기각된 대안의 재도입 여부**: 해당 없음. `Execution.inputData` egress 마스킹 카브아웃은 과거 R17 이 "기각된 대안"으로 못박은 것이 아니라, **"닫는 조건"(프런트 마커 가드)이 충족되면 뒤집기로 예정된 조건부 결정**이었다 — R17 원문: `"닫는 조건: 프런트가 마스킹 마커를 감지해 해당 필드 재입력을 강제하는 가드가 선행되어야 한다. 그 가드의 첫 조각이 2026-08-17 에 섰다"`. 이번 target 은 그 조건(Re-run 모달 + 에디터 히스토리 로드의 마커 가드)을 실제로 구현한 뒤 카브아웃을 닫았으므로 "이유 명시 없는 재도입"이 아니다.
- **합의된 원칙 위반 여부**: 없음. R17 이 반복 강조하는 "egress-only, DB 는 원문 보존" 원칙, "판단 기준 축(외부 노출 여부 / 미러 유지비)" 원칙 모두 새 서술에서도 유지되며, 축 하나(round-trip 카브아웃 축)를 폐기한 것도 근거를 명시했다(§R17 "그 축은 폐기됐다" 문단 — 유지비가 6개 spec 파일 SoT 인용으로 가드 비용을 넘었다는 실측 근거).
- **결정의 무근거 번복 여부**: 없음 — 오히려 모범적으로 새 Rationale 를 동반했다. `spec/5-system/14-external-interaction-api.md` §R17(잔여 ② 블록), `spec/5-system/13-replay-rerun.md` §10.2, `spec/5-system/6-websocket-protocol.md` §4.1, `spec/5-system/12-webhook.md` §5.3, `spec/1-data-model.md` §2.13/§2.14, `spec/4-nodes/1-logic/12-background.md` §8.2, `spec/3-workflow-editor/3-execution.md` §2.2 — SoT 로 인용되던 **7개 문서 전체**에서 "2026-08-20 이전에는 카브아웃이었다 / 그 조건이 해소돼 전환했다"는 동일한 전환 근거를 일관되게 반영했다. `plan/in-progress/eia-inputdata-marker-guard.md` 는 이 결정의 배경(#1180 되돌림 이력·닫는 조건·앵커 `MASKED_INPUT_DATA_REASON` 전수 삭제 방침)을 상세히 남겼고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 항목도 `[x]` 로 닫히며 해소 근거가 함께 기록됐다.
- **암묵적 가정 충돌 여부**: 없음. 과거 결정이 우려했던 "재제출 왕복 오염"(마스킹 `***` 가 실제 입력이 되는 문제)이라는 invariant 는 여전히 존중된다 — 단지 그 invariant 를 지키는 방식이 "카브아웃"에서 "소비 쪽 마커 가드(프리필 스킵 + 제출 차단)"로 바뀌었을 뿐이다. 코드 레벨에서도 `MASKED_INPUT_DATA_REASON` 앵커가 codebase/spec 전역에서 0건으로 완전히 제거되어(재사용·반전 없음) 낡은 근거 문자열이 새 의미로 오독될 여지도 차단했다. `spec/2-navigation/14-execution-history.md` R-5 등 외부에서 인용하는 원칙("서버 boundary masking parity")과도 충돌 없이 정합적이다.

교차 검증(grep)으로 `카브아웃`·`잔여 ②`·`재제출하므로 마스킹`·`레벨이 가른다` 등 옛 결정을 서술하던 문구가 target diff 밖 다른 spec 문서에 미반영 상태로 남아 있는지 확인했으나, 발견되지 않았다(모두 diff 범위 안에서 함께 갱신됨).

### 요약
target 은 `spec/5-system/14-external-interaction-api.md` §R17 이 스스로 "닫는 조건"까지 명시해 둔 조건부 결정(‘Execution.inputData’ egress 마스킹 카브아웃)을, 그 조건(프런트 마커 가드)을 실제로 구현한 뒤 정식으로 뒤집은 사례다. 이 결정을 SoT 로 인용하던 7개 spec 문서 전부가 동일한 전환 근거("2026-08-20 이전엔 카브아웃 → 마커 가드로 조건 해소")로 함께 갱신됐고, 옛 근거 앵커(`MASKED_INPUT_DATA_REASON`)는 반전 재사용이 아니라 전수 삭제됐으며, plan 문서에 결정 이력(#1180 되돌림 → 이번 작업으로 재봉인)이 명시적으로 남아 있다. 기각된 대안의 무단 재도입, 원칙 위반, 무근거 번복, invariant 우회 어느 관점에서도 문제를 찾지 못했다 — 오히려 "결정 번복 시 새 Rationale 동반" 원칙을 모범적으로 지킨 사례다.

### 위험도
NONE
