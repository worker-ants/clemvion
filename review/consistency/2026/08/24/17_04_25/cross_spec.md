STATUS=success cross_spec review complete — 1 WARNING, 0 CRITICAL
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — `planner-doc-batch.md` (B1~B7, 3회차)

> 검토 방식: prompt 번들이 `6-websocket-protocol.md`/`14-external-interaction-api.md`/
> `node-output.md`/`egress-masking.md`/`chat-channel-adapter.md`/`conversation-thread.md`
> 를 예산 초과로 절단했으므로(정본 spec_impact 대상 대부분이 번들에 없음), 워크트리의
> 실제 파일을 `Read` + `git show`/`git log`로 직접 열어 검토했다. 대상은 `4af06d951`
> (B1~B7 최초 반영) + `dd8a17207`(`16_41_05` CRITICAL·WARNING 4건에 대한 정정 커밋) 이후의
> **현재 HEAD 상태**다. `16_41_05` 라운드가 지적한 CRITICAL 1건·WARNING 4건은 전부 코드/문서
> 실측으로 **해소를 확인**했다(§검증 참고 참조) — 재발 없음.

## 발견사항

### [WARNING] 신설 각주가 "노드 종류를 읽으려면 `waitingNodeType` 을 쓰라"고 권고 — EIA §R17 의 "외부 소비 매핑 없음" 정책과 부딪힌다

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.4, line 529-530 (신설,
  `dd8a17207` 가 CRITICAL 대응으로 다시 쓴 각주의 마지막 문단):
  > "노드 종류를 읽어야 하면 envelope 쪽을 쓴다 — 대기 이벤트의 실제 wire 필드명은
  > **`waitingNodeType`** 이다(위 wire caveat 블록쿼트)."
- **충돌 대상**:
  - `spec/5-system/14-external-interaction-api.md` §R17, line 736-740 (기존, 이번 PR 미변경):
    > "**`node.type` 은 외부 소비 매핑이 없다.** wire 에 `waitingNodeType` 이 평면으로
    > 실리기는 하지만 그것은 **WS 내부 부가 식별자**(에디터 타임라인 관측용)이고, 외부
    > 클라이언트는 노드 타입이 아니라 **`interactionType`** 으로 분기한다 — 참조 구현
    > `parseWaitingForInput` 이 `waitingNodeType` 을 읽지 않는 것이 그 근거다(실제 소비처는
    > 내부 에디터 WS 채널의 `use-execution-events.ts` 뿐)."
  - 신설 각주 자신이 인용하는 **바로 그 "wire caveat 블록쿼트"** (같은 문서 §4.4 도입부,
    line 451, 기존): "`waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·`startedAt`
    (**에디터 타임라인 관측용**)"·"**외부 클라이언트가 소비하는 필드 매핑의 SoT 는 EIA §6.2
    blockquote**이며, **WS 내부 부가 식별자**(`waitingNodeType` 포함)는 본 §4.4 가 소유한다."
  - 같은 문서 `## Rationale` line 1058 (기존): "WS 내부 부가 식별자(`waitingNodeType` 류)
    = 본 §4.4 소유" — EIA §6.2 를 전체 SoT 로 격상하지 않은 이유로 "그 blockquote 가
    **외부소비 필드만** 다루는 의도적 스코프" 라고 명시.
