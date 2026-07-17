# 신규 식별자 충돌 검토 — `is-conversation-output-restructure.md`

검토 대상: `plan/in-progress/is-conversation-output-restructure.md` (2026-07-17)
검토 관점: 신규 식별자(패키지명·타입명·값 export·디렉터리 경로) 가 기존 사용처와 충돌·혼동을 일으키는가

## 검토 방법

실제 저장소(`codebase/`, `spec/`, `plan/`)를 전역 grep 하여 draft 가 새로 도입하는 각 식별자의 실제 기존 사용 여부를 실측했다 (prompt 에 첨부된 코퍼스 스냅샷이 아니라 현재 worktree 실물 기준).

## 발견사항

- **[WARNING] 패키지명 `@workflow/node-output-contract` — 기존 규약 문서 `spec/conventions/node-output.md`(id: `node-output`) 및 열려 있는 `node-output-redesign` plan 과 주제 참칭 위험**
  - target 신규 식별자: 패키지명 `@workflow/node-output-contract`, 디렉터리 `codebase/packages/node-output-contract/`
  - 기존 사용처:
    - `spec/conventions/node-output.md` (frontmatter `id: node-output`, `status: partial`) — "Output 변수 일관성 규칙", `NodeHandlerOutput` 의 `{config, output, meta, port, status}` 5필드 전체를 규율하는 Principle 0~11 짜리 저장소 전체 노드의 **기존 SoT**. Principle 5("`port` 활성화 모델")·Principle 9(Container 노드 output 오버라이트) 등이 `endReason`→port 매핑과 개념적으로 인접한 절이다.
    - `plan/in-progress/node-output-redesign/README.md` + 서브플랜 `ai-agent.md` §7.6~§7.8 · `information-extractor.md` §5.6.1~§5.6.4 — 27개 노드의 output 필드를 `node-output.md` 를 "기준 규약"으로 삼아 진단하는 **현재 in-progress 인 plan**. 이 두 서브플랜은 이미 `endReason` 값(`completed`/`user_ended`/`max_turns`/`max_retries`/`condition`/`out`) 을 §7.6~§7.8/§5.6 에서 직접 다룬다.
  - 상세: `node-output.md` 는 5필드 계약 전체(설정 echo, 에러 컨트랙트, 블로킹/재개, port 모델 등)를 다루는 반면, 신규 패키지의 실제 스코프는 draft 자신이 "범위 한정: 이번엔 endReason 만 담는다"(E-2) 라고 명시한 대로 **`endReason` 값 도메인 하나**(그것도 AI Agent·Information Extractor 두 노드 한정)뿐이다. 그런데 패키지명은 "node-output-contract" — "output 계약" 이라는 이름만 보면 `node-output.md` 의 Principle 전체를 구현/대체하는 패키지로 오인하기 쉽다. draft 는 이 위험을 스스로 인지해 "endReason 영구 귀속처" 후보로 `node-output.md` 를 검토 중이라 적었지만(Phase 1, `## Phase 1 — spec` §1), **패키지 신설(E-2)이 Phase 2 에서 먼저 이뤄지고 spec backlink 확정(E-7)은 그 이후**라 "넓은 이름을 먼저 선점하고 SoT 관계 정리는 나중" 순서다. 또한 이미 열려 있는 `node-output-redesign` plan 이 같은 `endReason` 값들을 별도로 서술하고 있는데, 이번 draft 는 그 plan 폴더를 전혀 언급/backlink 하지 않는다 — 두 트랙이 "node output" 이라는 이름을 각자 다른 스코프로 쓰면서 서로를 모른 채 진행될 위험이 있다.
  - 제안: (1) Phase 1 에서 `node-output.md` 를 영구 귀속처로 택한다면, 그 문서에 "이 패키지는 5필드 계약 전체가 아니라 `endReason` 값 도메인만의 코드 SoT" 라는 스코프 경계 문구를 명시한다. (2) 패키지 `README.md`(E-2) 최상단에도 동일한 스코프 한정 문구를 넣어, 이름만 보고 전체 output 계약 구현체로 오인하지 않도록 한다. (3) `node-output-redesign/ai-agent.md` §7.6~§7.8 · `information-extractor.md` §5.6 에도 가능하면 신규 패키지 backlink 를 남겨, 같은 값 도메인이 두 문서·plan 트랙에서 독립적으로 재서술되지 않게 한다. 패키지명 자체를 좁히는 대안(예: `@workflow/end-reason`)도 가능하나, draft 가 이미 "향후 interactionType·`ConversationTurnSource` 도 받을 자리"라는 근거로 넓은 이름을 의도적으로 선택했으므로 이름 변경보다는 위 스코프 명시 쪽이 draft 의 의도와 더 정합적이다.

