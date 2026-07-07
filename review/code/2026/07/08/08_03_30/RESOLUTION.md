# RESOLUTION — 유저 가이드 IA 정합 PR (review/code/2026/07/08/08_03_30)

리뷰 결과: **LOW · Critical 0 · Warning 2 · Info 4**. WARNING 2건 모두 처리.

## WARNING #1 — `.en.mdx` sibling order 모순 → **FIXED**

**문제**: `06` order 재부여 시 canonical KO `.mdx` 만 갱신 → discord·telegram·makeshop·agent-memory 의 legacy `.en.mdx` 가 자체 frontmatter `order` 를 보유한 채 남아 KO/EN 모순 발생(discord.mdx=6 vs discord.en.mdx=8 등). registry 가 locale sibling 을 nav 스캔에서 제외하고 canonical KO frontmatter 로만 렌더하므로 runtime 영향은 없는 dead metadata 이나, `_i18n-conventions.md`(canonical KO 만 frontmatter) 위반이 더 벌어짐.

**조치**: 4개 `.en.mdx`(discord·telegram·makeshop·agent-memory)의 legacy frontmatter 블록을 **제거**. 같은 섹션의 knowledge-base·mcp-servers·web-chat-sdk `.en.mdx` 는 이미 규약대로 frontmatter 가 없어 이로써 섹션 내 전 sibling 이 일관화됨. title_en/summary_en 는 canonical KO frontmatter 가 제공하므로 렌더 무영향(build·docs 가드 통과 확인).

## WARNING #2 — order 유일성 회귀 가드 부재 → **FIXED**

**문제**: order 중복/결번은 런타임 에러 없이 사이드바 순서만 조용히 어긋나 코드 리뷰로만 검출됨. `registry.test.ts` 는 fixture 정렬만 검증할 뿐 실제 콘텐츠의 섹션별 order 유일성을 단언하는 가드가 없었음.

**조치**: `registry.test.ts` 에 실제 `content/docs` 를 `loadDocsIndex` 로 스캔해 **섹션별 order 유일성**을 `it.each` 로 단언하는 테스트 추가(8섹션 전수). 전 섹션 order 유일 확인(2473 통과). 향후 페이지 추가·재편 시 동일 IA 드리프트 재발을 빌드 단계에서 차단.

## INFO (조치 불필요)
- order 재부여 값(1~12)이 `13-user-guide §2` IA 트리·`SECTION_LABELS` 와 정확히 일치(spec fidelity 통과).
- NAV-UG-02 8섹션 열거가 `SECTION_LABELS`·디렉터리 구조와 일치.
- CHANGELOG 갱신 불요(메타데이터/spec 텍스트 정정, 사용자 행동 무영향).

## 검증
- `pnpm --filter frontend exec vitest run src/lib/docs/__tests__` — 17스위트 **2473테스트 통과**(신규 order-유일성 가드 8케이스 포함).
- `pnpm --filter frontend build` — Compiled successfully, 정적 123p.
- `pnpm --filter frontend lint` — 0 error.

## 잔여
없음.
