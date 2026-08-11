---
title: spec 갱신 제안 — 웹채팅 §3(재전송) 증거 포인터가 이동한 구현을 못 따라감
worktree: webchat-session-generations-ca88ae
started: 2026-07-25
owner: project-planner
priority: P2
status: complete
spec_impact:
  - spec/7-channel-web-chat/2-sdk.md
  - spec/7-channel-web-chat/3-auth-session.md
---

## Overview

`developer` 는 `spec/` 쓰기 권한이 없어 **제안만** 남긴다 (CLAUDE.md §Skill 체계).
`review/consistency/2026/07/25/00_32_05` WARNING 1 + INFO 1 에서 분리.

## 문제 — 내가 만든 drift 다

`2-sdk.md` frontmatter 의 `code:` 목록에는 다음 주석이 달려 있다:

```yaml
  # §3(재전송) `wc:boot` 재전송 계약("위젯은 **마지막** wc:boot 의 config 를 적용")의 **위젯 측** 구현.
  # 이 문서가 그 계약의 SoT 이므로 여기 증거를 건다 — 1-widget-app.md 는 재전송을 서술하지 않는다.
  - codebase/channel-web-chat/src/widget/host-bridge.ts
  - codebase/channel-web-chat/src/widget/use-widget.ts
```

그런데 §3(재전송) 을 **직접 인용하며 구현하는** `beginBootAttempt`(부팅 시도 세대 = "나중 시도가
앞선 시도를 대체") 와 그 판정자 `cannotApplyConfig`/`isAttemptStale` 은
[`useSessionGenerations` 추출](webchat-usewidget-extraction.md) 1차 slice 에서
`codebase/channel-web-chat/src/widget/use-session-generations.ts` 로 **이동했다**.
`use-widget.ts` 에는 그것을 **소비하는** `applyConfig` 만 남았다.

즉 "여기 증거를 건다" 는 주석이 가리키는 파일에 이제 계약의 정본이 없다.

### 왜 CI 가 못 잡았나

`spec-code-paths` 검사는 `code:` 의 각 항목이 **1개 이상 매치**되는지만 본다. `use-widget.ts` 는
여전히 존재하므로 통과한다 — **"존재하는가" 는 검사하지만 "그 계약이 아직 거기 있는가" 는
검사하지 않는다.** 이 종류의 drift 는 정적으로 잡히지 않아 consistency checker 가 유일한 그물이다.

## 제안

- [x] `2-sdk.md` `code:` 에 `codebase/channel-web-chat/src/widget/use-session-generations.ts` 추가
- [x] 같은 위치 인라인 주석을 정정 — 세 파일의 역할(전송 계층 / **정본** / 소비처)을 갈라 적었다.
      "심볼을 옮길 때 이 목록도 함께 옮길 것" 과 **CI 가 왜 못 잡는지**를 같은 자리에 남겼다 —
      다음 사람이 같은 drift 를 만들기 직전에 읽을 곳이 거기다.
- [x] `3-auth-session.md` `code:` 에도 동일 추가 — §3.1 재로드 복원이 `isAttemptStale` 에
      의존한다는 관계를 주석으로 명시했다(종전엔 명시 SoT 주석이 없어 checker 가 INFO 로만 봤다).

## 결정 — **지금 고친다** (2026-08-10, planner 판단)

**다음 slice 를 기다릴 것인가.** [`webchat-usewidget-extraction`](webchat-usewidget-extraction.md)
의 남은 slice 가 `applyConfig`/`start`/`teardownSession` 본체까지 옮기면 `code:` 목록을 **또**
고쳐야 한다. checker 도 "다음 slice 에서 일괄 갱신해도 무방" 으로 봤다.

**그래도 지금 고친다.** 두 비용이 대칭이 아니다:

- 미루는 비용은 **조용하다**. 이 문서를 읽는 사람이 잘못된 파일을 열고, 위에 적었듯 CI 가 그
  상태를 통과시킨다. 이 저장소가 반복해 값을 치른 실패형이 정확히 "문서가 가리키는 곳과 실제가
  어긋나 다음 사람이 조용히 잘못된 자리를 고친다" 다.
- 지금 고치는 비용은 **한 번 더 편집**이고, 그건 시끄럽다 — 다음 slice 를 하는 사람이 어차피
  이 목록을 열게 된다.

게다가 다음 slice 의 착수 시점이 정해져 있지 않다(`webchat-usewidget-extraction` 은 열린 항목
3건). "곧 어차피 고칠 것" 이라는 전제가 언제 참이 될지 모르는 상태에서 틀린 포인터를 유지하는
쪽이 더 비싸다.

> **다음 slice 담당자에게**: 본체를 옮기면 이 두 문서의 `code:` 와 그 인라인 주석을 함께
> 갱신할 것. 주석에 "심볼을 옮길 때 목록도 함께" 를 못박아 뒀다.

## Rationale

**왜 developer 가 직접 안 고쳤나.** `code:` 는 frontmatter 메타데이터라 "제품 정의" 는 아니지만,
`spec/` 파일 쓰기는 역할 경계로 금지돼 있고 [`spec-impl-evidence`](../../spec/conventions/spec-impl-evidence.md)
가 증거 규약의 SoT 다. 경계를 "사소해 보이는 편집" 으로 침식시키지 않는다.

**왜 P2 인가.** 동작 영향 0. 다만 이 저장소가 반복해서 값을 매긴 종류의 결함이다 — 문서가
가리키는 곳과 실제가 어긋나면 다음 사람이 조용히 잘못된 자리를 고친다.

## 완료 (2026-08-11) — 뒤늦은 `complete/` 이동

제안 3건은 **2026-08-10 planner 턴에서 전부 적용됐다**(위 체크박스 `[x]`). 실측 확인:
`spec/7-channel-web-chat/2-sdk.md` 의 `code:` 에 `use-session-generations.ts` 가 있고
인라인 주석이 "계약의 정본" 을 명시하며, `3-auth-session.md` 에도 동일 항목이 있다.

그런데 이 문서는 `plan/in-progress/` 에 남아 있었다 — **작업을 끝낸 PR 이 이동을 빠뜨렸다.**
`plan-lifecycle.md §3` 이 "이동만 담은 별 PR" 을 금지하므로, 다음 티켓
(`typescript-toolchain-followups` §3 처분)의 PR 에 위생으로 실어 옮긴다.

> 이 형태(**완료됐는데 `in-progress/` 에 남은 고아**)는 백로그를 훑을 때 "미완 항목 0" 으로
> 드러난다. 남은 in-progress plan 을 미완 개수로 정렬했더니 이 문서가 유일하게 0 이었다.
