# 보안(Security) 코드 리뷰

## 범위 메모

이번 세션의 diff payload(`_prompts/security.md`)는 실제로 다음 6개 파일만 포함한다:

1. `review/consistency/2026/07/10/23_46_04/naming_collision.md` (신규, 리뷰 산출물)
2. `review/consistency/2026/07/10/23_46_04/plan_coherence.md` (신규, 리뷰 산출물)
3. `review/consistency/2026/07/10/23_46_04/rationale_continuity.md` (신규, 리뷰 산출물)
4. `spec/5-system/14-external-interaction-api.md` (spec 본문 diff)
5. `spec/5-system/2-api-convention.md` (spec 본문 diff)
6. `spec/conventions/swagger.md` (spec 본문 diff)

즉 이번 diff 자체에는 `interaction.service.ts` 코드 변경이 포함돼 있지 않다(이전 라운드에 이미 커밋됨). 그러나 오케스트레이터 CONTEXT 가 PR #903(getStatus 2단계 조회 도입)과 본 작업(닫힌 oneOf 스키마화)이 `getStatus()` 안에서 실제로 merge-collision 했다는 위험을 명시적으로 지적했으므로, **현재 worktree 에 존재하는 merge 후 `interaction.service.ts` 의 `getStatus()` 실체를 직접 읽어 R17 마스킹 불변식이 유지되는지 코드 레벨로 검증**했다(`Read` + `grep`, 추정 아님).

## 발견사항

- **[INFO]** merge 후 `getStatus()` 의 3중 마스킹 배선이 모두 정상 유지됨을 확인 (회귀 없음)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:265-397` (`getStatus()`)
  - 상세: PR #903 의 2단계 조회(`STATUS_PROJECTION_COLUMNS` 로 1단계에서 `conversation_thread` 제외 → `waiting_for_input` 일 때만 `threadRow` 로 재조회)와 본 변경(닫힌 oneOf `context: ButtonsContextDto | NodeOutputContextDto | null` 조립)이 같은 함수 본문에서 교차하지만, 세 masking 지점이 전부 살아 있다:
    1. `conversationThread = threadRow?.conversationThread ? redactThreadForPublic(threadRow.conversationThread) : undefined;` (L313-315) — 2단계 재조회 결과에 `redactThreadForPublic` 이 여전히 적용된다. 1단계 `execution` 객체에는 애초에 `conversationThread` 가 select 되지 않으므로(L67-74 `STATUS_PROJECTION_COLUMNS` 에 `conversation_thread` 부재) unmasked 값을 실수로 읽어올 경로 자체가 없다.
    2. `const out = deepRedactSecrets(nodeExec.outputData ?? {})` (L320-323) — 이 redacted `out` 이 두 variant 조립에 그대로 흘러간다: `NodeOutputContextDto.nodeOutput = out` (L364) 과 `ButtonsContextDto.buttonConfig = { buttons: bc.buttons, nodeOutput: out }` (L358) 양쪽 모두 raw `nodeExec.outputData` 가 아니라 redact 된 `out` 을 참조한다.
    3. `result: ... deepRedactSecrets(execution.outputData ?? null)` (L378) / `error: ... deepRedactSecrets(execution.outputData ?? null)` (L385) — terminal outputData 마스킹도 그대로 유지.
  - 조립 순서상 oneOf variant 선택 로직(`interactionType === 'buttons' && bc ? {...} : {...}`, L353-364)이 `out`(이미 redact 됨)을 소비하는 시점 이후에 오는 게 아니라, `out` 자체가 그 이전(L320)에 이미 redact 상태로 확정된 뒤 두 분기 모두에 재사용되는 구조라, variant 분기 추가가 masking 을 우회할 수 있는 코드 경로가 원천적으로 없다.
  - 결론: **레이스/우회 없음.**

- **[INFO]** 1단계 projection 이 `conversation_thread` 를 제외하는 설계가 오히려 마스킹 공격면을 줄임
  - 위치: `interaction.service.ts:67-74` (`STATUS_PROJECTION_COLUMNS`), `:271-274` (1단계 조회)
  - 상세: 1단계 조회 결과 객체(`execution`)에는 `conversationThread` 필드가 애초에 존재하지 않는다(TypeORM `select` 배열로 컬럼 자체를 안 읽음). `getStatus()` 반환 조립부 어디에서도 `execution.conversationThread` 를 참조하지 않고, thread 값은 오직 `threadRow`(2단계, 항상 `redactThreadForPublic` 통과)에서만 온다 — grep 으로 `execution.conversationThread` 참조 0건 확인. 즉 "실수로 masking 을 건너뛰고 1단계 raw thread 를 노출"하는 경로가 코드 구조적으로 존재하지 않는다(그런 필드가 애초에 없으므로).
  - 결론: **누출 경로 없음 (설계상 배제).**

- **[INFO]** e2e 회귀 가드 3종(I / I-2 / J) 전부 실 DB round-trip 으로 현재 코드 경로를 커버
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:344-505`
  - 상세:
    - **I** (L344): `execution.conversation_thread` 에 `Authorization: Bearer sk-E2E-THREAD-LEAK` 를 실제 INSERT 하고 `node_execution.output_data` 에 `api_key=AKIA-E2E-NODEOUT` 를 심은 뒤, 실 HTTP `GET /api/external/executions/:id` 응답 wire 전체(`JSON.stringify(res.body)`)에 두 시크릿이 **전혀** 포함되지 않고 `***` 로 치환됐는지 검증 — 2단계 조회(`threadRow`) + `nodeExec.outputData` 양쪽 마스킹 경로를 동시에 실증.
    - **I-2** (L411): `conversation_thread` 컬럼을 아예 채우지 않은 채(durable 이력 없음) buttons variant 를 시드해, `buttonConfig` variant 선택 + `nodeOutput` 키 부재 + `conversationThread` 키 자체 부재(`null` 아님, present-when-available)를 동시 검증 — closed-oneOf 조립 로직과 §5.4 부재 표현 컨벤션이 실 DB round-trip 에서 정확히 맞물림을 확인.
    - **J** (L466): COMPLETED execution 의 `output_data` 에 `Bearer sk-E2E-RESULT-LEAK` / `AKIA-E2E-RESULT-KEY` 를 심고, `result` 필드 wire 에 두 시크릿이 없고 `***` 만 있는지 검증.
    - 단위 테스트 레벨에서도 `interaction.service.spec.ts:921` (`2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과`)·`:731` (`종료(COMPLETED) execution 은 conversationThread 를 노출하지 않는다`, waiting 분기 밖에서 thread 가 세팅돼도 status 가드로 접근 자체가 차단됨을 확인)가 보강.
  - 결론: **leak invariant 에 대한 e2e/unit 커버리지 충분, 회귀 시 즉시 실패하는 구조.**

