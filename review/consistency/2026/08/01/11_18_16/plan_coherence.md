# Plan 정합성 검토 — spec/7-channel-web-chat (--impl-done)

## 발견사항

- **[INFO]** target 스코프가 devDependency 버전 전용 diff에 기계적으로 라우팅됨 — plan 미해결 결정과 견줄 대상이 성립하지 않음
  - target 위치: `spec/7-channel-web-chat` (번들 전체 — `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`, `_product-overview.md`, `0-architecture.md`, `5-admin-console.md`)
  - 관련 plan: `plan/in-progress/typescript-7-rollback.md` (전체), 부수적으로 `plan/in-progress/typescript-toolchain-followups.md`
  - 상세: 이번 `--impl-done` 세션의 target 이 `spec/7-channel-web-chat` 로 선택된 것은 diff 에
    `codebase/channel-web-chat/package.json` 이 포함되어 있고, 이 경로가 `1-widget-app.md`
    frontmatter 의 `code: codebase/channel-web-chat/**` glob 과 매칭되었기 때문이다(라우팅 규칙
    자체는 설계대로 동작 — 기계적 glob 매칭). 그러나 `git diff origin/main...HEAD --stat` 로
    실측한 실제 변경 내용은 전 워크스페이스 공통 `typescript` devDependency 버전
    `^7` → `^5` 한 줄 롤백(dependabot `#1047` 의 TS7 오상향이 유발한 Jenkins main 빌드 실패
    복구) + 신규 저장소 위생 가드(`typescript-toolchain-guard.ts`/`.test.ts`) + `dependabot.yml`/
    `PROJECT.md` 갱신뿐이다. `codebase/channel-web-chat/src/**` 등 위젯 제품 코드는 diff 에
    전혀 등장하지 않는다. 이 작업을 이끄는 `plan/in-progress/typescript-7-rollback.md` 는
    frontmatter 에 `spec_impact: none` 을 명시하고, 본문 "미수행 단계와 근거" 절에서도
    "`/consistency-check --impl-prep` 생략 — 본 변경은 의존성 버전 복원·CI 설정·저장소 가드로
    `spec/` 어느 영역도 대상이 아니다" 라고 스스로 밝히고 있어, 이번 target 라우팅과 정합적이다.
    즉 target 문서가 이번 PR 로 새로 내리는 결정이 없으므로, plan 이 "결정 필요"로 남겨둔 항목과
    충돌할 여지 자체가 없다. `plan/in-progress/` 8건(typescript-7-rollback,
    typescript-toolchain-followups, ai-agent-tool-connection-rewrite, cafe24-backlog-residual,
    deps-guard-hardening, eia-context-schema-followups, execution-engine-residual-gaps,
    harness-consistency-summary-downgrade-rule) 전수를 grep + 정독했으나 channel-web-chat/EIA/
    widget 관련 언급은 `eia-context-schema-followups.md`(harness typecheck 배선 등, 전부 `[x]`
    완료) · `deps-guard-hardening.md`(`web-chat-checks` CI job 명, required-check 승격 논의로
    spec 무관) 뿐이고, 미해결(`[ ]`) 항목 중 `spec/7-channel-web-chat` 이 서술하는 위젯
    상태기계(§3)·세션 컨트롤(§3.1)·가시성/차단(§3.2)·i18n(§4)·SDK 계약·인증 전략·보안 정책·
    관리콘솔 기능 어느 것과도 전제·충돌 관계가 없다. (`ai-agent-tool-connection-rewrite.md` §1
    의 "도구 등록 모델 TBD" 등은 AI Agent 일반 도구 연결 재설계에 대한 미해결 결정이지만,
    target 이 참조하는 AI Agent 기능은 이미 구현된 `multi_turn`/`render_*`(§7.10) 뿐이라 무관.)
  - 제안: 조치 불요. 참고용 기록 — 본 checker 가 "발견 없음"을 보고하는 근거가 "검토했으나
    문제 없음"이 아니라 "target 자체가 이번 diff 의 실질 변경과 무관하게 glob 라우팅됨"임을
    통합 SUMMARY 집계 시 구분해 두면, 향후 유사한 devDependency-only PR 의 impl-done 라우팅
    노이즈 해석에 참고가 된다.

## 요약

이번 `--impl-done` 세션의 target(`spec/7-channel-web-chat`)은 diff 에 포함된
`codebase/channel-web-chat/package.json` 이 해당 spec 의 `code:` glob 과 매칭되어 라우팅되었으나,
실제 변경은 전 워크스페이스 공통 `typescript` devDependency 버전 롤백(`^7`→`^5`, 젠킨스 main
빌드 실패 복구)과 신규 저장소 가드/거버넌스 문서 갱신뿐이며 `spec/**` 전체와
`codebase/channel-web-chat/src/**` 제품 코드는 건드리지 않는다. 담당 plan
(`typescript-7-rollback.md`)은 frontmatter `spec_impact: none` 과 본문의 `--impl-prep` 의도적
생략 근거를 이미 명시하고 있어 이번 target 선택과 정합적이다. `plan/in-progress/` 8건 전수를
확인했으나 `spec/7-channel-web-chat` 이 다루는 위젯 상태기계·SDK 계약·인증·보안·관리콘솔 어느
항목과도 충돌하는 미해결 결정, 미해소 선행조건, 무효화되는 후속 항목이 없다 — plan 정합성
관점에서 실질적 비교 대상이 없는 "델타 0" 케이스다.

## 위험도
NONE
