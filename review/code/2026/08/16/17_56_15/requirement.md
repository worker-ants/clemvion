# Requirement Review — `17_56_15` (3라운드)

## 배경

이 changeset 은 이미 `/ai-review` 2라운드(`17_12_34` CRITICAL0·WARNING6, `17_35_49`
CRITICAL0·WARNING3+documentation4)를 거쳐 전부 조치된 상태이며, 이번 프롬프트에는 그 두 라운드의
산출물(RESOLUTION.md·SUMMARY.md·각 reviewer 리포트)까지 diff 에 포함돼 있다. 본 라운드는 최종
상태를 처음부터 독립적으로 재검증했다 — 이전 라운드의 requirement 리포트를 신뢰하지 않고,
`executions.service.ts`/`executions.service.spec.ts`/`background-runs.service.ts`/
`redact-stored-error.ts`/관련 spec 3문서(§R17·§2.14·DTO)를 직접 Read/Grep 으로 열어 대조했다.

## 발견사항

없음 (CRITICAL/WARNING 급 결함 미발견).

## 점검한 항목과 직접 확인한 근거

1. **기능 완전성 / spec fidelity (관점 1·9)** — `spec/5-system/14-external-interaction-api.md`
   §R17 "내부 읽기 경로도 같은 마스킹을 적용한다 (결정 2026-08-16)" 불릿(:1486-1519)을 코드와
   line-level 대조:
   - "독립 반환 경로 4곳(`findById`·`toExecutionDto`·`getChain`·`stop`)" — 실제
     `executions.service.ts` 에서 4곳 모두 `redactStoredErrorForResponse`/`toResponseExecution`
     을 거치는 것을 직접 확인(`:640-643` nodeExecutions map, `:946` toExecutionDto, `:564`
     getChain→toResponseExecution, `:818` stop→toResponseExecution).
   - "형태는 바꾸지 않는다(`toTerminalErrorPayload` 재사용 안 함)" — `redact-stored-error.ts` 가
     `deepRedactSecrets` 만 위임하고 wire 정규화를 하지 않음을 확인.
   - "`code`·`nodeId` 는 대상이 아니다" — `deepRedactSecrets` 는 값-패턴 정규식이라 구조적으로
     이 두 필드를 건드리지 않는다(스펙 서술과 일치).
   - "DB 는 원문 보존(egress-only)" — `executions.service.spec.ts` "DB 원문은 건드리지 않는다"
     테스트(:990-1002)가 입력 엔티티 객체 자체가 변이되지 않음을 실제로 단언.
2. **형제 필드 우회 방지 (관점 6·7)** — `spec/1-data-model.md` §2.14(:561, :564)의 "복사" 관계 및
   신설 "응답 마스킹" 행이 `findById` 의 `nodeExecutions[].error` 마스킹과 정확히 대응함을 확인.
   `executions.service.spec.ts` `⑤`(:1012-1029)가 §2.14 의 "복사" 관계를 그대로 재현하는 fixture
   (`nodeExecutions[0].error` 를 최상위와 **같은 leaked 값**으로 세팅)로 형제 필드 우회를 실제로
   차단하는지 검증한다.
3. **에러 시나리오 / 반환값 / 엣지 케이스 (관점 2·5·8)** — `redact-stored-error.ts:59-64`:
   `null`/`undefined` → `null` 정규화, 레거시 string/number jsonb 값도 형태 보존 통과(캐너리
   테스트 `redact-stored-error.spec.ts:59-74` 로 고정). `stop()` 의 4개 내부 반환 지점(waiting
   경로·`affected=0`·정상 재조회·폴백)이 전부 `toResponseExecution` 단일 관문을 통과하도록
   구조가 강제돼 있어("함수를 하나 더 두어 모든 반환이 같은 문을 통과") 반환 경로 누락 가능성이
   설계적으로 닫혀 있음을 확인.
