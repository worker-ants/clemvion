# 보안(Security) 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17, 라운드8)

## 검토 범위

이번 라운드(`03_14_16`)는 8라운드째 반복 리뷰로, 실질 프로덕션 코드는 이전 라운드들에서
이미 여러 차례 검증됐다. 이번엔 직접 소스를 읽어 최신 상태를 재검증했다:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (핵심 로직)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts`
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (re-run 호출부)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (execute 호출부)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`MASKED_MARKERS`/`isMaskedMarker` export 승격)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` +
  `masked-reject-callers.spec.ts` (신규 — base 함수 직접 호출 허용목록 가드)
- `codebase/backend/src/common/filters/http-exception.filter.ts` (`details` 배선 대조용)

나머지(CHANGELOG·plan·spec·이전 라운드 review 산출물)는 코드 실행 경로가 아니라 보안
관점 재검토 대상에서 제외했다(내용은 코드 사실과 대조해 불일치 없음 확인).

## 발견사항

- **[WARNING]** `masked-reject-callers-guard.ts` 의 `importsBaseFn` — 3라운드째 정규식 스캔의
  자기 결함이 드러났고, 이번에 무수정 프로브로 **추가 우회 형태 셋**을 실측했다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수
    `importsBaseFn` (게이트 86~107)
  - 상세: 이 가드는 `resolveTriggerParameters`(마커를 거부하지 않는 base 함수)를 허용목록
    밖에서 직접 import 하는 파일을 CI 에서 잡아, 향후 세 번째 Manual 실행 경로가 실수로
    (또는 부주의하게) 마커 거부를 우회하지 못하게 하는 **2차 방어층**이다. 직전 라운드
    (`995c44c97`, "라운드7 처분")가 named/namespace/`require()` 세 형태를 캐너리로 고정했지만,
    실제로 `importsBaseFn` 을 대상 함수로 직접 호출해 프로브하니 다음 세 형태가 여전히
    조용히 통과(미탐지)했다:

    | 형태 | 결과 |
    |---|---|
    | `const { resolveTriggerParameters } = await import('./resolve-trigger-parameters');` (동적 import + 구조분해) | **미탐지** |
    | `base['resolveTriggerParameters'](s, r)` (bracket 멤버 접근) | **미탐지** |
    | `const { resolveTriggerParameters: rtp } = require('./x');` (require + 콜론 리네임) | **미탐지** |

    (참고로 `const mod = await import(...); mod.resolveTriggerParameters(...)` 처럼 동적
    import 뒤 **점(dot) 멤버 접근**을 쓰는 형태는 기존 ③ 패턴이 정상 탐지한다 — 문제는
    구조분해·bracket·콜론 리네임 세 조합이다.)

    이 저장소에 `await import(...)` 와 `require(...)` 패턴 자체는 이미 존재한다
    (`common/utils/ssrf-safe-url.util.ts`, `main.ts`, `knowledge-base/parsers/pdf.parser.ts`) —
    가정이 아니라 이 팀이 실제로 쓰는 관용구다. 세 번째 Manual 경로가 저 형태로 base 를
    부르면 이 가드는 GREEN 을 내면서 마커 재제출을 못 잡는다. `masked-reject-callers.spec.ts`
    자체가 "우회 가능한 가드는 없느니만 못하다 — 있다고 믿게 만든다" 를 반복해 명문화하고
    있으므로, 그 기준을 이번 세 형태에도 적용해야 한다.

    영향 범위를 정확히 하면: 이 가드가 뚫려도 **오늘 존재하는 코드는 안전**하다 —
    `resolveTriggerParametersRejectingMasked` 자체(런타임 실제 방어)는 이 가드와 무관하게
    두 호출부에서 이미 올바르게 동작하고, 두 호출부 모두 base 를 직접 쓰지 않는다. 노출되는
    것은 **미래의 회귀를 막는 CI 안전망의 커버리지 갭**이다. 또한 이 시리즈의 원 동기가
    CHANGELOG 에 "이유는 보안이 아니라 데이터 무결성" 이라 명시돼 있어(egress 마스킹 마커가
    새 실행의 실제 입력값이 되는 것을 막는 것), 회귀 시 파급도 자격증명 유출이 아니라
    자격증명 필드가 리터럴 `***` 로 조용히 덮어써지는 무결성 사고다. 그럼에도 CRITICAL 이
    아니라 WARNING 인 이유는 (1) 오늘 즉시 악용 가능한 경로가 없고, (2) 정적 스캔 가드
    자체가 이미 자기 파일 docstring 에서 "AST 파서가 더 정확하지만 비용이 이득을 넘는다"
    는 트레이드오프를 의식적으로 선언했기 때문이다 — 다만 이번 라운드까지 포함해 **3라운드
    연속 같은 클래스의 결함**(언급/import 혼동 → 탐지 능력 무보증 → 우회 형태)이 나온 것은
    "정규식으로 한 형태씩 못박는" 전략 자체의 수확체감을 보여준다.
  - 제안: 이번 세 형태도 `it.each` 캐너리로 고정하거나(형태별 실패 메시지 유지),
    근본적으로는 `ts.createSourceFile`(TypeScript 컴파일러 API) 기반 AST 스캔으로 전환을
    고려할 것. 이 저장소가 판정하는 대상(누가 어떤 이름을 어떤 형태로 import/참조하는가)은
    정규식이 아니라 파서가 정확히 답할 수 있는 질문이고, 매 라운드 새 정규식 우회가
    발견되는 패턴이 그 신호다. AST 로 바꾸면 destructure-rename·bracket-access·dynamic
    import 를 형태별로 개별 못박을 필요 없이 한 번에 닫힌다.

