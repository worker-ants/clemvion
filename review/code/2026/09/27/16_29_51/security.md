# 보안(Security) 리뷰 — patch-body-followups (머지 후 재검토)

## 검토 범위

`git diff origin/main...HEAD` 49개 파일 중 실제 소스/테스트 변경은 12개
(`CHANGELOG.md`, `omit-undefined.ts`/`.spec.ts`, `UpdateWorkflowDto`/`UpdateNodeDto`/`UpdateAuthConfigDto`
의 DTO + 검증 spec, `auth-configs.service.spec.ts`, `nodes.service.spec.ts`, `patch-partial-body.e2e-spec.ts`)
이며, 나머지(13~49)는 plan 문서와 `review/code/2026/09/27/15_46_38`·`16_07_49`,
`review/consistency/2026/09/27/15_19_25` 세션의 산출물(이미 완료된 1R·2R 리뷰 기록)이다. 이번 세션은 그
1R/2R 결과와 별개로 현재 HEAD 코드를 직접 열어 독립적으로 재확인했다.

핵심 변경: `PATCH /workflows/:id` `description` · `PATCH /nodes/:id` `description` ·
`PATCH /auth-configs/:id` `ipWhitelist` 세 요청 필드를 `nullable`(OpenAPI) + `T | null`(TS)로 선언 —
런타임은 이전부터 `null` 을 받아 값을 지우고 있었고, 이번 diff 는 선언만 그 동작에 맞춘다. 서비스 로직
(`omitUndefined` 호출부, `verifyWebhookRequest` 등)은 변경되지 않았다.

## 검증한 사실 (직접 코드 확인)

- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:400` — `if (ac.ipWhitelist?.length)`.
  `ipWhitelist: null` 과 `ipWhitelist: []` 는 둘 다 falsy 라 IP 검사를 건너뛴다(제한 없음) — 동일 동작.
  이번 PR 이전에도 `[]` 전송만으로 같은 결과를 낼 수 있었으므로 새 우회 경로가 아니다.
- `codebase/backend/src/common/filters/http-exception.filter.ts` — 매핑되지 않은 내부 `Error`(예: NOT NULL
  컬럼에 `null` PATCH 시 발생하는 Postgres 23502 위반)는 `UNHANDLED_ERROR_MESSAGE`
  ("An unexpected error occurred. Please try again later.") 고정 문구로만 응답하고, 스택·원본 메시지는
  `logger.error` 로만 남긴다(CWE-209 대응 주석 확인). 즉 트래커에 등재된 "PATCH NOT NULL 필드 + null → 500"
  결함은 **정보 노출은 아니며**, 입력 검증 완결성(4xx 대신 5xx) 문제로만 분류된다.
- `git diff origin/main...HEAD -- CHANGELOG.md 'codebase/backend/src/**/*.ts' 'codebase/backend/test/**/*.ts'`
  를 `password|secret|api[_-]?key|token=|Bearer ...|BEGIN (RSA|PRIVATE)` 로 grep — 매치된 것은
  `type: 'api_key'`(enum 리터럴)와 `const token = ac.config.token as string`(e2e 테스트가 직전에 생성한
  auth-config 에서 런타임으로 읽어온 토큰) 뿐이다. 하드코딩된 시크릿·자격증명 없음.
- `update-auth-config.dto.ts` — `@IsOptional()` 뒤의 `@IsArray()`/`@IsString({each:true})`/
  `@IsIpOrCidr({each:true})` 는 `null` 이면 모두 스킵된다(class-validator 표준 동작). `null` 이 배열 형식
  검증을 우회하는 것은 맞지만 결과는 "화이트리스트 전체 삭제"이지 임의 문자열이 IP 로 오인되는 것이 아니므로
  인젝션·검증 우회로 이어지지 않는다.
- `patch-partial-body.e2e-spec.ts` 신규 케이스(E1~E3)는 `authed()` 헬퍼로 인증된 요청만 사용 — 인증 우회
  경로를 추가하지 않는다.

## 발견사항

- **[INFO]** `ipWhitelist: null` 은 IP 화이트리스트를 전면 해제한다(모든 IP 허용) — 새 취약점이 아니라 기존
  `[]` 전송과 동치인 동작의 재확인/재선언
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` (`ipWhitelist?: string[] | null` 필드 선언부), enforcement 는 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `verifyWebhookRequest` (`ac.ipWhitelist?.length` 가드, 이번 diff 밖)
  - 상세: 위 "검증한 사실" 참조. `PATCH /auth-configs/:id` 자체는 인증된 워크스페이스 멤버만 호출 가능하므로 인가 우회는 아니다.
  - 제안: 조치 불요(회귀 아님). auth-config 수정 권한의 RBAC 범위가 적절한지는 이 diff 밖의 별도 축.

- **[INFO]** `@IsOptional()` 이 `null` 도 "값 없음"으로 취급해 NOT NULL 컬럼에 `null` PATCH 시 500 이 나는
  결함 클래스는 이번 diff 의 세 필드(전부 nullable 컬럼)와 무관하며, 이미 `plan/in-progress/patch-body-followups.md` ·
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 근본 원인·처방과 함께 별도 트래커 항목으로
  등재·처분(BLOCK:NO)돼 있다. `GlobalExceptionFilter` 확인 결과 정보 노출로는 이어지지 않는다(위 "검증한 사실").
  - 제안: 조치 불요 — 이번 PR 범위 밖으로 정확히 분리됨.

- **[INFO]** 하드코딩된 시크릿·평문 자격증명 없음 (grep 결과, 위 "검증한 사실" 참조)

## 요약

이번 changeset 은 세 요청 DTO(`UpdateWorkflowDto.description`·`UpdateNodeDto.description`·
`UpdateAuthConfigDto.ipWhitelist`)의 OpenAPI/TS `nullable` 선언을 이미 존재하던 런타임 동작에 맞추는
순수 선언 정합화이며, 서비스 로직·인증/인가 로직·직렬화 경로는 변경되지 않았다. 1R(`15_46_38`)·2R(`16_07_49`)
두 차례의 독립 보안 리뷰 결과를 재확인하기 위해 `ac.ipWhitelist?.length` 가드와 `GlobalExceptionFilter` 의
에러 마스킹 로직을 직접 열어 대조했고, 두 주장(화이트리스트 해제는 기존 `[]` 동작의 재확인일 뿐 / NOT NULL
500 결함은 정보 노출로 이어지지 않음) 모두 코드로 확인됐다. 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은
암호화·민감정보 에러 노출 등 새로 도입된 취약점은 없다. 트래커에 남은 두 항목(IP 화이트리스트 RBAC 확인,
NOT NULL 필드 500)은 이번 PR 범위 밖으로 정확히 분리돼 있어 병합을 막을 사유가 아니다.

## 위험도

NONE