- **[INFO] 값 export `CONVERSATION_END_REASONS` — 이름 재사용은 타당 (진짜 충돌 아님), 단 값 집합이 6→7 로 변경됨**
  - target 신규 식별자: `@workflow/node-output-contract` 의 export `CONVERSATION_END_REASONS`
  - 기존 사용처: `codebase/frontend/src/components/editor/run-results/output-shape.ts:132` — 현재 module-local(비-export) `const CONVERSATION_END_REASONS: ReadonlySet<string>`, 6개 값(`completed/user_ended/max_turns/max_retries/condition/error`).
  - 상세: 전역 grep 결과 이 상수를 참조하는 파일은 `output-shape.ts` 단 하나뿐이고, draft(E-4)는 이 로컬 선언을 **삭제하고** 패키지 import 로 교체하는 것으로 명시돼 있어 동일 스코프에 두 정의가 동시에 존재하는 순간이 없다 — 이름 재사용은 "충돌"이 아니라 "심볼을 shared 패키지로 승격" 하는 이 저장소의 표준 패턴(다른 4개 패키지도 동일 방식)과 일치한다. 다만 참고로: 패키지의 파생 값 집합은 `AiAgentEndReason ∪ InformationExtractorEndReason` = 7개 값(`user_ended/max_turns/condition/error/completed/timeout/max_retries`) — 기존 로컬 6개 값에 `timeout` 이 추가된다. 이름은 그대로지만 멤버십이 달라진다는 점은 이름 충돌 문제는 아니지만(별도 리뷰 관점의 몫), 리뷰어가 diff 만 보고 "이름이 같으니 값도 같겠지" 라고 오독하지 않도록 언급해둔다.
  - 제안: 이름 유지에 문제 없음. E-4 구현 시 PR 설명 또는 코드 주석에 "값 집합이 6→7(+timeout)로 바뀐다"는 점을 한 줄 남기면 리뷰어의 오독을 예방할 수 있다.

- **[정보 확인 — 이상 없음] 타입명 `AiAgentEndReason` / `InformationExtractorEndReason` / `ConversationEndReason`**
  - 전역 grep(`codebase/`, `spec/`, `plan/`) 결과 draft 문서 자신을 제외하면 세 이름 모두 기존 사용처가 없다. 완전 신규 식별자로 충돌 없음.
  - backend `information-extractor.handler.ts:56` 의 기존 로컬 `type EndReason`(파일 밖으로 export 되지 않음, `codebase/backend/src` 전역 grep 상 이 파일 내에서만 사용)과의 관계도 draft(E-3)가 "로컬 별칭 유지 — 호출부 무변경"으로 명시했고, `type EndReason = InformationExtractorEndReason;` 형태로 남기면 파일 내부의 기존 참조(1178·1186·1194·1276·1304·1320·1427·1908행 등)가 전부 그대로 유효하다. 이름 충돌 없음.

- **[정보 확인 — 이상 없음] 디렉터리 `codebase/packages/node-output-contract/`**
  - 현재 `codebase/packages/` 에는 `chat-channel-validation` / `expression-engine` / `graph-warning-rules` / `node-summary` / `sdk` / `web-chat-sdk` 6개만 존재하며 `node-output-contract` 디렉터리·패키지명 모두 미사용. 경로 충돌 없음. (참고: `web-chat-sdk` 디렉터리의 실제 package.json name 은 `@workflow/web-chat` 로 dir 명과 다른 선례가 이미 있어, 신규 패키지가 dir 명 = package 명 을 그대로 쓰는 것 자체는 컨벤션 위반이 아니다.)

- **[정보 확인 — 이상 없음] `SingleTurnEndReason` 미포함 정정 반영 확인**
  - 현재 draft(`plan/in-progress/is-conversation-output-restructure.md:124-127`)를 실물로 확인한 결과, `'out'` 값은 타입으로 export 되지 않고 "패키지에 넣지 않는다 — 소비처 없는 죽은 export 방지" 주석만 남겨 두었다. 지시된 정정이 실제로 반영돼 있다.

## 다른 관점 (요구사항 ID / API endpoint / 이벤트명 / 환경변수) — 해당 없음

target 은 코드 리팩토링 성격의 구현 plan 이며, 새 요구사항 ID·REST endpoint·webhook/queue/sse 이벤트명·ENV var/config key 를 하나도 도입하지 않는다. 전역 grep 으로도 이 네 범주의 신규 식별자를 찾지 못했다 — 해당 관점은 이번 target 에 적용 대상이 없다.

## 요약

target 이 새로 도입하는 실제 코드 식별자(`AiAgentEndReason`/`InformationExtractorEndReason`/`ConversationEndReason` 타입, 패키지 디렉터리·값 export 이름)는 전역 grep 기준 기존 사용처와 직접 충돌하지 않는다. 유일하게 주의가 필요한 지점은 패키지명 `@workflow/node-output-contract` 가 이미 존재하는 규약 문서 `spec/conventions/node-output.md`(5필드 output 계약 전체의 SoT) 및 아직 열려 있는 `node-output-redesign` plan 과 이름·주제가 근접해, "이 패키지가 output 계약 전체를 구현한다"는 오독을 낳을 수 있다는 점이다. draft 자신도 이를 convention checker INFO 로 인지하고 Phase 1 에서 영구 귀속처를 확정하기로 했으나, 패키지 신설(E-2)이 그 확정보다 먼저 실행되는 순서이고 기존 `node-output-redesign` plan 과의 backlink 도 계획에 없어 두 트랙이 서로 모른 채 같은 값 도메인을 따로 서술할 위험이 남는다. `CONVERSATION_END_REASONS` 이름 재사용은 로컬 선언 삭제 후 패키지 import 로 완전히 대체되는 표준 리팩토링이라 진짜 충돌은 아니다.

## 위험도

LOW
