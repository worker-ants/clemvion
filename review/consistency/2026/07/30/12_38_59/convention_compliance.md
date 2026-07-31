# 정식 규약 준수 검토 — spec-update-retry-claim-backstop-gap.md

## 검토 대상
`plan/in-progress/spec-update-retry-claim-backstop-gap.md` — `spec/5-system/4-execution-engine.md`
§7.5 대칭 Rationale 문단(줄 1387-1391) 정정 제안. 검토 모드: `--spec`.

## 확인한 정식 규약
`spec/conventions/spec-impl-evidence.md`(frontmatter 스키마) · `spec/conventions/execution-context.md` ·
`spec/conventions/node-cancellation.md` · `spec/conventions/audit-actions.md` · `spec/conventions/error-codes.md`
(grep 대조) · `spec/5-system/4-execution-engine.md` 실제 본문(Before 인용 정확성·용어 일관성 대조) ·
`codebase/backend/.../retry-turn.service.ts` JSDoc(식별자·서술 정합 대조) ·
`plan/in-progress/retry-turn-terminal-guard.md`(#15 근거 대조) · `.claude/agents/resolution-applier.md`
(draft 템플릿 대조, 참고용).

## 발견사항

- **[WARNING]** 제안 반영 시 `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 미동기화
  - target 위치: target 문서 `### After (제안)` 문단, `## 함께 반영할 것` 절
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`pending_plans` 필드 정의 — "미구현 surface 를
    책임지는 plan 경로") · §Rationale **R-5** ("spec 이 자기를 책임지는 plan 을 가리킴" 역방향 링크 의무화 근거)
  - 상세: 제안된 After 문단은 `spec/5-system/4-execution-engine.md` 본문에서 **처음으로**
    `plan/in-progress/retry-turn-terminal-guard.md`(§코드 표 #15, P2, "아직 미착수")를 잔류 orphan RUNNING
    row 갭의 후속 추적 plan 으로 명시 인용한다(실제로 현재 본문 전체에 이 plan 경로에 대한 언급이 전혀
    없음 — grep 0건으로 확인). 그러나 대상 spec 파일은 `status: partial`이고 frontmatter `pending_plans:`
    에는 `execution-engine-residual-gaps.md`·`exec-intake-followups.md` 2건만 있으며 이 plan 은 없다.
    같은 문서 안에서 이미 확립된 로컬 관행과 어긋난다 — 현재 frontmatter 에 있는 두 plan 은 각각 본문
    §4.1(줄 392)·§8(줄 1106)·§7.4 Rationale(줄 1419)에서 "잔여 후속" 으로 인용되는 **동시에** frontmatter
    에도 등재돼 있어, "본문이 인용하는 미해결 추적 plan = frontmatter pending_plans 등재" 페어링이 이
    문서 자체의 실무 패턴이다. 자매 컨벤션 `node-cancellation.md` 도 동일 패턴(`pending_plans:` 에
    `node-cancellation-residual-signal-propagation.md` 등재 + 본문 표에서 "Planned, 추적 plan:" 으로
    동일 파일 인용)을 실제로 적용한 전례다. `retry-turn-terminal-guard.md` 는 이미 자신의 frontmatter
    `spec_impact:` 에 이 spec 파일을 지목하고 있어(plan→spec 단방향은 이미 존재) spec→plan 역방향만
    누락된 상태 — R-5 가 "텔레그램 chat-channel 영구 누락" 사례로 막으려 한 바로 그 비대칭이다.
    (build gate `spec-pending-plan-existence.test.ts`/`spec-status-lifecycle.test.ts` 는 본문-frontmatter
    교차 인용까지 자동 검증하지 않으므로 CI 는 통과하지만, 규약의 설계 의도와는 거리가 있다.)
  - 제안: target 문서의 "## 함께 반영할 것" 절에 `spec/5-system/4-execution-engine.md` frontmatter
    `pending_plans:` 목록에 `plan/in-progress/retry-turn-terminal-guard.md` 추가 항목을 명시할 것.
    (대안: 이 갭을 별도 등재하지 않기로 의도한 것이라면, 왜 다른 두 plan 과 달리 이 plan 은
    frontmatter 페어링에서 제외하는지 근거를 §Rationale 에 남기는 것으로 규약을 그 예외에 맞춰
    갱신해도 무방함.)

## 관점별 확인 결과 (발견사항 없음)

- **명명 규약**: 제안은 기존 식별자(`claimSpawnedRetryRow`·`recoverStuckExecutions`·
  `failOrphanRunningNodeExecutions`·`retry_last_turn`)만 인용하며 신규 명명을 도입하지 않는다.
  `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`·`execution-engine.service.ts`
  실제 코드와 대조해 표기·대소문자 전부 일치 확인. 파일명(`spec-update-retry-claim-backstop-gap.md`)도
  `.claude/agents/resolution-applier.md` 의 SPEC-DRIFT 템플릿(`plan/in-progress/spec-update-<area>.md`)
  및 `plan/complete/spec-update-*.md` 기존 선례군과 일치.
- **출력 포맷 규약**: API 응답·이벤트 페이로드·에러 코드 어느 것도 건드리지 않는 순수 Rationale 산문
  정정이라 `spec/conventions/error-codes.md`·`swagger.md` 대상 표면 없음.
- **문서 구조 규약**: 3섹션(Overview/본문/Rationale) 의무는 CLAUDE.md 상 **spec 문서** 대상이며 본
  target 은 plan 문서라 비대상. plan 문서로서는 `.claude/agents/resolution-applier.md` 의 draft
  템플릿(`## 분류` → `## 원본 발견사항` → `## 제안 변경` 「before/after」)을 그대로 따르며 오히려
  더 상세(`### Before`/`### After`·근거 요약·함께 반영할 것)하다 — 위반 아님. frontmatter
  `worktree`/`started`/`owner` 필수 필드(`spec-impl-evidence.md` §4.2 `plan-frontmatter.test.ts`)
  모두 존재, `spec_impact:` 도 YAML 리스트로 올바름(bare string/빈 배열 아님).
  제안 대상 문단이 삽입될 spec 위치(§7.5 대칭 Rationale, `### retry 재진입의 원자 claim …` 하위)의
  Before 인용문은 현재 `spec/5-system/4-execution-engine.md:1387-1391` 실제 본문과 **완전히 일치**
  (직접 대조 확인) — 인용 정확성 문제 없음.
- **API 문서 규약**: 해당 없음(OpenAPI/Swagger·DTO·데코레이터 불관여).
- **금지 항목**: `audit-actions.md`(action 명명 금지 패턴)·`execution-context.md`(God Object 방지
  원칙)·`node-cancellation.md`(§2.4 terminal 가드 서술) 어느 것도 저촉하지 않음. 오히려 After 문단의
  "이미 `failed`(terminal)" 표현은 `node-cancellation.md` §2.4·execution-engine.md §1.1 이 이미 쓰는
  "terminal"/"비-terminal" 용어와 정확히 합치하고, `recoverStuckExecutions`(stale RUNNING **Execution**
  재claim, case B) 특징화도 `error-codes.md`(`WORKER_HEARTBEAT_TIMEOUT` 행)·execution-engine.md
  §Rationale "orphan pending backstop" 서술과 정합.

## 요약

target 은 API·이벤트·에러 코드·명명 규칙을 전혀 건드리지 않는 좁은 범위의 spec Rationale 산문 정정
제안이라, `spec/conventions/**` 의 명명·출력 포맷·API 문서 규약과는 충돌 지점이 없다. 인용된 Before
본문·코드 JSDoc·plan #15 항목도 실제 저장소 상태와 대조해 정확했다. 유일한 실질 지적은
`spec-impl-evidence.md`(R-5, spec→plan 역방향 pending_plans 링크 의무화 취지)와 같은 문서가 이미
실천 중인 로컬 관행(등재된 두 plan 모두 본문 인용 + frontmatter 등재 페어링) 대비, 제안이 새로
추가하는 plan 인용(`retry-turn-terminal-guard.md`)만 frontmatter 짝이 빠진다는 점이다 — build gate 를
깨뜨리지는 않으나 규약의 설계 의도상 누락이므로 WARNING 으로 기록한다.

## 위험도
LOW
