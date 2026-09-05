# API 계약(API Contract) 리뷰

## 범위 요약

`git diff origin/main..HEAD -- codebase/ CHANGELOG.md`(82개 파일 중 API 표면에 영향 가능한
파일만 추림)로 실제 코드 변경을 확인했다. `plan/**`, `review/**` 하위(대부분)는 문서/이전
라운드 산출물이라 API 계약과 무관하다.

핵심 변경 두 갈래는 이전 라운드들(`13_49_54`~`15_31_41`)이 이미 여러 차례 검토한 것과 동일
범위다:

1. **`GET /api/audit-logs` 응답 축소(보안/계약 수정)** — `audit-logs.service.ts`. 종전
   `leftJoinAndSelect('al.user','user')` 가 `User` 엔티티 26개 컬럼(`passwordHash`·
   `twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken` 등
   자격증명·계정탈취 수단)을 그대로 실었고, 컨트롤러가 DTO 변환 없이 엔티티를 그대로
   반환해 실 응답에 26개 키가 전부 나갔다. `leftJoin` + `addSelect(['user.id','user.name',
   'user.email'])` 로 좁혀 `AuditLogUserDto` 선언 3필드만 나가게 했다.
2. **§5.4(응답 vs DTO 선언 대조) 검증 헬퍼(`response-contract.ts`/`.spec.ts`) + `ExecutionDto`
   스키마 회귀 가드(`execution-response.dto.spec.ts`) 신설, 4개 e2e 배선** — 테스트 인프라이며
   프로덕션 엔드포인트·스키마·인증·버전을 바꾸지 않는다.

직전 라운드(`review/code/2026/09/05/15_31_41/api_contract.md`)가 낸 유일한 WARNING —
`AuditLogListItem` 이 `user` 는 좁혔지만 형제 관계 필드 `workspace` 는 좁히지 않아 "타입이
런타임보다 넓다" 재발 여지가 남았다는 지적 — 이 이후 fix 커밋(`5fcb5c625`)에서 실제로
해소됐음을 현재 소스(`audit-logs.service.ts:19-24`)를 직접 열어 확인했다:

```
export type AuditLogListItem = Omit<AuditLog, 'user' | 'workspace'> & {
  user: Pick<User, 'id' | 'name' | 'email'> | null;
};
```

`workspace` 관계 자체가 타입에서 사라져(선택적 필드로 남긴 것도 아니고 완전히 `Omit`)
"쿼리가 join 하지 않는데 타입이 존재를 주장" 하는 간극이 없어졌다. 쿼리 빌더도 여전히
`al.workspace` 를 join 하지 않으므로 타입·런타임이 정확히 일치한다. **재확인 완료 — 조치
불요.**

## 발견사항

- **[INFO]** `user` 응답 축소는 기술적으로 breaking change 이나 CHANGELOG 가 영향 범위와
  함께 이미 문서화했다 — 조치 불요
  - 위치: `CHANGELOG.md`(`## Unreleased — GET /api/audit-logs...` 항목)
  - 상세: `user` 객체의 실제 키가 26개(자격증명 포함)에서 선언된 3개로 줄었다. 원래 노출
    자체가 `AuditLogUserDto` 선언을 위반한 결함이었고 계약상 보장된 적이 없었으며,
    CHANGELOG 가 "이미 나간 것은 회수되지 않는다"는 영향 범위·소비자 점검 권고까지 명시적으로
    기록해 뒀다. 응답 최상위 필드(`id`/`workspaceId`/`userId`/`action`/`resourceType`/
    `resourceId`/`details`/`ipAddress`/`createdAt`)는 `AuditLogDto` 선언과 1:1 대응하고
    `workspace` 관계는 join 되지 않아 직렬화되지 않으므로 최상위 과다 노출도 없다.
  - 제안: 조치 불요.

- **[INFO]** `AuditLogDto.user`/`ipAddress` 가 "optional + nullable" 조합으로 선언돼 §5.4
  응답 형태 3가지 밖에 있는 것은 이번 diff 가 만든 것이 아니라 기존 파일의 선행 drift이고,
  `ExecutionDto`(10개)·`WorkflowDto`(2개)도 같은 패턴이 이미 있다 — 별도 트래커
  (`plan/in-progress/spec-draft-nullable-notation-followups.md`)에서 추적 중
  - 상세: `AuditLogListItem.user` 는 항상 키가 채워지므로(값이 `null` 이거나 3필드 객체)
    DTO 의 "키 생략 가능" 선언보다 오히려 더 엄격하게 지킨다 — 방향이 안전한 쪽이라 결함은
    아니다. `response-contract.ts`(§5.4 검증자)도 이 조합을 판정 대상 밖으로 명시적으로 취급해
    거짓 위반을 내지 않는다. 신규 `execution-response.dto.spec.ts` 는 이 10개를 "고치는 것이
    아니라 고정"하는 회귀 가드로 명시해 커버리지를 과대 서술하지 않는다.
  - 제안: 조치 불요 — 기존 트래커에서 처리.

- **[INFO]** 인증/인가·URL 설계·페이지네이션·요청 검증은 이번 diff 가 건드리지 않았다
  - 상세: `AuditLogsController`(`@Roles('admin')`, `@ApiBearerAuth`, `RolesGuard`)는 변경 전과
    동일함을 직접 열어 확인했다. `QueryAuditLogDto` 기반 필터/페이지네이션 로직도 그대로다.
    `PaginatedResponseDto<AuditLogListItem>` 으로 제네릭 타입만 좁아졌을 뿐 `{data, meta}`
    래핑 형태는 불변이다.
  - 제안: 조치 불요.

## 요약

핵심 API 계약 변경은 `GET /api/audit-logs` 의 `user` 응답 객체를 실제 26개 키(자격증명 포함)
에서 선언된 3개 필드로 좁힌 보안/계약 준수 수정이며, CHANGELOG 가 영향 범위와 함께 적절히
문서화했다. 직전 라운드가 지적한 형제 필드(`workspace`) 재발 여지도 이후 fix 커밋에서
`Omit<AuditLog, 'user' | 'workspace'>` 로 해소됐음을 소스에서 직접 재확인했다. 신규 §5.4 검증
헬퍼(`response-contract.ts`)와 `ExecutionDto` 스키마 회귀 가드는 프로덕션 API 표면을 바꾸지
않는 테스트 인프라이며, 판정 규칙이 spec §5.4 문서와 일치하고 "optional+nullable" 기존 drift를
판정 대상 밖으로 명확히 구분해 거짓 위반을 내지 않는다. 인증/인가·URL 설계·페이지네이션·
요청 검증·버전 관리·에러 응답 형식 관점에서 이번 diff 로 인한 새로운 위반은 없다.

## 위험도

LOW