4. **null-hiding 타입 캐스트 재발 방지 (2라운드 자기 회귀 검증)** — 1라운드에서 `toResponseExecution`
   의 `as Execution` 무단 캐스트를 걷어냈는데, 2라운드에서 바로 위 자매 자리(`nodeExecutions` map)
   에 같은 패턴(`as NodeExecution`)이 재도입됐던 것이 `17_35_49` maintainability W1 이었다.
   현재 `executions.service.ts:87-103`(`ResponseExecution`/`ResponseNodeExecution` 명시 타입)과
   `:640`(`.map<ResponseNodeExecution>`, 캐스트 없음)을 직접 읽어 두 자리 모두 무단 캐스트가
   남아있지 않음을 확인 — 재발 없음.
5. **copy-on-change 성능 최적화의 참조 동일성 검증 (2라운드 자기 회귀 검증)** — `17_35_49`
   testing W1 이 지적한 "값만 비교해 삼항 회귀를 못 잡는다" 갭에 대해, 현재
   `executions.service.spec.ts` `⑤-c`(:1067-1097)가 `error` 없는 행은
   `expect(result.nodeExecutions[0]).toBe(clean)` 로 **참조 동일성**을, `error` 있는 행은
   `.not.toBe(failed)` 로 **복제**를 각각 단언함을 확인 — 무조건 spread 로 되돌리는 회귀를
   구조적으로 잡는다.
6. **비즈니스 로직 / 권한 게이트 전제 (관점 7)** — `executions.controller.ts`/
   `background-runs.controller.ts` 를 grep 해 `GET /api/executions/:id` 및
   `GET /executions/:id/background-runs/:id` 라우트에 실제로 `@Roles` 데코레이터가 없음을
   재확인 — CHANGELOG·spec·JSDoc 이 공통 전제로 드는 "viewer 포함 워크스페이스 멤버 전원 노출"
   주장이 사실과 일치.
7. **소비자 영향 범위 (관점 8)** — `interaction.service.ts:226,248`, `hooks.service.ts:407` 를
   확인 — 셋 다 `executionsService.stop(...)` 반환값을 버리고 사용하지 않아, "`stop()` 반환 타입
   축소의 영향은 HTTP 응답 표면 하나뿐" 이라는 JSDoc 주장과 일치.
8. **엔티티 타입 전제 검증** — `execution.entity.ts:81`, `node-execution.entity.ts:76` 를 직접
   읽어 두 엔티티 모두 `error: Record<string, unknown>` (`| null` 없음)로 선언됨을 확인 —
   `ResponseExecution`/`ResponseNodeExecution` 이 "엔티티와 `error` 의 null 가능성만 다르다" 는
   주석의 전제가 정확하다.
9. **DTO 문서(Swagger) 동반 갱신 (2라운드 impl-done 회귀 검증)** — `execution-response.dto.ts`
   (`ExecutionDto.error`, `NodeExecutionSummaryDto.error`)와
   `background-run-response.dto.ts`(`BackgroundRunNodeExecutionDto.error`) 3곳 모두 "자격증명으로
   판별된 값은 마스킹되어 반환된다 … DB 원문과 다를 수 있다" + SoT 포인터(§R17,
   `redact-stored-error.ts`)가 실제로 반영돼 있음을 확인.
10. **plan-lifecycle.md 실측치 정확성 (2라운드 requirement INFO 의 재정정 검증)** — 신규 §
    (`.claude/docs/plan-lifecycle.md:80-101`)의 "spec 레벨 17건 · plan 레벨 4건" 을 저장소
    전체에서 직접 grep 으로 재계산: spec 레벨 `pending_plans:` frontmatter 보유 파일은
    `spec/conventions/spec-impl-evidence.md`(컨벤션 설명 문서 자체의 예시 — 실선언 아님)를
    제외하면 정확히 **17건**. plan 레벨은 `plan/in-progress/`(2건) + `plan/complete/`(2건,
    `spec-draft-ws-types-canonical-location.md`·`spec-draft-eia-error-masking-catalog.md`) =
    **4건** — 단순 `grep -rl "^pending_plans:"` 는 `plan/complete/spec-draft-web-chat-console.md`
    도 히트하지만 그 파일의 :158 는 본문 안 spec frontmatter **예시 코드블록**이지 이 plan 자신의
    frontmatter 가 아님을 직접 파일을 열어 확인 — 문서의 "4건" 주장이 정확하다(오탐 아님).
