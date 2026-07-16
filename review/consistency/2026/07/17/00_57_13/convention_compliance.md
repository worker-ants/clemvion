# 정식 규약 준수 검토 (2회차) — `plan/in-progress/ai-node-failed-conversation-preview.md`

> 검토 모드: spec draft 검토 (`--spec`)
> 배경: 1회차(`review/consistency/2026/07/17/00_32_29/convention_compliance.md`)는 위험도 NONE + INFO 2건. 그중 "문서 상단 관련 spec 줄이 정정된 SoT 미반영" 은 target 이 SoT 책임 경계별 4-블록 헤더로 재작성해 처분했다. 2회차는 그 확장분(개정 대상 A~D 4개 spec 문서 분산, Phase 2 의 `showTabs` `cancelled` 추가, `result-detail.tsx:1080-1084` 사문 주석 정정 추가)을 대상으로 재검토했다. `spec/conventions/**` 정식 규약(특히 `conversation-thread.md` 전문, `spec/3-workflow-editor/3-execution.md §10.6.1/§10.8`, `spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/_product-overview.md`, `codebase/frontend/src/components/editor/run-results/result-detail.tsx`, `codebase/frontend/src/lib/websocket/use-execution-events.ts`)를 직접 대조했다.
>
> **참고**: 본 prompt 에 첨부된 "정식 규약 모음" 은 크기 제한으로 `audit-actions.md`·`cafe24-api-catalog/**` 까지만 담기고 target 이 실제로 개정 대상으로 삼는 `spec/conventions/conversation-thread.md` 는 잘려나갔다 (디렉토리 알파벳 순서상 `cafe24-*` 다음). 본 검토는 해당 파일을 리포지토리에서 직접 전문 로드해 대조했으므로 결과에는 영향 없으나, prompt 조립 파이프라인의 참고사항으로 남긴다.

## 발견사항

- **[INFO] 헤더의 "SoT 로 명문화" 줄번호가 실제 SoT 선언 문장과 다른 줄을 가리킴**
  - target 위치: 문서 상단 `> - **탭 가시성·기본 탭 우선순위 SoT**: \`spec/3-workflow-editor/3-execution.md\` (§10.6.1·§10.8) — \`spec/2-navigation/14-execution-history.md:213\` 이 SoT 로 명문화`
  - 위반 규약: 직접 조항 위반은 아니나, 1회차 검토(`convention_compliance.md` 1회차 발견사항)와 `spec/2-navigation/14-execution-history.md` R-6 Rationale("EH-DETAIL-06 dangling 위임" 재발 방지 사례)이 요구하는 "SoT 를 정확한 위치로 가리켜야 한다" 는 이 프로젝트의 명시적 관심사와 어긋난다.
  - 상세: 실측 결과 `14-execution-history.md:211` 이 "...서브 탭 전체 구성·조건·기본탭·auto-fallback 은 [Spec 실행 §10.6.1] 이 단일 진실(SoT)이다." 라고 명문화하는 실제 문장이고, `:213` 은 "기본 선택 탭: 에러면 Error, outputData가 있으면 Preview, 그 외 Output (§10.6.1 의 retryable-error Preview 예외·auto-fallback 포함)" 으로 SoT 선언문이 아니라 그 결과를 반영한 구체 문구다(Phase 1 항목 9 "L213 기본 선택 탭 문구" 가 가리키는 대상은 정확히 이 줄이다). 헤더 하단 "이력 화면 참조 정합" 블록의 `L213` 사용은 정확하지만, 상단 "SoT 로 명문화" 서술에 붙은 `:213` 은 1회차가 제안했던 `:211` 에서 한 줄 밀렸다 — 두 용도의 L213 이 한 줄에 섞이면서 생긴 오기로 보인다.
  - 제안: 상단 SoT 선언 인용은 `14-execution-history.md:211` 로 되돌리고, 하단 "이력 화면 참조 정합" 블록의 `L213` 은 그대로 유지.

