# 요구사항(Requirement) 충족 리뷰

## 리뷰 범위

`entity-nullable-column-type-mismatch` plan "배치 3 — 잔여 전량"의 2R(재검토) 대상. 이번 diff 는
전 리뷰 라운드(`review/code/2026/09/03/18_30_53`)의 산출물(SUMMARY/RESOLUTION/9개 agent report/
meta.json/_retry_state.json)과, 그 라운드의 **W1 을 실제로 반영한 코드 수정**(커밋 `af1651264`)을
함께 포함한다. 실질 코드 변경은:

- 엔티티 8개 필드(column 7·relation 1) TS 타입을 `| null` 로 확장 (`audit-log`·`auth-config`(2)·
  `edge`·`folder`(2)·`workflow-version`·`workspace-member`)
- `AuthConfigDto.ipWhitelist` 를 `string[]` → `string[] | null` + `@ApiPropertyOptional({nullable:true})`
  로 정정 (전 라운드 W1 반영)
- 불필요해진 캐스트 2건 제거 (`folders.controller.ts`, `folders.service.spec.ts`) + 낡은 캐스트
  1건 추가 발견·제거 (`auth.service.spec.ts:58` `lockedUntil: null as unknown as Date`)
- `scripts/backend-typecheck-baseline.json`, plan 문서, CHANGELOG.md 갱신

## 검증 방법 (직접 재실행/대조 — 전 라운드를 그대로 신뢰하지 않고 재확인)

- `spec/1-data-model.md` 전수 grep: `ip_address`(§2.1/§2.3 계열)·`ip_whitelist`(§2.17:621)·
  `last_used_at`(§2.17:623)·`condition`(§2.6:216)·`parent_id`(§2.4:135)·`change_summary`(§2.x:575)·
  `joined_at`(§2.x:109) — **전부 `?` (nullable) 로 문서화**돼 있음을 라인 단위로 직접 확인.
- `codebase/backend/migrations/V001__initial_schema.sql` 직접 열람: 위 7개 컬럼 DDL — 전부
  `NOT NULL` 없음 (`ip_address VARCHAR(45)` L326 · `ip_whitelist TEXT[]` L201 · `condition JSONB` L132 ·
  `parent_id UUID REFERENCES folder(id)...` L68 · `change_summary TEXT` L257 · `joined_at TIMESTAMPTZ` L57).
  spec·DB·코드 3자 일치 확인.
- `AuditLog.ipAddress` 의 `type: 'varchar', length: 45` 를 형제 엔티티
  `login-history.entity.ts:41`·`refresh-token.entity.ts:44` 와 직접 diff 없이 원문 대조 — **완전 동일
  선언**(`@Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })`).
- **`AuthConfigDto.ipWhitelist` 수정이 [API 규약 §5.4](spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략)
  를 정확히 만족하는지 직접 원문 대조**: §5.4 는 "`null` 을 쓰는 필드는
  `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`" 이라고 명시하며, 이 diff 의
  `@ApiPropertyOptional({ type: [String], nullable: true, example: [] }) ipWhitelist?: string[] | null;`
  가 이 문구와 line-level 로 일치함을 확인.
- `AuthConfigsController` 원문 확인 — 서비스 반환 엔티티를 `ClassSerializerInterceptor` 등 매핑 계층
  없이 그대로 응답 바디로 반환(`findAll`/`findOne` 핸들러)함을 재확인, 전 라운드의 "실제로 null 이
  실려 나간다" 진단이 맞음.
- `auth-configs.service.ts:356-357` 소비처 확인 — `if (ac.ipWhitelist?.length) { ...this.ipInWhitelist(ctx.clientIp, ac.ipWhitelist) }`
  로 이미 null-safe. 이 diff 로 인한 새 런타임 결함 없음.
- `UpdateFolderDto.parentId?: string | null` (`update-folder.dto.ts:33`) 와 `FoldersService.update(id, workspaceId, data: Partial<Folder>)` 원문 확인 —
  `Folder.parentId: string | null` 로 넓혀진 뒤 구조적으로 `Partial<Folder>` 에 그대로 대입 가능해져
  `folders.controller.ts` 의 `as Partial<Folder>` 캐스트 제거가 타입상 정확함을 확인. `Folder` import 도
  완전히 제거돼 dead import 없음(grep 재확인).
