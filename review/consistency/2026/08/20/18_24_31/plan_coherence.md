# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 검토 범위

- target: `spec/5-system/**` (diff-base `origin/main`)
- 실제 diff (`git diff origin/main...HEAD --stat`): `spec/1-data-model.md`,
  `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md`,
  `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`,
  `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`
- 대조 대상 plan: `plan/in-progress/eia-inputdata-marker-guard.md`(developer),
  `plan/in-progress/spec-draft-inputdata-egress-masking.md`(planner),
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(트래커)
- 프롬프트 번들이 컨텍스트 예산으로 절단한 `spec/5-system/14-external-interaction-api.md` 및
  git diff 본문은 워킹트리에서 절대경로로 직접 열어 재확인함.

## 발견사항

- **[INFO]** workflow-assistant LLM 도구 표면이 `Execution.inputData` 신규 마스킹 요구를 여전히 우회
  - target 위치: `spec/5-system/14-external-interaction-api.md:1591-1608` ("잔여 ③ (범위 밖 유지)")
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — "workflow-assistant
    LLM 도구가 `inputData`·`outputData`·`error` 세 필드를 더 약한 마스킹으로 내보낸다" (2026-08-16 등재, 미해소)
  - 상세: 실측(`codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:482`)
    `toExecutionEnvelope` 가 `e.inputData` 를 `maskSensitiveFields`(키 이름 기반, 값-패턴 마스킹 없음)로만
    내보낸다. 이번 PR 로 `Execution.inputData` 가 값-패턴 egress 마스킹 대상으로 전환되면서, 이
    표면은 (기존에 `outputData`/`error` 가 갖고 있던 것과) 동형의 갭을 `Execution.inputData` 에 대해서도
    갖게 됐다. 다만 트래커 항목 문구가 애초부터 "`inputData`·`outputData`·`error` 세 필드" 로 필드명을
    나열해 뒀고, EIA 본문(`잔여 ③`)도 오늘 flip 과 별개로 이 항목을 "범위 밖 유지" 로 명시적으로
    분리해 뒀다 — 즉 **새로 생긴 미등재 갭이 아니라 기존에 등재된 항목의 적용 범위가 오늘 자연스럽게
    넓어진 것**이며, 두 문서 모두 그 사실을 이미 전제하고 있다.
  - 제안: 조치 불요(트래커가 이미 이 표면을 별도 결정 항목으로 잡고 있다). 다음에 이 항목에
    착수할 때 "Execution 레벨도 포함됨" 을 명시적으로 한 줄 덧붙이면 스캔 비용이 줄어든다는 정도의
    참고 메모.

## 정합성 확인 (문제 없음으로 판정한 항목)

- **미해결 결정과의 충돌 없음**: `plan/in-progress/**` 전수(`grep -rl inputData plan/in-progress/`)를
  확인한 결과 `Execution.inputData` 마스킹 카브아웃 폐지와 충돌하는 결정을 내리는 다른 plan은 없다.
  `retry-turn-terminal-guard.md`(`spawnedRow.inputData` 원자성)와
  `spec-draft-eia-62-waiting-payload.md`(strip 성능)는 같은 필드명을 쓰지만 각기 다른 축(재시도 상태
  동기화, WS emit 성능)이라 무관.
- **선행조건 자기완결**: 이 PR 이 전제하는 "프런트 마커 가드 선행" 조건은 같은 워크트리/브랜치의
  같은 PR 안에서 함께 충족된다 (`plan/in-progress/spec-draft-inputdata-egress-masking.md` "착지
  순서" 절이 이를 명시). developer plan 체크리스트 확인 결과 가드 구현(Re-run 모달·에디터 히스토리
  로드)·backend 마스킹 관문·캐너리 반전·27 it-블록·8라운드 `/ai-review`(최종 C0·W0)·9라운드
  `--impl-done`(전부 BLOCK:NO) 전부 완료 상태이며 워킹트리 실측과 부합.
  (`MASKED_INPUT_DATA_REASON` 코드 내 0건 확인, `grep -rn "MASKED_INPUT_DATA_REASON" codebase/ spec/` 결과 없음)
- **후속 항목 등재 정합**: 이 결정으로 새로 생긴 후속 작업 4건(`inputData` 마스킹 게이트 4곳 단일
  헬퍼 통합·`inputOverride` 서버측 마커 리터럴 거부·응답 의미 반전의 외부 소비자 확인·Re-run 차단
  판정 순수 함수 추출)이 전부 `spec-sync-external-interaction-api-gaps.md` 에 사유와 함께 등재돼
  있다 — 누락 없음.
- **미러 문서 7개 전수 정합**: `1-data-model.md`(§2.13 Execution 행 + §2.14 NodeExecution 행 대비
  서술 정리), `13-replay-rerun.md`(§10.2 블록 재작성), `3-workflow-editor/3-execution.md`(§2.2
  캐비엇 삽입), `14-external-interaction-api.md`(§R17 잔여② 취소선 종결 + 판단기준 2축 재정의 +
  비교표 flip), `12-webhook.md`(§5.3 이중 방어 캐비엇), `6-websocket-protocol.md`(§4.1 "레벨이
  가른다" 축 폐기), `4-nodes/1-logic/12-background.md`(§8.2 과거형 정정) 전부 워킹트리에서 실측
  확인함. "카브아웃"·"가르는 축은 레벨" 등 옛 프레이밍이 남은 자리는 전부 과거형 서술(`~ 이전에는`)
  으로만 존재하고, 현재형 잔존 카브아웃 서술은 0건.

## 요약

이 target 변경(`Execution.inputData` egress 마스킹 카브아웃 폐지)은 자신이 의존한 선행 조건(프런트
마커 가드)을 같은 PR 안에서 스스로 충족시켰고, 카브아웃 결론을 미러하던 7개 spec 문서를 한 커밋에서
정합하게 되돌렸으며(전수 실측 확인, 옛 서술 잔존 0건), 이 결정이 파생시킨 후속 미결 항목들을 전부
트래커에 사유와 함께 등재해 두었다. 다른 `plan/in-progress/**` 문서와 충돌하는 결정도 발견되지
않았다. 유일한 관찰 사항(workflow-assistant LLM 도구의 `Execution.inputData` 노출)도 이미 별도
결정 항목으로 등재돼 있어 신규 누락이 아니라 기존 항목의 자연스러운 범위 확장이다.

## 위험도

NONE
