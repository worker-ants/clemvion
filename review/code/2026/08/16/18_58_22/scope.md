# 변경 범위(Scope) Review

## 배경 확인

이 changeset 은 `origin/main...HEAD` 9개 커밋(139개 파일, +11128/-66)으로 구성된다. 그중
**103개는 `review/code/**`·`review/consistency/**` 산출물**(이 저장소 표준 자동 리뷰
워크플로가 라운드마다 커밋하는 세션 기록)이고, 실제 코드 변경은 8개 파일
(`executions.service.ts`/`.spec.ts`, `background-runs.service.ts`/`.spec.ts`,
`redact-stored-error.ts`/`.spec.ts`(신규), `execution-response.dto.ts`,
`background-run-response.dto.ts`)에 한정된다. 나머지는 `spec/**` 6개·`plan/**` 다수·
`CHANGELOG.md`·`.claude/docs/plan-lifecycle.md` 문서다. `git log`로 라운드별 fix 커밋
(`9dee1caa0`~`e88ac4bdf`)과 최초 chore 커밋(`fafb57e46`)을 모두 대조했다.

이 PR 은 이미 5라운드의 `/ai-review`(각 라운드에 전담 scope reviewer 포함)를 거쳤고,
`RESOLUTION.md` 들에 scope 관련 지적 1건(1라운드, plan chore 번들)과 그에 대한 명시적
반박·근거가 기록돼 있다. 아래는 그 이력을 전제로 한 **독립 재검증**이다.

## 발견사항

