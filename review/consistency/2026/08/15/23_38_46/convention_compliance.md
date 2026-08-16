# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-ws-types-canonical-location.md`

## 검토 방법 메모

target 은 동일 worktree 안에서 10분 전(`review/consistency/2026/08/15/23_28_47/convention_compliance.md`)
같은 관점의 검토를 이미 받았고, 그때 CRITICAL 1 + WARNING 1 + INFO 1 이 나왔다. 이번 라운드는
(a) 그 세 항목이 실제로 고쳐졌는지 실측 재확인, (b) target 본문이 인용하는 7곳 + §4.4 앵커가
현재 spec/코드 상태와 여전히 일치하는지 재검증, (c) `spec/conventions/**` 전수 재스캔의 세 축으로
진행했다.

## 발견사항

이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다. 이전 라운드 지적 3건의 해소 여부만 기록한다.

- **[RESOLVED] 이전 CRITICAL — `plan-frontmatter.test.ts` 필수 필드(`started`/`owner`) 누락**
  - 이전 위반: 라인 1~13 frontmatter 에 `started:`/`owner:` 키 자체 부재 (`.claude/docs/plan-lifecycle.md §4`).
  - 현재 상태: frontmatter 에 `started: 2026-08-15`, `owner: project-planner` 존재. 실측 —
    `pnpm vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts --reporter=verbose` 를
    `codebase/frontend` 에서 직접 실행해 `plan/in-progress/spec-draft-ws-types-canonical-location.md`
    관련 4개 assertion(`has a parseable frontmatter block` / `worktree is set...` /
    `` `started` is an ISO date `` / `` `owner` is set ``) 이 전부 `✓` 로 통과함을 확인했다
    (전체 스위트 169/169 PASS). 해소.

- **[RESOLVED] 이전 WARNING — `worktree:` 값이 전체 경로**
  - 이전 위반: `worktree: .claude/worktrees/eia-r8-cache-scope-4ae434` (스키마는 bare 디렉토리
    이름 요구, `.claude/docs/plan-lifecycle.md §4`).
  - 현재 상태: `worktree: eia-r8-cache-scope-4ae434` (bare name) 으로 정정됨. 자매 문서
    (`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-r8-alignment.md`)와도 표기 일치.
    `plan-stale-audit.sh` 오탐 유발 경로가 사라졌다. 해소.

- **[RESOLVED] 이전 INFO — 첫 섹션 헤딩이 `## 왜`**
  - 이전 지적: 자매 `spec-draft-*.md` 는 `## Overview` 로 시작하는데 target 만 `## 왜`.
  - 현재 상태: 라인 44 `## Overview` 로 통일됨. 해소.

## 추가 점검 (신규 관점)

