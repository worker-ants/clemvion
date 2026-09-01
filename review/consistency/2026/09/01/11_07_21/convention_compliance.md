# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-avatar-storage-key.md`

## 검토 범위·방법

target 은 `spec/0-overview.md` §2.7·Rationale, `spec/data-flow/4-file-storage.md`,
`spec/2-navigation/9-user-profile.md`, `spec/5-system/3-error-handling.md` 4개 spec 문서에 대한
변경안(diff/표/문장 단위)을 담은 spec draft 다. 정식 규약 번들(`spec/conventions/**`)에서 이 변경과
직접 관련된 두 문서 — `swagger.md`(전문), `error-codes.md`(전문, 번들에 잘려 있어 저장소에서 직접
재확인) — 를 실측 대조했다. `audit-actions.md` 등 나머지는 도메인이 겹치지 않아 대조 대상에서
제외했고, cafe24/makeshop API 카탈로그류는 이 변경과 무관하다.

추가로 target 이 인용하는 코드 실측 5건(S3 키 생성 `avatarKeyPrefix`, `resolvePublicBaseUrl` 3단
폴백, `FILE_REQUIRED`/`INVALID_FILE_TYPE` 발행 지점·HTTP status, `s3.publicBaseUrl` ConfigService 키,
`scripts/minio/avatars-public-read.json` 존재)과 앵커 grep(`s3-객체-키-prefix-설계` 2곳)을
저장소에서 직접 재현해 정확함을 확인했다 — 이 부분은 정식 규약 위반 여부와는 별개로, 규약 대조의
전제(target 서술이 코드와 어긋나지 않음)를 검증하기 위함이다.

## 발견사항

이 문서가 제안하는 변경 중 `spec/conventions/**` 를 **직접 위반**하는 항목은 찾지 못했다. 아래는
INFO 수준 제안 1건이다.

- **[INFO]** §F 변경 지점에 line-anchor 가 없어 다른 섹션과 정밀도가 다르다
  - target 위치: `### F. spec/5-system/3-error-handling.md §1 에러 카탈로그` (파일 내 "### F." 절)
  - 위반 규약: 직접 위반은 아님 — `spec/conventions/error-codes.md` §1(의미 기반 명명)·표 포맷
    자체는 target 이 정확히 따른다(아래 "정합 확인" 참조). 지적은 **target 자체의 내적 일관성**에
    관한 것이다.
  - 상세: A~E 절은 전부 수정 지점을 `:265`·`:276`·`:371`~`:373`·`:128`·`:136`·`:334` 등 구체적
    라인 번호로 앵커링한다. F 절만 "§1 에러 카탈로그"라고만 적고 어느 서브섹션(예: 기존
    `§1.3 유효성 검증 에러` 표에 행 추가 vs 새 서브섹션 신설)에 두 행을 넣을지, 몇 번째 줄
    부근인지 명시하지 않는다. 실측으로 대조해 보면 `§1.3` 표가 이미 `| 코드 | 설명 | HTTP |` 3열
    포맷이라 target 의 F 표와 열 구성이 정확히 일치하고, `FILE_REQUIRED`/`INVALID_FILE_TYPE` 는
    KB·Avatar 두 도메인 공용이라 `§1.8`/`§1.9` 류 "도메인 spec 참조 단일 SoT" 4열 포맷(코드·
    status·설명·도메인 SoT)보다 prefix-less 시스템 전역 공용 코드 성격의 `§1.3` 에 넣는 편이
    합리적이다 — 그런데 target 은 이 판단을 명시하지 않는다.
  - 제안: F 절 서두에 "`§1.3 유효성 검증 에러` 표 말미에 두 행 추가 (`:xxx` 부근)"처럼 삽입 지점을
    명시한다. 편집자가 §1 어딘가에 새 서브섹션을 만드는 것으로 오독할 여지를 없앤다.

## 정합 확인 (근거 — 위반 없음의 실측)

