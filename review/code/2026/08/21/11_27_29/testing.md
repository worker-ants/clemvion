# 테스트(Testing) 리뷰 — masked-marker-contract 패키지 추출

## 검증 방법

프롬프트가 크기 제한으로 잘려서 실린 파일 대부분을 `Read`로 직접 열람했고, 다음 테스트 스위트를
실제로 실행해 GREEN/RED 를 확인했다(전부 GREEN):

- `codebase/packages/masked-markers` `pnpm test` (jest, 17 passed)
- `codebase/packages/masked-markers` `pnpm lint` (eslint, 통과)
- frontend vitest: `masked-marker-mirror.test.ts` · `masked-markers.test.ts` ·
  `dynamic-form-ui.test.tsx` · `internal-package-registration.test.ts` (도합 107 passed)
- backend jest: `sanitize-error-message.spec.ts` (69 passed)

추가로 `findRedeclaredSymbols`에 접두/접미 변형 식별자(`MAX_MASK_DEPTH_OLD`,
`MY_MAX_MASK_DEPTH`, `MASKED_MARKERS_HELPER`)를 넣는 임시 프로브 테스트(scratch, 리뷰 종료 후
삭제·`git status` 로 잔존 없음 확인)를 돌려 오탐 여부를 실측했다 — 정상적으로 오탐 없음을
확인했다(아래 INFO 참조, 실제 결함 아님).

## 발견사항

