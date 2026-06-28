# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: autoRefresh attention 술어 구현 (4개 코드 파일 + 2개 MDX 문서)
diff-base: origin/main

---

## 발견사항

### [INFO] SERVICE_REGISTRY 정적 모듈 의존 — backend 서비스 레이어가 레지스트리 singleton 에 직접 결합
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L116–L118
- 상세: `IntegrationsService.findAll` 이 `SERVICE_REGISTRY` 배열을 직접 import 해 `autoRefreshServiceTypes` 목록을 파생한다. 현재 레지스트리는 순수 정적 배열로 구성되어 있고, NestJS DI 컨테이너 밖에서 초기화된다. 이 설계는 단순하고 테스트하기 쉬우며 실질적 결합도 문제가 없다. 다만 레지스트리가 DB·환경 설정 기반으로 전환될 경우 서비스 레이어가 직접 import 구조를 유지하는 것이 어려워진다.
- 제안: 현재 정적 레지스트리 구조에서 이상 없음. 향후 레지스트리가 비동기화되거나 DI 필요 시 `ServiceRegistryService` 추출을 고려할 수 있다.

---

### [INFO] `excludeAutoRefresh` 클로저 헬퍼 vs `attention` 분기 인라인 문자열 — 두 경로 혼재
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L132–L136 (헬퍼), L158–L168 (attention 인라인)
- 상세: 동일 SQL fragment(`AUTO_REFRESH_NOT_IN`)와 파라미터(`autoRefreshParams`)를 상수로 공유하여 단일 진실을 유지하는 것은 올바른 접근이다. 주석에서 `attention` 이 OR 합집합이므로 최상위 `andWhere` 헬퍼를 쓰면 `expired`/`error` 행까지 잘못 필터링된다는 점을 명확히 설명하고 있어, 두 경로를 의도적으로 분리한 근거가 충분히 문서화됐다. SQL fragment·파라미터 키를 공유 상수로 추출한 것은 DRY 원칙을 적절히 충족한다.

  아키텍처 관점에서 이 헬퍼는 `findAll` 메서드 내부 클로저로만 존재한다. SQL 필터 로직이 두 개 이상의 쿼리 분기에 걸쳐 파생 적용 패턴을 반복할 경우 별도 `QueryFilterBuilder` 추상화로 발전시킬 여지가 있으나, 현재 규모에서는 과도한 추상화다.
- 제안: 현행 유지. WARNING 없음.

---

### [INFO] 프론트엔드 `needsAttention` 단일 술어 함수 신설 — 도메인 로직 계층화 적절
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L376–L398
- 상세: `needsAttention` 이 `computeAttentionBreakdown`·사이드바 카운트의 기반 술어로 명시적으로 분리됐다. `computeStatus`(표시용 뷰 계산)와 `needsAttention`(비즈니스 술어)이 각각 단일 책임을 갖는 구조다. 이전 코드(`TODO` 주석과 인라인 `isExpiringSoon` 직접 반환)가 제거되고 명시적 술어 함수로 대체된 것은 SRP 준수다.

  `status-badge.tsx` 파일 하나에 UI 렌더링 헬퍼(`computeStatus`, `StatusBadge` 컴포넌트)와 비즈니스 술어(`needsAttention`, `computeAttentionBreakdown`)가 혼재하는 기존 구조는 이번 변경이 아닌 사전 구조이므로 이번 리뷰 범위 밖이나, 파일 분리 관점에서 중기 리팩토링 시 고려할 수 있다.
- 제안: 현행 유지.

---

### [INFO] frontend `autoRefresh` 술어와 backend `supportsTokenAutoRefresh` — 레이어 간 단일 진실 구조 확인
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L393–L396 vs `codebase/backend/src/modules/integrations/services/service-registry.ts` L74
- 상세: frontend 의 `!integration.autoRefresh` 가드는 backend `IntegrationDto.autoRefresh` 필드(= `ServiceDefinition.supportsTokenAutoRefresh` 에서 파생)를 신뢰한다. DTO를 통해 backend 레지스트리 진실이 frontend로 전달되는 구조이므로 frontend가 자체 provider 목록을 유지하지 않는다. 이는 레이어 의존 방향이 올바르다(frontend → DTO → backend registry, 반대 방향 없음). 순환 의존성 없음.
- 제안: 이상 없음.

---

### [INFO] `attention` 분기 connected 서브조건 인라인 SQL 문자열 조합 — SQL Injection 위험 없음 확인
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L158–L168
- 상세: `autoRefreshExclusion` 은 정적 상수(`AUTO_REFRESH_NOT_IN`)를 조건부로 포함하는 문자열 조합이며, 사용자 입력이 개입하지 않는다. `autoRefreshParams`는 TypeORM 파라미터 바인딩(`:...autoRefreshServiceTypes`)을 사용하므로 SQL Injection 위험 없음. 다만 템플릿 리터럴로 SQL fragment 를 조합하는 패턴(`` `...${autoRefreshExclusion}` ``)은 잠재적 오용 가능성이 있어, 후속 개발자가 이 패턴을 복사할 때 사용자 입력을 잘못 주입하지 않도록 주석으로 "정적 상수만 허용" 제약을 명시하면 좋다.
- 제안: 현행 동작 이상 없음. 주의사항 주석 추가 고려(차단 아님).

---

### [INFO] MDX 문서 레이어 — EN/KO 두 파일 동기 갱신 (단일 진실 원칙 준수)
- 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`, `integration-management.en.mdx`
- 상세: 동일 정책 변경(autoRefresh 통합의 attention 제외)이 KO/EN 두 문서에 동시에 반영됐다. 문서 이중 관리 구조는 기존 설계이며 이번 변경이 두 레이어를 동기화한 것은 올바르다. 순환 의존 없음.
- 제안: 이상 없음.

---

## 요약

이번 변경의 아키텍처 핵심은 `supportsTokenAutoRefresh` derived 필드 기반 동적 목록 조회 패턴이다. backend `SERVICE_REGISTRY` 정적 배열에서 `autoRefreshServiceTypes` 를 파생해 TypeORM 파라미터 바인딩으로 전달하는 방식은 service_type 리터럴 하드코딩을 배제하고 새 provider 추가 시 레지스트리만 갱신하면 되는 개방-폐쇄 원칙(OCP) 준수 설계다. `expiring`(최상위 `andWhere` 헬퍼)과 `attention`(OR 합집합 내 인라인 fragment) 두 경로가 같은 SQL 상수를 공유하면서 분리된 것은 SQL 의미론적 이유가 명확히 문서화되어 있어 의도적 설계로 인정된다. frontend `needsAttention` 술어 함수 명시화는 비즈니스 로직과 UI 계층 분리를 강화하는 적절한 변경이다. frontend-backend 간 의존 방향(frontend → DTO → backend registry)이 단방향으로 유지되며 순환 의존성이 없다. 전반적으로 레이어 책임 분리, 단일 진실 원칙, 모듈 경계가 유지된 건전한 아키텍처 변경이다.

## 위험도

NONE
