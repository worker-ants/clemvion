### 발견사항

---

- **[INFO]** 테스트 describe 문자열과 실제 언어 불일치 — 영문 전환 후 describe 레이블 잔존
  - 위치: `backend/src/nodes/data/code/code.schema.spec.ts` 파일 63행: `it('emits the Korean warning when code body is empty'`, `backend/src/nodes/logic/foreach/foreach.schema.spec.ts` 파일 34행: `it('emits the Korean warning when arrayField is missing'`, 외 다수
  - 상세: warningRule 메시지를 영문으로 전환했으나 해당 테스트 케이스의 describe/it 설명 문자열에 "Korean warning"이라는 표현이 잔존한다. 이제 더 이상 Korean message를 발행하지 않으므로 설명이 거짓(false)이 되어 테스트 가독성을 저해한다. 전환이 이루어진 노드만 해도 약 20개 파일에 걸쳐 반복된다.
  - 제안: `'emits the Korean warning when ...'` → `'emits the warning when ...'` 또는 `'emits the blocking warning when ...'` 으로 일괄 갱신. sed 또는 프로젝트 일괄 치환으로 처리하면 누락 없이 반영 가능.

---

- **[INFO]** 중복된 타입 추출 패턴 — 테스트 내 임시 타입 단언
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` 파일 592행: `const createArg = integrationRepo.create.mock.calls[0][0] as { lastRotatedAt?: Date; };`
  - 상세: `mock.calls[0][0]`를 `as { lastRotatedAt?: Date }` 로 인라인 단언한 뒤 한 줄만 사용한다. 이 패턴이 테스트 파일 내 다른 곳에서도 유사하게 반복될 경우 유지보수 시 타입 정의가 분산된다.
  - 제안: 반복이 2회 이상이면 별도 `type` 또는 `interface`로 추출하거나, `Parameters<typeof integrationRepo.create>[0]`처럼 제네릭을 활용하여 타입 일관성을 유지한다.

---

- **[INFO]** 매직 넘버 `3` — 연속 실패 임계값이 코드와 주석 양쪽에 분산
  - 위치: `backend/migrations/V049__integration_consecutive_network_failures.sql` 14행 주석, `backend/src/modules/integrations/entities/integration.entity.ts` 378행 주석
  - 상세: "3 도달 시점에 error 전이"라는 임계값이 마이그레이션 SQL 주석, 엔티티 주석, 그리고 (표시되지 않은 diff 이지만) `Cafe24ApiClient` 구현 코드에 모두 리터럴 `3`으로 산재할 가능성이 높다. 이 숫자가 변경될 경우 여러 위치를 동기화해야 한다.
  - 제안: `CONSECUTIVE_NETWORK_FAILURE_THRESHOLD = 3` 과 같은 상수를 `backend/src/nodes/integration/cafe24/constants.ts`(또는 integrations 모듈 공통 상수 파일)에 선언하고, 엔티티 주석·클라이언트 로직 모두 해당 상수를 참조하도록 통일한다.

---

- **[INFO]** `OAuthBeginResultDto` — 유니온 분기를 하나의 클래스로 표현하여 가독성 저하
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 파일 300~348행
  - 상세: 두 개의 독립적인 응답 형태(일반 OAuth 흐름 vs. Cafe24 Private pending 흐름)를 모든 필드를 optional로 만든 단일 DTO로 표현한다. 이 방식은 어떤 필드 조합이 유효한지 타입 수준에서 강제할 수 없고, 코드를 처음 읽는 사람이 유효한 조합을 파악하기 어렵다. 클래스 JSDoc에 분기 조건이 설명되어 있지만 런타임과 컴파일 타임 모두에서 잘못된 조합을 막지 못한다.
  - 제안: `OAuthBeginNormalResultDto`와 `OAuthBeginCafe24PrivateResultDto`로 분리하거나, 판별 유니온 타입(`type OAuthBeginResultDto = NormalResult | Cafe24PrivateResult`)으로 명시하여 각 분기의 필수 필드를 타입 수준에서 표현한다. 단기적으로는 현재 구조를 유지하더라도 JSDoc에 "두 그룹은 배타적"임을 더 명확히 표기할 것을 권장한다.

---

- **[WARNING]** 병렬 스키마 설명 필드(`description`)에 혼합 언어 잔존
  - 위치: `backend/src/nodes/logic/parallel/parallel.schema.ts` 파일 113행: `'Fan-out input to N branches. PARALLEL_ENGINE=v1 일 때 각 분기가 동시 실행되며...'` → 이번 변경에서 영문으로 수정됨. 수정 후 `'Fan-out input to N branches. Each branch runs concurrently when PARALLEL_ENGINE=v1, otherwise sequentially in topological order.'`
  - 상세: 이번 PR에서 해당 description은 영문 전환되었으나, 다른 노드의 `description` 필드 및 `summaryTemplate.warnMessage` 필드가 여전히 혼합 언어 상태인지 확인이 필요하다. 리뷰 대상 diff에서 `cafe24.schema.ts`의 `warnMessage: 'Resource / operation not selected'`는 전환됐지만, 전체 코드베이스에서 warningRules 범위 밖의 `description`이나 `label` 필드가 통일됐는지 보장이 없다. 일관성 부재 시 유지보수 시 어느 파일이 영문인지 한국어인지 추적 비용이 증가한다.
  - 제안: 노드 메타데이터의 사용자 노출 문자열(`label`, `description`, `warnMessage`, `warningRules[].message`)에 대한 언어 정책을 spec 또는 CLAUDE.md에 명시하고, 잔존 혼합 항목을 다음 이터레이션에서 일괄 정리한다.

---

- **[INFO]** `registry.test.ts` 실-파일 경로 검증 테스트의 `it.runIf` 조건부 스킵
  - 위치: `frontend/src/lib/docs/__tests__/registry.test.ts` 파일 189~214행
  - 상세: `hasRealDocs`가 false이면 테스트 전체를 skip하도록 구현되어 있다. 격리 환경 대응 의도는 이해되나, CI에서 `realDocsRoot`가 항상 존재하는 환경임에도 실수로 경로가 틀리거나 디렉터리가 비어있을 때 조용히 skip되어 회귀를 놓칠 위험이 있다.
  - 제안: `it.runIf`를 유지하되, skip 시 `console.warn` 또는 `console.info`로 "docs directory not found, skipping path-existence check" 메시지를 출력해 CI 로그에서 스킵 여부가 가시적으로 남도록 한다. 또는 CI 환경에서는 `hasRealDocs`가 반드시 `true`임을 단언하는 테스트를 분리하여 추가한다.

---

- **[INFO]** `node-config-summary.ts`의 `locale` 파라미터 기본값 위치
  - 위치: `frontend/src/lib/utils/node-config-summary.ts` 파일 62~63행: `locale: Locale = DEFAULT_LOCALE`
  - 상세: 기존 함수 시그니처에 `locale` 옵셔널 파라미터가 추가되었다. 기본값으로 `DEFAULT_LOCALE`을 사용하는 것은 합리적이나, 이 함수를 호출하는 다른 호출부가 locale을 전달하지 않을 경우 기본 locale로 폴백되어 locale 파라미터를 받는 의도가 희석될 수 있다. 유지보수 시 locale이 실제로 필요한 호출부를 찾기 어려워진다.
  - 제안: 기본값 제공은 유지하되, 함수 JSDoc에 "locale을 명시하지 않으면 DEFAULT_LOCALE로 fallback됨"을 명시하고, 주요 호출부(`custom-node.tsx`)에서 locale이 올바르게 전달되고 있음을 확인하는 테스트를 보완한다.

---

- **[INFO]** `e2e-test-full` 주석의 과도한 인라인 설명
  - 위치: `Makefile` 파일 94~102행
  - 상세: `e2e-test-full` 타겟의 `runner1 && runner2; STATUS=$$?` 패턴을 설명하는 8행짜리 인라인 주석이 추가되었다. 셸 단락 평가(short-circuit)에 익숙한 개발자에게는 불필요하게 길고, Makefile 타겟의 실제 동작보다 주석이 더 복잡해 보이는 역전 현상이 발생한다.
  - 제안: 주석을 2~3행 요약 수준으로 축소한다. "runner1 실패 시 runner2 skip, 항상 e2e-down 실행 후 STATUS 반환" 정도면 충분하다. 상세 배경은 CHANGELOG.md나 plan 문서에 이미 기록되어 있으므로 Makefile에서 중복 서술할 필요가 없다.

---

- **[INFO]** `if-else.schema.ts`에서 `First condition's field` 메시지의 이스케이프된 아포스트로피
  - 위치: `backend/src/nodes/logic/if-else/if-else.schema.ts` 파일 1800행: `message: 'First condition\'s field must be entered.'`
  - 상세: 작은따옴표 문자열 내에서 아포스트로피를 백슬래시로 이스케이프하고 있다. 동일 패턴이 `variable-declaration.schema.ts`의 `'First variable\'s name must be entered.'`와 `variable-modification.schema.ts`의 `'First modification\'s target variable must be selected.'`에도 반복된다.
  - 제안: 백슬래시 이스케이프 대신 큰따옴표 문자열(`"First condition's field must be entered."`)을 사용하거나, 일관성을 위해 소유격 표현 없이 `"Field of the first condition must be entered."`로 재작성한다. 코드베이스 내 다른 메시지들이 모두 작은따옴표를 사용하고 있으므로, 큰따옴표로 통일하면 스타일 불일치가 발생한다. 소유격 표현을 제거하는 방향이 더 일관적이다.

