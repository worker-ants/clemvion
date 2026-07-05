# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

해당 없음 — 매칭되는 매트릭스 trigger 없음.

### 검토 근거

변경 세트(커밋 `ea09f1d7f`):
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`
- `spec/4-nodes/4-integration/1-http-request.md`, `2-database-query.md`
- `spec/2-navigation/4-integration.md`
- `review/consistency/**` (리뷰 산출물, 매트릭스 무관)

**매트릭스 trigger 대조**:

1. **`new-node` / `node-schema-change`** (`codebase/backend/src/nodes/**` glob) — glob 자체는 매칭되나 change_type 의미가 다름. 이번 변경은 신규 노드도, 필드 추가·라벨 변경·타입 변경도 아니다. `HTTP_BLOCKED` 에러 코드는 기존 그대로이고, 오직 클라이언트 노출 `output.error.message` **문자열 내용**만 host/IP 포함 원본 → host/IP 미노출 일반화 문구로 교체했다. 노드 UI 필드(FieldTable)·placeholder·helper text 변화 없음 → 이 trigger 는 해당 없음.

2. **`new-error-code`** (`error-codes.ts` 의 `ErrorCode` enum 변경) — 확인 결과 `error-codes.ts` 자체는 이번 커밋에서 변경되지 않았다 (`git show HEAD -- codebase/backend/src/nodes/core/error-codes.ts` 결과 없음). `HTTP_BLOCKED` 는 기존 enum 값 재사용. 해당 없음.

3. **backend-labels.ts `ERROR_KO` 매핑** — `codebase/frontend/src/lib/i18n/backend-labels.ts:588-589` 확인 결과 `HTTP_BLOCKED` 는 이미 완전한 한국어 매핑이 존재:
   ```
   HTTP_BLOCKED: "보안 정책(SSRF 방지)에 의해 해당 주소로의 요청이 차단됐어요. ..."
   ```
   프론트엔드는 `error.code` → `ERROR_KO[code]` 로 지역화 문구를 렌더링하며 (spec §8.3 에도 "클라이언트 UI 는 `output.error.code` 로 지역화 문구를 렌더하므로 이 message 는 wire 안전 목적" 명시), backend 의 raw `error.message` 영문 문자열이 사용자에게 직접 노출되는 경로는 아니다. 따라서 이번 message 문구 변경(`SSRF_BLOCKED: hostname "..." ...` → `Request blocked by SSRF policy.`)이 CRITICAL 한 영문 노출 갭을 만들지 않는다 — 오히려 이전부터 있던 code 기반 ko 매핑이 그대로 유효하다.

4. **docs MDX (`02-nodes/integrations.mdx`/`.en.mdx`)** — HTTP Request 절(`## HTTP Request`, line 30-83 부근)을 확인했으나 애초에 SSRF/`HTTP_BLOCKED` 에러 케이스를 다루지 않고(4xx/5xx/네트워크 오류 예시만) 이번 변경 전후로 문서 서술의 정확성에 변화가 없다. 즉 "가이드 본문이 stale 해지는" 회귀가 아니라 애초에 이 세부는 유저 가이드 스코프 밖(보안 내부 동작)이다. 매트릭스의 어떤 항목도 "에러 메시지 문자열 내용 변경(코드/enum 자체는 불변)"을 대상으로 하지 않는다.

5. **spec 문서화** — 이미 같은 커밋 안에 `spec/4-nodes/4-integration/1-http-request.md` §6 에러표 + §8.3 Rationale 신설, `spec/2-navigation/4-integration.md` `HTTP_BLOCKED` 각주, `spec/4-nodes/4-integration/2-database-query.md` follow-up→완료 갱신이 모두 동반되어 있다. `spec-major-change` trigger(해당 시) 요구사항도 충족.

## 요약

매트릭스 19개 trigger 중 glob 매칭 후보는 `new-node`/`node-schema-change`(nodes/** glob) 였으나, 실제 변경은 신규 노드/필드 스키마 변경이 아닌 SSRF 차단 시 클라이언트 노출 에러 메시지 문자열의 보안 강화(정찰 면 축소)이며 `ErrorCode` enum·노드 UI 필드는 불변이다. `backend-labels.ts` 의 `ERROR_KO[HTTP_BLOCKED]` 매핑은 이미 존재하고 code 기반 렌더링이라 이번 message 변경으로 사용자에게 영문이 노출되는 CRITICAL 갭이 없다. spec 문서화(1-http-request §8.3, 2-navigation 각주, 2-database-query follow-up 갱신)도 동일 커밋에 이미 반영됨. 동반 갱신 누락 0건.

## 위험도

NONE
