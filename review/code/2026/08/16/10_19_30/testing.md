# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `toTerminalErrorPayload` 4개 반환 분기 중 2개(스칼라·non-object)는 `redactTerminalError()` 래핑 호출이 어떤 테스트·뮤테이션으로도 판별되지 않는다 — 저자 자신의 뮤테이션 검증 범위가 실제로는 4곳이 아니라 2곳뿐이었다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:121-133`(number/boolean/bigint 스칼라 분기), `:134-137`(non-object/symbol 분기)
  - 상세: 이 두 분기가 만드는 `message` 값은 각각 `String(42)`/`'true'`/`'9'`(스칼라) 또는 `''`(symbol 등 non-object)로, `SECRET_LEAK_PATTERNS` 어디에도 매칭될 수 없는 값 공간이다. 즉 이 두 지점에서 `redactTerminalError(...)` 래핑을 통째로 제거하는 뮤턴트를 만들어도 출력이 변하지 않아 GREEN 이다. RESOLUTION.md 의 검증 로그(`review/code/2026/08/16/09_51_00/RESOLUTION.md`)가 스스로 이를 확인해 준다 — "뮤테이션: message·details 마스킹 제거 · **객체/레거시 경로 각각 누락** · details 키 항상 생성 5/5 RED" 라고 적어, 래핑 제거 뮤턴트를 문자열-레거시 분기와 객체 분기 딱 2곳에만 걸었다. 즉 `toTerminalErrorPayload` 의 4개 반환 지점 중 실제로 뮤테이션 판별력이 검증된 곳은 절반뿐인데, 같은 함수의 docstring(`terminal-error-payload.ts:63-65`)은 "**호출부 5곳이 전부 emit 쪽**"·"새 종결 emit 경로가 생겨도 형태를 얻으려면 여기를 거치므로 마스킹이 **구조적으로** 빠질 수 없다"는 전수 보장을 주장한다. 더구나 이 파일은 바로 위에서 "관측 불가능한 분기는 영원히 검증되지 않으므로 지웠다"(:89-94, copy-on-change 조기 반환 제거 사례)는 원칙을 스스로 명문화해 놓고, 정확히 같은 성질(관측 불가능)을 가진 이 두 분기의 래핑 호출은 지우지도 않고 검증하지도 않은 채로 남겨 뒀다 — 같은 파일 안에서 원칙 적용이 비대칭적이다.
  - 제안: (a) 스칼라/non-object 분기의 래핑 호출이 "미래 분기 확장을 대비한 구조적 일관성 목적이며 현재 뮤테이션으로 판별 불가능"이라는 점을 docstring 에 명시하거나, (b) RESOLUTION.md/plan 의 "생존 0" 서술이 4개 반환 지점 전부를 뮤테이션 검증했다는 인상을 주지 않도록 "문자열·객체 분기만 판별 검증됨" 으로 좁혀 적는다. 이 저장소가 반복 지적해 온 "주장이 구현/검증 범위보다 넓다" 패턴과 같은 결이다.

- **[INFO]** `details` 가 명시적 `null` 인 입력 경로가 여전히 테스트되지 않는다 (전 라운드 `09_51_00` testing 리뷰가 지적했고 낮은 우선순위로 이월된 항목 — 이번 라운드에도 미반영 확인)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:100-103` (`p.details === undefined ? {} : { details: deepRedactSecrets(p.details) }`)
  - 상세: `p.details === undefined` 체크는 `null` 을 걸러내지 않으므로 `details: null` 이 입력되면 `undefined` 와 다르게 취급되어 `deepRedactSecrets(null)` 이 호출되고(안전하게 `null` 반환) 출력 payload 는 `details: null` **키를 갖는다**. `Execution.error` 는 `Record<string, unknown>` 이라 이 값이 이론상 들어올 수 있는데, 이 분기를 고정하는 케이스가 `terminal-error-payload.spec.ts` 어디에도 없다.
  - 제안: `toTerminalErrorPayload({ message: 'x', details: null })` 가 `{ ..., details: null }` 을 돌려주는지 확인하는 케이스 1개 추가.

- **[INFO]** JSDoc 이 표로 명시한 잔여 마스킹 갭(자격증명 없는 연결 문자열·내부 호스트명)을 고정하는 캐너리 테스트가 없다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:71-78`(위협 실측표) — 대응 부정 케이스는 `terminal-error-payload.spec.ts:137-202`(신설 `describe` 블록) 어디에도 없음
  - 상세: docstring 은 `postgres://db.internal:5432/prod`(자격증명 없음)·내부 호스트명·스택 프래그먼트가 **무변화로 통과**한다고 표로 실측해 뒀고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에도 잔여 갭으로 등재했다. 이 저장소 컨벤션(미수정 결함은 캐너리로 고정 — 반증되면 더 큰 결함의 신호가 되므로)에 따르면, 문서만으로는 향후 `SECRET_LEAK_PATTERNS` 나 이 함수의 재사용 방식이 바뀌어도 이 특정 사각지대가 실제로 닫혔는지/더 넓어졌는지 테스트가 자동으로 감지하지 못한다.
  - 제안: `redactSecrets('postgres://db.internal:5432/prod')` 또는 이 함수를 경유하는 동일 입력이 여전히 무변화임을 고정하는 케이스 1개(오탐 대조 케이스 옆에 나란히) 추가 — 문서 주장과 코드 동작의 drift 를 자동으로 잡아준다.

