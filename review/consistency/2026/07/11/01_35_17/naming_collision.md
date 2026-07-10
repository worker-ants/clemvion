# 신규 식별자 충돌 검토 — EIA/WS continuation 명령 ↔ 대기 표면 가드

검토 모드: --impl-done, scope=`spec/5-system/14-external-interaction-api.md`, diff-base=`52f46f95f`
대상 신규 식별자: `coalesceInteractionType` · `resolveWaitingSurface` · `isCommandAllowedOnSurface` ·
`SURFACE_ALLOWED_COMMANDS` · `WaitingSurface` · `WaitingSurfaceCommand` · `WaitingNodeRow` ·
`assertCommandMatchesWaitingSurface`

검증 방법: prompt 내 corpus 는 크기 제한으로 일부 잘려 `spec/conventions/interaction-type-registry.md`
등 핵심 문서가 누락돼 있어, 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/elegant-driscoll-eebdd6`)를
절대경로로 직접 `grep -rn`/`Read` 하여 `spec/`·`codebase/backend/src`·`codebase/frontend/src`·`plan/` 전체에서
8개 식별자 및 인접 개념(“표면”/“surface”, `WaitingInteractionType`, `STATE_MISMATCH`, `EIA-IN-13`)을 재확인했다.

## 발견사항

- **[INFO]** `WaitingSurface`(신규, 3값) ↔ `WaitingInteractionType`(기존, 4값) 명칭 근접 — 파생 관계가 타입 시스템으로 강제되지 않음
  - target 신규 식별자: `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts:961` `export type WaitingSurface = 'form' | 'buttons' | 'ai_conversation';`
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:230` `export type WaitingInteractionType = 'form' | 'buttons' | 'ai_conversation' | 'ai_form_render'`(SoT: `spec/conventions/interaction-type-registry.md` §1.1) — 정확히 같은 "form/buttons/ai_conversation(+ai_form_render)" 값공간을 가리키는 **기존에 이미 존재하던 이름**.
  - 상세: 두 타입은 이름(`Waiting*`)과 리터럴 값공간이 거의 겹치지만 레이어가 다르다 — `WaitingInteractionType` 은 엔진 내부 4값(등록 SoT: interaction-type-registry §1), `WaitingSurface` 는 이번 PR 이 신설한 "publisher 사전 검증용 3값 외부 표면" 개념이다. interaction-type-registry.md §1.1 은 이미 산문으로 "EIA 외부 표면은 ai_form_render 를 ai_conversation 으로 통합해 3값만 노출"이라 서술해 두었으나, 그 3값 개념에 **공식 타입명이 없었다** — 본 PR 이 처음으로 `WaitingSurface` 라는 이름을 붙였다. 코드 주석(`waiting-surface-guard.ts:955-959`)이 registry §1.2 를 명시적으로 cross-ref 하고 있어 즉각적인 오해 위험은 낮지만, `WaitingSurface` 가 독립 리터럴 유니온으로 정의돼 있어 향후 `WaitingInteractionType` 에 5번째 값이 추가돼도 컴파일 타임에 `WaitingSurface`/`SURFACE_ALLOWED_COMMANDS` 갱신을 강제하지 않는다(interaction-type-registry 의 AST 가드 `REGISTRY_SITES` 대상 파일 목록에도 `waiting-surface-guard.ts` 가 없음). 충돌은 아니지만 "같은 값공간을 가리키는 두 번째 이름"이라는 점에서 향후 유지보수 시 두 타입을 같은 것으로 오인할 여지가 있다.
  - 제안: (a) `WaitingSurface` 를 `Exclude<WaitingInteractionType, 'ai_form_render'>` 파생으로 바꿔 컴파일 타임 동기화를 강제하거나, (b) 최소한 project-planner 의 미완료 spec 동기 항목(`plan/in-progress/eia-command-waiting-surface-guard.md` "spec 동기" 섹션 마지막 줄 "`interaction-type-registry.md` — 표면 매트릭스 cross-ref (권장)")을 착수해 registry 문서에 `WaitingSurface` 를 공식 등재. 둘 다 이미 plan 에 인지돼 있으므로 신규 지적이라기보다 기존 후속 항목의 우선순위 상향 권고.

