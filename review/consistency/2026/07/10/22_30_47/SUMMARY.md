# Consistency Check SUMMARY — spec-draft-eia-context-schema-absence-convention

- 모드: `--spec`
- target: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md`
- checker: cross_spec · rationale_continuity · convention_compliance · plan_coherence · naming_collision (5/5 SUCCESS)
- 세션: `review/consistency/2026/07/10/22_30_47/`

## BLOCK: NO

Critical 0건. Warning 5건 · Info 6건. draft 는 인용한 기존 spec 문구·코드 라인이 전부 원문과 일치하며(4개 checker 가 독립 대조), 기각된 대안의 재도입·합의 원칙 위반 없음. 아래 Warning 을 draft 에 반영한 뒤 spec 쓰기 진행.

## Warning (반영 의무)

### W1. EIA §5.3 예시 JSON 이 이미 stale — Gap 3 "경미한 cross-ref" 범위로는 미해소
**검출: cross_spec · rationale_continuity · convention_compliance (3/5 수렴)** · main 직접 검증 완료

`14-external-interaction-api.md:459-468` 의 `context` 예시가 실제 wire 와 3중으로 어긋난다:
1. top-level `formConfig` / `conversationConfig` 는 **존재하지 않는 유령 키** — 실제로는 `nodeOutput` **안에** 중첩된다.
2. `interactionType` / `waitingNodeId` 가 예시에서 누락 (실제 wire 는 항상 포함).
3. `"seq": 42` 가 9줄 위 콜아웃(`seq` 는 항상 `0` placeholder, L439)·§R17 과 정면 모순.

Gap 1 의 `oneOf` 스키마(정확)가 반영되는 순간, 같은 문서 안에서 **스키마와 예시가 서로 다른 shape 을 주장**하게 된다. 이 예시는 §6.2 outbound notification payload 형태를 복제한 것으로 보이며, §6.2 자체 각주(L575-583)가 "SSE/REST 실제 wire 는 notification 형태와 다르다"고 이미 경고하는 바로 그 패턴이다.

→ **조치**: Gap 3 을 "cross-ref" → "cross-ref + §5.3 예시 JSON 정정(+ `seq: 0`)" 으로 확대.

### W2. 신규 `api-convention §5.4` 에 non-retroactive 캐리브 부재
**검출: cross_spec**

Gap 1(swagger §1-4)에는 "신규 변경 한정" 캐리브가 있으나 Gap 2(§5.4)에는 없다. "기본은 null, 키 생략은 사유 명시 의무" 가 general MUST 로 읽혀, 이미 사유 문구 없이 키를 생략 중인 기존 필드들(`11-mcp-client.md:356` `mcpDiagnostics`, `4-integration.md:853` `requiresCafe24Approval`·`:1549` `status`, `chat-channel-adapter.md:379` `details.statusCode`)이 신설 직후 "미준수"로 오탐된다.

→ **조치**: §5.4 본문에 소급 미적용 문장 1개 추가.

### W3. §5-2 "표에 행 추가(각주 형태)" 는 자기모순 지시
**검출: convention_compliance**

§5-2 표는 `헬퍼` 컬럼 = **export 된 호출형 함수** 인벤토리다. property-level 패턴은 draft 스스로 "헬퍼 아님"이라 하면서 "행 추가"를 지시 → 그대로 반영하면 표의 불변식이 깨진다.

→ **조치**: "표 **하단 각주 1줄**(행 아님)" 으로 확정.

### W4. DTO 명명 가드 부재 — `ExecutionContext*` 접두는 예약어
**검출: naming_collision**

`node-handler.interface.ts:31` 의 `ExecutionContext` 는 **엔진이 노드 핸들러에 주입하는 런타임 실행 컨텍스트**이고 SoT 는 `spec/conventions/execution-context.md` (God-Object 방지 필드 분류 규약). EIA `getStatus.context` 는 **전혀 다른 개념**(외부 소비자용 waiting-for-input 스냅샷). 그런데 worktree 명이 `eia-execution-context-schema` 라 구현자가 `ExecutionContextDto` 를 고를 유인이 크고, 그러면 한 이름이 두 의미로 갈리는 CRITICAL 급 혼선이 된다.

→ **조치**: draft 체크리스트에 명명 가드 명시. `WaitingForInputContextDto` 등 `eia-types.ts` 의 기존 `WaitingForInputEvent` 명명과 정렬.

### W5. §R17 의 "§5.4 참조" 는 파일명 qualify 필수
**검출: naming_collision** · main 직접 검증 완료

EIA 문서는 **자기 자신의 §5.4**(`명시적 취소 — POST .../cancel`, L473)를 이미 보유한다. §R17 에 bare "§5.4 참조" 를 쓰면 같은 파일 안에서 오독된다.

→ **조치**: `[API 규약 §5.4](./2-api-convention.md#54-부재-표현--null-vs-키-생략)` 형태로 항상 qualify.

## Info (선택 반영)

- **I1** `responses.dto.ts:57-58` JSDoc("클라이언트는 `currentNode.interactionType` 으로 분기")이 draft 가 반박하는 unsound discriminator 가정을 그대로 담고 있음 → developer 단계에서 동반 정정. *(rationale_continuity)*
- **I2** Rationale 4개 문단을 `### <제목>` 헤더로 승격 + 귀속 문서 명시 배정(1·2 → swagger.md, 3 → api-convention.md, 4 → swagger.md + api-convention cross-ref 1줄). 두 대상 문서 모두 `### §N ...` 헤더 패턴을 쓰며 anchor 인용 가능성이 필요. *(convention_compliance)*
- **I3** swagger.md 안착 시 `../conventions/node-output.md` → `./node-output.md` (동일 디렉토리). *(convention_compliance)*
- **I4** `conversation-thread.md` thread shape SoT 는 **§1.3(자료구조)**; §4=영속화, §8.4=Rationale. 인용 정정. *(convention_compliance)*
- **I5** "`1-node-common` 의 노드 output 규약" → `node-output.md` 는 독립 conventions 문서(여러 노드 문서가 참조). 문서 계층 오인 방지 문구 정정. *(cross_spec)*
- **I6** `spec-sync-external-interaction-api-gaps.md` 의 `[x] getStatus currentNode/context 실값` 항목에 본 draft 로의 cross-ref 1줄 추가(추적성). 두 문서는 **같은 코드/절을 다루되 축이 다름** — 런타임 실값 vs OpenAPI 스키마 표현. 중복·충돌 아님. *(plan_coherence)*

## 충돌 없음 확인

- 데이터 모델 · 상태 전이 · RBAC · 요구사항 ID: 무변경/무충돌.
- `api-convention.md` §5.4 는 **비어 있는 번호**(기존 §5.1-5.3). inbound anchor 링크 0건 → 신설이 기존 링크를 깨지 않음. `## 6.` 은 최상위 헤딩이라 재번호 없음.
- `swagger.md §1-4` 를 참조하는 다른 spec 0건 → 개정이 외부 참조를 깨지 않음.
- discriminator 조건부 생략은 **기각된 대안의 재도입이 아니라 신규 결정** — swagger.md §Rationale 에 property-level discriminator 선례 없음. `api-wrapped.ts` `wrapOneOfDataSchema` JSDoc("모든 DTO 가 동일 propertyName 보유 보장")과 오히려 정합.
- `conversationThread` 키 생략 유지 결정은 §R17 SSE parity 계약 · `conversation-thread.md §8.4` · `1-widget-app.md §3.1` 과 전부 일치.
- "present-when-available" 은 EIA §5.3 에 이미 존재하는 용어(선례 인용). "부재 표현" heading 은 `spec/` 최초 등장, 충돌 0.

## 위험도

LOW (checker 4건 LOW, convention_compliance MEDIUM — MEDIUM 사유는 W1/W3 의 "반영 실행 단계 리스크"이며 둘 다 위 조치로 해소)
