# RESOLUTION — 18_06_44 (rag-followup ef_search PR, standalone)

> 전체 MEDIUM(C0/W6) — **MEDIUM 은 W1(scope) FP 가 견인**. 실제 코드(ef_search)는 security/architecture/database/concurrency 전부 NONE, 나머지는 LOW 방어 nit. 코드 변경 없이 disposition(루프 차단 — 코드는 #500 브랜치 ai-review 17_16_40 LOW·C0 + 본 review NONE 으로 이중 검수됨).

## 조치 항목

| # | 분류 | disposition | 근거 |
|---|------|-------------|------|
| W1 (scope: exec-park 혼입) | **FP** | 변경 안 함 | ai-review `--branch main` 이 **stale 로컬 main**(origin/main 의 #501/#502 exec-park 머지 미반영)을 base 로 diff → exec-park 파일을 본 브랜치 변경으로 오귀속. **merge-base 三-dot 반증**: `git diff origin/main...HEAD --name-only` = rag-search + 내가 만진 spec/plan 뿐, exec-park 0건. consistency `--impl-done`(origin/main 三-dot base)은 동일 변경에 BLOCK:NO·해당 혼입 미보고로 교차 확인. (memory: `reference_consistency_check_main_baseline_fp`) |
| I1 (security: SQL 보간 안전) | 확인 | — | security NONE: `hnswEfSearchFor` [40,1000] 정수 clamp + `Number.isFinite` 가드로 인젝션 차단, topK 는 서버 내부 상수. "추가 조치 불필요". |
| W2 (arch: SQL GUC 인라인) | 수용(minor) | 변경 안 함 | reviewer "단기 수용 가능". searchVectorGroup 단일 사용처 — repository 분리 시 GUC 동반 이전(중기). |
| W3 (side-effect: 보간 방어 심도) | 수용/advisory | — | 코드 안전(clamp+finite 가드, I1 확인). 반환 직전 `Number.isInteger` 어서션은 선택적 defense-depth → 후속 advisory. |
| W4 + I6 (음수/0 입력 계약·테스트) | advisory | — | 코드 안전(`clamp(max(40, ...))` → 음수/0 = 40). 명시 테스트는 계약 핀 목적 → 후속. |
| W5 + I7 (test mockEm 정규식 상수·toBeDefined) | advisory | — | 테스트 유지보수 nit. 동작 영향 0. |
| W6 + I5 (spec magic number·HNSW 상수 pin 테스트) | advisory | — | spec §3.4 가 40/1000 기재(코드 SoT 는 dynamic-cut.util 명명 상수). 핀 테스트는 회귀 감지용 → 후속. |
| I4 (SPEC-DRIFT §3.4) | 해소 | 본 PR | spec §3.4 "(follow-up)" → "구현됨" 동기화 완료. |
| I9 (root package-lock.json untracked) | 본 PR 무관 | — | 세션 시작 시점 gitStatus 에 이미 존재(`?? package-lock.json`). 본 브랜치 변경 아님. |
| I10 (carousel spec_impact 소급) | 수용 | 본 PR | PR #498 의 Gate C main breakage 부수 해소(별도 커밋 7d7d484d). 메타데이터 2줄. |
| I2/I3/I8/I11/I12 | 확인/수용 | — | 트랜잭션 오버헤드(correctness trade-off 성립), e2e DB→공개 API 개선, 인라인 주석 압축(선택), 동시성 NONE, graph seed<40 미적용(주석 명시됨). |

## TEST 결과
- lint  : 통과
- unit  : 통과 (40 passed; dynamic-cut.util/rag-search/rerank/kb-tool 69 포함). 부수: spec-plan-completion Gate C main breakage(PR #498) 해소 후 통과.
- build : 통과
- e2e   : 통과 (176/176)
- (마지막 코드 commit `2d506f6a` 직후 TEST WORKFLOW 전체 통과. 본 disposition 은 비코드 — review/plan 문서만.)

## 보류·후속 항목 (advisory, 비차단)
- 다음 PR: `hnswEfSearchFor` 음수/0 + HNSW 상수 pin 테스트, SET LOCAL 보간 `Number.isInteger` 어서션, test mockEm 정규식 상수화, spec §3.4 상수 SoT 한 줄.
- #1 D2 정량 임계 A/B: 실 골든셋(§7.B) 미확보 보류. P2 3-신호 하이브리드: 범용 설계부터(별도 논의).
