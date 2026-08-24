# 정식 규약 준수 검토 — convention_compliance

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
target: `spec/conventions/**`(diff 대상: `chat-channel-adapter.md`, `conversation-thread.md`) + 연관 코드(`websocket.service.ts`)

## 사전 확인 — 이 검토가 "약속된 게이트" 다

`plan/complete/node-output-envelope.md` frontmatter 와 커밋 `e6a017a18` 본문은 `conversation-thread.md`
§8.4 의 자기-반증형 소정정에 대해 **"`--impl-done` 을 `spec/conventions/` 스코프로 반드시 돌린다"**
는 CLAUDE.md 게이트를 명시했고, 직전 라운드(`review/consistency/2026/08/24/12_02_30`, scope=`spec/5-system/`)
의 WARNING #2 가 "그 실행 증거가 없다" 고 지적했다. 본 실행(scope=`spec/conventions/`)이 바로 그 약속된
게이트다 — 이 사실 자체는 발견사항이 아니라 맥락 기록.

## 발견사항

- **[CRITICAL] `chat-channel-adapter.md` §3 매핑 표가 같은 파일 §1.3 에서 방금 고친 "래퍼/도메인값" 정정을 다시 어긴다**
  - target 위치: `spec/conventions/chat-channel-adapter.md:382` — "## 3. EIA / Internal Event → renderNode 매핑" 표의 `execution.node.completed` 행, `template` 서브케이스: `` `template`: `output.rendered` 를 `text` 1건 (MarkdownV2 escape) `` (SoT 로 §3.3 CCH-MP-06 을 명시 인용)
  - 위반 규약: 같은 파일 §1.3 `ChatChannelInternalEvent.output` 필드의 JSDoc(`chat-channel-adapter.md:181-190`, 이번 diff 로 정정됨) — "`NodeHandlerOutput` 래퍼 전체다. 도메인 값은 한 겹 아래인 `output.output` 이다 … 이 주석을 SoT 로 믿고 `output.rendered` 를 직접 읽으면 `undefined` 다." 및 이 표 행이 SoT 로 인용하는 `spec/5-system/15-chat-channel.md` CCH-MP-06(이번 diff 로 `output.output.rendered` 로 정정됨)
  - 상세: 이번 PR 은 "wire `output` = `NodeHandlerOutput` 래퍼, 도메인 값은 `output.output`" 오해를 두 곳(§1.3 JSDoc, `15-chat-channel.md` CCH-MP-06)에서 정정했고, 직전 라운드(`12_02_30` cross_spec WARNING #1)가 지적한 "형제 문서 미반영"도 커밋 `feb1967a2` 로 스윕했다. 그런데 **같은 파일 안의 세 번째 자리**(§3 매핑 표, `execution.node.completed` 행의 `template` 서브케이스)는 스윕에서 빠졌다 — 여전히 `output.rendered` 로 적혀 있다. 이 표는 실제로 SoT 로 CCH-MP-06 을 인용하는데, 인용 대상은 이미 `output.output.rendered` 로 바뀌었으니 인용원과 인용처가 서로 어긋난 상태다. `carousel`/`table`/`chart` 서브케이스는 별도 fallback 함수(`renderCarouselFallback` 등) 재사용이라 이 문제에서 비켜나 있지만, `template` 서브케이스만 필드 경로를 직접 산문으로 적어 두어 구멍이 남았다. adapter 구현자가 이 §3 표를 그대로 따라 `event.output.rendered` 를 읽으면 `undefined` 다 — 바로 위 §1.3 JSDoc 이 명시적으로 경고하는 바로 그 실수를, 같은 문서의 실사용 표가 200줄 뒤에서 재현하고 있다. 정식 규약 문서 자체의 내부 자기모순이며, 이 PR 이 고치려던 "한 겹 얕은 필드 읽기" 버그 클래스를 그대로 남겨 둔 것이다.
  - 제안: `chat-channel-adapter.md:382` 의 `template: \`output.rendered\`` 를 `template: \`output.output.rendered\`` (+ 필요시 "래퍼는 §1.3 참조" 앵커)로 정정. `carousel`/`table`/`chart` 서브케이스가 참조하는 `renderCarouselFallback` 등이 래퍼 전체(`output`)를 받는지 도메인 값(`output.output`)을 받는지도 이 기회에 명시하면 재발 방지에 도움. 정정 범위가 이 PR 이 이미 건드린 동일 오해의 세 번째 자리이므로, 이번 PR 안에서 같은 "미러 스윕" 커밋으로 처리하는 것이 자연스럽다(별도 planner 턴 불요 — 문장 자체가 §1.3/CCH-MP-06 과 동일한 사실 오류의 반복이며 API 계약 신설이 아니다).

- **[INFO] 같은 미반영 패턴이 scope 밖(spec/conventions/ 아님) provider 문서 3곳에도 남아있다 — 참고용, 이번 게이트의 판정 대상은 아님**
  - target 위치: 해당 없음(관찰은 `spec/4-nodes/7-trigger/providers/telegram.md:160`, `slack.md:233`, `discord.md:256` — 모두 `output.rendered` 직접 인용)
  - 위반 규약: 직접 위반 아님 — 이 세 파일은 `spec/conventions/` 밖이라 본 게이트(`scope=spec/conventions/`) 판정 대상이 아니고, `§5.4`/`CCH-MP-04`/`CCH-MP-06` v1 fallback 렌더 함수가 실제로 어떤 인자(래퍼 전체 vs 도메인 값)를 받는지는 코드 확인 없이는 단정할 수 없어 CRITICAL 로 올리지 않음
  - 상세: `chat-channel-adapter.md:382` 위 CRITICAL 과 표현이 같아(`output.rendered` 직접 인용) 같은 오해가 provider 문서군에도 퍼져 있을 가능성을 시사. 다만 이 문서들의 `output.rendered` 는 §5.4 fallback 함수 시그니처 안에서의 지역 표현일 수 있어(예: 함수가 `NodeHandlerOutput.output` 을 이미 벗겨서 받는 설계라면 정확함), 이번 diff 범위 밖 판단으로 남긴다
  - 제안: `spec/conventions/` 스코프의 이번 정정을 반영하는 후속 스윕(또는 `--impl-done spec/4-nodes/7-trigger/providers/` 라운드)에서 위 세 파일의 `output.rendered` 표현이 래퍼/도메인 구분과 정합하는지 확인 권고. 강제 아님(scope 밖)

## 요약

이번 diff 는 CLAUDE.md 「자기-반증형 소정정」 예외의 5개 조건을 `conversation-thread.md` §8.4 한 문장에 한정해 모범적으로 준수했고(git blame 상 원 문장 작성자 = 이 브랜치 커밋 작성자, 취소선 보존, 실측 인용, `spec_impact` 명시, 커밋 본문에 실측 기록), API 계약 성격의 나머지 정정(EIA §R17, WS §4.4, `chat-channel-adapter.md` §1.3, `15-chat-channel.md` CCH-MP-06)은 예외를 원용하지 않고 planner 턴 성격으로 명시 구분해 처리했다 — 프로세스 규약 준수는 우수하다. 다만 "정식 규약" 문서 자체의 정확성 관점에서, `chat-channel-adapter.md` 는 같은 PR 안에서 §1.3 JSDoc 을 정정하면서도 §3 매핑 표(같은 파일, SoT 로 인용하는 대상 자체가 이미 갱신됨)의 동일 오해 지점을 놓쳐 문서가 자기모순 상태로 남았다 — adapter 구현자가 그대로 따르면 재현 가능한 결함(`undefined` 필드 접근)을 만드는 CRITICAL 1건을 발견했다. 이 문서 밖(provider 3개 문서)의 같은 표현은 스코프 밖이라 INFO 로만 기록한다.

## 위험도
HIGH — target 문서(정식 규약) 자체가 자기모순 상태로 실사용 표에 오류를 남겼고, 채택 시 chat-channel adapter 구현이 실제로 깨지는 필드 접근 패턴을 그대로 노출한다. CRITICAL 발견 1건.
