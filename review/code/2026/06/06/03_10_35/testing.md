# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `retrieval-metrics.spec.ts` — 핵심 순수 TS 지표 레이어 테스트 충실
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.spec.ts`
- 상세: `orderRetrieved`, `recallAtK`, `precisionAtK`, `hitRateAtK`, `mrrAtK`, `ndcgAtK`, `evaluateRetrieval`, `detectLanguage` 총 26개 케이스(이전 리뷰 후 수정 포함). 동점 tie-break, gold 빈 Set(NaN), k > 결과수, shouldRetrieve=false 분리, 언어별 macro 분리, positive-zero, NaN guard 오염 방지, 빈 문자열 / 일본어 / KO_RATIO 경계 등 경계값 커버 우수. 순수 함수 레이어 테스트는 합격 수준.
- 제안: 없음.

---

### [WARNING] `cli-utils.ts` (`parseCliFlag`) — 독립 spec 파일 없음, 커버리지 전무
- 위치: `/codebase/backend/src/scripts/cli-utils.ts`
- 상세: `parseCliFlag`는 `eval-retrieval.ts`와 `generate-golden-set.ts` 모두에서 호출되는 공유 유틸로 별도 파일(`cli-utils.ts`)로 추출되었다. 그러나 해당 함수에 대한 단위테스트가 전혀 없다. 특히 다음 동작이 미검증이다.
  1. `--flag=val=with=equals` — `split('=', 2)` 첫 `=` 이후 전체를 값으로 취하는지
  2. 마지막 인자가 플래그인 경우(`--flag`가 argv 마지막): `flagIdx < process.argv.length - 1` 조건에 의해 `undefined` 반환하는 경계
  3. 동일 플래그가 두 번 등장했을 때 `=` 형식이 우선됨을 보장하는지
  4. 플래그가 아예 없을 때 `undefined` 반환

  `parseCliFlag`는 현재 `export function`으로 export 되어 있으므로 테스트 파일에서 바로 import 가능하다. `jest.replaceProperty(process, 'argv', [...])` 또는 임시 재할당으로 격리 가능하다.
- 제안: `cli-utils.spec.ts` 를 추가하여 위 4개 케이스와 `--flag value` / `--flag=value` 양식을 각각 검증.

---

### [WARNING] `eval-retrieval.ts` — 테스트 파일 없음, 핵심 분기 미검증
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts`
- 상세: 약 280줄 스크립트 전체에 테스트가 없다. 특히 다음 경로가 자동 검증 밖이다.
  1. **CI 게이트 분기** (`--fail-metric / --fail-under / --fail-k`): `process.exit(3)` (값 없음), `process.exit(4)` (임계 미달), PASS 출력 경로. `jest.spyOn(process, 'exit')`로 검증 가능하다.
  2. **`--fail-metric mrr` + `--fail-k` 지정 시 경고 출력** (W10 수정 사항이지만 회귀 테스트 없음).
  3. **`fmt` 함수**: NaN 입력 시 `'  n/a'` 반환, 정상 수치 `.toFixed(3)` 출력 미검증. 현재 non-export 이라 단위 테스트 불가 구조.
  4. **`--out` 경로 CWD 경계 가드** (W5): CWD 밖 경로 입력 시 `process.exit(1)` 분기 자동 검증 없음.
  5. **zod GoldenSetSchema `safeParse` 실패 경로** (W6): 잘못된 golden.json 입력 시 `process.exit(1)` 분기.
  6. **`resolveWorkspace` UUID 검증** (W7): 비UUID `kbId` 가 들어오면 `null`을 반환해 skip 처리하는 경로.

  `fmt`, CI 게이트 분기, 경로 가드는 NestJS 부팅 없이 단위 수준에서 검증 가능하지만, `fmt`가 현재 export 되지 않아 테스트가 불가능한 구조다.
- 제안: `fmt`, CI 게이트 로직을 export 하거나 별도 util 모듈로 분리. CI 게이트를 `checkCiGate(report, args): void` 순수 함수로 추출해 `jest.spyOn(process, 'exit')` 검증 추가.

---

### [WARNING] `generate-golden-set.ts` — 테스트 파일 없음, 핵심 로직 미검증 가능성
- 위치: `/codebase/backend/src/scripts/generate-golden-set.ts`
- 상세: diff 가 binary 로 표시되어 코드를 직접 확인할 수 없으나, `generate-golden-set.spec.ts` 파일이 존재하지 않는다. plan 에 따르면 이 스크립트는 다음 로직을 포함한다.
  1. **entry id 안정 해시** (kb+chunk+query 기반 dedup 키) — 동일 입력에 동일 id가 생성되는지
  2. **기존 golden.json 머지 시 `reviewed:true` 항목 보존** — 재실행 시 기검수 항목이 덮어쓰이지 않는지 (데이터 손실 회귀)
  3. **`--dry-run` 분기** — 파일 쓰기 없이 미리보기만 하는지
  4. **`parseQuestions` LLM 응답 파싱** — 잘못된 JSON 응답 시 fallback 처리

  이 중 1, 2, 4는 `LlmService`를 mock하면 단위 수준에서 테스트 가능하다. 특히 `reviewed:true` 보존 로직의 회귀는 재실행 시 SME 검수 결과 손실로 직결된다.
