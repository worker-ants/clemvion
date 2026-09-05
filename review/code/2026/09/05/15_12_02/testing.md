# 테스트(Testing) 리뷰

## 검증 방법

`codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}`, `audit-logs.service.ts`/
`audit-logs.spec.ts`, 4개 e2e 스펙(`audit-logs`/`session-revocation`/`workflow-crud`/
`workflow-execution`)을 저장소의 **현재 최종 상태**로 `Read` 해 프롬프트 diff 게이트와 대조했다.
이전 두 라운드(`review/code/2026/09/05/13_49_54/testing.md`, `14_39_31/testing.md`)가 낸 지적을
현재 코드와 대조해 해소 여부를 확인했고, `AuditLogDto`/`AuditLog` 엔티티(`audit-log.entity.ts`)를
직접 열어 FK 제약(`user_id` non-nullable, `@ManyToOne` 기본 `onDelete` 없음)을 확인했다.
저장소 트리에는 아무것도 쓰지 않았다(읽기만 수행, `git status --short` 로 무변경 확인).

### 이전 라운드 대비 회귀 확인 (모두 해소됨)

- `13_49_54` INFO 4건(정렬 미검증·배열 payload 미검증·중첩 `$ref`+`nullable` 미검증·
  `schemaForDto` 캐싱 비일관) — 전건 해소 확인.
- `14_39_31` WARNING(`oneOf`/`anyOf` 미처리로 union 뒤 유출 통과) — `PropertyContract.oneOf/anyOf` +
  `visitUnion` 추가, `UnionDto` 픽스처 4테스트로 해소 확인.
- `14_39_31` Critical(자기참조 DTO 순환 가드가 `contract.name` 방문 집합이라 내부 미검사) —
  방문 집합을 payload 객체 동일성으로 교체, 1·2단계 위반 주입 + 종료 테스트로 해소 확인.
- `ContractViolationKind`가 "필드 누락"과 "payload 자체가 객체 아님"에 `'missing'`을 공유하던
  것(과거 라운드 maintainability WARNING)도 `'invalid-payload'` 전용 kind 분리로 해소돼 있다
  (`response-contract.ts` `ContractViolationKind`, `findContractViolations`의 최상위 가드).

## 발견사항

- **[INFO]** `visitUnion`의 `allowUndeclared` 면제 경로가 어떤 테스트에도 걸리지 않는다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `visitUnion` 함수 내
    `if (declared.has(name) || walk.allowUndeclared.has(path)) continue;` 분기(비-union 경로인
    `visit` 함수의 동일 패턴은 `child.extra` 테스트로 커버됨)
  - 상세: `response-contract.spec.ts`의 `판별자 없는 oneOf/anyOf` describe 블록은 "어느 변형에
    있는 키는 통과", "어느 변형에도 없으면 undeclared", "required 는 강제 안 함" 세 가지만
    검증한다. `allowUndeclared` 옵션으로 union 내부의 특정 경로를 면제하는 경로
    (`ContractCheckOptions.allowUndeclared`가 `visitUnion`에서 실제로 읽히는 지점)는 non-union
    경로(`child.extra`, `response-contract.spec.ts` "allowUndeclared 는 중첩 경로로 적는다")만
    커버되고 union 경로는 커버되지 않는다. `visitUnion`의 이 줄만 지워도(뮤테이션) 현재
    유닛 스펙 전부가 그대로 통과한다 — 판별력이 없는 코드 경로다. 이번 스윕이 겨냥하는
    `ExecutionStatusDto.context`처럼 오직 `oneOf`로만 표현되는 실제 응답 필드에서 `allowUndeclared`가
    필요해지는 순간(예: 두 variant 밖의 래퍼 필드) 이 옵션이 실제로 동작하는지 아무도 검증한
    적이 없는 채로 쓰이게 된다.
  - 제안: `UnionDto` 기반 테스트에 `allowUndeclared: ['context.extra']` 같은 케이스를 하나
    추가해 union 경로의 면제도 non-union 경로와 동일하게 캐너리를 남긴다.

- **[INFO]** `AuditLogDto.user`의 `nullable: true` 분기가 현재 DB 제약상 도달 불가능해 보이는데,
  e2e 단언은 이를 구분하지 않고 "항상 참"인 형태로만 남아 있다
  - 위치: `codebase/backend/test/audit-logs.e2e-spec.ts:89-91`(`expect(user).toBeTruthy()`) /
    대조 대상 선언은 `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`의
    `user?: AuditLogUserDto | null` / 실제 FK 는
    `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts`의
    `@Column({ name: 'user_id' })`(nullable 미지정 → NOT NULL) + `@ManyToOne(() => User)`(`onDelete`
    미지정 → 기본 RESTRICT, 참조된 `User` 행 삭제가 DB 레벨에서 막힌다)
  - 상세: 서비스가 `leftJoin`(inner 아님)을 쓰고 DTO도 `user`를 nullable/optional로 선언해
    "사용자가 나중에 사라질 수 있다"를 전제하는 것처럼 보이지만, 현재 엔티티 제약상 `user_id`가
    NULL 이 될 수도 없고 참조된 `User` 행이 삭제될 수도 없어(RESTRICT), 실무에서 `user`가
    `null`이거나 키 자체가 생략되는 응답은 오늘 발생할 수 없다. 즉 e2e의
    `expect(user).toBeTruthy()`는 "이 분기가 실제로 null일 수 있는 상황에서 정상 동작한다"를
    증명하는 회귀 캐너리가 아니라, 현재 유일하게 가능한 형태(항상 채워짐)를 확인하는 것뿐이다.
    이건 새 버그는 아니다 — `response-contract.spec.ts`의 `ProbeDto.child`가 이미 제네릭 레벨에서
    "중첩 `$ref`+`nullable`이 null일 때 통과·내려가지 않음"을 커버하므로 도구 자체의 정확성은
    검증돼 있다. 다만 `AuditLogDto`가 왜 `nullable: true`를 선언하는지(장래 소프트 삭제 대비인지,
    과거 선언의 잔재인지)와, 그 분기가 실제로는 도달 불가능하다는 사실이 코드 어디에도 남아있지
    않다 — 다음 사람이 이 필드를 보고 "null 케이스가 실제로 검증됐다"고 오해할 여지가 있다.
  - 제안: 필수 조치는 아님. 여유가 있다면 DTO 선언 옆에 "왜 nullable인지"(향후 계획 vs 과거
    잔재) 한 줄만 남기거나, 정말 도달 불가능하다고 확인되면 `nullable: true`를 제거해 선언과
    실제 계약을 좁힌다.

