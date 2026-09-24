# Cross-Spec 일관성 검토 — `spec/conventions` (impl-prep)

## 검토 범위와 제약

target 은 `spec/conventions/**` 전체(60여개 파일)이며, 비교 대상으로 `spec/5-system/10-graph-rag.md` ·
`spec/0-overview.md`(시스템 아키텍처 개요) 가 "관련 spec 본문" 으로 함께 제공됐다. 다만 조립 payload 상당
부분이 **컨텍스트 예산 초과로 절단**되어, 아래 target 파일들은 본문 없이 헤더만 있었다 —
`chat-channel-adapter.md`(53KB) · `conversation-thread.md`(80KB) · `secret-store.md`(23KB) ·
`error-codes.md`(17KB) · `swagger.md`(30KB) · `node-output.md`(28KB) · `node-cancellation.md`(22KB) ·
`interaction-type-registry.md`(15KB) · `cafe24-api-metadata.md`(31KB) · `migrations.md` 등 다수, 그리고
`spec/1-data-model.md`·`spec/2-navigation/**`·`spec/3-workflow-editor/**` 전체.
Cafe24/MakeShop 필드-레벨 카탈로그(약 220개)도 대부분 절단됐다(§Rationale R-7 대로 생성 산출물이라
영향은 적음). 이 절단분은 **저장소 직접 읽기로 보완**했으나(아래 발견사항·요약 참고), 절단된 각 파일의
전문을 놓고 다른 영역과 문장 단위로 대조하지는 못했다 — 완전성 한계로 명시해 둔다.

## 발견사항

- **[WARNING]** `id:` 기본 disambiguation 규약이 `0-common.md` 6개에서 지켜지지 않음
  - target 위치: `spec/conventions/spec-impl-evidence.md` §2.1 필드 정의표 (`id` 행) — "같은 basename 이
    영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다 (예: `spec/5-system/17-agent-memory.md`
    가 `agent-memory` 를 점유 → `spec/2-navigation/16-agent-memory.md` 는 `nav-agent-memory`)"
  - 충돌 대상: `spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,7-trigger}/0-common.md` 6개 파일
  - 상세: target 문서는 basename 이 같은 spec 파일이 영역을 달리해 신설될 때 영역 prefix 로 `id` 충돌을
    회피하는 것이 "의도된 패턴" 이라고 명시하고, 실제로 `agent-memory` ↔ `nav-agent-memory` 사례로 이를
    입증한다(직접 확인: 두 파일 모두 실존하며 각각 `id: agent-memory` / `id: nav-agent-memory`). 그런데
    같은 basename (`0-common.md`) 을 가진 6개 파일이 전부 **동일 문자열 `id: common`** 을 그대로 쓰고
    있다(직접 확인, 6/6). `0-common.md` 는 `spec-impl-evidence.md` §1 의 `EXCLUDE_BASENAMES`
    (`0-overview.md` · `1-data-model.md` · `6-brand.md`) 에도 없어 frontmatter 의무 대상이면서, 동시에
    id 유일성 예시가 요구하는 disambiguation 대상에서도 빠져 있다 — 규약 문장과 실제 상태가 어긋난다.
    현재 `spec-frontmatter.test.ts` 는 `id` 를 "비어있지 않은 문자열"로만 검증하고 유일성은 보지 않아
    build 는 통과하지만, 규약 문서가 "이렇게 회피한다" 고 단정한 패턴이 6곳에서 깨져 있다는 사실은
    남는다. `id` 를 향후 자동화(예: id 기반 look-up, 검색)에 쓸 경우 6개 중 하나만 남고 나머지는
    가려진다.
  - 제안: 둘 중 하나 — (a) 6개 `0-common.md` 를 영역 prefix 로 재명명(`logic-common`/`flow-common`/
    `ai-common`/`integration-common`/`data-common`/`trigger-common`) 하고 참조하는 문서·가드 fixture 를
    함께 갱신, 또는 (b) `spec-impl-evidence.md` §2.1 에 "`0-common.md` 류 카테고리-로컬 문서는 예외" 라고
    명시해 규약 문장을 실제 관행에 맞춘다. `id` 유일성이 실제로 아무 것도 강제하지 않는다면 (b) 가 비용이
    낮다.

## 클린 체크 (참고 — 발견사항 아님)

시간 내 대조 가능했던 영역은 실제로 일치했다. 참고용으로 남긴다:

- `spec/conventions/audit-actions.md` §3 도메인별 분류 레지스트리(action 목록·workspace 귀속·
  `workflow.executed`/`workspace.deleted` 유예 사유)는 `spec/5-system/1-auth.md` §4.1 의 구현/Planned
  액션 카탈로그와 대조했을 때 항목·사유 모두 일치.
- `spec/conventions/cafe24-api-catalog/_overview.md` §5 Coverage Matrix 합계(485 endpoint)와
  `spec/conventions/makeshop-api-catalog/_overview.md` 의 161 REST operation 은 `spec/0-overview.md`
  §6.1 이 인용하는 수치와 일치.
- `spec/conventions/frontend-layering.md` 는 "레이어" 용어가 `0-overview.md`/`execution-context.md` 의
  동명 용어와 무관하다고 본문에서 선제적으로 명시해 두어 충돌 소지를 이미 닫아 두었다.

## 요약

target(`spec/conventions/**`)은 여러 문서가 서로의 Rationale·SoT 소유권을 명시적으로 교차 참조하며
(예: audit-actions.md ↔ 5-system/1-auth.md ↔ data-flow/1-audit.md, cafe24 카탈로그 ↔ 0-overview.md 수치)
자기 모순을 스스로 방지하도록 잘 관리돼 있고, 실측 대조가 가능했던 부분에서는 실제 충돌을 찾지 못했다.
유일하게 확인된 실체적 문제는 `spec-impl-evidence.md` 가 예시로 제시한 `id` 충돌-회피 관행이
`0-common.md` 6개에서 지켜지지 않는다는 점으로, 현재는 어떤 가드도 소비하지 않아 즉각적인 build 실패나
기능 장애로 이어지진 않는 WARNING 수준이다. 다만 이번 검토는 조립 payload 의 상당 부분(대형 conventions
문서 다수 + 대부분의 타 영역 spec)이 컨텍스트 예산으로 절단된 상태에서 수행됐고, 그 구멍은 저장소
직접 읽기로 표본 대조했을 뿐 전수는 아니므로, 절단된 영역(특히 `chat-channel-adapter.md`·
`conversation-thread.md`·`secret-store.md`·`node-output.md`/`node-cancellation.md` 의 실행엔진 교차
계약)에 대해서는 이번 실행 결과만으로 "충돌 없음"을 단정할 수 없다.

## 위험도

LOW
