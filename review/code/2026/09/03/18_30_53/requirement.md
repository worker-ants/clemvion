# 요구사항(Requirement) 충족 리뷰

## 리뷰 범위

`entity-nullable-column-type-mismatch` plan 의 "배치 3 — 잔여 전량" — 엔티티 8개 필드(column 7 · relation 1)를
`| null` 로 넓히고, 그로 인해 불필요해진 캐스트 2건(`folders.service.spec.ts` fixture 캐스트,
`folders.controller.ts` 의 `dto as Partial<Folder>`)을 제거했다. `scripts/backend-typecheck-baseline.json`
과 plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`)가 함께 갱신됐다.

## 검증 방법

- `spec/1-data-model.md` 에서 대상 7개 필드(`ip_address`·`ip_whitelist`·`last_used_at`·`condition`·
  `parent_id`·`change_summary`·`joined_at`) 표기를 전수 grep — 전부 `?`(nullable) 로 명시돼 있음을 확인.
- `codebase/backend/migrations/V001__initial_schema.sql` 에서 같은 7개 컬럼 DDL 을 전수 grep — 전부
  `NOT NULL` 이 없음을 확인 (DB 레벨 nullable 과 spec·코드가 3자 일치).
- `audit_log.ip_address` 의 `type: 'varchar', length: 45` 를 마이그레이션(`:326` `VARCHAR(45)`)·형제 엔티티
  (`login-history`·`refresh-token`, 둘 다 동일 선언)와 대조 — 일치.
- `npx tsc --noEmit -p tsconfig.json` 실측: 총 오류 **197건** — `python3 scripts/check-backend-typecheck-ratchet.py`
  가 baseline(197)과 일치한다고 확인. 변경된 7개 엔티티 파일·`folders.controller.ts` 에서 발생하는 오류
  **0건**. `folders.service.spec.ts` 는 baseline 목록에서 제거됐고 실제로 tsc 오류 목록에도 나타나지
  않음(캐스트 제거가 실제로 그 파일의 1건을 없앴다는 plan 의 주장과 일치).
- `npx jest src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` — 12/12 PASS (plan 의 "가드 12/12"
  주장과 일치, `folder.parentId` 의 JoinColumn 예외가 오탐 없이 통과).
- `npx jest src/modules/folders` — 2 suites / 20 tests 전부 PASS (`folders.controller.ts`·
  `folders.service.spec.ts` 변경 후 회귀 없음).
- `folders.service.ts`의 `parentId` 소비처(`data.parentId` truthy 체크·`?? null` 패턴) 전수 확인 — 널 처리가
  이미 방어적이라 타입 확장으로 인한 런타임 회귀 없음.

## 발견사항

- **[INFO]** `AuthConfigDto.ipWhitelist: string[]` (non-null) 이 엔티티(`AuthConfig.ipWhitelist: string[] | null`)·
  spec(`spec/1-data-model.md:621` `String[]?`) 과 불일치 — 서비스가 실제로 `null` 을 반환할 수 있는데
  Swagger 계약은 그렇지 않다고 문서화한다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:28`
  - 상세: 이 diff 가 만든 gap 이 아니라 이번 배치가 엔티티 타입을 실제(nullable) 에 맞게 정정하면서
    "드러난" 선재 gap 이다. `plan/in-progress/entity-nullable-column-type-mismatch.md` §배치 3 이 이미
    "이 PR 에서 고치지 않았다"·"49건(12파일), 아직 작업 항목 아님"으로 명시적으로 스코프 아웃하고 이유
    (다른 계층·외부 계약·"한 자리만 고치면 안 된다"는 이 plan 자신의 안티패턴 진단)를 남겼다. 코드 결함이지만
    이 PR 범위 밖으로 정당하게 유예됐고 추적 문서가 있으므로 차단 사유 아님.
  - 제안: 없음 (이미 plan 에 후속 축으로 기록됨, 별도 조치 불요).

- **[INFO]** `folders.controller.ts` 의 `dto as Partial<Folder>` → `dto` 캐스트 제거는 plan 본문이
  명시한 "1건"(`folders.service.spec.ts:14`)과 별개의 두 번째 캐스트 제거다. plan 텍스트는
  `.spec.ts` fixture 캐스트만 세었고 프로덕션 코드(`folders.controller.ts`)의 캐스트는 언급하지 않는다.
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts` (import 제거 + `update()` 메서드)
  - 상세: 기능적으로는 올바른 정리다 — `Folder.parentId` 가 `string | null` 로 넓혀지면서
    `UpdateFolderDto.parentId?: string | null` 이 `Partial<Folder>` 에 구조적으로 그대로 대입 가능해져
    캐스트가 불필요해졌고, tsc·jest 로 회귀 없음을 확인했다. 다만 plan 문서의 "무엇을 지웠는가" 서술이
    이 캐스트를 셈에서 빠뜨려 완전하지 않다.
  - 제안: 코드는 유지. plan 문서에 이 두 번째 캐스트 제거를 한 줄 추가하면 서술이 완전해진다(선택 사항,
    차단 사유 아님).

## 요약

7개 엔티티의 8개 nullable 필드(column 7 · relation 1)를 `| null` 로 넓히는 변경이 spec(`1-data-model.md`)
과 DB 마이그레이션(V001) 양쪽에 **line-level 로 정확히 일치**함을 전수 grep 으로 확인했다. `audit_log.ip_address`
에만 필요한 `type: 'varchar'` 추가는 마이그레이션·형제 엔티티 선언과 대조해 정확했고, 나머지 필드는 관계
(JoinColumn) 예외 또는 기존 `type:` 선언이 이미 있어 배치 1 이 학습한 "TypeORM 이 `string | null` 을
`Object` 로 방출해 부팅이 깨진다" 함정을 재현하지 않는다. `folders.controller.ts`/`folders.service.spec.ts`의
캐스트 제거는 타입 확장의 논리적 귀결이며 tsc(197/197 ratchet 일치)·가드(12/12)·folders 유닛테스트(20/20)로
직접 재현·검증했다. TODO/FIXME 류 미완성 표식 없음, 반환값·에러 시나리오·데이터 유효성에 영향 없는 순수 타입
변경이다. 발견된 두 건은 모두 INFO — 하나는 이미 plan 에 정당하게 스코프 아웃·기록된 선재 DTO 계약 gap,
다른 하나는 plan 서술의 사소한 누락(코드 자체는 정확)이다. 코드 fix 를 요하는 CRITICAL/WARNING 없음.

## 위험도

LOW
