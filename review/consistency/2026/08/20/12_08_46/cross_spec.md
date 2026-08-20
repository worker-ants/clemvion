# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md` (impl-prep, `Execution.inputData` egress 마스킹 + 마커 가드)

## 발견사항

- **[CRITICAL]** `spec/1-data-model.md` §2.13 `Execution.input_data` 필드 정의가 이번 작업으로 뒤집힐 사실을 그대로 진술하고 있다 — spec_impact 밖
  - target 위치: `plan/in-progress/eia-inputdata-marker-guard.md` (frontmatter `spec_impact: [spec/5-system/14-external-interaction-api.md]`, 범위 체크리스트 "spec §R17 — '닫는 조건' 충족 반영")
  - 충돌 대상: `spec/1-data-model.md:471` — `Execution.input_data` 행: *"실행 입력 데이터. **egress 마스킹 대상이 아니다** — Re-run 프리필이 이 값을 읽어 재제출하므로 마스킹하면 `***` 가 실제 입력이 된다 ([EIA §R17] 잔여 ② · [Re-run §10.2])."*
  - 상세: 이 행은 `Execution.input_data` 의 **canonical 데이터 모델 정의**이며 EIA §R17 을 SoT 로 직접 인용해 "마스킹 안 함"을 단언한다. 이번 작업은 정확히 이 결론을 반전시키는 작업(마커 가드 완성 → §R17 "닫는 조건" 충족 → `Execution.inputData` 를 마스킹 카탈로그로 이동)인데, `spec_impact` 에는 `14-external-interaction-api.md` 만 올라 있다. R17 만 고치고 이 행을 그대로 두면, 같은 엔티티·같은 필드에 대해 두 spec 문서가 정반대로 말하는 상태(데이터 모델 충돌, 검토 관점 #1)가 즉시 발생한다 — 게다가 이 행은 R17 을 "근거"로 인용하고 있어 R17 이 바뀌는 순간 **자기 근거와 모순**되는 문장이 된다.
  - 제안: `plan/in-progress/eia-inputdata-marker-guard.md` 의 `spec_impact`·범위 체크리스트에 `spec/1-data-model.md` §2.13 (Execution.input_data 행, 471행) 갱신을 명시 추가한다. 새 문구는 마스킹 대상으로 전환됐음 + 마커 가드가 재제출을 보호한다는 사실을 반영해야 한다(자매 `NodeExecution.input_data` 행과의 "재제출 소비처 없음" 대비 서술도 함께 재조정).

- **[CRITICAL]** `spec/5-system/13-replay-rerun.md` §10.2 (Re-run 모달) 의 전용 caveat 블록이 "이 모달이 마스킹 안 하는 이유다" 라고 명시 — 정확히 이번 작업이 손대는 소비처 1
  - target 위치: 위와 동일 (plan spec_impact 목록)
  - 충돌 대상: `spec/5-system/13-replay-rerun.md:350-363` — *"`Execution.inputData` 는 egress 마스킹 대상이 아니다 — **이 모달이 그 이유다** (2026-08-16)"* 로 시작하는 블록. 프리필 왕복 경로, `useOriginalInput` 기본값 OFF, "형제 컬럼 outputData/error 는 마스킹되지만 inputData 는 의도적으로 제외" 를 상세 서술하고 EIA §R17 "잔여 ②" 를 SoT 로 명시 인용한다.
  - 상세: 이 블록은 이번 plan 이 구현하려는 **정확히 그 모달**(Re-run 모달, 소비처 #1)을 대상으로 "왜 지금은 마스킹하지 않는가"를 설명하는 문서다. 마커 가드가 서고 R17 이 "닫는 조건 충족"으로 뒤집히면, 이 블록 전체가 stale 을 넘어 **직접 반증**되는 서술이 된다(제목부터 "이 모달이 그 이유다"). `13-replay-rerun.md` 는 `status: implemented` 이고 `pending_plans` 에 이 작업이나 트래커가 걸려 있지 않다 — 즉 현재 구조상 이 파일이 갱신 없이 방치될 위험이 실재한다.
  - 제안: `spec_impact` 에 `spec/5-system/13-replay-rerun.md` 를 추가하고, §10.2 블록을 마커 가드 동작(프리필 스킵 + 안내, `useOriginalInput` 경로는 영향 없음 유지)으로 재작성한다. 문서 간 재발 패턴(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "타 문서가 EIA 의 현재 형태를 못 따라간 서술" 섹션)이 이미 같은 형태(EIA 갱신 → 참조 문서 stale)를 두 건 기록하고 있어, 이번이 세 번째 반복이 되지 않도록 같은 PR 에서 처리할 것을 권장.

- **[WARNING]** `spec/3-workflow-editor/3-execution.md` §2.2 "히스토리 로드" — 소비처 2(에디터)의 새 차단 동작이 스펙에 없음
  - target 위치: plan 범위 체크리스트 "에디터 히스토리 로드 마커 가드 (마커 잔존 시 실행 차단 + 사유)"
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md:91` — "히스토리 로드 | 구현 | ... 선택한 실행의 `inputData` 를 textarea 에 적재" 행. `spec/5-system/13-replay-rerun.md:360` 은 *"에디터의 '히스토리에서 불러오기'([실행 §2.2])도 같은 컬럼을 같은 방식으로 재사용하므로 동일하게 적용된다"* 라고 이 §2.2 를 Re-run 모달과 동일 취급으로 명시 교차 참조한다.
  - 상세: 13-replay-rerun.md 가 이미 "§2.2 도 동일 적용" 이라고 못박아 둔 상태이므로, 이번 작업이 §10.2 만 고치고 §2.2 를 그대로 두면 두 문서의 상호 참조 관계 자체가 깨진다(한쪽은 새 마커 가드 서술, 다른 쪽은 구현 이전 서술). 직접적인 "모순 문장"은 아직 없지만(§2.2 는 현재 마스킹을 언급조차 안 함), 계획된 신규 동작(JSON 안 마커 잔존 시 실행 버튼 비활성 + 사유)이 spec 에 전혀 반영되지 않은 채 구현만 되는 구조적 결함 위험이다.
  - 제안: `spec_impact` 에 `spec/3-workflow-editor/3-execution.md` 를 추가하고 §2.2 "히스토리 로드" 행(또는 인접 caveat)에 마커 잔존 시 실행 차단 동작을 반영한다. §2.2 는 이미 "실시간 검증 → 무효 시 Run 비활성" 패턴을 가지고 있어(같은 절 "검증" 행) 같은 UX 축에 자연스럽게 얹을 수 있다.

## 요약

`14-external-interaction-api.md` §R17 자체는 내부적으로 매우 촘촘히 정합돼 있고(마스킹 카탈로그 열거, 카브아웃 축 구분, 닫는 조건 명시), `findByWorkflow`(에디터 히스토리 목록의 백엔드 경로)가 이미 §R17 이 지목하는 `toExecutionDto` 관문을 공유하는 것도 코드로 확인돼 별도 구조적 갭은 아니다. 다만 이번 작업이 뒤집으려는 "`Execution.inputData` 는 마스킹 대상이 아니다" 라는 결론은 `spec/5-system/14-external-interaction-api.md` 한 곳이 아니라 최소 세 문서(`spec/1-data-model.md` §2.13, `spec/5-system/13-replay-rerun.md` §10.2, `spec/3-workflow-editor/3-execution.md` §2.2)에 서로를 SoT 로 교차 인용하며 미러돼 있는데, 현재 plan 의 `spec_impact`·범위 체크리스트는 R17 갱신만 명시한다. 이 저장소 자체가 최근(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` "타 문서가 EIA 의 현재 형태를 못 따라간 서술" 섹션) 같은 유형의 drift 를 두 차례 겪었다고 기록하고 있어, spec_impact 를 넓히지 않고 구현에 착수하면 세 번째 반복이 될 위험이 높다. 코드 레벨 설계(재제출 vs 표시-전용 구분, 마커 가드 이원화)는 그 자체로 타당하고 다른 spec 영역과의 API 계약·상태 전이·RBAC 충돌은 발견되지 않았다.

## 위험도

HIGH — 착수 전에 `spec_impact`(및 plan 범위 체크리스트)를 위 세 문서까지 넓히도록 정정할 것을 권장. 코드 설계 자체를 막을 결함은 아니므로 CRITICAL 은 아니지만, 이대로 구현이 끝나면 spec 자기모순이 확정적으로 발생하므로 impl-prep 게이트에서 반영 후 진행이 바람직하다.
