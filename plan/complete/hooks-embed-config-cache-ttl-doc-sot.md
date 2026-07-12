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
- L89: `getEmbedConfig` 본문 인라인 주석 `짧게(5분)` — 리터럴 `5분` 잔존 (ai-review WARNING, 5번째 사용처)

## 방침

behavior-preserving 순수 DRY 리팩터. 렌더 결과(문서 문자열·실제 헤더) byte-identical.
초 상수에서 파생 상수 2개를 만들어 사용처가 모두 상수를 참조하게 한다.

- `EMBED_CONFIG_CACHE_CONTROL = \`public, max-age=${EMBED_CONFIG_CACHE_SEC}\`` — 헤더 값 SoT
- `EMBED_CONFIG_CACHE_MAX_MINUTES = Math.ceil(EMBED_CONFIG_CACHE_SEC / 60)` — 문서용 지연 상한(분).
  (`_MIN` 은 코드베이스에서 minimum 의미 → `_MINUTES` 컨벤션 정렬, ai-review WARNING 반영)
- L89 주석은 리터럴 `5분` 대신 `EMBED_CONFIG_CACHE_SEC` 상수를 지목하도록 교체(드리프트 근절).
- 단위 테스트 헤더 단언을 `stringContaining('max-age')` → 정확값 `'public, max-age=300'` 으로 강화(SoT 회귀 가드, ai-review testing INFO).

## 체크리스트

- [x] 편집: hooks.controller.ts 4개 사용처 상수 참조로 교체 (+ L89 주석, 단위 테스트 강화)
- [x] lint
- [x] unit test
- [x] build
- [x] e2e (백엔드 변경 — 기본 요구, 253 passed)
- [x] /ai-review + SUMMARY (WARNING 2건: `_MIN` 네이밍·L89 주석 → fix. disk-write gap 3건 journal 복구)
- [x] Critical/Warning fix (resolution: `refactor(hooks): … WARNING 반영`, RESOLUTION.md)
- [x] /consistency-check --impl-done spec/5-system/12-webhook.md → BLOCK: NO (5/5 checker, disk-write gap 3건 journal 복구)
- [x] fresh /ai-review (review/code/2026/07/12/13_04_46) → RISK=NONE, WARNING=0, 선행 WARNING 2건 해소 확인 (clean → RESOLUTION 불요)
- [x] plan complete 이동

## 비고

`--impl-prep` 생략: 신규 요구사항·spec 해석 없는 behavior-preserving 문서 DRY 리팩터라
5-checker 가 판정할 대상이 없음. hook 강제 게이트(`--impl-done`)는 spec-linked 이므로 수행.
`auth.controller.ts:513` 의 `private, max-age=300` 은 별 엔드포인트(스코프 밖).