- **[INFO] `pending_plans:` frontmatter 키의 의미 도메인이 spec 용법과 다르다**
  - target 위치: frontmatter 라인 30~31 (`pending_plans: / - plan/in-progress/ws-event-types-extract.md`).
  - 관련 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans:` 는 **spec**
    frontmatter 필드로 "`status: partial` 인 spec 의 미구현 surface 를 책임지는 plan 경로"를
    뜻하며, 전용 build 가드(`spec-pending-plan-existence.test.ts`)가 **`spec/**.md` 만** 검증
    대상으로 삼는다. 여기서는 **plan** 문서(`plan/in-progress/*.md`) 자신의 frontmatter 에
    동일 키를 다른 의미(이 draft 가 뒤이어 닫아야 할 *선행* plan 참조)로 재사용하고 있다.
  - 상세: `.claude/docs/plan-lifecycle.md §4` 는 top-level plan frontmatter 에 `worktree`/
    `started`/`owner` 3필드만 의무화하고 "`priority`/`status`/`title` 등 추가 필드는 허용"이라고
    명시하므로 **금지 위반은 아니다.** 어떤 build 가드도 plan frontmatter 의 `pending_plans:` 를
    검사하지 않으므로 (a) dangling 이어도 잡히지 않고 (b) 이번 target 처럼 실존 경로
    (`plan/in-progress/ws-event-types-extract.md`, 존재 확인함)를 가리켜도 가드가 이를 보증하지
    않는다. 또한 이 재사용은 이번 target 이 최초가 아니다 — 같은 worktree 의
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 도 동일 패턴(다만 그쪽은
    2개 plan 을 나열)을 이미 쓰고 있어, **1회성이 아니라 반복되는 로컬 관행**이다.
  - 제안: 위반은 아니므로 target 수정을 요구하지 않는다. 다만 이 관행이 굳어지는 중이므로,
    `.claude/docs/plan-lifecycle.md §4`(또는 project-planner SKILL.md) 에 plan-레벨
    `pending_plans:`(선행/의존 plan 참조) 를 spec-레벨 `pending_plans:`(책임 plan 참조) 와
    구분해 짧게 문서화하는 편이 향후 tooling·리뷰어 혼동을 막는다 — 규약 갱신이 적절한 케이스.

## 사실관계 교차검증 (naming/output 관점 실측)

target 본문이 인용하는 식별자·경로가 실제 코드/spec 과 일치하는지 직접 대조했다 — 명명 규약
검토(관점 1)의 근거 확보 목적:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 실존 확인.
  `KbEventType`(L254) / `NodeEventType`(L185) / `ExecutionChannelEvent`(L30) 심볼 실존 확인.
  파일 명명(`<domain>.types.ts`)은 `conversation-thread.types.ts`
  (`spec/conventions/conversation-thread.md`) · `golden-set.types.ts`
  (`spec/conventions/rag-evaluation.md`) · `resume-call-stack.types.ts`
  (`spec/conventions/execution-context.md`) 와 동일 패턴 — 새 명명 아님.
- `websocket.service.ts` 헤더 주석이 실제로 target 이 인용한 문구("값·타입 정의는
  의존성-프리 모듈로 분리했다")를 담고 있음을 확인. re-export 존재도 확인(라인 15~40대).
- 7곳 원문 인용(`3-execution.md:657`, `10-graph-rag.md:552`, `6-websocket-protocol.md:740`·
  `:1034`, `8-embedding-pipeline.md:276`, `data-flow/6-knowledge-base.md:288`,
  `data-flow/0-overview.md:110`) 을 실제 파일에서 grep 대조 — 전부 target 서술과 일치.
- item ① 의 "3-execution.md 와 6-websocket-protocol.md 의 `code:` 비대칭" 주장도 실측 —
  `6-websocket-protocol.md` frontmatter `code:` 에는 `websocket-events.types.ts` 가 이미
  등재돼 있고 `3-execution.md` 에는 없음. 제안된 frontmatter 보완은
  `spec/conventions/spec-impl-evidence.md §2.1`(`code:` = 본 spec 이 약속한 surface 의 구현
  경로) 취지에 정확히 부합.
- `spec/data-flow/**` 두 파일(⑥⑦)에는 frontmatter `code:` 보완을 제안하지 않는 것도 올바르다 —
  `spec-impl-evidence.md §1` 이 `spec/data-flow/**` 를 frontmatter-evidence 의무 대상에서
  명시 제외.
- `spec_impact:` 리스트 7개 경로 전부 실존 파일(ls 로 확인) — Gate C 스키마
  (`.claude/docs/plan-lifecycle.md §5` / `spec-impl-evidence.md R-8`) 의 "리스트, 모든 원소
  실존" 요건에 부합하는 형태.
- §4.4 삽입 지점(`spec/5-system/4-execution-engine.md` "…현재는 두 기법으로 봉인한 상태를
  유지한다." 직후) 도 실제 라인(478)과 일치하며, 그 위치가 문서 하단 `## Rationale`
  (라인 1328) 이 아니라 본문 `## 4. Worker 모델 > ### 4.4` 안이라는 target 의 구분도 정확.

## 요약

target 은 이전 검토 라운드(`23_28_47`)에서 지적된 CRITICAL(필수 frontmatter 누락) 1건과
WARNING(`worktree:` 전체경로) 1건, INFO(헤딩 불일치) 1건을 모두 실측 가능한 형태로 수정했다 —
특히 CRITICAL 은 `plan-frontmatter.test.ts` 를 직접 재실행해 통과를 확인했다. 본문이 제안하는
7곳 spec 정정 + §4.4 Rationale 보완은 인용 라인·심볼·파일 경로를 전수 대조한 결과 전부 현재
코드/spec 상태와 일치하며, frontmatter `code:` 보완 범위(3-execution.md 만 대상, data-flow 는
제외)도 `spec-impl-evidence.md` §1/§2.1 취지에 정확히 부합한다. 새로 발견된 위반은 없다. 유일한
관찰(INFO)은 plan 문서가 spec 전용 의미를 가진 `pending_plans:` 키를 다른 의미로 재사용하는
로컬 관행이 반복되고 있다는 점으로, target 자신의 결함이 아니라 규약 문서(plan-lifecycle.md)
쪽의 갱신을 검토할 만한 항목이다.

## 위험도
LOW
