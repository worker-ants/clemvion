# Cross-Spec 일관성 검토 결과

**검토 모드**: --impl-done  
**대상 spec**: `spec/2-navigation/4-integration.md`  
**diff base**: `origin/main`  
**검토 일시**: 2026-06-19

---

## 발견사항

발견된 Cross-Spec 충돌 없음.

---

## 요약

이번 변경은 `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` 하단에 있던 `DangerTab` React 컴포넌트를 동일 디렉토리의 신규 파일 `danger-tab.tsx`로 verbatim 추출한 순수 기계적 리팩터링이다. spec 파일에는 어떠한 변경도 없으며, 컴포넌트의 동작(삭제 pre-check 흐름 §4.7, 409 race condition 처리, scope 변경 흐름), API 호출 패턴(`integrationsApi.usages`, `integrationsApi.remove`, `integrationsApi.updateScope`), 데이터 모델(IntegrationDto, IntegrationScope, UsageWorkflow), RBAC 권한 구조, 상태 전이 로직 어느 것도 수정되지 않았다. `page.tsx`의 `@internal` 주석이 제거되고 `danger-tab.tsx`에서 공식 named export로 승격됐으나, 이는 테스트 전용 export를 전용 파일의 정식 export로 전환한 것으로 spec의 어떤 조항과도 모순되지 않는다. 검토한 6가지 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·권한/RBAC·계층 책임) 모두에서 기존 spec 영역과의 충돌이 없다.

---

## 위험도

NONE
