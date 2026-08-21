# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (최종 라운드, `02_29_01`)

## 검토 범위 및 사전 확인

이 브랜치는 이미 5라운드(`00_03_57`→CRITICAL 1 fix, `00_39_27`→WARNING 다수 fix,
`01_15_47`→0/0 수렴, `01_38_26`→WARNING 1(repo-guard 부재) fix, `02_04_38`→WARNING 3(가드
자체 결함 3종: freeze 플라시보·주석 오판·탐지 무보증) fix)에 걸쳐 테스트 관점 리뷰가
수행됐다. 이번 라운드는 그 최종 상태를 `Read` 로 실제 파일 8개(`reject-masked-resubmission.ts`/
`.spec.ts`, `executions.service.ts`, `executions-rerun.service.spec.ts`,
`workflows.controller.ts`/`.spec.ts`, `trigger-parameter.types.ts`,
`sanitize-error-message.ts`/`.spec.ts`, `masked-reject-callers-guard.ts`/`.spec.ts`) 전문
열람해 독립적으로 재검증했다. 이전 라운드 RESOLUTION 을 대조해 지적된 WARNING 이 실제로
코드에 반영됐는지 직접 확인했다(예: `02_04_38` W3 → `MASKED_MARKERS` 가 실제로
`readonly string[]` + `Object.freeze` 로 바뀌어 있고 캐너리가 `Object.isFrozen`/`push`
`TypeError` 를 단언함을 확인; `02_04_38` W2 → `masked-reject-callers.spec.ts` 에 합성
fixture 로 실제 위반을 지목하는 캐너리가 존재함을 확인).

## 발견사항

- **[INFO]** back-compat `input.parameters` 경로로 들어온 마스킹 마커 재제출을 확인하는
  컨트롤러 테스트가 없다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`rawValues` 산출부,
    `execute` 메서드 — `body?.parameterValues ?? (body?.input... ) ?? {}` 뒤에
    `resolveTriggerParametersRejectingMasked(schema, rawValues)` 호출); 대응 spec
    `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` 신규 캐너리 3건
    (130행 `parameterValues 에 마스킹 마커가 실리면...`, 161행 `중첩 object...`, 180행
    `마커를 포함만 하는 값은...`)은 전부 `parameterValues` 필드만 쓰고, 같은 파일 227행의
    `falls back to input.parameters when parameterValues is absent` 는 마스킹과 무관한 값만
    다룬다.
  - 상세: 구현은 `rawValues` 를 두 소스(`parameterValues` 우선, 없으면 legacy
    `input.parameters`) 중 하나로 채운 뒤 **같은 변수**를 거부 함수에 넘기므로 두 경로가
    실제로 같은 코드를 타 실행 위험은 낮다. 그러나 이 사실 자체를 검증하는 테스트가 없다 —
    누군가 두 소스를 합치는 로직(예: `??` 대신 `??=` 로 병합, 또는 두 값을 merge)으로
    리팩터링하면서 실수로 마스킹 검사보다 **뒤에** legacy 병합을 두면(현재는 `rawValues` 계산이
    검사보다 항상 먼저이므로 그럴 수 없지만, 순서 보장이 코드 구조가 아니라 개발자의 주의에
    의존) legacy 경로로 들어온 마커가 새지 않는다는 보장이 테스트로 고정돼 있지 않다.
  - 제안: 필수는 아님. `it('[캐너리] input.parameters(legacy) 경로로 온 마스킹 마커도 거부한다', ...)`
    1건을 `parameterValues` 대신 `input: { parameters: { apiKey: '***' } }` 로 추가하면
    두 진입 경로 모두가 같은 방어를 받는다는 사실이 코드 구조가 아니라 테스트로 고정된다.

