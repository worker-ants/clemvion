# Plan 정합성 Check — `plan/in-progress/spec-fix-webchat-eia-drift.md`

## 검토 범위

target 은 `plan/in-progress/widget-presentation-restore.md` §5 가 impl-prep(22_41_55) WARNING 3건을
"본 PR 범위 밖 사전 존재 drift" 로 분리하며 예고한 follow-up plan 이다. `plan/in-progress/` 전체
(38개 문서)를 대조해 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 3관점으로 점검했다.

## 발견사항

- **[INFO]** target 헤더의 소스 plan 경로가 실제 위치와 다름 (`complete/` 오기재)
  - target 위치: `plan/in-progress/spec-fix-webchat-eia-drift.md:27-32` (상단 인용구)
    > "전부 #901 변경과 무관한 사전 존재 drift 라 그 PR 범위 밖으로 분리했다
    > (`plan/complete/widget-presentation-restore.md` §5)."
  - 관련 plan: `plan/in-progress/widget-presentation-restore.md` (아직 `plan/in-progress/` 에 있음,
    `plan/complete/` 로 이동되지 않음)
  - 상세: 인용 경로가 `plan/complete/widget-presentation-restore.md` 를 가리키지만 실제 파일은 여전히
    `plan/in-progress/widget-presentation-restore.md` 다. 해당 소스 plan 은 자신의 §4-3 워크플로
    체크리스트에 아직 미해결 항목 2개(`fresh /ai-review (fix 커버)`, `/consistency-check --impl-done`)를
    남기고 있어 `complete/` 이동 전이다. D-1·D-2·D-3 의 내용 자체(사전 존재 drift 판정·실증 근거)는 소스
    plan 의 완료 여부와 무관하게 유효하지만(코드/spec 실증이 독립적으로 성립), 인용 경로는 부정확하다 —
    이 상태로 소스 plan 이 나중에 `complete/` 로 이동될 때 정확한 경로가 되므로, 지금 시점에는 선반영된
    참조다.
  - 제안: target 헤더의 인용 경로를 `plan/in-progress/widget-presentation-restore.md` §5 로 정정하거나,
    (소스 plan 이 먼저 `complete/` 로 이동한 뒤 target 작업을 시작할 계획이라면) 착수 순서 노트를 추가해
    독자가 "소스가 아직 진행 중"임을 알 수 있게 한다. blocking 은 아님 — D-1/D-2/D-3 실증은 소스 plan 의
    완료 여부에 의존하지 않는다.

## 교차검증 결과 (발견사항 없음 확인한 항목)

- **D-1 (rate-limit "Planned" 오기재)**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:15` 가
  이미 `InteractionRateLimiterService`/`InteractionRateLimitGuard` 를 "완료" 로 체크(`[x]`)해 target 의
  "SoT 는 구현됨" 주장과 정합. 이 항목을 "결정 필요" 로 남겨둔 plan 은 없음 — 충돌 없음.
- **D-2 (NAV-WC-06 stale)**: `spec/2-navigation/_product-overview.md:222` 현재 `🚧 (증분 2 — 위젯
  co-deploy 후)`. co-deploy 게이트는 `plan/complete/web-chat-console.md:66` Phase 1 이 "✅ 완료" 로
  종결했고, `spec/7-channel-web-chat/5-admin-console.md` 는 `status: implemented`. `plan/in-progress/`
  전체에 "co-deploy" 나 "NAV-WC-06" 을 미해결로 남겨둔 문서 없음 — target 의 ✅ 승격은 선행 조건이 이미
  충족된 상태에서의 정당한 flip.
  검증: `grep -rl "co-deploy" plan/ spec/` → in-progress 매치는 target 자신뿐, 나머지는 `plan/complete/**`.
- **D-3 (embed-config `{data}` 봉투 누락)**: `spec/conventions/swagger.md` 에 embed-config 전용 예외
  기재 없음 (전역 wrap 규칙 그대로 적용). `plan/in-progress/exec-intake-followups.md` 의 유사 항목
  (WebAuthn 응답 포맷)은 다른 엔드포인트·다른 이슈(`{data:{items}}` vs bare-array)로 무관.
- 같은 파일(`4-security.md`, `3-auth-session.md`)을 동시에 건드리는 다른 in-progress plan 없음 — 편집
  충돌 없음.
- `ai-agent-tool-connection-rewrite.md` 의 미해결 결정("도구 등록 모델" 등)·`chat-channel-*` 3건의
  backlog 진입 조건("사용자 결정 필요")·`cafe24-backlog-residual.md` 잔여 항목 모두 웹채팅 EIA 문서
  drift 와 무관한 영역 — target 과 교차하는 지점 없음.

## 요약

target 은 이미 in-progress 인 `widget-presentation-restore.md` §5 가 명시적으로 예고한 분리 follow-up
이며, D-1(rate-limit 구현 상태)·D-2(NAV-WC-06 완료)·D-3(embed-config 봉투) 세 건 모두 다른
`plan/in-progress/` 문서의 "결정 필요" 항목과 충돌하지 않고, 선행 조건(EIA rate-limit 구현 완료, 위젯
co-deploy 완료, swagger 전역 wrap 규칙)이 이미 각각의 plan/spec 에서 충족·확정된 상태다. 유일한 흠은
target 헤더가 소스 plan 을 `plan/complete/` 로 잘못 인용한 것인데, 이는 인용 경로의 시점 오차일 뿐
D-1/D-2/D-3 내용의 타당성에는 영향이 없다.

## 위험도
LOW
