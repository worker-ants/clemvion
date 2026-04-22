### 발견사항

- **[WARNING]** 모듈 수준 가변 캐시가 테스트 격리를 깸
  - 위치: `system-prompt.ts` — `let EXPRESSION_REFERENCE_CACHE: string | null = null`
  - 상세: 프로세스 수명 동안 한 번만 문자열화한다는 의도는 명확하지만, 모듈 스코프 `let` 변수는 Jest가 `--runInBand` 없이 실행될 경우 워커 간에 공유되지 않아 문제가 없으나, 동일 워커 내에서 `getAllFunctionNames` 반환값이 달라지는 테스트 시나리오(모킹)가 추가되면 캐시가 오염된다. 테스트에서 명시적으로 `EXPRESSION_REFERENCE_CACHE = null`로 리셋할 방법이 없다.
  - 제안: `getExpressionReferenceSection`을 `resetExpressionReferenceCache(): void` 내보내기 함수와 함께 제공하거나, `Map<string, string>` keyed by `getAllFunctionNames().join(',')` 으로 무효화 가능하게 하거나, 또는 `EXPRESSION_REFERENCE_CACHE`를 내보내서 테스트에서 직접 리셋할 수 있도록 한다.

- **[WARNING]** 블록 1~3은 상수로 추출됐지만 블록 4~5는 `buildSystemPrompt` 본체에 인라인 문자열로 남아있어 패턴이 불일치
  - 위치: `system-prompt.ts` — `buildSystemPrompt` 함수 내 `` ## Reference — node catalog `` 이후 부분
  - 상세: `STATIC_BLOCK_1_*` / `STATIC_BLOCK_2_*` / `STATIC_BLOCK_3_*` 로 명명된 패턴이 블록 4(Reference 인트로 + 카탈로그 마커 문자열)와 블록 5("Dynamic state" 헤더 문자열)에서 깨진다. 블록 4의 `## Reference — node catalog\n\n${catalog}...` 스니펫과 블록 5의 `## Dynamic state — active plan & current canvas...` 헤더가 함수 본체에 하드코딩되어 있어, 5블록 구조가 어디에 있는지 파악하려면 상수 파일과 함수 본체를 모두 읽어야 한다.
  - 제안: 블록 4·5 헤더·인트로 문자열도 `STATIC_BLOCK_4_REFERENCE_INTRO`(카탈로그 자리만 `${catalog}` 치환) 같은 상수로 분리하거나, 최소한 JSDoc에 "블록 4·5는 buildSystemPrompt 내 인라인"임을 명시한다.

- **[WARNING]** `render*` vs `get*` 네이밍 불일치
  - 위치: `renderNodeCatalog`, `renderActivePlanSection` vs `getExpressionReferenceSection`
  - 상세: 이전 `renderExpressionReferenceSection`을 `get*`으로 바꾼 것은 캐시 사이드 이펙트를 암시하려는 의도로 보이지만, `renderNodeCatalog`·`renderActivePlanSection`과 명명 규칙이 달라진다. 세 함수 모두 "문자열 조립"이라는 동일한 책임을 갖는다.
  - 제안: 캐시 함수만 다르게 부르고 싶다면 `buildExpressionReferenceSection` 또는 `getOrBuildExpressionSection`으로 의도를 더 명확히 하거나, 세 함수를 모두 `render*`로 통일하고 JSDoc 주석에 캐시 동작을 명시한다.

- **[INFO]** 테스트의 `'"nodes":['` 매직 앵커가 취약
  - 위치: `system-prompt.spec.ts` — `'places the workflow snapshot JSON after the Expression language reference'` 테스트
  - 상세: `prompt.indexOf('"nodes":[')`는 `JSON.stringify(toWorkflowView(emptySnapshot))` 결과가 `{"nodes":[...`로 시작한다는 가정에 의존한다. `toWorkflowView` 반환 키 순서가 바뀌거나 `edges`가 먼저 오면 즉시 깨진다.
  - 제안: `prompt.indexOf('### Current workflow snapshot')` 같이 프롬프트 구조상의 헤더를 앵커로 사용하면 JSON 직렬화 포맷에 무관하게 안정적이다.

- **[INFO]** `activePlan` 픽스처가 두 `describe` 블록에 중복 선언
  - 위치: `system-prompt.spec.ts` — `describe('Active plan context section', ...)` 내 `activePlan` (L148~168)과 `describe('5-block structural layout', ...)` 내 `activePlan` (L340~357)
  - 상세: 두 픽스처의 데이터(title, steps 수, userRequest 등)가 의도적으로 다르므로 단순 중복은 아니지만, 새 `describe` 블록의 픽스처를 기존 픽스처에서 스프레드 오버라이드하는 패턴으로 표현했으면 픽스처 형상을 한 곳에서 관리할 수 있다.
  - 제안: `const minimalActivePlan = { ...activePlan, plan: { title: 'T', summary: '', steps: [...], openQuestions: [] }, userRequest: 'ping', ... }` 식으로 outer `activePlan`에서 파생하거나, 새 블록이 "순서 검증"만 하면 충분하므로 `activePlan`을 상위 `describe` 스코프로 올려 공유한다.

- **[INFO]** `STATIC_BLOCK_N_` 상수명의 숫자 접두사가 이름에서 구조 정보를 중복 표현
  - 위치: `system-prompt.ts` — `STATIC_BLOCK_1_ROLE_AND_TURN_OP`, `STATIC_BLOCK_2_CONTRACTS`, `STATIC_BLOCK_3_EDIT_PLAYBOOK`
  - 상세: `buildSystemPrompt` 본체의 조립 순서 자체가 블록 순서를 정의하므로 상수 이름에 `_1_`, `_2_`, `_3_` 숫자가 반드시 필요하지는 않다. 숫자가 있으면 중간에 새 블록을 삽입할 때 이름을 대규모로 재명명해야 하는 부담이 생긴다.
  - 제안: 숫자를 제거하고 `ROLE_AND_TURN_OP_PROMPT`, `CONTRACTS_PROMPT`, `EDIT_PLAYBOOK_PROMPT`처럼 내용 중심으로 명명한다. 또는 주석의 블록 번호와 상수 이름을 분리해 관리한다.

---

### 요약

이번 리팩토링은 중복 규칙을 단일 소스로 통합하고 정적/동적 콘텐츠를 분리해 캐시 친화적 구조로 전환한다는 목표가 명확하고, `buildSystemPrompt` 본체가 얇아진 점은 긍정적이다. 다만 블록 1~3만 `STATIC_BLOCK_*` 상수로 추출하고 블록 4~5는 인라인으로 남겨 패턴 일관성이 깨지며, 모듈 스코프 가변 캐시가 테스트 격리 문제를 잠재적으로 내포하고 있고, `render*`/`get*` 네이밍 혼용과 테스트의 취약한 JSON 앵커 등 소규모 불일치가 누적되어 있다. 전체적으로 구조 의도는 훌륭하나 패턴을 끝까지 관철하지 않은 지점에서 향후 기여자가 어느 규칙을 따라야 하는지 혼선이 생길 수 있다.

### 위험도

**LOW**