- **[INFO]** `REASON_TO_DETAIL` 의 `masked_value_resubmitted` 매핑(`code`/`message` 리터럴)을
  직접 겨냥하는 단위 테스트가 `toTriggerParameterErrorDetails` 자체의 spec 에는 없다 — 두
  호출부의 통합 테스트로만 간접 커버됨
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    함수 `toTriggerParameterErrorDetails`(74~81행) / `REASON_TO_DETAIL.masked_value_resubmitted`
    (59~62행); 대응 spec `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts`
    160~189행 `describe('toTriggerParameterErrorDetails', ...)` 는 `missing_required`/
    `coerce_failed`/`invalid_schema` 세 항목만 단언하고 신규 `masked_value_resubmitted` 는
    이 describe 블록에 추가되지 않았다(grep 재확인 — 이 파일에 `masked_value_resubmitted`
    문자열 0건).
  - 상세: `REASON_TO_DETAIL` 이 `Record<reason, ...>` 로 닫혀 있어 **매핑 누락**은 컴파일
    타임에 잡히지만(이전 라운드 architecture/testing 리뷰가 이미 확인한 안전판), 매핑
    **값**(`code: 'MASKED_VALUE_RESUBMITTED'`, `message: '...'`)이 오타 나거나 다른 reason 의
    값과 뒤바뀌는 것은 타입 시스템이 못 잡는다. 현재는 `workflows.controller.spec.ts`(130행)와
    `executions-rerun.service.spec.ts`(394행 `[회귀] 거부 응답이 details[] 로...`) 두 통합
    테스트가 각각 `response.details`/`body.details` 를 통해 정확한 `code` 값을 단언하고 있어
    **실질적으로는 커버돼 있다** — 다만 이 매핑 함수 자체의 spec 파일에는 반영되지 않아,
    이 파일만 보고 "새 reason 추가 시 이 describe 도 갱신해야 한다"는 관례가 깨질 여지가 있다.
  - 제안: 필수 아님(통합 테스트가 실질 커버리지를 제공). 다음에 `resolve-trigger-parameters.spec.ts`
    를 손댈 기회에 `masked_value_resubmitted` 케이스 한 줄을 그 describe 블록에 추가하면
    "매핑 함수 자체의 spec 이 4항목 전부를 안다"는 완결성이 생긴다.

