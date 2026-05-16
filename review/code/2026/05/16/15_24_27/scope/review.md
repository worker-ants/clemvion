# 변경 범위(Scope) 리뷰

## 변경 의도

Cafe24 동일 mall_id 중복 감지 UX 보강:
1. Public begin 단계 사전 가드 추가
2. `throwIfUniqueViolation` 에서 `idx_integration_cafe24_workspace_mall` constraint 처리
3. `GET /api/integrations/cafe24/precheck` endpoint 신설
4. 프론트엔드 inline 경고 배너 + Connect 버튼 disable
5. 한국어/영어 i18n 키 추가

---

## 발견사항

### 파일 4: integration-oauth.service.ts

- **[INFO]** `findAllCafe24RowsForMall` / `findConnectedCafe24MallIntegration` private helper 추출
  - 위치: `integration-oauth.service.ts` +456~+482
  - 상세: 기존 private begin 로직에서 인라인으로 작성되어 있던 중복 탐지 쿼리가 재사용 가능한 헬퍼로 추출되었다. 이는 public begin 가드와 precheck endpoint 공유를 위한 필수 리팩토링으로, 변경 의도와 직접적으로 연관된다.
  - 제안: 현재 작업 범위 내 정당한 리팩토링. 유지.

- **[INFO]** `handleInstall` 내 인라인 중복 탐지 쿼리가 `findAllCafe24RowsForMall` 호출로 대체
  - 위치: `integration-oauth.service.ts` +426~+432 (기존 `-392~-426` 코드 제거)
  - 상세: 기존 두 번의 `integrationRepository.find` 직접 호출과 in-memory 필터가 헬퍼로 위임되었다. 기능 변화 없이 구조만 개선된 것으로, public begin 가드 추가와 코드 재사용을 위해 필요한 변경이다.
  - 제안: 변경 의도와 부합. 유지.

- **[INFO]** 주석 변경: 기존 `handleInstall` 의 인라인 설명 주석(C2+E2 상세 내역 28행)이 간결한 1행 주석으로 교체
  - 위치: `integration-oauth.service.ts` +426~+432
  - 상세: 기존 주석은 C2(app_type 무관 조건 수정)와 E2(DB 직접 조회) 개선 경위를 상세히 설명하고 있었다. 이 정보가 새 주석에서는 누락되었다. 이력성 정보가 사라지나 코드 자체의 동작에는 영향 없다.
  - 제안: 허용 가능한 주석 정리. 과거 이력이 필요하다면 git log에서 확인 가능.

### 파일 5: integrations.controller.ts

- **[WARNING]** Swagger doc 문구 수정 (`@ApiConflictResponse` description 변경)
  - 위치: `integrations.controller.ts` line 581~582
  - 상세: 기존 `"private"` 맥락 한정 설명을 `"app_type 무관"` 으로 일반화하는 변경은 새 기능(public begin 가드)과 직접 연관된다. 그러나 이는 API 문서(Swagger)의 변경으로, 변경 의도에 포함된 항목이다.
  - 제안: 변경 의도와 부합. 유지.

- **[INFO]** 라우트 선언 순서 주석 추가 (`// ※ 라우트 선언 순서 주의`)
  - 위치: `integrations.controller.ts` +591~+596
  - 상세: NestJS 라우트 우선순위 충돌 방지를 위한 설명 주석. consistency-check Warning #7을 반영한 것으로 변경 의도 범위 내에 해당한다.
  - 제안: 유지.

### 파일 7: integrations.service.ts

- **[INFO]** `throwIfUniqueViolation` 내부 리팩토링 (조건 구조 변경)
  - 위치: `integrations.service.ts` +726~+732
  - 상세: 기존 `if (code === '23505' && constraint === 'integration_workspace_name_unique')` 단일 블록이 `if (code !== '23505') return;` 조기 반환 + 각 constraint별 분기로 재구성되었다. `idx_integration_cafe24_workspace_mall` 분기 추가를 위해 필요한 최소한의 구조 변경이다.
  - 제안: 변경 의도와 부합. 유지.

