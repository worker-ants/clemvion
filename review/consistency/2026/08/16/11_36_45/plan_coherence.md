# Plan 정합성 검토 — plan_coherence

## 검토 범위 메모

target=`spec/5-system/`(--impl-done, diff-base=`origin/main`)이지만, 실제 `git diff origin/main...HEAD`는
spec 파일을 **한 곳도 건드리지 않는다**(`spec_impact: none`). 변경은 전부
`codebase/backend/src/{modules/execution-engine,shared/utils}/*`(종결 이벤트 `error.message`/`details`
egress 마스킹, `toTerminalErrorPayload` 내부)와 `plan/in-progress/{eia-terminal-error-sanitize.md,
spec-sync-external-interaction-api-gaps.md}` + `CHANGELOG.md`다. 아래 발견사항은 이 구현이 `plan/in-progress/**`
및 target spec 영역과 정합한지에 초점을 맞췄다.

## 발견사항

- **[WARNING]** EIA §R17 "표면 제약(보안)" 마스킹 카탈로그 5번째 항목 등재 후속이 정본 트래커에 미등재
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "표면 제약(보안)" (약 L1414-1457).
    현재 3개 불릿(`conversationThread` · `execution.ai_message` · `nodeOutput.conversationConfig`+terminal
    `result`/`error`)만 있고, 이번 PR 이 새로 추가한 4번째 egress 마스킹 지점(`toTerminalErrorPayload` 내부의
    `Execution.error` → WS/SSE/webhook 종결 이벤트)은 카탈로그에 없다.
  - 관련 plan: `plan/in-progress/eia-terminal-error-sanitize.md` "## 후속 (이 PR 범위 밖)" 첫 항목
    (`- [ ] planner 턴 — EIA §R17 ... 마스킹 카탈로그에 5번째 항목 등재`, `10_19_31` plan_coherence W1 인용) —
    developer 는 spec 쓰기 권한이 없어 여기까지만 하고 멈췄다는 점 자체는 규약대로다.
  - 상세: 문제는 "멈췄다"가 아니라 **이 follow-up 이 정본 트래커에 등재되지 않았다**는 점이다.
    같은 커밋이 건드린 자매 파일 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`("정본
    트래커" — `eia-terminal-emit-facade.md`·`eia-db-wire-invariant.md` 등 여러 plan 이 명시적으로
    이렇게 부른다)에는 이번 PR 의 masking 구현 항목만 `[x]`로 닫혔고("종결 `error.message` 가
    값-패턴 마스킹을 안 거친다", L145-175), R17 카탈로그 완전성 갭에 대한 새 bullet 은 추가되지
    않았다(`grep "카탈로그\|R17" spec-sync-external-interaction-api-gaps.md` → 무관한 1건뿐). 즉
    follow-up 이 로컬 plan(`eia-terminal-error-sanitize.md`)에만 존재하고, cross-plan 가시성을 갖는
    정본 트래커에는 없다. **이 정본 트래커 파일 자신이 정확히 같은 실패 형태를 5회 자백**했다
    (`plan/in-progress/spec-sync-external-interaction-api-gaps.md` L382-386, L399-406: "유예의 근거로
    '등재했다/한다'를 쓸 때, 실제로는 등재하지 않았다"). 이번 건은 "등재했다"고 주장하지는 않지만,
    **등재해야 할 자리에 등재하지 않은 채 로컬 plan 에만 남긴** 같은 계열의 위험이다 — 다음 세션이
    `eia-terminal-error-sanitize.md`를 열지 않으면(예: `complete/`로 이동 후) 이 follow-up 은
    발견되지 않는다.
  - 제안: `spec-sync-external-interaction-api-gaps.md`에 "R17 표면 제약(보안) 카탈로그 4번째 항목
    미등재 — `Execution.error` egress 마스킹(`toTerminalErrorPayload`)" bullet 을 추가하고(planner
    턴), `eia-terminal-error-sanitize.md`의 해당 follow-up 은 그 bullet 을 참조하도록 정리.

- **[INFO]** `eia-terminal-emit-facade.md` 체크리스트가 머지 후에도 stale — 이미 별도 턴으로 인지됨
  - target 위치: 해당 없음(spec 아님, plan 자체 위생 문제).
  - 관련 plan: `plan/in-progress/eia-terminal-emit-facade.md` 체크리스트 마지막 3항목
    (`/ai-review` · `--impl-done` · `push 게이트`)이 `[ ]`로 남아 있으나, 이 작업은 `#1174`
    (`8e0728a90`, "종결 emit 에 타입 초크포인트")로 이미 머지됐다(`git log --oneline`으로 확인,
    `origin/main` 조상에 존재).
  - 상세: `plan/in-progress/eia-terminal-error-sanitize.md`가 이 stale 을 이미 "## 후속 (이 PR
    범위 밖)"에서 명시적으로 인지하고 별도 턴으로 미뤘다("`#1174` `8e0728a90` 로 이미 머지됨 →
    `[x]` 갱신 + `plan/complete/` 이동, `10_19_31` plan_coherence INFO2"). 즉 이미 추적 중이라
    은닉된 누락은 아니다. target(`spec/5-system/`) 정합성에는 영향 없음 — 순수 plan lifecycle
    위생(체크박스 실제 상태 ≠ 표시 상태) 문제.
  - 제안: 별도 턴에서 체크박스 갱신 + `plan/complete/` 이동(이미 계획대로).

## 정합성 확인(문제 없음으로 판정한 항목 — 참고용)

- 마스킹 위치 결정(egress-only, `toTerminalErrorPayload` 내부)은 `spec-sync-external-interaction-api-gaps.md`
  L145-162 에 2026-08-14 등재된 처방("`toTerminalErrorPayload` 내부 또는 fanout 경계에서
  `deepRedactSecrets` 적용")과 정확히 일치하고, 같은 턴에 그 항목을 `[x]`로 닫아 자매 트래커
  동시 갱신 관행을 지켰다.
- `plan/complete/eia-db-wire-invariant.md`가 세운 "DB = wire" 불변식은 `durationMs`/`cancelledBy`
  같은 **값 일치**에 관한 것이지 byte-level 내용 일치가 아니므로, 이번 egress-only 마스킹(DB 는
  원문 보존, wire 만 마스킹)과 충돌하지 않는다 — 이 PR 자신도 그 구분을 명시적으로 검증했다
  (rationale (a)(b), `eia-terminal-error-sanitize.md` L69-82).
  마스킹 패턴 확장(자격증명 없는 연결 문자열 등) 미해결 항목은 이미
  `spec-sync-external-interaction-api-gaps.md` L164-170 에 별건으로 등재돼 있어 누락이 아니다.
- CHANGELOG 의 EIA outbound webhook whitelist 절 인용을 `§3.3`→`§3.1`로 정정한 것은 실제 spec
  구조(`14-external-interaction-api.md` §3.1 = Outbound Notification, EIA-NX-02 소속)와 일치한다.

## 요약

이번 PR 은 spec 을 건드리지 않고 코드·plan 만 변경했으며, 마스킹 위치·범위에 대한 핵심 결정은
정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에 이미 등재된 처방을 그대로 집행해
미해결 결정을 우회하지 않았다. 다만 이 PR 이 새로 만든 follow-up(R17 카탈로그 4번째 마스킹
지점 등재)이 정본 트래커가 아니라 로컬 plan 에만 남아, 이 정본 트래커 파일 자신이 이미 5회
자백한 "등재 누락" 패턴과 같은 계열의 위험을 안고 있다. 나머지는 절차상 적절히 처리됐다.

## 위험도

MEDIUM
