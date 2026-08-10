# Consistency 통합 보고서 — `spec/7-channel-web-chat/3-auth-session.md` (재판정 라운드)

- 모드: `--spec` · target `spec/7-channel-web-chat/3-auth-session.md`
- 선행 라운드: [`12_56_30`](../12_56_30/) — **CRITICAL 1 · WARNING 1** 발견
- 본 라운드: 그 2건의 정정(`933eff66d`)을 **독립 재판정**

## BLOCK: NO

Critical 0 · 경고 0.

## 전체 위험도

**NONE**.

## 선행 라운드에서 발견된 것과 그 처분

| # | checker | 발견 | 처분 |
|---|---|---|---|
| 1 | convention_compliance | **[CRITICAL]** frontmatter `status: implemented` 가 본문 §3.1 이 자인한 미구현 표면과 모순 — `spec-impl-evidence.md §3` 직접 위반 | **해소** — `status: partial` + `pending_plans:` (`933eff66d`) |
| 2 | plan_coherence | **[WARNING]** §3.1 잔여(404·복구불가 401 REST 분기·낙관적 refresh)를 소유한 plan 부재 | **해소** — `plan/in-progress/webchat-reload-rest-error-branches.md` 신설 |
| 3 | convention_compliance (재판정) | **[INFO]** §R4 가 미구현 고지 없이 확정 설계처럼 읽힘 | **해소** — R4 머리에 Planned 고지 + 소유 plan 링크 |
| 4 | plan_coherence (재판정) | **[WARNING]** 신설 plan 이 §R4 가 **이미 결정한** 2건을 "사용자 판단 필요" 미결로 되돌림 | **해소** — "미구현 항목(developer 트랙)" 으로 정정 |
| 5 | plan_coherence (재판정) | **[INFO]** `webchat-usewidget-extraction.md` → 신설 plan 역방향 링크 부재 | **해소** — 순서 의존성 명시 |

## 5 checker 결과 (선행 + 재판정)

| checker | 라운드 | 위험도 |
|---|---|---|
| cross_spec | 12_56_30 | NONE — EIA·Webhook·같은 영역 spec 원본 직접 대조, 모순 0 |
| rationale_continuity | 12_56_30 | NONE (INFO 2) — §R7 개정을 "모범적 Rationale 갱신" 으로 판정 |
| naming_collision | 12_56_30 | NONE — 신규 식별자 도입 없음 |
| convention_compliance | **13_12_16** | **NONE** (선행 CRITICAL 해소 확인, INFO 1 반영) |
| plan_coherence | **13_12_16** | 선행 WARNING **해소 확인** + 신규 WARNING 1(반영 완료) · INFO 2 |

> 재판정은 두 checker 에게 **"내 주장을 액면가로 받지 말고 독립 재판정하라"** 를 명시해 요청했다.
> convention_compliance 는 3중으로 확인했다 — `git show` diff 원문 대조 · plan 파일 실존과
> frontmatter 확인 · 규약을 강제하는 build 가드 6종(955 + 162 tests) 직접 실행.

## 이 라운드가 잡은 것 — 가드가 구조적으로 못 보는 자리

핵심 CRITICAL 은 **한 달 넘게(2026-07-05 `6b25ccc3e` 이후) 살아 있었다.** 왜 자동 가드가
못 잡았는지 뮤테이션으로 실측했다:

| 뮤턴트 | 결과 |
|---|---|
| `pending_plans` 를 존재하지 않는 경로로 | **RED** (`spec-pending-plan-existence`) |
| **원 결함 상태 재현** (`status: implemented` + `pending_plans` 없음) | **GREEN — 2876건 전부 통과** |

가드가 묻는 것은 `code:` 경로 실존과 `pending_plans:` 실존뿐이다. **"본문이 미구현을 자인하는데
status 가 implemented"** 는 어떤 가드도 묻지 않는다 — 본문 텍스트를 읽지 않기 때문이다.
이 클래스는 사람이나 checker 만 잡을 수 있고, 그래서 이번처럼 한 달을 산다.

`eia-context-schema-followups.md` 의 "§R17 잔여"(2026-07-10 등재)가 정확히 같은 형태였다.
**두 번째 재발**이므로 신설 plan 에 그 사실을 적어 뒀다.

## 재판정이 **내가 이번 턴에 만든 결함**을 잡았다

신설 plan 을 "결정이 필요한 항목(사용자 판단)" 으로 등재했는데, `plan_coherence` 가
**§R4 가 이미 그 결정을 내려 놓았다**고 지적했고 옳았다. §3.1 step 2 가 `404`·`401` 의
귀결을, §R4 가 근거까지 확정 서술로 적고 있다. 유예된 것은 동작이 아니라 **언제 만들 것인가** 다.

게다가 나는 같은 턴에 반대 문장을 썼다 — §R4 머리에 "**결정은 내려졌으나 구현은 없다**" 를
달아 놓고, 같은 브랜치의 plan 은 그것을 "결정 필요" 로 되돌렸다. **한 턴 안의 자기모순**이
두 문서에 나뉘어 올라갈 뻔했다.

이 방향의 오류가 특히 나쁜 이유: 미결로 되돌리면 (a) 답할 사람이 없어 게이트가 영구
정체되거나, (b) 나중 답이 §R4 의 기존 결정과 충돌한다. **결정을 미결로 되돌리는 것은 결정을
뒤집는 것과 같은 비용**인데, 나는 그걸 "안전한 쪽" 이라 여겨 저질렀다.

정정 결과 이 항목은 **사용자 결정을 기다리지 않는다** — 명세대로 구현하면 되는 developer
트랙 작업이다.

## 검증

- 문서 가드 19파일 **2878 passed** (신규 plan 적재로 2872→2878)
- 위젯 23파일 **409 passed**
- `origin/main` rebase 후 재확인 — 동일 (#1128 머지분이 `code:` 에 `use-session-generations.ts`
  를 추가해 선행 라운드 plan_coherence 의 INFO 도 함께 해소됐다)
