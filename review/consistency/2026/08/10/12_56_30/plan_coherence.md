# Plan 정합성 검토 — `spec/7-channel-web-chat/3-auth-session.md` (--spec)

## 검토 방법

`plan/in-progress/**` 번들(52개 절단 포함) 중 target 을 직접 참조/생산하는 5건
(`webchat-usewidget-extraction.md`, `spec-update-webchat-evidence-pointers.md`,
`webchat-command-failure-is-not-termination.md`, `webchat-boot-apibase-scheme-validation.md`,
`webchat-spec-rationale-followup.md`)을 전수 대조했다. 뒤의 3건은 번들에서 예산 초과로 절단돼
저장소에서 직접 `Read` 했다. 나머지 절단분은 cafe24/AI Agent/marketplace/node-output-redesign/
harness 인프라 등 target 과 무관한 도메인임을 확인했다(파일명 grep).

target 의 실제 diff 범위도 확인했다(`git diff origin/main...HEAD -- spec/7-channel-web-chat/3-auth-session.md`,
현재 브랜치 `claude/webchat-usewidget-extraction`) — 이번 세션이 건드린 것은 §R7 문단 재서술
1곳뿐이고, §R8·§3.1 blockquote·frontmatter `code:` 등 나머지는 전부 pre-existing(이전 커밋)이다.
아래 발견 중 일부는 diff 밖(장기 존속 상태)이지만 `--spec` 모드는 문서 스냅샷 전체를 대상으로 하므로
함께 보고한다.

## 발견사항

