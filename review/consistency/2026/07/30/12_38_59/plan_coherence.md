### 발견사항

- **[WARNING]** 선행 plan(`spec-update-node-cancellation-shutdown-classification.md` #10)의 체크리스트가 stale — target 이 그 위에 이어붙이는 섹션이 "아직 구현 전"으로 잘못 표시돼 있다
  - target 위치: `## 근거 요약` 4번째 불릿("코드를 spec 에 맞춰 되돌리는 것이 아니다 — 코드/plan 의 실측 결론이 유지되고, spec 문구만 그 결론에 맞춰 수정한다") — target 은 §7.5 대칭 Rationale 섹션(`### retry 재진입의 원자 claim — spawn 단계 원자성만으로는 불충분하다`)이 이미 존재함을 전제로 그 안의 한 문단만 정정한다
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` `## 추가 위임 (2026-07-28 #10)` 절의 체크리스트 4개 항목(`§4.1 각주 재연결` · `§7.4/§8 claim 위치 반영` · `§7.5 대칭 Rationale 항목 신설` · `exec-intake-queue-impl.md PASS 간극 기록`)
  - 상세: 위 4개 항목은 전부 `[ ]`(미완료)로 표시돼 있으나, 실측 결과 **전부 완료된 상태다** — commit `b351731f0`(2026-07-28, 커밋 메시지 자체가 "spec 동반(#10, ...)"라고 명시)가 같은 커밋에서 `spec/5-system/4-execution-engine.md` 의 §4.1 각주(`:425`)·§7.4 메시지타입/Worker동시성 두 행(`:889,911`)·§7.5 대칭 Rationale 신설(`:1354-1395`, exec-intake-queue-impl PASS 스코프 기록 포함)을 전부 반영했다(직접 diff 확인 완료). 그런데 같은 커밋이 이 plan 파일도 28줄 수정했음에도(안내 문구 완화 + #11 신규 항목 추가) **정작 #10 자신의 체크박스는 하나도 체크하지 않았다.** 지금 검토 중인 target 은 바로 이 이미-완성된 §7.5 섹션의 한 문단을 다시 정정하는 것인데, sibling plan 은 여전히 그 섹션 자체가 "만들어야 할 미완료 항목"인 것처럼 보인다 — project-planner 가 그 문서를 먼저 읽으면 착오를 일으킬 수 있다.
  - 제안: project-planner 가 이 target 을 반영하는 같은 턴에 `spec-update-node-cancellation-shutdown-classification.md` #10 의 4개 체크박스를 `[x]` 로 정정하고 "이행 결과(`b351731f0`)" 서브섹션을 추가할 것(#8 의 "### #8 이행 결과" 선례와 동일 패턴). target 자신의 `## 함께 반영할 것` 절에 이 항목을 추가해 두면 유실 위험이 줄어든다.

- **[INFO]** target 이 정정하는 문단과 같은 문단을 겨냥한 미해결 후속 항목(#17)이 있으나 target 이 이를 인지·언급하지 않는다
  - target 위치: `## 제안 변경 > ### After (제안)` 첫 문장 "크래시로 중단된 턴의 BullMQ 재배달도 함께 막힌다"(무수정으로 유지) 및 `## Overview`/`## 분류` 의 "문단 앞뒤 문장 ... 여전히 유효하므로 무수정" 판단
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #17(P3, 6R side_effect WARNING #4, 여전히 open) — "claim ~ try 진입 전 구간의 '크래시 트레이드오프' 서술 범위가 이번 claim 전진 배치로 넓어짐(프로세스 크래시뿐 아니라 이 구간의 일반 예외까지 동일 적용) — Critical#1 수정으로 범위가 확정된 뒤 재평가 필요"
  - 상세: target 이 그대로 두기로 한 "크래시로 중단된 턴의 BullMQ 재배달도 함께 막힌다"라는 프레이밍이, 6R 에서 claim 위치가 앞당겨진 뒤로도 여전히 정확한 범위 서술인지는 #17 이 아직 "재평가 필요"로 열어 둔 질문이다(claim 실패는 이제 크래시뿐 아니라 claim~try 구간의 일반 예외에도 동일 적용됨). target 은 이 인접 문장을 "여전히 유효"라고 판단하면서도 #17 을 인용하거나 그 판단 근거를 밝히지 않는다 — 이 정정이 머지되면 문단 전체가 "막 재검토됨"으로 보여 #17 의 재평가가 조용히 뒤로 밀릴 위험이 있다. 다만 활성 결함이 아니고 #17 자체도 plan 에 P3 로 이미 추적 중이라 차단 사유는 아니다.
  - 제안: target 의 `## 함께 반영할 것` 절에 "이 정정은 문단 첫 문장('크래시로 중단된 턴...')의 범위 재평가(#17)는 다루지 않는다 — 별개로 남아있다"는 한 줄만 추가해 두 항목이 나중에 충돌 없이 각자 처리되도록 명시할 것.

### 요약

target 문서(`spec-update-retry-claim-backstop-gap.md`)가 인용하는 근거 — 코드 JSDoc(`claimSpawnedRetryRow`, `retry-turn.service.ts:499-531`), `retry-turn-terminal-guard.md` §코드 표 #15, 소스 리뷰(`review/code/2026/07/30/11_41_20` WARNING #1) — 를 전부 직접 대조한 결과 factual 근거는 정확하고, target 이 그리는 다음 단계(project-planner 의 `--spec` 검토)도 `retry-turn-terminal-guard.md` 7차 라운드가 이미 명시적으로 예정해 둔 바로 그 경로(`W1(SPEC-DRIFT) ... draft plan/in-progress/spec-update-retry-claim-backstop-gap.md 신설, project-planner 위임`)와 정확히 일치한다. plan 이 "결정 필요"로 남겨둔 어떤 항목과도 충돌하는 일방적 결정은 없다(이 편집은 이미 확정·구현된 메커니즘의 설명을 사실에 맞추는 것뿐). 다만 두 가지 부수 정합성 이슈를 발견했다: (1) target 이 이어붙이는 §7.5 대칭 Rationale 섹션을 만든 선행 plan(`spec-update-node-cancellation-shutdown-classification.md` #10)의 체크리스트가 실제로는 완료됐는데도 미체크 상태로 남아 있어, 이 target 반영과 같은 턴에 함께 정리하지 않으면 plan 상태가 계속 stale 하게 남는다(WARNING). (2) target 이 무수정으로 남긴 인접 문장의 범위가 다른 sibling 항목(#17, P3)에서 "재평가 필요"로 아직 열려 있는데 target 이 이를 언급하지 않는다(INFO, 비차단).

### 위험도

LOW
