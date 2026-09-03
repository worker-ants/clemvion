# 부작용(Side Effect) 리뷰 — entity nullable 배치 3 (2R, `AuthConfigDto.ipWhitelist` 수정 반영)

## 개요

이번 diff 는 이전 리뷰 라운드(`review/code/2026/09/03/18_30_53/`)의 산출물을 포함하며, 그 라운드가
남긴 WARNING(`AuthConfigDto.ipWhitelist` non-nullable Swagger 선언)을 그대로 반영해 수정한 상태다.
핵심 변경은 여전히 8개 엔티티 필드(column 7 · relation 1)의 TS 타입을 `nullable: true` DB 컬럼
실태에 맞춰 `| null` 로 넓히는 순수 타입 정합화이며, 여기에 `AuthConfigDto.ipWhitelist` 를
`string[]` → `string[] | null`(옵셔널) 로 정정하는 인터페이스 변경이 추가됐다.

## 발견사항

- **[INFO]** `AuthConfigDto.ipWhitelist` 필드 타입/Swagger 계약 변경 — 의도된 공개 API 인터페이스 변경
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:27-28`
  - 상세: `@ApiProperty({ type: [String], example: [] })` / `ipWhitelist: string[]` (필수·non-null)
    → `@ApiPropertyOptional({ type: [String], nullable: true, example: [] })` /
    `ipWhitelist?: string[] | null`. 이는 OpenAPI 스키마로 타입을 생성하는 클라이언트에게 실제로
    보이는 **공개 인터페이스 변경**이다. 다만 실제 wire 응답 자체는 바뀌지 않는다 —
    `AuthConfigsController`(`findAll`/`findByIdForResponse`)를 직접 열어 확인한 결과 `AuthConfigDto`
    는 `ClassSerializerInterceptor` 등 변환 계층 없이 Swagger 문서화 전용으로만 쓰이고, 엔티티가
    그대로 응답 바디로 나간다. 즉 `null` 이 실릴 수 있다는 사실은 이 PR 이전부터 참이었고, 이번
    변경은 스키마를 실제와 맞춘 것뿐이다(CHANGELOG.md 신규 항목에도 "동작 변경은 없다"로 명시).
  - 제안: 없음 — 의도된 정정이며 CHANGELOG·plan(§배치 3 W1)에 근거가 기록돼 있다. OpenAPI 로
    타입을 생성하는 클라이언트 쪽에서 이 필드가 `| null | undefined` 로 넓어짐을 인지할 필요는
    있으나 이는 리뷰가 아니라 릴리스 공지의 몫이다.

- **[INFO]** `FoldersController.update()` 캐스트 제거 — 호출 시그니처·런타임 인자 불변, 구조적 재검증 완료
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts` (`update()` 메서드,
    `this.foldersService.update(id, workspaceId, dto as Partial<Folder>)` → `dto`)
  - 상세: `FoldersService.update(id, workspaceId, data: Partial<Folder>)` 시그니처는 이 PR 에서
    바뀌지 않았고(`folders.service.ts:60-74`), `Object.assign(folder, data)` 로 병합하는 로직도
    그대로다. `UpdateFolderDto`(`name?`, `parentId?: string | null`, `sortOrder?`)를 직접 열어
    확인한 결과, 이번에 `Folder.parentId` 가 `string | null` 로 넓혀지면서 구조적으로
    `Partial<Folder>` 에 그대로 대입 가능해져 캐스트가 불필요해졌을 뿐이다. `as` 캐스트는 원래도
    런타임에 값을 변형하지 않으므로 캐스트 제거 전후로 `foldersService.update` 에 전달되는 객체는
    바이트 단위로 동일하다 — 호출자 영향 없음.
  - 제안: 없음(정보성).

- **[INFO]** 7개 엔티티 nullable 타입 확장 — DB/런타임 상태 변경 없음, 배치 1 이 학습한 부팅 실패
  함정도 재현 안 됨
  - 위치: `audit-log.entity.ts:43-44`, `auth-config.entity.ts:42-43,48-49`, `edge.entity.ts:56-57`,
    `folder.entity.ts:29-30,32-34`, `workflow-version.entity.ts:32-33`,
    `workspace-member.entity.ts:39-40`
  - 상세: 전 파일이 `synchronize: false`(확인됨) 이므로 TS 타입 확장이 DDL/스키마 자동 동기화를
    유발하지 않는다. `AuditLog.ipAddress` 에만 새로 추가된 `type: 'varchar'` 는, TS 필드가
    `string | null` (union) 로 바뀌면 `emitDecoratorMetadata` 의 `design:type` 이 `Object` 를
    방출해 TypeORM 이 컬럼 타입을 못 정하고 `DataTypeNotSupportedError` 로 **부팅 자체가
    실패하는** 배치 1 급 회귀를 이 diff 가 스스로 방지한 것으로, 새로운 부작용이 아니라 부작용
    예방 조치다. 나머지 필드는 이미 `type:` 이 명시돼 있거나(`ipWhitelist`·`lastUsedAt`·
    `condition`·`changeSummary`·`joinedAt`) `Folder.parentId` 는 동명 `@JoinColumn` 이 타입을
    공급하는 예외에 해당해 같은 함정에 걸리지 않는다(plan 문서의 주장을 코드로 직접 재확인).
  - 제안: 없음.

