# 아키텍처 리뷰 — Manual 실행 경로 마커 재제출 서버측 거부 (EIA §R17)

## 검토 범위

실질 프로덕션 코드(파일 1~11 중 CHANGELOG·spec/plan 문서 제외):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규, "라운드4" 커밋 `54142453c`)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규)

나머지(테스트 스펙·`review/**`·`plan/**`·spec 문서)는 프로덕션 아키텍처 표면이 아니므로 이
관점에서는 참고만 했다. 이전 세 라운드(`00_03_57`/`00_39_27`/`01_15_47`)가 이미 지적·처분한
"두 호출부 판정 로직 복붙"(→ `resolveTriggerParametersRejectingMasked` 로 캡슐화 완료 확인)·
"`isPlainRecord` 가 `isRecord` 재구현"(→ `isRecord` import 로 교체 완료 확인) 은 실코드로
재검증했고 해소돼 있어 재론하지 않는다.

## 발견사항

- **[WARNING]** 신규 아키텍처 가드(`masked-reject-callers` fitness function)의 정규식이 **주석·문자열
  리터럴 안의 "가짜 import 구문"도 실제 import 로 오판**한다 — 이미 자기 자신에게 발생 중이고
  허용목록으로 덮어놓은 상태다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수
    `importsBaseFn` (72~82행, 특히 정규식 정의 79행 `const importBlocks = source.match(/import\s*\{[\s\S]*?\}\s*from/g)`)
    및 동 파일 73행의 JSDoc 예시 주석(`` `import { ..., resolveTriggerParameters, ... } from '...'` ``);
    `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` 58~63행의 테스트
    픽스처 문자열(`"import { resolveTriggerParametersRejectingMasked } from './x';"`,
    `"import { resolveTriggerParameters } from './x';"`)
  - 상세: `importsBaseFn` 은 파일 **전체 텍스트**를 정규식으로 스캔한다 — AST 가 아니라
    "`import { ... } from` 형태의 부분 문자열이 어디에 있든" 매칭한다. 이 파일의 JSDoc 은
    "언급이 아니라 import 만 본다"(61~66행)는 설계 원칙을 설명하려고 그 예시로 정확히
    `import { ..., resolveTriggerParameters, ... } from '...'` 라는 **완전한 import 구문 텍스트를
    주석 안에 그대로 적어 놓았고**, 그 결과 이 가드 파일 자신이 자신의 정규식에 걸린다.
    형제 스펙 파일도 마찬가지로 테스트 픽스처 문자열 안에 완전한 import 구문 텍스트를 담고
    있어 같은 이유로 걸린다. 직접 확인했다:
    ```
    $ node -e "... importsBaseFn(masked-reject-callers-guard.ts 원문) ..."
    guard file importsBaseFn: true
    spec file importsBaseFn: true
    ```
    두 파일 모두 실제로는 `resolveTriggerParameters` 를 **import 하지 않는다**(각 파일
    상단 import 문은 `node:fs`/`node:path`/자매 모듈뿐 — grep 으로 확인). 그런데도
    `ALLOWED_DIRECT_CALLERS`(24~38행)에 두 파일이 이미 등재돼 있고, 주석은 그 이유를
    "이 가드 자신 — 이름을 상수/픽스처로 들고 있다"(35행)로 적어 둔다. 이 설명은 실제
    메커니즘(주석/문자열 안의 **완전한 가짜 import 구문**이 매칭됨)과 다르다 — 단순히
    `BASE_FN = 'resolveTriggerParameters'` 처럼 이름만 문자열로 들고 있는 건 이 정규식을
    통과하지 않는다(`import {...} from` 틀이 없으므로). 이 오판을 실측으로 확인했다:
    현재 `ALLOWED_DIRECT_CALLERS` 에 이 두 파일이 없다면
    `허용목록 밖에서 base 함수를 직접 쓰지 않는다` 테스트가 **이 두 파일을 "위반자"로
    지목하며 RED** 가 된다 — 실제로는 아무 위반도 없는데.

    같은 라운드(`01_38_26`)의 RESOLUTION 이 이 가드를 만드는 과정에서 세 번 자기 결함을
    드러냈다고 기록한다(언급-매칭 과잉 → 한 줄 import 만 매칭해 멀티라인 놓침 → boolean
    단언이 죽은 항목을 숨김). 이번 건은 그 목록에 없는 **네 번째 결함**이다 — "언급이 아니라
    import 만 본다"로 3판에서 좁혔지만, "주석/문자열 안에 적힌 완전한 import 구문 텍스트"는
    여전히 걸러내지 못한다. 지금은 두 파일을 수동으로 허용목록에 얹어 우연히 감춰져 있을
    뿐이다.
  - 영향: 현재 **보안 불변식 자체는 깨지지 않는다** — 이 오탐은 항상 "추가로 잡는" 방향이라
    실제 위반(세 번째 Manual 경로가 base 를 직접 import)을 놓치는 방향으로는 작동하지 않는다.
    다만 두 가지 부작용이 남는다: (1) **죽은 허용목록 항목 캐너리가 무력화**된다 — 이 두 파일이
    나중에 정말로 base import 를 갖다 버려도(예: 리팩터로 이 JSDoc 예시 문구를 지워도) 죽은
    항목 캐너리는 여전히 "정상"이라고 답한다(반대로, 지금은 우연히 참이라 안 걸리지만
    JSDoc 문구 하나만 바뀌어도 뒤집힐 수 있는 **가짜 통과**다). (2) 향후 무관한 파일이
    주석/문서에 "이렇게 하면 안 된다" 는 예시로 `import { resolveTriggerParameters } from ...`
    같은 완전한 구문을 인용하면, 실제 import 가 전혀 없는데도 `findUnexpectedCallers` 가
    그 파일을 위반자로 지목해 **엉뚱한 CI 실패**를 낸다 — 정확히 이 가드의 설계 목적("언급이
    아니라 import 를 본다")이 막으려던 바로 그 실패 모드가 다른 표현형으로 재발한 것이다.
  - 제안: `importsBaseFn` 이 매칭 전에 라인 주석(`//...`)·블록 주석(`/* ... */`)·문자열/템플릿
    리터럴을 먼저 제거하거나 마스킹한 뒤 정규식을 적용한다. 더 견고하게는 TypeScript
    컴파일러 API(`ts.createSourceFile` + `ImportDeclaration` 노드 순회)로 바꿔 주석·문자열을
    구조적으로 배제한다 — 이 저장소는 이미 `typescript` 의존성을 갖고 있어 신규 의존성 없이
    가능하다. 고치고 나면 `ALLOWED_DIRECT_CALLERS` 에서 이 두 파일 항목(및 오해를 유발하는
    "이름을 상수/픽스처로 들고 있다" 주석)을 제거해, 허용목록이 다시 "실제로 base 를 import하는
    파일" 만 담도록 되돌릴 것.

## 요약

핵심 프로덕션 설계는 견고하다 — `resolveTriggerParametersRejectingMasked` 가 raw-우선/resolve-후
2단계 검사 **순서를 함수 하나가 소유**하도록 캡슐화해 이전 라운드가 지적한 두 호출부 판정
로직 복붙을 실제로 해소했고(SRP), `TriggerParameterValidationError.reason` → `REASON_TO_DETAIL`
Record 매핑이 컴파일 타임 exhaustiveness 를 강제해 새 reason 추가 시 매핑 누락을 원천 차단한다
(OCP 에 가까운 닫힌-union+전수 매핑 패턴). webhook·schedule(외부 저작 페이로드)과 Manual
경로(사용자 저작 페이로드)를 같은 유틸 안에서 억지로 통합하지 않고 별도 wrapper 로 분리한
경계도 근거가 명확하다(공유 프리미티브를 넓히면 무관한 경로가 오염된다는 원칙을 실제로
지켰다). 순환 의존성은 없다(`sanitize-error-message.ts` 는 leaf 모듈). 유일한 실질 지적은 이
"불변식을 코드로 강제한다"는 좋은 의도로 새로 만든 repo-guard 자체가, 정확히 그 의도(주석·
문자열의 "언급"과 실제 import 를 가른다)를 완전히 달성하지 못해 **자기 자신에게 오탐을
일으키고 허용목록으로 덮어 둔 상태**라는 점이다(WARNING). 실측(`node -e`, `jest` 실행)으로
재현했고, 현재는 보안 불변식을 약화시키지 않지만 가드의 장기 신뢰성(죽은 항목 탐지·무관한
파일에서의 오탐 방지)을 갉아먹는다. 그 외 레이어 책임·모듈 경계·추상화 수준은 이 diff 범위
안에서 기존 컨벤션과 잘 정합한다.

## 위험도

LOW