11. **spec-sync 트래커 I1/D 항목의 실제 종결 여부** — `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    :180-211 을 직접 열어 I1("내부 REST 와 WS 가 다른 값")·D(`triggerToken` 비대상 등재) 모두
    `[x]` 로 닫히고 "결정됨(2026-08-16)" 각주 + `eia-internal-rest-error-masking.md` 로의 포인터가
    실제로 존재함을 확인. 동시에 신규 잔여(`NodeExecution.error` 는 `[x]` 로 해소, workflow-assistant
    LLM 도구 갭은 `[ ]` 로 신규 등재)도 확인 — CHANGELOG "잔여 갭(의도, 트래커 등재)" 서술과 일치.
12. **TODO/FIXME/HACK/XXX (관점 3)** — `redact-stored-error.ts`, `.spec.ts`,
    `executions.service.ts`, `background-runs.service.ts` 4개 핵심 파일에 grep, 미완성 시사 주석
    0건.
13. **엔진 트랜잭션 plan 이동(`plan/complete/eia-stalled-atomicity.md`)** — 이 diff 에는 해당 plan
    문서 이동만 있고 `finalizeStalledExhausted` 등 실제 서비스 코드 변경은 포함돼 있지 않음을
    `git show --stat` 로 재확인(별도 PR #1173 로 이미 머지된 이력 문서 이동) — 이번 requirement
    리뷰 범위(코드 요구사항 충족)와 무관.

## 확인했으나 이미 문서화된 잔여 (조치 불요, 참고)

- `stop()` 의 `WAITING_FOR_INPUT` 분기(라인 850-869)는 "표면 전수" describe 블록에서 직접
  단언되지 않는다(`17_35_49` testing INFO 가 이미 지적) — 다만 마스킹이 `stop()` 단일 관문을
  통과하는 구조라 기능적 누락 위험은 없고, 이미 별도 리뷰 라운드에 기록된 항목이라 본 라운드에서
  중복 등재하지 않는다.
- `workflow-assistant` LLM 도구(`explore-tools.service.ts:464,484`)의 더 약한(키-기반) 마스킹은
  `17_12_34` requirement W1 에서 발견 → 처방(값-패턴 합성)이 실측으로 반증돼 되돌리고 트래커에
  결정 항목으로 등재된 것을 확인. spec §R17 "잔여(범위 밖) ③" 서술과 정확히 일치 — 코드 변경
  없이 spec 서술이 총칭에서 열거로 좁혀진 것도 확인했다.

## 요약

`Execution.error`/`NodeExecution.error` 응답 egress 마스킹을 읽기 경로 전반(REST 4경로 +
background-runs body + WS snapshot 재사용)으로 확장하는 이번 changeset 은, 이미 2라운드의
`/ai-review` 를 거치며 null-hiding 캐스트 재발·copy-on-change 참조 동일성 미검증·DTO 문서
누락·plan 실측치 stale 등 실질 결함을 모두 조치한 상태다. 본 3라운드에서 핵심 코드
(`redact-stored-error.ts`, `executions.service.ts`, `background-runs.service.ts`)와 관련 spec
3문서(§R17·§2.14·DTO JSDoc)를 처음부터 독립적으로 line-level 대조했고, 이전 두 라운드가 조치한
지점(타입 캐스트, 참조 동일성 테스트, plan 실측치, 트래커 I1/D 종결)이 실제로 최종 코드에
반영돼 있음을 직접 확인했다. 새로 발견한 CRITICAL/WARNING 은 없다.

## 위험도

NONE
