### 발견사항

- **[INFO]** `jwt-exp.ts` — 신규 공개 함수 `parseJwtExp` 의 독스트링 품질이 매우 우수
  - 위치: `codebase/backend/src/modules/integrations/jwt-exp.ts` 전체
  - 상세: 함수 목적, 설계 근거("왜 검증 없이 디코드만 하는가", "왜 직접 base64url 디코드 하는가"), 반환 규약, 호출자 계약(null 시 fallback chain 책임)이 모두 명시돼 있다. spec 참조 링크도 포함.
  - 제안: 현 상태 유지. 추가 개선 불필요.

- **[INFO]** `integration-oauth.service.ts` — `parseTokenExpiresAt` 함수 독스트링이 변경 내용을 반영해 완전히 갱신됨
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` line 1661-1686
  - 상세: 새로 추가된 4단계 precedence (JWT exp → expires_in → expires_at ISO with KST 정규화 → 2h default) 가 JSDoc 에 정확히 서술되어 있고, 옛 설명 ("표준 `expires_in` → cafe24 의 `expires_at` ISO") 이 적절히 교체되었다.
  - 제안: 현 상태 유지.

- **[INFO]** `hasTimezoneDesignator` (private 함수) — 신규 private 함수에 독스트링 있음
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` line 526-532
  - 상세: private 함수임에도 동작과 배경 이유, spec 참조가 명시되어 있어 유지보수성이 높다.
  - 제안: 현 상태 유지.

- **[INFO]** `cafe24-api.client.ts` — `normalizeCafe24IsoTimezone` 신규 private 함수에 독스트링 있음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` line 1429-1391
  - 상세: 함수 목적, 회귀 원인 히스토리, spec 참조가 포함되어 있어 독스트링 품질이 양호하다. `hasTimezoneDesignator`와 `normalizeCafe24IsoTimezone` 두 함수가 각각 다른 파일에 존재하며 동일한 정규식 `/Z$|[+-]\d{2}:?\d{2}$/`을 중복 정의하고 있으나, 이는 문서화 관점이 아닌 코드 중복 문제다.
  - 제안: 현 상태 유지 (문서화 측면).

- **[WARNING]** `cafe24-token-refresh.processor.ts` — short-circuit skip 로직에 인라인 주석은 풍부하나, 공개 `process` 메서드 상단 JSDoc 이 신규 `source='reactive_401'` 동작을 반영하지 않았을 가능성
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` line 99 일대 (메서드 레벨 JSDoc 확인 필요)
  - 상세: diff 에는 메서드 내부 인라인 주석만 보이고 `process()` 의 메서드 레벨 JSDoc 변경이 포함되지 않았다. 메서드 레벨 독스트링에 "source='reactive_401'일 때 short-circuit을 skip한다"는 동작이 명시되어 있지 않으면 외부 호출자가 이 동작을 이해하기 어렵다.
  - 제안: `process()` 메서드 독스트링(존재 시)에 `reactive_401` source 의 short-circuit skip 예외 동작을 한 줄 이상 추가.

