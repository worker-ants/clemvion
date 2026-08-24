# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-done, `node-output-envelope`)

## 컨텍스트 (검토자가 확인한 사실)

- 프롬프트 번들은 컨텍스트 예산 초과로 `<git diff origin/main...HEAD -- code_areas>` 자체와
  `spec/5-system/14-external-interaction-api.md` 를 포함한 다수 파일이 생략됐다. "여기 없다는
  사실을 근거로 삼지 말라"는 지시에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/node-output-envelope-458f05`)
  를 절대경로로 직접 `git diff`/`Read`/`grep` 하여 보완했다.
- 이번 라운드는 직전 `--impl-prep` 라운드(`10_44_28`)가 지적한 4건(CRITICAL 1 · WARNING 2 ·
  INFO 1 — WS §4.4/EIA §R17 vs 코드 배선 모순, `conversation-thread.md` spec_impact 누락,
  잔여 위험 caveat 누락, WS §4.1 `.failed` 행 `output` 누락)이 실제로 이 diff 에서 모두
  반영·해소됐음을 확인했다(`spec/5-system/14-external-interaction-api.md` §R17 재정정 블록,
  `spec/5-system/6-websocket-protocol.md` §4.1/§4.4, `spec/conventions/conversation-thread.md`
  §8.4 전부 갱신됨). **이 라운드에서는 그 4건을 재보고하지 않는다.**
- 이번 라운드에서 새로 조사한 것은 (a) target 이 새로 확정한 "wire `output` = `NodeHandlerOutput`
  래퍼 전체, 도메인 값은 한 겹 더 아래 `output.output`" 이라는 계약이 `spec/5-system/` 밖의
  형제 spec/convention 문서와 정합한지, (b) 코드가 실제로 그 계약을 따르는지다.

---

## 발견사항

### [WARNING] `spec/conventions/chat-channel-adapter.md` §1.3 + `spec/5-system/15-chat-channel.md` CCH-MP-06 이 target 이 정정한 wire `output` 래퍼/도메인값 구분을 반영하지 못한 채 남음

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.1 (diff) —
  > "**wire 의 `output` 은 `NodeExecution.outputData` 전체**(= `NodeHandlerOutput` 래퍼)다 —
  > 그 안의 도메인 값은 한 겹 더 아래인 `output.output`이고 … **래퍼(`output`)와 도메인 값
  > (`output.output`)은 이름이 겹칠 뿐 다른 층이다** — 종전 서술은 wire `output` 을 도메인
  > 값으로 적어 한 겹 얕았다"
  (이 정정은 직전 라운드 `10_44_28` naming_collision W2 의 후속 조치다.)
- **충돌 대상**:
  - `spec/conventions/chat-channel-adapter.md:166-186` — `ChatChannelInternalEvent`
    (`execution.node.completed`) 타입 정의. 주석: **`/** NodeHandlerOutput.output — 예:
    Template 의 `{rendered, ...}`, Carousel 의 `{items, ...}`. */`**(line 180) — 이 필드가
    `NodeHandlerOutput` **의 `output` 서브필드**(도메인 값 그 자체, 예 `{rendered: '...'}`)라고
    명시. 바로 위 line 174 는 "SoT: WS §4.4 execution.node.completed — same event name" 이라
    적어 WS §4.4 를 SoT 로 지목한다.
  - `spec/5-system/15-chat-channel.md:81` CCH-MP-06 — "`template` 은 `output.rendered` 텍스트
    그대로" (SoT 로 `chat-channel-adapter.md §1.3` 를 명시적으로 인용, line 81 각주).