- `auth.service.spec.ts:58` `mockUser: Partial<User>` 원문 확인 — `User.lockedUntil: Date | null`
  (`user.entity.ts:150`) 이미 배치 1 에서 넓혀져 있어 `lockedUntil: null` 캐스트 없이 타입 통과.
  `folders.service.spec.ts:14` `mockFolder: Partial<Folder>` 도 동일 논리로 `parentId: null` 캐스트
  불필요 확인.
- 변경 파일 8개(엔티티 7 + 컨트롤러) 전수 grep — `TODO`/`FIXME`/`HACK`/`XXX` **0건**.
- CHANGELOG.md 신규 항목 원문 대조 — before/after 표·§5.4 인용·영향 서술이 실제 diff 와 정확히
  일치.

## 발견사항

- **[INFO]** `codebase/frontend/.../authentication/auth-config-types.ts` 의 손으로 유지되는
  `AuthConfig.ipWhitelist?: string[]` (`| null` 없음) 이 이제 정확해진 백엔드 계약(`| null`)과
  여전히 어긋난다.
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/authentication/auth-config-types.ts:18`
    (이번 diff 밖)
  - 상세: 이 diff 범위 밖이며, 같은 파일의 `lastUsedAt?: string`(`| null` 없음, 17행)도 이번 PR
    이전부터 이미 부정확했던 것과 같은 클래스라 **이 diff 가 새로 만든 gap 이 아니다**. 실사용
    소비 코드(`auth-config-form.ts:177` `(c.ipWhitelist ?? []).join(...)`)는 이미 `?? []` 로
    방어적이고, 같은 폴더의 `auth-config-form.ts:158` 은 이미 `ipWhitelist?: string[] | null`
    로 정확히 선언돼 있어 실제 런타임 위험은 없다. FE 는 OpenAPI 생성 타입이 아니라 손으로
    유지하는 타입이라 백엔드 계약 변경이 FE 컴파일 오류로 자동 드러나지 않는다.
  - 제안: 이번 PR 은 백엔드 전용 배치라 조치 불요. 후속으로 FE `AuthConfig`/`AuthConfigUsage`
    타입을 백엔드 DTO 와 대조해 정리할 여지가 있음(우선순위 낮음, 이미 방어적 소비 코드로 실질
    위험 없음).

이 외에 요구사항 충족 관점에서 새로 지적할 결함은 발견되지 않았다. 전 라운드가 WARNING 으로
지목했던 `AuthConfigDto.ipWhitelist` API 계약 불일치(W1)는 §5.4 규약 문구와 line-level 로 정확히
일치하는 형태로 **실제 코드에 반영되어 해소**됐음을 spec 원문 대조로 재확인했다 — RESOLUTION.md
가 자기 주장한 인용이 정확하다.

## 요약

7개 엔티티의 nullable 필드 8개(column 7·relation 1)를 `| null` 로 넓히는 순수 타입 정합화이며,
`spec/1-data-model.md`·`V001__initial_schema.sql` 양쪽과 line-level 로 재검증해 완전히 일치함을
확인했다. `AuditLog.ipAddress` 의 `type: 'varchar'` 추가는 형제 엔티티(login-history·refresh-token)
선언과 문자 그대로 동일하다. 전 리뷰 라운드가 WARNING(W1)으로 지목한 `AuthConfigDto.ipWhitelist`
비-nullable 문서화는 이번 diff 에서 `@ApiPropertyOptional({nullable:true})` + `ipWhitelist?: string[] | null`
로 정정됐고, 이 형태가 API 규약 §5.4 문구와 정확히 일치함을 spec 원문 대조로 재확인했다 — 코드
fix 가 spec 이 정의한 정답과 line-level 로 부합한다. 캐스트 제거 3건(컨트롤러 1·spec fixture 2)은
모두 대상 엔티티 타입 확장의 구조적·논리적 필연으로, 원문 확인 결과 실제로 캐스트 없이도 타입이
통과함을 확인했다. TODO/FIXME 류 미완성 표식 없음, 반환값·에러 시나리오·데이터 유효성·비즈니스
로직에 영향 없는 순수 타입 변경이다. 유일한 신규 관찰은 FE 손유지 타입(`auth-config-types.ts`)의
선재 nullable 표기 누락으로, 이 diff 범위 밖이고 소비 코드가 이미 방어적이라 차단 사유 아님.

## 위험도

NONE
