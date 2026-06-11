# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] audit-action.const.ts — 모듈 레벨 JSDoc 품질 양호
- 위치: `/codebase/backend/src/modules/audit-logs/audit-action.const.ts` 전체
- 상세: 파일 상단 JSDoc 이 SoT 위치(`spec/5-system/1-auth.md §4.1`), naming 규약, 미구현 planned 액션 범위까지 명시되어 있다. 변경 내용(auth_config.* 5개 추가)은 const 에 이미 반영되어 있고, spec §4.1 의 표와도 일치한다.
- 제안: 없음.

### [INFO] AuditLogDto.action @ApiProperty — 인라인 문서 대폭 개선
- 위치: `/codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` L82–92
- 상세: 변경 전에는 단순 `example: 'integration.updated'` 만 있었는데, 변경 후에는 현재 구현된 action 값군, SoT 참조(`AUDIT_ACTIONS` const / spec §4.1), 레거시 row 처리 주의사항("클라이언트는 enum 으로 단정하지 말 것")까지 포함하도록 `description` 이 추가되었다. Swagger/OpenAPI 소비자가 필요한 정보를 한 곳에서 확인할 수 있다.
- 제안: 없음.

### [WARNING] AuditLogDto.action description — integration.updated 가 목록에 누락
- 위치: `/codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` L84–90
- 상세: description 문자열에는 `integration.*` 값군으로 `created·updated·deleted·rotated·scope_changed·reauthorized` 가 나열되어 있는데, 이번 PR 에서 `AUDIT_ACTIONS.INTEGRATION_UPDATED` 를 사용하는 `update` 메서드가 `integrations.service.spec.ts` 에 새로 추가되었으므로 값군 나열은 현재 구현과 일치한다. 다만 description 내 auth_config.* 값군이 `create·update·delete·regenerate·reveal` 의 순서로 나열되는 반면 `AUDIT_ACTIONS` 상수의 순서는 `CREATE·UPDATE·DELETE·REGENERATE·REVEAL` 로 동일하여 일관성은 유지된다. 큰 문제는 없지만 향후 action 이 추가될 때 description 을 수동 업데이트해야 하는 이중 관리 부담이 있다.
- 제안: 장기적으로 Swagger description 을 `Object.values(AUDIT_ACTIONS).join(', ')` 등으로 동적 생성하여 SoT 위반을 방지하거나, "현재 값은 `AUDIT_ACTIONS` const 참조" 한 줄로 축약하는 방안을 검토한다.

### [INFO] AuthConfigsService.recordAudit — JSDoc 적절
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1360–L1380
- 상세: `private recordAudit` 메서드에 JSDoc 이 추가되어 best-effort 계약의 실패 swallow 위임 위치(`AuditLogsService.record`)와 공유 경로(CRUD 5개)를 명시한다. `{@link AuditLogsService.record}` 링크 참조도 포함되어 IDE 에서 탐색 가능하다.
- 제안: 없음.

### [INFO] USAGE_RECENT_CALLS_LIMIT 상수 — 인라인 주석 추가
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1334
- 상세: 하드코딩된 `20` 을 `USAGE_RECENT_CALLS_LIMIT` 상수로 추출하고 "목록 API 기본 페이지 크기와 동일"이라는 의도가 주석으로 설명된다. spec/2-navigation/6-config.md §(호출 이력) 에서 "최근 20건" 을 명시하고 있으므로 spec 과 일치한다.
- 제안: 없음.

### [INFO] 테스트 파일 — describe 블록 상단 주석 적절
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts` L259–261, `/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` L632
- 상세: 새로 추가된 describe 블록 앞에 "왜 이 테스트가 필요한가"를 설명하는 주석(감사 로그 주체·IP 누락/스왑 방지, spec §4.1 참조)이 달려 있어 의도 문서화가 충분하다.
- 제안: 없음.

### [INFO] integrations.service.spec.ts — update describe 블록 헤더 주석 없음
- 위치: `/codebase/backend/src/modules/integrations/integrations.service.spec.ts` L2892–2894 (`describe('update', ...)`)
- 상세: 다른 새 describe 블록(`reauthorize`, `remove`)은 구분선 주석(`// update — name 변경 + audit`)으로 의도를 명시하는데, `update` 블록도 동일 패턴의 구분선 주석을 갖고 있어(`// update — name 변경 + audit`) 일관성이 유지된다.
- 제안: 없음.

### [INFO] CHANGELOG / README 업데이트 필요성 없음
- 위치: 전체 변경
- 상세: 이번 변경은 (1) DTO `@ApiProperty` description 보강, (2) 인라인 string literal → `AUDIT_ACTIONS` const 참조로 교체, (3) `private recordAudit` 래퍼 추출, (4) 테스트 케이스 추가이다. 외부 API 시그니처·환경 변수·설정 옵션은 변경되지 않으므로 CHANGELOG 나 README 레벨의 업데이트는 불필요하다.
- 제안: 없음.

### [INFO] spec/5-system/1-auth.md §4.1 — SoT와 구현 간 일치 확인
- 위치: `spec/5-system/1-auth.md` L355, L358
- 상세: spec 표에 `auth_config.create·update·delete·regenerate·reveal` 이 명시되어 있고 `AUDIT_ACTIONS` 상수의 5개 키와 정확히 일치한다. `AuditLogDto.action` description 도 동일 값을 나열한다. 삼중 일치(spec·const·DTO doc) 상태이다.
- 제안: 없음.

---

## 요약

이번 변경의 문서화 품질은 전체적으로 양호하다. 핵심 개선 사항은 `AuditLogDto.action` 의 `@ApiProperty` description 보강으로, OpenAPI 소비자가 현재 구현된 action 값군·SoT 위치·레거시 row 주의사항을 Swagger UI 에서 직접 확인할 수 있게 되었다. `private recordAudit` 래퍼에도 JSDoc 이 추가되어 best-effort 계약의 책임 경계가 명확히 문서화되었다. `USAGE_RECENT_CALLS_LIMIT` 상수화는 하드코딩 20의 의도를 주석으로 드러내 spec 연결성을 높인다. 한 가지 경미한 위험은 `AuditLogDto.action` description 이 action 목록을 수동으로 유지하는 이중 SoT 구조를 만든다는 점이나, 이는 코드 오동작이 아닌 유지보수 부담 수준이다.

## 위험도

LOW