- **명명 규약**: `FILE_REQUIRED`/`INVALID_FILE_TYPE` 는 `UPPER_SNAKE_CASE`(`error-codes.md` §1)·
  의미 기반 명명(조건을 기술, 구현 세부 미포함)을 따른다. 코드 실측
  (`codebase/backend/src/modules/users/users.service.ts:91-116`)의 주석이 "메시지 문자열 파싱
  금지 → 코드로 분기"라는 `error-codes.md` §1 "클라이언트는 코드의 의미로 분기" 원칙을 그대로
  반영하고 있고, target 의 F 표 설명도 이를 그대로 옮겨 정합하다. 두 코드 모두 KB(`INVALID_FILE_TYPE`,
  `knowledge-base.service.ts:928`)·Avatar 공용이라 prefix-less "시스템 전역 공용 코드"
  범주(`VALIDATION_ERROR` 와 동류, §1 후단)에 해당하며 도메인 prefix 를 강제하는 원칙과 충돌하지
  않는다.
  `s3.publicBaseUrl` → `S3_PUBLIC_BASE_URL` ConfigService 키 명명도 기존 `s3.bucket`/`s3.endpoint`
  등(`spec/data-flow/4-file-storage.md` §2.3 실측)과 동일 패턴(camelCase 키 ↔ UPPER_SNAKE env)이다.
- **출력 포맷 규약**: D-2 가 서술하는 "성공 시 200 + `PATCH /users/me` 와 동일한 프로필 봉투"는
  `swagger.md` §2-5 (`TransformInterceptor` `{ data: ... }` 래핑, 이미 `data` 키가 있으면
  pass-through)와 충돌하지 않는다 — 코드 실측(`users.controller.ts:83` 주석 "`getMe`·`updateMe`·
  `uploadAvatar` 세 곳이 같은 모양을…")이 이를 뒷받침한다. F 표의 HTTP status(400/400)도 실제
  `BadRequestException` 발행(`users.service.ts:91,114`)과 일치한다.
- **문서 구조 규약**: 변경 대상 3개 spec 문서 모두 이미 `## Overview` → 본문(`## 1…`/`## 2…`) →
  `## Rationale` 구조이며, target 의 A~D 변경안은 이 구조를 유지한 채 표·문단만 갱신한다(새 섹션
  `§1.3 아바타 업로드` 신설도 기존 `§1.x` 넘버링 관례를 따름). `spec/0-overview.md` 는 `0-` prefix
  진입 문서 규칙에 그대로 있고, target 이 그 파일명·역할을 바꾸지 않는다.
- **API 문서 규약**: target 은 `spec/` 마크다운만 다루며 DTO/컨트롤러 데코레이터를 직접 포함하지
  않는다 — `swagger.md` 의 DTO/컨트롤러 패턴은 이 target 문서에 직접 적용될 표면이 없다(해당
  규약은 구현 단계에서 이미 반영된 것으로 실측되며 별건).
- **금지 항목**: `swagger.md`(레거시 빈 껍데기 스키마, double-wrap 등)·`error-codes.md`(rename 대신
  신설 원칙 위반, 예: 기존 코드를 이름만 바꾸는 시도)에 해당하는 패턴을 target 은 답습하지 않는다 —
  이번 변경은 신규 코드 신설(§2 rename 정책과 무관)과 spec Rationale 정정이다.
- **앵커 갱신(§E)**: 실측 grep 결과 target 의 서술과 정확히 일치 —
  `spec/0-overview.md:278`, `spec/data-flow/4-file-storage.md:128` 두 곳만 옛 앵커
  (`#s3-객체-키-prefix-설계--kb-원본-키에서-workspaceid-제외-27`)를 참조하며, 새 제목으로부터
  파생되는 앵커(`...kb-원본과-avatar-키에서-workspaceid-제외-27`)도 기존 slugify 패턴과 일치한다.

## 요약

target 이 제안하는 4개 spec 문서 변경안은 `spec/conventions/swagger.md`(응답 래핑)·
`spec/conventions/error-codes.md`(명명·안정성·prefix-less 공용 코드 범주) 두 정식 규약과 대조했을
때 CRITICAL/WARNING 급 위반이 없다. 에러 코드 신설(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)의 근거
서술은 오히려 `error-codes.md` §1 의 "의미 기반 명명·코드로 분기" 원칙을 정확히 인용하는 수준이고,
ConfigService 키·앵커 링크·표 포맷도 기존 문서의 실제 패턴과 실측 일치한다. 유일한 지적은 F 절이
다른 절(A~E)과 달리 삽입 지점(라인/서브섹션)을 명시하지 않는다는 내적 일관성 관련 INFO 1건이다.

## 위험도
NONE
