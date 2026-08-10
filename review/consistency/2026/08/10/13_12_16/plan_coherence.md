# Plan 정합성 검토 — `spec/7-channel-web-chat/3-auth-session.md`

## 재판정: `webchat-reload-rest-error-branches.md` 는 §3.1 잔여를 실제로 소유하는가

**독립 재검증 결과: 소유가 실질적이다.** 단순 언급이 아니라는 근거를 액면가로 받지 않고 직접 대조했다.

- **파일 실존 + 내용 일치**: `plan/in-progress/webchat-reload-rest-error-branches.md` 를 직접 `Read` 로
  열어 프롬프트 번들 인용과 diff 없이 동일함을 확인했다(허위 인용 아님).
- **frontmatter 스키마 충족**: `worktree: (unstarted)` / `started: 2026-08-10` / `owner: project-planner`
  3필드 모두 존재 — `plan-frontmatter.test.ts` top-level 의무 필드 통과.
- **양방향 링크 정합**: target frontmatter `pending_plans:` 가 이 파일 **하나만** 가리키고,
  §3.1 배너도 같은 파일을 상대링크로 가리킨다(`spec-pending-plan-existence` 대상 dangling 없음).
  다른 in-progress plan 에서 같은 잔여(`낙관적 refresh`/`EXECUTION_NOT_FOUND`/`복구불가 401`)를
  이중으로 주장하는 파일은 없다(전수 grep 0건 추가) — 소유권 충돌 없음.
- **범위 일치**: plan 의 "결정이 필요한 항목" 3개(`404` 분기 · 복구불가 `401` 분기 · `401→낙관적
  refresh 1회`)가 target §3.1 배너가 "미구현(Planned)" 으로 자인한 항목과 **정확히 1:1 대응**한다
  — 포괄적 플레이스홀더가 아니라 잔여를 그대로 옮겨 적은 실질 체크리스트다.
- **완료 조건 명시**: "구현이 끝나 본 plan 이 `complete/` 로 이동하면 `3-auth-session.md` 는 `partial`
  → `implemented` 승격이 **의무**" — `spec-impl-evidence.md §3` 전이 규칙과 정합하게 스스로 종료
  조건을 건다.
- **선행 plan 인지**: "세 분기 모두 `seedWaitingFromStatus` 한 함수의 `catch` 에 모인다 —
  `webchat-usewidget-extraction.md` 의 '남은 slice' 가 바로 그 함수를 훅으로 추출하는 작업이라
  순서가 문제된다" — 착수 순서 의존성(§검토 관점 2)을 plan 스스로 이미 명시했다. 별도 지적 불필요.

이 축(§검토 관점 2: 선행 plan 미해소)에 대해서는 직전 라운드 WARNING 이 **해소됐다**고 판단한다.

---

## 발견사항

- **[WARNING]** 새 plan 의 "결정이 필요한 항목" 3개 중 2개는 target 이 이미 결정해 놓은 것을 다시
  "미결" 로 되돌리고 있다
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` `## Rationale` §R4 ("재로드 `401` —
    낙관적 refresh 1회 후 종료") 및 §3.1 step 2 의 `401` 분기 서술
  - 관련 plan: `plan/in-progress/webchat-reload-rest-error-branches.md` §"결정이 필요한 항목" 항목
    2("복구불가 `401` 분기")·항목 3("`401 → 낙관적 refresh 1회`")
  - 상세: CLAUDE.md 정보 저장 규약상 spec 문서의 `## Rationale` 은 "**결정의 배경·근거**" — 즉
    이미 내려진 결정을 기록하는 자리다. §R4 는 가정형이 아니라 확정형으로 쓰여 있다: "낙관적으로
    `refresh-token` 1회 시도해 만료면 복구하고, **재차 실패(`401`/`410`)면 종료로 확정한다**." 이는
    plan 항목 2("복구불가 `401` 을 종료로 볼 것인가")와 항목 3("§R4 의 설계를 그대로 구현할 것인가")이
    묻는 바로 그 질문에 대한 답을 이미 담고 있다. 그런데 plan 은 이 두 항목을 "planner 트랙 — **사용자
    판단**" 이 필요한 미결 항목으로 등재했다(체크박스 미체크, "위 3개 결정 항목은 손대지 않았다"고 명시).
    스스로 만든 이 게이트는 (a) 이미 답이 있는 것을 다시 "사용자에게" 묻는 불필요한 정체를 만들거나,
    (b) 만약 사용자가 §R4 와 다른 답을 낸다면 이번엔 **plan 이 target 의 기존 결정(§R4)을 뒤집는**
    상황을 만드는데, 그 경우 plan 체크리스트에는 "§R4 Rationale 도 함께 갱신" 이 항목으로 없다 —
    즉 이 plan 자체가 "미해결 결정과의 충돌" 위험을 내재하고 있다. 반면 항목 1(`404` 분기)은 §3.1
    본문에 결론(`storage 정리 후 [ended]`)이 서술돼 있으나 전용 Rationale 이 없어 상대적으로
    "구현만 남았다" vs "정말 미결" 여부가 더 모호하다 — 이쪽은 재확인이 합당할 수 있다.
  - 제안: plan 을 갱신해 항목 2·3 을 "사용자 판단 필요" 에서 "§R4 대로 구현 — 구현 중 §R4 전제가
    깨지면(예: EIA-AU-04/05 가 바뀌어 만료/blacklist 구분이 가능해지면) 그때 §R4 를 갱신" 정도의
    구현 확인 항목으로 재분류하거나, 굳이 재오픈할 근거(예: §R4 작성 이후 EIA 쪽 전제가 바뀌었다는
    구체적 신호)가 있다면 그 근거를 plan 에 적어 "결정 필요" 표기를 정당화할 것. 어느 쪽이든 현재
    상태로는 이 게이트가 영구히 안 열리거나(아무도 "사용자 판단"을 요청하지 않아 방치), 열리는
    순간 §R4 와 충돌할 위험을 동시에 가진 애매한 상태다.