### 파일 10: frontend/src/app/(main)/integrations/new/page.tsx

- **[INFO]** `formatErrorToast` 헬퍼 함수 추가 및 기존 onError 핸들러 2개소 교체
  - 위치: `page.tsx` +1305~+1320, +1336~+1338, +1347~+1348
  - 상세: `createMutation.onError`와 `oauthBeginMutation.onError` 양쪽에서 중복되어 있던 error 메시지 추출 로직을 `formatErrorToast` 로 통합하고 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드에 대한 한글 i18n 메시지 처리를 추가했다. 이는 한국어 toast 요구사항(변경 의도 #4)을 구현하기 위한 필수 리팩토링이다.
  - 제안: 변경 의도와 부합. 유지.

- **[INFO]** `TranslationKey` 타입 임포트 추가
  - 위치: `page.tsx` +1245
  - 상세: `formatErrorToast` 함수 시그니처에서 `fallbackKey: TranslationKey` 파라미터 타입 지정을 위해 필요한 임포트다. 실제 사용처가 있다.
  - 제안: 유지.

- **[INFO]** `AlertTriangle` 아이콘 임포트 추가
  - 위치: `page.tsx` +1224
  - 상세: 인라인 경고 배너에서 실제 사용되는 아이콘이다.
  - 제안: 유지.

- **[INFO]** `Cafe24PrecheckResult` 타입 임포트 추가
  - 위치: `page.tsx` +1238
  - 상세: 상태 변수 `cafe24Conflict`의 타입 지정에 실제 사용된다.
  - 제안: 유지.

### 파일 14: plan/in-progress/cafe24-mall-dup-ux.md

- **[INFO]** plan 문서의 진행 상태 체크박스 다수가 미완(`[ ]`) 상태로 커밋
  - 위치: `plan/in-progress/cafe24-mall-dup-ux.md` 하단 "진행 상태" 섹션
  - 상세: Backend (1)~(3), Frontend (4), TEST+REVIEW, Spec 위임 항목이 모두 `[ ]` 상태다. 코드 변경은 이미 완료된 것으로 보이나 plan 문서가 갱신되지 않았다. plan 문서와 실제 구현 완료 상태가 불일치한다.
  - 제안: 완료된 항목은 `[x]` 로 갱신 필요. plan 라이프사이클 규약 위반.

### 파일 16~17: review/consistency/2026/05/16/14_28_20/ 하위 파일들

- **[INFO]** consistency-check 산출물이 변경 커밋에 포함
  - 위치: `review/consistency/2026/05/16/14_28_20/SUMMARY.md` 및 `_prompts/` 하위
  - 상세: consistency-check 실행 결과물(`SUMMARY.md`, `_prompts/*.md`)이 동일 PR 커밋에 포함되어 있다. 이는 `review/consistency/**` 쓰기 권한이 있는 파일로, consistency-checker 역할의 정당한 산출물이다. 변경 의도와 무관한 파일이나 별도 커밋으로 분리하지 않고 함께 포함된 것은 추적 목적상 허용 가능하다.
  - 제안: 기능적 문제 없음. 선호에 따라 별도 커밋으로 분리 가능.

---

## 요약

이번 변경은 Cafe24 mall_id 중복 감지 UX 보강이라는 명확한 의도 하에 backend DTO, 서비스, 컨트롤러, 프론트엔드 페이지, i18n 딕셔너리, 테스트(unit + e2e), plan 문서를 일관되게 수정했다. 변경 의도와 관련 없는 파일이 수정된 사례는 없으며, 의도 이상의 기능 확장도 발견되지 않았다. 단 한 가지 주의할 점은 `plan/in-progress/cafe24-mall-dup-ux.md` 의 진행 상태 체크박스가 실제 구현 완료 상태와 불일치하는 것으로, plan 문서 라이프사이클 규약에 따라 완료된 항목을 `[x]` 로 갱신해야 한다.

## 위험도

LOW
