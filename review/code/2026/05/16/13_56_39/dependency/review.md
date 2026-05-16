# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: `backend/package.json`, `frontend/package.json`
  - 상세: 이번 변경(10개 소스 파일 수정)에서 `package.json` 또는 `package-lock.json`의 변경이 전혀 없다. 새 외부 라이브러리를 도입하지 않았으므로 라이선스 검토, 취약점 점검, 번들 크기 영향 문제가 발생하지 않는다.
  - 제안: 해당 없음.

- **[INFO]** 기존 의존성 재사용으로 목적 달성
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`, `frontend/src/app/(main)/integrations/page.tsx`
  - 상세: `computeAttentionBreakdown` 헬퍼는 새 라이브러리 없이 기존 `needsAttention()` 함수를 재사용해 단일 진실 원칙을 유지한다. UI 렌더링도 이미 번들에 포함된 `AlertTriangle`(lucide-react), `cn`(tailwind-merge 등) 유틸리티만 사용한다. 번들 크기 영향은 없다.
  - 제안: 해당 없음.

- **[INFO]** 내부 의존 방향 정상
  - 위치: 변경된 모든 파일의 import 경로
  - 상세: 내부 의존 방향이 명확히 단방향으로 정리되어 있다.
    - `page.tsx` → `status-badge.tsx` (`computeAttentionBreakdown`, `AttentionBreakdown`)
    - `status-badge.tsx` → `lib/api/integrations.ts` (`IntegrationDto`)
    - `integrations.service.ts` → `dto/integration.dto.ts` (`INTEGRATION_STATUSES`, `IntegrationStatusFilter`)
    순환 참조가 없고 레이어 경계(`lib/api` → `_shared` → `page`)를 지킨다. 백엔드도 기존 서비스 레이어 구조(DTO → Service → Controller)를 유지한다.
  - 제안: 해당 없음.

- **[INFO]** `needsAttention` 제거 및 `computeAttentionBreakdown` 위임
  - 위치: `frontend/src/app/(main)/integrations/page.tsx` line 26-29
  - 상세: `page.tsx`에서 `needsAttention`을 직접 import하던 코드가 `computeAttentionBreakdown` 한 곳으로 통합되었다. `needsAttention`은 `status-badge.tsx` 안에 export로 유지되므로 테스트에서 직접 참조하는 `status-badge.test.tsx`의 import는 영향이 없다. 다른 소비자(consumer)가 `needsAttention`을 import하고 있다면 아무 변경도 발생하지 않아 하위 호환성이 유지된다.
  - 제안: 해당 없음.

## 요약

이번 변경은 외부 패키지를 일절 추가하지 않고 기존 의존성과 내부 유틸리티만으로 "Attention 가상 필터" 기능 전체를 구현하였다. 라이선스, 취약점, 번들 크기, 버전 고정 관점에서 새로 검토할 대상이 없으며, 내부 모듈 간 의존 방향도 단방향·계층 구조를 잘 준수하고 있다. 의존성 관점에서 지적할 위험 요소가 없는 변경이다.

## 위험도

NONE