- **[INFO]** `webchat-usewidget-extraction.md` 에 새 plan 으로의 역방향 링크가 없다
  - target 위치: (간접) `spec/7-channel-web-chat/3-auth-session.md` §3.1 이 가리키는
    `seedWaitingFromStatus`
  - 관련 plan: `plan/in-progress/webchat-usewidget-extraction.md` §"남은 slice" /
    `plan/in-progress/webchat-reload-rest-error-branches.md` §"착수 시 함께 볼 것"
  - 상세: 새 plan 은 `webchat-usewidget-extraction.md` 를 선행 의존으로 명시 인용했지만, 역방향
    (usewidget-extraction 쪽에서 "이 함수를 건드리기 전에 reload-rest-error-branches 결정을 먼저
    보라")링크는 없다. 두 plan 모두 미착수라 당장 실害은 없으나, `webchat-usewidget-extraction`
    의 남은 slice 가 먼저 착수되면 그 작업자가 `webchat-reload-rest-error-branches.md` 의 존재를
    모른 채 `seedWaitingFromStatus` 를 훅으로 옮길 수 있다.
  - 제안: `webchat-usewidget-extraction.md` §"남은 slice" 또는 §"선행 판단" 에 한 줄
    ("`seedWaitingFromStatus` 추출 시 `webchat-reload-rest-error-branches.md` 의 3개 미결 결정을
    먼저 확인 — 순서에 따라 분기가 새 훅 안에 들어갈지 갈린다")을 추가해 상호 참조를 완성할 것.

- **[INFO]** "무엇이 대화의 종료(termination) 인가" 축을 서로 다른 두 plan 이 독립적으로 결정 중이다
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1-3 (storage 정리 조건 열거)
  - 관련 plan: `plan/in-progress/webchat-reload-rest-error-branches.md` (REST 상태조회 경로의
    종료 판정) / `plan/in-progress/webchat-command-failure-is-not-termination.md` (명령 실패
    경로의 종료 판정)
  - 상세: 두 plan 은 서로 다른 코드 경로(`getStatus` REST 오류 vs `interact` 명령 실패)를 다루지만,
    둘 다 궁극적으로 "위젯 `[ended]` 전이·storage 정리 조건" 이라는 §3.1-3 의 같은 목록에 항목을
    추가하게 될 결정이다. 서로를 인지하지 못한 채 각자 결정되면 "일시적 오류는 종료가 아니다"(명령
    실패 plan 이 유력하게 시사하는 방향, A안)와 "REST 조회 실패(404/복구불가 401)는 종료다"(reload
    plan 의 기본 전제)가 미묘하게 다른 원칙 위에서 결정될 수 있다 — 반드시 모순은 아니지만
    (전자는 "일시적 vs 영구", 후자는 "행 자체가 없다/자격이 없다" 로 축이 달라 정당화는 가능하다),
    §3.1-3 의 최종 조건 목록이 일관된 서사로 읽히려면 두 결정이 조율되는 편이 안전하다.
  - 제안: 두 plan 중 나중에 결정되는 쪽이 착수 시점에 다른 쪽의 최종 결정을 참조하도록 상호
    링크를 추가할 것(현재는 어느 쪽도 서로를 인용하지 않는다). 차단 사유는 아니므로 INFO.

## 요약

직전 라운드가 지적한 "§3.1 잔여를 소유하는 plan 부재" WARNING 은 실질적으로 해소됐다 —
`webchat-reload-rest-error-branches.md` 는 파일이 실존하고, target 의 정확한 3개 잔여 항목을
1:1 로 옮겨 적었으며, frontmatter `pending_plans:` ↔ §3.1 배너 링크가 양방향으로 정합하고,
착수 순서 의존성(`webchat-usewidget-extraction`)도 스스로 인지해 문서화했다 — 단순 포인터가
아니라 실질적 소유다. 다만 그 plan 이 스스로 만든 "결정이 필요한 항목" 3개 중 2개(복구불가
`401` 종료 여부, `401` 낙관적 refresh 구현 여부)는 target 의 `## Rationale` §R4 가 이미 확정형
으로 답해 놓은 내용이라, 이 게이트가 불필요하게 안 열리거나(아무도 "사용자 판단"을 요청하지
않아 방치) 열리는 순간 기존 결정과 충돌할 잠재 위험을 안고 있다 — 이는 새 결함이라기보다
plan 이 스스로를 얼마나 정밀하게 스코핑했는지의 문제이므로 WARNING 으로 보고한다. 나머지는
경미한 상호 참조 누락(INFO 2건)이며 차단 사유가 아니다.

## 위험도

MEDIUM
