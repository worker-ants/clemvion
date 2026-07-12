# convention_compliance-checker (journal 복구 — disk-write gap, wf_4545a6b0-b38 journal.jsonl 에서 복원)

### 발견사항

없음 — `spec/5-system/12-webhook.md` 를 `spec/conventions/**` 전체(특히 `error-codes.md`, `swagger.md`, `spec-impl-evidence.md`, `migrations.md`)와 대조한 결과 CRITICAL/WARNING 급 위반을 발견하지 못했다.

점검 내역:

- **frontmatter 스키마** (`spec-impl-evidence.md §2`) — `id: webhook`(basename 기반, `spec/5-system/*.md` 타 문서와 동일 패턴) · `status: implemented` · `code:` 8개 경로 모두 실존. §3 라이프사이클 규칙(`implemented` → `code:` ≥1 매치 의무) 충족.
- **문서 구조** — `## Overview (제품 정의)` → 번호 본문(1~10) → `## Rationale` 3-섹션 구성이 CLAUDE.md 의 권장 구조를 그대로 따름.
- **에러 코드 명명** (`error-codes.md §1`) — `INVALID_WEBHOOK_PAYLOAD`/`PUBLIC_WEBHOOK_RATE_LIMIT`/`PUBLIC_WEBHOOK_HOURLY_LIMIT`/`PUBLIC_WEBHOOK_BODY_TOO_LARGE`/`AUTH_FAILED` 모두 `UPPER_SNAKE_CASE`+도메인 prefix 규칙 준수, `error-handling.md §1.7`(webhook 전용 카탈로그, 도메인 override 명시)과 상호 링크·내용 정합.
- **API 규약 위임 체인** — `spec/5-system/2-api-convention.md §11`(Webhook 수신 엔드포인트)가 "SoT는 12-webhook.md" 로 명시 위임하고, §11.2 는 `GET /api/hooks/:endpointPath/embed-config` 를 "webhook 수신이 아닌 별도 엔드포인트"로 명시 배제 — 12-webhook.md Rationale("③의 POST 전용은 트리거 진입 엔드포인트에 한정… embed-config는 본 SoT 의 스코프 밖")과 완전히 대칭.
- **마이그레이션 파일명** (`migrations.md §1`) — 본문이 인용하는 `V066__trigger_config_strip_inline_auth.sql` 은 `V<번호>__snake_case` 규칙 준수.
- **URL/메서드 규약** (`2-api-convention.md §2.2/§3`) — `/api/hooks/:endpointPath` kebab 리소스명, POST 전용(WH-EP-03)이 상위 규약과 일치.

diff 관련: 이번 구현 변경(`hooks.controller.ts` — `EMBED_CONFIG_CACHE_CONTROL`/`EMBED_CONFIG_CACHE_MAX_MINUTES` 상수화로 Swagger 문서 문자열과 실제 헤더값 drift 방지)은 `GET .../embed-config` 엔드포인트 한정이며, 이 엔드포인트는 12-webhook.md Rationale 이 이미 명시적으로 스코프 밖(channel-web-chat `4-security.md` 소관)으로 선언한 대상이다. 값 자체도 무변경(300초=5분)이라 target 문서에 반영할 내용이 없다. 참고로 코드 레벨에서는 `dto/responses/embed-config-response.dto.ts`(swagger.md §5-1) · `ApiOkWrappedResponse`/`ApiAcceptedWrappedResponse`(§5-2) 를 정상 사용 중이라 이 축에서도 정합적이다.

### 요약
`spec/5-system/12-webhook.md` 는 frontmatter 스키마·문서 3-섹션 구조·에러 코드 명명·API 규약 위임 체인 등 점검한 모든 축에서 `spec/conventions/**` 및 그 SoT 체인(`error-handling.md`, `2-api-convention.md`)과 정합하며, 금번 diff(embed-config Cache-Control 상수화)는 본 문서가 명시적으로 배제한 스코프 밖 엔드포인트에 한정돼 target 문서에 영향이 없다.

### 위험도
NONE