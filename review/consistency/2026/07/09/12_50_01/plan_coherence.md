# Plan 정합성 검토 — spec/2-navigation/ (editor-slug-phase2 impl-prep)

## 조사 방법 메모

`prompt_file` 의 "진행 중 plan 문서 모음" 절은 `plan/in-progress/**` 를 알파벳순으로 담다가 크기 한도로
잘려 있어(포함분: `ai-agent-tool-connection-rewrite.md` / `cafe24-backlog-residual.md` /
`chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md` /
`chat-channel-visual-ssr-png.md` 5건뿐), 정작 이 target 영역의 1차 plan 인
`plan/in-progress/editor-slug-phase2.md` 자체와 `spec-sync-workflow-list-gaps.md` /
`spec-sync-canvas-gaps.md` / `spec-sync-user-profile-gaps.md` / `spec-sync-edge-gaps.md` /
`spec-sync-auth-gaps.md` 등 target 파일들의 `pending_plans` 트래커가 payload 에서 누락됐다.
본 검토는 저장소의 실제 `plan/in-progress/**` 전체와 관련 `plan/complete/**`(phase 1 이력)를
직접 조회해 보완했다 — 아래 발견사항은 그 결과다.

## 발견사항

- **[INFO]** payload 조립이 target 과 무관한 plan 을 우선 포함하고 1차 관련 plan 을 누락
  - target 위치: (해당 없음 — orchestrator 프로세스 이슈)
  - 관련 plan: `plan/in-progress/editor-slug-phase2.md` (payload 미포함), `spec-sync-*-gaps.md` 트래커 다수 (payload 미포함)
  - 상세: `prompt_file` 의 plan 모음이 디렉터리 알파벳 순으로 5개까지만 담고 잘렸다. 알파벳상
    `editor-slug-phase2.md` 는 `chat-channel-visual-ssr-png.md` 뒤([`competitive-analysis-n8n-flowise.md`]
    다음)에 위치해 payload 에 전혀 실리지 않았다. payload 만 사용했다면 이 리뷰는 대상 작업의
    실제 plan 을 보지 못한 채 무관한 4건(cafe24/chat-channel 계열)만 근거로 "문제 없음" 오판을
    내릴 뻔했다.
  - 제안: orchestrator 의 payload 구성 로직을 target 문서의 frontmatter `pending_plans`/파일명 매칭
    우선 포함(관련도 기반) 방식으로 개선 검토. 최소한 target 작업명과 직접 대응하는 plan 파일은
    truncation 전에 우선 포함.

- **[INFO]** EH-DETAIL-06 요구사항 ID 드리프트 후속이 plan/in-progress 트래커로 미등록
  - target 위치: `spec/2-navigation/14-execution-history.md` §EH-DETAIL (EH-DETAIL-06 행)
  - 관련 plan: `plan/complete/slug-routing-hardening.md` (완료, 2026-07-09) — "EH-DETAIL-06 요구사항
    ID 범위 드리프트 → project-planner (task_fa5d4e34)" 후속을 남겼으나 그 후속을 담을
    `plan/in-progress/*.md` 트래커 파일이 아직 생성되지 않음(메모리 인덱스 항목으로만 존재).
  - 상세: `editor-slug-phase2.md` S7 은 같은 파일(`14-execution-history.md`, 다른 라인 — line 20
    개요 문단)을 "에디터 slug 밖" 문구 정정 목적으로 편집할 예정이다. 두 이슈는 서로 다른 라인이라
    직접 충돌은 없지만, 같은 파일을 만지는 세션에서 미등록 후속(EH-DETAIL-06)이 다시 누락되기
    쉽다.
  - 제안: S7 편집 세션에서 `plan/in-progress/spec-sync-*.md` 류로 EH-DETAIL-06 후속을 정식 등록하거나,
    최소한 developer 가 인지하도록 plan 비고에 교차 참조를 남길 것(필수 차단 아님).

## 교차 확인 결과 (충돌 없음 — 참고)

