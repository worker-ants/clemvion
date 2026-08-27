# 문서화(Documentation) 리뷰 — masking-expression-egress-split (C2 (a))

## 발견사항

- **[WARNING]** plan 체크리스트가 실제로는 완료된 작업을 여전히 미완료로 표시한다
  - 위치: `plan/in-progress/masking-expression-egress-split.md:105, 106, 108, 109, 110`
  - 상세: 아래 5개 항목이 `- [ ]`(미완료)로 남아 있지만, 이번 diff 자체가 그 작업을 이미 수행했음을 보여준다.
    1. L105 `어댑터에서 maskSensitiveFields(config) 제거 + 왜 안전한지 JSDoc` → `handler-output.adapter.ts` diff 에서 이미 제거·주석 추가됨(Read 로 확인, 파일 전체가 이 상태로 존재).
    2. L106 `캐너리 — 표현식이 원문을 읽는다 · WS/REST 는 여전히 마스킹 · DB 는 원문(§R17)` → `handler-output.adapter.spec.ts` diff 에 정확히 이 3종 캐너리(표현식 원문 캐너리 5건, 중첩 캐너리, egress 대조군 2건)가 이미 추가돼 있음.
    3. L108 `(planner 턴) 6개 spec — R-5 보안 근거 정정이 핵심, 나머지는 그 파생` → 파일 16~21(`14-execution-history.md`·`4-ai-assistant.md`·`1-ai-agent.md`·`4-execution-engine.md`·`egress-masking.md`·`node-output.md`) 전부가 정확히 이 diff 에 포함돼 spec_impact 6건과 1:1 대응한다.
    4. L109 `자매 트래커 항목(값 축 / DEFAULT_SENSITIVE_KEYS) 종결 동기화` → 파일 6(`spec-sync-external-interaction-api-gaps.md`)의 diff 에서 두 항목이 이미 `- [x]`로 전환됨.
    5. L110 `chatChannel 라우팅 전용 로컬 마스커가 공유본보다 좁다 — 별건 등재` → 같은 파일 6의 diff 에 정확히 이 내용의 신규 항목(L515-518)이 이미 등재돼 있음.
    반대로 L111(`TEST WORKFLOW 4단계 + ratchet`)·L112(`/ai-review`)는 이번 diff 에서 확인되지 않아 실제로 미완료로 보인다 — 즉 체크박스 자체가 "완료/미완료"를 신뢰성 있게 구분하지 못하는 상태다. 이 저장소는 "plan 체크박스 = 실제 상태" 원칙을 반복해 강조해 온 이력이 있다.
  - 제안: 이번 커밋으로 완료된 5개 항목을 `- [x]`로 갱신한다. 체크박스가 실제 상태와 어긋난 채로 `complete/` 이동 판단이나 후속 세션의 재작업 여부 판단에 쓰이면 잘못된 결론(예: "아직 spec 갱신 안 됐다"고 오판해 중복 작업)으로 이어진다.

- **[WARNING]** 이 클래스의 masking 변경을 매번 기록해 온 `CHANGELOG.md` 관례에 이번 PR 만 항목이 없다
  - 위치: `CHANGELOG.md` (이번 diff 에 파일 자체가 포함되지 않음 — 부재가 발견사항)
  - 상세: `git log`/`CHANGELOG.md` 를 보면 최근 커밋(`#1204`·`#1205`·`#1208`·`#1209` 등)이 전부 "마스킹 경계 변경"류마다 `## Unreleased — <무엇이 새고 있었는지·무엇을 어떻게 바꿨는지>` 형태의 상세 항목(실측 갭·바뀐 것·운영 영향)을 남기는 확립된 관례를 보여준다. 실제로 `CHANGELOG.md:196`은 이번 PR 이 손대는 바로 그 파일(`handler-output.adapter.ts`)을 "자매 표면"으로 이미 언급하고 있을 만큼 이 이력은 이 코드 경로를 계속 추적해 왔다. 이번 변경은 (a) 엔진 boundary 마스킹을 완전히 제거하고 (b) `NodeExecution.outputData.config` 의 **DB 저장 형태를 마스킹값 → 원문으로 바꾸는** 운영 영향이 있는 변경인데도(정확히 다른 항목들이 "운영 영향" 콜아웃으로 강조해 온 성격), 이번 diff 에는 `CHANGELOG.md` 갱신이 없다.
  - 제안: 다른 `## Unreleased` 항목과 같은 형식으로 "config 가 이제 DB 에 원문으로 저장된다(egress-only 로 전환)"는 운영 영향과, 안전성이 두 마스커의 키-집합 포함관계에 의존한다는 점을 명시하는 항목을 추가한다.

