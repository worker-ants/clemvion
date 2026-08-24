# Rationale 연속성 검토 — `plan/in-progress/planner-doc-batch.md`

> 검토 범위 주의: `_prompts/rationale_continuity.md` 번들은 이 plan 의 `related_specs` 후보
> 선정이 `spec/conventions/*.md` 4개(정확히 B1~B7 이 건드리는 대상 파일들)에 **애초에
> 도달하지 못하는** 기존 하네스 갭(target 문서 자신도 §"⚠️ 위 진단이 반증됐다" 에서 서술)의
> 영향을 받는다. 또한 번들 스냅샷은 `16_41_05` 라운드 이후의 수정 커밋(`dd8a17207`)을
> 반영하지 못한 **더 stale 한 시점**이었다. 판정에는 `spec/conventions/node-output.md` ·
> `egress-masking.md` · `chat-channel-adapter.md` · `conversation-thread.md` 와 target 문서
> 자체를 저장소에서 직접 `Read`/`git diff origin/main`/`git log` 로 재확인했다.

## 발견사항

- **[WARNING] target 의 "작업" 체크리스트가 B3 에 대해 이미 폐기된 근거("동일 이름·다른 계층")를 [x] 완료 항목으로 여전히 서술 — 같은 문서 안에서 자기모순**
  - target 위치: `plan/in-progress/planner-doc-batch.md` (현재 작업트리, 미커밋) `## 작업` 섹션
    line 165-166 — `- [x] B3 WS §4.4 \`nodeType\` carve-out 각주 — **"동일 이름·다른 계층"** 명시 +
    EIA §R17 · Principle 0 교차 참조 (W4)`.
  - 과거 결정 출처: (1) `spec/5-system/6-websocket-protocol.md` 자신의 `## Rationale`
    `C3 — nodeOutput 판별자 폐지` — *"노드 종류는 상위 `payload.nodeType` 로 이미 식별되므로
    `nodeOutput` 안의 `type` 판별자는 불필요·중복"* (대안 기각: `nodeOutput` 전용 별도 스키마).
    (2) 같은 plan 의 `review/consistency/2026/08/24/16_41_05/RESOLUTION.md` CRITICAL 1 —
    *"'동일 이름·다른 계층' 각주는 원문에 없는 해석으로 `nodeOutput.nodeType` 을 정당화했고,
    그건 WS 자신의 C3 가 명시적으로 기각한 패턴이다"* 라고 target 스스로 이미 판정·기록한 바로
    그 문구다.
  - 상세: `16_41_05` 라운드에서 정확히 이 "동일 이름·다른 계층" 프레임이 **기각된 C3 판별자를
    재해석으로 되살리는 CRITICAL** 로 지적됐고, 후속 커밋 `dd8a17207`
    (`fix(spec): 기각된 대안을 재해석으로 되살릴 뻔했다`)가 실제 spec 파일
    (`spec/5-system/6-websocket-protocol.md` §4.4 각주)을 *"C3 는 지켜지고 있고 엔진은
    `nodeType` 을 넣지 않는다 — allowlist 는 예방적 허용일 뿐, 새 코드가 쓰면 여전히 C3
    위반"* 으로 다시 썼다(확인: `git show dd8a17207 -- spec/5-system/6-websocket-protocol.md`).
    target 문서 자신도 이 정정을 새 체크리스트 항목(line 155-157, `- [x] B3 각주 재작성 —
    초판의 "래퍼만 금지, 이름은 무관"은 원문에 없는 해석이었다 ...`)으로 정확히 기록했다.
    **그런데 그 몇 줄 아래(165-166)에 있던 원래 체크리스트 항목은 지우거나 취소선 처리하지
    않고 그대로 남아 있다** — 이 문서 전체가 반복 사용하는 자기 정정 관례
    (`~~쓴 뒤 돌려야 대상 문서가 적재된다~~` 처럼 취소선 + 정정문)를 이 자리에서만 어겼다.
    실질 위험: `codebase/**` 를 건드리지 않는 순수 문서 PR 이지만, 이 plan 은 이후 developer
    턴이 참조할 최종 기록이다. 체크리스트만 훑는 독자(사람이든 다른 checker 든)는 "B3 는
    동일 이름·다른 계층 논리로 해결됨" 이라는, 실제로는 폐기된 결론을 최종 결정으로 오독할
    수 있다 — 정확히 이 plan 이 `13_30_49`→`16_41_05` 두 라운드에 걸쳐 겪은 실패 패턴
    (기각된 대안을 다른 말로 되살림)이 문서 잔존물 형태로 남아 있는 것이다.
  - 제안: line 165-166 을 line 155-157 과 동일한 관례로 정정한다 — 원문("동일 이름·다른
    계층" 명시)에 취소선을 긋고, *"→ `16_41_05` CRITICAL 로 반증. 실제 각주는 'C3 는 지켜지고
    있고 엔진은 nodeType 을 넣지 않는다' 로 재작성(line 155-157 참조)"* 같은 정정 주석을
    붙인다. `- [ ] /consistency-check --spec 3회차` 를 이번 라운드로 소진 처리하기 전에 이
    자기모순을 먼저 닫는 것이 안전하다(3회차 게이트가 이 target 스냅샷을 다시 볼 것이기
    때문).

## 확인 완료 (문제 없음)

아래 항목은 `spec/conventions/node-output.md` · `egress-masking.md` · `chat-channel-adapter.md` ·
`conversation-thread.md` · `spec/5-system/6-websocket-protocol.md` · `14-external-interaction-api.md` ·
discord/slack/telegram provider 문서를 `origin/main` 대비 `git diff` 로 직접 대조해 확인했다.

- **B1** (wire-only 8키 각주, `node-output.md` Principle 0): 기존 5필드 계약을 넓히지 않고
  "계약 밖" 으로 명시 프레임 — Principle 0 본문과 정합. 코드(`node-output-allowlist.ts`)의
  `NODE_OUTPUT_ALLOWED_KEYS` 8키와 일치.
- **B2** (`egress-masking.md` §2 4단계 + `allowlistFanoutNodeOutput` 각주): §1 좌표계·
  `## Rationale`("세 상한을 하나로 합치지 않는다" 기각 대안)과 무관한 축(필드 allowlist)이라
  충돌 없음. line 84 의 `ws-event-types-extract.md` 미해결 캐비엇 유지 확인.
- **B3 (spec 본문)**: 위 WARNING 에서 다룬 체크리스트 잔존물을 제외하면, 실제 적용된
  `spec/5-system/6-websocket-protocol.md` §4.4 각주는 C3 를 위반하지 않는다 — 오히려
  "새 코드가 `nodeOutput.nodeType` 을 쓰면 C3 위반" 이라고 **강화**해 명시한다.
- **B4** (won't-do): `spec/conventions/spec-impl-evidence.md` §2.1 의 `code:` 정의("본 spec 이
  약속한 surface 의 구현 경로")와 정합 — `websocket.service.ts` 를 conversation-thread 의
  `code:` 에 넣지 않기로 한 판단에 근거 오류 없음.
  `- [x] ~~B4~~ **won't-do 판정**` (line 167) 은 취소선 관례를 올바르게 따랐다.
- **B5** (WS §3.2 행 추가, `{id}` 브래킷): §3.3 인가 표의 기존 `background:run:{id}` 표기와
  정합(사전에 `{id}` 브래킷이 이미 그 문서 컨벤션이었음을 확인). `16_41_05` WARNING1
  (`{runId}`→`{id}`) 은 이미 정정 반영됨.
- **B6** (3곳 → 정본 링크): `chat-channel-adapter.md`·`conversation-thread.md`·
  `14-external-interaction-api.md` 세 곳 모두 "래퍼/도메인 값 구분의 정본은 node-output.md
  Principle 0" 로 인용만 하고 재진술하지 않음 — WS §4.1-a 는 이미 링크돼 있어 손대지
  않았다는 claim 도 실측 확인.
- **B7** (provider 표 프레이밍 각주): discord/slack/telegram 세 파일 공히 "이 표는 핸들러
  출력(`NodeHandlerOutput.output`) 기준" 각주를 추가하고 경로는 그대로 유지 — telegram
  `## Rationale` R3(v1=chart only)·R4(escape 책임)와 충돌 없음, `#1209` 가 이 세 파일을 안
  고친 판단을 재확인하는 방향이라 무근거 번복이 아니다.

## 요약

target 이 해소한 B1·B2·B4·B5·B6·B7, 그리고 이미 한 차례(`16_41_05`) CRITICAL 로 지적돼
재작성된 B3 spec 각주는 실제 저장소 대조 결과 각 spec 의 `## Rationale`·설계 원칙과 정합한다.
다만 그 CRITICAL 을 유발했던 정확히 그 문구("동일 이름·다른 계층")가 target plan 문서 자신의
"작업" 체크리스트 안에 취소선 없이 `[x]` 완료 항목으로 여전히 남아 있어, 문서 내부에서
"폐기된 근거"와 "재작성된 근거"가 병존하는 자기모순 상태다. 실제 spec 파일(WS protocol §4.4)은
안전하므로 라이브 invariant 위반은 아니지만, plan 자체가 향후 참조될 기록이라는 점에서 방치하면
같은 오독이 재발할 수 있다.

## 위험도

MEDIUM
