# 신규 식별자 충돌 검토 — `spec/5-system/14-external-interaction-api.md` (impl-done)

## 조사 방법

- diff(`origin/main...HEAD`, code_areas)에서 도입된 신규 식별자를 추출: `expectedNodeId`(파라미터), `SURFACE_MISMATCH_DEFAULTS`/`resolveSurfaceMismatchMessage`(상수·함수), `languageHints.surfaceMismatch`(설정 키), e2e 테스트 라벨 `G-2`.
- 각 식별자를 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/conversation-thread-secret-hardening-6477bb`) 전체(`spec/`, `plan/`, `codebase/`)에서 `git grep` 으로 재검색해 기존 사용처와의 의미 충돌 여부를 확인.
- target 문서 자체(`spec/5-system/14-external-interaction-api.md`)는 이번 diff 에서 코드 영역(`code_areas`)에 미포함이라 payload 상 "(없음)" 으로 표시됐으나, 실제로는 별도 커밋(`e0d4ddf51`)에서 §5.1 에 각주 1문장이 추가됐음을 워킹트리에서 직접 확인(`git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md`). 해당 각주는 새 식별자를 도입하지 않고 기존 `STATE_MISMATCH`/`nodeId` 개념을 참조만 한다.

## 발견사항

- **[INFO]** e2e 테스트 라벨 `G-2` 가 인접한 기존 `G` 라벨과 다른 관심사를 다룸
  - target 신규 식별자: `it('G-2. submit_form nodeId 가 대기 노드와 불일치 → 409 STATE_MISMATCH (F-1)', ...)` (`codebase/backend/test/external-interaction.e2e-spec.ts:309`)
  - 기존 사용처: 바로 앞 `it('G. submit_form 필수 field 누락 → 400 VALIDATION_ERROR + details ...)` (같은 파일 262행) — G 는 "필수 field 누락"을 다루는 반면 G-2 는 "nodeId 불일치"를 다뤄 서로 다른 시나리오.
  - 상세: 파일은 A/B/C/…/I/I-2/J 식으로 알파벳 순 라벨 + 서브넘버링(`I-2`)을 이미 사용 중이라 `G-2` 자체는 컨벤션 위반은 아니다. 다만 `I`→`I-2` 는 같은 관심사(같은 진입점의 변형)의 하위 케이스인 반면, `G`(필수 field 누락)와 `G-2`(nodeId 불일치)는 서로 다른 검증 축이라 서브넘버링이 "G 시나리오의 파생"이라는 오해를 줄 수 있다. 실제 충돌(같은 이름이 다른 의미로 이미 쓰임)은 아님 — 라벨이 유일하고 코드 동작도 정확하다.
  - 제안: 원한다면 새 독립 축을 나타내는 다음 미사용 최상위 라벨(예: `K`)로 옮기는 것을 고려. 기능상 문제는 없으므로 필수 수정 아님.

## 상세 검증 결과 (충돌 없음 확인)

- **요구사항 ID**: `F-1`/`F-2`(코드 주석의 plan 참조), `F-3`/`F-4`(plan 문서 내부 결정 라벨)는 모두 `plan/in-progress/eia-command-waiting-surface-guard.md` 로컬 스코프 라벨이며, 저장소 전체에서 다른 문서가 동일 `F-1`/`F-2`/`F-3`/`F-4` 를 다른 의미로 쓰는 사례 없음(`git grep` 확인). 이 프로젝트의 plan 문서들은 이런 문자-숫자 라벨(G-1/G-2/G-3 in `cafe24-backlog-residual.md` 등)을 문서 로컬 스코프로 재사용하는 기존 컨벤션을 따른다.
- **엔티티/타입명**: `SURFACE_MISMATCH_DEFAULTS` / `resolveSurfaceMismatchMessage` 는 동일 파일(`language-hint-defaults.ts`)의 기존 `SESSION_EXPIRED_DEFAULTS`/`resolveSessionExpiredMessage`, `FORM_OPEN_LABEL_DEFAULTS`/`resolveFormOpenLabel` 과 동일 명명 패턴을 따르며 의미 충돌 없음.
- **API endpoint**: 신규 endpoint 없음. 기존 `POST /api/external/executions/:id/interact` 에 파라미터(`expectedNodeId`, 내부 전용)만 추가. `expectedNodeId` 는 저장소 전체에서 이번 신규 구현 두 파일(`execution-engine.service.ts`, `interaction.service.ts`)에만 존재 — 기존 사용처 없음.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트 없음.
- **환경변수·설정키**: `languageHints.surfaceMismatch` 신규 키는 `spec/5-system/15-chat-channel.md`(§4.1.1, 라인 225/257/261), frontend i18n dict(`triggers.ts` ko/en), telegram 사용자 문서(`telegram.mdx`/`telegram.en.mdx`)에 걸쳐 일관되게 문서화·구현되어 있고, 기존 `languageHints.*` 키(`groupChatRefusal`/`sessionExpired`/`formOpenLabel` 등)와 이름이 겹치지 않음.
- **파일 경로**: target 문서(`spec/5-system/14-external-interaction-api.md`) 자체는 새 파일이 아니라 기존 문서에 각주 1문장만 추가됐고, 새 spec 파일 경로 도입 없음.
- **기존 식별자 재사용(정상 재사용, 충돌 아님)**: `InvalidExecutionStateError`(`workflow-errors.ts`) 와 `isInternalCtx`(`interaction.guard.ts`)는 이번 diff 이전부터 존재하던 식별자를 그대로 재사용한 것이며 의미 변경이 없어 "신규 식별자 충돌" 범주에 해당하지 않는다. `InteractDto.nodeId` 필드도 이름·타입 변경 없이 검증 로직만 엄격화된 것으로, 새 식별자 도입이 아니다(별도 관점의 behavior-change 검토 대상일 수 있으나 본 검토 범위 밖).

## 요약

이번 diff 가 도입하는 신규 식별자(`expectedNodeId` 파라미터, `SURFACE_MISMATCH_DEFAULTS`/`resolveSurfaceMismatchMessage`, `languageHints.surfaceMismatch` 설정 키, e2e 테스트 라벨 `G-2`)는 저장소 전역(spec/plan/codebase) 재검색 결과 기존에 다른 의미로 사용 중인 사례가 없다. 신규 API endpoint·이벤트·ENV·spec 파일 경로 도입도 없으며, target 문서 자체에 추가된 각주는 새 식별자 없이 기존 `STATE_MISMATCH`/`nodeId` 개념을 참조만 한다. 유일한 지적사항은 e2e 테스트 라벨 `G-2` 가 서로 다른 관심사인 `G` 옆에 서브넘버링돼 다소 혼동을 줄 수 있다는 점이나 실질적 충돌은 아니다.

## 위험도

NONE
