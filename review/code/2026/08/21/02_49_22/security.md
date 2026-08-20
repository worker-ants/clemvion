# 보안(Security) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (Manual 실행 경로 전체)

## 발견사항

- **[WARNING]** CI 가드(`masked-reject-callers-guard.ts`)의 import 탐지 정규식이 named-import
  형태만 잡는다 — namespace import/`require()`로 우회하면 미래의 Manual 경로 호출부가
  마스킹-거부 없는 base 함수(`resolveTriggerParameters`)를 써도 이 가드가 못 잡는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:81`
    (`importsBaseFn` 내부 `const importBlocks = code.match(/import\s*\{[\s\S]*?\}\s*from/g)`)
  - 상세: 이 PR 이 도입한 핵심 보안 불변식은 "Manual 실행 경로는 반드시
    `resolveTriggerParametersRejectingMasked`(wrapper)를 쓰고, base 인
    `resolveTriggerParameters`를 직접 쓰면 안 된다"이며, 이를 코드 리뷰가 아니라 CI 가드로
    강제하려는 의도가 `masked-reject-callers.spec.ts` 헤더 주석에 명시돼 있다("주석은 규칙을
    강제하지 못한다"). 그런데 실제 탐지 로직(`importsBaseFn`)은
    `import\s*\{[\s\S]*?\}\s*from` 패턴, 즉 named-import(`import { resolveTriggerParameters }
    from '...'`) 형태만 인식한다. 다음과 같은 형태는 정규식에 매칭되지 않아 조용히
    허용목록 검사를 통과한다:
    ```ts
    import * as core from '../execution-engine/utils/resolve-trigger-parameters';
    // ...
    const parameters = core.resolveTriggerParameters(schema, rawValues); // 마스킹 거부 없음
    ```
    또는 `const { resolveTriggerParameters } = require('./resolve-trigger-parameters');`
    (CommonJS 상호운용) 형태도 `import ... from` 패턴이 아니므로 마찬가지로 탐지되지 않는다.
    가드 자신의 spec(`masked-reject-callers.spec.ts`)이 "가드가 탐지를 멈춰도 아무도
    모른다"는 문제의식으로 합성 fixture 캐너리까지 만들어 뒀지만, 그 fixture 도
    named-import 형태(`import { resolveTriggerParameters } from './x';`)만 검증하므로 이
    갭 자체는 캐너리로 고정돼 있지 않다. 결과적으로, 이번에 신설된 보안 컨트롤(마커
    재제출 거부)이 세 번째 Manual 경로가 추가될 때 **namespace import 한 줄만으로 조용히
    우회**될 수 있고, 그 우회를 막기 위해 만든 가드조차 그 형태를 놓친다는 점에서
    이중으로 fail-open 이다. 다만 이는 런타임에서 외부 공격자가 직접 트리거할 수 있는
    취약점이 아니라, 향후 내부 개발이 실수로 재도입할 수 있는 회귀를 막는 안전장치의
    완결성 문제다.
  - 제안: import 문 탐지를 named-import 전용에서 `import\s+\*\s+as\s+\w+\s+from` (namespace
    import)까지 확장하거나, `require(...)` 호출 패턴도 함께 스캔한다. 또는 정규식 접근을
    포기하고 `ts.createSourceFile` AST 로 전환해 import declaration 종류(named/namespace/
    default/`require`)를 정확히 분류한다(주석에서 이미 "문법 표면이 좁아 AST 비용이
    이득을 넘는다"고 판단했지만, 그 판단의 전제가 "named-import만 있다"였다면 재검토
    가치가 있다). 최소한 namespace-import 우회 형태를 부정 캐너리(RED 확인)로 추가해
    지금 이 갭이 실재함을 문서화하는 것이 다음 단계로 저렴하다.

## 그 외 검토 — 문제 없음 (긍정적 관찰)

- **인젝션/입력 검증**: `findMaskedResubmissions`/`hasMaskedLeaf`는 순수 값 비교(`===`
  기반 `Array.includes`)와 깊이 상한(`MAX_REDACT_DEPTH=10`)이 있는 재귀 walk 라 인젝션·
  ReDoS·스택 오버플로 표면이 없다. 깊이 5,000 재귀 입력에 대해 예외 없이 처리되는
  회귀 테스트(`reject-masked-resubmission.spec.ts` `[회귀] 매우 깊은 입력...`)가 이를
  기계적으로 확인한다. 검사 순서(raw → resolve)를 강제해 `coerceToType('***','boolean')`
  → `Boolean('***')` → `true` 로 이어지는 이전 CRITICAL(완전 우회)이 재발하지 않도록
  구조적으로 막았다(호출부가 순서를 다시 정할 여지가 없도록 wrapper 함수가 순서를
  소유).
- **에러 처리 / 정보 노출**: `TriggerParameterErrorDetail`(`field`/`code`/`message`)은
  스키마에 정의된 필드명과 고정 메시지만 노출하며, 마스킹된 실제 원본 값이나 서버
  내부 상태를 포함하지 않는다. `executions.service.ts`의 `errors` → `details` 정정은
  기존에 `GlobalExceptionFilter`가 `details`만 읽어 필드별 사유가 응답 밖으로
  버려지던 결함을 고친 것으로, 오히려 사용자에게 필요한 정보를 정확히 노출하는
  방향의 수정이며 민감정보 노출 확대가 아니다(노출 내용이 스키마 필드명·고정
  안내문 수준으로 제한됨을 확인).
- **인가**: `executions.service.ts reRun`/`workflows.controller.ts execute` 양쪽 모두
  이번 diff 는 기존 워크스페이스 격리(404 통일에 의한 ID enumeration 차단)·RBAC(
  `@Roles('editor')`)·타인 실행 owner/admin 검증 로직 앞뒤 흐름을 건드리지 않고, 그
  뒤(파라미터 resolve 단계)에만 개입한다. 인가 우회 표면 없음.
- **범위 분리**: webhook(`hooks.service.ts`)·schedule(`schedule-runner.service.ts`)은
  의도적으로 wrapper 를 쓰지 않고 base 함수를 그대로 쓴다 — 외부 시스템이 저작하는
  임의 페이로드에서 리터럴 `'***'`가 정상 값일 수 있다는 근거가 문서화돼 있고, 이
  판단(마커 거부를 공유 `resolveTriggerParameters` 안에 넣지 않음)은 무관 경로 오염을
  피하는 합리적 설계다.
- **불변성**: `MASKED_MARKERS`가 `ReadonlySet` + `Object.freeze` (플라시보, `.add()`가
  안 막힘)에서 `readonly string[]` + `Object.freeze`(실제 불변, `.push()`가 `TypeError`)로
  교정됐고 이를 캐너리 테스트가 고정한다 — egress 마스킹과 재제출 거부 판정기가 같은
  마커 집합을 공유하므로 이 수정은 두 판정기의 발산(한쪽만 마커가 늘어 다른 쪽이
  fail-open)을 막는 실질적 하드닝이다.
- **하드코딩된 시크릿**: 신규/변경 파일 전체에서 실제 자격증명·키는 없음. 테스트의
  `'sk-live-abc123'`, `'hunter2'` 등은 마스킹 동작 검증용 합성 샘플 문자열이다.
- **의존성**: 이번 diff 는 신규 외부 의존성을 추가하지 않는다.

## 요약

이번 변경은 EIA §R17 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 재제출을 서버측에서
거부하는 방어 계층을 Manual 실행 경로(재실행 + `POST /workflows/:id/execute`) 전체에
적용한 것으로, 이전 라운드에서 지적된 CRITICAL 급 우회(coerce 이후에만 검사해 boolean
타입에서 마커가 `true` 로 사라지는 완전 우회)를 raw-우선·2단계 검사 구조로 구조적으로
차단했고, 정확-일치 판정·깊이 상한 일치·JSON 문자열 경로까지 경계 테스트로 촘촘히
검증돼 있다. 인가·인젝션·정보노출 관점에서 새로 열리는 취약점은 발견되지 않았다.
유일한 지적 사항은 이 컨트롤의 회귀를 막기 위해 만든 CI 가드(`masked-reject-callers-guard.ts`)
자체의 import 탐지가 named-import 형태로 좁아, namespace import/`require()` 로 우회하면
향후 새 Manual 경로가 마스킹 거부 없이 조용히 추가될 수 있다는 완결성 갭이다 — 이는
현재 시점에 악용 가능한 런타임 취약점이 아니라 안전장치 자체의 커버리지 문제다.

## 위험도

LOW
