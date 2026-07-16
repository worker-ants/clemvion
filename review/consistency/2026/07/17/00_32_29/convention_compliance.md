# 정식 규약 준수 검토 — `plan/in-progress/ai-node-failed-conversation-preview.md`

> 검토 모드: spec draft 검토 (`--spec`)
> 참고: 본 target 은 1회차 `/consistency-check --spec` 에서 Cross-Spec CRITICAL(§10.6.1 이중 SoT 위험)을 이미 지적받아 Phase 1 이 수정된 상태다 (`review/consistency/2026/07/17/00_32_29/cross_spec.md`, `SUMMARY.md`). 본 checker 는 그 수정 이후 버전을 대상으로 **명명·출력포맷·문서구조·API문서·금지항목** 5개 관점만 별도 검토한다 — cross-spec SoT 모순 자체는 이미 다른 checker 산출물에 기록되어 있으므로 중복 판정하지 않는다.

## 발견사항

- **[INFO] 헤더 "관련 spec" 요약 줄이 Phase 1 정정 내용을 반영하지 못함**
  - target 위치: 문서 상단 `> 관련 spec: \`spec/conventions/conversation-thread.md\` (§9.1·§9.3·§9.7·§9.9 Inv-6·§9.10)` (L11)
  - 위반 규약: 직접적인 조항 위반은 아니나, `spec/2-navigation/14-execution-history.md` R-6 Rationale("EH-DETAIL-06 dangling 위임" 재발 방지 사례)이 보여주는 이 프로젝트의 명시적 관심사 — "탭 정책의 SoT 를 정확히 가리켜야 한다" — 와 결이 어긋난다.
  - 상세: 본문 Phase 1 은 1회차 검토를 거쳐 "탭 가시성·기본 탭 우선순위의 선언된 SoT 는 `spec/3-workflow-editor/3-execution.md §10.6.1`" 이라고 스스로 정정했고, 실제 개정 대상 A 그룹의 1번 항목으로 그 파일을 지목한다. 그런데 문서 최상단의 "관련 spec" quick-reference 는 여전히 `conversation-thread.md` 섹션들만 나열하고 `3-execution.md §10.6.1` 이나 `14-execution-history.md` 를 언급하지 않는다. 헤더만 읽는 독자(예: 후속 `--impl-prep` 체크나 리뷰어)는 실제 1차 SoT 를 놓치고 `conversation-thread.md` 만 바꾸면 된다고 오독할 위험이 있다 — 이번에 발견됐던 이중 SoT 혼동과 같은 근본 유형이다.
  - 제안: 헤더 줄을 `> 관련 spec: spec/3-workflow-editor/3-execution.md §10.6.1(탭 정책 SoT) · spec/conventions/conversation-thread.md §9.3/§9.9(데이터 소스·불변량) · spec/2-navigation/14-execution-history.md §3.4(참조 정합)` 형태로 갱신해 Phase 1 정정 내용과 동기화.

- **[INFO] `spec/conventions/data-hydration-surfaces.md` §2.1(Live 트리거 표)에 `execution.node.failed` 행 누락 — 참고용, target 결함 아님**
  - target 위치: 없음 (target 은 이 파일을 개정 대상에 포함하지 않음)
  - 위반 규약: `spec/conventions/data-hydration-surfaces.md` §2.1 "Live (실행 중 WS)" 트리거 표
  - 상세: 같은 문서 §1.1 의 `output.error` 행은 hydration 함수 목록에 "(d) WS `execution.node.failed` / `node.completed` (with error) → `useExecutionStore` APPEND" 를 정확히 명시하지만, §2.1 "Live" 표는 `ai_message`/`waiting_for_input`/`tool_call_started`·`_completed` 세 트리거만 나열하고 `execution.node.failed` 자체는 행으로 없다. 다만 이 문서의 스코프는 "output field 가 store 로 hydration 되는가"(§4 Rationale — "실행 내역 페이지에서 presentations 가 안 보임"류 회귀 차단)이고, `node.failed` → `conversationMessages` APPEND 는 실측 결과(코드) 정상 동작해 이 문서가 막으려는 회귀 클래스와는 무관하다. target 이 고치는 버그는 **hydration 이후 render-gate 층**(§10.6.1 영역)의 문제라 이 문서 자체를 target 의 개정 대상에 넣을 필요는 없다고 판단된다 — 다만 문서 완결성 측면에서 기존 gap 을 참고로 남긴다.
  - 제안: target 범위 밖. `data-hydration-surfaces.md` §2.1 에 `execution.node.failed` 행 추가는 별도 후속 정리로 남겨도 무방(target 의 BLOCK 사유 아님).

## 준수 확인된 항목 (근거 검증 결과)