- **[WARNING]** `_resumeState`/`_retryState` 의 credential 배제 정책을 설명하는 주석·spec 문구가 이번에 제거된 "`maskSensitiveFields` boundary strip" 을 비교 기준으로 계속 인용한다
  - 위치(diff 밖 — Read 로 확인한 실제 파일 줄 번호):
    - `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3280` (인라인 주석), `:3350-3353` (`buildRetryState` JSDoc)
    - `spec/conventions/node-output.md:256`
    - `spec/5-system/4-execution-engine.md:193`, `:203`, `:1510`
  - 상세: 이 코드/문서들은 하나같이 "credential 은 `_resumeState`/`_retryState` 와 동일 정책 — `maskSensitiveFields` 가 boundary 에서 strip" 이라고 서술한다. 그런데 이 표현의 비교 기준이었던 "`handler-output.adapter.ts` 의 `maskSensitiveFields` boundary" 는 이번 PR 로 (config 에 대해) 완전히 제거됐다 — 정확히 이 PR 자신이 6개 spec 파일에서 "boundary strip" 표현을 "egress 마스킹"으로 정정한 대상이다. `_resumeState`/`_retryState` 자체는 (허용목록 방식으로 애초에 credential 을 담지 않으므로) 실제 동작은 안 바뀌지만, "그 boundary 와 동일 정책" 이라는 비교 표현은 이제 존재하지 않는 메커니즘을 앵커로 삼고 있어 다음 독자가 "boundary strip 이 아직 어딘가에 남아 있다"고 오독할 위험이 있다. `RESOLUTION.md`(2026-08-24)의 "미러 스윕" 은 `spec/` 문서 위주로 `maskSensitiveFields` 문자열을 훑었는데, 이 6곳(특히 코드 주석 2곳)은 그 스윕 대상에 없었던 것으로 보인다.
  - 제안: 위 6곳의 "`maskSensitiveFields` 가 boundary 에서 strip" 문구를 "허용목록 구성 시점에 애초에 credential 필드를 담지 않음(boundary masking 과 무관)"으로 정정해, 존재하지 않는 boundary 를 계속 근거로 인용하지 않도록 한다.

- **[INFO]** plan 의 "18 passed" 측정치가 실제 테스트 스위트 결과와 맞지 않는다
  - 위치: `plan/in-progress/masking-expression-egress-split.md:64-66`(및 체크리스트 L103 "18 passed" 반복 언급)
  - 상세: "`DEFAULT_SENSITIVE_KEYS` 전 키를 정본 `deepRedactSecrets` 에 실제로 통과시켜 전부 마스킹됨을 확인했다(18 passed)"라고 적혀 있으나, 실제로 `mask-sensitive-fields.util.spec.ts` 를 실행하면(`npx jest mask-sensitive-fields.util.spec.ts -t "키 축"`) 해당 캐너리 `describe` 블록은 **23 passed**(`it.each` 22건 + 대조군 1건)이고, 파일 전체는 41 passed 다. `DEFAULT_SENSITIVE_KEYS` 소스 배열 자체도 22개 리터럴(Set 중복 제거 후 21개)이라 "18"과 일치하는 해석이 없다. 아마 캐너리를 최종 21개 키 전부로 확장하기 전 더 적은 키로 수행한 예비 검증치로 보인다.
  - 제안: 이 PR 이 닫히는 시점의 실제 실행 결과(예: "23 passed")로 갱신하거나, 그 수치가 어느 시점·어느 부분집합에 대한 것인지 명시한다. "실측"이라고 못박은 수치는 나중에 이 plan 을 근거자료로 참조할 사람에게 그대로 신뢰되므로 어긋나면 비용이 크다.

