# Cross-Spec 일관성 검토 — `spec/4-nodes/4-integration/` (--impl-done)

검토 모드: `--impl-done` (scope=`spec/4-nodes/4-integration/`, diff-base=`origin/main`). spec 델타는 0개 파일(이 브랜치는 코드
전용 — `spec_impact: none`, `plan/in-progress/ssrf-guard-integration-unify.md`). 구현 diff 14개 파일은 프롬프트 예산에 잘려
있어 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/smtp-ssrf-cgnat-8d41b2`)를 절대경로로 직접 읽어 확인했다:
`git diff origin/main...HEAD -- codebase/ CHANGELOG.md`, `http-safety.ts`/`.spec.ts`, `send-email/smtp-host-guard.ts`(신규,
`common/utils/smtp-host-guard.ts` 대체), `send-email.handler.ts`, `integrations.service.ts`, `integration-connection-test.e2e-spec.ts`,
`.env.example`, 두 언어 가이드 mdx, `error-codes.ts`, `spec/2-navigation/4-integration.md` §5.5·Rationale, `spec/5-system/7-llm-client.md`
§SSRF, `spec/conventions/egress-masking.md`.

## 변경 요약 (실측)

세 Integration 노드(HTTP Request / Database Query / Send Email)가 쓰던 SSRF 가드가 실제로는 둘이었다 — HTTP/DB 는
`http-safety.ts`, SMTP 는 `common/utils/ssrf.util.ts`(LLM 프로바이더·S3 와 공유). 각자 한쪽이 비어 있었다: `http-safety.ts` 는
IPv4-mapped IPv6(`::ffff:127.0.0.1` 등)를 판정하지 못해 HTTP/DB 가 루프백·메타데이터에 실제로 닿았고(macOS·`node:24-alpine`
실측 200), SMTP 가드는 CGNAT(`100.64.0.0/10`)와 `::` 를 통과시켰다. 이번 변경은 `smtp-host-guard.ts` 를
`nodes/integration/send-email/` 로 옮겨 `http-safety.ts` 의 `assertSafeOutboundHostResolved`(+ 신설 `SsrfBlockedError` ·
`canonicalIPv6` · `mappedIPv4`)를 재사용하도록 통합했다. `EMAIL_HOST_BLOCKED`/`HTTP_BLOCKED`/`DB_HOST_BLOCKED` 코드·메시지·
`ALLOW_PRIVATE_HOST_TARGETS` opt-out 시맨틱은 그대로다.

## 발견사항

없음 — CRITICAL·WARNING 없음.

target(`spec/4-nodes/4-integration/*.md`)의 SSRF 관련 서술(`0-common.md` §4.1·4.2, `1-http-request.md` §4 8번·§4 말미
`ALLOW_PRIVATE_HOST_TARGETS` 콜아웃, `2-database-query.md` §4·§6.2, `3-send-email.md` §4 7번·§8.0)은 이미 "세 노드가 동일
메커니즘·플래그를 공유한다" 고 적고 있었고, 이번 구현은 **그 문장을 사실로 만드는 방향**(코드를 spec 에 맞춤)이라 target
본문과 반대로 가는 지점이 없다. 대조 지점별 확인 결과:

- **`2-navigation/4-integration.md` §5.5 (Email SMTP)** — "HTTP Request 노드의 SSRF 가드와 동일한 메커니즘·플래그를 공유 …
  CGNAT·IPv6 사설 대역을 기본 차단" 으로 이미 서술돼 있고, 신규 e2e(`integration-connection-test.e2e-spec.ts` B2)가
  `100.64.0.1` → `EMAIL_HOST_BLOCKED` 로 이 서술을 그대로 고정한다. 같은 파일의 Rationale
  "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" 섹션도 코드명 채택 근거·chat-channel 분류표 무영향
  분석까지 구현과 일치.
- **`spec/5-system/7-llm-client.md` §SSRF (오케스트레이터가 명시 지정한 대조 대상)** — 이 PR 은 LLM 쪽(`ssrf.util.ts` 소비자:
  `model-config.service.ts`/`llm-preview.service.ts`/`s3.config.ts`)을 바꾸지 않았음을 코드로 확인(`grep isPrivateHost
  resolvesToPrivate` 결과 이 세 파일 + `ssrf.util.ts` 자신만 남음). LLM 목록(loopback/RFC1918/link-local/ULA/IPv4-mapped/
  `0.0.0.0/8`, **CGNAT 없음**, opt-out 플래그 없음)과 통합 노드 목록(추가로 CGNAT 포함)의 차이는 이번 PR 이 만든 것이 아니라
  기존 상태이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "LLM·S3 의 SSRF 가드가 CGNAT·`::` 를 막지
  않는다 — 막을지 정한다" 로 이미 planner 결정 대기 항목으로 등재되어 있다(이번 diff 에 새로 추가된 항목). `CHANGELOG.md` 도
  "LLM 프로바이더·S3 의 가드는 바뀌지 않았다 — CGNAT 를 막을지는 제품 판단이라 따로 정한다" 로 동일하게 스코프를 명시한다.
- **IPv4-mapped IPv6 판정 로직**(`canonicalIPv6`/`mappedIPv4`)은 target 산문에 문자 그대로("IPv4-mapped") 등장하지 않지만,
  이는 "loopback/RFC1918/…" 범주를 표기 우회 없이 강제하는 구현 세부이지 새 카테고리가 아니다 — 헤더 JSDoc 이 "IPv4-mapped
  IPv6 는 품은 IPv4 로 판정한다" 고 그 대응관계를 명시하고, `CHANGELOG.md` 도 "spec 문장은 이미 맞았고 코드가 어긋나 있었다" 로
  이를 버그 수정으로 프레이밍한다. 별도 spec 갱신 의무가 있는 신규 계약은 아니라고 판단했다(동일 결론이 `--impl-prep` 라운드
  `review/consistency/2026/09/19/21_02_09/cross_spec.md` 에도 있음).
- **에러 코드/포트 계약** — `EMAIL_HOST_BLOCKED` throw 지점(`send-email.handler.ts`)·메시지·§5.3 표는 변경 전과 동일, DB/HTTP
  쪽도 미변경. API 계약·상태 전이·RBAC 에 영향 없음.
- **계층 책임** — `smtp-host-guard.ts` 를 `common/utils/` 에서 `nodes/integration/send-email/` 로 옮기고
  `http-request/http-safety.ts` 를 import 하는 것은 문서화된 backend 계층 컨벤션(`spec/conventions/` 에 해당 규칙 없음, 있는
  것은 frontend 전용 `frontend-layering.md`)을 위반하지 않는다. `http-safety.ts` 가 `http-request/` 폴더에 남아 DB·Email 이
  형제 폴더를 참조하는 배치는 이미 `/ai-review` architecture 라운드(`review/code/2026/09/19/21_38_32`)에서 WARNING 으로 잡혀
  코드 JSDoc 에 사유가 적히고 트래커(`spec-draft-nullable-notation-followups.md`, "공용 SSRF 가드를 중립 위치로")에 등재됐다 —
  cross-spec 신규 발견이 아니라 이미 처분된 항목.

## 확인했으나 충돌 없음 (기존 drift, 이번 PR 무관 — 재확인만)

- `execution-engine.md §10.1` `IntegrationsService.logUsage` TS 시그니처가 INT-US-05 `api` 필드를 빠뜨린 stale 선언 — 이번
  diff 는 그 파일을 건드리지 않았고, `21_02_09` 라운드가 이미 WARNING 으로 잡아 트래커에 planner 항목으로 등재돼 있다.
- `chat-channel-adapter.md §3.1` 분류표가 `INTEGRATION_*`/`CAFE24_*`/`MAKESHOP_*`/`EMAIL_HOST_BLOCKED` 를 명시 커버하지 않음 —
  동일하게 미변경·기등재.

## 요약

이번 구현(SMTP SSRF 가드를 HTTP/DB 와 동일한 `http-safety.ts` 구현으로 통합 — CGNAT·`::`·IPv4-mapped IPv6 우회를 막음)은
`spec/4-nodes/4-integration/*.md` 가 이미 선언한 "세 노드 동일 메커니즘·플래그" 문장을 사실로 만드는 버그 수정이며, 코드를
직접 확인한 결과 error 코드·포트·opt-out 플래그·`2-navigation/4-integration.md §5.5` 서술과 전부 일치한다. 오케스트레이터가
명시 지정한 대조 대상인 `5-system/7-llm-client.md` 의 독립적 SSRF 목록(CGNAT 미포함)과의 차이는 이번 PR 이 만든 것이 아니라
사전에 존재했고 의도적으로 범위 밖(비대상)으로 문서화·트래커 등재돼 있다. 신규 CRITICAL/WARNING 은 없다. 기존에 알려진
`execution-engine.md`/`chat-channel-adapter.md` drift 두 건은 이번 diff 와 무관하며 이미 별도 트래커 항목으로 planner 턴을
기다리고 있다.

## 위험도

NONE