- **명명 규약**: 신규 도입 식별자 `Inv-8`(§9.9), `CT-S15`/`CT-S16`(§9.10), `isFailedConversation`(코드 변수) 모두 기존 넘버링·명명 패턴(`Inv-1~Inv-7`, `CT-S1~CT-S14`, `is<Adjective>Conversation`)과 정합 — sibling `naming_collision.md` 산출물과 일치하는 결과를 독립적으로 재확인.
- **출력 포맷 규약**: target 이 인용하는 `system_error` payload 필드(`nodeId`/`nodeExecutionId`/`code`/`message`/`retryable`/`retryAfterSec`)는 `spec/conventions/conversation-thread.md §1.2.1` 이 정의한 shape 그대로다. 실제 구현(`use-execution-events.ts:884-895`)도 `nodeExecutionId: sanitizeUuid(payload.nodeExecutionId)` 를 포함해 APPEND — target 의 "nodeExecutionId 포함해 정확히 APPEND" 서술이 코드와 일치함을 직접 확인. 신규 WS 이벤트·페이로드 필드 도입 없음 — `error-codes.md`/`node-output.md` 의 형식 규약 위반 없음.
- **문서 구조 규약**: plan frontmatter(`worktree`/`started`/`owner`)가 `.claude/docs/plan-lifecycle.md §4` 스키마를 정확히 충족(`worktree` 는 sentinel 아닌 실제 디렉토리명, `started` ISO 날짜, `owner` 값 존재). 파일이 `plan/in-progress/`에 위치하고 동명 파일 충돌 없음. `_product-overview.md`/`0-` prefix 류 spec 진입 문서 명명 규칙은 대상 아님(본 target 은 plan 문서). Phase 1 이 제안하는 spec 개정 방식(3개 파일에 걸쳐 "탭 정책 SoT"·"데이터 소스·불변량"·"참조 정합"으로 책임 분리)은 `error-codes.md`/`audit-actions.md` 가 이미 쓰는 "책임 경계" 분리 패턴 및 `14-execution-history.md` R-6 의 "dangling 위임 방지" 선례와 정합적 — 이중 SoT를 만들지 않는 방향으로 스스로 교정된 상태.
- **API 문서 규약**: 본 target 은 backend API/DTO/Swagger 표면을 전혀 건드리지 않음(frontend 렌더 로직 + spec 문서 개정) — `swagger.md` 대상 아님.
- **금지 항목**: `conversation-thread.md §1.6`/§9.4/§9.5 가 명시적으로 금지하는 패턴(신규 inline marker 도입, emit messages raw 노출, marker 없는 사용자-출처 텍스트 주입) 어느 것도 target 에 없음. `node-output.md` 의 `port` 오용·echo 금지 패턴도 대상 아님. `i18n-userguide.md` 의 하드코딩 금지 대상 신규 UI 문자열도 도입하지 않음(탭 선택 로직 변경만, 신규 copy 없음).
- **인용 정확성 (부수 확인)**: target 이 인용한 `§9.7.1`(failExecution 표), `§9.7`(`node.failed` 행), `§9.9 Inv-6`, `§9.10 CT-S9/CT-S10`, `§1.2.1`(nodeId/nodeExecutionId shape), `§7 v2 로드맵`(EH-DETAIL-12), `spec/3-workflow-editor/3-execution.md §10.6.1`(디폴트 탭 우선순위 + retryable-error 예외), `spec/2-navigation/14-execution-history.md:211`(§10.6.1 을 SoT 로 명문화) 전부 실제 spec 본문과 대조해 정확함을 확인 — 인용 오류·날조 없음.

## 요약

target plan 문서는 1회차 cross-spec 검토에서 지적된 이중 SoT 위험을 스스로 정정한 상태이며, 그 정정된 형태를 기준으로 명명·출력 포맷·문서 구조·API 문서·금지 항목 5개 관점에서 살펴본 결과 `spec/conventions/**` 의 정식 규약을 위반하는 지점은 발견되지 않았다. 신규 도입 식별자(Inv-8·CT-S15/S16)는 기존 넘버링 패턴을 따르고, 인용된 spec 조항·payload shape·코드 라인은 전부 실측 대조로 정확함이 확인됐으며, 제안된 3-파일 분산 개정 방식은 프로젝트가 이미 쓰는 "SoT 책임 경계" 패턴과 정합적이다. 유일한 지적 사항은 문서 최상단 "관련 spec" quick-reference 줄이 본문의 Phase 1 정정 내용(진짜 1차 SoT = `3-execution.md §10.6.1`)을 아직 반영하지 못해 독자를 오도할 소지가 있다는 것(INFO)과, 참고용으로 `data-hydration-surfaces.md` §2.1 트리거 표의 pre-existing 누락을 덧붙인 것(INFO, target 결함 아님) 뿐이다.

## 위험도
NONE
