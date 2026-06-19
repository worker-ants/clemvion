# RESOLUTION — agent-memory model fields → select (ai-review)

SUMMARY: `review/code/2026/06/19/20_40_01/SUMMARY.md` (5 reviewer, 전체 LOW, Critical 0).
조치는 REVIEW WORKFLOW 단일 커밋(`refactor(nodes):` — 본 RESOLUTION 과 동봉)에 포함.

## 조치 항목

| SUMMARY 발견 | 심각도 | 조치 | 위치 |
| --- | --- | --- | --- |
| user-guide-sync: AI Agent 가이드에 embeddingModel 행 부재 | Warning | KO/EN FieldTable 에 embeddingModel 행 추가 | ai.mdx / ai.en.mdx AI Agent 섹션 |
| testing: describe 간 chatConfigs 누수 | Warning | EmbeddingModelSelectorWidget describe 에 reset beforeEach 추가 | model-selector-widgets.test.tsx |
| testing: stale llmConfigId fallback 미검증 | Warning | "stale → default fallback" 케이스 추가 | model-selector-widgets.test.tsx |
| testing: 빈 configs(로딩) 미검증 | Warning | "empty → provider='' " 케이스 추가 | model-selector-widgets.test.tsx |
| testing: 비문자열 value coerce 미검증 | Warning | "non-string → '' " 케이스 추가 | model-selector-widgets.test.tsx |
| testing: baseUrl passthrough 미검증 | Info | stub data-base-url 노출 + cfg-a baseUrl + 단언 | model-selector-widgets.test.tsx |
| maintainability: apiKey="" 규약 불명확 | Info | 인라인 주석 추가 | model-selector-widgets.tsx |

위젯 테스트 6 → 9 cases.

### NO-FIX (근거)
- side-effect: `config={value}` 매 keystroke 리렌더 — SchemaForm 은 controlled form 이라 값 변경 시
  **모든 위젯이 이미 리렌더**된다(config 가 신규 리렌더 도입 아님). combobox 는 React Query 캐시
  공유라 재요청 0. 실질 비용 무의미 → 코드 변경 없음.
- side-effect: backend UiHint.widget 의 multiselect 누락 — 본 PR 이전 부채, 무관.

### DEFER (follow-up — spec 약속 surface 아님)
requirement reviewer 의 방어적 UX Warning 3건(삭제된 llmConfigId silent fallback / chat 연결
embedding 빈 목록 / expression 저장값 노출) → plan/in-progress/agent-memory-model-select.md
§Follow-up 등록. 신규 i18n 문자열·디자인 필요.

## TEST 결과 (리뷰 fix 후 재수행, origin/main `1a6bbe73` rebase 기준)

- **lint**: 통과 (41s)
- **unit**: 통과 (42s) — 위젯 테스트 9 cases 포함
- **build**: 통과 (68s) — next build + docker 이미지 검증
- **e2e**: 통과 — 35 suites / 205 tests 전원 PASS. (jest 가 open-handle teardown 으로 클린
  종료 못 해 wrapper 가 매달리나 테스트 결과는 전원 PASS — 본 변경은 async 추가 없음, infra
  아티팩트. 러너는 테스트 완료 마커 확인 후 명시 정리.) 리뷰 fix 의 런타임 코드 변경은 주석
  전용(model-selector-widgets.tsx) — 나머지는 frontend 테스트·.mdx 문서.

## 보류·후속 항목
- 위 DEFER 3건(방어적 UX) — plan §Follow-up.
- backend UiHint.widget multiselect 동기화 — 별도 PR.
</content>
