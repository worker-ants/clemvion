# Convention Compliance Review

Target: `spec/5-system/14-external-interaction-api.md`
Mode: `--impl-done`, scope=`spec/5-system/14-external-interaction-api.md`, diff-base=`origin/main`

---

## 발견사항

### 1. **[INFO]** `§5.3` 구현 상태 주석 — `seq` 는 항상 `0` 이라고 명시하나 diff 는 `SSE_SEQ_PLACEHOLDER` 상수명 채택

- **target 위치**: spec §5.3 구현 상태 주석 (line ~409): `단 ... seq(항상 \`0\` placeholder)는 SSE replay...`
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명) — 직접 위반은 아니나 유사 원칙. 코드는 `SSE_SEQ_PLACEHOLDER`(상수명)으로 의미를 명확히 표현했는데 spec 본문은 여전히 마법 숫자 `0`으로 기술.
- **상세**: 구현 diff 에서 `const SSE_SEQ_PLACEHOLDER = 0`(상수)이 도입됐고 JSDoc 에 그 이유가 설명됐다. spec §5.3 의 `seq(항상 \`0\` placeholder)` 표현은 현재 기술 그대로지만 이것이 의미 있는 placeholder 임을 독자가 알 수 없다. 이미 구현 주석에 더 나은 설명이 있다. spec과 코드의 정보 비대칭이다.
- **제안**: spec §5.3 구현 상태 주석에서 `seq(항상 \`0\` placeholder)` → `seq(항상 \`0\` — REST 단발 응답에서는 in-memory SSE seq 에 접근 불가, `SSE_SEQ_PLACEHOLDER` 상수로 고정)` 수준으로 이유를 1문장 추가. INFO 수준이며 필수는 아님.

---

### 2. **[INFO]** `§10.1 Swagger / API 문서` — `@ApiBearerAuth('interaction-token')` 명세가 `swagger.md §2-1` 에 이미 등재

- **target 위치**: spec §10.1 (line ~822~831)
- **위반 규약**: `spec/conventions/swagger.md §2-1` — `main.ts` 에 `interaction-token` scheme 등록 + `@ApiBearerAuth('interaction-token')` 사용을 규약이 이미 명시한다.
- **상세**: spec §10.1 이 이 내용을 재설명하는 것은 중복이지 위반은 아니다. 그러나 `swagger.md §2-1` 을 SoT 로 가리키는 cross-link 가 spec §10.1 에 없어 spec 독자가 swagger 규약을 별도 확인해야 한다.
- **제안**: spec §10.1 첫 bullet 뒤에 `([Swagger 규약 §2-1](../conventions/swagger.md#2-1-상단에-apitags--apibearerauth) 에 이미 등재됨)` 참조 추가를 권장. INFO.

---

### 3. **[INFO]** `§5.1` 에러 표 — `TOKEN_INVALID` / `TOKEN_EXPIRED` 주석이 `error-codes.md §3 Historical-artifact` 레지스트리와 연관 부재

- **target 위치**: spec §5.1 에러 표 아래 "코드 네임스페이스 주석" (line ~347)
- **위반 규약**: `spec/conventions/error-codes.md §1` — `TOKEN_INVALID` / `TOKEN_EXPIRED` 는 워크스페이스 JWT 계층과 **같은 문자열**임이 주석에 명시됐지만, 이 충돌이 `error-codes.md §3 Historical-artifact` 에 등재되지 않았다.
- **상세**: spec 주석이 "진입점(`/api/external/*`)·토큰 family 로 레이어가 구분된다" 고 설명하지만, `error-codes.md` 규약은 이런 동명 코드가 레이어별로 다른 의미로 쓰일 때 §3 에 등재하도록 유도한다. `error-codes.md §3` 은 현재 이 사례를 언급하지 않는다.
- **제안**: 규약 갱신 관점: `spec/conventions/error-codes.md §3` 에 `TOKEN_INVALID` / `TOKEN_EXPIRED` 이 interaction 레이어와 workspace-JWT 레이어에서 같은 문자열로 쓰이며 레이어 구분이 SoT 임을 footnote 로 추가. INFO.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 정식 규약(`spec/conventions/`)의 주요 항목을 전반적으로 잘 준수하고 있다. frontmatter(`id`, `status: partial`, `pending_plans`, `code`) 는 `spec-impl-evidence.md §2` 스키마를 충족한다. 문서 구조(Overview / 본문 §3~§12 / Rationale §R1~§R16) 는 CLAUDE.md 권장 3섹션 체계를 따른다. §10.1 의 Swagger 데코레이터 명세(`@ApiBearerAuth('interaction-token')`)는 `swagger.md §2-1` 규약과 정합하고, §5.1 에러 코드(`STATE_MISMATCH`, `TOKEN_*` 등)는 `error-codes.md §1` 의미 기반 원칙을 따른다. 발견된 사항은 모두 INFO 수준으로, 정식 규약 직접 위반이나 다른 시스템 invariant 를 깨는 항목은 없다.

## 위험도

NONE