- **[INFO]** "표면(Surface)" 용어의 도메인 중복 — 별개 개념, 직접 충돌 아님
  - target 신규 식별자: `WaitingSurface`, `resolveWaitingSurface`, `isCommandAllowedOnSurface` (execution-engine, backend)
  - 기존 사용처: `spec/conventions/data-hydration-surfaces.md` §2 "Surface 별 hydration 함수" (frontend, live/waiting/execution-history/replay 4종 데이터 하이드레이션 단계)
  - 상세: 두 "surface" 는 완전히 다른 도메인(하나는 프런트엔드 데이터 하이드레이션 생명주기 단계, 하나는 백엔드 continuation 명령 라우팅 대상)이며 이름 충돌은 아니다(`WaitingSurface` 라는 정확한 타입명이 겹치지 않음, 모듈 경로도 분리). 다만 프로젝트 전반에 "표면/surface" 라는 어휘가 최소 3곳(WS/REST 에러 표면 §7.5.2, EIA 외부 표면 §1.1, data-hydration-surfaces)에서 서로 다른 뜻으로 이미 쓰이고 있어, 신규 `WaitingSurface` 가 그 목록에 네 번째 용례를 추가한다.
  - 제안: 문서화 확인용 정보 제공 목적. 액션 불요 — 각 문서가 자기 컨텍스트 내에서 이미 명확히 정의하고 있어 실질 혼선 위험은 낮음.

## 조사했으나 충돌 없음으로 확인된 항목

- 8개 신규 식별자(`coalesceInteractionType` 등) 전체를 `spec/`·`codebase/backend/src`·`codebase/frontend/src` 전역에서 grep — `waiting-surface-guard.ts`/`.spec.ts`, 그 소비처(`execution-engine.service.ts`, `execution-engine.service.spec.ts`), 그리고 빌드 산출물(`dist/`) 외에는 **일치하는 이름이 전혀 없음**. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/config key·파일 경로 어느 관점에서도 기존 정의와 부딪히는 항목 없음.
- `STATE_MISMATCH`(409) — 신규 코드 아님. `spec/5-system/14-external-interaction-api.md:341` 에 이미 "현재 노드/실행 상태와 명령 불일치"로 정의돼 있고, plan(`eia-command-waiting-surface-guard.md`)도 "신규 에러 코드 없음"을 명시. 새 표면-불일치 케이스는 이 기존 정의의 자연스러운 하위 사례로 재사용된다.
- `EIA-IN-13` — 신규 요구사항 ID 아님. `spec/5-system/14-external-interaction-api.md:83` 에 이미 존재하는 ID 를 이번 구현이 재사용(근거로 인용)할 뿐, 새로 부여하지 않는다.
- 파일 경로(`waiting-surface-guard.ts`, `waiting-surface-guard.spec.ts`) — `execution-engine/` 디렉터리의 기존 명명 컨벤션(`*.service.ts` 옆에 단일 책임 헬퍼 모듈을 `kebab-case.ts` + 동일 이름 `.spec.ts`로 배치, 예: `resume-turn-dispatch.ts`, `park-entry-dispatch.ts`, `to-record.ts`)과 정합. 기존 파일과 이름이 겹치지 않는다.
- `interface WaitingNodeRow`(private, `execution-engine.service.ts` 로컬) — 동일/유사 이름의 `*Row` 인터페이스가 해당 모듈에 기존에 없었고, export 되지 않아 외부와 충돌 가능성도 없다.

## 요약

신규 식별자 8종은 spec·backend·frontend 전역에서 이름이 겹치는 기존 정의가 없어 **직접적인(CRITICAL) 식별자 충돌은 발견되지 않았다**. 유일하게 주목할 점은 신규 `WaitingSurface`(3값)가 기존에 이미 SoT 로 등재된 `WaitingInteractionType`(4값, `spec/conventions/interaction-type-registry.md` §1)과 이름·값공간이 매우 가까운데도 타입 파생이나 registry 상호참조로 명시적으로 묶여 있지 않다는 점이다 — 코드 주석 수준에서는 이미 구분을 설명하고 있고, 이 갭 자체도 해당 작업의 plan(`plan/in-progress/eia-command-waiting-surface-guard.md`)이 "spec 동기" 후속 항목으로 이미 인지하고 있어 새로운 리스크라기보다 기존 후속 작업의 우선순위 참고 자료에 가깝다. "표면(surface)" 어휘가 여러 도메인에서 재사용되는 점도 확인했으나 각기 다른 타입명·모듈로 분리돼 있어 실질 혼선 가능성은 낮다.

## 위험도

LOW
