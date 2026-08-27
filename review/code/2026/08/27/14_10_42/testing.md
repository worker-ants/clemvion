### 발견사항

- **[INFO]** egress 진입점(WS/REST) 을 지나는 통합 테스트가 여전히 없다 — 기지 갭, 비차단
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts` (`[캐너리] 어댑터가 남긴 원문을 egress 마스커가 가린다` 근처), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts` (`describe('DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축')`)
  - 상세: 이 PR 의 안전 주장("DB 는 원문이지만 WS/REST 응답은 그대로 마스킹된다")을 실제로 검증하는 테스트는 두 계층으로 쪼개져 있다 — (1) 어댑터가 `config` 를 원문으로 통과시키는지, (2) `deepRedactSecrets` 가 그 값을 가리는지 — 를 각각 **직접 호출**로 단언한다. 두 게이트웨이 함수 `maskWireEnvelope`(WS) · `redactStoredDataForResponse`(REST) 를 실제로 거치는 end-to-end 테스트는 없다. 즉 "이 두 출구가 실제로 `deepRedactSecrets*` 를 호출한다"는 배선 자체는 이 테스트들이 커버하지 않고, 별개 기존 테스트(있다면)에 의존한다.
  - 이 갭은 신규가 아니라 `12_00_05`/`12_52_43` 라운드 testing 리뷰가 이미 지적하고 "기존부터 없던 갭, 신규 아님"으로 처분한 항목이며, 이번 라운드에도 형태 변화가 없어 재확인만 한다.
  - 제안: 강제 아님. 다만 향후 `maskWireEnvelope`/`redactStoredDataForResponse` 에 회귀가 생기면 이 두 유닛 테스트는 초록인 채로 실제 유출이 날 수 있다는 점은 인지하고 있을 것 — e2e 또는 해당 게이트웨이 함수의 spec 에서 "민감 키를 가진 config 가 실제로 wire/REST 응답에서 가려진다"를 1건이라도 못박는 것을 권장.

- **[INFO]** `execution-context.service.spec.ts` 신규 캐너리 2건이 동일한 이중 타입 단언을 반복 (추출 임계선 미달)
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.spec.ts` — `describe('setStructuredOutput — 참조 저장 (방어적 복사 없음)')` 내부 두 `it` 블록
  - 상세: `{ output: {}, config: rawConfig } as unknown as Parameters<typeof service.setStructuredOutput>[2]` 형태가 두 테스트에 그대로 복제돼 있다. 가독성에 큰 지장은 없으나 3번째 캐너리가 추가되면 로컬 헬퍼로 추출할 시점이다.
  - 제안: 강제 아님(2회 반복은 이 저장소 관행상 추출 임계선 3회 미만).

### 검증 (실행)

프롬프트 diff 를 신뢰하지 않고 실제 소스를 열어 대조하고, 핵심 캐너리 2건을 뮤테이션으로 직접 재현했다:

- `npx jest mask-sensitive-fields.util.spec.ts handler-output.adapter.spec.ts execution-context.service.spec.ts` → **111 passed**.
- **포함관계 캐너리 재현**: `DEFAULT_SENSITIVE_KEYS` 에 egress 정규식이 못 잡는 가상 키 `oauthCred` 를 추가 → `mask-sensitive-fields.util.spec.ts` 가 정확히 그 키에서만 **1 failed / 42 passed** 로 RED. 이 캐너리가 `[...DEFAULT_SENSITIVE_KEYS]` 로 상수에서 진짜 파생하고 있음을 독립 확인했다(RESOLUTION.md 의 M4 주장과 일치). 원복 후 42 passed 재확인.
- **참조-저장 캐너리 재현**: `execution-context.service.ts` 의 `context.structuredOutputCache[nodeId] = adapted;` 를 `= { ...adapted };` 로 뮤테이션 → 신규 캐너리(`[캐너리] adapted 래퍼와 그 config 를 참조 그대로 캐시에 눕힌다`)가 정확히 **1 failed / 26 passed** 로 RED. `toBe` 단언이 진짜로 identity 를 보고 있음을 확인. 원복 후 27 passed 재확인.
- 두 뮤테이션 모두 `cp` 백업으로 원복했고 `git status`/`git diff` 로 작업트리가 origin 대비 깨끗함을 재확인했다.

### 회귀·엣지 케이스 평가

- `handler-output.adapter.spec.ts` 는 마스킹 제거 전후 대칭을 잘 잡았다 — 원문 통과(`[캐너리]` 5개 키 + 중첩 + 비-문자열 값) / aliasing 부수효과 고정(`toBe` identity) / egress 대조군(`deepRedactSecrets` 로 실제로 가려짐)까지 세 층을 분리해 테스트했다. `preserves config/output/meta/port/status as-is` 등 기존 회귀 테스트는 동작이 그대로라 유효하다.
- `mask-sensitive-fields.util.spec.ts` 의 빈 문자열 대조군(`expect(out.apiKey).toBe('')`)은 `typeof === 'string'` 같은 vacuous 단언(`12_00_05` W2 에서 실제로 재현된 실패 형태)을 피하고 값으로 직접 단언해 분기를 가른다.
- `ai-turn-executor.ts`/`websocket.service.ts` 변경은 주석/JSDoc 문구 정정뿐이고 로직 변경이 없어 신규 테스트가 불필요하다는 판단이 맞다 — 실행 로직 diff 없음을 `Read` 로 확인.
- Mock 사용처는 없다(순수 함수 + in-memory Map 기반 서비스라 실제 구현을 그대로 호출) — mock/실제 동작 괴리 위험 자체가 낮은 설계다.
- 각 spec 파일의 테스트는 `beforeEach` 로 독립된 `service`/`context` 를 새로 만들거나(그렇지 않다면 최소 이 diff 가 추가한 테스트들은 기존 `describe` 블록의 공유 fixture 를 재사용) 순수 함수 입력을 매번 새로 만들어 격리가 유지된다 — 순서 의존 부작용은 관찰되지 않았다.

### 요약
이 diff 의 실질 코드 변경(어댑터 마스킹 제거, 상수 export, 포함관계 캐너리, 참조-저장 캐너리)은 테스트 관점에서 이미 5라운드에 걸쳐 CRITICAL 1건(안전장치가 파생되지 않았던 결함)을 잡고 수렴한 상태이며, 이번 라운드 재검증에서 그 두 핵심 캐너리(포함관계·참조-저장)를 직접 뮤테이션으로 재현해 실제로 분기를 가르는 것을 독립적으로 확인했다 — 문서(RESOLUTION.md)의 주장을 신뢰하지 않고 실측했다. `adaptHandlerReturn`/`maskSensitiveFields`/`ExecutionContextService.setStructuredOutput` 모두 순수 함수 또는 in-memory 서비스라 테스트 용이성이 높고 mock 이 불필요한 구조다. 남은 갭은 두 건 모두 이미 이전 라운드에서 지적되고 비차단으로 처분된 INFO 수준(egress 게이트웨이 함수를 실제로 통과하는 end-to-end 테스트 부재, 신규 테스트 2건의 사소한 캐스트 중복)뿐이며 신규 결함은 발견되지 않았다.

### 위험도
LOW
