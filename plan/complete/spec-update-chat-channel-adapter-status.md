---
worktree: impl-setup-error-code-ddd078
started: 2026-09-12
owner: resolution-applier
---
# Spec Update Draft — chat-channel-adapter 미구현 서술 정정

## 분류

SPEC-DRIFT (코드 개선을 spec 에 반영) — `spec/conventions/chat-channel-adapter.md` 의
frontmatter `pending_plans` 주석이 "§1.1.2 의 `code` 선언 계약은 미구현이다" 라고 적고
있는데, `feat(chat-channel): setupChannel 실패를 code 로 선언하고 502 를 실현한다`
(현재 세션, adapter 3종 전부)가 정확히 그 문장을 반증했다. 코드가 맞고 spec 의 상태
서술이 낡았다.

## 원본 발견사항

SUMMARY#7 (`review/code/2026/09/12/13_41_55/SUMMARY.md`):

> `[SPEC-DRIFT 후보 — 조사 결과 낮은 확신]` `spec/conventions/chat-channel-adapter.md`
> frontmatter `pending_plans` 주석이 "§1.1.2 의 `code` 선언 계약은 미구현이다 (adapter 3종
> 전부 developer 후속)" 라고 적고 있는데, 본 PR 이 정확히 그 3종(discord/slack/telegram)
> 전부에 `code` 를 부착해 이 문장을 반증했다. `git blame` 확인 결과 이 문장은 developer
> 자신이 아니라 planner 커밋(`8964a7114`)이 작성해, CLAUDE.md 의 "자기-반증형 소정정"
> 예외 조건 1(작성자=developer)이 성립하지 않으므로 developer 가 직접 고칠 권한 밖이다.
> 위치: `spec/conventions/chat-channel-adapter.md:7` (frontmatter), 대응 본문 `:188-190`.
> 제안: 후속 planner 턴에서 frontmatter "미구현" 서술을 "구현 완료(v1 provider 3종) —
> 남은 것은 fallback 제거 판정" 으로 정정 + `plan/in-progress/spec-draft-nullable-notation-followups.md`
> 의 "CCA §1.1.2 401/403 fallback 제거 판정" 항목에 이 PR 완료 링크 cross-link.

## 실측 근거

- `git blame spec/conventions/chat-channel-adapter.md` 상 frontmatter 주석 2줄(현재 파일
  기준 6~7행)의 author 는 `8964a7114` (`docs(spec): setupChannel 실패를 transport 대신
  원인으로 분류한다 — 502 는 실재하지 않았다 (#1323)`, planner 턴 커밋) — developer 커밋이
  아니다. CLAUDE.md "자기-반증형 소정정" 조건 1(대상 문장을 developer 자신이 그 문서에
  썼다) 이 성립하지 않는다.
- adapter 3종 `code` 부착 실측 (이번 세션 커밋 2건):
  - `a4f943f4b feat(chat-channel): setupChannel 실패를 code 로 선언하고 502 를 실현한다`
    — telegram/slack/discord adapter 전부 `credentialRejectedError(...)` 부착.
  - `455d1526f test(chat-channel): 뮤테이션이 살아남은 자리를 막는다 — discord-client
    status 배선` — discord 경로 뮤테이션 검증까지 통과.
  - grep 확인: `TELEGRAM_CREDENTIAL_REJECTED_STATUSES` / `SLACK_CREDENTIAL_REJECTED_ERRORS` /
    (이번 리뷰 후속으로 신설된) `DISCORD_CREDENTIAL_REJECTED_STATUSES` 3개 전부 존재.
- `pending_plans` 의 나머지 3개 항목(`chat-channel-discord-gateway.md` ·
  `chat-channel-slack-socket-mode.md` · `chat-channel-visual-ssr-png.md`)은 이 PR 의 범위
  밖이라 **여전히 미구현** — `status: partial` 자체는 유지해야 한다. 정정 대상은 §1.1.2
  `code` 선언 계약 한 줄뿐이다.

## 제안 변경

### 1. frontmatter `pending_plans` 주석 (`spec/conventions/chat-channel-adapter.md:6-7`)

**Before:**
```yaml
pending_plans:
  # §1.1.2 의 `code` 선언 계약은 **미구현**이다 (adapter 3종 전부 developer 후속) —
  # `status: partial` spec 의 미구현 surface 추적 의무(`spec-impl-evidence.md §2.1`).
  - plan/in-progress/spec-draft-nullable-notation-followups.md
  - plan/in-progress/chat-channel-discord-gateway.md
  - plan/in-progress/chat-channel-slack-socket-mode.md
  - plan/in-progress/chat-channel-visual-ssr-png.md
```

