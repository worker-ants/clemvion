# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 이 PR 이 삭제된 어댑터 마스킹을 대체하는 유일한 자동 안전장치("포함관계 캐너리")가 스스로 주장하는 "목록이 넓어져도 자동 검사한다"를 실제로 수행하지 않는다는 사실이, **requirement 리뷰어와 testing 리뷰어 양쪽이 각자 독립적으로 뮤테이션 테스트를 재현**해 확인했다. 현재 22개 키에 대해서는 실제로 안전(egress 마스킹이 실측으로 확인됨)하지만, 향후 `DEFAULT_SENSITIVE_KEYS` 확장 시 이 캐너리는 새 키를 조용히 놓칠 수 있다 — 이는 이번 라운드에서 새로 발견된, 이전 CRITICAL(R-5 보안 Rationale 무효화)의 재발 근접 사례다. forced reviewer 없음 · skipped reviewer 없음 — 전원 정상 실행·전문 확보됨.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement/Testing | "포함관계 캐너리"(`DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축`)가 실제로는 `DEFAULT_SENSITIVE_KEYS`(export 안 됨)에서 파생되지 않고, 테스트 파일에 손으로 다시 타이핑한 21~22개 키 리터럴을 `maskSensitiveFields()`에 통과시켜 `Object.keys()`로 얻은 것뿐이다. `maskSensitiveFields`는 어떤 키도 드롭하지 않으므로 `Object.keys(maskSensitiveFields(x))`는 항상 입력 `x`의 키와 같아 `DEFAULT_SENSITIVE_KEYS`의 실제 내용과 **무관**하다. **실측(두 리뷰어 독립 재현)**: (a) `DEFAULT_SENSITIVE_KEYS`에서 `idToken` 제거 → 캐너리 케이스 수는 22→22로 불변, 실패한 1건은 캐너리와 무관한 기존 명시 테스트뿐(plan 문서의 "41→40, 캐너리가 줄었다" 해석이 오판임을 확인). (b) egress 정규식이 못 잡는 가상 신규 키(`oauthCred`)를 목록에 추가 → 전체 스위트 41/41 GREEN, 이 PR 이 "원리적으로 없다"고 주장하는 바로 그 누락 실패 모드가 재현되는데도 캐너리는 무반응. | `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:126-172` (JSDoc "자동으로 새 키를 검사한다" 주장, `KEYS` 파생부); 동일 주장이 `handler-output.adapter.ts:42-44`, `spec/conventions/egress-masking.md:56`, `plan/in-progress/masking-expression-egress-split.md:65-129`에 반복 인용 | `DEFAULT_SENSITIVE_KEYS`를 테스트 전용으로라도 export(또는 접근자 제공)해 캐너리가 진짜 상수에서 직접 파생하도록 재작성. 그 전까지는 spec/주석의 "자동 검사" 문구를 "수동 동기화 필요"로 정정하고, plan의 M2 뮤테이션 관측 서술(캐너리 케이스 수 불변임에도 "조용히 줄었다"고 기록된 부분)도 실측에 맞춰 정정. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | Security | config echo 를 표현식 평가가 원문으로 읽을 수 있게 되면서, egress 마스킹이 닿지 않는 새 유출 경로(동일 워크스페이스 내 한 노드의 `config.apiKey` 등을 워크플로우 로직으로 다른 노드 body 에 실어 제3자 엔드포인트로 릴레이)가 열린다. 종전엔 마스킹 버그가 부작용으로 이 경로도 막고 있었다. | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:49` (주석 30-48) | 이 트레이드오프가 의도된 것이면, "동일 워크스페이스 내 크로스-노드 자격증명 릴레이" 벡터를 보안 Rationale 에 명시적으로 추가. HTTP Request/Send Email 등 자격증명을 문자열 그대로 config 에 담는 노드 타입에 대해 향후 credential 참조 간접화(AI Agent 의 `llmConfigId` 패턴) 적용을 검토 항목으로 등재. |
| 3 | Architecture/API Contract/Side Effect | 안전성이 "데이터 생성 시점에 구조적으로 보장되는 마스킹"(safe-by-construction)에서 "각 egress 소비처가 개별적으로 규율을 지켜야 하는 마스킹"(safe-by-convention)으로 이동했다. `NodeHandlerOutput.config` 타입에 raw/masked 구분 브랜딩이 없어, 향후 두 관문(REST `redactStoredDataForResponse`, WS `maskWireEnvelope`)을 우회하는 신규 소비처(새 엔드포인트·새 emit 헬퍼)가 추가돼도 컴파일러가 잡지 못한다. | `handler-output.adapter.ts:49`; `websocket.service.ts:334,408`; `redact-stored-error.ts:107-108` | 신규 egress 경로 추가 시 "config는 반드시 deepRedactSecrets*를 거친다"를 타입 수준(`Masked<T>` 브랜드) 또는 lint 규칙으로 승격하는 것을 백로그에 등재. `adaptHandlerReturn`/`NodeHandlerOutput.config`의 JSDoc/타입에 "raw, NOT pre-masked — 새 소비처는 자체 egress 마스킹 필수" 경고를 소비처 쪽(`execution-engine.service.ts`/`ai-turn-orchestrator.service.ts`)에도 추가. |
| 4 | Documentation/Scope/Requirement/Testing/Maintainability | plan 체크리스트(`masking-expression-egress-split.md`) 6개 항목(L105, L106, L108, L109, L110, L111)이 이미 완료된 작업(어댑터 마스킹 제거+JSDoc, 캐너리 3종, spec 6개 정정, 자매 트래커 동기화, chatChannel 별건 등재, TEST WORKFLOW 4단계)을 여전히 `[ ]`(미완료)로 표시. 유일하게 정확한 미체크는 `/ai-review`(L112) 뿐. | `plan/in-progress/masking-expression-egress-split.md:105,106,108,109,110,111` | 마무리 커밋에서 완료된 6개 항목을 `[x]`로 갱신. |
| 5 | Documentation/Scope/Maintainability/Architecture | "`maskSensitiveFields` boundary 와 동일 정책"이라는, 이번 PR 로 제거된 메커니즘을 여전히 근거로 인용하는 stale 주석 2곳이 mirror sweep(RESOLUTION.md, spec 6곳 정정)에서 누락됨. `_resumeState`/`_retryState` 실제 동작(allow-list 방식 credential 배제)은 안 바뀌었으나, 존재하지 않는 boundary 를 근거로 계속 인용해 다음 독자가 "boundary strip 이 아직 남아있다"고 오독할 위험. spec 쪽 유사 문구(`node-output.md:256`, `4-execution-engine.md:193,203,1510`)도 동일 문제. | `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3280, 3350-3353`; `spec/conventions/node-output.md:256`; `spec/5-system/4-execution-engine.md:193,203,1510` | 6곳 모두 "credential 은 egress(REST/WS)에서 마스킹, `_resumeState`/`_retryState` 자체는 allow-list 로 애초에 배제(boundary masking 과 무관)"로 정정. |
| 6 | Documentation | 이 저장소가 masking 경계 변경마다 예외 없이 남겨 온 `CHANGELOG.md` 관례에 이번 PR 만 항목이 없다. 이번 변경은 엔진 boundary 마스킹 완전 제거 + `NodeExecution.outputData.config` DB 저장 형태가 마스킹값→원문으로 바뀌는 운영 영향이 있다. | `CHANGELOG.md` (부재가 발견사항; 관련 선례 L196) | 다른 `## Unreleased` 항목과 같은 형식으로 운영 영향 + 안전성이 키-집합 포함관계에 의존한다는 점을 명시하는 항목 추가. |
| 7 | Architecture | `CREDENTIAL_KEY_PATTERN`이 두 파일(REST 공유본 vs WS 로컬본)에 독립 선언돼 있고 서로 다르며(WS 쪽은 `x-api-key` 미포함), 이번 PR 의 신규 안전 불변식(포함관계 캐너리)은 그중 REST/WS 공유본(`deepRedactSecrets`) 하나에 대해서만 검증한다. 오늘의 config echo 경로 자체는 정합하나(실측 확인), DRY 위반 구조 위에 이 PR 이 올라탄다. | `shared/utils/sanitize-error-message.ts:112`; `websocket/websocket.service.ts:78` | 별건(`spec-sync-external-interaction-api-gaps.md` W6)으로 이미 등재됨 — 장기적으로 `CREDENTIAL_KEY_PATTERN`을 단일 모듈에서 export 해 통합 검토. |
| 8 | Architecture | 포함관계 캐너리(cross-module contract test)가 `common/utils`의 유닛 테스트 파일 안에 숨어 있어, `shared/utils/sanitize-error-message.ts`를 유지보수하는 사람이 자신이 깨뜨릴 수 있는 불변식의 존재를 알기 어렵다(발견성 낮음). | `mask-sensitive-fields.util.spec.ts:129-173` | `sanitize-error-message.ts` 쪽에 상호 참조 주석 추가 또는 별도 `*.contract.spec.ts`로 이전 검토. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 9 | Testing | 마스킹 제거로 `config`의 암묵적 deep-clone(매 레벨 새 객체 생성)도 함께 사라져 이제 핸들러 원본 객체가 그대로 참조 전달되는데, 이 aliasing 변화(원본 오염 가능성)를 검증하는 테스트가 없다. | `handler-output.adapter.ts:49`; `handler-output.adapter.spec.ts:109-194` | `expect(out.config).toBe(raw.config)` 캐너리 1건 추가로 aliasing 동작 명시적 고정. |
| 10 | Documentation | plan 의 "18 passed" 실측치가 실제 실행 결과(23 passed, 캐너리 블록 기준)와 불일치. `DEFAULT_SENSITIVE_KEYS` 21개와도 "18"이 맞지 않음 — 예비 검증치로 추정. | `plan/in-progress/masking-expression-egress-split.md:64-66,103` | PR 닫히는 시점의 실제 수치로 갱신하거나 어느 시점/부분집합인지 명시. |
| 11 | Documentation | 체크리스트가 약속한 "JSDoc" 대신 일반 `//` 인라인 주석으로 구현됨(내용 자체는 정확·상세). | `handler-output.adapter.ts:30-48` | 사소한 스타일 불일치, 강제 아님. |
| 12 | Maintainability | 동일한 보안 불변식 설명이 3곳(어댑터 주석, 어댑터 spec JSDoc, util spec JSDoc)에 근접 중복 서술 — 향후 한 곳만 고치고 나머지를 놓칠 위험. | `handler-output.adapter.ts:30-48`; `handler-output.adapter.spec.ts:92-108`; `mask-sensitive-fields.util.spec.ts:113-128` | 한 곳을 canonical 설명으로 삼고 나머지는 참조로 축약. |
| 13 | Maintainability/Architecture | 동일 basename(`sanitize-error-message.ts`)의 서로 다른 두 유틸 파일(알림용 vs API/WS egress용)이 존재 — 이번 PR 안전 주장이 "정확히 어느 마스커를 거치는가"에 의존하는 만큼 오인 위험. `common/utils` vs `shared/utils` 네임스페이스 구분 기준도 불명확. | `shared/utils/sanitize-error-message.ts` vs `modules/execution-engine/sanitize-error-message.ts` | 별건 처리 시 알림 전용 쪽을 리네임 검토. 네임스페이스 구분 기준 문서화는 백로그. |
| 14 | Security/Documentation | WS 로컬 `CREDENTIAL_KEY_PATTERN`이 공유본보다 좁은 점은 이미 별도 트래커(`spec-sync-external-interaction-api-gaps.md` W6)에 등재됨 — 이번 PR 경로 자체의 결함은 아니나, config echo 안전성이 egress 마스킹 하나에 전적으로 의존하게 되어 우선순위 재검토 가치. | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W6 | 별건 우선순위 재검토만 권장, 이 PR 액션 불요. |
| 15 | API Contract | REST/WS 최종 응답의 마스킹 포맷·대상 키 집합은 이번 변경으로 바뀌지 않음(egress 2차 마스킹이 그대로 커버) — breaking change 없음, DTO 문서 갱신 불요. | `handler-output.adapter.ts:49`; `redact-stored-error.ts`; `websocket.service.ts` | 없음 (양호, 안전성 근거로 기록). |
| 16 | API Contract | 안전 주장 검증이 실제 REST/WS 파이프라인이 아니라 유틸 함수(`deepRedactSecrets`) 직접 호출 수준에서만 이뤄짐 — e2e 로 최종 HTTP 응답을 확정하는 테스트는 이 diff 범위에 없음(기존부터 없었던 갭으로 보임, 신규 갭 아님). | `handler-output.adapter.spec.ts` | 별건으로 `GET /api/executions/:id` config 자격증명 필드 포함 e2e 존재 여부 확인 후 필요시 추가. |
| 17 | Side Effect | 공유 worktree 에서 일시적 뮤테이션 오염(`idToken` 제거 + `.orig` 파일)을 리뷰 도중 관측했으나, 재확인 시 HEAD/작업트리 clean 하고 관련 스위트(624 tests) 전부 GREEN — 이번 diff 의 결함 아님. | `mask-sensitive-fields.util.ts` (작업트리, 커밋 아님) | 조치 불요(관찰 기록). |
| 18 | Side Effect/API Contract | `NodeExecution.outputData.config`의 DB 저장 값이 마스킹본→원문으로 바뀌는 것은 계획서 주장과 실측이 일치하는 의도된 변경이며, 관련 spec 6개 문서가 이미 동기화되어 정합함. | `ai-turn-orchestrator.service.ts`(소비처, diff 밖); spec 6개 파일 | 없음(이미 planner 턴에서 처리 완료). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 표현식 평가가 원문 config 를 읽게 됨 — 크로스-노드 자격증명 릴레이 벡터 신규 개방(WARNING) |
| side_effect | LOW | boundary 계약이 safe-by-construction → safe-by-convention 으로 전환(WARNING), 나머지는 의도된 동작 확인 |
| requirement | HIGH | **포함관계 캐너리가 DEFAULT_SENSITIVE_KEYS 에서 실제로 파생되지 않음을 뮤테이션으로 실증 (CRITICAL)** |
| testing | WARNING(자체표기) | 동일 CRITICAL 결함을 독립적으로 재현·확인, plan 의 M2 관측 서술도 오판임을 실증 |
| documentation | MEDIUM | plan 체크리스트 미동기화, CHANGELOG 누락, stale boundary 주석 6곳 |
| scope | LOW | plan 체크박스 6곳 미동기화 외 스코프 이탈 없음 |
| maintainability | LOW | stale 주석, 근접중복 서술, 동명 파일 — 코드 자체 복잡도는 오히려 개선 |
| architecture | MEDIUM | SRP 개선이나 안전성이 구조적 관문→관례 기반으로 이동, CREDENTIAL_KEY_PATTERN 이중선언 |
| api_contract | LOW | REST/WS 응답 계약 불변(양호), 안전 불변식이 타입/스키마 레벨로 강제되지 않음 |