- **[INFO]** 핵심 작업(EIA 내부 REST 읽기 경로 `Execution.error`/`NodeExecution.error`
  마스킹)과 무관해 보이는 plan 위생 chore 가 같은 브랜치에 번들돼 있다 — 단, 프로젝트
  규약이 명시적으로 요구하는 형태다
  - 위치: 커밋 `fafb57e46`(`chore(plan): mark 6 EIA plans complete`), 그 파생으로
    `.claude/docs/plan-lifecycle.md:80-109`(`pending_plans` 표·재현법·caveat 신설),
    `plan/in-progress/backend-lint-gate-broken-on-main.md:787`,
    `plan/in-progress/retry-turn-terminal-guard.md:308,372`,
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md:106`,
    `plan/in-progress/ws-event-types-extract.md:293`(전부 `./eia-terminal-emit-facade.md`
    → `../complete/eia-terminal-emit-facade.md` 류 링크 경로 정정 1줄씩)
  - 상세: `chore(plan)` 커밋은 이미 별도 PR(#1173~#1178)로 머지된 6개 EIA plan 을
    `in-progress/` → `complete/` 로 옮기고, 그 이동으로 깨지는 인입 상대링크를 정정하며,
    `spec-draft-ws-types-canonical-location` 의 유일 잔여 후속(plan 레벨 `pending_plans`
    문서화)을 닫는다. 이는 이번 PR 의 핵심 서술(masking)과 직접적 인과관계가 없는 **별도
    관심사**다. 그러나 [`.claude/docs/plan-lifecycle.md §3`](../../../../../../.claude/docs/plan-lifecycle.md)
    이 *"이동은 마지막 작업 PR 안에서 … 별 commit 으로. plan 이동만 담은 별 PR 분리
    금지"* 를 명시적으로 규정하고, 실제 구조도 정확히 그 형태(별도 commit, 별도 PR 아님)를
    따른다. 1라운드 scope reviewer 가 이미 이 항목을 WARNING 으로 지적했고, 개발자가
    `RESOLUTION.md`(`17_35_49`)에서 위 규약 인용으로 반박해 무조치 처리했다 — 그 판단은
    문서 근거와 정확히 일치하므로 타당하다. 다만 `pending_plans` 표 신설(30줄)은 "6개
    plan 을 옮긴다"는 chore 자체보다 한 단계 더 나아간 **선행 plan 의 잔여 후속 이행**이라,
    범위가 "plan 위생" 에서 "plan 관행 문서화"로 미세하게 확장된 지점이다.
  - 제안: 조치 불필요. 근거가 이미 규약에 못박혀 있고 별도 PR 분리는 오히려 규약 위반이다.
    다음에 유사 상황이 오면 커밋 메시지에 "이 chore 가 왜 이 PR 에 있는가"(§3 인용)를
    한 줄 요약해 두면 향후 scope reviewer 의 재확인 비용을 줄일 수 있다.

- **[INFO]** `executions.service.ts` 의 `stripPrivateRelations` → `toResponseExecution`
  개명 + `stop()`/`stopInternal()` 분리 + `ResponseExecution`/`ResponseNodeExecution`
  신규 타입 도입은 표면적으로 리팩터이지만, 마스킹을 단일 관문으로 강제하기 위한
  **의도된 설계 변경**이라 스코프 이탈이 아니다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 함수
    `toResponseExecution`(구 `stripPrivateRelations`), `stop`/`stopInternal` 분리, 상단
    `ResponseExecution`/`ResponseNodeExecution` 타입 선언부
  - 상세: JSDoc 이 "자매 넷 중 하나만 마스킹되는" 이 저장소의 반복 결함 형태를 근거로 들며,
    호출부마다 마스킹을 손으로 걸지 않고 한 함수로 수렴시키는 이유를 명시한다. `stop()`
    분리도 같은 목적(반환 지점이 늘어도 관문 하나만 지나게)이며 TOCTOU 원자 UPDATE
    로직 자체는 그대로 보존된다(동시성 리뷰(`concurrency.md`)가 별도로 확인). 새 타입도
    "무단 캐스트가 null-check 누락을 컴파일러가 못 잡게 한다"는, 이번 PR 이 고치는 결함
    클래스와 직결된 이유로 도입됐다. 요청 범위(마스킹 적용) 밖의 기능 확장이 아니라
    마스킹 적용을 안전하게 하기 위한 최소 구조 변경으로 판단한다.
  - 제안: 조치 불필요.

- **[INFO]** `workflow-assistant/explore-tools.service.ts` 값-패턴 마스킹 시도는 최종
  diff 에 흔적이 없다 — 시도 후 되돌린 것이 실제로 반영됐다
  - 위치: 해당 파일에 대한 diff 자체가 이번 changeset 에 존재하지 않음(`git log`/`git diff`
    확인, 매치 0건)
  - 상세: `RESOLUTION.md`(`17_12_34`)가 "처방을 실측이 반증해 되돌렸다"고 서술한 그대로,
    최종 커밋들에 `explore-tools.service.ts` 편집이 전혀 없다. 되돌린 실험적 변경이
    남아 범위를 넓히는 사고가 없었음을 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** `redact-stored-error.ts` 는 신규 leaf 유틸이지만 기능 확장(over-engineering)
  이 아니다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규, 35줄)
  - 상세: 기존 `sanitize-error-message.ts` 의 `deepRedactSecrets` 를 얇게 감싸는 34줄
    단일 함수다. 기존에 있던 `toTerminalErrorPayload` 를 재사용하지 않은 이유(응답 계약
    변경 방지)도 JSDoc 에 근거로 남아 있어, "표준 함수로 대체 가능한데 새로 만든" 패턴이
    아니다. 소비처는 `executions.service.ts`·`background-runs.service.ts` 2곳으로
    fan-in 이 좁다.
  - 제안: 조치 불필요.

- **[INFO]** 문서(`CHANGELOG.md`, spec 6개, DTO JSDoc/Swagger description)변경은 전부
  코드 변경의 직접 결과를 기술하며, 새 약속이나 무관한 서술을 추가하지 않는다
  - 위치: `CHANGELOG.md`(`## Unreleased`), `spec/1-data-model.md`,
    `spec/2-navigation/14-execution-history.md`, `spec/4-nodes/1-logic/12-background.md`,
    `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`,
    `spec/conventions/secret-store.md`
  - 상세: `6-websocket-protocol.md`(`execution.snapshot` 행) 처럼 언뜻 무관해 보이는
    자매 문서 수정도, `execution.snapshot` 이 `findById` 를 재사용해 같은 마스킹 관문을
    상속하기 때문이라는 인과가 diff 내부 주석·commit 메시지에 명시돼 있다(코드 변경의
    문서 반영이지 별도 기능 서술 추가가 아님). `secret-store.md` 의 `triggerToken`
    비대상 등재도 이번 PR 이 발견한 근거 논리 결함(§R17 관련 리뷰에서 지적)을 spec 에
    반영한 것으로 동일 계열이다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/**`·`review/consistency/**` 100여 개 신규 파일은 스코프
  이탈이 아니라 이 저장소 표준 워크플로의 산출물이다
  - 위치: `review/code/2026/08/16/{17_12_34,17_35_49,17_56_15,18_14_50,18_33_52}/**`,
    `review/consistency/2026/08/16/{16_03_57,16_32_42,16_48_55,17_35_13,18_20_34,18_33_59}/**`
  - 상세: `CLAUDE.md` 가 구현 완료 후 `/ai-review` + critical/warning fix 를 "상시 승인된
    강제 의무"로 규정하며, 각 라운드 산출물이 `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`
    에 커밋되는 것은 이 프로젝트의 정본 관행이다(사용자 memory 의 여러 선례와 일치).
    코드 리뷰 결과 문서 자체가 diff 에 포함되는 것은 "요청 이상의 변경"이 아니라 요청된
    워크플로의 필수 산출물이다.
  - 제안: 조치 불필요.

## 요약

핵심 코드 변경(backend 8개 파일)은 요청된 작업("내부 REST/WS 읽기 경로 `Execution.error`
egress 마스킹")에 정확히 대응하며, 리팩터(타입 신설·함수 분리·개명)도 전부 그 목적을
안전하게 달성하기 위한 최소 구조 변경으로 JSDoc·commit 메시지에 근거가 남아 있다. 문서
변경(spec 6개·CHANGELOG·DTO JSDoc)도 코드 변경의 직접 파생이다. 유일하게 "핵심 서술과
인과가 약한" 항목은 plan 위생 chore(`fafb57e46`, 6개 완료 plan 이동 + `pending_plans`
표 신설)인데, 이는 1라운드 scope reviewer 가 이미 지적했고 프로젝트 규약
(`plan-lifecycle.md §3` — "plan 이동은 마지막 작업 PR 안 별 commit 으로, 별 PR 분리 금지")
에 정확히 부합하는 형태로 무조치 처리돼 있어 재차 문제 삼지 않는다. `explore-tools.service.ts`
실험적 변경이 최종 diff 에 흔적 없이 제거된 것도 확인했다. `.claude/`·`package.json`·
lockfile·CI 설정 등 의도치 않은 설정 변경은 없다(diff 0). 전반적으로 이 changeset 은
5라운드 반복 리뷰를 거치며 스코프가 계속 좁아진(동작→구조→배치→수치) 궤적을 보이고,
이번 6라운드 시점에는 새로운 스코프 이탈이 발견되지 않는다.

## 위험도

NONE
