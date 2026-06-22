# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/3-workflow-editor)

---

### 발견사항

- **[INFO]** `spec/3-workflow-editor/0-canvas.md §12` — Tool Area 섹션이 "재작성 예정(현재 제거됨)"으로 표시되어 있으나, `toolOwnerId` 필드가 §5.2 요청 본문(`4-ai-assistant.md`)에 살아있어 인터페이스 연결이 모호함
  - target 위치: `spec/3-workflow-editor/0-canvas.md §12`, `spec/3-workflow-editor/4-ai-assistant.md §5.2 요청 본문`
  - 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md §12` 박스 ("새 도구 연결 디자인이 결정될 때 갱신한다"), `spec/4-nodes/3-ai/1-ai-agent.md §1` 참조
  - 상세: `0-canvas.md §12` 는 Tool Area 시각·인터랙션 및 `toolNodeIds`/`toolOverrides` 도구 연결 config 필드가 스키마에서 제거됐고 현재 비활성이라고 명시한다. 그런데 `4-ai-assistant.md §5.2 요청 본문`에는 `toolOwnerId?` 필드가 여전히 `currentWorkflow.nodes` 전송 페이로드 스키마에 포함되어 있다. §12 Rationale(폐기 결정) 과의 관계가 불명확하다 — `toolOwnerId` 는 이전 Tool Area 설계의 잔재인지, 향후 새 도구 연결 설계에서 재사용 예정인지 명시가 없다.
  - 제안: `4-ai-assistant.md §5.2` 요청 본문의 `toolOwnerId?` 필드에 "§12 Tool Area 비활성화 상태에서도 현재 canvas node 데이터의 일부로 포함(서버는 무시)" 또는 "새 도구 연결 설계 확정 시 갱신" 등 주석을 추가해 §12 폐기 결정과의 관계를 명시하거나, `4-ai-assistant.md` Rationale 에 `toolOwnerId` 필드 잔류 이유를 기록한다.

- **[INFO]** `spec/3-workflow-editor/0-canvas.md §11.2` — "시각 containment 미사용" 결정과 §11.4 중첩 시각 표현(레벨별 배경 틴트) 간 정합 경고가 spec 본문에 이미 기록되어 있으나, 미구현(Planned)으로 보류된 §11.4 시각 표현 항목들이 §11.2의 "시각 containment 미사용" Rationale과 충돌하는 상태로 정합 재검토 없이 잔류함
  - target 위치: `spec/3-workflow-editor/0-canvas.md §11.4`
  - 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md §11.2` ("시각 containment 미사용" 결정)
  - 상세: §11.4 는 "§11.2 와 정합 주의" 주석을 달고 있다. 이 주석은 현재 spec 본문 내에서 자기 인식하는 충돌이다. 해당 섹션이 Rationale 에 공식 기각 근거 없이 "미구현" 상태로 잔존하면, 구현자가 시각 containment 도입 시 어떤 방향으로 재정의해야 할지 판단 근거가 없다.
  - 제안: §11.4 미구현 항목들(배경 틴트·최대 중첩 깊이 enforcement)에 대해 "시각 containment 도입 결정 시 §11.2 결정을 번복하고 본 항목을 재정의한다"는 조건부 복원 절차를 Rationale 에 한 줄 추가한다. 또는 §11.2 Rationale 에 "컨테이너 시각 박스를 도입할 경우 §11.4 를 재검토 대상으로 지정"을 명시한다.

- **[INFO]** `spec/3-workflow-editor/1-node-common.md §2.6.3` auto-form 이행 완료 목록에 `ai_agent` 포함 — R-3(§text_classifier·information_extractor 이행)과 중복되지 않으나 `ai_agent` 이행 결정 Rationale 가 본 문서에 없음
  - target 위치: `spec/3-workflow-editor/1-node-common.md §2.6.3`
  - 과거 결정 출처: `spec/3-workflow-editor/1-node-common.md ## Rationale` R-3
  - 상세: R-3 는 `text_classifier`·`information_extractor` 의 auto-form 이행 근거를 명시하나, `ai_agent` 의 auto-form 이행 결정은 R-3 본문에 언급 없이 §2.6.3 목록에만 등장한다. `ai_agent` 이행 결정이 별도 Rationale(예: 이전 spec 동기화 작업)에 기록됐는지, 아니면 암묵적으로 적용됐는지 불명확하다.
  - 제안: R-3 또는 별도 R-4 로 `ai_agent` auto-form 이행 결정 근거(언제, 왜 override 에서 auto-form 으로 전환했는지)를 추가한다. 구현 착수 전 확인 필요.

---

### 요약

검토 범위인 `spec/3-workflow-editor` (0-canvas, 1-node-common, 2-edge, 3-execution, 4-ai-assistant) 전반에 걸쳐 명시적으로 기각된 대안의 재도입이나 합의된 invariant 직접 위반은 발견되지 않았다. 발견된 사항은 모두 INFO 등급으로, (1) Tool Area 폐기 결정 이후 `toolOwnerId` 필드가 AI Assistant 요청 본문에 근거 설명 없이 잔류하는 인터페이스 불명확성, (2) 컨테이너 "시각 containment 미사용" 결정과 미구현으로 잔존하는 §11.4 중첩 시각 표현 항목 간 자기 인식 충돌 상태, (3) `ai_agent` auto-form 이행 결정의 Rationale 누락이다. 세 항목 모두 구현을 블록하는 수준이 아니나, 구현자가 `toolOwnerId` 처리 방식 또는 컨테이너 시각화 방향성에 대해 잘못된 가정을 취할 위험이 있으므로 착수 전 해당 Rationale 또는 주석을 보완하는 것을 권장한다.

---

### 위험도

LOW
