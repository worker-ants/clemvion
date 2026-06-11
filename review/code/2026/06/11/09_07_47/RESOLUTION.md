# RESOLUTION — 09_07_47 (PR-B)

/ ai-review LOW, Critical 0, WARNING 4 + INFO. 모두 명칭 잔존·삭제 URL redirect·문서 오기술.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| W1 | Documentation | faq.mdx/.en Q16 헤딩 `LLM Config` → `모델 설정`/`Model settings` | user-guide-writer |
| W2 | Requirement | ai.mdx/.en `llmConfigId` 설명 `LLM 설정`/`LLM config` → `모델 설정`/`Model settings` (필드명 유지) | user-guide-writer |
| W3 | Requirement | ui-tour.mdx/.en 온보딩 사이드바 메뉴명 `LLM Config` → `모델 설정`/`Models` (다이어그램 + FieldTable) | user-guide-writer |
| W4 | Testing/Docs | 삭제된 구 문서 URL(`llm-config`·`rerank-config`) → `models` redirect: `route.ts` `resolveLegacyDocSlug()` + `[...slug]/page.tsx` redirect + route.test.ts. 외부 북마크 404 방지 | 코드 |
| INFO1 | SPEC-DRIFT(문서오기) | models.mdx/.en Chat/Embedding "직접 입력/type directly" 제거 — 실제 UI 는 select-only(R-1). load→select 로 정정. (Rerank 탭의 자유 입력은 model-list API 부재로 정상 — 유지) | user-guide-writer |
| INFO2 | Requirement | knowledge-base.mdx/.en `Grading LLM` type `LLM Config 선택` → `Chat 모델 설정 선택`/`Chat model config selector` | user-guide-writer |
| INFO3 | Documentation | `_glossary.md` 용어 `LLM Config / LLM 설정` → `Model settings / 모델 설정` (통합 정의) | user-guide-writer |

INFO4-11(삭제 URL spec redirect 계획·6-config code: 레거시 경로·models.en frontmatter 관행·links.ts 소비처0·테스트 인프라 충분 등)은 조치 불요 또는 PR4 정리 항목으로 판단.

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 stages; route.test resolveLegacyDocSlug 추가. schedules-page 테스트는 parallel-load flake — 격리 시 10/10 통과, 본 PR 무관 schedules 영역, 재시도 PASS)
- build : 통과
- e2e   : 통과 (179/179)

## 보류·후속 항목

- 발견: `src/app/(main)/schedules/__tests__/schedules-page.test.tsx` 의 1개 RBAC 케이스가 full vitest 병렬 실행에서 간헐 실패(격리 실행은 항상 통과). 본 model-management 작업과 무관한 pre-existing 테스트 격리(state bleed) 이슈 — 별도 추적 권장.