- **[WARNING] CT-S15/CT-S16 서술이 §10.6.1 확장의 핵심 델타(non-retryable 케이스)를 명시적으로 겨냥하는지 불분명**
  - target 위치: Phase 3 — "`result-detail.test.tsx` — CT-S15 (failed 대화 노드 미리보기 노출 + 대화 전체 + system_error + 재시도 버튼), CT-S16 (기본 탭 = 미리보기; 비대화형 `http_request` 는 기존대로 오류 탭 …)"
  - 위반 규약: `spec/conventions/conversation-thread.md §9.10` "§9 본 절을 변경하거나 conversation timeline 관련 코드를 수정하는 PR 은 다음 시나리오의 단위 테스트 통과를 의무로 한다 … 새 시나리오 발견 시 본 표 추가 + fixture 추가 + 해당 테스트 작성을 PR review 의 의무로 한다."
  - 상세: 1회차 `rationale_continuity.md` 의 CRITICAL 은 "§10.6.1 의 기존 예외는 `port:'error'` + `retryable===true` 로 좁게 scope 됐는데 target 이 이를 무조건부로 확장하려 한다" 는 것이었고, 그 제안은 "확장을 의도한다면 새 Rationale 을 남기고, **`CT-S10`(non-retryable, 재시도 버튼 미노출)에 대응하는 탭 기본값 시나리오도 CT-S15/S16 후보로 정의**" 였다. target 은 새 Rationale(Phase 1 D 항목 하단 blockquote)은 충실히 추가했으나, Phase 3 의 CT-S15 설명은 "재시도 버튼" 노출을 조건으로 명시해 사실상 **retryable=true** 픽스처를 가리키는 것으로 읽힌다(retryable=true 의 Preview-기본선택은 §10.6.1 예외가 이미 기존에 규정하던 부분이라, 이번 plan 이 실제로 확장하는 지점이 아니다). CT-S16 은 "기본 탭 = 미리보기" 라고만 서술해 어느 fixture(retryable/non-retryable)를 쓰는지 불명확하다 — non-retryable 픽스처로 테스트하지 않으면, 정작 이번 Rationale 확장이 정당화하는 새 동작(비-retryable 대화형 실패도 Preview 기본)이 회귀 차단 표에서 검증되지 않는다.
  - 제안: Phase 1 §9.10 표 갱신 시 CT-S15/CT-S16(또는 신설 CT-S17) 중 최소 하나를 **명시적으로 `retryable: false`(CT-S10 과 동일 조건) 픽스처** 로 정의해 "비-retryable 대화형 실패 노드도 기본 탭 = Preview" 를 직접 검증하도록 표 문구를 구체화할 것.

## 준수 확인된 항목 (재검증)