- **[INFO]** (이월 재확인, `02_04_38` testing.md 에서 이미 등재 후 의도적 미조치) 두 항목이
  여전히 유효하다 — `findMaskedResubmissions` 의 `rawSource` 가 **배열 자체**인 경우(레코드가
  아님 판정 분기)를 직접 겨냥하는 케이스, webhook/schedule 카브아웃 경계("마커 리터럴이 정상
  값으로 통과한다")를 직접 겨냥하는 행위 테스트
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    121행 `if (!isRecord(rawSource) || !isRecord(values)) return [];` — 대응 spec
    `reject-masked-resubmission.spec.ts` 313~316행 `null·비객체 raw 를 안전하게 지나간다`는
    `null`/문자열만 다루고 배열(`['***']`) 케이스는 없음(재확인, grep); 및
    `codebase/backend/src/modules/hooks/hooks.service.spec.ts`,
    `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts` 에
    `VALUE_MASK_MARKER`/`'***'` 트리거 파라미터 케이스 없음(재확인 — `schedule-runner.service.spec.ts`
    의 유일한 `'***'` 매치는 328행 egress 마스킹 이메일 본문 검사로 이 기능과 무관).
  - 상세: `02_04_38` RESOLUTION 이 "필수 아님, 다음 기회에" 로 명시적으로 처분을 미룬
    항목이며 이번 라운드에서도 코드가 바뀌지 않아 그대로 유효하다. 실질 위험은 낮다 — 전자는
    `isRecord` 가 `Array.isArray` 를 명시적으로 배제하는 기존 유틸(`to-record.ts`)을 그대로
    재사용해 동작 자체는 명확하고, 후자는 정적 repo-guard(allowlist)로 이미 경계가 고정돼
    있어 행위 테스트 부재가 실제 우회를 허용하지 않는다.
  - 제안: 조치 불요(이전 처분 유지). 재지적 아님 — 상태 변화 없음을 확인하는 목적의 이월.

## 관점별 평가

1. **테스트 존재 여부** — 신규 프로덕션 코드 전부(`reject-masked-resubmission.ts` 신규
   함수 3개, `trigger-parameter.types.ts` 신규 enum 값, 두 호출부 통합, repo-guard 신규
   2파일, `sanitize-error-message.ts` export 승격)에 대응 테스트가 존재한다. 갭 없음.
2. **커버리지 갭** — 핵심 로직(`hasMaskedLeaf`/`findMaskedResubmissions`/
   `resolveTriggerParametersRejectingMasked`)은 스칼라·타입별 우회·JSON-문자열 중첩·
   defaultValue 과잉차단 방지·phase 경계까지 촘촘하다. 남은 갭은 전부 위 INFO 4건(신규 2 +
   이월 2)이며 전부 저위험 — 실행 경로가 이미 같은 코드로 수렴하거나(legacy input.parameters)
   정적 가드로 이미 고정돼(webhook/schedule) 있다.
3. **엣지 케이스 테스트** — 깊이 상한 정확히 그 자리(`MAX_REDACT_DEPTH`)·상한+1·object↔array
   혼합 중첩·스택 안전성(depth 5000)·정확 일치 대 부분 포함(`a***b`)까지 이름 붙은
   `[경계]`/`[캐너리]` 태그로 명시적으로 다룬다. `null`/비객체 raw 도 다루나 배열 raw 는
   위 이월 INFO 로 남아 있다.
4. **Mock 적절성** — `executions-rerun.service.spec.ts`/`workflows.controller.spec.ts` 는
   리포지토리·엔진을 얕은 jest mock 으로 대체하되 실제 서비스/컨트롤러 인스턴스를 그대로
   생성해 통합 성격을 유지한다. `reject-masked-resubmission.spec.ts` 는 mock 없이 순수
   함수를 직접 호출하고, 왕복 통합 테스트(239행)는 실제 `deepRedactSecrets` 마스커 산출물을
   그대로 판정기에 먹여 모델(`nestObj`/`nestArr`)과 실제 마스커 구현 사이의 괴리를 좁힌다 —
   mock 모델링에 의존하지 않고 실동작을 검증하는 좋은 패턴. repo-guard spec 은 실제
   파일시스템을 read-only 로 스캔해 mock 자체가 없다.
5. **테스트 격리** — 세 신규 spec 파일 모두 `beforeEach` 재생성(controller/service) 또는
   순수 함수 호출이라 테스트 간 공유 상태가 없다. `masked-reject-callers.spec.ts` 의 합성
   fixture 테스트는 `fs.mkdtempSync` 로 임시 디렉터리를 만들고 `finally` 블록에서
   `fs.rmSync(..., { recursive: true, force: true })` 로 확실히 정리해 실행 순서·재실행에도
   잔여물을 남기지 않는다.
6. **테스트 가독성** — `[캐너리]`/`[경계]`/`[회귀]`/`[통합]` 태그 + 각 테스트 상단 docstring 이
   "이 테스트가 없으면 어떤 결함이 재발하는가"(라운드 번호·구체적 우회 시나리오)를 명시해
   의도가 코드만으로 드러난다. `masked-reject-callers.spec.ts` 의 탐지-무보증 캐너리는 왜
   "위반 없음" 테스트만으로는 부족한지 그 자체를 docstring 에서 설명한다.
7. **회귀 테스트** — boolean coerce 완전 우회·number coerce_failed 안내 오선점·defaultValue
   과잉차단·`errors`→`details` 봉투 드리프트·chain-depth 비배열 응답 우회 등 이 시리즈가
   실제로 겪은 결함 클래스마다 이름 붙은 회귀 테스트가 있다. `masked-reject-callers` 가드
   자체의 두 자기결함(주석 오판·탐지 무보증)도 각각 `stripCommentsAndStrings` 전처리 +
   합성 fixture 캐너리로 고정됐다.
8. **테스트 용이성** — `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions` 는
   순수 함수(스키마·raw·resolved 를 인자로 받음)라 mock 없이 직접 호출 가능. `findUnexpectedCallers(repoRoot, srcDir)`
   가 경로를 인자로 받는 구조라 임시 디렉터리 fixture 테스트를 낮은 비용으로 추가할 수 있었다
   (실제로 `02_04_38` 라운드에서 그렇게 추가됨).

## 요약

5라운드에 걸친 반복 리뷰로 CRITICAL 1건·WARNING 다수(가드 자체의 자기결함 3종 포함)가
모두 수정으로 수렴했고, 이번 최종 라운드에서 실제 파일을 직접 열람해 그 수정이 코드에
반영돼 있음을 독립적으로 재확인했다 — 새로운 CRITICAL/WARNING 은 발견되지 않았다. 핵심
판정 로직은 이 기능이 실제로 겪은 모든 우회 시나리오(타입별 coerce 우회·JSON-문자열 중첩·
깊이 경계·과잉 차단)를 이름 붙은 캐너리/경계/회귀 테스트로 촘촘히 덮고, repo-guard 는
"위반이 없다"뿐 아니라 "위반을 실제로 탐지한다"는 양성 케이스까지 합성 fixture 로
고정해(뮤테이션 검증 완료) 정적 방어 자체의 신뢰도를 갖췄다. 이번 라운드에서 새로 확인한
갭은 둘 다 INFO 수준이다 — (1) legacy `input.parameters` 경로의 마스킹 거부를 직접 겨냥하는
컨트롤러 캐너리 부재(코드 구조상 같은 검사를 타므로 실질 위험 낮음), (2)
`toTriggerParameterErrorDetails` 매핑 함수 자체의 spec 에 신규 reason 값이 반영되지 않음
(통합 테스트 2건이 실질적으로 그 값을 이미 단언하므로 커버리지 공백이라기보다 관례상 아쉬움).
이월된 INFO 2건(rawSource 가 배열인 경우 미테스트, webhook/schedule 카브아웃의 행위 테스트
부재)은 상태 변화 없이 여전히 유효하지만 5라운드 전부터 저위험으로 판정돼 의도적으로 미조치
처분된 항목이다.

## 위험도

LOW
