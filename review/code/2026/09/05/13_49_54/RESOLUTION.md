# RESOLUTION — `review/code/2026/09/05/13_49_54`

전체 위험도 **CRITICAL** · Critical **1** · WARNING **5** · INFO **8**. **전건 조치 완료.**

Critical 은 **살아있는 보안 결함**이었다. 리뷰어 주장을 그대로 받지 않고 실 HTTP 응답으로
확증한 뒤 고쳤다.

## 조치 항목

| # | 카테고리 | 지적 | 조치 | 커밋 |
|---|---|---|---|---|
| 1 | requirement | §5.4 검증자가 중첩을 안 봐서 `AuditLogDto.user` 의 민감정보 노출을 놓친다. `AuditLogsService.findAll` 이 raw `User` 엔티티를 그대로 반환한다 | **양쪽 다 고쳤다** — (a) 조회를 `AuditLogUserDto` 가 광고하는 3필드만 select 하도록 좁힘, (b) 검증자가 `$ref`/`allOf` 를 따라 중첩 DTO 로 내려가게 함 | `45c1cdf63` |
| 2 | architecture, maintainability | DTO 식별자가 클래스와 문자열로 이중 표현 — 리네임 시 실패 메시지가 조용히 낡는다 | `DtoContract` 가 `Dto.name` 을 파생해 들고 다닌다. 호출부 4곳 전부 문자열 인자 제거 | `45c1cdf63` |
| 3 | maintainability, architecture | `'missing'` 이 "필드 누락" 과 "payload 가 객체 아님" 두 뜻으로 재사용 | `'invalid-payload'` kind 신설. 유닛 캐너리가 종류를 직접 단언 | `45c1cdf63` |
| 4 | requirement | JSDoc 이 규칙 표 전체를 "§5.4 를 그대로 옮긴 것" 이라 주장하나 넷째 행(undeclared)은 spec 에 없다 | 표에 **출처 열**을 추가해 앞 3행(§5.4)과 넷째 행(이 검증자의 확장)을 갈랐다 | `45c1cdf63` |
| 5 | api_contract | JSDoc·구현·호출부 주석이 "키 생략형 + nullable" 에서 서로 다른 말. 호출부는 "22개 필드를 한 번에 문다" 로 커버리지 과장 | 세 곳을 맞췄다. 호출부 주석을 실제 커버리지로 좁힘 — required 12개는 엄격, 나머지 10개는 **있을 때만** 검사, 반대 방향(undeclared)은 전부 | `45c1cdf63` |
| 6 | maintainability | `find → toBeDefined → assert` 3문장이 2곳에서 반복. 스윕이 56개로 늘린다 | **유예 + 등재** (근거는 아래 §보류) | `plan` 갱신 |

INFO 는 7·11·12·13 을 함께 닫았다 (`beforeAll` 캐싱 통일 · 배열 payload 가드 · 중첩
`$ref` 분기 테스트 · `.sort()` 미검증). 8·9·10·14 는 조치 불요(이미 등재됐거나 근거가 있다).

## Critical #1 — 리뷰어 말을 받지 않고 실측했고, 맞았다

### 유출은 살아 있었다

`GET /api/audit-logs` 응답의 `user` 객체 키를 e2e 로 세니 **26개**였다:

```
avatarUrl createdAt emailChangeExpiresAt emailChangeToken emailVerified
emailVerifyExpiresAt emailVerifyToken locale lockedUntil loginAttempts
notificationPreferences oauthProvider oauthProviderId passwordHash
passwordResetExpiresAt passwordResetToken pendingEmail theme totpRecoveryCodes
twoFactorEnabled twoFactorSecret updatedAt webauthnRecoveryCodes  (+ id name email)
```

`AuditLogUserDto` 는 id/name/email **3필드**만 광고한다. 노출된 것 중 `passwordHash` ·
`twoFactorSecret` · `totpRecoveryCodes` · `webauthnRecoveryCodes` 는 자격증명이고,
`passwordResetToken` · `emailVerifyToken` · `emailChangeToken` 은 **계정 탈취 수단**이다.