---

- **[WARNING]** `Cafe24TokenRefreshProcessor` 로그 메시지와 주석의 책임 혼재
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` 파일 1239~1256행
  - 상세: status 검증 조건을 `source === 'background'`에서 source 무관으로 확장하면서 15행짜리 주석이 추가되었다. 이 주석은 "왜 이렇게 했는지"(Rationale)와 "이게 안전한 이유"(Safety)를 동시에 설명하며, BullMQ dedup 동작의 구현 세부사항까지 포함한다. 로직 자체는 한 줄(`if (fresh.status !== 'connected')`)로 단순해졌지만 이를 이해하기 위해 15행을 읽어야 한다.
  - 제안: 핵심 이유("source 무관하게 connected 만 처리 — BullMQ dedup race-safe")를 2~3행으로 압축하고, 상세 배경(dedup 부수효과, 경쟁 조건 시나리오)은 spec 또는 CHANGELOG에 위임한다. 코드 인라인 주석은 결정 이유를 요약하고, 세부 논의는 외부 문서로 링크한다.

---

### 요약

이번 변경의 주요 축은 두 가지다: (1) 26개 이상의 노드 warningRule 메시지 및 관련 테스트를 한국어에서 영문 SoT로 전환, (2) Cafe24 연동의 안정성 강화(연속 실패 카운터, OAuth Private 흐름, 토큰 리프레시 race 수정). 유지보수성 관점에서 이번 변경은 전반적으로 잘 관리되고 있다. 메시지 전환은 스키마·핸들러·스키마 스펙 세 계층을 일관되게 갱신하였고, 마이그레이션·엔티티·서비스·테스트를 함께 추가하여 한 기능의 변경이 필요한 파일들을 누락 없이 포함했다. 다만 몇 가지 유지보수성 부채가 남는다: (a) 수십 개 테스트 케이스의 `it` 설명 문자열이 "Korean warning"이라는 표현을 그대로 유지하고 있어 전환 의도를 반영하지 못하고, (b) 연속 실패 임계값 `3`이 상수로 추출되지 않아 변경 시 분산된 위치를 동시에 수정해야 하며, (c) `OAuthBeginResultDto`의 유니온 분기가 타입 수준에서 명확히 분리되지 않아 잘못된 조합이 컴파일 타임에 탐지되지 않는다. Makefile 주석 길이와 아포스트로피 이스케이프 패턴은 소규모 스타일 개선 사항이다. 전체 위험도는 높지 않으나 위에 언급한 항목들은 코드베이스가 성장할수록 관리 비용이 누적될 수 있다.

### 위험도

LOW