- **상세**: 세 군데(EIA §R17 · WS §4.4 도입부 · WS Rationale)가 이구동성으로 **`waitingNodeType`
  은 WS 내부 전용이고 외부 클라이언트는 이걸 읽지 않는다(참조 구현이 실제로 안 읽는다)**
  고 명시적으로 못박아 뒀다. 그런데 이번 PR 이 새로 쓴 각주(line 529-530)는 그 세 문장을
  요약·인용하는 대신, **"노드 종류를 읽어야 하면 envelope 쪽을 쓴다"** 는 무자격(스코프
  없는) 권고문으로 `waitingNodeType` 을 제시한다. 문맥상 이 문단은 `nodeOutput.nodeType`
  (chat-channel 렌더러 전용 wire carve-out — **외부 표면**)을 논하는 자리 바로 다음에 오므로,
  독자는 "`nodeOutput` 안에 넣지 말고 대신 이걸 봐라" 로 읽기 쉽다. 하지만 chat-channel
  렌더러·위젯 파서 등 **외부 소비처**가 실제로 이 권고를 따라 `waitingNodeType` 을 읽으면
  EIA §R17 이 명시적으로 금지한 경로를 타게 된다 — "외부 소비 매핑 없음" 이라는 정책과
  직접 모순된다. 이 시리즈가 바로 전 라운드(`16_41_05`)에서 CRITICAL 로 잡은 패턴("기각된
  대안을 다른 프레임으로 재해석해 되살림")과 같은 계열의 문제가, 그 CRITICAL 을 고치는
  같은 문단 안에서 스코프 없는 표현으로 다시 새어 나온 모양이다. 기능적으로 지금 당장
  깨지는 코드는 없다(실 소비처가 없다는 각주 자신의 주장과 일치) — 그래서 CRITICAL 이
  아니라 WARNING 으로 매겼지만, **이 문장 그대로 다음 개발자가 참조하면** 정확히 EIA 가
  막아 둔 경로로 들어간다.
- **제안**: line 529-530 을 "envelope 쪽을 쓴다" 로 일반화하지 말고, 다음 중 하나로
  스코프를 명시:
  (a) "단, `waitingNodeType` 은 EIA §R17 이 명시한 대로 **WS 내부(에디터 타임라인) 전용**이며
  외부 클라이언트는 이 필드로 노드 종류를 판별하지 않는다(대신 `interactionType` 분기) —
  §4.4 도입부 wire-caveat·EIA §R17 참조" 같은 한 문장을 덧붙인다, 또는
  (b) 이 문장 자체를 삭제하고 "노드 종류 식별은 `interactionType` 이 외부 표면의 유일한
  SoT (EIA §R17)" 로 대체한다 — `nodeOutput.nodeType` 을 넣지 말라는 결론(C3 강화)에는
  "대체 경로가 없다" 는 문장이 오히려 더 일치한다(EIA 자신이 "node.type 은 외부 소비
  매핑이 없다" 라고 하므로).

## 검증 참고 (참고 — 발견사항 아님)

`16_41_05` 가 지적한 항목의 해소를 재확인:

- **CRITICAL**(B3 각주가 WS 자신의 C3 기각 판별자를 "레이어가 달라 별개" 로 재해석해 되살림)
  → `dd8a17207` 가 각주를 폐기하지 않고 재작성: "엔진은 `nodeOutput` 안에 `nodeType` 을
  넣지 않는다(C3 준수) / 렌더러는 방어적으로 읽는다 / allowlist 는 그 방어를 깨지 않기
  위한 예방적 허용이지 계약 편입이 아니다 / 새 코드가 쓰면 여전히 C3 위반" 으로 정정 —
  해소 확인.
- **WARNING 1**(`{runId}` 가 같은 문서 §3.3·`redis-keys.md`·plan 결정문의 `{id}` 관례와
  어긋남) → WS §3.2·§3.3 모두 `background:run:{id}` 로 정정 확인
  (`redis-keys.md:84` 의 `<id>` 와 placeholder 이름 정합, bracket 스타일은 각 문서 자체
  컨벤션이라 `{}` vs `<>` 차이는 기존 관례).
- **WARNING 2**(`payload.nodeType` 만 쓰고 실제 wire 이름 `waitingNodeType` 미명시) →
  각주에 `waitingNodeType` 명시 + EIA §R17 상호 참조 추가 확인. (단, 그 명시가 위 새
  WARNING 을 만든 원인이기도 하다 — "이름을 밝혔다" 는 옳았고 "그 이름을 무자격
  권고로 썼다" 가 남은 문제.)
- **WARNING 3**(B1 각주 "코드 주석과 같은 문구" 주장이 실제로는 EIA §R17 인용) →
  node-output.md 각주가 "EIA §R17 과 같은 문구 (코드 JSDoc 은 축약형)" 로 정정 확인,
  `node-output-allowlist.ts` 실제 JSDoc 표기(`wire 전용 (위젯)`/`(chat-channel)`)와 대조해
  일치.
- **WARNING 4**(conventions `## Rationale` 미적재) → 직전 커밋(`4af06d951`)에서 이미
  4개 문서를 `Read` 로 직접 열어 반영, 이번 라운드에서 각 문서의 실제 Rationale 존재를
  재확인(node-output.md/egress-masking.md/chat-channel-adapter.md/conversation-thread.md
  모두 `## Rationale` 섹션 보유).
- 파이프라인 실측: `websocket.service.ts` 의 `toFanoutEnvelope` 실제 호출 순서
  = `maskWireEnvelope` → `stripExternalOnlyFields` → `allowlistFanoutNodeOutput` →
  `attachRoutingContext` — egress-masking.md §2 4단계 서술과 정확히 일치(코드 라인 507-514
  직접 확인).
- 5필드 invariant `{config, output, meta?, port?, status?}` 는 node-output.md Principle 0
  ·6개 노드 카테고리 `0-common.md`·WS §4.4·WS Rationale C3 전체에서 표기 일치 — drift 없음.
- B6 미러 3곳(`chat-channel-adapter.md`·`conversation-thread.md`·
  `14-external-interaction-api.md`)은 모두 `node-output.md Principle 0 의 wire envelope
  각주`를 가리키는 **같은 대상**을 정확히 인용 — 서로 다른 각주를 혼동하지 않음.

## 요약

`16_41_05` 라운드가 낸 CRITICAL 1건·WARNING 4건은 이번 HEAD(`dd8a17207`)에서 모두 해소를
확인했다. 다만 그 CRITICAL 을 고치는 과정에서 새로 쓴 각주의 마지막 문장(WS §4.4,
`waitingNodeType` 을 "노드 종류를 읽는 법"으로 무자격 제시)이 **같은 문서·EIA §R17 이
명시적으로 못박은 "외부 소비 매핑 없음" 정책과 다시 부딪힌다** — 지금 당장 이를 소비하는
코드는 없어 CRITICAL 은 아니지만, 다음 개발자가 이 문장을 그대로 따르면 EIA 가 막아 둔
경로로 들어가는 문서-대-문서 모순이라 WARNING 으로 등재한다. 그 외 파이프라인 순서·5필드
invariant·B6 미러 3곳·B1/B3/B5 정정 사항은 코드·타 spec 실측과 전부 일치해 새 CRITICAL 은
없다.

## 위험도

LOW
