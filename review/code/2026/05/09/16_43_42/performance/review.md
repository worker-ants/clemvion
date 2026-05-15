### 발견사항

---

**[WARNING] `truncateArrayForOutput` 바이너리 서치 중 O(log n) 전체 재직렬화**
- 위치: `truncate-body.util.ts` — `truncateArrayForOutput` 함수 전체
- 상세: `measure(slice)` 내에서 `JSON.stringify(slice)` → `Buffer.byteLength` 를 호출한다. 초기 `measure(arr)` 로 전체 배열을 1회 직렬화한 뒤, 예산 초과 시 바이너리 서치가 `arr.slice(0, mid)` 를 매 단계마다 생성하여 또 직렬화한다. n개 원소·각 원소 평균 B 바이트 기준으로, 최악의 경우 총 직렬화 비용은 약 `B × n × log₂(n) / 2` 바이트에 달한다. 1MB 경계 근처의 배열(예: 200KB×6개 = 1.2MB)이면 ~20회 반복, 각 반복마다 수백KB의 임시 문자열이 힙에 적재되었다가 즉시 GC 대상이 된다. 이는 고빈도 실행이 아닌 한 치명적이진 않으나, 대형 payload의 경우 GC 일시 정지를 유발할 수 있다.
- 제안: 원소 단위 누적 방식으로 대체하면 O(k) (k = 보존 원소 수) 로 개선된다:
  ```ts
  let bytes = 2; // "[]"
  let i = 0;
  for (; i < arr.length; i++) {
    let s: string;
    try { s = JSON.stringify(arr[i]); } catch { break; }
    if (s === undefined) break;
    const delta = Buffer.byteLength(s, 'utf8') + (i > 0 ? 1 : 0); // comma
    if (bytes + delta > maxBytes) break;
    bytes += delta;
  }
  const truncated = i < arr.length;
  return { value: truncated ? arr.slice(0, i) : arr, truncated, originalLength: arr.length };
  ```
  단, 이 방식은 JSON 배열 내부 공백/특수문자 처리 등에서 `JSON.stringify(wholeArray)` 와 1~2 바이트 오차가 생길 수 있으므로 소폭의 안전 마진(예: `maxBytes * 0.999`)을 두면 보수적으로 안전하다.

---

**[WARNING] HTML 렌더링이 cap 적용 이전 전체 배열 기준으로 수행됨**
- 위치: `carousel.handler.ts:168` (`renderHtml` 호출), `table.handler.ts:136` (동일)
- 상세: `renderHtml(items, layout)` 및 `renderHtml(resolvedColumns, columns, dataRows)` 는 cap 적용 전 전체 배열로 호출된다. 이후 `truncateArrayForOutput` 로 items/rows 를 잘라내지만 `rendered` HTML 은 드롭된 원소를 포함한 채 그대로 payload 에 들어간다. 50k 행 테이블이라면 모든 행의 HTML 을 생성·보유하는 데 상당한 CPU 와 메모리를 소비하며, `output.rows` 와 `output.rendered` 가 나타내는 데이터 범위가 불일치한다 (spec 의 "rendered는 cap 대상이 아님" 의도는 이해하지만 낭비임).
- 제안: 의도적인 설계라면 spec 코멘트에 "rendered 는 전체 원소 기준" 임을 명시하고 현재 상태를 유지. 성능 개선이 필요하다면 `renderHtml` 을 cap 이후에 호출하거나, cap 초과 시 `rendered` 를 생략/축약하는 정책을 채택한다.

---

**[INFO] 초기 `measure(arr)` 가 통과 케이스에서 전체 배열을 직렬화 후 즉시 폐기**
- 위치: `truncate-body.util.ts:117` — `if (measure(arr) <= maxBytes)`
- 상세: 배열이 1MB 미만인 정상 케이스에서도 `JSON.stringify(arr)` 로 전체를 직렬화하여 크기를 측정한 뒤 문자열을 버린다. 자주 실행될 경우 불필요한 힙 압력이 된다. 대안으로 `originalLength === 0` 같은 빠른 early-return 외에는 마땅한 우회책이 없어 현 구조에서는 불가피하다. 단, 위 WARNING 의 누적 방식으로 전환하면 이 초기 검사도 제거된다.

---

**[INFO] rawConfig 가 multi-turn state 에 추가되어 DB JSONB 직렬화 크기 증가**
- 위치: `information-extractor.handler.ts:305` (`stateBase`), `ai-agent.handler.ts:622/1048/1174/1262`
- 상세: `rawConfig` 는 waiting tick 마다 `NodeExecution.outputData` JSONB 에 직렬화되고 resume 시 역직렬화된다. rawConfig 에 긴 systemPrompt, 복수의 knowledgeBases, 상세한 conditions 배열이 포함된 경우 매 상태 저장·복원 I/O 비용이 증가한다. 통상 kB 수준이므로 치명적이진 않으나, 대규모 병렬 실행 환경에서 다수의 multi-turn 노드가 동시에 진행되면 누적 영향이 있다.
- 제안: 엔진이 `execution-engine.service.ts:1838` 에서 이미 `node.config` 를 resumeState 에 자동 merge 하므로 handler 측 `state.rawConfig` 가 중복 저장되지 않도록 "engine merge 가 존재하면 handler 에서는 생략" 하는 방향도 검토할 수 있다. 현재는 첫 waiting tick 이전 종료 경로를 보장하기 위해 양쪽에 보관하는 것으로 주석에 명시되어 있어 이중 저장이 의도적임.

---

### 요약

성능상 가장 주목할 이슈는 `truncateArrayForOutput` 의 바이너리 서치 구현이다. 매 단계마다 접두 슬라이스를 새로 직렬화하여 O(n log n) 수준의 임시 메모리를 소비한다. 1MB 경계 근처 배열에서 수 MB의 단기 힙 할당이 발생해 GC 일시 정지를 유발할 수 있다. 원소 단위 누적 방식으로 전환하면 O(k)로 개선 가능하다. 그 외 HTML 렌더링이 cap 이전 전체 배열 기준으로 수행되는 점, rawConfig의 중복 상태 저장은 단발성 노드 실행에서는 영향이 미미하나 대용량·고빈도 워크플로에서는 모니터링이 필요하다. rawConfig 에코 자체(ai-agent / information-extractor 핸들러의 객체 구성 로직)는 상수 시간 연산으로 성능 우려 없음.

### 위험도

**LOW** — 정상 payload (1MB 미만) 경로에는 실질적 영향이 없고, 1MB 초과는 이례적 케이스이며 단발성 실행이다. 다만 runaway 데이터를 처리하는 상황에서의 GC 부하를 감안하면 `truncateArrayForOutput` 의 누적 방식 전환은 권장된다.