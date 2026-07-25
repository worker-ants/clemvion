---
title: spec 갱신 제안 — 웹채팅 §3(재전송) 증거 포인터가 이동한 구현을 못 따라감
worktree: webchat-session-generations-ca88ae
started: 2026-07-25
owner: project-planner
priority: P2
status: in-progress
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

- [ ] `2-sdk.md` `code:` 에 `codebase/channel-web-chat/src/widget/use-session-generations.ts` 추가
- [ ] 같은 위치 인라인 주석을 정정 — 정본은 `use-session-generations.ts`(세대 발급·판정),
      `use-widget.ts` 는 그 소비처(`applyConfig`)라는 관계가 드러나게
- [ ] `3-auth-session.md` `code:` 에도 동일 추가 — §3.1 재로드 복원 시퀀스가 `isAttemptStale` 에
      의존한다 (checker INFO 1. 명시적 SoT 주석이 없어 WARNING 까지는 아니라고 판정됐다)

## 결정이 필요한 지점

**다음 slice 를 기다릴 것인가.** [`webchat-usewidget-extraction`](webchat-usewidget-extraction.md)
의 남은 slice 가 `applyConfig`/`start`/`teardownSession` 본체까지 옮기면 `code:` 목록을 **또**
고쳐야 한다. checker 도 "다음 slice 에서 일괄 갱신해도 무방" 으로 봤다.

다만 그 사이 이 문서를 읽는 사람은 잘못된 파일을 열게 되고, 위에 적었듯 CI 는 이 상태를 통과
시킨다. 두 번 고치는 비용 vs 그동안 틀린 포인터를 두는 비용의 판단이라 planner 에게 넘긴다.

## Rationale

**왜 developer 가 직접 안 고쳤나.** `code:` 는 frontmatter 메타데이터라 "제품 정의" 는 아니지만,
`spec/` 파일 쓰기는 역할 경계로 금지돼 있고 [`spec-impl-evidence`](../../spec/conventions/spec-impl-evidence.md)
가 증거 규약의 SoT 다. 경계를 "사소해 보이는 편집" 으로 침식시키지 않는다.

**왜 P2 인가.** 동작 영향 0. 다만 이 저장소가 반복해서 값을 매긴 종류의 결함이다 — 문서가
가리키는 곳과 실제가 어긋나면 다음 사람이 조용히 잘못된 자리를 고친다.