- **[WARNING]** `cafe24-api.client.ts` `performAuthRefresh` JSDoc — 이전 "refreshViaQueue('proactive')" 언급이 "refreshViaQueue('reactive_401')"으로 교체됐지만 메서드 독스트링의 전체 동작 설명과 정합성 확인 필요
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` line 697-718 (performAuthRefresh 독스트링)
  - 상세: diff 에서 JSDoc 내 "proactive" 언급이 "reactive_401"로 교체된 변경이 포함되어 있다. 그러나 이 함수의 독스트링 첫 문단("refresh+1회 retry 정책을 공유하기 위한 단일 진입점")은 여전히 정확하며, 변경된 내용(source='reactive_401'이 short-circuit을 skip)도 독스트링에 반영되어 있다. 이는 적절히 처리된 것으로 보인다.
  - 제안: 현 상태 유지. 다만 "proactive"에서 "reactive_401"로 변경된 것이 메서드 시그니처나 외부 계약에 영향을 준다면 caller 사이트 주석도 확인 권장.

- **[INFO]** 테스트 파일 `jwt-exp.spec.ts` — 모듈 레벨 JSDoc 이 신규 파일에 잘 작성됨
  - 위치: `codebase/backend/src/modules/integrations/jwt-exp.spec.ts` line 1-13
  - 상세: 테스트 파일 상단에 테스트 대상(`parseJwtExp`), 배경 컨텍스트(Cafe24 JWT 특성), signature 미검증 이유, spec 참조가 모두 명시돼 있어 테스트 의도가 명확하다.
  - 제안: 현 상태 유지.

- **[INFO]** 테스트 파일의 개별 `it` 블록 주석 — 회귀 보호 의도가 명시됨
  - 위치: `integration-oauth.service.cafe24.spec.ts`, `cafe24-api.client.spec.ts`, `cafe24-token-refresh.processor.spec.ts` 각 신규 테스트 블록
  - 상세: 각 회귀 테스트 블록 위에 날짜(2026-05-18), 문맥, spec 참조가 JSDoc 형식으로 기재되어 있어 미래 유지보수자가 이 테스트가 왜 존재하는지 빠르게 파악 가능하다.
  - 제안: 현 상태 유지.

- **[INFO]** `cafe24-token-refresh.constants.ts` — `source` 필드 JSDoc 이 신규 `'reactive_401'` 값을 상세히 설명
  - 위치: `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts` line 112-122
  - 상세: 기존 단일 줄 주석이 확장되어 각 source 값의 의미, reactive_401의 신규 도입 날짜, short-circuit guard skip 동작이 명확히 설명되어 있다.
  - 제안: 현 상태 유지.

- **[WARNING]** README / CHANGELOG 업데이트 없음
  - 위치: 프로젝트 루트 `README.md`, `CHANGELOG.md` (존재 시)
  - 상세: Cafe24 토큰 만료 처리 방식이 JWT exp 기반으로 변경되고 `reactive_401` source 라는 새 동작이 추가되었다. 이 변경은 운영 관점에서 중요한 버그 수정(9h skew 회귀, 401 반복 차단)이나 README 나 CHANGELOG 에 대한 업데이트가 이번 diff 에 포함되지 않았다. 프로젝트가 CHANGELOG 를 운영하는 경우 이 수정이 누락된다.
  - 제안: 프로젝트에 CHANGELOG 가 있으면 "Cafe24 JWT exp 기반 만료 추출로 전환, TZ 모호성으로 인한 9h skew 회귀 차단" 항목을 추가. README 에 Cafe24 통합 관련 설명 섹션이 있다면 업데이트 검토.

- **[INFO]** `plan/in-progress/cafe24-jwt-exp-fix.md` — 작업 항목과 배경이 상세히 문서화됨
  - 위치: `plan/in-progress/cafe24-jwt-exp-fix.md` 전체
  - 상세: 문제 현상, 원인 분석(C1 TZ 모호성, C2 short-circuit 신뢰 오류), 해결 방향, 코드 및 테스트 작업 항목이 체계적으로 정리되어 있다. frontmatter(worktree, started, owner)도 규약에 맞게 기재됨.
  - 제안: 모든 작업 항목이 완료되면 `plan/complete/`로 `git mv` 이동 필요.

- **[INFO]** spec 참조 링크 일관성
  - 위치: 모든 변경 파일의 JSDoc/주석
  - 상세: 모든 관련 파일이 동일한 spec 참조(`spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)"`)를 일관되게 포함하고 있어 문서 추적성이 좋다.
  - 제안: 현 상태 유지.

- **[INFO]** `makeFakeJwt` helper 중복 — 두 테스트 파일에 동일 함수가 각각 정의됨
  - 위치: `integration-oauth.service.cafe24.spec.ts` line 143-162, `cafe24-api.client.spec.ts` line 1010-1020
  - 상세: 문서화 관점에서 두 파일에 동일한 JSDoc이 각각 붙어 있어 내용은 정확하다. 코드 중복(DRY 위반) 자체는 문서화 범위 밖이나, 공유 테스트 유틸리티로 추출한다면 JSDoc 도 한 곳으로 통합 가능.
  - 제안: 문서화 품질 자체는 양호. 공유 유틸리티화 시 JSDoc을 유틸리티 파일로 이전.

### 요약

이번 변경의 문서화 품질은 전반적으로 높다. 신규 공개 함수(`parseJwtExp`)와 private helper(`hasTimezoneDesignator`, `normalizeCafe24IsoTimezone`) 모두 목적·설계 근거·반환 규약·spec 참조를 포함하는 충실한 JSDoc을 갖추고 있다. 기존 `parseTokenExpiresAt` 독스트링도 4단계 precedence 변경을 정확히 반영해 갱신됐다. 각 회귀 테스트 블록에 날짜와 컨텍스트가 명시된 점, plan 문서에 원인 분석이 상세히 기술된 점도 유지보수성에 긍정적이다. 주요 개선 여지는 두 가지다: (1) `Cafe24TokenRefreshProcessor.process()` 메서드 레벨 독스트링이 `reactive_401` short-circuit skip 예외를 반영했는지 확인이 필요하고, (2) 이 변경이 운영 중요 버그 수정임에도 CHANGELOG 업데이트가 없는 것은 이력 추적 측면에서 아쉽다. 전체적으로 코드 내 문서화는 매우 충실하며 후속 유지보수자가 변경 맥락을 이해하는 데 충분한 정보가 제공되어 있다.

### 위험도

LOW
