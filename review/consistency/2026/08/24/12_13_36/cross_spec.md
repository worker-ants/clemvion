# Cross-Spec 일관성 검토 — `spec/conventions/` (--impl-done, `node-output-envelope`)

## 컨텍스트 (검토자가 확인한 사실)

- 프롬프트 번들은 컨텍스트 예산 초과로 `spec/conventions/node-output.md` 를 포함한 대다수 conventions
  파일과 `<git diff origin/main...HEAD -- code_areas>` 가 생략됐다. "여기 없다는 사실을 근거로
  삼지 말라"는 지시에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/node-output-envelope-458f05`)
  를 절대경로로 `git diff`/`Read`/`grep` 하여 직접 보완했다.
- 이번 라운드(`12_13_36`)는 직전 `12_02_30` cross_spec 라운드가 WARNING 으로 지적한 건
  (`chat-channel-adapter.md` §1.3 + `15-chat-channel.md` CCH-MP-06 이 wire `output` 래퍼/도메인값
  구분을 반영 못함)이 이번 커밋(`feb1967a2`)에서 해소됐음을 diff 로 확인했다. 이 커밋은
  스스로도 "형제 문서 둘을 고쳤다"(§1.3 주석 + CCH-MP-06) 고 명시한다.
- 그런데 **같은 계약을 담은 세 번째 자리가 같은 파일(`chat-channel-adapter.md`) 안에 남아
  있음**을 발견했다 — 아래 발견사항. 이는 정확히 직전 라운드가 지적한 것과 **같은 클래스의
  결함**(래퍼/도메인값 한 겹 착시)이 같은 스윕에서 또 누락된 사례다.
- 검증한 것: (a) `spec/conventions/node-output.md` §3.2 의 `output.error` 가 `NodeHandlerOutput`
  자체(비-wire) 맥락임을 확인해 WS §4.1 정정과 정합함(충돌 없음), (b) provider spec
  (`telegram.md`/`slack.md`/`discord.md`)의 잔존 `output.rendered` 서술은 커밋이 명시적으로
  "wire 맥락이 아니라 NodeHandlerOutput 자체 서술"이라 판단해 의도적으로 남긴 것이며, 코드
  (`*-message.renderer.ts` 의 `payload → output → config → flat` 우선순위 폴백)가 실제로 두
  shape 를 모두 방어적으로 훑어 런타임 파손이 없음을 확인함 — 이 부분은 충돌 아님.
- `codebase/backend/src/modules/websocket/websocket.service.ts` 가 `allowlistNodeOutputKeys` 를
  node.completed/.failed 표면에도 적용하고 있음을 확인 — spec 이 주장하는 "같은 chokepoint,
  같은 allowlist" 배선과 정합.

---

## 발견사항

### [WARNING] `chat-channel-adapter.md` §3 매핑 표가 같은 파일 §1.3 이 방금 정정한 wire `output` 래퍼/도메인값 구분을 반영하지 못한 채 남음 (미러 스윕 누락, 세 번째 자리)