**After:**
```yaml
pending_plans:
  # §1.1.2 의 `code` 선언 계약은 **구현 완료**다 (telegram·slack·discord 3종 전부 `code`
  # 부착 — 2026-09-12 `feat(chat-channel): setupChannel 실패를 code 로 선언하고 502 를
  # 실현한다`). 남은 것은 §1.1.2 의 401/403 message fallback **제거 판정**뿐이고, 그 판정은
  # 아래 첫 항목("CCA §1.1.2 의 401/403 fallback 제거 판정")이 추적한다. 나머지 3개 항목
  # (discord gateway v2 등)은 이 PR 범위 밖이라 여전히 미구현 — `status: partial` 유지.
  # (`spec-impl-evidence.md §2.1`)
  - plan/in-progress/spec-draft-nullable-notation-followups.md
  - plan/in-progress/chat-channel-discord-gateway.md
  - plan/in-progress/chat-channel-slack-socket-mode.md
  - plan/in-progress/chat-channel-visual-ssr-png.md
```

### 2. 본문 §1.1.2 "제거 조건" 콜아웃 (`spec/conventions/chat-channel-adapter.md:188-190`)

**Before:**
```markdown
> **제거 조건**: v1 provider 3종(telegram·slack·discord)이 모두 `code` 를 부착하면 이 fallback 은
> 삭제 후보다. 조건만 적고 추적하지 않으면 한시적 예외가 영구 예외가 되므로, 그 판정을 별
> 후속 항목으로 추적한다.
```

**After** (조건문은 그대로 두고 충족 사실만 추가 — 원문 취소 없이 갱신 각주 추가):
```markdown
> **제거 조건**: v1 provider 3종(telegram·slack·discord)이 모두 `code` 를 부착하면 이 fallback 은
> 삭제 후보다. 조건만 적고 추적하지 않으면 한시적 예외가 영구 예외가 되므로, 그 판정을 별
> 후속 항목으로 추적한다.
>
> **2026-09-12 갱신 — 조건 충족.** v1 provider 3종 전부 `code` 부착이 완료됐다
> (`feat(chat-channel): setupChannel 실패를 code 로 선언하고 502 를 실현한다`). **삭제 판정
> 자체는 아직 하지 않았다** — 판정은
> `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "CCA §1.1.2 의 401/403
> fallback 제거 판정" 항목이 추적한다.
```

### 3. `plan/in-progress/spec-draft-nullable-notation-followups.md` cross-link (참고용, 이 draft 의 필수 범위는 아니나 planner 턴에서 함께 처리 권장)

`plan/in-progress/spec-draft-nullable-notation-followups.md:2818` 의 "`setupChannel` 실패
분류" 항목은 developer 후속 1~5 를 이 세션이 전부 완료했다(§5.4 응답 계약 배선 · adapter
3종 `code` 부착 · 캐너리 뒤집기 · `http-exception.filter` 502 실측 · `@ApiBadGatewayResponse`).
해당 체크박스를 완료 처리하고 `plan/complete/` 이동 여부 판단은 이 draft 범위 밖 —
planner 턴에서 plan lifecycle 규칙에 따라 별도 판단 필요.

## 영향

- 코드 변경 없음 (SPEC-DRIFT 는 코드를 spec 에 맞춰 되돌리지 않는다 — 이미 구현된 동작은
  건드리지 않는다).
- `spec/` 변경이므로 `--spec` 재검증 필요 (CLAUDE.md 게이트).

## 반영 결과 (2026-09-12)

- `/consistency-check --spec` → `review/consistency/2026/09/12/14_11_58` **BLOCK: NO**
  (CRITICAL 0 · WARNING 1 · INFO 1).
- **제안 1·2 반영.** 단 두 곳을 draft 보다 좁게/정확하게 적었다:
  - **INFO 1 반영** — frontmatter 주석의 *"아래 첫 항목"* 서수 참조 대신 **파일명과 항목 제목을
    직접** 적었다. 순서가 바뀌면 조용히 다른 것을 가리키는 참조였다.
  - **제거 조건 서술을 실측으로 좁혔다.** draft 는 *"조건 충족"* 이라 적었는데, 실측하면
    **부착은 provider 별 주 경로에 한정**이고 fallback 이 유일한 방어인 경로가 남아 있다
    (Slack 의 비-JSON 4xx 합성 `error: 'HTTP 401'` 등). 그래서 §1.1.2 에는 *"조건문은 제거의
    **충분조건이 아니다**"* 를 함께 적었다 — 조건만 보고 지우면 그 경로들이 조용히 502 가 된다.
    남은 경로의 전수는 트래커 항목 본문에 표로 옮겼다.
- **WARNING 1 해소** — `impl-setup-error-code.md` 체크리스트를 실측 상태로 갱신했다(checker 가
  본 스냅샷은 그 갱신 **전**이다). `plan/complete/` 이동은 PR 마무리 커밋에서 한다.
- **제안 3(다른 트래커 cross-link) 도 같은 턴에 처리** — `spec-draft-nullable-notation-followups.md`
  의 「setupChannel 실패 분류」 항목을 종결하고, 「fallback 제거 판정」 항목에 실측 판정을 실었다.