- **명명 규약**: `Inv-8`(§9.9), `CT-S15`/`CT-S16`(§9.10) 은 실측 `Inv-1~Inv-7`(L554-560, 7행)·`CT-S1~CT-S14`(§9.10 표) 번호열의 정확한 연속. `'cancelled'` 문자열도 코드베이스 전역에서 이미 쓰이는 표준 철자(`execution-store.ts:17`, `use-execution-events.ts:954,969`, `apply-execution-snapshot.ts:125,142` 등)와 일치 — 새 철자 변형 도입 없음.
- **§9.9 "6가지 불변량" 정합화 (Phase 1 항목 5)**: 실측 결과 §9.9 서두는 현재도 "다음 6가지 불변량은…" 이라 적혀 있으나 표는 `Inv-1`~`Inv-7` 7행이다 — target 이 지적한 기존 오류가 실제로 존재하며, 정정 계획은 타당하다.
- **§10.6.1 인용 정확성**: "completed / failed / cancelled / waiting_for_input 상태의 노드는 헤더 아래에 서브 탭 바를 표시한다"(L471), "AI multi-turn retryable error 종결 시 예외 … Preview 우선"(L515) 인용 모두 원문과 정확히 일치. `showTabs`(`result-detail.tsx:1048-1052`) 실측 결과 `'cancelled'` 가 실제로 누락돼 있어(`isConversationNode || status==='completed' || 'failed' || 'waiting_for_input'`) Phase 2 항목 5 의 drift 주장은 사실과 부합.
- **사문 주석 정정 (Phase 2 항목 4)**: `result-detail.tsx:1080-1084` 주석 "failed 상태의 multi-turn 종결 노드도 conversation preview 노출…" 을 실측한 결과, 이 주석이 붙은 분기는 `isCompletedConversation`(= `status === 'completed'`) 조건에서만 진입하는 코드로 확인 — 주석이 서술하는 "failed 상태" 케이스와 실제 분기 조건이 불일치하는 사문(死文)이라는 target 의 진단이 정확함.
- **양방향 교차 참조 의무 이행 확인**: `plan/in-progress/node-output-redesign/ai-agent.md:213`(2026-07-17 자 항목)에 본 plan 을 가리키는 역참조가 이미 추가돼 있음을 확인 — Phase 2 "양방향 교차 참조 의무" 서술이 실제로 이행된 상태.
- **개정 대상 A~D 분산이 SoT 원칙에 정합**: `spec/2-navigation/14-execution-history.md:211`(SoT 선언)·`spec/3-workflow-editor/_product-overview.md:121`(ED-EX-13, retryable 예외 미반영 상태 확인)·`spec/3-workflow-editor/3-execution.md §10.6.1/§10.8` 실측 모두 target 서술과 일치. `conversation-thread.md` 에 탭 정책(§9.13)을 신설하지 않고 §10.6.1 참조로 남기는 구조는 프로젝트의 "단일 진실 원칙"(CLAUDE.md)·`error-codes.md`/`audit-actions.md` 식 책임 경계 분리 패턴과 정합.
- **금지 항목**: `conversation-thread.md §1.6`(신규 inline marker 금지)·§9.4(emit raw 노출 금지)·§9.5(마커 strip) 어느 것도 target 이 위반하지 않음. `node-cancellation.md §5.1` 실측 결과 `execution.node.cancelled` 는 `node.failed` 와 별도 WS 이벤트이며 `handleNodeCancelled`(`use-execution-events.ts:936-974`)는 `conversationMessages` 를 건드리지 않는다 — target 이 Phase 3 에서 "`cancelled` 종결 대화 노드의 `system_error` APPEND 여부 실측 필요" 로 남겨둔 것은 정확한 판단이며, 현재 구현상 APPEND 되지 않을 가능성이 높다는 근거가 이미 코드에 있다(하드코딩된 단정 없이 실측을 Phase 3 로 미룬 태도 자체는 규약 위반 아님).
- **문서 구조 규약**: plan frontmatter(`worktree: ai-node-conversation-history-ff487b`/`started: 2026-07-17`/`owner: developer`)는 `.claude/docs/plan-lifecycle.md` 스키마 충족. Spec 문서의 Overview/본문/Rationale 3섹션 요구는 plan 문서(`plan/in-progress/**`)에는 적용 대상이 아니며, target 의 Phase 구성(배경→스코프→Phase 1~4→결정 기록)은 이 저장소의 통상적 plan 구조 패턴과 일치.
- **API 문서 규약**: 대상 없음(OpenAPI/Swagger/DTO 표면 무관, frontend 렌더 로직 + spec 문서 개정).

## 요약

2회차 검토 대상인 확장분(4-문서 분산, `showTabs` `cancelled` 추가, 사문 주석 정정)은 모두 실측 코드·spec 원문과 대조한 결과 사실에 부합하며, 1회차에서 지적된 이중 SoT 위험·Naming Collision INFO·Rationale Continuity CRITICAL 은 SoT 책임 경계 재구성과 명시적 Rationale 신설로 실질적으로 해소됐다. 다만 두 가지 잔여 사항이 있다 — (1) 헤더의 "SoT 로 명문화" 줄 인용이 `L213`(실제 SoT 문장은 `L211`)으로 한 줄 밀려 있는 사소한 인용 오류(INFO), (2) Rationale Continuity CRITICAL 이 확장을 정당화한 실제 델타(non-retryable 대화형 실패의 Preview 기본선택)를 CT-S15/CT-S16 서술이 명시적으로 겨냥하는지 불분명해 §9.10 의 "새 시나리오 검증 의무" 이행이 서면상 완결되지 않은 점(WARNING). 두 항목 모두 문서를 BLOCK 할 정도는 아니며 Phase 1/Phase 3 착수 전 표현을 다듬으면 해소된다.

## 위험도
LOW