- **target 위치**: `spec/conventions/chat-channel-adapter.md:382` (§3 "EIA / Internal Event →
  renderNode 매핑" 표, `execution.node.completed` 행) —

  > `template`: `output.rendered` 를 `text` 1건 (MarkdownV2 escape). `carousel`/`table`/`chart`:
  > §5.4 v1 fallback 의 `renderCarouselFallback`/`renderTableFallback`/`renderChartFallback`
  > 그대로 재사용. … SoT: [Spec Chat Channel §3.1 CCH-AD-07] / §3.3 CCH-MP-06.

  이 행의 "입력 payload" 열은 `node.type ∈ {template, carousel, table, chart}` + **`output`**
  이라고 명시하며, 이 `output` 은 바로 위 §1.3 에서 정의한 `ChatChannelInternalEvent.output`
  필드(같은 파일, line 166-186) 그 자체다.

- **충돌 대상**: 같은 파일 내부 자기모순 + cross-file 모순 두 갈래:
  1. **같은 파일 §1.3** (line 178-194, 이번 커밋이 방금 고친 자리): `output` 필드 주석이
     "`NodeHandlerOutput` 래퍼 전체 … 도메인 값은 한 겹 아래인 `output.output` 이다 …
     `output.rendered` 를 직접 읽으면 `undefined` 다" 라고 **명시적으로 경고**한다. §3 표는
     바로 그 경고 대상인 `output.rendered` 를 여전히 정답인 것처럼 적고 있다.
  2. **`spec/5-system/15-chat-channel.md:81` CCH-MP-06** (이번 커밋이 방금 고친 sibling): 정확히
     같은 이벤트(`execution.node.completed`, template 케이스)에 대해 이제
     `output.output.rendered` 로 정정돼 있고, 각주로 "렌더러는 legacy flat fallback 도 함께
     훑는다" 까지 부연했다. `chat-channel-adapter.md:382` 는 CCH-MP-06 을 **SoT 로 역참조**하는
     같은 표 행인데, 문구는 CCH-MP-06 정정 이전 상태 그대로다.
- **상세**: 이번 커밋의 메시지는 "§1.3 만 고치고 같은 주장을 담은 형제 둘(§1.3 주석 +
  CCH-MP-06)을 안 고쳤다"는 직전 라운드 지적을 처리하며 정확히 이 두 자리만 스윕했다. 그런데
  **같은 주장을 담은 세 번째 자리**(§3 표, 같은 파일 안, `output` 필드를 다시 언급하는 곳)가
  스윕 범위 밖에 남았다. 커밋 자신이 "과잉 정정은 하지 않았다 … wire 맥락에서만 성립한다" 며
  provider spec (`telegram.md` 등)은 의도적으로 남겼다고 밝혔는데, 그 배제 기준("wire 맥락이냐")
  으로 판정하면 이 §3 표 행은 **wire 맥락이 맞다** — `ChatChannelInternalEvent.output` 이라는
  동일 TypeScript 필드를 같은 파일 200줄 위에서 정의하고 그 정의를 그대로 소비하는 자리이기
  때문에, provider spec 배제 사유(그쪽은 `NodeHandlerOutput` 자체를 서술)가 적용되지 않는다.
  런타임 파손은 없다(렌더러가 `payload → output → config → flat` 우선순위로 방어적으로 훑음,
  §1.3 주석과 동일 논거) — 그래서 CRITICAL 이 아니라 직전 라운드와 동일하게 WARNING.
- **제안**: `chat-channel-adapter.md:382` 의 `template`: `output.rendered` → `output.output.rendered`
  로 정정하고 (§1.3/CCH-MP-06 과 동일한 "wire 래퍼 전체, 도메인 값은 한 겹 아래" 각주를 짧게
  덧붙이거나 §1.3 앵커로 링크). 이 정정은 developer 자기-반증형 소정정 요건(스스로 쓴 §1.3
  예고를 실측 없이 확장하는 것이 아니라 **이미 반증된 문구의 세 번째 미러**를 닫는 것)에 해당할
  가능성이 높으나, CLAUDE.md 예외 조건 2(예고·트리거 한정, 제품 정의/요구사항/API 계약 제외)에
  비추어 이 필드는 어댑터 API 계약(§1 인터페이스 타입 주석과 직결되는 §3 매핑 표)이라 **API
  계약에 해당할 수 있어 안전하게는 일반 스윕 수정으로 처리**를 권장. 처리 후 다시
  `--impl-done spec/conventions/` 로 확인해 네 번째 미러가 없는지 재확인할 것 (`grep -rn
  "output\.rendered" spec/conventions/chat-channel-adapter.md` 재실행으로 자가검증 가능).

---

## 요약

target 커밋(`feb1967a2`)은 직전 `12_02_30` cross_spec 라운드가 지적한 wire `output` 래퍼/도메인값
구분 누락을 두 자리(§1.3 주석, `15-chat-channel.md` CCH-MP-06)에서 정확히 고쳤고, 데이터 모델·
API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 다른 다섯 관점에서는 `spec/5-system/`
(EIA/WS/chat-channel)·`node-output.md`·provider spec(`telegram`/`slack`/`discord`) 과 새로운
모순을 만들지 않았다 — 코드(`allowlistNodeOutputKeys` 배선, `renderPresentationByType` 방어적
폴백)도 spec 의 주장과 정합함을 확인했다. 다만 **같은 계약을 담은 세 번째 자리**(같은 파일
`chat-channel-adapter.md` §3 매핑 표)가 이번 스윕에서 또 누락돼, "래퍼/도메인값 구분 미러
누락"이라는 같은 결함 클래스가 재발했다 — WARNING 1건. CRITICAL 은 없다.

## 위험도

LOW
