# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 신규 헬퍼 `throwAuthConfigNotFound()`(코드 `RESOURCE_NOT_FOUND`, HTTP 404)가 `triggers.service.ts` 의 `AUTH_CONFIG_NOT_FOUND`(400, 요청 검증 실패)와 이름이 근접함
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `throwAuthConfigNotFound` 정의부(JSDoc 포함 블록)
  - 상세: 두 식별자는 상태 코드(404 vs 400)도 code 문자열(`RESOURCE_NOT_FOUND` vs `AUTH_CONFIG_NOT_FOUND`)도 다른 별개 계약이다. 직접 `Read` 로 확인한 결과 헬퍼 JSDoc 에 "`triggers.service.ts` 의 `AUTH_CONFIG_NOT_FOUND` 와 다른 자리다" 라는 명시적 구분 문단이 이미 있고, 이 항목은 직전 리뷰 라운드(`review/code/2026/09/21/15_18_16/api_contract.md` INFO 13)에서 이미 지적·완화 완료로 처리된 사안이다. 신규 결함이 아니라 이력상 재확인.
  - 제안: 조치 불요 — 향후 이 두 에러 코드 주변을 만질 때 혼동 방지 차원의 상호 참조만 유지.

## 확인된 계약 안정성 (문제 없음)

- **하위 호환성**: 컨트롤러 시그니처(`DELETE /api/auth-configs/:id`), 요청 파라미터, 응답 바디 형식 변경 없음. `remove()` 는 내부 구현(엔티티 `remove` → 조건부 `delete`)만 교체됐고 외부에 노출되는 타입(`Promise<void>`)도 동일 — breaking change 없음.
- **버전 관리**: 신규/변경 엔드포인트 없음. 버전 관리 이슈 해당 없음.
- **응답 형식**: 성공 204(`@HttpCode(HttpStatus.NO_CONTENT)`, `auth-configs.controller.ts:218` 직접 확인), 실패 404 `{error:{code:'RESOURCE_NOT_FOUND', message}}` — `GlobalExceptionFilter` 의 표준 에러 봉투(`http-exception.filter.ts`)와 일치. 변경 전후 스키마 동일.
- **에러 응답**: 신규 e2e(`test/auth-config-delete-concurrency.e2e-spec.ts`)가 검증하는 진 쪽 코드가 `findById()` 가 이미 쓰는 `RESOURCE_NOT_FOUND` 와 **동일**해, "없어서 404" 와 "져서 404" 가 같은 코드로 수렴한다 — 클라이언트가 두 경우를 구분할 필요가 없어 일관성 측면에서 바람직하다.
- **요청 검증**: 이번 diff 는 DTO/파라미터 검증 로직을 건드리지 않는다.
- **URL/경로 설계**: 변경 없음. `DELETE /api/auth-configs/:id` 그대로.
- **페이지네이션**: 목록 API(`findAllPaginated` 등) 변경 없음, 해당 사항 없음.
- **인증/인가**: `remove()` 의 삭제 조건이 종전 `remove(config)`(PK 단독) 에서 `delete({ id, workspaceId })` 로 바뀌어 워크스페이스 스코프가 SQL WHERE 절에 **명시적으로** 추가됐다 — cross-tenant 삭제 차단이 오히려 강화됐다(회귀 아님, 개선). 컨트롤러 레벨 가드/데코레이터는 diff 대상이 아니다.

CHANGELOG·plan(`plan/in-progress/*.md`)·이전 리뷰 라운드(`review/code/2026/09/21/15_18_16/**`) 산출물은 문서/추적 파일로 API 계약 표면에 영향 없음.

## 요약

이번 변경은 `AuthConfigsService.remove()` 의 동시 삭제 이중 감사 로그 결함을 원자적 `DELETE` + `affected===0` 판정으로 수정한 것으로, 컨트롤러의 URL·HTTP 메서드·성공/실패 상태 코드·에러 응답 스키마 어느 것도 바꾸지 않는 순수 내부 구현 교체다. 오히려 삭제 조건에 `workspaceId` 를 명시해 테넌트 격리를 강화했고, 진 쪽 404 코드를 `findById()` 와 동일하게 맞춰 에러 응답 일관성을 개선했다. 유일한 참고 사항(신규 헬퍼명과 `triggers.service.ts` 의 400 에러 코드 간 이름 근접)은 이미 JSDoc 으로 명시적으로 구분돼 있고 직전 리뷰 라운드에서 완화 완료로 처리된 사안이라 재차단 사유가 아니다.

## 위험도

NONE
