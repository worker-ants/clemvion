# Plan 정합성 검토 — spec/5-system/4-execution-engine.md (--impl-done)

## 조사 방법 메모

payload 의 "진행 중 plan 문서 모음" 섹션에는 5개 plan(`ai-agent-tool-connection-rewrite.md` /
`cafe24-backlog-residual.md` / `chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md` /
`chat-channel-visual-ssr-png.md`)만 포함돼 있었고, 이번 diff(F-1 `expectedNodeId` 스레딩, F-2
`surfaceMismatch` 안내)가 실제로 귀속되는 **`plan/in-progress/eia-command-waiting-surface-guard.md`
는 payload 에 누락**돼 있었다. target 이 `spec/5-system/4-execution-engine.md` 임에도 가장 직접적인
plan 이 빠진 것은 payload 구성 로직의 갭으로 보이나(별도 트랙 이슈), 본 checker 는 워크트리
절대경로로 해당 plan 파일을 직접 Read 해 대조했다.

## 발견사항

- **[WARNING]** F-3(외부 EIA breaking-change 공지 여부 결정)이 F-1 산출물로 확장된 breaking 범위를 반영하지 못함
  - target 위치: `spec/5-system/4-execution-engine.md` §7.5.1 표 "nodeId 불일치" 행 + "nodeId 검사
    진입점별 커버리지" 표 (F-1 구현 결과, 오늘 반영분)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` → `### F-3. 외부 EIA 클라이언트
    대상 breaking behavior 공지 여부 결정 (project-planner)` (체크박스 없이 서술형으로 남아있고
    "planner 가 명시적으로 결정할 것" 이라 미해결 상태)
  - 상세: F-3 은 원래 "대기 표면 매트릭스" PR(2026-07-10, 종전 202→409)에 대해서만 쓰여 있다
    ("본 PR 은 종전 202 를 반환하던 명령 조합을 409 로 바꾼다"). 그런데 오늘(2026-07-14) 완료된
    F-1 은 **동일 성격의 두 번째 breaking 변경**을 도입했다 — nodeId 가 실제 대기 노드와 다른
    외부 EIA `/interact` 제출이 종전엔 (표면만 맞으면) 202 로 조용히 수용됐지만 이제 409
    `STATE_MISMATCH` 로 거부된다(CHANGELOG.md 상단 항목이 "behavior 변경" 이라고 직접 명시).
    F-1 의 구현 자체는 사용자가 2026-07-14 Approach B 로 명시 승인했으므로 구현 착수를 막을
    필요는 없었지만, F-3 이 다루는 "외부 클라이언트에게 공지가 필요한가" 라는 미해결 질문의
    **대상 범위**는 F-1 이 나오면서 사실상 넓어졌다. 그런데 plan 의 F-3 서술·target spec 어디에도
    이 확장이 반영돼 있지 않다 — F-3 은 여전히 원래(2026-07-10) 변경 하나만 가리키는 문구
    그대로다. 검토를 위해 spec 본문(`4-execution-engine.md`, `14-external-interaction-api.md`)과
    `CHANGELOG.md` 전체를 검색했으나 "공지 여부/채널" 결정이 별도로 기록된 흔적은 없다 — 즉 F-3 은
    실제로 아직 미해결이다.
  - 제안: `plan/in-progress/eia-command-waiting-surface-guard.md` F-3 항목 본문을 갱신해 F-1 의
    두 번째 breaking 변경(nodeId 불일치 202→409)을 명시적으로 포함시키고, project-planner 턴에서
    공지 필요 여부·채널을 확정한 뒤 체크박스/결정 기록을 추가할 것. F-1/F-2 자체를 되돌릴 필요는
    없음 — 순수 governance/커뮤니케이션 후속 작업 갱신 건.

- **[INFO]** payload 의 plan 목록 구성에서 target 과 가장 밀접한 in-progress plan 누락
  - target 위치: (payload 메타, target 문서 자체 아님)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md`
  - 상세: 위 "조사 방법 메모" 참조. 이번엔 checker 가 워크트리 절대경로로 직접 확인해 만회했지만,
    payload 생성 로직이 target spec 경로와 diff 내 plan 참조 문자열(`plan eia-command-waiting-
    surface-guard`)을 매칭하지 못하면 향후 회차에서 동일 누락이 재발할 수 있다.
  - 제안: orchestrator 의 plan 목록 선정 휴리스틱이 diff 본문에 등장하는 `plan/in-progress/*.md`
    문자열도 후보로 포함하는지 점검 권고 (본 checker 의 조치 대상은 아님).

## 요약

이번 diff(F-1 `expectedNodeId` 스레딩/nodeId 일치 검사, F-2 `surfaceMismatch` 안내)는
`plan/in-progress/eia-command-waiting-surface-guard.md` 의 F-1·F-2 항목이 사용자 승인(2026-07-14
Approach B)을 거쳐 완료 처리된 것과 정확히 일치하며, target spec(`4-execution-engine.md` §7.5.1)도
plan 체크리스트가 약속한 "nodeId 불일치" 행·진입점별 커버리지 표를 그대로 반영해 코드·spec·plan
3자가 잘 정합돼 있다(같은 plan 의 F-6 유예 항목도 스펙의 "미적용" 표기와 일치). 유일하게 걸리는
것은 F-3(breaking-change 외부 공지 결정)이 여전히 미해결인 채, F-1 이 추가한 두 번째 breaking
변경을 그 스코프에 반영하지 않고 있다는 점 — 구현을 되돌릴 사안은 아니지만 plan 갱신이 필요하다.

## 위험도

LOW