- **[WARNING]** 신규 SoT 패키지(`@workflow/masked-markers`) 자신의 스펙이 마커 **리터럴 값**을
  직접 고정하지 않는다 — 값 오염을 잡는 캐너리가 하류 소비처 테스트에만 있다
  - 위치: `codebase/packages/masked-markers/src/__tests__/index.spec.ts` (파일 전체, 특히
    "마커 세 개가 집합을 이룬다" 테스트, 함수명 기준 — L15-22 근방)
  - 상세: 이 스위트는 `expect([...MASKED_MARKERS]).toEqual([VALUE_MASK_MARKER, KEY_MASK_MARKER,
    DEPTH_MASK_MARKER])` 식으로 **패키지가 export 하는 상수끼리의 내부 정합성**만 검사한다.
    `VALUE_MASK_MARKER`(`'***'`)·`KEY_MASK_MARKER`(`'[REDACTED]'`)·`DEPTH_MASK_MARKER`
    (`'[REDACTED_DEPTH]'`) 자체가 실수로 바뀌어도(예: 리팩터 중 `'***'`→`'####'`) 이 자기참조적
    비교는 여전히 GREEN 이다. 실제로 이 파일 안에는 리터럴 값을 직접 pin 하는 assertion이 없다.
    현재는 `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts`(L36-44)와
    `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts`(L26-32)가 각각
    `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 리터럴을 하드코딩해 실측 GREEN 을 확인했으므로
    **지금 당장은** 값 드리프트가 두 소비처 스위트에서 잡힌다. 다만 이 두 파일은 하위호환을 위해
    남긴 재export shim 의 테스트일 뿐이고, 정의 자체의 회귀 방어를 소비처 두 곳의 "우연히 아직
    남아있는" 리터럴 비교에 의존하는 구조다 — SoT 패키지의 존재 이유(README:"단일 진실")를
    생각하면 이 방어는 패키지 자신의 스펙 안에 있어야 값 드리프트를 그 소스에서 즉시 잡는다.
  - 제안: `index.spec.ts`에 `expect(VALUE_MASK_MARKER).toBe('***')` /
    `expect(KEY_MASK_MARKER).toBe('[REDACTED]')` /
    `expect(DEPTH_MASK_MARKER).toBe('[REDACTED_DEPTH]')` 같은 리터럴 pin 을 한 줄씩 추가한다.
    README 의 표(`| VALUE_MASK_MARKER | '***' | ... |`)를 그대로 옮기면 된다.

- **[INFO]** `findRedeclaredSymbols` 의 "정확 식별자 일치" 경계(접두/접미 변형 오탐 방지)가
  테스트로 고정돼 있지 않다 — 구현은 정확하나(실측 확인, 아래) 회귀 방어가 없다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 의
    `findRedeclaredSymbols` 함수, 소비 스펙 `masked-marker-mirror.test.ts` "정상 형태를
    오탐하지 않는다" `it.each` 블록(함수명 기준 — 파일 끝부분)
  - 상세: 현재 오탐-방지 fixture 목록(재export·import 후 재export·지역 별칭·주석·문자열·무관
    리터럴)에는 "SOT_SYMBOLS 이름을 **부분 문자열로 포함**하지만 실제로는 다른 식별자"인 경우
    (예: `const MAX_MASK_DEPTH_OLD = 5;`, `function MASKED_MARKERS_HELPER() {}`)가 없다. 리뷰
    중 임시 프로브로 실측한 결과 구현 자체는 `ts.isIdentifier(name) && SOT_SYMBOLS.includes(name.text)`
    로 **완전 일치**만 보므로 정상 동작하지만(오탐 없음 확인), 이 경계는 값싼 사전 필터
    (`source.includes(s)`, L86 근방)가 부분 문자열 포함 여부로만 판정하기 때문에 향후 그 필터
    로직을 손대는 리팩터가 있으면 조용히 깨질 수 있는 자리다. 지금은 캐너리가 없어 그런 회귀를
    잡지 못한다.
  - 제안: `it.each` 오탐 방지 목록에 `["부분 문자열 포함 식별자", "const MAX_MASK_DEPTH_OLD = 5;"]`
    같은 케이스를 한 줄 추가하면 이 경계가 명시적으로 고정된다.

- **[INFO]** backend `deepRedactSecrets` 의 깊이 상한 회귀 테스트가 "안 던진다"만 확인하고
  정확한 경계(depth 10 vs 11)는 검사하지 않는다 — 이번 PR 로 새로 생긴 결함은 아니지만, 상한 값이
  이제 다른 패키지(`@workflow/masked-markers`)에서 온다는 점에서 실효성이 낮아졌다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 의
    `'caps recursion depth (deep nesting is masked wholesale, no stack blowup)'` 테스트
    (함수명 기준, `deepRedactSecrets` describe 블록 내)
  - 상세: 이 테스트는 25단계로 중첩한 뒤 `expect(() => deepRedactSecrets(deep)).not.toThrow()`
    만 단언한다 — 프런트(`masked-markers.test.ts`)가 갖고 있는 "정확히 depth 10 은 검사되고
    depth 11 은 무시된다" 식의 경계 테스트가 backend 쪽에는 없다. 만약 `MAX_MASK_DEPTH`(패키지)
    값이 실수로 바뀌거나(예: `10`→`3`) `MAX_REDACT_DEPTH = MAX_MASK_DEPTH` 별칭 배선이 깨지면,
    이 backend 테스트는 여전히 GREEN 인 채로 통과한다 — "던지지 않는다"는 상한이 0이어도 참이기
    때문이다. 이 갭은 이번 PR 이전부터 있었지만(`MAX_REDACT_DEPTH = 10` 리터럴 시절에도 동일),
    이제 그 값이 크로스패키지 배선을 거치므로 배선 실수를 잡을 확률이 조금 더 중요해졌다.
  - 제안: 프런트 `masked-markers.test.ts` L91-97 패턴(`nest(10, ...)` → true / `nest(11, ...)`
    → false)을 backend 쪽에도 대칭으로 추가해, `MAX_REDACT_DEPTH` 별칭 배선이 깨졌을 때 즉시
    RED 가 나도록 한다. (이 PR 범위 밖으로 미뤄도 무방 — CRITICAL 아님.)

## 확인했으나 문제 없음 (재확인 낭비 방지용 기록)

- `codebase/frontend/src/lib/utils/masked-markers.ts`가 `MASKED_MARKERS`를 `ReadonlySet<string>`
  (Set)에서 패키지의 `readonly string[]`(배열)로 바꿨는데, 저장소 전체에서 이 상수를 소비하는
  두 곳(`dynamic-form-ui.test.tsx:601`, `masked-markers.test.ts:27,34`)이 전부
  `[...MASKED_MARKERS]`(spread, iterable 이면 Set/Array 무관하게 동작)만 쓰고 있어 타입 변경으로
  인한 회귀가 없음을 실측(grep 전수 + 테스트 실행 GREEN)으로 확인했다. `.has()` 같은 Set 전용
  메서드를 직접 호출하는 소비처는 없다.
- `codebase/packages/masked-markers/package.json`의 `prepare` 스크립트(node -e 인라인)는
  `@workflow/ai-end-reason/package.json`의 기존 스크립트를 문자 그대로 복제한 검증된 선례이며,
  이 PR 이 새로 도입한 미검증 패턴이 아니다.
- `.claude/test-stages.sh`의 `INTERNAL_PACKAGES`에 신규 패키지가 등록됐고, `_run_internal test`
  경로로 `pnpm --filter @workflow/masked-markers test`가 실제 CI 파이프라인에 배선됨을 확인했다
  (`cmd_lint`/`cmd_unit`/`cmd_build` 세 스테이지 모두 `_run_internal`을 거쳐 lint/test/build가
  자동으로 걸린다).
- 신규 가드 테스트(`masked-marker-mirror.test.ts`)는 `fs.mkdtempSync(os.tmpdir())` +
  `finally`의 `fs.rmSync`로 임시 디렉터리를 만들고 정리한다 — 저장소 트리를 뮤테이션하지 않고
  테스트 간 격리가 보장된다. vacuous-방지 캐너리(스캔 파일 수 하한)·탐지력 캐너리(합성 fixture로
  실제 탐지 확인)·오탐 방지 캐너리(정상 형태 6종) 세 축을 모두 갖춘 설계로, 이 계열 가드가
  반복해 겪은 "GREEN 인데 아무것도 안 본다" 실패 형태를 이미 선제적으로 방어하고 있다.
- backend `sanitize-error-message.spec.ts`의 `MASKED_MARKERS` 불변성 캐너리(L27-45)는 이제
  재export된 값(패키지의 `Object.freeze(array)`)을 테스트하는 형태로 바뀌었지만, 여전히 유효한
  회귀 방어다 — 패키지가 다시 `Set`으로 퇴행하거나 freeze 를 빠뜨리면 여기서도 RED 가 난다(패키지
  자신의 `index.spec.ts`와 중복이지만 하위호환 shim 계층에서의 이중 방어로 무해하다).

## 요약

이번 변경은 `@workflow/masked-markers` 공유 패키지 추출이라는 순수 리팩터(동작 무변경 목표)이며,
새로 추가된 두 테스트 스위트 — 패키지 자신의 `index.spec.ts`와 프런트 미러 소멸 가드
(`masked-marker-mirror.test.ts`/`-guard.ts`) — 모두 실제로 실행해 GREEN 을 확인했고, 설계
자체도 이 시리즈가 반복 학습한 "vacuous 테스트 3형태" 방어(하한 캐너리·탐지력 캐너리·오탐 방지
캐너리)를 갖추고 있어 품질이 높다. 기존 backend/frontend 스펙(`sanitize-error-message.spec.ts`,
`masked-markers.test.ts`, `dynamic-form-ui.test.tsx`, `internal-package-registration.test.ts`)도
전부 재실행해 회귀 없음을 확인했다. 다만 SoT 패키지 자신의 스펙이 마커 **리터럴 값**을 직접
고정하지 않고 하류 소비처의 우연한 리터럴 비교에 의존하는 구조적 갭이 하나 있어 WARNING 으로
남긴다(수정 비용은 세 줄). 나머지 두 건은 INFO 성격의 엣지케이스 커버리지 보강 여지다 — 하나는
실측으로 결함이 아님을 확인한 "부분 문자열 식별자" 경계의 회귀 캐너리 부재, 다른 하나는 이번
PR 이전부터 있던 backend 깊이 상한 테스트의 느슨함이다. CRITICAL 급 결함이나 실제 RED 는 없다.

## 위험도
LOW