원인은 `leftJoinAndSelect('al.user','user')` + 컨트롤러의 엔티티 그대로 반환이다. 거르는
층이 하나도 없다 — `User` 에 `select: false` **0건**, `@Exclude()` **0건**, 전역
`ClassSerializerInterceptor` **없음**, `TransformInterceptor` 는 `{data}` 래핑만 한다.

### 지적받은 한 곳이 아니라 클래스를 열거했다

같은 형태가 더 있는지 전수로 봤다:

| 형태 | 건수 | 판정 |
|---|---|---|
| `*JoinAndSelect` 로 user 관계 적재 | **1** (audit-logs) | **이 결함** |
| `*JoinAndSelect` 로 그 밖 관계 적재 | 9 | workflow·trigger·entity — user 아님 |
| `relations: ['user']` | 3 | `workspaces`(**명시 매핑**으로 6필드만) · `auth` 2곳(logout·refresh, 내부 경로라 미반환) |

`AuditLog.user` 를 읽는 다른 소비처도 없다(`findAll` 호출부는 컨트롤러 하나뿐).

### 수정 — 데이터가 애초에 DB 밖으로 나가지 않게

```ts
.leftJoin('al.user', 'user')
.addSelect(['user.id', 'user.name', 'user.email'])
```

명시 매핑 대신 select 축소를 택한 이유: 매핑은 `AuditLog` 의 필드를 **하나라도 빠뜨리면**
그 필드가 영구히 사라지는데, select 축소는 `al.*` 를 건드리지 않고 `user` 만 좁힌다. 좁히는
대상이 정확히 DTO 가 광고하는 3필드라 API 계약과도 일치한다. (워크스페이스 멤버 목록은
명시 매핑을 쓰는데, 그쪽은 애초에 6필드 투영을 반환 타입으로 선언한 자리다.)

### 검증자가 그 유출을 통과시켰다는 것이 이 지적의 핵심이다

같은 PR 이 **바로 그 엔드포인트**에 계약 단언을 새로 넣었는데도 통과했다. 최상위에서는
`user` 키 하나가 선언대로 있을 뿐이기 때문이다. 그래서 프로퍼티 스키마가 `$ref`(또는
`allOf` 안의 `$ref`)로 다른 DTO 를 가리키면 그 스키마로 **내려가게** 했다. 배열은 원소마다
내려가고, 위반 경로는 `user.passwordHash` · `children[1].leak` 처럼 찍힌다. 순환 참조는
**경로별** 방문 집합으로 막는다(형제 가지는 서로 막지 않는다 — 같은 DTO 가 여러 필드에
나오는 것은 순환이 아니다).

**고쳤다는 것을 뮤테이션으로 확인했다.** 서비스를 유출 상태로 되돌려 e2e 를 돌리니 계약
단언이 **23키를 전부 경로와 함께** 잡았다 — 고치기 전이라면 통과했을 그 응답이다.

### 회귀를 두 층에 고정했다

| 층 | 캐너리 | 판별력 실측 |
|---|---|---|
| unit | `qb.leftJoin` + `addSelect(['user.id','user.name','user.email'])` 호출 단언 + `leftJoinAndSelect` 키 부재 | `leftJoinAndSelect` 복귀 뮤턴트 → **RED 3건** |
| e2e | 계약 대조(중첩 포함) + `Object.keys(user)` 직접 단언 | 유출 복귀 뮤턴트 → **FAIL 1스위트** |

e2e 쪽에 `Object.keys` 단언을 **따로** 남긴 이유: 이 유출을 놓친 것이 바로 그 검증자였다.
검증자의 정확성에 기대지 않는 독립 캐너리가 하나 있어야 같은 실수가 다시 조용히 지나가지
않는다.

