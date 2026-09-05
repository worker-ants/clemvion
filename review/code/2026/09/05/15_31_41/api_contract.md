# API 계약(API Contract) 리뷰

## 범위 요약

`git diff --stat origin/main..HEAD -- codebase/ CHANGELOG.md` 로 실제 API 표면에 영향 가능한
변경만 추려서 봤다 (`plan/**`, `review/**` 하위는 문서/산출물이라 API 계약과 무관 — 이번 diff
에 포함된 `review/code/2026/09/05/{13_49_54,14_39_31,15_12_02}/**` 는 모두 이전 라운드가 이미
생성해 커밋한 리포트이며, 로컬 `HEAD` 는 그 마지막 라운드(`4d8118956`)와 완전히 동일하다 —
즉 이번 라운드가 보는 코드 diff 는 직전 `15_12_02` 라운드가 본 것과 같다. 아래 발견사항은 그
결론을 그대로 베끼지 않고 소스를 직접 열어 독립적으로 재검증한 결과다).

핵심 변경 두 갈래:

1. **`GET /api/audit-logs` 응답 축소(보안/계약 수정)** — `audit-logs.service.ts`. 종전
   `leftJoinAndSelect('al.user','user')` 가 `User` 엔티티 26개 컬럼(`passwordHash`·
   `twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken` 등)을
   그대로 실었고, 컨트롤러(`audit-logs.controller.ts`)가 DTO 변환 없이 엔티티를 그대로
   반환하므로 실 응답에 그 26개 키가 전부 나갔다. `leftJoin` + `addSelect(['user.id',
   'user.name','user.email'])` 로 좁혀 `AuditLogUserDto` 가 선언한 3필드만 나가게 했고,
   반환 타입도 `PaginatedResponseDto<AuditLog>` → `PaginatedResponseDto<AuditLogListItem>`
   (`Omit<AuditLog,'user'> & { user: Pick<User,'id'|'name'|'email'> | null }`) 로 좁혔다.
2. **§5.4(응답 vs DTO 선언 대조) 검증 헬퍼(`response-contract.ts`/`.spec.ts`) 신설 + 4개
   e2e 배선** — 이 자체는 테스트 인프라이며 프로덕션 엔드포인트·스키마·인증·버전을
   바꾸지 않는다.

`response-contract.ts` 의 현재 소스를 직접 열어 확인한 결과, 이전 라운드(`13_49_54`)가 지적한
① `dtoName: string` 중복 → `DtoContract.name` 파생으로 해소, ② `kind:'missing'` 이중 의미 →
`'invalid-payload'` 로 분리, ③ JSDoc 규칙 표와 구현("required 아님 + nullable" 조합)의 불일치 →
표 자체가 "§5.4 아님"으로 정정되어 구현(`!nullable` 게이트)과 지금 일치함을 각각 코드 레벨에서
확인했다. 새로 도입된 §5.4 도구 자체의 결함은 찾지 못했다.

대신 audit-logs 수정 코드를 독립적으로 다시 훑다가, 이 PR 이 스스로 명시한 "타입이 런타임보다
넓어지는 재발 방지" 목표가 `user` 필드에는 적용됐지만 형제 관계 필드 `workspace` 에는 적용되지
않은 잔여 지점을 발견했다 (아래 발견사항 1).

## 발견사항

- **[WARNING]** `AuditLogListItem` 이 `user` 는 좁혔지만 `workspace` 관계 필드는 그대로 둬,
  이 PR 이 스스로 막으려던 "타입이 런타임보다 넓다" 실패 모드가 형제 필드에 남아 있다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `AuditLogListItem`
    타입 정의(19~21행) 및 `findAll` 의 쿼리 빌더(51~62행, `al.workspace` join 없음)
  - 상세: 타입 정의 바로 위 JSDoc(11~18행)이 정확히 "엔티티의 `user: User` 를 그대로 반환
    타입에 쓰면 타입이 런타임보다 넓어져, 재사용하는 다음 코드가 `user.passwordHash` 를
    컴파일 통과시키고 런타임엔 조용히 `undefined` 를 받는다"고 문제를 짚고 `user` 만 `Omit`
    해 좁혔다. 그런데 `AuditLog` 엔티티는 `user` 말고도 `workspace: Workspace`
    (`@ManyToOne(() => Workspace, ...)`, `eager` 아님) 관계를 하나 더 갖고 있고,
    `AuditLogListItem = Omit<AuditLog, 'user'> & {...}` 는 `'user'` 만 제거해 `workspace` 는
    그대로 필수(non-optional) 필드로 남긴다. 실제 쿼리는 `al.user` 만 `leftJoin`/`addSelect`
    하고 `al.workspace` 는 전혀 join 하지 않으므로, 런타임의 `data[i].workspace` 는 항상
    `undefined` 다 — 타입은 `Workspace`(전 컬럼 포함) 라고 주장하는데 실제로는 값이 아예
    없다. 지금 당장은 `AuditLogDto` 가 `workspace` 객체를 선언하지 않고 `workspaceId`
    (스칼라)만 선언하므로 wire 유출은 없다(직렬화 시 `undefined` 키는 생략된다) — 하지만
    이 컨트롤러가 여전히 엔티티/이 타입을 변환 없이 그대로 반환하는 구조이므로, 다음 사람이
    (a) 이 타입을 믿고 `result.workspace.name` 같은 코드를 짜서 컴파일은 통과시키고 런타임
    NPE 를 만들거나, (b) `leftJoinAndSelect('al.workspace', 'workspace')` 를 추가하면서 이
    타입이 이미 `workspace: Workspace` 를 "정상"으로 선언해 두었기 때문에 그 변경이 타입
    체크에 걸리지 않고 그대로 응답에 `Workspace` 전 컬럼이 새는, 이번에 고친 것과 **동일한
    클래스의 결함**이 형제 경로로 재발할 수 있다. `AuditLogListItem` 이 현재 이
    파일 안에서만 쓰이고 외부에 재export 되지 않아(grep 확인) 즉각적 위험은 낮지만, 이
    PR 의 재발 방지 의도를 완전히 충족하지 못한 채 남은 잔여 지점이다.
  - 제안: `AuditLogListItem` 을 `Omit<AuditLog, 'user' | 'workspace'>` 로 넓히거나(관계
    필드 전체를 반환 타입에서 배제), 더 엄격하게는 `AuditLogDto` 가 선언한 필드만으로 반환
    타입을 재구성해 "이 엔드포인트가 실제로 보장하는 형태"를 하나의 타입으로 못박는다.

