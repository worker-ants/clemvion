# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-avatar-storage-key.md`

## 검토 방법

전달된 프롬프트 번들에서 `spec/5-system/2-api-convention.md`·`spec/5-system/3-error-handling.md`·
`spec/data-flow/0-overview.md`·`spec/data-flow/4-file-storage.md` 4개 파일이 **컨텍스트 예산 초과로
절단**되어 있었다(각 `⚠️ 본문 생략됨` 마커). 이 4개는 하필 target draft 가 직접 수정하는 파일이므로,
번들 대신 저장소의 **실제 파일**(`spec/**`, `codebase/backend/src/**`, `codebase/backend/migrations/**`,
`scripts/minio/**`, `plan/in-progress/**`)을 직접 읽어 draft 의 모든 diff·인용 라인·코드 근거를
줄 단위로 대조했다.

## 발견사항

검토한 6개 대상 문서(`0-overview.md`, `data-flow/0-overview.md`, `data-flow/4-file-storage.md`,
`2-navigation/9-user-profile.md`, `5-system/2-api-convention.md`, `5-system/3-error-handling.md`)와
실제 구현·마이그레이션·버킷 정책 사이에서 **CRITICAL·WARNING 급 cross-spec 충돌은 발견되지 않았다**.
검증 세부는 아래 참고 항목 참조.

- **[INFO]** `PAYLOAD_TOO_LARGE` 카탈로그가 파일 업로드별 multer 레벨 413 을 포괄하지 않음
  - target 위치: `spec/5-system/3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE` 행(`:77`) — draft §F 가
    바로 이 절(§1.3)에 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 을 추가하는 지점
  - 충돌 대상: `spec/5-system/2-api-convention.md` §9(draft §G 가 갱신하는 절) — "최대 크기: 엔드포인트별
    상이(KB 50MB, Avatar 2MB)"로 바뀌는데, `3-error-handling.md` 의 `PAYLOAD_TOO_LARGE` 행은 여전히
    "요청 본문 크기가 body-parser 한도 초과 — 전역 100KB 기본"이라고만 적는다
  - 상세: 실제로 KB(`knowledge-base.controller.ts:336`, `FileInterceptor` `fileSize: 50MB`)와 이제
    Avatar(`users.controller.ts:157`, `AVATAR_MAX_BYTES = 2MB`) 모두 **multer 레벨** `fileSize` 한도이며,
    `PAYLOAD_TOO_LARGE` 카탈로그 서술이 말하는 "전역 100KB body-parser 한도"와는 **다른 메커니즘·다른
    임계값**이다. 이 gap 자체는 draft 이전부터 KB 엔드포인트에 존재했으므로 draft 가 만든 신규 모순은
    아니지만, draft 가 §9 표를 "엔드포인트별 상이(50MB/2MB)"로 명시적으로 갈라놓으면서 `PAYLOAD_TOO_LARGE`
    카탈로그와의 불일치가 더 뚜렷해진다(두 곳을 나란히 읽으면 "413 의 기준이 100KB 인지 2MB/50MB 인지"
    혼동 가능)
  - 제안: 필수는 아니나, §F 에서 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 을 추가하는 김에 `PAYLOAD_TOO_LARGE`
    행에 "파일 업로드 엔드포인트(`FileInterceptor`)는 body-parser 전역 한도와 별개로 endpoint 별
    `limits.fileSize` 를 적용한다(§9 표 참조)" 한 문장을 곁들이면 두 카탈로그가 완전히 정합한다. 이번
    draft 의 스코프를 벗어난다고 보면 별도 INFO 항목으로 후속 plan 에 남겨도 무방

## 검증한 항목 (충돌 없음 확인)

- **데이터 모델**: `user.avatar_url VARCHAR(500)` — `codebase/backend/migrations/V001__initial_schema.sql:16`
  과 draft C-3 의 서술이 일치. `spec/1-data-model.md:62` 의 범용 정의("프로필 이미지 URL")와도 모순 없음
  (draft 가 수정 대상에 포함하지 않은 것도 타당 — 이미 특정 스토리지를 전제하지 않는 서술)
- **API 계약**: `POST /api/users/me/avatar`(`users.controller.ts:149` `@Controller('users')` +
  `@Post('me/avatar')`), 2MB(`AVATAR_MAX_BYTES`), 확장자 `png/jpg/jpeg/webp/gif`(SVG 의도적 제외),
  응답 봉투 `{ data: toProfileData(updated) }` = `updateMe` 와 동형 — draft C-1·D-2·G 서술과 코드가
  정확히 일치
  - `spec/5-system/2-api-convention.md:284`(현재 "별도 업로드 엔드포인트 없음"으로 반증된 문장) —
    draft §G 가 정확히 이 문장을 정정 대상으로 지목, 실측 확인
- **요구사항 ID**: `spec/2-navigation/_product-overview.md`·`9-user-profile.md` 어디에도 아바타 관련
  `NAV-*` 요구사항 ID 가 없어 ID 재사용/충돌 위험 없음
- **상태 전이**: 아바타는 상태 머신을 갖는 엔티티가 아니므로 해당 없음
- **권한/RBAC**: `POST /users/me/avatar` 는 `payload.sub`(JWT) 기반 사용자 스코프 — 워크스페이스
  `@Roles()`/`RolesGuard` 대상이 아님. `PATCH /users/me` 와 동일 패턴이라 기존 RBAC 모델과 충돌 없음.
  `spec/2-navigation/9-user-profile.md` §4.2 역할 권한 매트릭스에도 아바타 행이 없어(아바타=사용자
  리소스, 워크스페이스 리소스 아님) 정합
