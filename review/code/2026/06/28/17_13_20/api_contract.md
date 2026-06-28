# API 계약(API Contract) 리뷰

## 발견사항

변경된 파일 목록:

1. `codebase/backend/src/modules/integrations/integrations.service.ts` — `findAll` 내부 SQL 필터 로직 변경
2. `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — 단위 테스트 추가
3. `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — 프론트엔드 필터 로직 + UI 문자열 수정
4. `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` — 테스트 추가
5. `review/code/2026/06/28/17_04_07/SUMMARY.md` — 리뷰 보고서 파일 (STALE, 참고용)
6. `review/code/2026/06/28/17_04_07/_retry_state.json` — 리뷰 상태 파일

### 하위 호환성

- **[INFO]** `GET /integrations?status=attention` 및 `GET /integrations?status=expiring` 의 응답 행 집합이 축소됨 (`autoRefresh=true` 서비스 타입이 만료 임박 분기에서 제외)
  - 위치: `integrations.service.ts` `findAll` status 필터 분기
  - 상세: 이 변경은 동일 엔드포인트·파라미터 구조를 유지하면서 반환 데이터 범위가 좁아진다. 기존 클라이언트가 `attention`/`expiring` 응답에서 cafe24/google/makeshop 통합이 만료 임박 상태로 포함되기를 기대한다면 동작이 달라진다. 단, spec §2.4·§9.1 설계 의도에 따른 버그 수정(거짓 양성 제거)이므로 의도된 breaking change 이며 실질적 계약 파손은 아님.
  - 제안: 특이사항 없음. 단, API 문서/changelog 에 "attention/expiring 필터에서 autoRefresh 통합의 만료 임박 행이 제외됨" 명시 권고.

### 응답 형식

- API 응답 DTO 구조에 변경 없음. `autoRefreshServiceTypes` 는 쿼리 파라미터 바인딩에만 사용되고 응답 스키마에 노출되지 않음.

### 에러 응답

- `autoRefreshServiceTypes.length === 0` 이면 `NOT IN ()` 절을 생략하는 방어 로직이 구현됨 — SQL 문법 오류로 인한 500 응답 리스크가 적절히 처리됨.

### 요청 검증

- 변경 범위 내 요청 파라미터 검증 로직 수정 없음. 기존 `status` 쿼리 파라미터 검증이 그대로 유지됨.

### URL/경로 설계

- API 경로 변경 없음.

### 페이지네이션

- 페이지네이션 관련 변경 없음.

### 인증/인가

- 인증/인가 관련 변경 없음.

## 요약

이번 변경은 `GET /integrations?status=attention|expiring` 엔드포인트의 내부 SQL 필터 로직을 수정한 것으로, API 경로·요청 파라미터 구조·응답 DTO 스키마·인증/인가·페이지네이션 모두 변경되지 않았다. 응답 데이터 범위가 spec §9.1 정의에 맞게 좁혀지는 것은 설계 의도에 따른 동작 수정이며, `autoRefreshServiceTypes` 가 빈 배열일 때 `NOT IN ()` 절을 생략하는 방어 로직도 적절히 구현되어 있다. API 계약 관점의 실질적 위험은 없음.

## 위험도

NONE
