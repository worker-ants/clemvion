# RESOLUTION — V-02 IE/TC auto-form 이행 ai-review (session 09_17_09)

ai-review risk LOW (Critical 0 + Warning 5 + INFO 8). 병행 `/consistency-check --impl-done`(09_17_21) = **BLOCK: YES** Critical 1 → spec 갱신으로 해소. 정당·본 변경 관련 항목은 처리, 나머지는 백로그.

## consistency Critical (BLOCK 해소)

| # | 판정 | 조치 |
|---|------|------|
| Critical #1 (Cross-Spec) | **수정 완료 (spec)** | spec `3-workflow-editor/1-node-common.md §2.6.3` "override 잔존" 목록이 auto-form 이행 완료된 `text_classifier`·`information_extractor` 를 포함해 구현과 모순. **조치**: 두 노드를 "auto-form 이행 완료" 목록으로 이동 + Rationale **R-3** 추가(이행 근거·지원 widget·V-02). consistency WARNING #1(R-2 SoT 동시 갱신)도 동시 해소. |

## ai-review 조치

| # | 카테고리 | 판정 | 근거·조치 |
|---|----------|------|-----------|
| Warning #1 | Testing | **수정 완료** | `NodeConfigRenderer`/override 트랙 회귀 테스트 부재 → `node-configs/__tests__/override-registry.test.ts` 신설: ai_agent·text_classifier·information_extractor 가 OVERRIDE_REGISTRY 미등록(auto-form), switch·table 은 등록 유지 단언. override 재등록 회귀를 잡는다(전체 SchemaForm 통합 대신 경량 단위). |
| Warning #4 | Documentation | **수정 완료** | CHANGELOG.md `## Unreleased` 에 IE/TC auto-form 전환 + 신규 노출 필드 + includeConfidence 기본값 교정 기재. |
| INFO #4 | Side Effect | **코드 무관 (spec 교정)** | `includeConfidence` 신규 노드 기본값: 구 bespoke 폼 `true` vs zod `false`. spec 2-text-classifier §1 L27 기본값 = **`false`** → zod 가 spec 정합이고 **bespoke 의 true 가 spec 위반이었다**. auto-form 이행이 교정. 회귀 아님 — 기존 저장값 무영향. CHANGELOG 명시. |
| Warning #2 | Testing | **백로그** | backend zod schema 의 ui 힌트(visibleWhen/field-array) JSON Schema 직렬화 스냅샷 테스트 — ai_agent 로 메커니즘 이미 입증, 스냅샷 강화는 별도 test-hardening 백로그. |
| Warning #3 | Documentation | **백로그 (별도 PR)** | `ai-configs.tsx` 삭제로 `nodeConfigs.ai.*` i18n 키 데드(사용처 0 확인). ai-review 도 "별도 PR" 권장 — i18n 정리는 scope 분리, KO/EN dict 동반 정리 백로그. |
| Warning #5 | Architecture | **백로그 (pre-existing)** | AI 노드 타입 문자열 리터럴 6개소 분산 — 본 PR 무관 pre-existing. `ai-node-types.ts` 중앙화 리팩터링 백로그. |
| INFO #1/#2/#3/#5/#6/#7/#8 | 다수 | **현행/수용** | 공격표면 축소(보안)·OCP·SRP 준수(아키텍처)·spec §1 전 필드 커버(요구사항)·scope 직결·중복 262줄 제거(유지보수)·삭제 테스트 손실 없음 등 긍정 평가. override-registry AI 절 주석은 마이그레이션 근거 기술 — 현행 유지. |

## TEST 결과

- frontend tsc : 통과 (0 error)
- frontend lint: 통과
- frontend unit: 통과 (override-registry 2 passed + auto-form 58 passed + IE/TC 관련 120 passed)
- backend     : 변경 0건 (schema 이미 완비)

## 후속·백로그

- W2 backend schema ui 힌트 스냅샷 테스트 / W3 `nodeConfigs.ai.*` i18n 데드 키 제거(KO/EN, 별도 PR) / W5 AI 노드 타입 상수 중앙화 — test-hardening·문서 위생 백로그.