- **상세**: target 정정에 따르면 `execution.node.completed` 의 wire `output` 필드는
  `NodeHandlerOutput` **래퍼 전체**(`{config, output, port, status, meta}`)이고, `rendered`
  같은 도메인 값은 `output.output.rendered` 에 있다. 그런데 `chat-channel-adapter.md` §1.3
  은 정확히 그 필드를 **"`NodeHandlerOutput.output`"**(도메인 값, `{rendered, ...}`) 이라고
  타입 주석에 명시하고, 그 SoT 로 WS §4.4 를 인용한다 — 이제 자신이 지목한 SoT 와 반대
  주장을 하는 상태가 됐다. `15-chat-channel.md` CCH-MP-06 의 "`output.rendered` 텍스트
  그대로" 도 같은 (도메인 값 직접 접근) 가정에 의존한다. 이 둘은 target diff 범위(`spec/5-system/`)
  밖이라 이번 PR 에서 갱신되지 않았다(`git diff origin/main...HEAD -- spec/5-system/15-chat-channel.md
  spec/conventions/chat-channel-adapter.md` 결과 diff 없음 — 확인 완료).
  - **실 코드는 이미 래퍼를 전제로 짜여 있어 런타임 파손은 없다** — `chat-channel.dispatcher.ts`
    의 `toChatChannelEvent` 는 raw fanout payload 의 `output`(=래퍼)을 그대로
    `ChatChannelInternalEvent.output` 에 넣고(`output.status === 'waiting_for_input'` 로
    분기하는데, `status` 는 `NodeHandlerOutput` 의 top-level 필드라 래퍼가 아니면 애초에
    존재하지 않는 필드다 — 이 자체가 코드가 래퍼를 전제한다는 증거), telegram/discord/slack
    3개 렌더러의 `extractRendered()` 는 `nodeOutput.rendered`(flat) / `nodeOutput.payload.rendered`
    / **`nodeOutput.output.rendered`**(주석: "2. `nodeOutput.output.<field>` — graph 노드
    handler structured return shape (CCH-MP-06)") 세 후보를 순서대로 확인한다 — 이미 "회귀 ⑤"
    로 명명된 과거 버그 수정에서 래퍼 shape 을 흡수해 뒀다. 즉 **코드는 target 의 정정된
    이해와 일치**하지만, **두 spec 문서의 타입 주석·서술은 여전히 (틀렸던) 옛 이해를 담고
    있다** — 새 독자가 `chat-channel-adapter.md` 의 명시적 타입 주석만 보고 어댑터를 새로
    짤 경우 `event.output.rendered` 를 직접 읽는 코드를 쓰게 되어(주석이 그렇게 지시한다)
    실제로는 `undefined` 를 받는 결함을 재현할 위험이 있다.
- **제안**: `spec/conventions/chat-channel-adapter.md:180` 의 타입 주석을
  `NodeHandlerOutput`(래퍼 전체)로 정정하고, 도메인 값은 `output.output` 임을 명시한다.
  `spec/5-system/15-chat-channel.md:81` CCH-MP-06 의 "`output.rendered`" 표현도 래퍼/도메인값
  구분(`output.output.rendered`, 단 legacy flat fallback 은 `output.rendered` 로 유지되는
  다층 candidate 라는 점)을 반영해 정정한다. 두 문서 모두 target 정정과 같은 커밋 범위
  (planner 턴)에서 함께 갱신하는 것이 이 저장소가 반복 겪은 "동일 사실이 여러 SoT 에 흩어져
  한 곳만 고쳐지는" 패턴(직전 라운드가 `conversation-thread.md` 에 대해 지적한 것과 동일 클래스)
  의 재발을 막는다.

---

## 확인했지만 문제 없음 (참고)

- **직전 라운드(`10_44_28`) CRITICAL 1건·WARNING 2건·INFO 1건 전부 해소 확인**:
  - WS §4.4 캐비엇 / EIA §R17 표 / 코드(`websocket.service.ts`) 세 곳 모두 이제 "fail-closed
    allowlist, 2026-08-24 추가"로 일치.
  - `spec/conventions/conversation-thread.md:392` 도 취소선 정정 반영됨(spec_impact 에 등재돼
    있었고 실제로 갱신됨).
  - EIA §R17 재정정 블록에 `nodeOutputCache` 폴백의 잔여 위험 caveat 이 명시적으로 포함됨
    ("남은 위험은 하나 — …").
  - WS §4.1 표에 `execution.node.failed` 의 `output` 필드가 추가됨.
- **레이어 책임 분리 유지**: `allowlistFanoutNodeOutput` 확장(`narrowTopLevelNodeOutput` 헬퍼
  도입)은 여전히 `toFanoutEnvelope`(외부향 clone) 안에서만 적용되고, `broadcastToChannel`
  로 나가는 내부 WS wire 는 원문 그대로다 — WS §4.4 "내부 WS 는 대상이 아니다" 불변식과
  일치(테스트로도 고정됨).
- **종결 3종(`execution.completed`/`.failed`/`.cancelled`) 오적용 없음**: 최상위 키 이름이
  `output`/`nodeOutput` 이 아니라 `result`/`error` 라 `narrowTopLevelNodeOutput` 의 대상이
  구조적으로 아니다.
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 등재된 잔여 항목**
  (`finalAdapted ?? nodeOutputCache` 폴백의 영속 계약 문제, `background:run:{id}` 채널이
  WS §3.2 표에서 누락, `buttonConfig.nodeOutput` 행의 `nodeType` carve-out 각주 누락)은
  모두 owner=planner 로 명시적으로 이관되어 있고 이번 diff 범위(자기-반증형 소정정 5조건)
  밖이라 재보고하지 않는다.

---

## 요약

target(`spec/5-system/6-websocket-protocol.md` + `14-external-interaction-api.md` +
`conventions/conversation-thread.md`)은 직전 `--impl-prep` 라운드가 지적한 코드-스펙 모순을
전부 해소했고, `execution.node.*` 의 `envelope.output` 을 fail-closed allowlist 로 닫으면서
wire `output` 필드가 `NodeHandlerOutput` **래퍼 전체**이고 도메인 값은 한 겹 더 아래
(`output.output`)라는 정확한 층 구분도 새로 명시했다 — 코드(`websocket.service.ts`,
`execution-engine.service.ts`, chat-channel 3개 provider 렌더러)는 이미 이 이해와 일치하게
동작한다. 다만 그 정정이 `spec/5-system/` 경계 밖의 두 형제 문서
(`spec/conventions/chat-channel-adapter.md` §1.3 타입 주석, `spec/5-system/15-chat-channel.md`
CCH-MP-06)까지는 미치지 못해, 이 둘은 여전히 "wire `output` = 도메인 값"이라는 (target 이 방금
틀렸다고 밝힌) 옛 이해를 명시적으로 서술한 채 남아 있다 — 코드가 방어적으로 짜여 있어 현재
런타임 파손은 없지만, 그 주석을 SoT 로 신뢰해 새 코드를 짜면 재현 가능한 결함이다. 이 1건 외
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다.

## 위험도

MEDIUM
