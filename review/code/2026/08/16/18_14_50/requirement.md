# Requirement Review — `18_14_50`

## 배경

이 changeset 은 이미 `/ai-review` 3라운드(`17_12_34` CRITICAL0·WARNING6 → `17_35_49`
CRITICAL0·WARNING3+doc4 → `17_56_15` CRITICAL0·WARNING1)를 거쳐 전부 조치·수렴한 상태이며,
직전 커밋(`28ac16aa6`, 3라운드 수렴 fix)까지 반영돼 있다. 이번 프롬프트에는 그 세 라운드의
산출물(RESOLUTION.md·SUMMARY.md·각 reviewer 리포트)과 4회의 consistency-check 라운드
(`16_03_57`·`16_32_42`·`16_48_55`·`17_35_13`) 산출물까지 diff 에 포함돼 있다.

본 라운드는 이전 라운드의 requirement 리포트(특히 `17_56_15/requirement.md`)를 그대로 신뢰하지
않고, HEAD 기준 핵심 코드(`executions.service.ts`/`executions.service.spec.ts`/
`background-runs.service.ts`/`background-runs.service.spec.ts`/`redact-stored-error.ts`/
`.spec.ts`/2개 DTO)와 관련 spec 6문서(§R17·§2.14·R-5·§8.2·WS 프로토콜·secret-store)를 처음부터
독립적으로 Read/Grep 으로 재대조했다. 특히 이전 라운드가 "실측" 이라 주장한 두 수치
(`pending_plans` spec 레벨 17건·plan 레벨 4건)를 `grep -rl`로 직접 재계산해 파일 단위로
확인했다(예시 코드블록 오탐 배제까지).

## 발견사항

없음 (CRITICAL/WARNING 급 결함 미발견).

## 점검한 항목과 직접 확인한 근거

1. **기능 완전성 / spec fidelity (관점 1·9)** — `spec/5-system/14-external-interaction-api.md`
   §R17 "내부 읽기 경로도 같은 마스킹을 적용한다 (결정 2026-08-16)" 불릿(:1486-1519)을 HEAD
   코드와 line-level 대조. "독립 반환 경로 4곳(`findById`·`toExecutionDto`·`getChain`·`stop`)"
   이 실제로 전부 `redactStoredErrorForResponse`/`toResponseExecution` 을 거침을 직접 확인
   (`executions.service.ts:640-644` nodeExecutions map, `:946` toExecutionDto, `:564` getChain→
   toResponseExecution, `:817-818` stop→toResponseExecution). `reRun()`(:493-495)도 `findById` 를
   재사용해 마스킹을 상속함을 확인 — spec 의 "re-run 은 findById 재사용으로 함께 덮인다" 서술과
   일치.
2. **형제 필드 우회 방지 (관점 6·7)** — `spec/1-data-model.md` §2.14(:561, :564)의 "복사" 관계 및
   신설 "응답 마스킹" 행이 `findById` 의 `nodeExecutions[].error` 마스킹(:624-644 주석+구현)과
   정확히 대응. `executions.service.spec.ts` `⑤`(:1012-1029)가 §2.14 의 "복사" 관계를 그대로
   재현하는 fixture 로 형제 필드 우회 차단을 검증함을 확인.
