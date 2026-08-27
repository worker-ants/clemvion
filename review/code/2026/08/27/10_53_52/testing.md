# 테스트(Testing) 리뷰 — masking-residuals (config echo 마스킹 어댑터 → egress 이전)

## 검토 방법

리뷰 대상 4개 코드/테스트 파일(mask-sensitive-fields.util.{ts,spec.ts}, handler-output.adapter.{ts,spec.ts})을
전문 `Read` 하고, 프롬프트에 포함된 plan(`masking-expression-egress-split.md`)의 뮤테이션 기록(M1/M2/M3)을
**직접 재현**해 검증했다(`cp` 백업 → 소스 뮤테이션 → `npx jest` 실행 → `cp` 원복, `git checkout`/`reset` 미사용,
매 단계 후 `git status`/`git diff` 로 clean 복원 확인). 나머지 plan/consistency 산출물 파일들은 테스트 관점
findings 에 직접 필요한 범위에서만 참조했다(spec_impact·rationale 자체는 이 리뷰의 관점 밖).

---

## 발견사항

### [WARNING] 포함관계 캐너리(`KEYS`)가 실제로는 `DEFAULT_SENSITIVE_KEYS`에서 파생되지 않는다 — 자체 주석의 "자동 검사" 주장이 거짓이고, plan 의 M2 뮤테이션 기록도 그 착오 위에 서 있다 (실측으로 반증)