- **[INFO]** 체크리스트 항목이 약속한 "JSDoc" 대신 일반 `//` 인라인 주석으로 구현됐다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-48` (diff 상 게이트 30-49)
  - 상세: plan 체크리스트(`masking-expression-egress-split.md:105`)는 "왜 안전한지 JSDoc" 을 명시했지만, 실제로 추가된 것은 객체 리터럴의 `config` 프로퍼티 위에 붙인 `//` 라인 주석 블록이다(함수 `adaptHandlerReturn` 자체의 최상단 JSDoc 은 이 변경과 무관하게 그대로임 — 다행히 그쪽은 stale 하지 않다). 내용 자체는 매우 상세하고 정확해 실질적 결함은 아니다.
  - 제안: 사소한 스타일 불일치이므로 강제하지 않되, 향후 plan 체크리스트 문구와 실제 산출물 형식을 맞추고 싶다면 `/** ... */` 블록으로 바꿔도 좋다.

## 잘된 점 (참고)

- `spec/2-navigation/14-execution-history.md`(R-5)·`spec/4-nodes/3-ai/1-ai-agent.md`·`spec/3-workflow-editor/4-ai-assistant.md`·`spec/5-system/4-execution-engine.md`·`spec/conventions/{egress-masking,node-output}.md` 6개 spec_impact 파일 모두가 diff 에 포함되어 있고, 전부 원문을 취소선으로 보존한 채 "정정 (2026-08-24)" 블록으로 갱신했다 — 근거 소급 없이 변경 이력을 그대로 드러내는 좋은 패턴이다.
- `mask-sensitive-fields.util.spec.ts`·`handler-output.adapter.spec.ts` 의 신규 캐너리들은 "왜 이 테스트가 존재하는지·무엇을 어떻게 반증했는지"를 설명하는 JSDoc 블록을 각각 달고 있어 테스트 자체의 문서화 수준이 높다.
- `mask-sensitive-fields.util.ts` 헤더 주석(소비처 서술)이 소비처 소멸에 맞춰 취소선 정정됐다 — RESOLUTION.md INFO 3 이 지적한 항목이 실제로 해소돼 있음을 확인했다.
- `RESOLUTION.md`/`SUMMARY.md`(consistency-check 산출물)는 CRITICAL 을 회피하지 않고 정면으로 인정한 뒤 spec_impact 를 1건→6건으로 넓힌 이력을 그대로 남겨, 이 세션이 반복 지적받아 온 "R-5 를 4번 놓쳤다"는 사실까지 스스로 기록했다 — 검토 가능성이 높은 좋은 관행이다.

## 요약

핵심 안전성 서사(포함관계 캐너리·egress 대조군·spec 6곳 정정)는 실제 diff 와 정확히 일치하고, 원문 보존형 정정 방식도 이 저장소의 관례를 잘 따른다. 다만 (1) plan 체크리스트 5개 항목이 이미 완료된 작업을 여전히 미완료로 표시하고 있고, (2) 이 저장소가 masking 경계 변경마다 예외 없이 남겨 온 `CHANGELOG.md` 항목이 이번 PR 에는 없으며, (3) `_resumeState`/`_retryState` 의 credential 배제 정책을 설명하는 6곳(코드 주석 2곳 포함)이 이번에 제거된 "boundary strip" 을 여전히 비교 기준으로 인용하고 있다. 셋 다 기능/보안 결함은 아니지만, 다음 사람이 plan 상태·변경 이력·잔여 boundary 존재 여부를 오독할 수 있는 문서 신뢰성 문제다.

## 위험도

MEDIUM
