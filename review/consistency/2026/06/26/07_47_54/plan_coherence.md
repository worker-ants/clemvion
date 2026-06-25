# Plan 정합성 검토 결과

검토 대상: `03 M-1` 구현 착수 전 (--impl-prep)
Target: `integration-oauth.service.ts handleInstall(cafe24)·handleMakeshopInstall` 동일 보일러플레이트 4종 private helper 추출
관련 plan: `plan/in-progress/refactor/03-maintainability.md §M-1`

## 발견사항

발견된 CRITICAL / WARNING / INFO 항목 없음.

### 근거 요약

1. **미해결 결정과의 충돌 — 없음**

   - `plan/in-progress/refactor/03-maintainability.md §M-1` 은 추출 대상을 timestamp ±5min 가드·nonce replay 가드·post-install redirect·reauthorize state 생성/save 4종으로 명시한다.
   - 구현 범위 설명이 이 4종을 그대로 열거하고 있어 plan 이 규정한 추출 경계와 일치한다.
   - makeshop HMAC 빌더(`buildMakeshopHmacMessage`)가 "`VERIFY` 미확정이므로 주입 함수로 격리" 해야 한다는 plan M-1 제약 → 범위 설명이 "HMAC 검증(빌더 buildHmacMessage/buildMakeshopHmacMessage 이미 분리)" 으로 명시 확인하고 있다.
   - `error-codes.md §2 prefix rename 금지`는 plan M-1 Option A 각주 "에러 코드는 provider 별 유지(rename 금지)" 를 그대로 반영한다.

2. **선행 plan 미해소 — 없음**

   - `C-3 [Critical] Cafe24/MakeShop API 클라이언트 구조 중복` 은 "결정 대기(사용자)" 상태이나, M-1 이 건드리는 범위(`integration-oauth.service.ts` install 흐름)는 API 클라이언트 클래스(`cafe24-api.client.ts`/`makeshop-api.client.ts`)와 분리된 영역이다. 두 plan 의 파일 소유 범위가 겹치지 않는다.
   - `spec/4-cafe24.md §9.8` 과 `spec/5-makeshop.md §9.7` 의 VERIFY-pending HMAC 격리는 M-1 의 "주입 함수로 격리" 설계가 이미 수용한 조건이며, 별도 planner 승인 없이 진행 가능하다.

3. **후속 항목 누락 — 없음**

   - M-1 추출은 behavior-preserving이므로 spec 갱신이 불요하다고 plan 에 명시되어 있다.
   - `02-architecture.md §M-2` (handleCallback strategy화)가 M-1 과의 경계를 "callback 은 02 M-2 에 위임" 으로 plan 에서 이미 분리했고, 본 구현 범위도 그 경계를 명시적으로 준수(callback 공통화 미포함)하고 있다.
   - `C-3` 및 `M-4` 의 deferral 결정을 M-1 이 무효화하지 않는다.

## 요약

`03 M-1` 구현 범위 설명은 `plan/in-progress/refactor/03-maintainability.md §M-1` 이 규정한 추출 대상 4종, HMAC 빌더 격리 제약, 에러 코드 prefix rename 금지, callback 경계 분리 원칙과 완전히 정합한다. 미해결 결정 항목(`C-3` API 클라이언트 deferral, `M-4` frontend deferral)과의 파일 범위 교차가 없으며, spec 변경 없이 닫히는 behavior-preserving 리팩터링이므로 후속 plan 갱신도 필요하지 않다. 차단 사유 없음.

## 위험도

NONE