- **[INFO]** `AuditLogsService.findAll`의 `getSortColumn` 폴백·`action`/`resourceType`/
  `startDate`/`endDate` 필터 경로는 여전히 유닛 테스트가 없다 (이전 라운드에서도 지적된 채
  미조치 — 이번 diff 범위 밖이라 재차 낮은 우선순위로만 기록)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`의 `getSortColumn()` 및
    `findAll()`의 `action`/`resourceType`/`startDate`/`endDate` 분기 / 대응 테스트 파일
    `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — `userId` 필터와 join/select만
    단언
  - 상세: 이번 diff는 이 경로들을 변경하지 않았고 `14_39_31` 라운드가 이미 INFO로 기록해 두었다.
    같은 `qb` mock이 이미 세워져 있어 필터당 한 줄 추가 비용이 낮다는 점도 동일하다. 새로운
    위험은 아니지만 두 라운드 연속으로 미조치 상태라 다시 한 번 남긴다.
  - 제안: 이번 PR 조치 불요. 다음에 이 서비스를 만질 때 각 필터의 `qb.andWhere`/`qb.orderBy`
    호출 인자를 단언하는 테스트를 추가할 것.

## 좋았던 점 (참고)

- `Critical`(감사 로그 `user` 26개 키 유출)에 대한 회귀 고정이 unit(`qb.leftJoin`/`addSelect`
  호출 단언 + `leftJoinAndSelect` 부재 단언)과 e2e(계약 대조 + `Object.keys(user).sort()` 독립
  캐너리) 두 층에 있고, 되돌리는 뮤테이션이 양쪽 모두 즉시 깨지도록 설계돼 있다.
- `response-contract.spec.ts`는 §5.4 네 축(required+non-nullable / required+nullable /
  키 생략형 / 키 생략형+nullable) + 중첩 `$ref`/배열/자기참조/판별자 없는 `oneOf`를 각각 독립
  축으로 물고, `[전제]` 테스트로 "스키마가 비어 있으면 통과가 무의미하다"는 vacuous-test 함정을
  스스로 방어한다.
- 스키마 생성이 mock이 아니라 실제 `@nestjs/swagger`/`SwaggerModule.createDocument` 파이프라인을
  그대로 태우므로(스텁 컨트롤러만 최소 사용) 데코레이터 조합과 실제 생성 스키마 사이의 괴리
  위험이 낮다. `buildSwaggerDocument`가 `finally`에서 `app.close()`를 호출해 실패 시에도 Jest가
  열린 핸들로 매달리지 않게 한 점도 테스트 위생 관점에서 좋다.
- `AuditLogsService.record`의 swallow 계약 스위트는 "삼켜도 주 동작은 안 깨진다"와 "삼킨 실패가
  관측되는지"(카운터·구조화 로그 4필드 각각 개별 단언)를 분리해, `@Optional()` DI 조립을
  `new AuditLogsService(repo)` 직접 생성이 아니라 `Test.createTestingModule`로 실제 태워
  회귀시키지 않는 점도 눈에 띈다(코드 주석이 과거 실수를 정직하게 남겨 재발을 막는다).
- 4개 e2e 스위트 모두 기존 unique email/name 기반 격리 패턴을 그대로 따르고, 신규 계약 대조
  단언도 그 안에 자연스럽게 끼워져 있어 테스트 간 의존성을 새로 만들지 않는다.

## 요약

이전 두 라운드에서 나온 Critical 1건(감사 로그 `user` 필드 유출)과 WARNING(자기참조 순환 가드
거짓 통과, `oneOf`/`anyOf` 미처리)이 모두 실제로 고쳐지고 판별력 있는 회귀 테스트로 고정된 것을
확인했다. 이번 라운드에서 새로 찾은 것은 전부 INFO 수준의 좁은 커버리지 갭이다 — `visitUnion`의
`allowUndeclared` 면제 경로가 판별력 없는 미검증 코드로 남아 있고, `AuditLogDto.user`의
`nullable` 분기는 현재 DB 제약상 도달 불가능해 보여 e2e 단언이 실질적으로 "항상 참"만 확인하며,
`AuditLogsService.findAll`의 나머지 필터 경로 미검증은 이전 라운드부터 이어지는 낮은 우선순위
항목이다. 발견의 성격이 이전 두 라운드의 "동작 결함"에서 이번 라운드는 "미검증 경로·설계 의도
불명확" 수준으로 내려온 것은 수렴 신호로 읽힌다. 병합을 막을 사유는 없다.

## 위험도

LOW
