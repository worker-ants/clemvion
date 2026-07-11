# Plan 정합성 검토 결과

> 검토 모드: --impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main
> governing plan: `plan/in-progress/widget-presentation-restore.md`
>
> 방법 노트: payload 에 샘플된 `plan/in-progress/**` 5건(ai-agent-tool-connection-rewrite·
> cafe24-backlog-residual·chat-channel-discord-gateway·chat-channel-slack-socket-mode·
> chat-channel-visual-ssr-png)은 target(`spec/7-channel-web-chat/`)과 실질 접점이 없어, 저장소의
> `plan/in-progress/` 34개 파일 전체를 직접 grep 하여 실제 접점이 있는 항목(governing plan 본인,
> `spec-sync-external-interaction-api-gaps.md`, `node-output-redesign/*`, `competitive-analysis-n8n-flowise.md`,
> `rag-dynamic-cut.md`)을 별도로 대조했다. 아래 발견사항은 이 광범위 대조에 기반한다.

## 발견사항

발견된 CRITICAL 없음. target 이 다른 in-progress plan 의 "결정 필요" 항목을 일방적으로 우회하거나
번복한 사례는 없다 — 관련성 있는 유일한 열린 결정 트랙(`ai-agent-tool-connection-rewrite.md` 의
`tool_*` 일반 도구 연결 재설계)은 본 target 이 다루는 AI `render_*` presentation 표현 도구와 명명
prefix·의도 모두 분리되어 있어 접점이 없다(governing plan 자신도 이 분리를 인지하고 있음 —
`ai-agent-tool-connection-rewrite.md` 상단 관련 진행 작업 note).

- **[INFO]** 사전 존재 spec drift 3건이 "별도 팔로우업"으로만 구두 위임되고 추적 아티팩트가 없음
  - target 위치: `spec/7-channel-web-chat/4-security.md` §4 (`interact` rate-limit "Planned" 오기재) ·
    `spec/7-channel-web-chat/3-auth-session.md` §3 step 0 / `4-security.md` §3-①·I3 (embed-config
    `{ data }` 봉투 표기 누락)
  - 관련 plan: `plan/in-progress/widget-presentation-restore.md` §5 "본 PR 범위 밖 — 팔로우업"
  - 상세: governing plan §5 는 이 3건(4-security.md rate-limit 오기재·NAV-WC-06 stale 배지·embed-config
    envelope 표기 누락)을 "본 변경과 무관한 사전 존재 spec drift" 로 명시 식별하고 "별도 spec-only
    팔로우업으로 분리" 하겠다고 적었으나, 이 커밋(`28a358375`) 이후로도 별도 `plan/in-progress/*.md`
    파일이 생성되지 않았다(저장소 전수 확인). 3건 중 2건(4-security.md rate-limit·embed-config 표기)은
    target scope 안에 실재하며 여전히 미수정 상태로 확인된다 — governing plan 의 서술과 target 현재
    상태가 일치하므로 **금번 diff 자체의 결함은 아니다**. 다만 이 항목들은 checkbox 가 아닌 산문
    bullet 이라 plan-lifecycle 의 "미해결 follow-up 0건" 게이트(`.claude/docs/plan-lifecycle.md`)가
    plan 완료 이동 시점에 이를 놓칠 위험이 있다(prose 는 checkbox 스캔으로 잘 안 걸림).
  - 제안: governing plan 을 `plan/complete/` 로 이동하기 전, §5 의 3항목을 (a) `[ ]` checkbox 로
    전환하거나 (b) 별도 `plan/in-progress/spec-fix-webchat-eia-drift.md` 류 파일로 분리 등록해
    plan-lifecycle 게이트가 명시적으로 인지하게 할 것. target 문서 자체의 즉시 수정은 불필요(고의적
    범위 제외이며 근거 명확).

- **[INFO]** `spec-sync-external-interaction-api-gaps.md` 의 위젯 소비 후속과 target 서술이 일치 (정합 확인, 조치 불요)
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "SSE 재연결" 단락
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `execution.replay_unavailable`
    항목 하위 `- [ ] (후속) web-chat 위젯 클라이언트 소비`
  - 상세: 두 문서 모두 "서버 emit 은 구현됨 · 위젯은 리스너만 등록하고 `handleEiaEvent` 소비 분기는
    no-op · 로컬 시간(>5분) 폴백으로 대체 중 · 이벤트 기반 감지 교체는 클라이언트 측 후속" 이라는
    동일한 사실을 기술한다. target 이 이 미해결 plan 항목을 조기 종결 처리하거나 반대로 서술하지
    않음을 확인 — coherence 유지.

## 요약

target(`spec/7-channel-web-chat/`)의 이번 변경은 governing plan `widget-presentation-restore.md`
§4-1(§2 presentation 행 정정)·§4-2(truncation 코드 수정)·Rationale R1~R3 이 서술한 결정을 정확히
반영하며, `plan/in-progress/` 의 다른 미해결 결정(특히 `ai-agent-tool-connection-rewrite.md`,
`spec-sync-external-interaction-api-gaps.md`, `node-output-redesign/*`)과 충돌·선행조건 미해소·
후속 항목 무효화 사례는 발견되지 않았다. 유일한 잔여 리스크는 governing plan §5 가 스스로 식별한
3건의 사전 존재 spec drift(본 diff 무관)가 아직 별도 추적 아티팩트 없이 산문으로만 위임되어 있다는
점으로, plan 이 `complete/` 로 이동하기 전에 정리가 필요하다(INFO, 비차단).
(diff-base `origin/main` 대비 `1-widget-app.md`/`conversation-thread.md` 에 나타나는 R7 절·§9 스코프
예외 등 대량 "제거" 표시는 origin/main 이 본 브랜치 분기 이후 병행 PR #899 로 같은 파일을 수정한
결과이며, 지시에 따라 동시 작업/브랜치 경합은 본 검토 대상에서 제외했다.)

## 위험도

NONE
