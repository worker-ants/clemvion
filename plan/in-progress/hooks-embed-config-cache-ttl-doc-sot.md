---
worktree: llm-usage-doc-alignment-01d7a4
branch: claude/friendly-galileo-d82a11
started: 2026-07-12
owner: developer
spec_impact: none
---

# hooks embed-config Cache-Control TTL 문서 단일 진실화

## 배경

`codebase/backend/src/modules/hooks/hooks.controller.ts` 의 embed-config 엔드포인트에서
캐시 TTL `300` 이 실제 헤더(`EMBED_CONFIG_CACHE_SEC` 상수)와 **Swagger 문서 문자열 2곳**에
중복 하드코딩되어 있어, 상수 변경 시 문서가 침묵 드리프트한다 (ai-review INFO, 선존재).

- L40: `const EMBED_CONFIG_CACHE_SEC = 300;` (단일 진실 후보)
- L55: `@ApiOperation` description 에 리터럴 `max-age=300` + "최대 5분"
- L71: `@ApiResponse` 헤더 description 에 `${300}` + "최대 5분"
- L72: `@ApiResponse` 헤더 example `'public, max-age=300'`
- L82: 실제 헤더만 상수 사용 (드리프트 없음)

## 방침

behavior-preserving 순수 DRY 리팩터. 렌더 결과(문서 문자열·실제 헤더) byte-identical.
초 상수에서 파생 상수 2개를 만들어 4개 사용처가 모두 상수를 참조하게 한다.

- `EMBED_CONFIG_CACHE_CONTROL = \`public, max-age=${EMBED_CONFIG_CACHE_SEC}\`` — 헤더 값 SoT
- `EMBED_CONFIG_CACHE_MAX_MIN = Math.ceil(EMBED_CONFIG_CACHE_SEC / 60)` — 문서용 지연 상한(분)

## 체크리스트

- [ ] 편집: hooks.controller.ts 4개 사용처 상수 참조로 교체
- [ ] lint
- [ ] unit test
- [ ] build
- [ ] e2e (백엔드 변경 — 기본 요구)
- [ ] /ai-review + SUMMARY
- [ ] Critical/Warning fix (있으면)
- [ ] /consistency-check --impl-done (spec-linked: 12-webhook / 15-chat-channel / slack / discord / 14-eia / 2-api-convention)
- [ ] plan complete 이동

## 비고

`--impl-prep` 생략: 신규 요구사항·spec 해석 없는 behavior-preserving 문서 DRY 리팩터라
5-checker 가 판정할 대상이 없음. hook 강제 게이트(`--impl-done`)는 spec-linked 이므로 수행.
`auth.controller.ts:513` 의 `private, max-age=300` 은 별 엔드포인트(스코프 밖).
