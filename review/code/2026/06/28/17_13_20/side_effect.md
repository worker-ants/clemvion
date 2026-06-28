## 발견사항

- **[INFO]** `excludeAutoRefresh` 헬퍼 — QueryBuilder mutable 참조 명시적 전달
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.ts` — `excludeAutoRefresh` 헬퍼 정의 및 호출부
  - 상세: 헬퍼가 `qb`를 클로저로 캡처하지 않고 `qbRef` 인자로 받아 `andWhere`를 호출한다. QueryBuilder 공유 상태 변경이지만 호출자가 명시적으로 참조를 전달하므로 숨겨진 부작용이 아니다. `expiring` 분기 내에서만 호출되고 `else-if` 구조로 다른 분기와 상호 배타적이므로 순서 의존 문제 없음.
  - 제안: 현 구조 유지 가능. 기능적 이슈 없음.

- **[INFO]** `autoRefreshServiceTypes` — `findAll` 메서드 지역 변수, 매 호출마다 재계산
  - 위치: `integrations.service.ts` — `const autoRefreshServiceTypes = SERVICE_REGISTRY.filter(...).map(...)`
  - 상세: `SERVICE_REGISTRY`는 모듈 수준 불변 상수 배열이다. `filter`/`map` 결과는 매 호출마다 새 배열을 생성하지만 전역 상태를 변경하지 않는다. 배열 크기(autoRefresh=true 서비스 3개)가 작아 성능 영향 무시 가능.
  - 제안: 없음.

- **[INFO]** `attention` 분기 파라미터 키 — `expiring` 분기와 동일 키 `autoRefreshServiceTypes` 사용
  - 위치: `integrations.service.ts` — `attention` 분기 `autoRefreshExclusion` 문자열 보간 및 파라미터 객체
  - 상세: `expiring` 과 `attention` 은 `else-if` 구조로 상호 배타적이므로 같은 파라미터 키가 동일 QueryBuilder 인스턴스에 두 번 바인딩되는 일이 없다. 현재 안전하나, 향후 두 조건이 중첩되는 리팩토링이 발생한다면 TypeORM 파라미터 키 충돌이 생길 수 있다.
  - 제안: 현 구조 유지. 향후 조건 중첩 리팩토링 시 파라미터 키 충돌 주의.

- **[INFO]** `needsAttention` 함수 — 시그니처 유지, 반환 동작 변경
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `needsAttention` 함수
  - 상세: 시그니처(`(integration: IntegrationDto): boolean`)와 반환 타입은 변경 없다. `connected` + `expiring` + `autoRefresh=true` 케이스의 반환값이 `true` → `false`로 바뀐다. 이는 TODO 가드를 제거한 의도적 구현이며 사이드바 카운트·목록 attention 필터를 backend 쿼리와 정합하는 목적이다. 숨겨진 부작용 없음.
  - 제안: 없음.

- **[INFO]** `subLabel` 문자열 변경 — `"Auto-renews · in"` → `"Auto-renews · next in"`
  - 위치: `status-badge.tsx` — `subLabel` 생성부; `status-badge.test.tsx` — 정규식 어설션
  - 상세: UI 표시 문자열 변경이다. 이 값을 정확한 문자열로 파싱하거나 스냅샷 테스트로 고정하는 코드가 있다면 영향을 받는다. 테스트는 정규식을 `/Auto-renews/i` 에서 `/^Auto-renews · next in /` 로 강화해 정합을 맞췄다. diff 범위 내에서는 외부 파싱 의존성이 발견되지 않는다.
  - 제안: 스냅샷 테스트 존재 여부 확인 후 필요 시 갱신. 외부 파싱 의존성이 없으면 무시.

- **[INFO]** `SERVICE_REGISTRY` import 추가 (테스트 파일)
  - 위치: `integrations.service.spec.ts` — L35
  - 상세: 테스트에서 registry 동적 조회 결과를 assertion 기대값에 직접 사용한다. `SERVICE_REGISTRY` 내용이 변경되면 테스트 기대값도 자동으로 맞춰지는 설계다. 프로덕션 코드 부작용 없음.
  - 제안: 없음.

## 요약

이번 변경은 `integrations.service.ts`의 `findAll` 쿼리 로직과 `status-badge.tsx`의 `needsAttention`·`subLabel` 로직을 수정한다. 전역 변수 변경·환경 변수 접근·파일시스템 부작용·네트워크 호출·이벤트/콜백 변경은 전혀 없다. 함수 시그니처는 유지됐으며, `needsAttention`의 동작 변경(connected+expiring+autoRefresh=true → false 반환)은 기존 TODO 가드를 완성한 의도적 구현이다. `excludeAutoRefresh` 헬퍼가 QueryBuilder 참조를 명시적으로 수정하는 것은 숨겨진 상태 변경이 아니며, `attention` 분기와 `expiring` 분기의 동일 파라미터 키는 `else-if` 상호 배타성으로 현재 충돌 위험이 없다. 의도하지 않은 부작용이 식별되지 않는다.

## 위험도

NONE
