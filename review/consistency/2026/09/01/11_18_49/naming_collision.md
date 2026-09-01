# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-avatar-storage-key.md`

## 검토 범위

target 은 순수 신규 기능이 아니라, 이미 구현·병합된 `POST /api/users/me/avatar` 기능을
`spec/0-overview.md` §2.7/Rationale·`spec/data-flow/4-file-storage.md`·
`spec/2-navigation/9-user-profile.md`·`spec/5-system/2-api-convention.md`·
`spec/5-system/3-error-handling.md`·`spec/data-flow/0-overview.md` 6개 문서에 **정합화**하는
spec 정정 draft 다. 따라서 "새 식별자" 대부분은 실제로는 **코드에 이미 존재하는 식별자를
spec 에 처음 등재**하는 성격이며, 그 식별자들이 spec 상 다른 의미로 이미 쓰이고 있는지를
전수 확인했다.

## 확인한 항목 (충돌 없음)

- **API endpoint** — `POST /api/users/me/avatar`: `spec/2-navigation/9-user-profile.md:334`
  단 한 곳에만 존재(취소선 상태). target 은 이 행의 상태를 뒤집을 뿐, 다른 의미의 동일
  endpoint 정의는 없다.
- **엔티티/필드명** — `avatarUrl`(`spec/2-navigation/9-user-profile.md:136,334`,
  `spec/5-system/2-api-convention.md:284`, `spec/data-flow/2-auth.md:145`),
  `avatar_url`(`spec/1-data-model.md:62`): 전부 동일한 의미(외부 URL 또는 업로드 URL 공유
  컬럼)로 일관. target C-3 의 "두 경로가 같은 컬럼을 공유" 서술과 정합.
- **에러 코드** — `FILE_REQUIRED`/`INVALID_FILE_TYPE`(target §F, `error-handling.md §1.3`
  신설 행 대상): 카탈로그(§1.2~§1.9) 전체에 동명 코드 없음. `INVALID_FILE_TYPE` 은
  `spec/data-flow/4-file-storage.md:52`(KB 문서)에서만 이미 쓰이고 있고, 코드
  (`knowledge-base.service.ts:928`, `users.service.ts:115`)도 실제로 두 도메인이 같은
  문자열을 공유한다 — target 의 "KB·아바타 공용" 서술과 일치, 충돌 아님.
- **섹션 번호** — `spec/data-flow/4-file-storage.md` 에는 아직 `§1.3` 이 없다(현재
  §1.1/§1.2 까지). target C-1 의 "§1.3 아바타 업로드 신설"이 기존 §1.3 과 겹치지 않는다.
  `spec/0-overview.md §2.7`, `9-user-profile.md §6.1` 도 각각 유일 섹션.
- **앵커/제목** — target B 가 바꾸는 Rationale 제목의 새 텍스트("...KB 원본과 Avatar
  키에서 workspaceId 제외...")와 target D-3 이 신설하는 소제목("서빙 전략 — 공개 버킷 +
  공개 URL")은 대상 3개 문서(`0-overview.md`, `data-flow/4-file-storage.md`,
  `9-user-profile.md`) 어디에도 기존 동일 텍스트가 없어 앵커 슬러그 충돌 없음.
- **파일 경로** — `scripts/minio/avatars-public-read.json` 은 `scripts/minio/` 안에서
  유일 정책 파일(README.md 와만 공존). plan 파일명
  `plan/in-progress/spec-draft-avatar-storage-key.md` 도 기존
  `spec-draft-eia-*.md` 관례를 따르며 다른 in-progress 파일과 겹치지 않는다.
- **함수명** — `resolvePublicBaseUrl`(`s3.config.ts:16`)은 코드베이스 전체에서 유일
  정의, target 은 이를 그대로 인용만 한다.

## 발견사항