- `editor-slug-phase2.md` 의 S7 이 명시한 편집 좌표(9-user-profile.md:158·_layout.md:85·
  0-dashboard.md:21·1-workflow-list.md:103·14-execution-history.md:20·2-edge.md:10 frontmatter)는
  실제 파일의 현재 라인과 정확히 일치 — plan 이 current state 를 정확히 반영하고 있어 드리프트 없음.
- `1-workflow-list.md`(`pending_plans: spec-sync-workflow-list-gaps.md`)의 유일한 열린 항목은
  §2.7 마켓플레이스 빈상태 링크(frontend 잔여) — editor-slug-phase2 가 건드리는 §2.6(실행 내역
  더보기 메뉴) 라인과 무관, 충돌 없음.
- `2-edge.md`(`pending_plans: ai-agent-tool-connection-rewrite.md` / `spec-sync-edge-gaps.md`)의
  열린 항목들은 엣지 UX 기능(드래그 드롭 삽입·사이클 경고 등)이며 frontmatter `code:` 경로
  갱신(에디터 slug 이동)과 무관.
- `9-user-profile.md` 의 열린 항목(아바타 업로드·이메일 일간 요약 토글 등, `spec-sync-user-profile-gaps.md`)
  은 이미 "editor(`/workflows/[id]`)는 phase 1 slug 밖(후속)" 을 명시적으로 기록해 phase 2 를
  선반영하고 있음 — 충돌 없음, 오히려 정합.
- phase 1 완료 plan(`plan/complete/workspace-slug-routing.md`) 과 하드닝 후속
  (`plan/complete/slug-routing-hardening.md`)이 모두 종결·이동 완료 상태라 phase 2 착수의 선행
  조건은 이미 해소됨.
- `editor-slug-phase2.md` 자체의 "잠금된 결정" 절이 라우트 구조·reconcile 게이트·하위호환·알림
  딥링크·워크스페이스 전환·무효 slug 처리를 전부 사용자 확인으로 이미 잠가 두어, target 문서가
  전제하는 미해결 결정을 일방적으로 우회하는 항목은 발견되지 않음.
- target 문서(0-dashboard/1-workflow-list/10-auth-flow/11-error-empty-states/13-user-guide/
  14-execution-history/15-system-status) 전체에서 "결정 필요"/TBD/미정 마커 검색 결과 0건 — plan 이
  우회할 미해결 결정 자체가 표기돼 있지 않음.
- 유일한 절차적 미결은 plan 자체가 명시한 S7 소유권 질문("developer 권한 밖 → 코드 PR 과 원자적
  vs spec-update draft" 결정을 "impl-prep 후 결정"으로 미뤄둔 것)인데, 이는 cross-plan 충돌이
  아니라 본 impl-prep 체크포인트 자체가 그 결정 지점이므로 별도 finding 으로 올리지 않음 — 착수 전
  developer/사용자가 확정할 것.

## 요약

`editor-slug-phase2` 의 잠금된 결정·작업표(S1~S7)는 phase 1 완료 plan 및 관련 spec-sync 트래커들과
충돌 없이 정합하다. S7 이 정정하려는 6개 위치는 현재 spec 라인과 정확히 일치해 plan 이 최신
상태를 반영하고 있고, target 영역의 다른 열린 plan 항목(마켓플레이스 링크·엣지 UX·아바타 업로드 등)은
모두 editor-slug-phase2 가 건드리는 섹션과 겹치지 않는다. 다만 (1) 이번 리뷰에 전달된 payload 자체가
1차 plan 문서를 누락한 조립 결함이 있었고 — 직접 조회로 보완함 —, (2) 완료된 하드닝 plan 이 남긴
EH-DETAIL-06 후속이 아직 정식 plan 트래커로 등록되지 않은 채 같은 spec 파일 근처에 남아 있다는 점은
INFO 수준으로 짚어 둔다. 두 항목 모두 구현 착수를 막을 사유는 아니다.

## 위험도

LOW
