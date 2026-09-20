# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 발견사항

없음.

target draft 는 스스로 "새 코드·새 규약 없음 — 넷 다 이미 도는 동작의 기록" 이라고 명시하며(비대상 섹션),
실측으로 그 주장을 검증한 결과도 일치한다. 아래는 draft 가 언급/추가하는 모든 식별자를 기존 코드베이스·spec
전체에서 대조한 결과다.

| 식별자 | 종류 | target 에서의 사용 | 기존 정의처 | 의미 일치 여부 |
| --- | --- | --- | --- | --- |
| `http-redirect.ts` | 파일 경로 (frontmatter `code:`) | `1-http-request.md` 증거 목록에 추가 | `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (실재, `followRedirectsSafely`/`outboundBlockReason` export 확인) | 신규 파일 아님 — 이미 있는 구현을 증거 목록에 뒤늦게 등재하는 것뿐 |
| `INTEGRATION_CALL_FAILED` | 에러 코드 | "SSRF 가드의 고장(판정 아닌 오류)" 트리거를 이 코드에 귀속 | `0-common.md §4.2` "기타 일반 예외(분류되지 않은 실패)" 로 이미 정의 · `2-navigation/4-integration.md §14.1` 벤더 표에도 등재 | 일치 — 가드 고장은 "분류되지 않은 실패" 의 부분집합이므로 새 코드를 만들지 않고 기존 정의 범위를 명문화하는 것 |
| `INTEGRATION_INCOMPLETE` | 에러 코드 | HTTP 연결 테스트 결과 코드로 §5.3/§14.1 에 추가 | `0-common.md §4.2`(노드 공통) · `1-http-request.md §4.1`(auth 해석 실패) · `2-navigation/4-integration.md` 여러 곳(연결 테스트 endpoint `pending_install` 가드, cafe24 `mall_id` 누락 등)에 이미 존재 | 일치 — `resolveHttpCredentials` 를 노드와 연결 테스트가 공유하므로 같은 코드가 같은 의미로 두 컨텍스트에 쓰인다(실측: `http-connection-tester.ts` 가 `resolved.code` 를 그대로 반환) |
| `INTEGRATION_AUTH_UNSUPPORTED` | 에러 코드 | `2-navigation/4-integration.md §14.1` 벤더 표에 신규 행 추가 | `1-http-request.md §4.1`(지원하지 않는 auth_type) · §5.8(D4 코드 목록)에 이미 정의. `4-integration.md §14.1` 표에만 누락돼 있었음 | 일치 — 이미 3곳에서 "지원하지 않는 auth_type" 으로 동일하게 정의된 코드를 벤더 표에 추가 등재하는 것. 다른 의미로 쓰이는 곳 0건(grep 전수 확인) |
| `CAFE24_INSUFFICIENT_SCOPE` | 에러 코드 | §5.9 문장에서 Cafe24 403 분류로 인용(비교 대상) | `2-navigation/4-integration.md` line 644 (§5.8, "403 처리… `CAFE24_INSUFFICIENT_SCOPE` 메시지만 전달") | 일치 — 신규 도입 아니고 기존 정의 인용 |
| `MAKESHOP_AUTH_FAILED` | 에러 코드 | §5.9 문장에서 MakeShop 403 분류로 인용(비교 대상) | `5-makeshop.md` line 181 · `2-navigation/4-integration.md §5.9` line 696 에 이미 정의 | 일치 — 신규 도입 아니고 기존 정의 인용 |
| `HTTP_BLOCKED` / `DB_HOST_BLOCKED` | 에러 코드 | ②의 대조군으로 언급("차단 코드는 판정에만") | 각각 `1-http-request.md §6`, `2-database-query.md §6.2` 에 기존 정의 | 일치 — 신규 코드 아님, 대조를 위한 인용 |

파일 경로 관점에서도 target 문서(`plan/in-progress/spec-draft-integration-error-facts.md`) 자체는 기존
`spec-draft-*` 명명 컨벤션(`spec-draft-nullable-notation-followups.md` · `spec-draft-eia-62-waiting-payload.md`
· `spec-draft-eia-notification-payload-contract.md`)을 그대로 따르고, 새 spec 파일을 만들지 않으며 기존 4개
spec 파일만 수정 대상으로 삼는다 — 파일 경로 충돌 없음.

요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·webhook/queue/SSE 이벤트명·ENV var/config key 관점에서는
target 이 새로 도입하는 항목이 전혀 없다(전수 스캔 결과 0건) — 넷 다 표·문장에 "누락된 트리거/코드를 채워 넣는"
수준의 사실 정정이며, 코드·이름 자체는 모두 기존 구현·기존 spec 문서에 이미 존재하는 것을 그대로 재사용한다.

## 요약

target draft 가 다루는 4건은 모두 **기존에 이미 정의·구현된 식별자를 문서 표/문장에 뒤늦게 반영**하는 사실
정정이며, 새 요구사항 ID·엔티티명·endpoint·이벤트명·ENV/설정키·파일 경로를 하나도 신설하지 않는다. `INTEGRATION_INCOMPLETE`
· `INTEGRATION_AUTH_UNSUPPORTED` · `INTEGRATION_CALL_FAILED` · `CAFE24_INSUFFICIENT_SCOPE` · `MAKESHOP_AUTH_FAILED`
· `HTTP_BLOCKED` · `DB_HOST_BLOCKED` 를 spec 전체(`0-common.md` · `1-http-request.md` · `2-database-query.md` ·
`5-makeshop.md` · `2-navigation/4-integration.md` · `spec/conventions/error-codes.md`)에서 전수 대조한 결과 각
코드는 어디서나 동일한 의미로만 쓰이고 있어 다른 의미로 이미 점유된 자리와 부딪히는 사례가 없다. `http-redirect.ts`
frontmatter 등재도 실재 파일·실재 export 를 확인했다. 신규 식별자 충돌 관점에서 이 draft 는 위험이 없다.

## 위험도

NONE