## 정합성/회귀 확인 (실측)

- 전 라운드(`09_51_00` testing 리뷰)의 두 WARNING 은 이번 diff 에서 실제로 반영됐다: (1) `code`·`nodeId` 비-마스킹 테스트(`spec.ts:165-170`)가 `SECRET_LEAK_PATTERNS` 에 실제로 매칭되는 adversarial 값(`Bearer sk-live-…`, `api-key=…`)으로 교체돼 판별력 있는 테스트가 됐고, 이 값들은 `redactTerminalError` 가 `code`/`nodeId` 를 spread 로만 복사(즉 `deepRedactSecrets` 호출 자체가 없음)한다는 구조를 정확히 검증한다. (2) JSON 형태 `message` 재직렬화 케이스(`spec.ts:172-180`)가 추가돼 "secret 제거 + JSON 파싱 유지" 를 명시적으로 고정했다.
- 새 `describe` 블록(`spec.ts:137-202`)은 mock/stub 없이 실제 `deepRedactSecrets`/`redactSecrets` 를 그대로 태우는 순수 함수 유닛테스트라 mock 과 실동작의 괴리가 없다. 각 `it` 이 리터럴을 새로 만들어 쓰므로 테스트 간 상태 공유가 없고, `deepRedactSecrets` 의 depth-0 `WeakMap` 캐시(`sanitize-error-message.ts:107`)는 object identity 키라 리터럴마다 새 참조이므로 오염 가능성이 없다. `message` 필드는 항상 문자열이라 애초에 이 캐시 경로(object 전용)를 타지 않는다.
- 기존 `describe('toTerminalErrorPayload', …)` 블록(§6.4 wire 형태 계약)의 fixture 들(`'boom'`, `'crash'`, `'legacy string'`, 스칼라 `42`/`true`/`BigInt(9)`, `''` 등)은 어느 것도 `SECRET_LEAK_PATTERNS` 에 매칭되지 않아, 신규 마스킹 도입 후에도 값이 그대로 유지된다 — 회귀 없이 유효함을 값 대조로 확인.
- `sanitize-error-message.ts`(execution-engine)는 docstring 정정뿐이라 로직 변경이 없고, 대응 `sanitize-error-message.spec.ts`(shared/utils) 는 이번 diff 밖이지만 `deepRedactSecrets`/`redactSecretsInJsonString`/`looksLikeJson` 각각을 독립적으로 충분히 커버하고 있어(JSON leaf·key-based masking·depth cap·copy-on-change·caching) `terminal-error-payload.spec.ts` 가 그 내부 동작을 중복 검증할 필요가 없다는 판단은 타당하다.
- 신규 블록의 null/undefined·details-omission 단언이 기존 블록과 문구가 겹치는 점(maintainability 리뷰가 별도 지적)은 RESOLUTION.md W5 무조치 사유("마스킹 도입 후에도 그 계약이 유지되는지를 묻는 것이라 의도가 다르다")가 타당한 설명이라 테스트 관점에서도 추가 조치 불요로 판단.

## 요약

전 라운드 리뷰가 지적한 두 개의 판별력 문제(vacuous code/nodeId 단언, JSON 재직렬화 미고정)는 이번 diff 에서 adversarial 입력·명시적 파싱 단언으로 정확히 교정됐고, 신규 테스트는 mock 없이 실동작을 태우는 순수 함수 테스트라 격리·가독성 모두 양호하다. 다만 `toTerminalErrorPayload` 의 4개 반환 분기 중 값 공간이 구조적으로 secret-free 인 2개(스칼라·non-object)는 저자 자신의 뮤테이션 검증 로그가 인정하듯 래핑 호출 제거를 판별하지 못하는데, 그 사실이 "호출부 5곳 전부 구조적으로 마스킹된다"는 docstring 의 전수 보장 서술과 나란히 놓여 검증 범위가 실제보다 넓게 읽힌다(WARNING). 그 외엔 `details: null` 명시적 입력 경로(전 라운드부터 이월된 낮은 우선순위 갭)와, JSDoc 이 표로 실측해 등재해 둔 잔여 마스킹 갭(자격증명 없는 연결 문자열)을 고정하는 캐너리 테스트의 부재(INFO 2건)뿐이다. 셋 다 현재 동작을 깨는 결함이 아니라 회귀 방지력의 미세한 갭이며, 핵심 로직 자체의 테스트 신뢰도는 이전 라운드 대비 개선됐다.

## 위험도
LOW
