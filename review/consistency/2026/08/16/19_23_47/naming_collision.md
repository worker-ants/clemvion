# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 검토 범위 요약

`git diff origin/main...HEAD` (워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`, HEAD=`2534438dd`)를
직접 대조했다. `codebase/**` 변경은 커밋 `9f870fb00`(19:16) 이후 0건(마지막 커밋
`2534438dd` 은 plan 트래커 문서만 수정) — 즉 이번 라운드가 보는 코드·spec 상태는 직전
`18_58_29` naming_collision 라운드가 이미 검토한 것과 동일하다. 아래는 그 결론을 독립적으로
재검증한 결과다(선행 리포트를 그대로 베끼지 않고 코드/spec 을 직접 grep 하여 재확인).

이번 변경이 새로 도입하는 식별자:

- 신규 파일 `codebase/backend/src/shared/utils/redact-stored-error.ts`(+`.spec.ts`)
- 신규 함수 `redactStoredErrorForResponse`
- 신규 타입 `ResponseExecution` · `ResponseNodeExecution` (`executions.service.ts`)
- 사설 메서드 개명 `stripPrivateRelations` → `toResponseExecution`, 신설 `stopInternal`
- `spec/conventions/secret-store.md` §1 신규 "비대상 — `Trigger.config.interaction.triggerToken`" 캐비엇
- `spec/5-system/14-external-interaction-api.md` §R17 기존 불릿 내부 확장(새 ID 발급 없음)
- `.claude/docs/plan-lifecycle.md` 에 문서화된 `pending_plans` 프런트매터 키의 **plan-레벨** 용법
  (spec-레벨과 동일 키, 다른 의미 — 기존 관행을 공식 문서화)

## 발견사항

- **[INFO]** `pending_plans` 프런트매터 키가 spec 레벨과 plan 레벨에서 서로 다른 의미로 쓰인다
  — 이번 diff 가 그 이중 용법을 처음 문서화
  - target 신규 식별자: `plan/in-progress/eia-internal-rest-error-masking.md` frontmatter 의
    `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`
    (이 plan 이 착수·완료하기 위해 먼저 닫혀야 하는 **선행 plan** 을 가리키는 plan→plan 참조)
  - 기존 사용처: `spec/**` frontmatter 의 `pending_plans`(예: 본 target 문서 자신인
    `spec/5-system/6-websocket-protocol.md` 상단 frontmatter — "이 spec 의 미구현 surface 를
    책임지는 plan", spec→plan 참조, `spec-impl-evidence.md §2.1` 이 SoT 이고
    `spec-pending-plan-existence.test.ts` 가 강제)
  - 상세: 같은 YAML 키가 문서 종류(파일이 `spec/` 아래인지 `plan/` 아래인지)에 따라 정반대
    방향의 관계(spec→plan 책임 vs plan→plan 선행 의존)를 표현한다. `.claude/docs/plan-lifecycle.md`
    diff 는 이 이중 용법이 **이미 관행**(plan 레벨 4건 실측)이며 target PR 이 발명한 것이 아니라
    사후 문서화임을 스스로 밝히고, "선언 위치가 의미를 정한다"는 명시적 disambiguation 규칙과
    "plan 레벨엔 완료 판정용 build guard 가 없다"는 비대칭까지 함께 적어 두어, 이 리뷰 관점이
    지적할 만한 위험(동일 키, 다른 의미로 인한 혼선)을 선제적으로 인지·완화하고 있다. spec 레벨은
    `partial→implemented` 승격을 강제하는 반면 plan 레벨은 사람이 읽는 힌트일 뿐이라 실무 영향은
    낮다.
  - 제안: 조치 불필요(문서가 이미 자체 disambiguation 을 갖춤). 장기적으로 두 의미를 완전히
    분리하고 싶다면 plan 레벨 전용 키(예: `blocked_by`)로 개명하는 안을 고려할 수 있으나, 이번
    변경 범위 밖이며 현재도 문서화된 규칙으로 충분히 명확하다.

- **[INFO]** `spec/1-data-model.md` 안에서 "응답 마스킹" 이라는 동일 한글 라벨이 서로 다른 두
  마스킹 메커니즘을 가리킨다
  - target 신규 식별자: `spec/1-data-model.md:564` — `Execution`/`NodeExecution.error` 정의
    표에 신설된 행 라벨 `응답 마스킹` (값-패턴 자격증명 마스킹, **egress 시점**, SoT
    [EIA §R17](../5-system/14-external-interaction-api.md))
  - 기존 사용처: 같은 파일 `spec/1-data-model.md:619`("응답 마스킹은 §2.17.2") ·
    `:641`(`#### 2.17.2 마스킹·노출 정책`) — `AuthConfig.config` 의 `***<last4>` **키-이름**
    기반 마스킹(**write 시점**, `auth-configs.service.ts` 의 `maskConfig`/`toMasked`)
  - 상세: 코드 레벨에서는 함수명(`redactStoredErrorForResponse` vs `maskConfig`)이 뚜렷이
    갈려 있어 충돌이 없다. spec 문서 표 안에서만 "응답 마스킹" 이라는 동일 한글 표현이 두
    서로 다른 체계(값-패턴/egress-time vs 키-이름/write-time)에 재사용됐다. 각 항목이 바로
    옆에서 SoT 링크(§R17 vs §2.17.2)로 즉시 구분되고, 신규 행 자체가 "**열거된 읽기 경로에서만**"
    이라는 한정어와 ⚠️ 캐비엇("이 두 컬럼은 어디서 나가든 마스킹된다로 읽으면 안 된다")까지
    붙여 두어, 이 문서가 반복적으로 자인해 온 "같은 이름, 다른 의미" 함정을 스스로 경계하고
    있다. 실사용 혼선 위험은 낮다.
  - 제안: 실질 조치 불필요. 원한다면 신설 행 라벨을 "응답 마스킹 (값-패턴, egress)" 처럼
    한 단어만 추가해 두 메커니즘을 시각적으로 더 갈라도 좋다.

## 관점별 확인 결과 (충돌 없음)

1. **요구사항 ID 충돌** — 새 `R-xxx`/`EIA-XX-NN` ID 미발급. 기존 `R17`(`14-external-interaction-api.md`
   1곳에만 존재, 확인함)의 불릿 내부를 확장하는 형태이고, `1-data-model.md`/
   `2-navigation/14-execution-history.md`(R-5 boundary 각주)/`4-nodes/1-logic/12-background.md`
   모두 §R17 을 SoT 로 참조만 한다. `secret-store.md` "비대상 — `Trigger.config.interaction.triggerToken`"
   블록은 기존 "비대상 — `AuthConfig.config`" 캐비엇과 같은 포맷을 재사용하되, 문서 스스로
   "위 예외와 같은 종류가 아니다 — 그쪽은 다른 메커니즘으로 동등 암호화되지만 이 필드는 암호화
   자체가 없다"고 근거를 분리해 명시했다 — 두 비대상 절이 서로 다른 근거를 각자 갖고 있어
   "선례 재사용으로 검증 없이 통과" 류의 위험이 없다.
2. **엔티티/타입명 충돌** — `ResponseExecution`/`ResponseNodeExecution`(`executions.service.ts`)를
   backend/frontend 전역 grep 결과 자기 모듈(및 `.spec.ts`) 밖 재사용 없음. 기존
   `ExecutionResponseDto`(DTO 클래스, `Dto` 접미)와 명명 패턴이 달라 혼동 낮음. `stopInternal`·
   `toResponseExecution` 은 전역 유일하며, 개명 전 이름 `stripPrivateRelations` 에 대한 stale
   참조도 남아 있지 않음(주석 속 "종전 이름은 ~였고" 서술 1곳뿐, 코드 참조 아님).
3. **API endpoint 충돌** — 신규 endpoint 없음. `GET /api/executions/:id`,
   `POST /api/executions/:id/re-run`, `GET /api/executions/:id/chain`,
   `POST /api/executions/:id/stop`, `GET /executions/:id/background-runs/:id` 전부 기존
   endpoint 재사용, 응답 값만 마스킹.
4. **이벤트/메시지명 충돌** — 신규 이벤트명 없음. `execution.snapshot`·`execution.node.*` 등
   기존 이벤트에 캐비엇 문장만 추가.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음 (`process.env`/`ConfigService` 신규
   참조 diff 부재 확인).
6. **파일 경로 충돌** — `redact-stored-error.ts`/`.spec.ts` 는 `shared/utils/` 의 기존
   `terminal-error-payload.ts`·`sanitize-error-message.ts` 와 동일한 "leaf util" 명명 컨벤션을
   따르고 기존 파일명과 겹치지 않음. spec 파일은 전부 기존 파일 본문 수정이며 신규 spec 파일 없음.
   plan 파일명(`eia-internal-rest-error-masking.md`)도 `plan/in-progress/`·`plan/complete/`
   전역에서 중복 없음.

## 이전 라운드 대비 특기사항

impl-prep 라운드(`16_03_57`)에서 WARNING 으로 지적된 초안 함수명 `redactExecutionErrorValue`
(예외 클래스 `ExecutionError` 를 부분 문자열로 포함)는 구현 과정에서 `redactStoredErrorForResponse`
로 개명되어 해소를 확인했다 — 이름이 `ExecutionError` 를 포함하지 않으며, 함수 자신의 JSDoc 이
"`ExecutionError` 예외 클래스와 무관하다"는 caveat 을 명시해 재발을 방지한다.

## 요약

이번 target(EIA §R17 내부 읽기 경로 마스킹 확장 + `secret-store.md` `triggerToken` 비대상 예외
등재, 결정 2026-08-16)은 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV·파일 경로 6개
관점 모두에서 기존 사용처와의 실질적 충돌이 없다. 신규 함수·타입은 전역 grep 으로 유일성을
확인했고, impl-prep 단계에서 지적된 유일한 명명 충돌 위험(`ExecutionError` 부분 문자열 포함)은
개명으로 해소됐다. 남은 관찰 두 건은 모두 "동일 라벨/키가 문서 위치·SoT 링크로 즉시 구분되는"
INFO 수준이며, 그중 `pending_plans` 이중 용법은 이번 target 이 새로 만든 충돌이 아니라 기존
관행을 문서로 정착시킨 것이다. Critical/Warning 없음.

## 위험도

LOW
