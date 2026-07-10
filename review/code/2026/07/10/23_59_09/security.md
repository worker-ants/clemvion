# Security Review — commit `efc9e791e`

대상: `refactor(external-interaction): ai-review Warning 5건 반영` (prior review Warning 5건 fix 검증, fresh review).
범위: EIA 공개 egress 표면 `GET /api/external/executions/:id` (EIA §R17, `deepRedactSecrets` / `redactThreadForPublic`).

## 검증 항목별 결과

### (1) `interaction.service.ts` 타입 어노테이션 변경 — redaction 호출 이동/재정렬/우회 여부

**PASS.** `git show efc9e791e -- codebase/backend/src/modules/external-interaction/interaction.service.ts` 로 확인한 실제 diff는 다음 3줄뿐이다.

```diff
-  type WaitingContextBase,
+  type WaitingContextBaseDto,
...
-          const base: WaitingContextBase = {
+          // (지우면 아래 context 대입이 컴파일 에러로 드러난다.)
+          const base: WaitingContextBaseDto = {
```

파일 전체를 읽어 확인한 현재 런타임 순서는 변경 전과 동일하다.

- `deepRedactSecrets(nodeExec.outputData ?? {})` (L280) — `out` 생성 시점, `base`/`context` 조립보다 **먼저** 실행.
- `redactThreadForPublic(execution.conversationThread)` (L266) — `nodeExec` 조회보다도 먼저 실행되어 `conversationThread` 변수에 담김.
- `base`(L308)와 `context`(L313-324) 조립은 이미 마스킹된 `out`/`conversationThread` 를 조합만 할 뿐, 마스킹 호출 자체를 참조하거나 우회하지 않는다.
- terminal `result`/`error` 의 `deepRedactSecrets` 호출(L338, L345)도 이 커밋에서 미변경.

즉 이번 변경은 **타입 레벨(컴파일 타임) 이름 변경**뿐이며, 런타임 redaction 호출의 실행 여부·순서·인자에 어떤 영향도 주지 않는다.

### (2) 신규 e2e `I-2` — 하드코딩 시크릿 / 다른 테스트의 실 leak 마스킹 여부

**PASS, 문제 없음.**

`I-2`가 DB에 seed 하는 유일한 payload는 다음과 같다.

```json
{ "meta": { "interactionType": "buttons" },
  "config": { "buttonConfig": { "buttons": [{ "id": "b1", "label": "문의" }] } } }
```

- 시크릿 패턴(API 키, 토큰, 자격증명 등)이 전혀 없는 순수 구조적 fixture다. 하드코딩된 실제 시크릿 없음.
- `I-2`는 애초에 **redaction을 검증하는 테스트가 아니다** — variant 선택(`buttonConfig` vs `nodeOutput`)과 `conversationThread` 키 생략이라는 **구조적 계약**만 검증한다. 시크릿을 seed 하지 않으므로 "다른 테스트의 실질적 leak을 가리는" 효과가 원천적으로 없다.
- `I-2` 바로 위(수정 없음, pre-existing)의 테스트와 아래 `J`(수정 없음, pre-existing) 테스트가 여전히 redaction 전담 검증을 맡고 있으며, 둘 다 이번 커밋에서 변경되지 않았다. 두 테스트는 `sk-E2E-THREAD-LEAK` / `AKIA-E2E-NODEOUT` / `sk-E2E-RESULT-LEAK` / `AKIA-E2E-RESULT-KEY` 같은 명백한 합성 마커(`E2E-*-LEAK` 네이밍)를 사용하며 `not.toContain(<secret>)` + `toContain('***')` 패턴으로 실제 마스킹 여부를 강하게 검증한다. `I-2`가 이 테스트들을 대체·약화하지 않는다.
- 결론: `I-2` 추가로 인해 redaction 커버리지가 줄어들거나 위양성(false-pass)이 생기는 경로 없음.

### (3) `WaitingContextBaseDto` export — 공개 OpenAPI 표면 확장 여부

**PASS, 실측 완료.** `WaitingContextBaseDto`는 `abstract` 클래스이고 `@ApiExtraModels`에 등록되지 않으며, 어떤 `@ApiProperty({ type: () => WaitingContextBaseDto })` 참조도 없다. `export` 는 TS 모듈 가시성만 넓혀 `interaction.service.ts`의 명시적 타입 어노테이션을 가능케 할 뿐이다.