- **[INFO]** `scripts/backend-typecheck-baseline.json` 갱신 — 예상된 파생 산출물, 산술 일치 확인
  - 위치: `scripts/backend-typecheck-baseline.json` (`total: 198 → 197`,
    `src/modules/folders/folders.service.spec.ts` 항목 삭제)
  - 상세: 파일 자체 주석이 "손으로 고치지 말고 `check-backend-typecheck-ratchet.py --update` 로
    재생성" 이라고 명시하는 ratchet 게이트의 SoT 다. `folders.service.spec.ts` 의
    `null as unknown as string` 캐스트 제거로 그 파일의 `tsc` 오류 1건이 사라져 total 이 1
    감소한 것과 정확히 일치한다. 의도치 않은 파일시스템 변경이 아니라 정상 절차의 산출물이다.
  - 제안: 없음.

- **[INFO]** `review/code/2026/09/03/18_30_53/**` 신규 파일 13종 — 프로젝트 컨벤션에 따른 예상된
  파일시스템 side effect (리뷰 산출물)
  - 위치: `review/code/2026/09/03/18_30_53/{RESOLUTION,SUMMARY,security,performance*,requirement,
    scope,side_effect,maintainability,testing,documentation,database,api_contract}.md`,
    `_retry_state.json`, `meta.json`
  - 상세: 이 저장소의 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 컨벤션에 따라 이전 리뷰 라운드가
    생성한 산출물이다. 코드/런타임에 영향을 주는 파일이 아니며, `AuthConfigDto.ipWhitelist` WARNING
    에 대한 조치 근거(RESOLUTION.md)가 이번 diff 의 실제 코드 수정과 정확히 대응함을 대조 확인했다.
  - 제안: 없음.

## 점검했으나 이상 없음 (부작용 관점 8개 축 요약)

1. **의도치 않은 상태 변경 / 2. 전역 변수**: 새 전역 변수·모듈 레벨 상태 도입 없음. 모든 변경이
   클래스 필드 타입 애너테이션(및 `@Column` 메타데이터) 또는 캐스트 제거에 국한.
2. **파일시스템 부작용**: `scripts/backend-typecheck-baseline.json`·`review/code/**` 신규 파일 모두
   기대된 산출물로 추적됨(위 항목). `git status --short` 로 확인한 결과 이번 리뷰 turn 이 저장소를
   추가로 뮤테이션하지 않았음을 확인.
3. **시그니처 변경**: `FoldersController.update()` 호출부의 캐스트 제거는 `FoldersService.update()`
   시그니처 자체를 바꾸지 않는다(직접 확인). 그 외 함수 시그니처 변경 없음.
4. **인터페이스 변경**: `AuthConfigDto.ipWhitelist` 1건(위 상세 참조) — 의도적·문서화됨·wire 응답
   불변.
5. **환경 변수**: 읽기/쓰기 없음.
6. **네트워크 호출**: 없음.
7. **이벤트/콜백**: 없음 — 이번 diff 에 이벤트 발행/구독·콜백 등록 코드 없음.
8. **소비처 null 처리**: `auth-configs.service.ts` 의 `ac.ipWhitelist?.length`,
   `workflows.service.ts` 의 `e.condition ?? null` 등 소비 코드는 이미 `null` 을 방어적으로
   다루고 있어(엔티티 타입만 거짓말하고 있었음) 이번 타입 확장이 새로운 런타임 NPE 를 유발하지
   않는다.

## 요약

이번 diff 는 이전 리뷰 라운드가 지적한 유일한 WARNING(`AuthConfigDto.ipWhitelist` non-nullable
Swagger 선언)을 그대로 반영해 정정한 상태이며, 정정 자체도 부작용 관점에서 안전하다 —
`AuthConfigDto` 는 응답 직렬화에 관여하지 않는 Swagger 전용 타입이라 이 인터페이스 변경이 실제
wire 응답을 바꾸지 않는다(직접 확인). 나머지 7개 엔티티 필드 타입 확장은 `synchronize: false`
하에서 DB/런타임 부작용이 없고, `AuditLog.ipAddress` 에 추가된 `type: 'varchar'` 는 오히려 과거
부팅 실패 클래스를 예방하는 조치다. `FoldersController.update()` 캐스트 제거는 시그니처·런타임
인자 불변임을 소스 대조로 재확인했다. `scripts/backend-typecheck-baseline.json` 갱신과
`review/code/2026/09/03/18_30_53/**` 신규 파일은 모두 프로젝트 컨벤션이 예정한 파생 산출물이다.
새로운 전역 상태·시그니처/인터페이스 파손·환경변수·네트워크·이벤트 부작용은 발견되지 않았다.

## 위험도

NONE
