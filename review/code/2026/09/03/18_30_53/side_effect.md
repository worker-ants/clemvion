# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `AuthConfig.ipWhitelist` 엔티티가 `string[] | null` 로 넓혀졌는데 응답 DTO는 여전히 non-null 을 문서화
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:28` (`ipWhitelist: string[];`, `@ApiProperty` — `nullable` 미지정) vs `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts:43` (`ipWhitelist: string[] | null;`)
  - 상세: `AuthConfigDto` 는 런타임 매핑 클래스가 아니라 Swagger 전용 타입 선언(컨트롤러가 서비스 반환값을 그대로 wrapping)이라 이 diff 자체가 실제 API 응답을 바꾸지는 않는다. 또한 DB 컬럼은 이 PR 이전부터 `nullable: true` 였으므로 `null` 이 응답에 실릴 가능성 자체는 새로 생긴 것이 아니라 이번에 엔티티 타입이 정직해지며 **드러난** 선재(pre-existing) 계약 불일치다. 같은 DTO 안의 `lastUsedAt?: string | null` 은 이미 nullable 로 맞춰져 있어 `ipWhitelist` 만 비대칭이다. `plan/in-progress/entity-nullable-column-type-mismatch.md`(§배치 3 "새로 드러난 축")가 이 사실을 스스로 실측해 명시적으로 이번 PR 범위 밖으로 defer 했으므로 은폐된 결함은 아니다.
  - 제안: 후속 작업(plan 이 이미 항목화함)에서 `AuthConfigDto.ipWhitelist` 를 `ipWhitelist?: string[] | null`(또는 `nullable: true` swagger 옵션)로 정정. 나머지 7개 엔티티(`audit-log`·`edge`·`folder`·`workflow-version`·`workspace-member`)의 대응 응답 DTO는 이미 nullable 로 선언돼 있어 이 클래스의 비대칭이 재발하지 않음을 확인했다.

- **[INFO]** `FoldersController.update` 시그니처 실질 변경 없음 — 캐스트 제거는 순수 컴파일타임 정리
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts` (`update` 메서드) — `this.foldersService.update(id, workspaceId, dto as Partial<Folder>)` → `this.foldersService.update(id, workspaceId, dto)`
  - 상세: `FoldersService.update(id, workspaceId, data: Partial<Folder>)` 시그니처 자체는 이 PR 에서 바뀌지 않았다(`codebase/backend/src/modules/folders/folders.service.ts` `update` 메서드). `UpdateFolderDto.parentId` 는 이 PR 이전부터 이미 `string | null` 로 선언돼 있었는데, `Folder.parentId` 가 그동안 `string`(non-null) 이라 구조적으로 안 맞아 캐스트가 필요했다. 이번 diff 로 `Folder.parentId` 가 `string | null` 로 넓혀지며 캐스트가 불필요해졌을 뿐 — 런타임 동작(전달되는 객체 참조·필드)은 완전히 동일하다. 호출자(다른 서비스/컨트롤러)에 영향 없음.
  - 제안: 없음(정보성).

- **[INFO]** `scripts/backend-typecheck-baseline.json` 갱신은 도구가 관리하는 파생 산출물 — 예상된 파일시스템 변경
  - 위치: `scripts/backend-typecheck-baseline.json` (`total: 198 → 197`, `folders.service.spec.ts` 항목 삭제)
  - 상세: 이 파일은 자기 자신의 주석("손으로 고치지 말고 `check-backend-typecheck-ratchet.py --update` 로 재생성")이 명시하듯 ratchet 게이트의 SoT 이며, `folders.service.spec.ts` 의 `as unknown as string` 캐스트 제거로 그 파일의 `tsc` 오류가 0이 되어 total 이 정확히 1 감소한 것과 산술이 일치한다. 의도치 않은 파일시스템 부작용이 아니라 이 plan(§배치 3)이 명시한 정상 절차의 산출물이다.
  - 제안: 없음.

## 점검했으나 이상 없음 (부작용 관점)

- **전역 변수/모듈 상태**: 8개 엔티티 파일 모두 TypeORM `@Column` 데코레이터의 TS 타입만 `| null` 로 넓혔고 `synchronize`(전역 grep 결과 전부 `false`)를 쓰지 않으므로 스키마 auto-migration 부작용 없음. `audit-log.entity.ts` 에 추가된 `type: 'varchar'` 는 DB 실측(`information_schema`, 마이그레이션 `V001:326`)과 일치하는 메타데이터 보정이며 쿼리 빌딩 동작을 바꾸지 않는다.
- **소비처 null 처리**: `auth-configs.service.ts:356`(`ac.ipWhitelist?.length`), `workflows.service.ts:733`(`e.condition ?? null`) 등 실제 소비 코드는 이미 `null` 을 방어적으로 다루고 있어(엔티티 타입만 거짓말하고 있었음) 이번 타입 확장이 새로운 런타임 NPE 를 유발하지 않는다. `folder.entity.ts`·`workflow-version.entity.ts`·`edge.entity.ts`·`workspace-member.entity.ts` 의 대응 응답 DTO 는 이미 nullable 로 선언돼 있어 계약 불일치가 없다.
- **네트워크·환경변수·이벤트/콜백**: 해당 없음 — 이번 diff 는 엔티티 타입 선언, 컨트롤러의 불필요 캐스트 제거, 테스트 fixture 캐스트 제거, plan 문서·ratchet baseline 갱신뿐이며 외부 호출·env 읽기/쓰기·이벤트 발행 경로를 건드리지 않는다.
- **저장소 뮤테이션(리뷰 절차)**: 본 리뷰는 검증을 위해 저장소 파일을 수정하지 않았다(`git status --short` 로 확인, 리뷰 산출물 디렉터리만 untracked).

## 요약

이번 변경은 8개 엔티티의 TS 필드 타입을 `nullable: true` DB 컬럼 실태에 맞춰 `| null` 로 넓히고, 그로 인해 불필요해진 캐스트(컨트롤러 1곳·spec fixture 1곳)를 제거하며, 관련 plan 문서·`tsc` ratchet baseline 을 갱신한 순수 타입 정합화 작업이다. 함수/메서드의 런타임 시그니처는 바뀌지 않았고(구조적 캐스트만 제거), 값 자체는 이 PR 이전부터 DB 상 nullable 이었으므로 소비 코드의 실제 동작 변화는 없다(grep 으로 8개 필드 전 소비처를 확인, 모두 이미 null-safe). 유일하게 남는 것은 `AuthConfigDto.ipWhitelist` 가 여전히 non-null 로 문서화된 Swagger 계약 비대칭인데, 이는 이번 PR 이 새로 만든 것이 아니라 drẻ러낸 선재 결함이며 plan 문서가 이미 실측·명시적으로 후속 항목화해 은폐되지 않았다. 전역 상태·파일시스템·네트워크·환경변수·이벤트 경로에 대한 의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW
