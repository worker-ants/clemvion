# RAG 평가 하베스 (P0 Phase 0+1)

검색 품질 변경(리랭킹·하이브리드·청킹 등)의 **상대 회귀**를 측정하는 경량 하베스.
정식 규약(스키마·지표 정의·결정성·해석)은 [`spec/conventions/rag-evaluation.md`](../../../spec/conventions/rag-evaluation.md) 가 SoT.

> ⚠️ **절대값 신뢰 금지.** 자동 합성 골든셋은 silver(미검수)다. 점수는 변경 전후
> (off vs cross_encoder, PR 전후) **상대 비교** 로만 해석한다. 한국어 LLM-judge 신뢰도
> (Fleiss κ≈0.3) 때문에 본 1차 하베스는 LLM-judge 없이 **순수 검색 지표**만 쓴다.

## 구성

| 구성 | 위치 |
| --- | --- |
| 골든셋 스키마 | `src/modules/knowledge-base/eval/golden-set.types.ts` |
| 검색 지표(순수 TS) | `src/modules/knowledge-base/eval/retrieval-metrics.ts` (+ `.spec.ts`) |
| 자동 합성 generator | `src/scripts/generate-golden-set.ts` |
| 지표 러너 | `src/scripts/eval-retrieval.ts` |
| 스키마 예시 | `eval/golden.example.json` |
| 실 골든셋 | `eval/golden.json` (기본 git 미커밋 — 아래 참조) |

## 사전 조건

스크립트 실행 전 `codebase/backend/.env` 에 DB 접속 정보 및 LLM config 가 설정돼 있어야 한다.

```env
DATABASE_HOST=...
DATABASE_PORT=5432
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
DATABASE_NAME=...
```

LLM 호출이 필요한 `generate-golden-set.ts` 는 LLM provider config(예: `LLM_API_KEY`) 도 추가로 필요하다.

## 워크플로

### 1. 자동 합성 (①)

KB 청크에서 질문을 역방향 생성 → 생성 원천 청크가 gold 라벨이 된다(라벨 공짜).

```bash
cd codebase/backend
npx ts-node src/scripts/generate-golden-set.ts \
  --workspace-id <uuid> --kb-id <uuid> \
  --sample 100 --questions-per-chunk 1 --lang auto \
  --out eval/golden.json
# 먼저 --dry-run 으로 산출 미리보기 가능

# 또는 npm scripts 사용:
# npm run eval:golden:generate -- --workspace-id <uuid> --kb-id <uuid> --sample 100
```

산출 entry 는 `source:"synthetic"`, `reviewed:false` (silver). 재실행 시 기존
`reviewed:true` entry 는 보존(덮어쓰지 않음).

### 2. SME 스팟검수 (③ 최소)

전체의 20~30% 를 빠르게 훑어 명백히 틀린/모호한 entry 를 정리한다:

- 질문이 청크만으로 답 가능한가? (외부지식·multi-hop 필요하면 `difficulty` 수정 또는 삭제)
- gold 청크가 실제로 답을 담는가?
- 검수 통과분은 `reviewed: true` 로 바꾼다. 부정 케이스는 `shouldRetrieve:false`,
  `goldChunkIds:[]` 로 둔다(negatives 통계로만 집계).

> ③ 전용 UI 는 후속(Phase 2). 현재는 JSON 직접 편집.

### 3. 지표 실행 (게이트)

```bash
cd codebase/backend
npx ts-node src/scripts/eval-retrieval.ts --golden eval/golden.json --ks 1,3,5,10
# --threshold: 검색 결과 score 하한(기본 0.0). 이 값 미만 청크는 회수 결과에서 제외.
#   리랭킹 비교 시: 동일 --threshold 로 off/cross_encoder 각각 실행 후 delta 비교.
npx ts-node src/scripts/eval-retrieval.ts --golden eval/golden.json --ks 1,3,5,10 --threshold 0.3

# CI 게이트 예: hit-rate@5 가 0.6 미만이면 비정상 종료
npx ts-node src/scripts/eval-retrieval.ts --fail-metric hitRate --fail-k 5 --fail-under 0.6

# 또는 npm scripts 사용:
# npm run eval:retrieval -- --golden eval/golden.json --ks 1,3,5,10
# npm run eval:retrieval -- --fail-metric hitRate --fail-k 5 --fail-under 0.6
```

같은 골든셋으로 KB 의 `rerank_mode` 를 off ↔ cross_encoder 로 바꿔가며 두 번 돌려
**delta** 를 본다.

## 골든셋 커밋 정책

`eval/golden.json` 실데이터는 고객 문서 파편(질문·정답·식별자)을 포함할 수 있어
**기본 커밋 대상이 아니다**. 커밋 여부는 워크스페이스 소유자가 PII·기밀 검토 후 결정.
스키마 참조용으로는 `eval/golden.example.json` 만 커밋한다.

## 결정성

지표 함수는 순수·결정적(동점 score → `chunkId` 사전순 tie-break). generator 는
LLM 비결정적이므로 산출 golden.json 을 고정(커밋/보관)해 평가 입력을 안정화한다.
