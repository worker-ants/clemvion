# API 계약(API Contract) 리뷰

## 범위 요약

이번 diff 의 API 계약 관련 실질 변경은 두 갈래다.

1. **`GET /api/audit-logs` 응답 축소(보안/계약 수정)** — `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`. `leftJoinAndSelect('al.user','user')`(User 전 컬럼, 실측 26키)를 `leftJoin` + `addSelect(['user.id','user.name','user.email'])`(선언된 3키)로 좁혔다. 반환 타입도 `PaginatedResponseDto<AuditLog>` → `PaginatedResponseDto<AuditLogListItem>`(`Omit<AuditLog,'user'> & { user: Pick<User,'id'|'name'|'email'> | null }`)로 좁혀, 타입이 런타임보다 넓어지는 재발을 막았다.
2. **§5.4(응답 vs DTO 선언 대조) 검증 헬퍼 신설 + 4개 e2e 배선** — `response-contract.ts`/`.spec.ts` 및 `audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution` e2e-spec. 이 자체는 테스트 인프라이며 프로덕션 API 표면(엔드포인트·요청/응답 스키마·인증·버전)을 바꾸지 않는다.

`CHANGELOG.md`·`plan/in-progress/*.md`·`review/code|consistency/**` 하위 파일들은 문서/산출물이며 API 계약과 직접 무관하다. 나머지 파일(review/consistency 산출물 등)은 이전 두 라운드(`13_49_54`, `14_39_31`)에서 이미 API 계약 관점으로 검토·조치 완료된 것을 확인했다 — `response-contract.ts` 현재 소스를 직접 열어 `dtoName: string` 중복(WARNING, 이전 라운드 지적)이 `Dto.name` 파생 방식(`DtoContract.name`)으로, `kind:'missing'` 재사용(WARNING)이 `'invalid-payload'` 분리로, JSDoc 표의 §5.4 출처 오기(W5)가 "값 검사 vs 선언 검사" 경계 재정리로 각각 해소된 것을 확인했다. 이번 라운드에서 새로 도입된 API 계약 관련 결함은 찾지 못했다.

## 발견사항

- **[INFO]** 응답 축소는 실질적으로 wire 변경이며 하위 호환성에 영향을 줄 수 있으나, CHANGELOG 가 이미 적절히 문서화했다
  - 위치: `CHANGELOG.md` "## Unreleased — `GET /api/audit-logs` 가 `user` 로 비밀번호 해시와 2FA 복구 코드를 내보냈다"(신규 항목 전체), `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:60-61`
  - 상세: `user` 객체의 실제 키가 26개(민감정보 포함)에서 선언된 3개(`id`/`name`/`email`)로 줄었다. 이 26개 중 민감하지 않은 일반 컬럼(예: 생성일시 등)에 우연히 의존하던 소비자가 있었다면 이 변경은 그 소비자 기준으로 breaking change 다. 다만 (1) 원래 노출 자체가 `AuditLogUserDto` 선언(3필드)을 위반한 결함이었고 계약상 보장된 적이 없었다는 점, (2) CHANGELOG 가 "이미 나간 것은 회수되지 않는다"는 영향 범위와 함께 명시적으로 이 축소를 기록해 둔 점에서 이미 적절히 처리됐다. 새로운 조치는 필요 없다 — API 계약 관점에서 "의도된 breaking narrowing 이 문서화됐는가"만 확인하는 차원의 기록이다.
  - 제안: 조치 불요.

- **[INFO]** `AuditLogListItem.user` 는 항상 존재(`Pick<User,...> | null`)하지만 선언된 `AuditLogDto.user`는 optional(`user?: AuditLogUserDto | null`)이다 — 방향이 안전한 쪽(실제가 선언보다 엄격)이라 결함 아님
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19-21`(`AuditLogListItem`) vs `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26`(`AuditLogDto.user`, 이번 diff 밖 기존 파일)
  - 상세: 서비스가 항상 `user` 키를 채워 보내므로(값은 `null` 이거나 3필드 객체) DTO 가 "키 생략 가능"이라고 선언한 것보다 더 엄격하게 지킨다. `assertMatchesContract` 관점에서도 위반이 아니다(필수가 아닌 키가 있어도 되고, `null`이 와도 `nullable:true`라 허용). `AuditLogDto.user`/`ipAddress`가 "optional + nullable"(§5.4 상 응답 DTO에는 허용되지 않는 조합, 요청 DTO 전용)로 선언돼 있는 것 자체는 이번 diff 가 건드리지 않은 기존 파일의 선언층 drift이며, `plan/in-progress/spec-draft-nullable-notation-followups.md`(§5.4 drift 트래커)가 이미 별도 항목으로 추적 중이다.
  - 제안: 조치 불요 — 기존 트래커에서 처리.

## 요약

핵심 API 계약 변경은 `GET /api/audit-logs` 의 `user` 응답 객체를 실제 응답 키(26개, 자격증명 포함)에서 선언된 3개 필드로 좁힌 보안/계약 준수 수정이며, 반환 타입도 런타임 형태(`AuditLogListItem`)로 좁혀 재발을 막았다. 이 축소가 하위 호환성 관점에서 기술적으로는 breaking narrowing 이지만, 원래 노출 자체가 DTO 계약 위반이었고 CHANGELOG 가 영향 범위와 함께 명시적으로 기록했으므로 추가 조치는 필요 없다. 신규 §5.4 검증 헬퍼(`response-contract.ts`)와 4개 e2e 배선은 API 계약 자체를 바꾸지 않는 테스트 인프라이며, 직접 열람한 결과 이전 두 라운드에서 지적된 API 계약 관련 결함(DTO 이름 이중 기입, `missing` kind 재사용, JSDoc §5.4 출처 오기)이 모두 해소되어 있음을 확인했다. 버전 관리·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가 관점에서는 이번 diff 로 인한 변경이나 새로운 위반이 없다.

## 위험도

LOW