- **[WARNING]** `s3.publicBaseUrl` / `S3_PUBLIC_BASE_URL` 이 기존에 경고된 미등록 키
  `app.publicBaseUrl`(bare `publicBaseUrl`)와 접미사가 동일해 혼동 소지
  - target 신규 식별자: `s3.publicBaseUrl`(ConfigService 키) / `S3_PUBLIC_BASE_URL`(env var)
    — target C-4 가 `spec/data-flow/4-file-storage.md §2.3` 표에 신규 행으로 등재하려는
    항목(코드는 이미 존재: `codebase/backend/src/common/config/s3.config.ts:57`).
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1382-1390,
    1507-1511` — 이 저장소는 webhook `callbackUrl` 조립 시 **`app.publicBaseUrl` 또는
    bare `publicBaseUrl` 을 절대 fallback 으로 쓰면 안 된다**는 회귀 테스트를 이미 갖고
    있다(과거 실제 버그: 미등록 키를 읽어 `http://localhost:3000` 으로 조용히 떨어지고
    Telegram `setWebhook` 이 HTTPS 요구로 거절됨). `app.config.ts` 는 `app.url` 만
    등록하며 `app.publicBaseUrl`/`publicBaseUrl` 는 **어디에도 등록되지 않은 키**다.
  - 상세: 네임스페이스(`s3.` vs `app.`/미등록)가 달라 `ConfigService.get()` 조회 자체는
    충돌하지 않는다(런타임 오동작 없음) — 그래서 CRITICAL 은 아니다. 그러나 (a) 이
    저장소는 "`publicBaseUrl`" 이라는 정확히 같은 단어로 이미 한 번 실제 인시던트를 겪었고
    회귀 테스트로 그 사실을 명문화해 뒀다는 점, (b) `spec/5-system/3-error-handling.md`
    등 이 저장소의 관례가 "근접 명명" 을 발견하면 반드시 `> **근접 명명 주의**: ...` 각주로
    구분해 두는 패턴을 여러 번 쓴다는 점(`PASSWORD_INVALID`/`INVALID_PASSWORD`/
    `PASSWORD_REQUIRED`/`REAUTH_REQUIRED` 사례)을 고려하면, 다음 사람이
    `grep -rn "publicBaseUrl"` 로 검색했을 때 "webhook 용 base URL(사용 금지 alias)"과
    "아바타 S3 공개 URL(정식 키)"이 뒤섞여 나와 어느 쪽이 어떤 용도인지 문서 없이는
    구분하기 어렵다.
  - 제안: target C-4 의 `s3.publicBaseUrl` 신설 행(또는 인접 note)에, `app.url`/
    (금지된) `app.publicBaseUrl` 과는 **별개의 키**이며 webhook base URL 조립에는 관여하지
    않는다는 한 줄 각주를 추가한다. 이미 존재하는 `triggers.service.spec.ts` 회귀 테스트를
    근거로 인용하면 이 저장소의 기존 "근접 명명 주의" 관례와도 정합된다.

## 요약

target 이 spec 에 새로 등재하는 식별자(엔드포인트 `POST /api/users/me/avatar`, 에러 코드
`FILE_REQUIRED`/`INVALID_FILE_TYPE`, config 키 `s3.publicBaseUrl`/`S3_PUBLIC_BASE_URL`,
섹션 `§1.3`/앵커 텍스트, 파일 `avatars-public-read.json`)은 대부분 **이미 구현된 코드를
spec 에 뒤늦게 반영**하는 것이라 spec 내 기존 사용처와의 직접 충돌은 없었다. 유일하게 주목할
점은 config 키 `s3.publicBaseUrl` 이 이 저장소가 회귀 테스트로 명시 경고해 둔 미등록 키
`app.publicBaseUrl`/`publicBaseUrl` 과 접미사가 같다는 것으로, 런타임 충돌은 아니지만 향후
검색 기반 혼동을 예방하려면 근접 명명 각주를 하나 추가하는 편이 이 저장소의 기존 관례와
맞는다.

## 위험도
LOW
