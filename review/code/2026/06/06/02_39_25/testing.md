# Testing 리뷰

## 발견사항

### [INFO] `retrieval-metrics.spec.ts` — 핵심 순수 TS 지표 단위테스트 충실
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.spec.ts`
- 상세: `orderRetrieved`, `recallAtK`, `precisionAtK`, `hitRateAtK`, `mrrAtK`, `ndcgAtK`, `evaluateRetrieval`, `detectLanguage` 총 20개 케이스. 동점 tie-break, gold 빈 Set(NaN), k > 결과수, shouldRetrieve=false 분리, 언어별 macro 분리 등 주요 경계값 모두 커버됨.

### [INFO] `lang-detect.ts` — 단위테스트 내 간접 커버, 독립 spec 파일 없음
- 위치: `retrieval-metrics.spec.ts` 하단 `describe('detectLanguage')` 블록
- 상세: 한국어/영어/혼합/숫자 전용 4가지 케이스로 충분히 커버. 별도 `lang-detect.spec.ts` 가 없지만 같은 spec 파일 내 포함돼 있어 실용적으로 문제없음. INFO 수준.

### [WARNING] `lang-detect.ts` — 엣지 케이스 미커버: 빈 문자열, 일본어 혼입, 임계 경계값
- 위치: `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts:16`
- 상세: `detectLanguage('')` 는 total=0 경로를 타 `'en'` 을 반환하지만 테스트가 없다. 일본어(히라가나/가타카나)는 HANGUL_RE 에 매치 안 되고 LATIN_RE 에도 매치 안 돼 total=0 → `'en'` 을 반환하는데, 실제 KB 에 일본어 청크가 유입됐을 때 의도 여부가 불명확하다. `KO_RATIO_THRESHOLD=0.2` 의 정확한 경계값(hangul/(hangul+latin) === 0.2)도 미커버.
- 제안: 빈 문자열, 일본어 전용 텍스트, 임계 경계값(0.2 정확히) 케이스를 `detectLanguage` describe 블록에 추가.

### [WARNING] `evaluateRetrieval` — 포지티브 항목 0개(전부 shouldRetrieve=false) 케이스 미테스트
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts:macroAverage`
- 상세: `macroAverage([], ks)` 는 n=0 이면 각 지표를 0 으로 유지하고 `mrr: 0` 을 반환한다. `evaluateRetrieval` 에 `shouldRetrieve=true` 항목이 없는 골든셋을 넣는 테스트가 없다. 이 경우 `overall.count=0`, 모든 metric=0 이 맞는지 의도를 명시하는 테스트가 필요하다.
- 제안: `entries` 전부 `shouldRetrieve=false` 인 골든셋 케이스를 `evaluateRetrieval 집계` describe 블록에 추가.

### [WARNING] `eval-retrieval.ts` CLI — 테스트 전혀 없음, 순수 유틸 함수 미검증
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts`
- 상세: `parseCliFlag`, `fmt`, `printAggregate` 같은 유틸 함수가 export 없이 파일 내부에만 존재해 단위테스트가 불가능하다. `parseCliFlag` 는 `--flag=value` 와 `--flag value` 두 형식을 처리하는데, 값에 `=` 이 포함된 경우 `split('=', 2)` 로 첫 번째 `=` 이후만 취하는 동작이 의도적인지 테스트가 없다. CI 게이트 로직(process.exit 3/4)도 검증 안 됨.
- 제안: `parseCliFlag`, `fmt` 를 별도 util 모듈로 export 하거나, `eval-retrieval.spec.ts` 에 mock `process.argv` 로 `parseCliFlag` 동작을 검증하는 테스트 추가. CI 게이트 분기는 `jest.spyOn(process, 'exit')` 로 검증 가능.

### [WARNING] `generate-golden-set.ts` — binary diff, 테스트 여부 불명
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts`
- 상세: diff 가 `Binary files differ` 로만 표시돼 실제 코드를 확인할 수 없다. plan §2 에 따르면 id 안정 해시, dedup(기존 `reviewed:true` 보존), `--dry-run` 분기, LLM 호출 등을 포함한다. 이 중 해시 생성, dedup 머지 로직은 순수 함수로 분리해 테스트 가능하지만 현재 리뷰 범위에서 테스트가 확인되지 않는다.
- 제안: id 해시 생성 함수, 기존 golden.json 머지 시 `reviewed:true` 항목 보존 로직을 순수 함수로 분리해 단위테스트 작성. LLM 호출 경로는 `LlmService` mock 처리.

### [INFO] `EvalCliModule` — 자동화 통합 테스트 없음 (의도적 제외로 판단)
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- 상세: plan 에 "EvalCliModule 부팅 스모크 통과" 가 기록돼 있어 수동 검증은 됐으나, `Test.createTestingModule(EvalCliModule)` 으로 `RagSearchService` 가 resolve 됨을 확인하는 자동 스펙이 없다. CLI 스크립트가 `app.get(RagSearchService)` 에 실패하는 회귀를 자동으로 잡는 경로가 없다.
- 제안: `eval-cli.module.spec.ts` 를 만들어 TypeOrmModule, LlmModule 등을 mock 처리한 후 `RagSearchService` DI 가 성공하는 최소 스펙 추가.

### [INFO] `ROOT_ENTITIES` 분리 — 기존 app.module.spec.ts 회귀 가드 유지
- 위치: `codebase/backend/src/database/root-entities.ts`, `codebase/backend/src/app.module.ts`
- 상세: `ROOT_ENTITIES` 를 `root-entities.ts` 로 이동 후 `app.module.ts` 에서 re-export. plan 노트에 "app.module.spec 회귀 없음" 이 기록돼 기존 REQUIRED 목록 테스트가 통과 중이다. `root-entities.ts` 자체 테스트는 불필요하고 기존 `app.module.spec.ts` 가 동일 역할을 수행.

### [INFO] `eval/golden.example.json` — 스키마 픽스처 유효성 런타임 검증 없음
- 위치: `codebase/backend/eval/golden.example.json`
- 상세: 예시 파일이 `GoldenSet` 인터페이스를 실제로 만족하는지 자동 검증하는 테스트가 없다. 미래 스키마 변경 시 예시 파일이 조용히 구식이 될 수 있다.
- 제안: `retrieval-metrics.spec.ts` 또는 별도 스펙에 `golden.example.json` 을 `readFileSync` 해 meta, entries 배열, 필수 필드 존재를 assertion 하는 1~2개 테스트 추가.

---

## 요약

이번 변경의 핵심 신뢰 자산인 `retrieval-metrics.ts` 는 `retrieval-metrics.spec.ts` 에서 동점 tie-break, gold 빈 집합, k > 회수수, shouldRetrieve 분리, 언어별 macro 등 20개 케이스로 충실하게 커버돼 있고 순수 TS 지표 레이어 테스트는 우수하다. 그러나 CLI 스크립트(`eval-retrieval.ts`, `generate-golden-set.ts`)는 순수 함수 유틸이 포함됨에도 테스트가 전혀 없고, `parseCliFlag` 의 동작 검증과 CI 게이트 분기가 자동 검증 밖이다. 또한 `lang-detect.ts` 의 빈 문자열·일본어 처리 케이스, `evaluateRetrieval` 의 positive-zero 케이스, `golden.example.json` 픽스처 유효성 검증이 누락돼 미래 확장 시 취약한 구간이 존재한다.

## 위험도

MEDIUM
