# 테스트(Testing) 리뷰 — masking-expression-egress-split (`10_53_52` CRITICAL fix 검증 + 후속 diff)

## 검토 방법

`mask-sensitive-fields.util.{ts,spec.ts}` · `handler-output.adapter.{ts,spec.ts}` 를 전문 `Read` 했다.
직전 라운드(`10_53_52`)가 지적한 **CRITICAL**("포함관계 캐너리가 `DEFAULT_SENSITIVE_KEYS` 에서
파생되지 않는다")이 이번 diff 에서 어떻게 고쳐졌는지 확인하기 위해, `RESOLUTION.md` 가 기록한
**M4 뮤턴트를 직접 재현**했다 — `DEFAULT_SENSITIVE_KEYS` 에 egress 가 못 잡는 가상 키
(`oauthCredXYZ`)를 추가하고 `npx jest mask-sensitive-fields.util.spec.ts` 를 실행, 결과를 `cp`
백업으로 원복(`git checkout`/`reset` 미사용, 원복 후 `git status --porcelain` clean 확인).
추가로 회귀 범위(`ai-agent`·`execution-engine`·`workflow-assistant/tools/explore-tools`)를
`npx jest` 로 재실행해 stale 마스킹 기대값이 남아있지 않은지 확인했다.

## 발견사항

### [정보 — 검증 완료] 직전 CRITICAL 이 실측으로 고쳐졌다

- 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (`export const DEFAULT_SENSITIVE_KEYS`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts` (`describe('DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축'`, `const KEYS = [...DEFAULT_SENSITIVE_KEYS]`)
- 상세: 직전 라운드는 캐너리가 `Object.keys(maskSensitiveFields({...손으로 나열...}))` 로 상수와 무관한 리터럴을 순회했음을 지적했다(CRITICAL). 이번 diff 는 상수를 `export` 하고 캐너리가 `[...DEFAULT_SENSITIVE_KEYS]` 를 **직접** 순회하도록 재작성했다. RESOLUTION.md 가 주장하는 M4 뮤턴트(`oauthCred` 추가 → 42 총/1 실패)를 독립적으로 재현했다 — 동일하게 **42 total / 1 failed / 41 passed** 를 관측했고, 실패한 케이스는 정확히 새로 추가한 키(`oauthcredxyz`)였다. 파생이 실질적으로 성립함을 확인했다.
- 제안: 없음(양호, 회귀 방지 확인 완료).

### [INFO] 빈 문자열/undefined 자격증명 값 엣지 케이스가 여전히 어떤 캐너리에도 없다 — 이 PR 로 실질 동작이 바뀐 지점인데도 고정되지 않음

- 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:145-153` (`it.each(KEYS)` 캐너리, raw 값이 항상 `'SUPER-SECRET-VALUE-0123456789'` 로 고정), `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `deepRedactObject`(`v !== null && v !== undefined && v !== ''` 가드)
- 상세: `deepRedactSecrets` 는 자격증명 키라도 값이 `null`/`undefined`/`''` 이면 마스킹을 건너뛴다(코드 확인: `deepRedactObject` 의 `else` 분기로 빠져 원문 그대로 반환). 이번 PR 이전에는 어댑터의 `maskSensitiveFields` 가 값 진위와 무관하게 `''` 도 `'****'` 로 눌렀으므로 DB 저장값 자체가 항상 마스킹돼 있었다. 이번 PR 로 어댑터 마스킹이 사라지면서, `config: { apiKey: '' }` 같은 핸들러 출력은 이제 DB·표현식·**egress 응답 모두에서** 빈 문자열 그대로 노출된다 — 값이 비어 있어 실질 유출은 없지만, "egress 가 어댑터가 하던 것을 완전히 대체한다"는 이 PR 의 안전 주장에 정확히 들어맞지 않는 유일한 값 형태다. 새로 추가된 어떤 캐너리도 이 값을 넣어보지 않는다.
- 제안: `it.each(KEYS)` 캐너리 옆에 `[대조군] 빈 문자열 자격증명 값은 두 계층 모두 마스킹하지 않는다(값이 비어 있어 안전)` 같은 1건을 추가해, 이 알려진 사각을 **의도**로 명시적으로 고정한다. (직전 라운드 testing.md 가 이미 이 갭을 저-우선순위로 지적했고, 이번 diff 로 실질 동작이 바뀌었으니 재확인 가치가 있다.)

### [INFO] 안전 주장을 검증하는 모든 신규 캐너리가 `deepRedactSecrets` 를 직접 호출할 뿐, 실제 egress 진입점(`redactStoredDataForResponse`/`maskWireEnvelope`)을 통과시키지 않는다

- 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:179-215` (`[캐너리] 어댑터가 남긴 원문을 egress 마스커가 가린다`, `[캐너리] 비-문자열 자격증명 값도...`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:145-153`
- 상세: 이 PR 의 핵심 안전 주장은 "`adaptHandlerReturn` 이 원문을 남겨도 REST/WS 출구가 가린다" 인데, 새 캐너리들은 모두 공유 저수준 함수 `deepRedactSecrets` 를 직접 호출해서 확인한다. `redactStoredDataForResponse`(REST)·`maskWireEnvelope`(WS) 자체를 호출하는 통합 테스트는 이 diff 에 없다 — 두 함수가 실제로 `config` 필드까지 내려가서 `deepRedactSecrets*` 를 호출하는지는 (a) 기존 별도 테스트가 있거나 (b) 코드 추적으로만 확인된다(architecture/api_contract 리뷰가 각각 그 추적을 수행했다). 테스트 관점에서는 "저수준 유틸 검증" 과 "실제 진입점 검증" 사이에 한 겹의 간접이 남아 있다.
- 제안: 이미 다른 리뷰어(api_contract INFO, architecture WARNING)가 같은 갭을 지적했고 "기존부터 있던 갭, 신규 아님"으로 판정된 바 있어 이 PR 을 막을 사유는 아니다. 다만 `redactStoredDataForResponse`/`maskWireEnvelope` 각각에 대해 "`config.apiKey` 를 가리는가" 를 직접 검증하는 통합 테스트가 이미 존재하는지 별도 확인을 권한다(존재하면 이 INFO 는 종결).

### [정보 — 확인 완료] 회귀 스위트 재실행 결과 stale 마스킹 기대값 없음

- 위치: `codebase/backend/src/nodes/ai/ai-agent/**`, `codebase/backend/src/modules/execution-engine/**`, `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.spec.ts`
- 상세: `maskSensitiveFields` 소비처를 grep 해 어댑터 외 유일한 실사용처(`explore-tools.service.ts`)가 이번 변경과 무관함을 확인했고, `git grep '\*\*\*\*'` 로 config 관련 스펙에 옛 마스킹 기대값이 남아있지 않음을 확인했다. `npx jest src/nodes/ai/ai-agent src/modules/execution-engine src/modules/workflow-assistant/tools/explore-tools.service.spec.ts` 재실행 결과 **62 suites / 1780 tests 전부 GREEN**.
- 제안: 없음(회귀 없음 확인).

### [정보] 테스트 격리 — `deepRedactSecrets` 의 depth-0 identity 캐시(WeakMap)로 인한 캐너리 간 간섭 없음을 확인

- 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`DEEP_REDACT_CACHE`), 신규 `it.each` 캐너리 양쪽 파일
- 상세: 각 `it.each` 케이스가 매 반복 새 리터럴 객체를 생성해 호출하므로 캐시 키(객체 identity)가 겹치지 않는다. `deepRedactObject` 는 마스킹 시 원본을 변형하지 않고 얕은 복사본을 반환하므로(`{ ...value }`), 이번 PR 로 `adaptHandlerReturn` 이 config 를 참조로 그대로 넘기게 된 것과 결합해도 원본 핸들러 객체가 오염되는 경로는 없다.
- 제안: 없음(양호).

## 각 점검 관점별 요약

1. **테스트 존재 여부**: 핵심 동작 변화(마스킹 제거·aliasing 변화·포함관계 안전 전제) 모두 전용 캐너리로 고정돼 있다. 양호.
2. **커버리지 갭**: 직전 CRITICAL 은 해소됐고 실측 재현으로 확인. 남은 갭은 빈 문자열 값(INFO)과 저수준 유틸 vs 실제 egress 진입점 사이 간접(INFO) 두 가지로 축소.
3. **엣지 케이스**: null/undefined/circular/비-문자열은 다뤄지나, 빈 문자열 자격증명 값은 이 PR 로 실질 동작이 바뀐 지점임에도 미고정.
4. **Mock 적절성**: 여전히 mock 없이 정본 구현(`deepRedactSecrets`, `maskSensitiveFields`, `adaptHandlerReturn`)을 그대로 호출 — 우수.
5. **테스트 격리**: WeakMap 캐시로 인한 간섭 없음을 확인(위 항목). 우수.
6. **테스트 가독성**: 대조군/캐너리 라벨, 한국어 JSDoc 로 "왜"를 명시 — 우수. `[메타]` 케이스가 파생 실패를 조기 탐지하도록 설계된 점도 좋다.
7. **회귀 테스트**: `adaptHandlerReturn` 소비처(ai-agent, execution-engine, workflow-assistant) 전체 재실행 GREEN, stale 마스킹 기대값 grep 으로 확인. 유효.
8. **테스트 용이성**: `DEFAULT_SENSITIVE_KEYS` 를 "런타임 소비처는 안 쓴다"고 JSDoc 에 명시하며 테스트 전용으로 export — 의도가 명확한 구조 개선.

## 요약

직전 라운드(`10_53_52`)가 지적한 CRITICAL(포함관계 캐너리 미파생)은 상수 export + 직접 순회로 실질적으로 고쳐졌고, RESOLUTION.md 가 주장한 M4 뮤턴트(`oauthCred` 추가 → 42/1 실패)를 독립 재현해 정확함을 확인했다. aliasing 변화도 전용 캐너리로 고정됐고, 영향받는 회귀 스위트(1780 테스트)가 GREEN 임을 재확인했다. 남은 것은 낮은 우선순위의 두 갭 — (1) 빈 문자열 자격증명 값이 이 PR 로 실제 동작이 바뀌었음에도 어떤 캐너리도 다루지 않는다(실질 유출은 없음), (2) 안전 주장 캐너리가 실제 REST/WS 진입점이 아니라 공유 저수준 함수를 직접 호출한다(다른 리뷰어도 지적, 기존 갭) — 뿐이며 둘 다 이 PR 을 막을 사유는 아니다.

## 위험도

LOW
