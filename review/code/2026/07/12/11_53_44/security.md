# 보안(Security) 코드 리뷰

## 리뷰 범위
- `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts` (신규 — `embed-config.dto.ts` 를 `git mv` 로 rename)
- `codebase/backend/src/modules/hooks/hooks.controller.ts` (import 경로 1줄만 변경)
- `plan/in-progress/embed-config-dto-rename.md` (작업 추적 문서, 신규)
- `spec/7-channel-web-chat/4-security.md` (frontmatter `code:` 경로 1줄 갱신)

본 변경은 순수 파일명 rename(`spec/conventions/swagger.md §5-1` `*-response.dto.ts` 컨벤션 준수 목적)이다. `EmbedConfigDto` 클래스 내용·필드(`allowlist: string[]`, `enforce: boolean`)·`hooks.controller.ts` 의 `getEmbedConfig`/`receiveWebhook` 로직은 diff 상 완전히 동일하며 import 경로 문자열만 바뀌었다. 신규 로직·신규 엔드포인트·신규 입력 처리 경로가 도입되지 않았다.

## 발견사항

- **[INFO]** 순수 rename — 신규 보안 표면 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:37`(import), `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts`(신규 파일 전체)
  - 상세: `EmbedConfigDto` 는 순수 데이터 DTO(문자열 배열 + boolean)로, SQL/커맨드/경로 실행에 관여하지 않아 인젝션 표면이 없다. `getEmbedConfig` 핸들러의 fail-open·enumeration 방지 로직(비존재 endpointPath·DB 오류·인증 webhook 모두 `{ allowlist: [], enforce: false }` 로 동일 응답), `@Public()` 무인증 노출은 spec(`7-channel-web-chat/4-security.md §3-①`)에 명시된 의도된 soft-control 설계이며 이번 diff 로 변경되지 않았다.
  - 제안: 조치 불요. 참고용 기록.

- **[INFO]** DTO 검증 데코레이터 부재는 기존 상태 유지(응답 전용 DTO)
  - 위치: `embed-config-response.dto.ts`
  - 상세: `class-validator` 데코레이터(`@IsString()` 등)가 없으나, 이 DTO 는 응답(response) 전용으로 서버가 생성해 반환하는 값이라 클라이언트 입력 검증 대상이 아니다(요청 DTO 가 아님). 위험 없음.
  - 제안: 조치 불요.

- **[INFO]** `plan/*.md` 문서 신규 추가는 코드 실행 경로 무관
  - 위치: `plan/in-progress/embed-config-dto-rename.md`
  - 상세: 작업 추적 문서로 시크릿·자격증명 등 민감정보 포함 없음(확인함).
  - 제안: 조치 불요.

## 요약
본 변경분은 `embed-config.dto.ts` → `embed-config-response.dto.ts` 로의 순수 파일명/import 경로 rename이며 런타임 로직·엔드포인트·데이터 흐름·인증/인가 경계에 어떤 수정도 없다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지 않은 암호화, 에러 메시지 정보 노출, 취약 의존성 등 8개 점검 관점 전 항목에서 이번 diff 로 인해 새로 도입되거나 악화된 보안 이슈는 없다. 기존 `getEmbedConfig` 핸들러의 fail-open/anti-enumeration 설계(비인증 공개 엔드포인트, 존재 여부 비노출)는 spec 문서와 일치하는 상태로 유지된다.

## 위험도
NONE
