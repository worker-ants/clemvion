# RESOLUTION — `change-password` 코드 정렬 리뷰 3라운드

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **1** · INFO 12

**WARNING 1건 조치.** 그건 코드가 아니라 **내가 같은 커밋 안에서 같은 정정을 두 방식으로 한 것**
이었다.

## W1 — spec 정정에서 취소선 보존(조건 4)을 빠뜨렸다

`--impl-done` 이 반증한 "순환 의존이라 불가능" 을 고치면서, **plan 파일에는** 원문을
`~~...~~ — 이 근거는 틀렸다` 로 남겼는데 **spec 파일에는** 통째로 새 문장으로 갈아 끼웠다.
scope·side_effect 두 reviewer 가 독립적으로 잡았다.

실측으로 확인했다:

| 파일 | `~~` 개수 (조치 전) |
|---|---|
| `plan/.../auth-change-password-oauth-only-code-split.md` | **2** |
| `spec/5-system/1-auth.md` | **0** |

**왜 문제인가** — spec 만 보는 사람은 그 문장이 *처음부터 옳게 쓰였는지* 아니면 *나중에 조용히
고쳐졌는지* 구분할 수 없다. 감사 트레일이 끊긴다. CLAUDE.md 의 자기-반증형 소정정 5조건 중
조건 4가 정확히 이걸 막으려는 것이다.

원문을 취소선으로 되살리고 정정 사유·실측을 이어 붙였다.

## 부수 — 가드가 plan 이동의 나머지 절반을 잡았다

`complete/` 로 옮기면서 frontmatter `status: in-progress` 를 그대로 뒀다. 이동은 두 부분인데
한쪽만 했다. `plan-frontmatter` 가드가 파일명까지 짚어 잡았고, `complete/` 179건이 쓰는
`status: complete` 로 맞췄다.

> **가드가 없었으면 놓쳤다.** 이번 PR 에서 링크 가드(앵커 3곳)·타입 ratchet(진단 3건)·이 가드까지
> **세 번** 내 편집의 나머지 절반을 잡아 줬다.

## 미조치 (판단 유지)

수렴 판단: **발견의 성격이 동작 → 문서 → 절차로 내려왔고**, 3R 의 유일한 WARNING 은 코드가
아니라 문서 절차였다. 남은 INFO 는 전부 비차단이고 아래 둘은 **의도적으로 닫지 않는다.**

- **#7** `codeOf` 를 `rejectionOf` 위에 얹는 리팩터 — reviewer 스스로 *"사소, 필수 아님"* 이라
  적었다. 이걸 하면 `codebase/` 가 또 바뀌어 **4R 전체를 돌려야 한다.** 순수 미용 목적으로
  라운드를 하나 더 도는 것은 비용이 이득을 넘는다.
- **#1** `sessions.service.spec.ts` 의 인라인 추출을 `__test-utils__` 로 승격 — reviewer 가
  *"3번째 소비처가 생길 때"* 를 조건으로 달았다. 지금은 2곳이다.
- **#2** Swagger description 세분화 — **3라운드 연속 같은 판단**(`swagger.md` 규약 범위).
- **#4** OAuth-only 분기의 조기 반환 타이밍 차 · **#11** `@Throttle` 미적용 — 둘 다 **선재 상태**로
  이번 diff 의 회귀가 아니며 self-scope 라 실익이 낮다.
- **#9** e2e 가 `UPDATE ... password_hash = NULL` 로 상태를 합성 — reviewer 가 현재 분기 조건
  (`passwordHash` 단일 검사) 기준 **관측 동등**함을 확인했다.
- **#10** plan `complete/` 이동 — **이 라운드에서 완료**했다(위 부수 항목).

## 검증

docs·링크 가드 **3157**(plan-frontmatter 포함) · lint · unit · build · e2e(**292**) **PASS** ·
backend ratchet **198/37** · frontend ratchet **52/15** ·
`--impl-done` **BLOCK: NO · 전 checker NONE · Warning 0**.
