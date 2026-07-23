# 정식 규약 준수 검토 — presentation-thread-optout-drift.md

target: `plan/in-progress/presentation-thread-optout-drift.md`

## 발견사항

- **[WARNING]** 체크리스트 항목 3(`frontmatter: status 조정`)이 `spec-impl-evidence.md §3` 의
  `partial` 강제 규칙과 충돌할 소지를 열어둔 채 미결로 남아 있다
  - target 위치: `## 체크리스트` 3번째 항목 — `frontmatter status·code: 조정 판단`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (`status` 라이프사이클) —
    `status: partial` 은 `pending_plans:` **의무**이며, 그 경로는
    `spec-pending-plan-existence.test.ts` 가드로 `plan/in-progress/` 또는
    `plan/complete/` 에 **실존**해야 한다.
  - 상세: target 은 §4.6 을 "동작(구현됨)/표면(미구현)" 두 층위로 나누되, 표면(schema
    선언·UI 노출)을 명시적으로 **비목표**로 못박는다 — *"필드를 5개 schema 에 실제
    선언... 구현은 수요가 생길 때 별건"* (target `## 비목표` 1항). 즉 이 표면 갭을
    추적할 어떤 plan 도 지금 만들지 않기로 이미 결정했다. 이 상태에서 만약 체크리스트
    항목 3의 "실제 상태에 맞게 조정" 판단이 `status: partial` 로 귀결되면
    `pending_plans:` 를 채울 실존 plan 이 없어 build 가드가 즉시 fail 한다.
    target 은 이 인과관계를 명시하지 않고 "판단한다" 로만 남겨 두어, 실행 시점에
    가드 위반으로 처음 발견될 위험이 있다.
  - 제안: 체크리스트 항목 3을 `status: implemented 유지 (런타임 동작은 전 노드
    완비 — §3 라이프사이클의 "구현 surface" 정의는 코드 계약이지 UI 노출을
    포함하지 않음), pending_plans 신설 없음` 처럼 **미리 방향을 명시**해 실행자가
    같은 함정(§Rationale 이 이미 자인한 "previousOutput 건에서 0-common 패턴을
    확인 없이 복사해 반대 오류" 반복)에 빠지지 않게 한다. `code:` 확장 여부(같은
    파일이 이미 `conversation-thread.md` 의 `code:` 에 등재돼 있어 중복 등재는
    선택 사항이지 의무는 아님)도 같은 문장에서 정리하면 좋다.