- 제안: `LlmService` mock을 사용해 id 해시 안정성, `reviewed:true` 보존 머지 로직, `parseQuestions` 파싱 오류 처리를 단위테스트로 추가.

---

### [WARNING] `EvalCliModule` — DI 연결 회귀 테스트 없음
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- 상세: plan 에 "EvalCliModule 부팅 스모크 통과"가 기록되어 있지만 수동 검증이다. `RagSearchService`, `RerankService`, `RerankClientFactory` DI 연결이 깨지는 회귀(예: 새 `@Injectable()` 의존성 추가 후 `EvalCliModule` providers 누락)를 자동으로 탐지하는 테스트가 없다. `app.module.spec.ts`의 REQUIRED 목록 패턴처럼 `eval-cli.module.spec.ts`를 두면 CI에서 자동 검증 가능하다.
- 제안: `eval-cli.module.spec.ts` 를 만들어 `TypeOrmModule`, `LlmModule`, `RerankConfigModule` 을 mock/override 처리한 후 `RagSearchService` DI 성공을 assertion 하는 최소 스펙 추가.

---

### [INFO] `golden.example.json` — 스키마 픽스처 유효성 자동 검증 없음
- 위치: `/codebase/backend/eval/golden.example.json`
- 상세: 예시 파일이 `GoldenSet` 인터페이스를 실제로 만족하는지 자동 검증하는 테스트가 없다. `GoldenSetSchema` zod 스키마가 `eval-retrieval.ts`에 이미 정의되어 있으므로, 해당 스키마로 `golden.example.json`을 파싱하는 테스트를 추가하면 미래 스키마 변경 시 예시 파일 누락도 자동 감지된다.
- 제안: `retrieval-metrics.spec.ts` 또는 별도 스펙에 `golden.example.json` 을 `readFileSync` 해 `GoldenSetSchema.safeParse` 통과를 assertion 하는 테스트 추가.

---

### [INFO] `firstRelevantRank` 함수 — 간접 커버만, 직접 테스트 없음
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts:72`
- 상세: `firstRelevantRank`는 export 되어 있지만 `retrieval-metrics.spec.ts`에 직접 테스트가 없다. `mrrAtK` 및 `evaluateEntry`를 통해 간접 검증되나, `null` 반환 경로(top-k 내 relevant 없음)를 독립적으로 명시하는 케이스가 없다. `perEntry` 리포트에서 `firstRelevantRank` 필드가 직접 사용된다.
- 제안: `firstRelevantRank` 에 relevant 없을 때 `null` 반환, 첫 번째 gold 순위 반환 케이스를 직접 추가.

---

### [INFO] `precisionAtK(k <= 0)` 방어 분기 — 미테스트
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts:57`
- 상세: `precisionAtK` 는 `k <= 0` 일 때 `0`을 반환하는 방어 분기가 있지만 테스트가 없다. 실운용에서 `--ks` 에 0 이하 값이 들어오면 이 경로를 탄다.
- 제안: `precisionAtK(['c1'], gold, 0)` 이 `0` 을 반환함을 단순 케이스로 추가.

---

## 요약

이번 변경의 테스트 강점은 핵심 순수 TS 지표 레이어(`retrieval-metrics.ts`)로, 이전 리뷰(02_39_25)에서 지적된 `lang-detect` 엣지 케이스, positive-zero, NaN guard 테스트가 모두 추가되어 26개 케이스가 경계값·NaN 오염·언어별 분기를 충실히 커버한다. 반면 CLI 스크립트 레이어에는 테스트가 전무하다. 공유 유틸 `cli-utils.ts`의 `parseCliFlag`, `eval-retrieval.ts`의 `fmt`·CI 게이트·경로 가드 분기, `generate-golden-set.ts`의 id 해시·`reviewed:true` 보존 머지 로직은 모두 자동 검증 밖이며, `EvalCliModule` DI 연결도 수동 스모크에만 의존한다. `fmt` 함수가 non-export 구조인 점처럼 내부 함수 비노출이 단위 테스트를 어렵게 만드는 설계 패턴이 일부 존재한다. 지표 계산 레이어는 테스트 구조가 우수하나, CLI 레이어의 테스트 공백이 CI 게이트 로직 회귀를 유발할 수 있어 전체 위험도는 MEDIUM으로 판단한다.

## 위험도

MEDIUM
