# RESOLUTION — 03_10_35

> ai-review (2nd round) + consistency --impl-done 일괄 처리.
> HEAD: 0b842414 (fix commit). e2e: 174/174 pass.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 (security/arch/maint) | 0b842414 | generate-golden-set.ts catch 블록 err.constructor.name 패턴 통일 (chunk catch + main catch) |
| W2 | 코드 (side-effect/security) | 0b842414 | generate-golden-set.ts --out CWD 경계 가드 추가 |
| W3 | 코드 (testing) | 0b842414 | cli-utils.spec.ts(6케이스) + generate-golden-set.spec.ts(15케이스) 신규. export 추가, main() require.main 가드 |
| W4 | 코드 (testing) | (defer) | EvalCliModule DI mock 스펙 — 라이브 부팅 스모크가 이미 검증. backlog |
| W5 | spec | 0b842414 | spec/conventions/rag-evaluation.md §2 positive 정의에 goldChunkIds>=1 조건 명시 |
| W6 | 코드 (arch) | (defer) | EVAL_CLI_ENTITIES 최소화 — 중장기 backlog |
| W7 | 코드 (database/security) | 0b842414 | ORDER BY ALLOWED_ORDERS const 맵으로 인터폴레이션 제거 |
| W8 | 코드 (docs) | (defer) | golden.example.json meta.description 표현 — 기능 무영향, 사소. backlog |
| I2 | 코드 (comment) | 0b842414 | stableEntryId SHA-1 "content-address identifier" 주석 추가 |
| I11 | 코드 (requirement) | 0b842414 | --ks 유효값 없으면 기본값 [1,3,5,10] 대체 + warn |
| I12 | spec (SPEC-DRIFT) | 0b842414 | spec/conventions/rag-evaluation.md §3 표에 --threshold 옵션 행 추가 (코드 유지+spec 갱신) |
| I13 | 코드 (testing) | 0b842414 | retrieval-metrics.spec.ts — firstRelevantRank null 경로 직접 테스트 |
| I14 | 코드 (testing) | 0b842414 | retrieval-metrics.spec.ts — precisionAtK(k<=0) 방어 분기 테스트 |
| consistency-W1 | plan | 0b842414 | rag-quality-improvement.md §P0 spec 갱신 체크박스 [x] 갱신 + rag-eval-harness 참조 |
| consistency-W2 | plan | 0b842414 | 동 plan line 88 CI yaml 자동 게이트 미착수 주석 추가 |
| consistency-I1 | spec | 0b842414 | rag-evaluation.md frontmatter code 배열에 cli-utils.ts 추가 |
| consistency-I3 | spec | 0b842414 | rag-evaluation.md §5 이모지(❌/✅) → 금지:/허용: 텍스트 교체 |
| consistency-I7 | plan | 0b842414 | rag-eval-harness.md §4 --sample CLI 위임 1줄 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (104 passed — retrieval-metrics 31, cli-utils 6, generate-golden-set 15, migrate-* 51, lang-detect 1)
- e2e   : 통과 (174/174) — log: _test_logs/e2e-20260606-033015.log

## 보류·후속 항목

- W4 (EvalCliModule DI mock spec): 라이브 부팅 스모크가 이미 의존성 파손을 검증함. 중장기 backlog.
- W6 / I7 (EVAL_CLI_ENTITIES 최소화): 중장기 리팩토링. 현재 ROOT_ENTITIES 전체 사용이 기능상 문제 없음.
- W8 (golden.example.json description 문구): 기능 무영향, 사소한 문서 개선. backlog.
- INFO I4/I5/I6 (perf micro 최적화): 현 규모(수십~수백 entry) 불필요. 대규모 전환 시 재검토.
- INFO I8 (GoldenSetMeta.version versioned union): 스키마 변경 시 별도 설계.
- INFO I9 (eval 모듈 독립화): 평가 대상 확장 시 검토.
- INFO I10/I19 (main 함수 분리·processChunk 추출): 기술부채 backlog.
- INFO I15 (golden.example.json zod 검증 자동화): 기능 무영향, 선택적 추가.
- INFO I16 (매직넘버 상수화): 사소. backlog.
- INFO I17 (parseQuestions 타입 단언 중복): 사소. backlog.
- INFO I18 (evaluateRetrieval 집계 루프 주석): 사소. backlog.
- INFO I20 (9-rag-search.md rag-evaluation.md 링크): 이미 Phase B에서 추가됨 — 별도 확인 불필요.
- INFO I21 (document_chunk 인덱스 확인): 운영 서비스 직접 영향 없음.
- INFO I22 (중복 entry.id Set 검사): 실용적 위험 낮음. backlog.
- consistency-I2 (Gate C spec_impact frontmatter): plan 완료 이동 시점에 처리.
- consistency-I4 (9-rag-search.md pending_plans 정리): plan 완료 이동 시점에 처리.
- consistency-I5 (macroAverage 분모 주석): 기존 구조상 오류 없음, 추가 주석은 선택.
- consistency-I6 (README --threshold rerank_mode 분기 설명): 선택적 문서 개선.
- consistency-I8 (rag-rerank-followup.md 비고): 선택적 1줄 추가.