## 이 PR 이 세운 것 — 배선된 4개 DTO

| DTO | 엔드포인트 | e2e | required |
|---|---|---|---|
| `ExecutionDto` | `GET /api/executions/workflow/:id` | `workflow-execution` | 12 |
| `WorkflowDto` | `GET /api/workflows` | `workflow-crud` | 10 |
| `AuditLogDto` | `GET /api/audit-logs` | `audit-logs` | 8 |
| `SessionDto` | `GET /api/users/me/sessions` | `session-revocation` | 7 |

네 자리 모두 payload 를 `{}` 로 바꾼 뮤턴트가 **그 자리만** RED 를 냈다(51스위트 중 1개 →
3개). 빌드 캐시를 전부 prune 한 뒤 돌려 "옛 이미지가 옛 테스트를 통과시킨 것" 이라는 가설도
배제했다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`14:18:27`) |
| unit | **PASS** — 446 스위트 / 9,370 통과 (`14:20:50`). 새 스펙 29개(18→29), audit-logs 스펙 12개 |
| build | **PASS** (`14:34:53`) |
| e2e | **PASS** — 51 스위트 / 295 통과 (`e2e-20260905-143633.log`) |

인용한 e2e 는 **fix 커밋(`45c1cdf63`) 이후**에 시작된 실행이다 — 추론으로 "같은 트리였다"
고 말하지 않고, 커밋된 상태에서 직접 다시 돌린 값이다.

**e2e 면제 아님** — 코드 변경이므로 수행했다.

## 보류·후속 항목

**W6(헬퍼로 접기)만 유예했고, 그 턴에 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재했다.**

`developer` SKILL §수렴 예외 (a)~(d) 로 갈음한다:

- **(a) 동작 결함이 아니다** — 재현되는 오동작이 없고 중복 3문장이 2곳에 있는 구조 문제다.
- **(b) 고치면 라운드가 는다** — 공유 테스트 헬퍼를 건드리므로 게이트 freshness 가 재무장된다.
- **(c) 근거**: 지금 2곳이고, 어떤 시그니처가 맞는지는 스윕이 실제로 어떤 형태들(목록/단건/
  중첩 배열)을 만나는지 봐야 정해진다. 시작도 안 한 스윕을 위해 API 를 먼저 굳히면 **그
  API 가 스윕을 규정한다.** 대신 중복의 절반은 이번에 이미 걷어냈다 — 계약 캐싱을
  `beforeAll` 로 통일했고 DTO 이름을 `DtoContract` 가 파생하므로 호출부가 문자열을 다시
  치지 않는다.
- **(d) 등재는 이 턴에** 했다 (신규 항목).

함께 열려 있는 항목 — 전부 같은 트래커에 있다:

| 항목 | 트랙 |
|---|---|
| §5.4 검증자 스윕: 응답 DTO 60개 중 4개 완료 | developer |
| `2-api-convention.md` frontmatter `code:` 에 §5.4 검증자 등재 | planner |
| 스윕 시 `find → toBeDefined → assert` 헬퍼 (W6) | developer |
| Flyway `mixed=true` 도입 여부 | planner + 인프라 |
| 해소 불가 bare 인용 8건 | developer |
| `spec/5-system/` `## Overview` 유무 불일치 | planner |

## 자기 정정 — 게이트를 재현했다가 틀렸다

spec 연결 여부를 직접 짠 glob 매처로 판정해 *"어느 파일도 `code:` glob 에 안 걸린다"* 고
적었다. Python `fnmatch` 의 `**/` 처리 때문에 `spec/5-system/1-auth.md` 의
`codebase/backend/src/modules/audit-logs/**/*.ts` 를 놓친 것이다. 정본
`review_guard._spec_linked_changes()` 에 물으니 **spec-linked 2건**이고, 따라서
`--impl-done` 이 의무다. **정본 구현이 있으면 재현하지 말고 실행할 자리였다.**