- **[INFO]** 리뷰 산출물 파일 1~3(`naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`) — 보안 관점 해당 없음
  - 위치: `review/consistency/2026/07/10/23_46_04/*.md`
  - 상세: 셋 다 신규 markdown 문서(`.claude` 오케스트레이터가 생성하는 정합성 검토 산출물)로, 코드 실행 경로나 인증/인가/시크릿 취급과 무관하다. 문서 내 코드 인용(`grep` 결과 붙여넣기 등)에도 실 시크릿·자격증명은 없다 — 전부 placeholder(`sk-E2E-*`, `AKIA-E2E-*` 등 테스트 픽스처 문자열 인용).

- **[INFO]** spec 문서 diff(파일 4~6) — 신규 실질 보안 문제 없음
  - 위치: `spec/5-system/14-external-interaction-api.md`(§5.4/§R17 각주 정정), `spec/5-system/2-api-convention.md`(§5.4 신설: null vs 키 생략 컨벤션), `spec/conventions/swagger.md`(§1-4 닫힌 union Rationale)
  - 상세: 전부 API 계약 표현(oneOf/discriminator 사용 금지 규약, present-when-available 컨벤션) 문서화이며 마스킹·인가·시크릿 처리 자체에는 영향이 없다. `[API 규약 §5.4](...)(본 문서 자신의 §5.4 "명시적 취소" 가 아니다)` 처럼 self-reference 혼동을 명시적으로 배제하는 각주가 추가돼 있어 오히려 명확성이 개선됨.

## 요약

이번 diff 는 실질적으로 문서(spec + 리뷰 산출물)로만 구성돼 있으나, 오케스트레이터가 지적한 PR #903(getStatus 2단계 조회) × 본 작업(닫힌 oneOf 스키마화)의 merge 지점(`interaction.service.ts::getStatus()`)을 직접 코드로 재검증한 결과 EIA §R17 이 요구하는 3중 마스킹(`redactThreadForPublic` on 2단계 thread, `deepRedactSecrets` on `nodeExec.outputData`→`nodeOutput`/`buttonConfig.nodeOutput`, `deepRedactSecrets` on terminal `result`/`error`)이 전부 정상 배선돼 있고, 우회 가능한 코드 경로도 없다(1단계 projection 에 `conversation_thread` 컬럼 자체가 없어 raw thread 참조가 구조적으로 불가능). `SECRET_LEAK_PATTERNS`/`deepRedactSecrets` 구현도 placeholder 가 아닌 실질 정규식 마스킹(Bearer/JWT/URI credential/`api_key=` 등)이며, e2e I/I-2/J 와 대응 unit 테스트가 실 DB round-trip 으로 secret 미노출·`conversationThread` present-when-available 부재 표현·terminal result 마스킹을 모두 고정 검증하고 있어 회귀 시 즉시 실패한다. 이번 diff 범위(spec 문서 3건 + 리뷰 산출물 3건) 자체에는 인젝션·하드코딩 시크릿·인증/인가·입력검증·암호화·에러노출·의존성 관련 신규 이슈가 없다.

## 위험도

NONE

STATUS: SUCCESS