- 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts` — `describe('DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축', ...)` 블록(신규 추가, 게이트 129~156행), 특히 `const KEYS = Object.keys(maskSensitiveFields({...}))` 부분과 그 위 JSDoc(게이트 125~127행: *"목록이 나중에 넓어져도 ... 이 테스트가 자동으로 새 키를 검사한다"*).
- 상세:
  - `DEFAULT_SENSITIVE_KEYS`(`mask-sensitive-fields.util.ts`)는 **export 되지 않는다.** 그래서 이 테스트는 그 상수를 import 할 수 없고, 대신 22개 키를 **손으로 그대로 다시 나열한 리터럴 객체**를 만들어 `maskSensitiveFields(literal)`을 호출한 뒤 `Object.keys(...)`로 `KEYS`를 얻는다.
  - `maskSensitiveFields`의 구현(`out[k] = sensitiveKeys.has(k.toLowerCase()) ? maskValue(v) : maskSensitiveFields(v, ...)`)은 **어떤 경우에도 키를 제거하지 않는다** — 민감 키든 아니든 `out[k]`가 항상 채워진다. 즉 `Object.keys(maskSensitiveFields(literal))`은 `DEFAULT_SENSITIVE_KEYS`의 런타임 내용과 **무관하게** 항상 리터럴 객체 자신의 22개 키와 같다. "목록에서 파생한다"는 주석(129행 바로 아래)은 사실이 아니다 — 파생 대상은 (export 되지 않는) 진짜 상수가 아니라 **테스트 파일에 손으로 복제해 둔 사본**이다.
  - **실측(뮤테이션 M2 재현)으로 확인**: `mask-sensitive-fields.util.ts`의 `DEFAULT_SENSITIVE_KEYS`에서 `'idToken'` 항목을 제거하고 `npx jest mask-sensitive-fields.util.spec.ts`를 실행하면 plan 이 기록한 것과 동일하게 **`1 failed / 40 passed`(총 41)**가 나온다. 그런데 그 1건은 파일 상단의 **기존 명시 키 테스트**(`masks the idToken key (token family...)`, `maskSensitiveFields` 자체의 멤버십을 직접 검사)이고, 신규 포함관계 캐너리의 `it.each(KEYS)` 블록은 **테스트 개수가 전혀 줄지 않았다**(22건 전부 그대로 실행되고 전부 통과) — `idToken`이 여전히 리터럴에 남아 있고, `deepRedactSecrets`는 `DEFAULT_SENSITIVE_KEYS`와 무관하게 자신의 `CREDENTIAL_KEY_PATTERN`으로 `idToken`을 독립적으로 가리기 때문이다.
  - 즉 plan(`plan/in-progress/masking-expression-egress-split.md`)의 뮤테이션 표 M2 행 — *"포함관계 캐너리가 케이스를 잃어 조용히 통과할 위험 ... 내 캐너리는 예상대로 조용히 줄었다"* — 는 **관측이 틀렸다**. 캐너리의 케이스 수는 이 뮤테이션으로 전혀 줄지 않았다. 실제로 관측된 1건의 실패는 캐너리와 무관한, 기존부터 있던 별개 테스트다. "포함관계 캐너리는 목록에서 파생하므로 목록이 줄면 케이스도 준다"는 전제 자체가 코드 구조상 성립하지 않는다.
  - **실질적 결과**: 이 캐너리는 **오직 작성 시점의 22개 키에 대해서만** "이 키는 egress 에서도 가려지는가"를 검사한다. 앞으로 `DEFAULT_SENSITIVE_KEYS`에 새 키가 추가돼도(이 저장소가 2026-08-16/08-23에 실제로 그랬듯) 테스트 파일의 리터럴을 **손으로 함께 갱신하지 않으면** 이 캐너리는 그 새 키를 전혀 검사하지 않고 **조용히 통과**한다. 이는 이 PR 이 삭제한 `handler-output.adapter.ts`의 마스킹 계층을 대체하는 **유일한 안전망**이 스스로 주장하는 것보다 좁다는 뜻이다.
- 제안:
  1. JSDoc 의 "목록이 나중에 넓어져도 ... 자동으로 새 키를 검사한다" 주장을 정정하거나(현재는 사실이 아님을 명시),
  2. 가능하다면 `DEFAULT_SENSITIVE_KEYS`를 테스트 전용으로 export(예: `export const __test__DEFAULT_SENSITIVE_KEYS` 혹은 별도 getter)해 `KEYS`가 **진짜** 런타임 상수에서 파생되도록 바꾼다. 그러면 목록 확장 시 정말로 자동 검사되고, plan 의 M2 재현도 실제로 "1 failed(멤버십) + 캐너리 케이스 21개로 축소"라는 다른 결과를 낼 것이다.
  3. plan 의 뮤테이션 표 M2 행 서술을 위 실측(캐너리 케이스 불변, 22→22)에 맞춰 정정한다.

### [INFO] 마스킹 제거로 `config`의 암묵적 deep-clone 도 함께 사라졌는데, 그 aliasing 변화를 검증하는 테스트가 없다

- 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` — `config: r.config ?? {}` (게이트 49행). 대응 테스트는 `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts`의 `[캐너리]` 계열(게이트 109~194행 부근).
- 상세: 종전 `maskSensitiveFields(r.config ?? {})`는 (민감 키 유무와 무관하게) 항상 **새 객체 그래프**를 만들어 반환했다(`out[k] = ...`로 매 레벨 새 객체 생성). 이번 변경으로 `config`는 핸들러가 반환한 객체를 **그대로(같은 참조)** 전달한다 — `config: null`일 때만 `{}`로 새로 만든다. 신규 캐너리 테스트들은 모두 필드 값 단위로 `toBe`/`toEqual`을 검사할 뿐, `result.config`가 `raw.config`와 **같은 참조**인지(혹은 의도적으로 다른지)는 어디서도 단언하지 않는다. `adapted.config`는 이후 WS 이벤트 페이로드(`execution-engine.service.ts`의 presentations envelope 등)로 그대로 흘러가는데, 이 경로 어딘가가 실수로 `config` 객체를 in-place mutate 하면 핸들러의 원본 반환 객체까지 오염될 수 있다 — 종전에는 항상 새 객체였으므로 원리적으로 불가능했던 회귀 클래스다.
- 제안: `expect(out.config).toBe(raw.config)`(혹은 의도적으로 얕은 복사를 유지하려면 반대 방향 단언) 캐너리 1건을 추가해 이 aliasing 동작을 명시적으로 고정한다.

### [INFO] plan 체크리스트가 실제 구현 상태보다 뒤처져 있어 "테스트 존재 여부" 판단을 오도할 수 있다

- 위치: `plan/in-progress/masking-expression-egress-split.md` — 작업 체크리스트의 `- [ ] 어댑터에서 maskSensitiveFields(config) 제거 + 왜 안전한지 JSDoc`, `- [ ] 캐너리 — 표현식이 원문을 읽는다 · WS/REST 는 여전히 마스킹 · DB 는 원문(§R17)` 두 항목.
- 상세: 두 항목 모두 `[ ]`(미완료)로 표시돼 있지만, 실제로는 `handler-output.adapter.ts`의 마스킹 제거 + JSDoc, 그리고 `handler-output.adapter.spec.ts`의 대응 캐너리(원문 유지 캐너리 + egress 대조군 2건)가 **이미 이 diff 에 포함**돼 있다. 테스트 리뷰어가 plan 만 보고 "캐너리 미작성"으로 오판할 위험이 있다(반대로, 실제로 남은 작업이 있다면 체크박스가 그 사실을 가리고 있을 수도 있다 — 어느 쪽이든 현재 상태와 문서가 어긋난다).
- 제안: 코드 반영이 끝난 두 항목을 `[x]`로 갱신(plan-lifecycle 관례상 "수행 후에만 체크").

---

