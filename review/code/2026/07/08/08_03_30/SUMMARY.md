# Code Review 통합 보고서

## 전체 위험도
**LOW** — `06-integrations-and-config` 7개 `.mdx` `order` frontmatter 재부여 + `_product-overview.md` NAV-UG-02 텍스트 보정(`1d4c57263`). 재부여 값이 spec IA 트리·`registry.ts` `SECTION_LABELS`와 1:1 일치(INFO 통과). CRITICAL 없음. WARNING 2건.

## Critical 발견사항
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 처리 |
|---|----------|----------|------|------|------|
| 1 | requirement/documentation | discord·telegram·makeshop·agent-memory 의 legacy `.en.mdx` sibling 이 자체 frontmatter `order` 를 보유 → KO `.mdx` 만 갱신해 KO/EN order 모순 발생(예: discord.mdx=6 vs discord.en.mdx=8). registry 가 locale sibling 을 nav 스캔에서 제외하고 canonical KO frontmatter 로만 렌더 → runtime 영향 없는 dead metadata 이나 `_i18n-conventions.md` 위반이 더 벌어짐 | `06-integrations-and-config/{discord,telegram,makeshop,agent-memory}.en.mdx` | legacy frontmatter 제거(규약대로 canonical KO 만 frontmatter 보유, 섹션 내 나머지 sibling 과 일관화) | **FIXED** — 4개 `.en.mdx` frontmatter 블록 제거 |
| 2 | documentation | order 중복/결번이 런타임 에러 없이 사이드바 순서만 조용히 어긋나는 종류 — `registry.test.ts` 에 섹션별 order 유일성 회귀 가드 부재 | `registry.ts`/`registry.test.ts` | 섹션별 order 유일성 단언 테스트 추가 | **FIXED** — `loadDocsIndex` 결과 기준 전 섹션 order 유일성 테스트 추가 |

## 참고 (INFO)
1. 재부여 order(1~12)가 `13-user-guide.md` §2 IA 트리 및 `registry.ts` `SECTION_LABELS` 와 정확히 일치 — spec fidelity 통과.
2. NAV-UG-02 신규 8섹션 열거가 `SECTION_LABELS`(8개)·디렉터리 구조와 순서·개수·표기 일치.
3. 커밋 전 order 중복 2건+결번 1건+역전이 실제 존재했음을 역추적 확인 — `loadDocsIndex` 가 dedupe 없이 stable sort 만 수행해 빌드 실패 없이 잠재.
4. CHANGELOG 갱신 불요(사용자 행동 영향 없는 메타데이터/spec 텍스트 정정).

## 에이전트별
| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| requirement | LOW | order 재부여 spec fidelity 통과, .en.mdx sibling order 미동기화(정정) |
| documentation | LOW | SoT 대조 통과, order 회귀 테스트 부재(추가)·i18n sibling frontmatter(제거) |

## 라우터 결정
routing_status=done. 실행: requirement, documentation (2명, router_safety 강제). 제외 12명(순수 문서/spec 변경).

## 결론
CRITICAL 0. WARNING 2 모두 본 PR 후속 fix 로 해소(§ RESOLUTION.md).
