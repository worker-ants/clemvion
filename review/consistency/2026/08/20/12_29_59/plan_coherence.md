### 발견사항

- **[WARNING]** "닫는 조건 충족" 서술이 아직 미완료인 형제 plan 의 두 체크박스에 의존
  - target 위치: `## 무엇이 바뀌나 — 결정 자체` 표(3행) 및 §① 변경문(`…해소돼 2026-08-20 에 전환했다`), §② 변경문(`이 모달이 마커 가드를 갖는다 (2026-08-20)`, `프리필하지 않고… 재입력을 안내한다`), §③ 변경문(`남아 있으면 Run 이 비활성된다`)
  - 관련 plan: `plan/in-progress/eia-inputdata-marker-guard.md` §범위 — `[ ] Re-run 모달 마커 가드 (프리필 스킵 + 안내, useOriginalInput 경로 보존)`, `[ ] 에디터 히스토리 로드 마커 가드 (마커 잔존 시 실행 차단 + 사유)`, `[ ] backend — Execution.inputData egress 마스킹으로 전환`, `[ ] 캐너리 4건 방향 반전`
  - 상세: target 이 여는 "닫는 조건" 표는 세 가드 중 하나(#1181 폼 프리필)만 이미 머지됐다고 명시하고, 나머지 둘(Re-run 모달·에디터 히스토리)은 "이 작업"(형제 developer plan)이라고 스스로 적어 두었다. 그런데 뒤이은 spec 변경문 ①②③ 은 이 두 가드를 **현재형·완료형**(`가진다`, `전환했다`, `비활성된다`)으로 서술하고 날짜(2026-08-20)를 못박는다. 형제 plan `eia-inputdata-marker-guard.md` 의 범위 체크리스트를 보면 이 두 가드도, backend masking 전환 자체도, 캐너리 4건 반전도 전부 `[ ]`(미완료)다 — 즉 target 이 사실로 서술하는 상태가 **같은 시점에 코드로는 아직 존재하지 않는다.** 두 plan 이 같은 `worktree: eia-inputdata-marker-guard` 를 공유하므로 최종적으로는 같은 브랜치에서 함께 착지할 가능성이 높지만, 이 spec 커밋만 단독으로 먼저 push/리뷰되는 경로가 있다면 "R17 은 닫혔다고 선언했는데 코드는 여전히 카브아웃" 인 상태가 잠깐 실재하게 된다. 이 저장소는 미착수 기능을 spec 에 적을 때 `Planned`/미구현 라벨을 쓰는 관행이 있다(`plan/in-progress/eia-terminal-payload.md` — `durationMs`·`result.outputs` 를 `미구현 (Planned)` 으로 명시하고 "spec 의 `Planned → 구현됨` 상태 전환이 동반돼야 한다" 고 적음). target 은 그 관행과 달리 완료형으로 쓴다.
  - 제안: (a) 두 plan 이 같은 worktree 에서 한 커밋/PR 로 함께 landing 됨을 target 문서에 한 줄 명시하거나, (b) `--impl-prep` 재확인 전까지는 spec 변경문에 "이 커밋과 함께 착지하는 마커 가드에 의해" 같은 짧은 전방 참조를 남겨, spec 만 단독으로 읽는 다음 독자가 코드 현재 상태를 오독하지 않게 한다. CRITICAL 로 올릴 사안은 아니다 — 순서 자체(spec 먼저 → `--impl-prep` 재확인 → 코드)는 형제 plan 이 이미 올바르게 규정한 SDD 흐름이다.

- **[INFO]** 같은 필드에 대한 별도 미해결 마스킹 결정(workflow-assistant LLM 도구)은 target 범위 밖으로 남는다 — 확인 차 기록
  - target 위치: (해당 없음 — target 문서가 다루지 않음)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `[ ] workflow-assistant LLM 도구가 inputData·outputData·error 세 필드를 더 약한 마스킹으로 내보낸다` (결정 항목: 키-패턴 vs 값-패턴 마스킹 우선순위, 미해결)
  - 상세: 이 항목은 `explore-tools.service.ts` 가 `Execution.inputData`(및 `outputData`·`error`)를 `toResponseExecution` 경로와 무관하게 자체 `maskSensitiveFields`(키 이름 기반)로만 가리는 별도 표면을 다룬다. target 이 `Execution.inputData` 를 §R17 카탈로그의 "egress 마스킹 대상" 으로 공식 등재해도, 이 항목이 다루는 표면·마스킹 함수·미해결 우선순위 결정과는 겹치지 않는다 — 이미 그 함수가 (약하게나마) `inputData` 를 마스킹 대상으로 취급하고 있었으므로 target 의 카브아웃 폐지가 이 항목의 전제를 바꾸거나 무효화하지 않는다. 충돌·후속 누락 아님, 교차 확인만 남긴다.

### 요약

target 스펙 초안이 지정한 4개 문서(`14-external-interaction-api.md` §R17, `1-data-model.md` §2.13, `13-replay-rerun.md` §10.2, `3-workflow-editor/3-execution.md` §2.2)는 형제 developer plan `eia-inputdata-marker-guard.md` 가 `--impl-prep`(BLOCK:YES, CRITICAL 3)에서 실측으로 지목한 SoT 미러 3곳 + R17 원본과 정확히 일치하고, target 의 변경 내용(마커 가드 설계, `MASKED_INPUT_DATA_REASON` 전수 삭제, "닫는 조건" 전환)도 형제 plan 의 설계 절·범위 체크리스트와 방향·세부 모두 부합한다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커가 열어 둔 "inputData egress 마스킹 — 프런트 마커 가드가 선행돼야 한다" 항목을 정확히 집행하는 것이며, 다른 in-progress plan(60여 개, 전수 grep 확인)에는 이 네 SoT 위치나 `MASKED_INPUT_DATA_REASON`, `Execution.inputData` 를 참조하는 항목이 더 없어 후속 stale·누락 위험은 낮다. 유일한 주의점은 target 이 "닫는 조건이 이제 충족된다"고 완료형으로 서술한 세 가드 중 두 개가 형제 plan 에서 여전히 미착수(`[ ]`) 상태라는 점 — 같은 worktree 로 함께 착지할 것으로 보이나 spec 이 코드보다 앞서 완료형으로 쓰인 시점적 간극은 명시적으로 캐비엇을 남기는 편이 안전하다.

### 위험도
LOW