## 발견 없는 에이전트

(없음 — 9개 에이전트 전원이 최소 1건 이상의 WARNING/INFO 이상 발견사항을 보고함)

## 권장 조치사항

1. **[최우선]** `mask-sensitive-fields.util.spec.ts` 의 포함관계 캐너리를 `DEFAULT_SENSITIVE_KEYS` 실제 상수에서 직접 파생하도록 재작성(상수 export 또는 테스트 전용 접근자 추가). 그 전까지 spec(`egress-masking.md:56`)·코드 주석(`handler-output.adapter.ts:42-44`)·plan 문서의 "자동 검사" 서술을 정정해 거짓 안전 주장을 방치하지 말 것.
2. `ai-turn-executor.ts` 의 stale "`maskSensitiveFields` boundary" 인용 2곳과 spec 3곳(`node-output.md:256`, `4-execution-engine.md:193,203,1510`)을 "egress 마스킹 + allow-list 배제"로 정정해 mirror sweep 잔여를 닫는다.
3. `plan/in-progress/masking-expression-egress-split.md` 체크리스트 6개 항목을 실제 완료 상태(`[x]`)로 갱신하고, `CHANGELOG.md` 에 이번 마스킹 경계 변경 항목을 추가한다.
4. (중기) `NodeHandlerOutput.config` 에 raw/masked 구분을 타입 레벨로 강제하는 방안(브랜드 타입 또는 lint 규칙)을 백로그에 등재해, 향후 신규 egress 소비처가 두 마스킹 관문을 우회하지 못하도록 구조적으로 닫는다.
5. (낮은 우선순위) `CREDENTIAL_KEY_PATTERN` 이중 선언 통합, 동명 `sanitize-error-message.ts` 리네임, aliasing(`toBe`) 캐너리 추가는 별건 백로그로 유지.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(9명: security, side_effect, requirement, testing, documentation, scope, maintainability, architecture, api_contract) 실행됨. 제외(skipped)·강제(forced) 항목 없음.