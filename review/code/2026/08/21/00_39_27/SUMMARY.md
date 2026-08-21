# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 0건. 직전 라운드(`00_03_57`) CRITICAL(`boolean` 파라미터 마스킹 마커 완전 우회)은 이번 수정(`50f799efd`)에서 실제로 해소됐음을 5개 reviewer(security/requirement/scope/api_contract/maintainability)가 코드로 직접 재검증했다. 위험도를 MEDIUM 으로 끌어올리는 것은 **scope 리뷰가 지적한 절차 위반** — `fix(security)` 커밋(developer/resolution-applier 턴)이 `spec/5-system/14-external-interaction-api.md` 표 행을 `project-planner` 위임이나 SPEC-DRIFT escalation 절차 없이 직접 수정했다(내용 자체는 이미 planner 가 승인한 캐비엇과 동일해 실질 리스크는 낮음). 아울러 `requirement` 리뷰가 `[SPEC-DRIFT]` 로 태깅한 항목(§6 표가 CRITICAL 수정 이전의 "resolve 직후" 검사 시점을 여전히 서술)은 코드가 아니라 spec 갱신이 필요하다 — **coding revert 대상이 아님**에 유의.

**라우터 강제 화이트리스트 이행 확인**: forced 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨(프롬프트 명시). 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] §6 reason 표가 여전히 "adapter `resolveTriggerParameters` **직후**"에만 검사한다고 서술 — 실제 구현은 raw(coerce 전) 우선 검사 → resolve → resolve 후 재검사의 2단계 순서다. 이 순서 자체가 직전 라운드 CRITICAL(`boolean` 마커 완전 우회, `Boolean('***')===true`)의 수정 내용이며, 코드는 옳고 spec 서술만 낡았다(developer 는 `spec/` read-only 라 이번 PR 에서 고칠 권한이 없었음). 그대로 두면 다음 사람이 이 문장만 보고 검사 시점을 되돌려 같은 CRITICAL 이 재발할 수 있다. | `spec/4-nodes/7-trigger/1-manual-trigger.md:170` / 대응 코드: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:55-69` | 코드 변경 불필요. `project-planner` 턴으로 §6 표의 "직후"를 "전후(raw 우선, resolve 후 재검사)"로 정정 — spec revert 아니라 spec 갱신 경로. |
| 2 | 완전성/UX | raw 단계와 resolve 단계 검사가 서로 다른 예외로 분리돼 즉시 throw 된다 — 한 요청 안에 두 단계 각각에서만 감지되는 위반(또는 마스킹 위반 + 무관한 구조 오류인 `missing_required` 등)이 섞이면 첫 응답에는 그중 한쪽만 실리고 나머지는 다음 재제출까지 미뤄진다. `details[]` 가 "필드별 전체 목록"이라는 암묵적 기대를 부분적으로 깨며, 이 상호작용을 겨냥한 캐너리 테스트가 없다(기존 "여러 필드가 걸리면 전부 돌려준다" 테스트는 같은 phase 위반만 커버). 보안·정합성 문제는 아님. | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:55-69`(`resolveTriggerParametersRejectingMasked` 내 두 `throwIfAny` 호출) | 혼재 케이스(raw 마커 필드 + JSON-string 인코딩된 phase②-only 필드, 또는 마스킹+구조오류 혼합)를 재현하는 캐너리 테스트 추가, 또는 두 phase 결과를 합쳐 한 번에 throw 하도록 변경. 최소한 docstring 에 이 캐비엇을 한 줄 남길 것. |
| 3 | 절차/스코프(spec 권한 경계) | `fix(security)` 커밋(developer/resolution-applier 턴)이 `spec/` 을 직접 수정 — 이 저장소 규약상 `spec/` 은 developer read-only 이고 변경은 `project-planner` 위임 또는 SPEC-DRIFT escalation(`plan/in-progress/spec-update-*.md` draft + `ESCALATE=spec` + `/consistency-check --spec` BLOCK:NO) 대상이다. `git log -p --follow` 로 역추적한 결과 표 행 라벨("서버 (재제출 API)"→"서버 (Manual 실행 경로)" + "fresh 입력도 대상" 문구)이 planner 턴(`871d3fcb0`)이 아니라 이번 `fix(security)` 커밋(`50f799efd`)에서 처음 바뀌었고, 대응하는 `spec-update-*.md` draft 는 `plan/` 어디에도 없다. 내용 자체는 이미 planner 가 확정한 캐비엇 문단과 동일한 사실을 표 행에 동기화한 것뿐이라 실질 리스크는 낮음. | `spec/5-system/14-external-interaction-api.md:1573` | 이 한 줄을 별도 `project-planner` 턴(또는 사후 SPEC-DRIFT escalation)으로 처리하거나, 최소한 `RESOLUTION.md`/커밋 메시지에 "SPEC-DRIFT 경로로 사전 승인됨" 근거를 남길 것. 반복되면 `guard_review_before_push.py` 류가 developer 커밋의 `spec/` diff 를 탐지하도록 강화 검토. |
| 4 | 유지보수성(코드 중복) | 신규 `isPlainRecord` 타입가드가 같은 디렉터리의 기존 `isRecord`(`to-record.ts`, refactor-03 M-7 산출물)를 이름만 바꿔 재구현 — 로직이 문자 그대로 동일. 새로 작성하는 파일이라 옛 코드 관성이 아니라 의도적으로 피할 수 있었던 중복(저장소에 이미 유사 중복 3곳이 있으나 이번은 그 목록에 하나를 더 얹은 셈). | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`(함수 `isPlainRecord`, 게이트 112~114 및 사용처 게이트 101) | `import { isRecord } from './to-record';` 로 교체하고 로컬 `isPlainRecord` 선언 제거. 리스크 없는 정리. |
| 5 | 문서화(sibling drift) | 이번 changeset 이 §R17 표/캐비엇·CHANGELOG·코드 docstring 세 곳에서 명시적으로 정정한 "재제출(resubmission) 한정" 프레이밍(→ "Manual 실행 경로 전체, 사용자가 직접 타이핑한 마커도 거부") 이 정확히 같은 계열의 sibling 문서 두 곳에는 전파되지 않아, 옛 프레이밍이 그대로 남아 이번 changeset 내부에서 서로 모순된다. 이 문구만 읽으면 폼에 직접 `***` 를 입력하면 통과한다고 오독하기 쉽지만 실제론 반대다. | `spec/5-system/3-error-handling.md:193`, `spec/5-system/12-webhook.md:312` | 두 위치의 "재제출 경로 한정"을 §R17 의 실제 근거(최소 "Manual 실행 경로 한정, 저작 주체 기준")로 교체. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항/API계약(교차 확인) | 직전 라운드 CRITICAL(`boolean` 타입이 `resolveTriggerParameters` 반환값에만 검사를 적용해 `Boolean('***')===true` 로 마커가 사라지며 완전 우회)이 실제로 해소됐음을 security·requirement·api_contract·maintainability·testing 5개 reviewer 가 각각 소스를 직접 읽어 재확인 — raw 우선 검사 → resolve → resolve 후 재검사의 2단계 순서. `number`/`array`/`object` 타입의 `coerce_failed` 오안내, `defaultValue` 과잉 차단도 함께 해소. | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:55-69` | 조치 불요 — 확인용 기록. |
| 2 | 부작용/API계약(교차 확인) | re-run 경로의 `errors`→`details` 봉투 교정은 breaking change 가 아니라 순수 버그 수정 — `GlobalExceptionFilter` 가 `details`/`nested?.details` 키만 읽고 `errors` 키는 애초에 어떤 분기에서도 읽지 않아, 종전 `errors` 필드는 어떤 클라이언트도 받아본 적이 없는 정보였다. | `codebase/backend/src/modules/executions/executions.service.ts`, `codebase/backend/src/common/filters/http-exception.filter.ts:56-73` | 조치 불요. |
| 3 | 부작용 | `MASKED_MARKERS` 가 module-private 에서 `export const` 로 승격됐지만 여전히 일반 `Set` 인스턴스를 `ReadonlySet<string>` 타입으로만 감싼다 — 런타임 freeze 없음. 타입 우회로 변형되면 egress 마스킹(`isMaskedMarker`)과 재제출 거부(`findMaskedResubmissions`) 두 판정기가 같은 싱글턴을 공유하므로 동시에 오염된다. 현재 diff 안에 직접 소비하는 신규 코드는 없어 즉시 악용 경로는 없음. | `codebase/backend/src/shared/utils/sanitize-error-message.ts:150` | 필수 아님. `Object.freeze(new Set([...]))` 로 감싸는 것을 고려. |
| 4 | 요구사항 | 단일 노드 실행 엔드포인트(`POST /:id/nodes/:nodeId/execute`)는 `resolveTriggerParameters` 계열을 호출하지 않아 이번 가드의 적용 대상 밖 — 이미 존재하는 엔드포인트이고 `body.input` 을 스키마 검증·마스킹 검사 없이 노드 입력에 흘려보내지만, 현재 프런트(`handleRunThisNode`)가 `input` 을 채우지 않아 실제로 왕복할 UI 경로가 없다. | `codebase/backend/src/modules/workflows/workflows.controller.ts:349-435`(`executeNode`) | 조치 불요. 향후 "직전 노드 출력 재사용" 류 UI 가 이 자리에 붙으면 같은 가드를 얹을 것. |
| 5 | 테스트 | 이 기능 전용 e2e(supertest) 없음 — 다만 `GlobalExceptionFilter` 의 `details` forwarding 이 별도 유닛테스트로 이미 확인돼 있어 완전한 공백은 아님. `findMaskedResubmissions`(export 된 함수)에 대한 직접 단위 테스트도 없고 wrapper 를 통한 간접 커버리지만 존재. | `codebase/backend/test/re-run.e2e-spec.ts`, `.../workflow-execution.e2e-spec.ts`, `reject-masked-resubmission.ts:95` | 필수 아님. 여유 있으면 마커 재제출→400 스모크 케이스 1개, `findMaskedResubmissions` 직접 단위 테스트 1개 추가. |
| 6 | 문서화 | `toTriggerParameterErrorDetails` JSDoc 이 `reason` 예시로 여전히 2개만 나열(유니온은 이미 4개) — 전회부터 이어진 비차단 항목, 이번에도 미수정. `workflows.controller.ts` 같은 try/catch 블록에 신규 한국어 주석과 기존 영어 주석 공존. | `trigger-parameter.types.ts:68`, `workflows.controller.ts:314-325` | 필수 아님. |
| 7 | 유저가이드 동반갱신 | `workflows.controller.ts` 가 "백엔드 API 추가·변경" 매트릭스 trigger 에 매칭되나 swagger jsdoc 개별 코드 나열·user-guide 페이지 갱신은 없음 — 실측 결과 정상 GUI 경로로는 이 400 에 도달 불가(`handleRunWithInput` 이 마커 남아있으면 Run 자체를 막음)하고 도달해도 원문 미노출이라 실사용 영향 낮음. `MASKED_VALUE_RESUBMITTED` 는 `backend-labels.ts` `ERROR_KO` 미매핑이나 매트릭스 gate(`error-codes.ts` glob) 밖이고 형제 코드 3종과 동형. | `codebase/backend/src/modules/workflows/workflows.controller.ts:249`, `trigger-parameter.types.ts` | 조치 불요. |
| 8 | 유지보수성 | `throwIfAny` 헬퍼 이름이 무엇을 던지는지 시그니처만으로는 드러나지 않음 — 현재는 파일 내부 비공개 헬퍼로 두 곳에서만 쓰이고 바로 위 주석이 있어 문맥상 문제없음. | `reject-masked-resubmission.ts`(함수 `throwIfAny`, 게이트 71~75) | 필수 아님. 재손질 기회에 `throwIfMaskedResubmissionErrors` 류로 구체화 고려. |
| 9 | 부작용 | 두 기존 엔드포인트(`execute`/`re-run`)의 요청 유효값 집합이 마커 리터럴 3종을 예약어화하며 좁아지는 breaking-narrowing — spec 에 명시(§R17)되고 외부 소비자 부재가 저장소 소유자 확인으로 기록돼 있어 이미 검증 완료. | `reject-masked-resubmission.ts:55-69`, `spec/5-system/14-external-interaction-api.md:1573` | 조치 불요. |
| 10 | 스코프 | 나머지 코드 변경(호출부 2곳, CHANGELOG, 트래커 체크박스, `review/code/2026/08/21/00_03_57/**` 산출물 편입)은 `RESOLUTION.md` 가 서술한 CRITICAL 1 + WARNING 7 항목과 1:1 대응하며 무관한 리팩토링·기능 확장은 없음. | `codebase/backend/src/modules/executions/executions.service.ts:493-503`, `codebase/backend/src/modules/workflows/workflows.controller.ts:311-317` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 직전 CRITICAL(boolean 우회) 해소 확인. 정보 노출·인젝션·시크릿·프로토타입오염 문제 없음. |
| requirement | LOW | `[SPEC-DRIFT]` §6 표 서술 낡음(WARNING) + raw/resolve 부분공개 완전성 이슈(WARNING) + 단일노드 실행 가드 미적용(INFO). |
| scope | MEDIUM | `fix(security)` 커밋이 `spec/` 을 developer 권한 밖에서 직접 수정(WARNING). 나머지 코드 변경은 좁고 명료. |
| side_effect | LOW | `MASKED_MARKERS` 런타임 미동결(INFO), errors→details 비-breaking 확인(INFO), 요청 유효값 집합 narrowing 은 검증 완료(INFO). |
| maintainability | LOW | 신규 `isPlainRecord` 가 기존 `isRecord` 재구현(WARNING). 핵심 구조는 이전 라운드 지적 해소, 가독성 양호. |
| testing | LOW | raw/resolve 부분공개 상호작용 미테스트(WARNING). 캐너리/경계/회귀/통합 스위트 전반 견고. |
| documentation | LOW | 전회 WARNING 2건 해소 확인. sibling 문서 2곳 "재제출 한정" 프레이밍 잔존(WARNING). |
| api_contract | LOW | 직전 CRITICAL·WARNING 해소 확인. errors→details 비-breaking, 신규 코드가 Swagger 드리프트 없음. |
| user_guide_sync | NONE | frontend 변경 0개. API trigger 1건 매칭되나 실사용 영향 실측상 낮음. |

