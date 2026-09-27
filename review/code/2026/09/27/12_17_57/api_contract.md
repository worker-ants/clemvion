# API 계약(API Contract) 리뷰

## 검토 범위 및 방법

`origin/main` 대비 diff 32개 파일 중 실제 API 계약에 영향을 줄 수 있는 코드/DTO/테스트는 10개
(`CHANGELOG.md`, `omit-undefined.{ts,spec.ts}`, `folder-response.dto.{ts,spec.ts}`,
`folders.service.{ts,spec.ts}`, `triggers.service.ts`, `swagger-dto-contract.spec.ts`,
`folder-crud.e2e-spec.ts`)이고, 나머지 22개(`plan/**`, `review/code/2026/09/27/11_53_51/**`,
`review/consistency/2026/09/27/10_39_26/**`)는 이번 PR 의 1차 `/ai-review`(Critical 0 · Warning 2) 및
`--impl-prep` consistency-check 산출물·트래커 갱신으로, 코드가 아니다. 이번 2회차 리뷰는 사실상 1회차
리뷰(`review/code/2026/09/27/11_53_51/api_contract.md`, LOW)가 지적한 항목의 처분 결과를 재확인하는
성격이다. 저장소 파일은 읽기만 했고 뮤테이션은 가하지 않았다(`git status --short` 로 확인).

## 발견사항

- **[INFO]** `omitUndefined()` 헬퍼가 `Object.assign` 대상 키를 화이트리스트하지 않는다 (1R INFO 1 재확인)
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:12-16` (함수 본문), 호출부
    `codebase/backend/src/modules/folders/folders.service.ts:73-77`, `codebase/backend/src/modules/triggers/triggers.service.ts:619-622`
  - 상세: 1R 에서 W1 으로 지적된 "필터 관용구 중복"이 공용 헬퍼로 추출되면서, 그 헬퍼가 `undefined` 값만 걸러낼 뿐
    `data` 의 키 자체는 걸러내지 않는다는 성질도 함께 두 호출부에 그대로 남았다. 두 호출부 모두 컨트롤러가 타입 있는
    DTO(`UpdateFolderDto`)로만 호출하고 전역 `CustomValidationPipe`(whitelist + forbidNonWhitelisted)가 방어하므로
    새로 열리는 공격면은 아니다 — 헬퍼 추출 자체가 방어 범위를 넓히거나 좁히지 않았다. plan
    (`plan/in-progress/spec-draft-nullable-notation-followups.md` "`Object.assign(엔티티, DTO)` … 남은 세 곳" 항목)이
    "착수 때 그 컨트롤러의 `@Body()` 가 타입 있는 DTO 클래스인지 확인" 을 이미 판단 항목으로 명시해 뒀다.
  - 제안: 조치 불요(1R 에서 이미 INFO 로 처분, 헬퍼 추출로 위험이 변하지 않았음을 확인). 후속 3곳(`workflows` ·
    `nodes` · `auth-configs`) 적용 시 그 판단 항목을 그대로 따를 것.

- **[INFO]** `FolderDto.parentId` OpenAPI 선언이 optional→required(+nullable)로 좁아진다 (1R INFO 4 / side_effect INFO 재확인)
  - 위치: `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts:17-21`
  - 상세: `@ApiPropertyOptional({ format: 'uuid', nullable: true }) parentId?: string | null` →
    `@ApiProperty({ type: String, format: 'uuid', nullable: true }) parentId: string | null`. plan 의 e2e 뮤턴트(M1)
    실측대로 런타임 응답은 원래도 모든 라우트(생성 포함)에서 이 키를 항상 실었으므로 **동작 변경은 아니고 선언을
    실측에 맞춘 정정**이다. 다만 이 OpenAPI 스키마로 codegen 하는 외부 클라이언트가 있다면 재생성 시 타입이
    "옵셔널"에서 "필수(값은 null 가능)"로 바뀔 수 있다 — 순수하게 선언 쪽 변경이라 실제 breaking 위험은 낮다.
  - 제안: 조치 불요. `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에서 해당 행을 제거한 것도
    이 정정과 정합적이다(고아 참조 없음을 grep 으로 확인 가능).

