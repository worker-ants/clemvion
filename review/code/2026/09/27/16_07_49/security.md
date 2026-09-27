# 보안(Security) 코드 리뷰

## 검토 범위

이번 changeset(36개 파일 — 실제 소스/테스트 변경은 12개, 나머지는 plan 문서·이전 리뷰 라운드(`review/code/2026/09/27/15_46_38`, `review/consistency/2026/09/27/15_19_25`)의 산출물)은 `UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist` 세 요청 필드를 `nullable`(`T | null`)로 선언하고, 런타임이 이미 지원하던 "null 을 보내면 값을 지운다" 동작에 OpenAPI 선언·테스트를 맞추는 작업이다. 서비스 로직(`omitUndefined` 호출부, `verifyWebhookRequest` 등)은 변경되지 않았고 JSDoc·테스트만 추가됐다.

## 발견사항

이번 diff 자체에서 새로 도입된 취약점은 없다. 아래는 참고용 INFO 항목이다 — 전부 회귀가 아니거나 이미 별도 트래커에 등재되어 이 PR 범위 밖으로 처분된 기존 사항이다.

- **[INFO]** `ipWhitelist: null` 전송 시 IP 화이트리스트가 전면 해제된다
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:62` (선언), `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:400` (enforcement — `ac.ipWhitelist?.length` 가드, 이번 diff 에 포함되지 않음)
  - 상세: `verifyWebhookRequest` 가 `ac.ipWhitelist?.length` 로 판정하므로 `null` 과 `[]` 모두 "제한 없음"으로 취급된다. 다만 이 동작은 이번 PR 이전부터 `[]` 전송만으로 이미 달성 가능했던 것과 동일하다 — `null` 지원은 새 우회 경로가 아니라 기존 경로의 재확인·재선언이다. `PATCH /auth-configs/:id` 는 인증된 워크스페이스 멤버만 호출 가능하므로 인가 우회는 아니다.
  - 제안: 조치 불요(회귀 아님). 다만 auth-config 수정 권한(RBAC 범위)이 조직 내 적절한 역할로 제한되는지는 이 diff 밖의 별도 축으로 한 번 확인할 가치가 있다.

- **[INFO]** `@IsOptional()` 이 `null` 도 "값 없음"으로 간주해 NOT NULL 컬럼(`Workflow.name/tags/isActive`, `Node.config`, `AuthConfig.name/isActive`, `Folder.name` 등)에 `null` PATCH 시 Postgres 23502 위반 → 전역 예외 필터가 500 `INTERNAL_ERROR` 로 응답 (클라이언트 입력이 500 을 유발 — 계약상 400 이 정상)
  - 위치: `plan/in-progress/patch-body-followups.md` (실측 표), `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 백로그 항목)로 이미 등재됨. 이번 PR 이 다루는 3개 필드는 전부 nullable 컬럼이라 이 결함과 무관.
  - 상세: `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)를 직접 확인한 결과, 매핑되지 않은 내부 `Error` 는 스택·원본 메시지를 클라이언트에 노출하지 않고 `UNHANDLED_ERROR_MESSAGE` 고정 문구만 반환한다(CWE-209 대응 주석·코드 확인). 따라서 이 500 경로가 정보 노출로 이어지지는 않는다 — 남은 문제는 정보 노출이 아니라 "클라이언트 입력이 5xx 를 유발"하는 입력 검증 갭(가용성/계약 문제)이다.
  - 제안: 조치 불요(이번 PR 범위 아님) — 이미 근본 원인과 처방(입구 DTO 검증, `plan/in-progress/keyset-cursor-uuid-validation.md` §A 의 기각 근거 인용)까지 별도 트래커 항목으로 정확히 등재되어 있다(`--impl-prep` W1/W2/W4, BLOCK:NO). 이번 PR 로 끌어올 필요 없음.

- **[INFO]** 하드코딩 시크릿 없음 — 확인됨
  - 위치: 변경분 전체(diff 파일 12개 실코드/테스트)에 `password`/`secret`/`api_key`/토큰 리터럴을 grep. `type: 'api_key'`(테스트 fixture 의 enum 값)와 `*SecretV2`/`*TokenV2`(서술용 컬럼명 언급) 외 실제 값은 없음. `AuthConfigsService.regenerate`(`randomBytes` 기반 토큰 생성)도 이 diff 에 포함되지 않은 기존 코드.

## 요약

이번 changeset 은 로직 변경 없이 DTO 타입 선언(`nullable`)과 그에 대응하는 검증기·swagger 계약·e2e 테스트를 기존 런타임 동작에 맞춘 것으로, 새로운 인젝션·인증/인가 우회·하드코딩 시크릿·안전하지 않은 암호화·에러 메시지 정보 노출은 발견되지 않았다. `ipWhitelist: null` 이 화이트리스트를 해제하는 것과 NOT NULL 필드에 `null` 을 보내면 500 이 나는 것 둘 다 실측·확인했으나, 전자는 기존에도 `[]` 로 가능했던 동작의 재확인이고 후자는 전역 예외 필터가 내부 메시지를 마스킹하므로 정보 노출로 이어지지 않으며 이미 별도 트래커 항목으로 정확히 등재되어 이번 PR 범위 밖으로 처분되어 있다. 두 항목 모두 병합을 막을 사유가 아니다.

## 위험도
NONE