- **[INFO]** 핵심 런타임 방어(`resolveTriggerParametersRejectingMasked`)는 재검증 결과 견고함을
  확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
  - 상세: raw 우선 검사(①) → resolve(②) 순서가 boolean 완전 우회(`Boolean('***')===true`)를
    막고, 값 검사가 깊이 검사보다 먼저라 `MAX_REDACT_DEPTH` 경계에 놓인 치환 마커를 놓치지
    않으며, 정확 일치만 보아 `a***b` 같은 정상 값을 과잉 차단하지 않는다. 두 실제 호출부
    (`executions.service.ts:499`, `workflows.controller.ts:317`)가 모두 `resolveTriggerParameters`
    가 아니라 이 wrapper 를 쓰는 것을 실코드로 확인했다. webhook/schedule 은 의도적으로
    제외돼 있고 그 사유(외부 시스템 저작 페이로드)가 `ALLOWED_DIRECT_CALLERS` 주석에 명시돼
    있다.
- **[INFO]** 에러 응답은 실제 제출 값을 echo 하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    (`TriggerParameterErrorDetail`/`REASON_TO_DETAIL`)
  - 상세: `details[]` 에는 `field`(스키마 정의 파라미터명)·`code`(고정 enum)·`message`(고정
    문자열)만 실리고 마스킹 마커든 원문이든 실제 값은 어디에도 노출되지 않는다.
- **[INFO]** re-run 경로의 선존 결함(`errors` 키로 던져 `GlobalExceptionFilter` 가 조용히
  버리던 것)이 `details` 로 교정된 것을 필터 실코드(`http-exception.filter.ts:73`,
  `details = resp.details ?? nested?.details;` — `errors` 키는 어디서도 읽지 않음)로 대조해
  확인. 이 교정 자체는 분류 정보만 노출하므로 새로운 정보 노출을 만들지 않는다.
- **[INFO]** `MASKED_MARKERS` 런타임 불변성 — `Set`+`ReadonlySet` 플라시보(5라운드 전 지적)가
  `readonly string[]` + `Object.freeze` 로 교정되고 캐너리(`sanitize-error-message.spec.ts`
  "MASKED_MARKERS 불변성")가 `Object.isFrozen` 과 `.push()` 예외를 실측 확인하는 것을 재검증.
  egress 마스킹(`isMaskedMarker`)과 재제출 거부(`findMaskedResubmissions`)가 이 상수 하나를
  공유하는 설계이므로, 실제 불변성 확보는 두 판정기의 SoT 무결성에 직결된다.

## 요약

핵심 런타임 방어(`resolveTriggerParametersRejectingMasked`, 두 Manual 실행 진입점)는 이전
라운드들이 CRITICAL(boolean 완전 우회)까지 포함해 반복 검증하며 견고해졌고, 이번 재검증에서도
값-우선 검사 순서·정확 일치·깊이 상한 처리·에러 값 비노출이 실코드와 일치함을 확인했다.
새로 발견한 것은 그 방어를 지키는 **2차 CI 안전망**(`masked-reject-callers-guard.ts`)이
정규식 기반이라 이번에도(3라운드 연속) 새로운 문법 형태(동적 import 구조분해·bracket 멤버
접근·require 콜론 리네임)에서 조용히 통과했다는 점이다 — 오늘 코드에 실제 악용 경로는 없지만,
이 가드가 막으려는 정확히 그 종류의 미래 회귀(세 번째 Manual 경로가 마커 거부 없이 base 를
직접 호출)를 못 잡을 수 있다. 그 외 하드코딩 시크릿·인젝션·인증/인가 우회·안전하지 않은
암호화 관련 문제는 발견되지 않았다.

## 위험도

LOW
