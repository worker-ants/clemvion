# Cross-Spec 일관성 검토 — `spec/5-system/2-api-convention.md` · `spec/5-system/3-error-handling.md` (아바타 업로드 공개 URL)

## 검토 범위 요약

target 델타(`origin/main` 대비):

- `spec/5-system/2-api-convention.md` §9 파일 업로드 — 최대 크기를 "엔드포인트별 상이"로 바꾸고 `POST /api/users/me/avatar` 를 신규 등재
- `spec/5-system/3-error-handling.md` §1.3 — `FILE_REQUIRED`(400)·`INVALID_FILE_TYPE`(400) 신규 등재

같은 세션에서 함께 바뀐 관련 영역(`spec/0-overview.md`·`spec/2-navigation/9-user-profile.md`·`spec/data-flow/0-overview.md`·`spec/data-flow/4-file-storage.md`)을 대조군으로 확인했다. 엔드포인트 경로(`POST /api/users/me/avatar`), 최대 크기(2MB), 허용 확장자(`png`/`jpg`/`jpeg`/`webp`/`gif`, SVG 제외), 에러 코드 3종(`FILE_REQUIRED`/`INVALID_FILE_TYPE`/`PAYLOAD_TOO_LARGE`), S3 키 패턴(`avatars/{userId}/{uuid}.{ext}`, workspaceId 미포함), 공개 버킷 정책(`ListBucket` 차단 + `avatars/` 접두 익명 `GetObject`) 은 5개 문서 전체에서 숫자·문자열까지 정확히 일치한다. 구현 diff(`s3.config.ts`/`s3.service.ts`/`users.controller.ts`/`users.service.ts`)도 위 값들과 어긋나지 않는다.

---

## 발견사항

- **[WARNING]** §9 파일 업로드 표의 "응답" 행이 신규 아바타 엔드포인트의 실제 응답 형태와 불일치
  - target 위치: `spec/5-system/2-api-convention.md` §9 (line 275-284, 특히 line 282)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §6.1 (line 354) · `spec/5-system/3-error-handling.md` §1.3 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 행이 참조하는 실제 계약
  - 상세: 같은 §9 표에서 "최대 크기"·"허용 타입" 두 행은 이번 PR 이 "KB 문서 / 아바타" 두 엔드포인트로 나눠 갱신했는데, 바로 아래 "응답" 행(`업로드된 파일 메타데이터 (id, status 등)`)은 갱신되지 않고 KB 문서 업로드(엔티티 `id`/`status`)만을 반영한 옛 서술 그대로 남았다. 그러나 실제 아바타 업로드 응답은 `users.controller.ts uploadAvatar`(diff) 가 반환하는 `{ data: { id, email, name, avatarUrl, locale, theme } }` — `PATCH /users/me` 와 동일한 **프로필 전체 봉투**이며, `user-profile.md §6.1` 도 "성공 시 200 + `PATCH /users/me` 와 동일한 프로필 봉투"라고 명시한다. "파일 메타데이터 (id, status 등)"는 KB 문서(엔티티 `id`+`embedding_status` 등)에는 맞지만 아바타 쪽엔 `status` 필드 자체가 없고 `id` 도 파일 id 가 아니라 user id 라 문면 그대로 읽으면 오도된다. 같은 표 안에서 두 행은 엔드포인트별로 분기됐는데 한 행만 분기되지 않아 표 내부에서 정합성이 깨진 상태다.
  - 제안: "응답" 행도 "엔드포인트별 상이 — KB 문서는 업로드된 문서 메타데이터(id, status 등), 아바타는 `PATCH /users/me` 와 동일한 프로필 봉투(§5.1)" 식으로 분기 서술을 추가한다. `spec/5-system/2-api-convention.md` 단독 수정으로 충분하며 다른 문서 변경은 불필요(이미 `user-profile.md`가 정확).

- **[INFO]** §9 "허용 타입" 행이 아바타를 예시에 포함하지 않음
  - target 위치: `spec/5-system/2-api-convention.md` §9 (line 281)
  - 충돌 대상: 없음(모순 아님) — 다만 line 280 "최대 크기" 행은 이번 PR 에서 "KB 문서 50MB, 아바타 2MB" 로 두 엔드포인트를 나란히 예시했지만, 바로 위 line 281 "허용 타입"은 "엔드포인트별 제한 (Knowledge Base 문서: PDF/Markdown/텍스트 등)"으로 KB 예시만 남아 있다.
  - 상세: 문구 자체가 "엔드포인트별 제한"이라 사실 관계 오류는 아니지만, 인접 행(최대 크기)만 아바타 예시를 얻고 이 행은 얻지 못해 표 내부 갱신 밀도가 고르지 않다. 독자가 "최대 크기는 분기했는데 허용 타입은 왜 KB 만 예시하나"로 오인할 여지가 있다.
  - 제안: 여유가 있으면 "(Knowledge Base 문서: PDF/Markdown/텍스트 등, 아바타: png/jpg/jpeg/webp/gif)" 로 대칭을 맞춘다. 급하지 않음.

---

## 요약

target 두 파일(`2-api-convention.md`/`3-error-handling.md`)의 이번 델타는 같은 세션에서 함께 갱신된 4개 관련 spec(`0-overview.md`·`data-flow/0-overview.md`·`data-flow/4-file-storage.md`·`2-navigation/9-user-profile.md`) 및 구현 diff(`s3.config.ts`/`s3.service.ts`/`users.controller.ts`/`users.service.ts`)와 엔드포인트 경로·크기 제한·허용 확장자·에러 코드·S3 키 패턴·공개 버킷 정책까지 값 단위로 정확히 정합한다 — RBAC(사용자 스코프, 워크스페이스 비종속이라는 근거를 Rationale 에 명시)·데이터 모델(`user.avatar_url` 컬럼 공유)·계층 책임(S3Service 공개 URL 조립 vs 버킷 정책은 인프라) 모두 일관됐다. 유일한 흠은 §9 표 내부에서 "최대 크기"/"허용 타입" 두 행은 아바타를 반영해 갱신했지만 "응답" 행만 KB 전용 옛 서술("파일 메타데이터 id/status")로 남아, 실제 계약(user-profile.md §6.1 이 명시하는 "프로필 봉투")과 어긋나는 WARNING 하나다. CRITICAL 은 없다.

## 위험도

LOW