- **[INFO]** `GET /folders` 가 페이지네이션 없이 배열을 그대로 반환한다 — 기존 설계, 이번 diff 무관 (1R INFO 2 재확인)
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` `findAll` (전체 파일 컨텍스트가 프롬프트에 실리지 않아
    `Read` 로 직접 대조함 — 시그니처는 diff hunk 컨텍스트 기준 66번째 줄 부근, `find()` 호출)
  - 상세: 이번 PR 의 e2e(B)도 이 배열 형태를 그대로 전제한다. `review/consistency/2026/09/27/10_39_26/*` 가 이미
    "비-페이징 고정 컬렉션" 으로 별도 추적 중이라 새 이슈가 아니다.
  - 제안: 조치 불요(이미 추적 중).

- **[INFO]** `FoldersService` 가 `FolderDto` 매핑 없이 엔티티를 그대로 반환한다(entity passthrough) — 기존 구조, 이번 diff 무관
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` 전체(`findAll`/`findById`/`create`/`update`)
  - 상세: `review/consistency/2026/09/27/10_39_26/convention_compliance.md` 가 `spec/conventions/swagger.md` §5-1 이
    경고하는 실패 패턴(감사 로그 유출 사고)과 같은 구조라고 INFO 로 별도 지적했다. 현재는 `relations`/`eager` 미사용으로
    즉시 유출은 없다. 이번 PR 의 e2e 계약 대조(`assertMatchesContract`)가 응답 키 집합을 `FolderDto` 와 대조하므로
    우발적 필드 추가는 잡히지만, 근본적으로는 "우연히 필드가 일치" 하는 상태다.
  - 제안: 조치 불요 — 이미 별도 tracker 가 추적 중, 이 PR 의 축이 아니다. `relations` 옵션이 추가되면 재검토 필요.

- **[INFO]** 인증/인가 — Folder API 의 RBAC 매트릭스 미등재는 spec 쓰기 항목으로 이미 처분됨
  - 위치: `spec/5-system/1-auth.md` §3.2 (이번 diff 밖)
  - 상세: `folders.controller.ts` `@Roles('editor')` 는 이번 diff 로 변경되지 않았다. `--impl-prep` consistency-check
    (`review/consistency/2026/09/27/10_39_26`) 가 이를 W1 로 잡았고, developer 는 spec 을 직접 고칠 수 없어
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기존 planner 항목에 (4)(5)로 보강해 두었다
    (plan 파일 6296번째 줄 부근). API 계약 관점에서 새 결함이 아니라 문서 갭이며 이미 올바른 채널로 넘겨졌다.
  - 제안: 조치 불요(developer 스코프 밖, planner 턴 대기 중).

## 이번 변경의 API 계약 관점 평가 (핵심 — 재확인)

- **PATCH 부분 본문 응답 결함 수정**: `folders.service.ts` `update()` 의 `Object.assign(folder, omitUndefined(data))` 는
  REST PATCH 의 부분 갱신 시맨틱(미전송 필드=유지, 명시적 `null`=반영)과 정확히 일치한다. 이전 코드는 DTO 인스턴스의
  `undefined` own-property 가 로드된 값을 덮어써 `sortOrder` 키 소실·`parentId` 거짓 null 을 응답에 실었던 실제
  버그였고, 이번 수정은 그것을 REST 계약에 맞게 고친 것이지 새로운 breaking change 가 아니다. `triggers.service.ts`
  의 같은 관용구도 동일 헬퍼(`omitUndefined`)로 교체됐을 뿐 동작은 바뀌지 않았다(순수 리팩터).
- **회귀 방지 계층**: 단위(`folders.service.spec.ts` 신규 2건 — undefined 로 덮지 않음 · 빈 본문), DTO 선언 캐너리
  (`folder-response.dto.spec.ts`), 래칫 정정(`swagger-dto-contract.spec.ts`), e2e 계약 대조(`folder-crud.e2e-spec.ts`
  A~E, 5개 라우트 전부)가 서로 다른 실패 축(값 필터링·선언 좁힘·응답 값)을 분담해 잡도록 설계돼 있다. 특히 E 는
  계약 대조만으론 못 잡는 "거짓 null" 을 별도 값 단언(`toStrictEqual`)으로 잡는다.
- **HTTP 상태 코드/URL**: POST 201, GET 200, PATCH 200, DELETE 204/이후 404 — 이번 diff 에서 변경 없음, 기존 관례와 일치.
- **버전 관리**: 이번 변경은 OpenAPI 스키마 선언을 실제 런타임 형태에 맞추는 정정이라 별도 API 버저닝이 필요한 breaking
  change 로 보지 않는다(실측된 동작 불변).

## 요약

이번 diff 의 핵심은 `PATCH /folders/:id` 가 부분 본문을 보낼 때 저장된 값을 `undefined` 로 덮어써 응답에서 필드가
사라지거나(`sortOrder`) 거짓 `null` 이 실리던(`parentId`) 실제 API 계약 결함을 고치고, `FolderDto.parentId` 의 OpenAPI
선언을 실측된 런타임 형태(항상 존재·nullable)에 맞춘 것이다. 1회차 리뷰(Warning 2)에서 지적된 "필터 관용구 중복" 은
`omitUndefined` 공용 헬퍼로 추출돼 트리거·폴더 두 호출부가 동일 로직을 공유하도록 정리됐고, 이 추출이 API 동작이나
방어 범위를 바꾸지 않았음을 확인했다. 나머지 발견사항(entity passthrough, 비페이징 `GET /folders`, RBAC 매트릭스 문서
미등재)은 전부 이번 PR 이 만든 문제가 아니며 이미 올바른 채널(별도 tracker 또는 planner 항목)로 넘겨져 있다. 병합을
막을 CRITICAL/WARNING 은 없다.

## 위험도

LOW
