# 발견사항

- **[INFO]** 2회차 게이트·`/ai-review` 미완료는 target 자신의 체크리스트에 정확히 반영돼 있음
  - target 위치: `plan/in-progress/planner-doc-batch.md` `## 작업` 체크리스트 마지막 두 항목
  - 관련 plan: 본 문서 자체 (외부 plan 아님)
  - 상세: `[ ] /consistency-check --spec 2회차(쓴 뒤)` 항목이 바로 지금 이 리뷰 세션(`16_41_05`)이며, `[ ] /ai-review` 는 아직 미실행이다. 둘 다 미체크 상태로 정확히 남아 있어 "완료로 거짓 표기" 류의 결함은 없다.
  - 제안: 조치 불요. 이 리뷰가 끝나고 두 항목이 실제로 수행되면 체크할 것.

- **[INFO]** `spec-sync-external-interaction-api-gaps.md` 트래커의 B1~B7 대응 항목 전수가 target 의 판정·근거와 문장 단위로 일치함 (실측 검증)
  - target 위치: `plan/in-progress/planner-doc-batch.md` 전체 (B1~B7 판정 및 작업 체크리스트)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` line 120-336 부근 (wire-only 키·envelope.output·채널 표·carve-out·provider 판정·mirror 링크 항목)
  - 상세: `git diff 99b9bd908 HEAD`로 실제 spec 변경분(`node-output.md`·`egress-masking.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md`·`conversation-thread.md`·`chat-channel-adapter.md`·provider 3파일)을 직접 대조한 결과, target 의 B1(8키 각주)·B2(4단계 파이프라인+`ws-event-types-extract.md` 캐비엇 보존)·B3(nodeType "동일 이름·다른 계층" 표)·B5(§3.2 행 추가)·B6(3곳 링크, WS §4.1-a 는 미변경)·B7(표 상단 각주 1회로 4행 커버) 전부 실제 diff 와 정확히 일치했다. B4 는 won't-do 로 닫혔고 `spec-impl-evidence.md` §2.1 정의(`code:` = surface 구현 경로, 인용 추적성 아님)를 근거로 삼은 것도 확인했다.
  - 제안: 조치 불요 — 정합 확인 기록.

- **[INFO]** 트래커가 새로 등재한 후속 항목(파생 2건 + 하네스 버그 1건)이 target 의 `spec_impact` 범위 밖으로 올바르게 분리돼 있음
  - target 위치: `plan/in-progress/planner-doc-batch.md` frontmatter `spec_impact`
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `system_error 재시도 배너`(🔴 CRITICAL, frontend 결함) · `conversation-thread code: execution-engine 4파일 미판정` · `finalAdapted ?? nodeOutputCache 폴백` · `--spec 번들러 후보 미도달(하네스)` · `### 4.4 헤딩 중복`(pre-existing) 5건
  - 상세: `system_error` 배너 관련 spec 정정(WS §4.1, `conversation-thread.md` §9.7)은 baseline 커밋(`99b9bd908` 이전, `#1209`)에 이미 포함돼 있고 target 의 diff 에는 그 두 절의 "정본 링크 인용" 한 줄만 추가됐을 뿐 문구 자체는 재수정하지 않았다 — target 의 "코드 변경 0줄" 원칙 및 scope 경계(frontend 결함은 별건 PR)와 충돌하지 않는다. 나머지 4건도 트래커에 조용히 누락되지 않고 각각 별도 체크박스로 등재돼 있어 "후속 항목 누락" 에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `node-output-redesign/**` (26개 파일, 컨텍스트 예산으로 본문 생략)와의 충돌 부재는 이전 라운드(`13_30_49`)에서 직접 Read 로 확인됐고, 본 라운드에서도 `README.md` 의 "본 plan 은 conventions 자체는 변경하지 않는다" 명시 문구를 재확인함
  - target 위치: frontmatter `spec_impact: spec/conventions/node-output.md`
  - 관련 plan: `plan/in-progress/node-output-redesign/README.md` line 65
  - 상세: node-output-redesign 은 노드 spec 이 conventions 를 어떻게 따르는지 진단하는 plan 이고 conventions 본문 자체는 건드리지 않으므로, target 의 Principle 0 각주 추가와 충돌 지점이 없다.
  - 제안: 조치 불요.

# 요약

`plan/in-progress/planner-doc-batch.md`(B1~B7)는 정본 트래커 `spec-sync-external-interaction-api-gaps.md`에 등재된 "planner 소관" 항목들과 문장·근거 단위로 정확히 대응하며, 실제 커밋 diff(`99b9bd908..HEAD`, `4af06d951`+`74186fd51`)를 직접 대조한 결과 claim 과 실제 변경분(7개 spec 파일)이 100% 일치한다. 직전 라운드(`13_30_49`)가 낸 Critical 1건은 반박(오탐)됐고 Critical 2건 중 근거 있는 것은 target 에 반영됐으며(RESOLUTION.md 확인), 그 반영 과정에서 인접 미해결 캐비엇(`ws-event-types-extract.md` 의 `sanitizeErrorMessage` 전수 확인 항목)은 손대지 않고 보존한 것도 실측 확인했다. 트래커에 새로 등재된 후속 항목 5건(system_error 배너 CRITICAL 포함)은 모두 target scope 밖으로 명시적으로 분리·등재돼 있어 "후속 항목 누락"에 해당하지 않는다. node-output-redesign 등 인접 in-progress plan 26개+α를 전수 grep 했으나 target 의 결정과 충돌하는 미해결 항목은 발견되지 않았다.

# 위험도

NONE