- **[INFO]** `user` 응답 축소는 기술적으로 breaking change 이나 CHANGELOG 가 영향 범위와
  함께 이미 문서화했다 — 조치 불요
  - 위치: `CHANGELOG.md`(신규 `## Unreleased — GET /api/audit-logs...` 항목),
    `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`
    (`AuditLogUserDto` 3필드 선언, 이번 diff 밖 기존 파일 — 직접 열어 3필드임을 확인)
  - 상세: `user` 객체의 실제 키가 26개(자격증명 포함)에서 선언된 3개로 줄었다. 그 26개 중
    민감하지 않은 필드에 우연히 의존하던 소비자가 있었다면 그 기준으로는 breaking 이다.
    다만 원래 노출 자체가 `AuditLogUserDto` 선언을 위반한 결함이었고 계약상 보장된 적이
    없었으며, CHANGELOG 가 "이미 나간 것은 회수되지 않는다"는 영향 범위와 함께 명시적으로
    기록해 뒀다. 응답이 이제 선언(3필드)과 정확히 일치하는지도 직접 확인했다 — 컨트롤러가
    DTO 변환 없이 엔티티를 그대로 반환하지만, 엔티티 최상위 필드(`id`/`workspaceId`/
    `userId`/`action`/`resourceType`/`resourceId`/`details`/`ipAddress`/`createdAt`)는
    `AuditLogDto` 선언과 1:1 로 대응하고 `workspace` 관계는 join 되지 않아 직렬화되지
    않으므로 최상위 과다 노출은 없다.
  - 제안: 조치 불요.

- **[INFO]** `AuditLogDto.user`/`ipAddress` 가 "optional + nullable" 조합으로 선언돼
  §5.4 응답 형태 3가지 밖에 있는 것은 이번 diff 가 만든 것이 아니라 기존 파일의 선행 drift
  — 별도 트래커에서 이미 추적 중
  - 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26,52-53`
    (이번 diff 밖), `plan/in-progress/spec-draft-nullable-notation-followups.md`(§5.4 drift
    트래커)
  - 상세: `AuditLogListItem.user` 는 항상 키가 채워지므로(값이 `null` 이거나 3필드 객체)
    DTO 의 "키 생략 가능" 선언보다 오히려 더 엄격하게 지킨다 — 방향이 안전한 쪽이라 결함은
    아니다. `assertMatchesContract` 도 이 조합을 §5.4 판정 대상 밖으로 명시적으로 취급하므로
    거짓 위반을 내지 않는다.
  - 제안: 조치 불요 — 기존 트래커에서 처리.

버전 관리·에러 응답 형식·요청 검증(`QueryAuditLogDto`)·URL/경로 설계·페이지네이션
(`PaginatedResponseDto`)·인증/인가(`@Roles('admin')`, `RolesGuard`)는 이번 diff 가 건드리지
않았고, 컨트롤러의 가드·데코레이터 구성도 변경 전과 동일함을 `audit-logs.controller.ts` 를
직접 열어 확인했다.

## 요약

핵심 API 계약 변경은 `GET /api/audit-logs` 의 `user` 응답 객체를 실제 26개 키(자격증명
포함)에서 선언된 3개 필드로 좁힌 보안/계약 준수 수정이며, CHANGELOG 가 영향 범위와 함께
적절히 문서화했다. 다만 이 수정이 스스로 내세운 "타입이 런타임보다 넓어지는 재발 방지"라는
목표를 `user` 필드에는 적용했지만 형제 관계 필드 `workspace` 에는 적용하지 않아, 지금 당장
wire 유출은 없어도 동일 클래스의 결함이 재발할 수 있는 잔여 지점이 남아 있다(WARNING). 신규
§5.4 검증 헬퍼(`response-contract.ts`)는 프로덕션 API 표면을 바꾸지 않는 테스트 인프라이며,
소스를 직접 열어 확인한 결과 이전 라운드들이 지적한 JSDoc·구현 불일치, `dtoName` 중복,
`kind` 재사용 문제가 모두 해소되어 있다. 버전 관리·에러 응답·요청 검증·URL 설계·
페이지네이션·인증/인가 관점에서는 이번 diff 로 인한 새로운 위반이 없다.

## 위험도

LOW
