# Consistency Check SUMMARY — impl-done: EIA getStatus context 스키마화

- 모드: `--impl-done` (scope `spec/5-system/14-external-interaction-api.md`, diff-base `origin/main`)
- checker: 5/5 SUCCESS
- 세션: `review/consistency/2026/07/10/23_46_04/`
- 대상 커밋: `311015832`(spec) · `60c4c8900`(impl) · `efc9e791e`(review fix) · `b1d69ed8c`(resolution hash)

## BLOCK: NO

**Critical 0 · Warning 0 · Info 5.** 위험도: NONE ×4, LOW ×1(INFO 만).

## 실증 검증된 핵심 사항

- **런타임 wire 무변경** — `cross_spec` 이 `git show origin/main:...interaction.service.ts` 로 변경 전 코드를 직접 대조: `getStatus()` 는 **이 브랜치 이전부터 이미** `interactionType`/`waitingNodeId`/`conversationThread?`/`buttonConfig{buttons,nodeOutput}` 또는 `nodeOutput`/`seq:0` 을 반환하고 있었다. 즉 §5.3 예시 JSON 정정은 **문서를 코드에 맞춘 것**이지 코드를 바꾼 것이 아니다.
- **phantom 스키마 없음** — `rationale_continuity` 가 실제 `SwaggerModule.createDocument()` 를 호출해 `components.schemas` 키를 덤프: `['ButtonsContextDto','NodeOutputContextDto','CurrentNodeDto','ExecutionStatusDto']` 4종뿐. `efc9e791e` 에서 export 된 `abstract WaitingContextBaseDto` 는 `@ApiExtraModels` 미등록이라 스키마에 등장하지 않는다.
- **기각된 대안 4종 모두 미재도입** — `discriminator` 미선언 / `conversationThread` null 미정규화 / `ConversationThreadDto` 미생성 / wire 불변. 4항목 개별 확인.
- **§5.4 DTO 미러 규칙 필드별 일치** — `conversationThread?: ConversationThread`(nullable 미지정, `|null` 없음) vs `result`/`error`/`currentNode`/`context`(전부 `nullable: true` + `?: T|null`).
- **§5.4 naming collision 해소 확인** — EIA 문서의 두 cross-ref(L443·L1148)가 모두 `[API 규약 §5.4](./2-api-convention.md#...)` 로 파일명 qualify 되었고, R17 은 "본 문서 자신의 §5.4 '명시적 취소' 가 아니다" 라고 명시 반증까지 둔다.
- **`WaitingContextBase` alias 완전 제거** — word-boundary grep 결과 코드 전역 잔존 참조 0건.
- **§5-2 각주** — 표 행이 아니라 blockquote 각주로 추가됨을 확인.
- 신규 테스트 52건 재실행 통과(checker 가 직접 `npx jest` 실행).

## Info (본 PR 미조치 — 근거 기재)

- **I1** `cross_spec`: 동일한 `context: Record<string,unknown>|null` 타입 정밀도 갭이 위젯 `eia-types.ts` 뿐 아니라 **`codebase/packages/sdk/src/client.ts`(`@workflow/sdk` 공식 EIA client SDK)** 에도 있다. 배포 실동작 무영향(타입 정밀도). → 후속 plan 에 등재.
- **I2** `convention_compliance`: swagger.md §1-4 **본문**은 열린 map 을 "키 집합이 런타임 결정" 으로 정의하는데, `conversationThread` 는 형태가 고정인데도 SoT 이중화 회피 목적으로 열어 둔다. 그 근거는 §Rationale 에만 있어 본문만 읽으면 §1-4 위반으로 오독될 소지. → 후속 plan 에 등재 (spec 편집이라 planner 트랙, 그리고 지금 고치면 방금 통과한 impl-done 산출물이 stale 해진다).
- **I3** `plan_coherence`: 구동 plan 의 "구현 시점 TEST WORKFLOW" 줄이 `249` → `250` 으로 소급 덮어써져 있었다(진짜 진행은 249 → fix 후 250). → 본 커밋에서 정정.
- **I4** `cross_spec`: `spec/4-nodes/3-ai/0-common.md §11.2` 의 표현식 엔진 변수 `context.currentNode.{id,label,type}` 와 EIA `ExecutionStatusDto.currentNode` 가 이름만 겹친다(도메인 상이). **사전 존재**, 본 PR 무관. 조치 불요.
- **I5** `naming_collision`: "Context" 어휘가 엔진 `ExecutionContext` 와 EIA `*ContextDto` 두 도메인에 재사용되나 식별자 문자열·모듈 경계·의미 축 모두 분리 — 실충돌 아님.

## plan 이동 판정 (`plan_coherence`)

구동 plan 의 마지막 미체크 항목이 바로 본 `--impl-done` 세션이었다. **BLOCK: NO 확정으로 모든 체크박스 `[x]`.**

`## 후속 (본 PR 밖)` 산문 항목 3건은 **별도 follow-up plan 으로 이관**하여 본 plan 의 미해결 항목을 0 으로 만든 뒤 `plan/complete/` 로 `git mv` 한다 (plan-lifecycle §2 "미해결 follow-up 이 하나라도 있으면 in-progress" 를 우회하지 않고 정공법으로 해소).

`spec_impact` (YAML 리스트 — bare string 은 Gate C unit 테스트 실패):

```yaml
spec_impact:
  - spec/conventions/swagger.md
  - spec/5-system/2-api-convention.md
  - spec/5-system/14-external-interaction-api.md
```