## 각 점검 관점별 요약

1. **테스트 존재 여부**: 4개 대상 파일 모두 대응 테스트가 있고, `config` 마스킹 제거라는 핵심 동작 변화가 캐너리로 명시적으로 고정돼 있다. 양호.
2. **커버리지 갭**: 위 WARNING(포함관계 캐너리가 미래 확장을 못 잡음)과 INFO(aliasing 미검증)가 실질 갭. 그 외 `adaptHandlerReturn`/`toEngineFlatShape`의 기존 분기(strict throw, null/primitive config, control-field override 등)는 이번 diff 로 건드리지 않았고 여전히 테스트돼 있다.
3. **엣지 케이스**: null/undefined/circular/non-string 값 등은 `mask-sensitive-fields.util.spec.ts` 기존 테스트가, config 의 중첩·비-문자열 자격증명 값은 신규 캐너리가 다룬다. 다만 포함관계 캐너리는 **빈 문자열/undefined 값의 민감 키**(`CREDENTIAL_KEY_PATTERN`이 값이 falsy 인 경우 마스킹을 건너뛰는 기존 분기)는 검사하지 않는다 — 이 diff 이전부터 있던 사각이라 우선순위는 낮음.
4. **Mock 적절성**: 두 테스트 파일 모두 mock/stub 을 쓰지 않고 **실제 프로덕션 함수**(`deepRedactSecrets`, `maskSensitiveFields`)를 그대로 호출해 검증한다 — "정본 구현을 실행해 확인한다"는 plan 의 원칙과 일치하며 mock-reality 괴리 문제가 없다. 우수.
5. **테스트 격리**: `deepRedactSecrets`는 depth-0 객체 identity 캐시(WeakMap)를 쓰는데, 캐너리의 각 `it.each` 케이스가 매번 새 리터럴 객체를 만들어 넘기므로 캐시로 인한 테스트 간 간섭은 없음을 확인했다.
6. **테스트 가독성**: 대조군("대조군"/"캐너리" 라벨), 한국어 JSDoc 으로 "왜 이 테스트가 존재하는가"를 명시 — 가독성 우수. 다만 포함관계 캐너리의 "자동 검사" 주장은 가독성과 별개로 **부정확**하다(위 WARNING).
7. **회귀 테스트**: `adaptHandlerReturn`을 사용하는 다른 5개 spec 파일(`information-extractor.handler.spec.ts`, `ai-agent.handler.spec.ts`, `execution-context.service.spec.ts`, `execution-engine.service.spec.ts`)에 옛 마스킹(`****` 마커) 가정이 남아있지 않음을 grep 으로 확인했고, 해당 4개 스위트(614 tests) 전부 GREEN 으로 재실행 확인했다. `explore-tools.service.ts`(마스킹 제거의 영향을 받지 않는 별도 소비처)의 18개 테스트도 GREEN.
8. **테스트 용이성**: `maskSensitiveFields`/`deepRedactSecrets`가 순수 함수라 DI 없이 직접 호출로 테스트하기 쉬운 구조. `DEFAULT_SENSITIVE_KEYS`가 export 되지 않는 점이 유일한 구조적 제약이며, 이것이 위 WARNING 의 근본 원인이다.

---

## 요약

핵심 코드·테스트는 대체로 견고하고(mock 미사용, 대조군 포함, 회귀 스위트 GREEN 확인), plan 문서가 기록한 M1 뮤테이션(어댑터 마스킹 되돌리기 → 7 failed/34 passed)도 직접 재현해 정확함을 확인했다. 그러나 이 PR 전체의 안전 주장이 의존하는 **포함관계 캐너리**는 자신이 주장하는 "목록이 넓어져도 자동 검사"를 실제로 수행하지 않는다 — `DEFAULT_SENSITIVE_KEYS`가 export 되지 않아 테스트가 그 값을 손으로 복제한 리터럴에서 파생하고, `Object.keys`는 구조상 그 상수 내용과 무관하기 때문이다. 이는 문서상 주장으로 그치지 않고 plan 의 M2 뮤테이션 관측 자체가 이 착오 위에 서 있음을 실측(뮤테이션 재현)으로 확인했다 — 캐너리 케이스 수는 41→41(불변)이었고, 관측된 유일한 실패는 캐너리와 무관한 기존 테스트였다. 이 갭이 지금 당장 유출을 만들지는 않지만(현재 22개 키는 실제로 검증됨), 향후 `DEFAULT_SENSITIVE_KEYS` 확장분을 조용히 놓칠 수 있는 안전망의 착시라는 점에서 이 저장소가 반복 경계해 온 실패 유형과 정확히 같다.

## 위험도

WARNING
