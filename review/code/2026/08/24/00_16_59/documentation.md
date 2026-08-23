# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `spec/conventions/conversation-thread.md` 가 "SSE·fanout 은 여전히 잔여"라는,
  이번 PR 이 정확히 반증한 주장을 그대로 두고 있다 — **미러 스윕에서 빠진 6번째 자리**
  - 위치: `spec/conventions/conversation-thread.md:388`
  - 상세: 이번 PR(및 그 직전 fixup 커밋 `2e0a539dc`)은 *"REST 와 SSE 는 같은 강도다"*
    라는 서술이 실려 있던 자리를 전수 스윕했다고 커밋 메시지에서 명시한다 —
    `plan/complete/sse-nodeoutput-allowlist.md` 체크리스트 자신이 *"같은 주장이 실린 자리를
    **다섯 곳** 고쳤다: §R17 · WS §4.4 · CHANGELOG · `toFanoutEnvelope` JSDoc · `getStatus`
    JSDoc"* 이라고 적어 두었다. 그런데 `spec/conventions/conversation-thread.md:388` 문장 —
    `conversationConfig 이외의 일반 nodeOutput 키-allowlist 는 getStatus 출구에서
    해소됐고(2026-08-23, fail-closed) SSE·fanout 이 잔여다(상세·범위 표: EIA §R17)` — 은
    이번 diff 에 포함되지 않아 그대로 남았고, 지금은 **명백히 거짓**이다. `git blame` 상
    이 문장은 직전 PR(`16f3e3625`, #1205)이 쓴 것이고 이번 PR(`origin/main..HEAD`)의
    diff 목록(`git diff origin/main HEAD --stat -- spec/conventions/conversation-thread.md`)
    에는 이 파일이 아예 없다. 발견 실패 원인도 재구성 가능하다 — 미러 스윕 커밋이 grep 한
    패턴은 `SSE·fanout 은 잔여` (조사 "은") 인데, 이 파일의 실제 문구는 `SSE·fanout **이**
    잔여다` (조사 "이") 라 정확히 그 grep 을 피해 갔다. §R17 자체는 이제
    `SSE/fanout waiting_for_input 의 nodeOutput/buttonConfig.nodeOutput` 도 같은 날 닫혔고
    **`execution.node.*` 의 `envelope.output` 만 잔여**라고 정확히 서술하므로, 이 SoT 를
    가리키는 `conversation-thread.md` 문장만 지금 §R17 과 모순된다.
  - 제안: 이 저장소의 자기반증형 소정정 관례대로 원문(`SSE·fanout 이 잔여다`)을 취소선으로
    남기고, `waiting_for_input` 표면은 같은 날 닫혔으며 잔여는 `execution.node.*` 의
    `envelope.output` 뿐이라는 정정 문구를 덧붙일 것(§R17/§4.4/CHANGELOG 와 동일 서술로).

- **[INFO]** `interaction.service.ts` 의 인라인 주석이 "EIA §R17 잔여" 라는 표현을 그대로
  쓰고 있어, 바로 위 JSDoc(같은 파일, 방금 갱신됨)과 톤이 어긋나 보일 수 있다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:390`
    (`// EIA §R17 잔여 — **fail-closed allowlist**.`)
  - 상세: 이 줄은 이번 PR 의 diff 에 포함되지 않았고(`git log -S` 로 확인한 도입 커밋은
    `16f3e3625`, #1205), 문맥상 "이 REST 출구가 §R17 이 열거한 미해소 항목 중 하나를 닫는다"
    는 뜻으로 당시엔 정확했다. 다만 바로 위 305~317줄 JSDoc 이 이번 PR 로 갱신되어
    "SSE 도 같은 날 닫혔고 잔여는 `envelope.output` 하나" 라고 명시하는 지금, 아래쪽의
    독립된 "§R17 잔여" 라는 짧은 표현만 보면 REST 출구 자체가 아직 미해소 상태처럼 오독될
    여지가 약간 있다. 기능적으로 틀린 서술은 아니라 우선순위는 낮음.
  - 제안: 당장 조치 불요. 다음에 이 주변을 만질 일이 생기면 "EIA §R17 (waiting 표면,
    2026-08-23 SSE 까지 닫힘) — fail-closed allowlist" 정도로 살짝 구체화하면 위 JSDoc 과
    완전히 정합해진다.

## 확인했으나 문제 없음 (근거 기록)

- `CHANGELOG.md` — 직전 라운드가 지적한 "SSE·fanout 은 여전히 deny-list(잔여)" 서술이
  이 저장소의 자기반증형 소정정 관례(취소선 + `> 정정` 블록)로 정확히 갱신됐고, "9키→13키"
  수치가 `node-output-allowlist.spec.ts` 의 정렬 리터럴 배열(13개)과 실측 일치한다.
- `spec/5-system/14-external-interaction-api.md` §R17 — 표의 SSE 행이 flip 됐고, 취소선
  보존 + `23_29_27` 정정 블록으로 "waiting 표면은 닫혔고 `envelope.output` 만 잔여"라는
  정확한 범위가 서술돼 있다. 세 갈래 allowlist 표·동명 필드 disambiguation 각주까지
  일관되게 갱신됨.
- `spec/5-system/6-websocket-protocol.md` §4.4 — "fanout envelope 은 내부 WS 와 SSE 가
  공유하지만 `nodeOutput` 키 집합은 공유하지 않는다" 단서가 추가돼 §R17 과 정합한다.
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 신규 함수
  `allowlistFanoutNodeOutput`·갱신된 `toFanoutEnvelope` JSDoc 모두 "왜 이 위치인지"
  (chokepoint 근거)·"왜 copy-on-change 인지"(hot path)·"범위는 `waiting_for_input` 한정,
  `envelope.output` 은 잔여"를 정확히 서술하고, 안 닫은 방향은 `[잔여]` 캐너리로 고정했다는
  자기참조까지 포함한다.
- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — 헤더 주석의
  "소비처도 `getStatus` 한 곳이다" 가 "소비처는 둘이다"로, JSDoc 표 표제의
  "EIA §R17 잔여 항목"이 "EIA §R17"로 정정됐고, 두 정책(deny-list/allowlist) 관계 서술도
  "`getStatus` 와 `toFanoutEnvelope` 는 둘 다"로 갱신돼 상단 문단과 톤이 일치한다. JSDoc
  표(3그룹)와 배열 인라인 주석(3그룹)도 함께 갱신되어 서로 미러링되고, 그 표 자신이
  "요약이 아니라 함께 갱신되어야 하는 미러"라고 명시해 다음 라운드의 drift 위험을
  스스로 낮췄다.
- `codebase/backend/src/shared/utils/node-output-allowlist.spec.ts`,
  `websocket.service.spec.ts`, `interaction.service.spec.ts` 신규 캐너리 — 각각 "왜 이
  케이스가 필요한가"(넷 중 하나만 재발 방지, 목록 단일화가 REST 표면을 의도적으로 넓힌다는
  것 등)를 설명하는 JSDoc/주석을 동반해 테스트 자체가 문서 역할을 겸한다.