## 발견 없는 에이전트

없음 — 9개 에이전트 전원이 최소 INFO 이상 발견사항을 보고했다(CRITICAL/WARNING 이 없는 에이전트는 security·user_guide_sync 뿐이며 이들도 INFO 는 존재).

## 권장 조치사항

1. **[SPEC-DRIFT, 최우선]** `project-planner` 턴으로 `spec/4-nodes/7-trigger/1-manual-trigger.md:170` 의 "adapter `resolveTriggerParameters` 직후" 서술을 raw-우선+resolve-후 이중검사로 정정 — 방치 시 다음 구현자가 이 문장만 보고 CRITICAL(boolean 완전 우회)을 재도입할 위험.
2. `spec/5-system/3-error-handling.md:193`, `spec/5-system/12-webhook.md:312` 의 "재제출 경로 한정" 프레이밍을 §R17 이 이미 정정한 내용("Manual 실행 경로 전체, 직접 입력한 마커도 거부")과 동기화.
3. `fix(security)` 커밋에서 developer 턴이 `spec/` 을 직접 수정한 건에 대해 사후적으로 SPEC-DRIFT escalation 근거(`plan/in-progress/spec-update-*.md` draft 또는 최소 커밋/RESOLUTION.md 상 사전승인 기록)를 남기고, 재발 방지를 위해 push 가드가 developer 커밋의 `spec/` diff 를 탐지하도록 강화하는 것을 검토.
4. `reject-masked-resubmission.ts` 의 신규 `isPlainRecord` 를 기존 `isRecord`(`to-record.ts`) import 로 교체.
5. raw/resolve 두 단계 검사가 서로 다른 예외로 분리돼 부분 공개되는 상호작용(마스킹 위반 + 무관한 구조 오류 혼재 시 한쪽만 리포트)에 대해 캐너리 테스트를 추가하거나, 최소한 `reject-masked-resubmission.ts` docstring 에 이 캐비엇을 명시.
6. (낮은 우선순위, 선택) `MASKED_MARKERS` 런타임 freeze, 마커 재제출 400 스모크 e2e 1개, `findMaskedResubmissions` 직접 단위 테스트, `toTriggerParameterErrorDetails` JSDoc 예시 갱신 — 여유 있을 때 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(프롬프트에 개별 사유 미제공) — 이번 diff 가 성능 민감 경로(hot loop, N+1 등) 변경이 아니라는 라우터 스코프 판단으로 추정 |
  | architecture | router 판단(프롬프트에 개별 사유 미제공) — 신규 아키텍처 컴포넌트·모듈 경계 변경 없음 |
  | dependency | router 판단(프롬프트에 개별 사유 미제공) — 신규/변경 외부 의존성 없음 |
  | database | router 판단(프롬프트에 개별 사유 미제공) — 스키마/마이그레이션 변경 없음 |
  | concurrency | router 판단(프롬프트에 개별 사유 미제공) — 신규 동시성 프리미티브(락·큐·트랜잭션) 변경 없음 |