3. **자매 표면(background-runs) 동형 적용** — `background-runs.service.ts:299-302`
   (`toNodeExecutionDto`)의 마스킹 적용과 `.spec.ts`(:168-192, "body nodeExecutions[].error 의
   자격증명을 마스킹한다") 신규 테스트가 `executions.service.ts` 의 같은 패턴을 그대로 재현함을
   확인 — "자매 넷 중 하나만" 재발 형태가 이번엔 다섯째(BackgroundRunsService)까지 커버됨.
4. **에러 시나리오 / 반환값 / 엣지 케이스 (관점 2·5·8)** — `redact-stored-error.ts:59-64`:
   `null`/`undefined` → `null` 정규화, 레거시 string/number jsonb 값도 형태 보존 통과(캐너리
   테스트 `redact-stored-error.spec.ts:59-98` 로 고정 — 문자열/숫자 통과 + "자격증명 없는 문자열/
   평범한 메시지는 무변화" 보장 경계). `stop()` 의 4개 내부 반환 지점(waiting 경로·`affected=0`·
   정상 재조회·폴백)이 전부 `toResponseExecution` 단일 관문(:817-818)을 통과하도록 구조가
   강제돼 있어 반환 경로 누락 가능성이 설계적으로 닫혀 있음을 확인.
5. **null-hiding 타입 캐스트 부재 확인** — `executions.service.ts:77-93`
   (`ResponseExecution`/`ResponseNodeExecution` 명시 타입)과 `:640`(`.map<ResponseNodeExecution>`,
   캐스트 없음), `:990-996`(`toResponseExecution`, `as Execution` 없음)을 직접 읽어 두 자리 모두
   무단 단언(`as Execution`/`as NodeExecution`)이 없음을 확인 — 2라운드에서 지적된 회귀 재발
   없음.
6. **copy-on-change 참조 동일성** — `executions.service.ts:640-644`의
   `ne.error == null ? ne : { ...ne, error: redactStoredErrorForResponse(ne.error) }` 삼항과,
   `executions.service.spec.ts` `⑤-c`(:1067-1097)의 `toBe(clean)`/`not.toBe(failed)` 참조 동일성
   단언이 실제로 일치함을 확인 — 무조건 spread 로 되돌리는 회귀를 구조적으로 잡는 테스트가
   존재.
7. **비즈니스 로직 / 권한 게이트 전제 (관점 7)** — `executions.controller.ts:63`
   (`@Get(':id')` 진입부)와 `background-runs.controller.ts` 를 grep 해 두 라우트 모두
   `@Roles` 데코레이터가 없음을 재확인 — CHANGELOG·spec·JSDoc 이 공통 전제로 드는 "viewer 포함
   워크스페이스 멤버 전원 노출" 주장과 일치. WS `execution.snapshot`(`websocket.gateway.ts:399`)
   이 `executionsService.findById` 를 호출함도 재확인 — spec §6-websocket-protocol.md 의 "관문
   상속" 서술과 일치.
8. **소비자 영향 범위 / 엔티티 타입 전제** — `execution.entity.ts:81`,
   `node-execution.entity.ts:76` 를 직접 읽어 두 엔티티 모두 `error: Record<string, unknown>`
   (`| null` 없음)로 선언됨을 확인 — `ResponseExecution`/`ResponseNodeExecution` 이 "엔티티와
   `error` 의 null 가능성만 다르다"는 주석의 전제가 정확함.
9. **DTO 문서(Swagger) 동반 갱신** — `execution-response.dto.ts`(`ExecutionDto.error`,
   `NodeExecutionSummaryDto.error`)와 `background-run-response.dto.ts`
   (`BackgroundRunNodeExecutionDto.error`) 3곳 모두 "자격증명으로 판별된 값은 마스킹되어
   반환된다 … DB 원문과 다를 수 있다" + SoT 포인터(§R17, `redact-stored-error.ts`)가 실제로
   반영돼 있음을 확인.
10. **`pending_plans` 실측치 독립 재검증 (2라운드 requirement 정정의 재확인)** —
    `.claude/docs/plan-lifecycle.md:88` 의 "spec 레벨 17건 · plan 레벨 4건" 을 `grep -rl
    "^pending_plans:" spec/` 로 재계산: 18건 히트 중 `spec/conventions/spec-impl-evidence.md`
    의 :68 줄은 그 컨벤션을 설명하는 **예시 fenced 코드블록** 안이고(파일 자신의 frontmatter,
    line 1-19, 는 `status: implemented` 로 `pending_plans` 없음) 실 선언이 아니므로 제외 → 17건
    정확. plan 레벨은 `grep -rl "^pending_plans:" plan` 로 5건 히트하나
    `plan/complete/spec-draft-web-chat-console.md:158` 도 같은 이유로 (patch 될 **신규 spec
    frontmatter 예시** 코드블록, 실제 plan 자신의 frontmatter 는 파일 최상단) 제외 → 4건
    정확. 두 수치 모두 문서에 적힌 시점(2026-08-16) 기준으로도 유효함을 확인 —
    "PR 이 닫히는 시점" 재측정 없이도 stale 화 안 됐다.
11. **spec-sync 트래커 I1/D 항목 종결 여부** — `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    의 I1·D 항목이 실제로 닫혀 있고 `eia-internal-rest-error-masking.md` 로의 포인터가 존재함을
    확인. 신규 잔여(WS `execution.node.*` emit, workflow-assistant LLM 도구)도 CHANGELOG "잔여
    갭" 서술과 일치.
12. **다른 유출 표면 존재 여부 재탐색** — `Execution.error`/`NodeExecution.error` 를 응답
    객체에 `error:` 키로 담는 모든 지점을 저장소 전체(`codebase/backend/src/modules/executions/**`)
    에서 재검색 — `redactStoredErrorForResponse` 를 거치지 않는 자리 0건. execution-engine 내부
    서비스들의 `.error` 참조는 전부 엔진 내부 상태 처리(REST/WS 응답 조립이 아님)이거나 이미
    spec 이 "잔여(범위 밖)"로 명시한 표면(workflow-assistant LLM 도구)뿐임을 확인 — 신규
    미등재 유출 표면 없음.
13. **TODO/FIXME/HACK/XXX (관점 3)** — `redact-stored-error.ts`, `.spec.ts`,
    `executions.service.ts`, `background-runs.service.ts`, `background-runs.service.spec.ts`
    5개 핵심 파일에 grep, 미완성 시사 주석 0건.
14. **엔진 트랜잭션 plan 이동(`plan/complete/eia-stalled-atomicity.md`)** — 이 diff 에는 plan
    문서 이동만 있고 `finalizeStalledExhausted` 등 실제 서비스 코드는 포함돼 있지 않음(별도
    PR #1173 로 이미 머지) — 이번 requirement 리뷰 범위(코드 요구사항 충족)와 무관, 재확인만.

## 확인했으나 이미 문서화된 잔여 (조치 불요, 참고)

- `stop()` 의 `WAITING_FOR_INPUT` 분기가 "표면 전수" describe 블록에서 마스킹 값으로 직접
  단언되지 않는다 — 마스킹이 `stop()` 단일 관문을 통과하는 구조라 기능적 누락 위험은 없고,
  이미 2·3라운드 testing INFO 로 기록된 항목이라 중복 등재하지 않는다.
- `workflow-assistant` LLM 도구(`explore-tools.service.ts:464,484`)의 더 약한(키-기반) 마스킹은
  실측으로 "값-패턴 합성은 답이 아니다"(`****9876` 접미 힌트 파괴)가 반증돼 코드는 되돌리고
  트래커에 결정 항목으로 등재됨을 재확인. spec §R17 "잔여(범위 밖) ③" 서술과 정확히 일치.

## 요약

`Execution.error`/`NodeExecution.error` 응답 egress 마스킹을 읽기 경로 전반(REST 4경로 +
background-runs body + WS snapshot 재사용)으로 확장하는 이번 changeset 은 3라운드의
`/ai-review`·2라운드의 `--spec`(consistency)을 거치며 null-hiding 캐스트 재발, copy-on-change
참조 동일성 미검증, 형제 필드(`nodeExecutions[].error`) 우회, DTO 문서 누락, spec 실측치
staleness 등 실질 결함을 전부 조치·수렴한 상태다. 본 라운드에서 핵심 코드와 관련 spec 6문서를
처음부터 독립적으로 line-level 재대조했고, 이전 라운드가 조치·주장한 지점(타입 명시,
참조 동일성 테스트, 자매 표면 background-runs 적용, plan 실측치, 트래커 I1/D 종결)이 실제
HEAD 코드에 정확히 반영돼 있음을 직접 확인했다. `pending_plans` 실측치(17/4)도 grep 으로
독립 재계산해 여전히 정확함을 확인했다. 새로 발견한 CRITICAL/WARNING 은 없다 — 이 changeset 은
requirement 관점에서 push 게이트를 통과할 준비가 됐다.

## 위험도

NONE