- `plan/complete/sse-nodeoutput-allowlist.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 반증된 전제(넷 중 하나로
  추측한 좁히기, "강도가 다르다"의 총칭 서술)를 취소선으로 보존하고 정정 블록을 다는 자기반증형
  소정정 관례를 일관되게 따른다. `envelope.output` 잔여를 정본 트래커의 새 항목으로 등재해
  "안 닫은 방향" 도 추적 가능하다.
- README — `nodeOutput`/`allowlist` 를 언급하는 README 가 저장소에 없어(grep 0건), 이번
  내부 보안 하드닝은 README 갱신 대상이 아니다.
- API 문서(OpenAPI/swagger) — `spec/conventions/swagger.md` 가 `nodeOutput` 을 이미
  "진짜 열린 map"(DTO 비고정)으로 규정해 두어, 키가 줄어도 스키마 선언 자체는 위반하지
  않는다. 확인 완료, 갱신 불요.
- CHANGELOG 는 이미 이번 diff 에 포함돼 있어 별도 "CHANGELOG 미갱신" 지적은 해당 없음
  (직전 리뷰 라운드 `22_51_46` 의 documentation WARNING 이 이번 라운드에서 처리 완료됨).

## 요약

핵심 로직(`node-output-allowlist.ts`·`websocket.service.ts`)의 JSDoc/주석, spec §R17·§4.4,
CHANGELOG, plan 문서 사이의 정합성은 이례적으로 높다 — 이 PR 은 직전 라운드
(`22_51_46`→`23_16_40`→`23_56_18`)에 걸쳐 "REST 와 SSE 는 같은 강도다" 라는 주장이 실린
자리를 반복해 스윕하며 CHANGELOG·§R17·WS §4.4·`toFanoutEnvelog` JSDoc·`getStatus` JSDoc
다섯 곳을 순차로 바로잡았다. 다만 그 스윕은 정확히 같은 클래스의 **여섯 번째 자리**를
놓쳤다 — `spec/conventions/conversation-thread.md:388` 은 여전히 "SSE·fanout 이 잔여다"
라고 적고 있고, 이는 조사(은/이) 차이로 grep 스윕을 피해 간 것으로 재구성된다. 이 파일은
이번 diff 목록에 없지만, 이번 변경이 만든 사실 변경(SSE waiting 표면도 닫힘)과 직접
모순되므로 documentation 관점의 실질 결함으로 본다. 그 외에는 새 함수·확장된 allowlist
모두에 "왜"를 설명하는 JSDoc이 있고, 캐너리 테스트가 문서 역할을 겸하며, README/API 문서
갱신은 정확히 불필요하다고 판단됐다.

## 위험도
LOW