- **계층 책임**: 순수 backend S3 키 구조 변경 — frontend/backend 책임 분할에 영향 없음
- **버킷 정책 실측**: `scripts/minio/avatars-public-read.json` = `avatars/*` 에 `s3:GetObject` 만 허용,
  `ListBucket` 문 부재 — draft A-3·D-3 의 "ListBucket 은 허용하지 않는다" 서술과 정확히 일치
- **`s3.publicBaseUrl` 설정**: `s3.config.ts`(`resolvePublicBaseUrl` 폴백 체인
  `S3_PUBLIC_BASE_URL → S3_ENDPOINT → localhost:9000`), `.env.example:163` — draft C-4 서술과 일치
- **삭제 순서**: `users.service.ts:142~149`(`userRepository.update` 먼저, 그 다음 `Promise.all` 로
  재조회+정리) — draft C-1 의 "DB 저장 뒤에 best-effort 정리" 서술과 일치
- **앵커 링크**: `grep -rn "s3-객체-키-prefix-설계" spec/` 재실행 결과 여전히 2곳
  (`0-overview.md:278`, `data-flow/4-file-storage.md:128`) — draft §A-3·§E·§C-5 가 둘 다 다룸, 누락 없음
- **라인 번호 실측**: draft 가 인용하는 모든 `:NNN` 라인 참조(`0-overview.md` `:265/:276/:278/:369/:371-373`,
  `data-flow/0-overview.md:273`, `data-flow/4-file-storage.md:19/55-59/65-71/73-78/80-87/128`,
  `9-user-profile.md:136/334`, `2-api-convention.md:280/284`, `error-handling.md` §1.3 위치)를 실제
  파일과 대조 — 전부 현재 파일 상태와 정확히 일치
- **frontmatter `pending_plans` 동기화**: draft §D-4 가 수정 대상으로 삼는 6개 문서 중
  `2-navigation/9-user-profile.md` 만 `pending_plans` 필드를 가지며(현재
  `spec-sync-user-profile-gaps.md` 만 등재, `spec-update-avatar-upload-implemented.md` 는 애초
  미등재) 나머지 5개 문서(`0-overview.md`·`data-flow/0-overview.md`·`data-flow/4-file-storage.md`·
  `5-system/2-api-convention.md`·`5-system/3-error-handling.md`)는 frontmatter 자체가 없거나
  `pending_plans` 키가 없음 — draft 가 "등재하지 않는다"고 결정한 것이 다섯 문서 모두에서 안전하게
  성립. 트래커 종결 시 dangling reference 도 발생하지 않음
- **관련 tracker 정합**: `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 체크리스트
  (4개 문서 대상: `9-user-profile.md`/`0-overview.md`/`data-flow/4-file-storage.md`/
  `error-handling.md`)와 draft 의 실제 6개 문서 범위(+`data-flow/0-overview.md`, +`2-api-convention.md`)
  대조 — draft §D-4 의 "실제 6개 문서로 정정" 주장이 정확
- **선행 BLOCK 리포트와의 정합**: `review/consistency/2026/09/01/01_51_41/SUMMARY.md` 의 Critical
  1건(§2.7 Rationale 배타적 서술)·WARNING 1·2·3(배지 stale·publicBaseUrl 미문서화·체크리스트 누락)·
  INFO 1·2(에러 코드 미등재·pending_plans 미등재)를 이번 draft 의 §A~§H 가 각각 어디서 해소하는지
  1:1 대조 — 전부 해소 경로가 존재. (WARNING 4·5·6 은 코드 레벨/naming 이슈로 이 draft 의 스코프
  밖 — developer 후속 턴 대상이며 draft 도 그렇게 서술)
- **avatar 언급 전체 문서 스윕**: `grep -rln "아바타\|avatar" spec/ --include="*.md"` 로 9개 문서를
  확인한 결과, draft 가 다루는 6개 외 3개(`1-data-model.md`·`2-navigation/_layout.md`·
  `2-navigation/10-auth-flow.md`·`data-flow/2-auth.md`)는 전부 스토리지 키 구조와 무관한 부수적
  언급(범용 필드 정의, ASCII 와이어프레임 라벨, OAuth 제공자 `avatarUrl` 대입)이라 draft 범위에서
  제외한 것이 타당

## 요약

target draft(`spec-draft-avatar-storage-key.md`)는 선행 `--impl-done` BLOCK(§2.7 Rationale 의
"workspaceId 제외 예외는 KB 하나뿐"이라는 배타적 서술과 실제 구현의 정면 충돌)을 spec 정정으로
해소하는 안이다. 번들에서 예산 초과로 생략된 4개 대상 파일을 포함해 실제 저장소 상태(spec 6개 문서·
backend 코드·마이그레이션·MinIO 버킷 정책·기존 tracker plan)를 직접 대조한 결과, draft 의 모든
인용·라인 번호·코드 근거가 실측과 정확히 일치했고 6개 대상 문서 사이·기존 spec 영역 사이에서
CRITICAL/WARNING 급 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지
않았다. draft 는 초판이 놓쳤던 Rationale 절 정정·앵커 링크 2곳·`2-api-convention.md`/
`data-flow/0-overview.md`의 배타적 산문까지 전수 포함하며, `pending_plans` 미등재 결정도 6개
문서 전체에서 안전하게 성립한다. 유일하게 남는 것은 이 draft 범위 밖(§9/§1.3 카탈로그 간의
pre-existing 413 임계값 서술 격차)의 경미한 INFO 1건이며, 이는 draft 를 막을 이유가 아니다.

## 위험도

NONE
