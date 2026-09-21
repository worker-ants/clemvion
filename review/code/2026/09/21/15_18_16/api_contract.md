# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** DELETE `/api/auth-configs/:id` 의 외부 계약(성공 204, 실패 404 `RESOURCE_NOT_FOUND`)은 이번 변경으로 바뀌지 않는다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:293-329` (`remove`)
  - 상세: `authConfigRepository.remove(config)` → `authConfigRepository.delete({ id, workspaceId })` 전환은 감사 로그 중복(동시 삭제 시 `auth_config.delete` 2건)을 없애기 위한 내부 원자성 개선이며, 컨트롤러의 `@HttpCode(HttpStatus.NO_CONTENT)`(`codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:218`)와 404 에러 바디 스키마(`{ code: 'RESOURCE_NOT_FOUND', message }`)는 그대로다. 클라이언트가 관측 가능한 응답 형식·상태 코드에 breaking change 없음.
  - 제안: 없음 — 정보성 확인.

- **[INFO]** 신규 `throwAuthConfigNotFound()` 는 기존 `findById` 의 404 리터럴을 그대로 추출한 것으로, 에러 코드/상태 코드 값 자체는 동일해 회귀가 없다. 다만 같은 도메인에 이름이 유사한 **다른 계약**이 존재한다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:149-154` (`throwAuthConfigNotFound`)
  - 상세: `triggers.service.ts` 의 `AUTH_CONFIG_NOT_FOUND` 는 트리거가 참조하는 auth config 가 같은 워크스페이스에 없을 때의 **400 요청 검증 실패**(`spec/5-system/3-error-handling.md` §1.11 이 "이 저장소의 유일한 `_NOT_FOUND`≠404" 예외로 명시)이고, 이번 헬퍼는 auth config 자체 조회/삭제 시의 **404 `RESOURCE_NOT_FOUND`** 다. 이름이 근접해 향후 유지보수 시 두 에러 계약이 혼동될 위험이 있으나, 헬퍼 JSDoc 에 두 자리가 다름을 명시적으로 문서화해 두어(그리고 이 위험은 `--impl-prep` consistency-check W1 에서 이미 지적·해소됨) 실질적 리스크는 낮다.
  - 제안: 없음 — 이미 완화됨. 후속 변경에서 두 에러 코드 중 하나를 상대방에 맞춰 통일하지 않도록 주의.

- **[INFO]** 원자적 `DELETE` 조건에 `workspaceId` 를 명시 포함해 테넌트 격리가 이전보다 더 엄격해졌다(회귀 아님, 강화).
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:316-319`
  - 상세: 종전 `authConfigRepository.remove(config)` 는 엔티티의 PK(`id`) 만으로 삭제해, cross-tenant 격리는 선행 `findById` 의 `where: {id, workspaceId}` 조회 결과에 전적으로 의존했다. 신규 `delete({ id, workspaceId })` 는 DELETE 문 자체에도 워크스페이스 스코프를 재적용해 이중 방어가 된다. 회귀 테스트(`auth-configs.service.spec.ts` — "워크스페이스로 스코프한 원자적 DELETE 를 친다")가 이 조건을 명시적으로 단언한다.
  - 제안: 없음.

- **[INFO]** (이 PR 범위 밖, plan 문서에도 명시) 참조 중인 트리거가 있어도 auth config 삭제를 막는 사용처 검사(예: 통합 삭제 경로의 `INTEGRATION_IN_USE` 같은 서버 가드)가 없다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:293-329` (`remove`); `plan/in-progress/authconfig-dup-delete.md` "이 PR 이 하지 않는 것"
  - 상세: `trigger.auth_config_id` 는 `ON DELETE SET NULL` 이라 데이터 무결성은 DB 레벨에서 지켜지지만, API 소비자 입장에서는 "사용 중인 인증 설정을 사전 경고 없이 삭제 가능"하다는 계약이 그대로 유지된다. 이번 diff 가 새로 만든 문제는 아니며 plan 문서가 이미 별도 표면으로 분리해 두었다.
  - 제안: 없음(범위 밖) — 향후 별도 이슈로 다룰 사안이라는 점만 기록.

- **[INFO]** 요청 검증·페이지네이션·버전 관리·인증/인가 표면은 이번 diff 에서 변경되지 않았다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 전체(컨트롤러·DTO·가드는 diff 밖)
  - 상세: `findAll` 의 페이지네이션(`PaginationQueryDto`/`PaginatedResponseDto`), `create`/`update`/`regenerate`/`reveal` 의 요청 검증 로직, 인증/인가 가드는 이번 diff 의 대상이 아니다. 테스트(`auth-configs.service.spec.ts`, e2e)도 `remove` 경로만 다룬다.
  - 제안: 없음.

## 요약

이번 변경은 `AuthConfigsService.remove()` 의 동시 삭제 경합에서 감사 로그가 두 번 남던 결함을, `remove(entity)` 대신 워크스페이스로 스코프한 단일 원자적 `DELETE` 와 `affected === 0` 명시 비교로 고친 내부 구현 개선이다. DELETE 엔드포인트의 외부 계약(성공 204, 실패 404 `RESOURCE_NOT_FOUND`, 에러 바디 스키마)은 그대로 유지되어 하위 호환성 문제가 없고, 오히려 DELETE 조건에 `workspaceId` 를 명시 포함시켜 테넌트 격리가 강화되었다. 신규 `throwAuthConfigNotFound` 헬퍼명이 `triggers.service.ts` 의 400 `AUTH_CONFIG_NOT_FOUND` 와 이름이 근접해 혼동 위험이 있으나 JSDoc 으로 이미 명확히 구분해 두었고, 참조 트리거에 대한 사용처 검사 부재는 이 PR 이 만든 문제가 아니라 별도 표면으로 plan 문서에 기록되어 있다. 페이지네이션·버전 관리·요청 검증·인증/인가는 이번 diff 의 대상이 아니다.

## 위험도

NONE