- **[INFO]** `0-common.md §4.6` 헤딩 레벨이 형제 서브섹션과 불일치 (target 수정
  대상 섹션의 기존 구조적 흠 — target 이 유발한 것은 아니나 같은 절을 편집하는
  김에 정정 여지)
  - target 위치: `## 체크리스트` 2번째 항목 — `0-common.md §4.6 을 동작/표면
    2층위로 정밀화`
  - 위반 규약: 명시적 conventions 항목은 없음 (CLAUDE.md 의 "Overview/본문/Rationale
    3섹션" 은 문서 전체 매크로 구조 권장이지 섹션 넘버링 규칙은 아님) — 참고용 INFO.
  - 상세: 실측 결과 `spec/4-nodes/6-presentation/0-common.md` 는 `## 4. 출력
    포맷` 아래 `### 4.1`/`### 4.2` 서브섹션(h3)을 두다가, `## 4.6 Conversation
    Thread opt-out` 이 h2 로 끼어들고 바로 뒤에 `## 5. 캔버스 요약` 이 이어진다.
    소수점 넘버링(4.6)을 쓰면서 실제 헤딩 레벨은 4.1/4.2 의 하위(h3)가 아니라
    §4 와 동급(h2)이라 목차 위계가 어긋난다.
  - 제안: target 이 이 섹션을 다시 쓰는 김에 `### 4.6` 로 레벨을 맞추거나(§4 의
    서브섹션으로 편입), 독립 섹션 의도라면 `## 5.` 로 승격하고 이후 번호를
    미루는 대안을 고려할 것을 plan 본문에 한 줄 추가하는 편이 좋다. 필수 아님.

- **[INFO]** 체크리스트 항목 4(`conversation-thread.md §2.4` 정합 확인)의 실측
  근거가 이미 target 자체 조사로 확인됨 — 누락 방지 차원의 확인
  - target 위치: `## 체크리스트` 4번째 항목
  - 위반 규약: `spec/conventions/conversation-thread.md §2.4` (opt-out)
  - 상세: 실측 결과 §2.4 본문은 *"각 노드에 공통 boolean config... 필드 정의의
    단일 진실은 3 노드 공통 공유 fragment"* 라고만 서술해, 게이트가
    `appendInternal` 공통 진입점에서 **노드 종류 무관하게** 적용된다는 사실(§4.6
    수정으로 target 이 확정하려는 바로 그 사실)을 §2.4 자신도 명시하지 않는다.
    presentation 5노드가 passthrough 로 이 필드를 수동 설정하면 게이트가 동일하게
    작동한다는 점이 §2.4 에 전혀 언급되지 않아, 두 문서(`0-common.md §4.6` 과
    `conversation-thread.md §2.4`)가 같은 drift 를 서로 다른 방향(전자는 "5노드가
    필드를 가진다" 과장, 후자는 "3노드만 해당" 과소진술)으로 안고 있다.
  - 제안: 이미 체크리스트에 있으므로 신규 조치는 불요 — 다만 §2.4 개정 시
    "이 게이트는 노드 종류를 가리지 않으며, presentation 5노드는 schema 미선언
    상태로도 passthrough 를 통해 이 필드를 수동 설정하면 동작한다" 는 한 문장을
    반드시 포함해 두 문서가 같은 사실을 대칭적으로 반영하도록 할 것.

## 검증한 사실관계 (참고)

target 의 실측 주장은 코드 대조로 모두 확인됨 — 위반이 아니라 target 신뢰도
확인 목적:
- `conversation-thread.service.ts` (`codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts`) `appendInternal`(:202) 첫 줄 `if (this.isOptedOut(args.node)) return;` — 정확.
- `isOptedOut`(:243) 이 `node.config?.excludeFromConversationThread === true` 를 노드 종류 무관하게 읽음 — 정확.
- presentation 5개 schema (`carousel`/`table`/`chart`/`form`/`template`) 전수 `excludeFromConversationThread` grep 0건 — 정확.
- 5개 schema 모두 `.passthrough()` 사용 (38회, target 은 노드별 세부 카운트만 언급) — 정확.
- `spec/4-nodes/6-presentation/0-common.md` frontmatter `code:` 는 `codebase/backend/src/shared/conversation-thread/**` 만 포함하고, 실제 게이트 구현 경로
  `codebase/backend/src/modules/execution-engine/conversation-thread/**` 는 미포함 — target 이 체크리스트 항목 3에서 제기한 갭이 실재함을 뒷받침.
- 해당 게이트 경로는 이미 `spec/conventions/conversation-thread.md` 자신의 `code:` 에는 등재돼 있음 — 0-common.md 로의 확장은 중복 등재 선택지이지 의무는 아님.

## Plan frontmatter 규약 준수

`plan-lifecycle.md §4` 스키마(`worktree`/`started`/`owner`) 전부 충족:
`worktree: presentation-thread-optout-drift-4fc462`, `started: 2026-07-23`,
`owner: project-planner`. `plan-frontmatter.test.ts` 가드 통과 예상. 위반 없음.

## 요약

target 은 `--impl-done` checker 가 지적한 §4.6 drift 를 삭제·격하가 아니라 "동작 vs
표면" 2층위 분리로 정밀화하겠다는 방침이며, 그 근거(코드 라인·grep 결과·schema
passthrough 사실)를 전부 직접 검증했고 모두 정확했다. `spec/conventions/**` 직접
위반(CRITICAL)은 발견되지 않았다. 다만 (a) frontmatter `status`/`pending_plans`
조정을 "판단한다" 로 열어둔 채 방향을 명시하지 않아 `spec-impl-evidence.md §3` 의
`partial`→`pending_plans` 강제 가드와 충돌할 실행 시 리스크가 있고(WARNING),
(b) 같은 drift 가 `conversation-thread.md §2.4` 쪽에도 대칭적으로 남아 있어
개정 시 양쪽을 함께 정정해야 한다(이미 체크리스트에 반영돼 있어 INFO). 헤딩
레벨 이상은 사소한 INFO. plan frontmatter 자체는 `plan-lifecycle.md` 스키마를
완전히 충족한다.

## 위험도

LOW
