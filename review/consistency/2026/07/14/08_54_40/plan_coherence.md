# Plan 정합성 검토 — spec/5-system/14-external-interaction-api.md

## 검토 방법 메모

payload 의 "진행 중 plan 문서 모음" 에는 이 diff(F-1 nodeId 일치 검사, F-2 surfaceMismatch 안내)가
직접 참조하는 `plan/in-progress/eia-command-waiting-surface-guard.md` 가 **누락**되어 있었다(대신
`ai-agent-tool-connection-rewrite.md`/`cafe24-backlog-residual.md`/`chat-channel-*` 3건만 포함).
diff 의 코드 주석이 `plan eia-command-waiting-surface-guard` 를 8곳에서 명시하므로, payload 만으로는
정합성 판정이 불가능해 해당 plan 파일과 target spec 파일(`spec/5-system/14-external-interaction-api.md`),
연관 spec(`spec/5-system/4-execution-engine.md §7.5.1`)을 worktree 절대경로로 직접 Read 하여 대조했다.

## 발견사항

- **[INFO]** plan_coherence payload 의 plan 덤프가 target 과 가장 밀접한 plan 을 누락
  - target 위치: (payload 조립 단계, target 문서 자체 아님)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` (diff 주석이 8곳에서 직접 참조)
  - 상세: 자동 조립된 payload 의 "진행 중 plan 문서 모음" 섹션이 `plan/in-progress/` 전체가 아니라
    5개 중 무관한 3개(`ai-agent-tool-connection-rewrite.md`/`cafe24-backlog-residual.md`/
    `chat-channel-*` 2건)만 포함하고, diff 가 반복 언급하는 governing plan 은 빠졌다. 이번엔 절대경로
    직접 Read 로 우회했지만, 다음 checker 가 payload 만 신뢰하면 오탐(관련 plan 없음 → 정합성 판단 불가)
    또는 미탐(실제로는 이미 해소된 항목을 미해결로 오인) 가능성이 있다.
  - 제안: orchestrator 의 payload 조립 스크립트가 diff 본문에서 `plan/in-progress/<slug>.md` 패턴을
    추출해 우선 포함하도록 개선 검토 (target 코드/spec 문서 및 diff comment 가 실제로 인용하는 plan 우선).

## 교차 검증 결과 (문제 없음)

- `plan/in-progress/eia-command-waiting-surface-guard.md` 의 메인 체크리스트(재현→구현→테스트→ai-review→
  consistency-check→spec 동기 S-1)는 전부 `[x]`. 후속 항목 F-1(assertNodeId nodeId 일치)·F-2(surfaceMismatch
  안내)·F-3(breaking-change 공지 결정) 도 모두 "완료" 로 마킹되어 있고, 이번 diff(F-1/F-2 구현체)와 정확히
  대응한다 — 미해결 결정을 우회하는 일방적 코드 변경이 아니라, plan 이 사용자 결정(Approach B / 공지 불필요)까지
  확정한 뒤의 구현이다.
- target 문서 `spec/5-system/14-external-interaction-api.md` §5.1 은 F-3 체크리스트가 요구한
  "`STATE_MISMATCH` 강제 정합 (2026-07)" 메모(표면 불일치=2026-07-10, nodeId 불일치=2026-07-14, 외부
  공지 미발행 근거)를 그대로 반영하고 있다. S-1 체크리스트가 요구한 §6.2 `expectedCommands` 각주("서버측
  강제 매트릭스의 SoT 는 실행 엔진 §7.5.1")도 이미 존재한다.
  → target 문서가 plan 의 결정과 충돌하지 않고 오히려 그 결정을 그대로 등재한 상태.
- F-1 의 `assertNodeId(dto, ctx)` Approach B(외부 scope 만 검사 + `in_process_trusted` scope 단위 면제)는
  `spec/5-system/4-execution-engine.md §7.5.1` 의 "nodeId 검사 진입점별 커버리지" 표에 EIA 적용 /
  in_process_trusted 면제 / WS·`/continue` 미적용 3행으로 정확히 반영되어 있다. `plan` 의 "스코프 밖" 명시
  (chat-channel `handleFormStep` 은 nodeId 를 알아도 scope 단위로 면제)와도 코드 주석·spec 서술이 일치한다.
  → F-1 의 ai-review 초회 CRITICAL("spec overclaim: WS 도 지정")이 이미 커버리지 표로 정정된 상태(plan 기록과
  spec 실제 내용이 일치).
- F-6("WS continuation·REST `/continue` 의 nodeId 검사 확장")은 plan 에서 **명시적으로 별도 결정·작업으로
  이관**되어 있고, target 문서·execution-engine spec 어디에도 WS/`/continue` 가 nodeId 를 검사한다는 과대
  서술이 없다 — 후속 항목 누락이 아니라 정상적으로 스코프 밖 처리·cross-ref 된 상태.
- F-4(control-plane 안내 발송 구조 리팩터)·F-5(MarkdownV2-safe DTO 강제)는 코드 아키텍처 레벨 리팩터
  backlog 이며 target spec 문서의 계약 내용과는 무관 — target 문서 갱신 누락이 아니다.
- `spec/5-system/14-external-interaction-api.md` frontmatter 의 `pending_plans:
  plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 별도로 열람했으나, 그 plan 의 잔여
  항목(분산 SSE fan-out, `getStatus` nodeOutput 키-allowlist)은 이번 diff(F-1/F-2)와 무관한 축이라 충돌 없음.
- F-2 의 default 문구(KO/EN)는 `language-hint-defaults.ts` `SURFACE_MISMATCH_DEFAULTS` 와
  `telegram.mdx`/`telegram.en.mdx` §7.4 사용자 가이드가 문자 그대로 동일 — plan 체크리스트의 "유저 가이드
  telegram.mdx/.en.mdx §7.4 ... 백필" 항목과 diff 가 정확히 대응한다.

## 요약

target 문서(`spec/5-system/14-external-interaction-api.md`)에 반영된 F-1(nodeId 일치 검사)·F-2(surfaceMismatch
안내)·F-3(breaking-change 공지 결정) 변경은, governing plan(`plan/in-progress/eia-command-waiting-surface-guard.md`,
payload 에는 누락되어 있어 절대경로로 직접 대조함)이 이미 확정한 사용자 결정을 그대로 구현·문서화한 것이며,
미해결 결정을 우회하거나 선행 조건을 무시한 정황은 없다. F-6(WS/`/continue` nodeId 확장)·F-4/F-5(구조 리팩터)는
plan 이 스스로 스코프 밖으로 명시 이관했고 target 문서도 그 경계를 과대 서술하지 않는다. 유일한 지적은 payload
조립 단계가 diff 가 직접 인용하는 관련 plan 을 자동 포함하지 못한 프로세스 갭(INFO)이다.

## 위험도
LOW