- **[WARNING]** §3.1 이 명시한 REST 오류 분기 잔여(404·복구불가 401·낙관적 refresh)를 추적하는
  plan 이 없음
  - target 위치: `3-auth-session.md` §3.1 상단 blockquote("**404·복구불가 401 REST 분기와
    401 → 낙관적 refresh 1회 는 여전히 미구현(Planned)**... 이 잔여 REST 오류 분기·낙관적 refresh
    완전 구현은 후속 결정으로 남긴다")
  - 관련 plan: 없음. `plan/in-progress/**` 전수(`webchat-usewidget-extraction.md`·
    `webchat-command-failure-is-not-termination.md`·`spec-sync-external-interaction-api-gaps.md`
    포함)를 확인했으나 이 잔여 항목을 체크리스트로 소유한 plan 이 없다. `webchat-usewidget-extraction.md`
    의 "남은 slice" 는 `seedWaitingFromStatus` 를 **훅으로 추출**하는 리팩터일 뿐 404/401 분기
    **구현**을 다루지 않는다.
  - 상세: 실제 코드(`use-widget.ts:526-538` `seedWaitingFromStatus` 의 `catch` 블록)를 확인한
    결과도 spec 서술과 일치한다 — `getStatus` 실패는 상태코드 구분 없이 전부 soft-fail 로
    뭉개져 SSE 로 진행한다. 즉 spec 이 "설계는 이렇지만 아직 미구현" 이라고 정직하게 적어 둔
    상태인데, 그 잔여를 책임질 owning plan 이 어디에도 없다. 이 저장소는 정확히 이 클래스의
    문제(spec 이 잔여를 언급하나 plan 미등재)를 이미 한 번 겪었고 WARNING 으로 등재한 선례가
    있다 — `eia-context-schema-followups.md` 의 "`getStatus` 일반 `nodeOutput` 키-allowlist
    (§R17 잔여)" 항목("§R17 이 명시했으나 등재된 plan 이 없었다... 2026-07-10 consistency
    `plan-coherence` W3 로 등재 — spec-impl-evidence R-5 '빈 약속 영구 누락' 방지"). 이번 건도
    같은 R-5 리스크다: `status: implemented` 인데 body 는 미구현을 자인하고 있어, 다음 사람이
    "Planned" 표기만 보고 지나치면 영구 누락될 수 있다.
  - 제안: `plan/in-progress/` 에 이 잔여(404·복구불가 401 REST 분기 + 낙관적 refresh 구현)를
    소유하는 신규 항목을 만들거나, `webchat-usewidget-extraction.md` "남은 slice" 절에 명시적으로
    편입할 것. (부수: frontmatter 가 `status: implemented` 인데 body 가 "미구현(Planned)" 을
    자인하는 조합이 `spec-impl-evidence.md` §3 의 `status: partial`+`pending_plans:` 요건에
    더 가까운지도 planner 판단 필요 — 자동 가드는 body 텍스트를 안 보므로 이 드리프트를 못 잡는다.)

- **[INFO]** `code:` frontmatter 증거 포인터가 staleness 축 이동을 아직 안 따라감 (기존 open
  decision, 이번 diff 무관)
  - target 위치: `3-auth-session.md` frontmatter `code:` (L4-L9) — `use-widget.ts` 만 등재,
    `use-session-generations.ts` 없음
  - 관련 plan: `plan/in-progress/spec-update-webchat-evidence-pointers.md` §제안 3번째 항목
    (`[ ]` 미체크) + §"결정이 필요한 지점"("다음 slice 를 기다릴 것인가")
  - 상세: `webchat-usewidget-extraction.md` 1차 slice(완료)가 `isAttemptStale`/`beginBootAttempt`
    등 staleness 판정자를 `use-session-generations.ts` 로 옮겼는데, `3-auth-session.md` 의 `code:`
    는 여전히 `use-widget.ts` 만 가리킨다. 다만 이번 session 이 새로 만든 gap 이 아니라 2026-07-25
    부터 열려 있는 상태이고, 그 checker 도 "명시적 SoT 주석이 없어 WARNING 까지는 아니다" 로
    INFO 판정을 남겼다(`spec-update-webchat-evidence-pointers.md` 본문 인용). 이번 diff(§R7
    재서술)가 실제로 근거로 삼는 코드(`openStream`/`StreamClaim`)는 여전히 `use-widget.ts` 안에
    있음을 직접 확인했으므로(`use-widget.ts:104-108,387-393,620-623`), §R7 자체는 이 gap 과
    무관하다 — 별개 축(§3.1 이 참조하는 `isAttemptStale`)의 문제다.
  - 제안: `spec-update-webchat-evidence-pointers.md` 가 이미 planner 인계로 소유하고 있으므로
    추가 조치 불요. 다음 slice 착수 시점 또는 이 plan 정리 시점에 함께 반영.

- 검토했으나 **충돌 없음**으로 판정한 미해결 제품 결정 2건:
  - `webchat-command-failure-is-not-termination.md` (비-410 명령 실패를 종료로 볼지 A/B/C 미결) —
    target §3.1-3 "storage 정리 책임" 열거(SSE terminal · 200+terminal · 404 · 복구불가 401 ·
    명령 410)는 그 plan 이 지적한 대로 여전히 "그 외 명령 실패" 를 포함하지 않는다. 즉 target 은
    이 미결 결정을 어느 방향으로도 선점하지 않고 원래 상태를 유지한다(우회 아님). §R7 의 "종료
    확정은 세계의 사실만 본다" 서술도 *어떤 상태가 종료인지* 가 아니라 *누가 종료를 확정하는지*
    (staleness 축)를 다루므로 이 결정과 축이 다르다.
  - `webchat-boot-apibase-scheme-validation.md` (`wc:boot` 경로 `apiBase` 스킴 검증 여부 미결) —
    target §R8(발급-origin 바인딩)은 세션 저장/복원 시 `apiBase` 일치 여부만 다루고 `apiBase`
    **값 자체의 스킴 검증**에는 관여하지 않는다. 두 축(바인딩 vs 스킴 검증)이 분리돼 있어 R8 이
    이 미결 결정에 영향을 주거나 받지 않는다.

- **[참고, 조치 불요]** `webchat-spec-rationale-followup.md` 완료 주장 교차검증 — 실제 파일과 정합
  - 그 plan 이 "2026-08-10 완료" 로 표시한 §R7 신설·§R8 신설·`4-security.md` 재전송-origin 위협
    표 행·`2-sdk.md §3` apiBase 예외 각주를 모두 실제 파일에서 확인했다 — 전부 존재하며 완료
    주장과 일치한다. 이번 diff(§R7 문단 재서술)는 `webchat-usewidget-extraction.md` 의 "seed
    게이트 + openStream 게이트 짝의 구조적 강제 — 완료(2026-08-10)" 항목이 서술하는 변경
    (StreamClaim union, `openStream` 내부 게이트, 부정 비교 게이팅)과 코드 레벨까지 정확히
    일치함을 `use-widget.ts:616-623` 에서 직접 확인했다 — 문서-코드-plan 삼자 정합.
  - 그 plan 의 잔여 체크리스트 마지막 항목이 `/consistency-check --spec` 통과이므로, 본 세션의
    BLOCK 판정이 그 항목의 완료 여부에 직접 영향을 준다는 점만 기록해 둔다.

## 요약

target 을 직접 겨냥한 plan(`webchat-spec-rationale-followup.md`, `webchat-usewidget-extraction.md`)의
완료 주장은 문서·코드 양쪽에서 실측으로 확인되며 충돌이 없고, 이번 diff(§R7 재서술)는 그 완료
항목을 정확히 반영한다. 두 미해결 제품 결정(비-410 명령 실패, `wc:boot` apiBase 스킴 검증)도 target
이 우회하지 않는다. 다만 §3.1 이 스스로 인정한 REST 오류 분기 잔여(404·복구불가 401·낙관적 refresh)를
소유하는 plan 이 없어(WARNING) `spec-impl-evidence` R-5(빈 약속 영구 누락) 리스크가 있고, `code:`
증거 포인터가 staleness 축 이동을 아직 못 따라가는 기존 gap(INFO, 이미 `spec-update-webchat-evidence-pointers.md`
가 추적 중)이 남아 있다. 둘 다 결정 우회(CRITICAL)에 해당하지 않는다.

## 위험도

LOW