실증을 위해 실제 `SwaggerModule.createDocument()`를 로컬에서 실행해 `components.schemas` 키를 확인했다(임시 probe spec, 검증 후 삭제·git status clean 확인 완료):

```
SCHEMA_KEYS: ["ButtonsContextDto","NodeOutputContextDto","CurrentNodeDto","ExecutionStatusDto"]
```

`WaitingContextBaseDto`는 스키마 목록에 **존재하지 않는다** — phantom 스키마도, 별도 `$ref` 대상도 생기지 않았다. `ButtonsContextDto`/`NodeOutputContextDto`가 상속받은 필드(`interactionType`/`waitingNodeId`/`conversationThread`)는 각 서브클래스 스키마에 flatten되어 들어가며 부모 클래스는 별도 컴포넌트로 노출되지 않는다 — 커밋 메시지의 주장과 일치.

### (4) e2e `res.body.data.context` 단언 — 시크릿 유출 시에도 통과할 여지

**PASS, 약한 단언 없음.**

```ts
expect(context.interactionType).toBe('buttons');
expect(context.waitingNodeId).toBe(nodeId);
expect(context.buttonConfig.buttons).toEqual([{ id: 'b1', label: '문의' }]);
expect(Object.keys(context)).not.toContain('nodeOutput');
expect(Object.keys(context)).not.toContain('conversationThread');
expect(res.body.data.result).toBeNull();
expect(res.body.data.error).toBeNull();
expect(res.body.data.currentNode.interactionType).toBe('buttons');
```

- `toEqual`(deep equality)로 `buttonConfig.buttons` 정확히 고정된 fixture와 일치해야 통과 — 예상치 못한 추가 필드(예: 유출된 시크릿 필드)가 섞여도 실패한다.
- `not.toContain('nodeOutput')`/`not.toContain('conversationThread')`는 top-level 키 집합에 대한 정확한 검사이며 "약한 단언"(예: 이번 커밋에서 수정된 W3의 `not.toBe('object')` 류) 패턴이 아니다.
- 다만 이 테스트 자체는 **시크릿을 seed하지 않으므로** "시크릿이 유출돼도 통과하는 단언"이라는 질문에는 애초에 해당 사항이 없다(테스트 목적이 redaction 검증이 아님, 위 (2) 참고). redaction 검증은 별도의 미변경 테스트(I-1/J, unit L660-L720대)가 전담하며 이들은 정확히 "포함하면 안 됨"(`not.toContain(secret)`) + "마스킹 마커 포함됨"(`toContain('***')`) 이중 단언으로 시크릿 유출 시 반드시 실패하도록 설계돼 있다.

## 부가 확인

- W5로 교체된 unit 테스트(ai_conversation+thread 부재 → buttons+thread 부재)는 redaction 커버리지 손실이 아니다. `ai_conversation` 경로의 시크릿 마스킹은 `interaction.service.spec.ts` L660("durable thread turn 텍스트의 secret 은 egress 시 마스킹")과 L698("nodeOutput.conversationConfig 의 secret 도 마스킹") 두 개의 별도 미변경 테스트가 계속 전담한다.
- e2e 파일의 `JWT_SECRET` fallback 하드코딩 문자열(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)은 이번 커밋의 diff에 포함되지 않은 pre-existing 코드다(git diff로 미변경 확인). e2e 전용 fixture로 docker-compose.e2e.yml 값과 대응되며 프로덕션 시크릿이 아니다 — 참고용 INFO, 이번 fix 검증 범위 밖.
- 인증/인가 경로(InteractionGuard, 토큰 검증) 자체는 이번 커밋에서 변경되지 않았다.

## 요약

이번 커밋은 순수 리팩터(타입 어노테이션 rename, DTO export, 테스트 강화/중복 제거, 신규 구조 검증 e2e)로, EIA §R17 redaction 파이프라인(`deepRedactSecrets`/`redactThreadForPublic`)의 호출 위치·순서·인자에 어떤 변경도 가하지 않았음을 diff 직접 대조로 확인했다. `WaitingContextBaseDto` export는 실제 OpenAPI 문서 생성을 통해 공개 스키마에 노출되지 않음을 실증했다. 신규 e2e `I-2`는 하드코딩된 시크릿이 없고, redaction을 검증하는 기존 테스트(I-1, J, 그리고 unit 레벨 2건)를 대체·약화하지 않는 구조적 회귀 가드다. 4개 검증 항목 모두 이전 리뷰에서 지적된 문제 없이 안전하게 적용됐다.

## 위험도

NONE
