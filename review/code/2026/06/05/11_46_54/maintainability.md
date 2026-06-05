# 유지보수성 코드 리뷰 — O(n) 증분 압축 루프

**대상**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` + `.spec.ts`
**Diff 범위**: `57d366b6..HEAD -- codebase/`
**검토 관점**: 가독성, 네이밍, 인덱스 변수 명확성, 불변식 주석 충분성, 테스트 오라클 drift 위험, 중복

---

## 발견사항

### WARNING — `cut` 네이밍: 단순 인덱스와 구분이 모호

- **위치**: `agent-memory-injection.ts` L253, L259, L263
- **상세**: `cut = 0`으로 선언된 변수가 루프에서 인덱스 전진용으로만 사용된다. 이름 `cut`은 같은 파일 하단(L336, L345, L384)의 `cutIndex` / "cut 위치" 맥락과 의미론적으로 겹쳐, 독자가 "어느 쪽 cut인가"를 두 번 생각하게 만든다. `compressUpTo`나 `compressionBoundary`, 또는 `oldestIdx` / `cutIdx` 처럼 역할을 명시하는 이름이 의도를 즉시 전달한다.
- **제안**: `let cut = 0` → `let cutIdx = 0` (또는 `compressTailIdx`). 동시에 `uncompressed[cut]`, `cut += 1`도 동일하게 rename. 같은 파일 하단의 `cutIndex` 와 일관성을 맞출 수 있다.

### WARNING — `remainingCount`가 `cut`의 파생값임이 코드에서 드러나지 않음

- **위치**: `agent-memory-injection.ts` L252–L264
- **상세**: `remainingCount = uncompressed.length`, `remainingCount -= 1`, `cut += 1`은 항상 동기화된다. 두 변수가 사실 같은 진행 상태의 두 관점(`uncompressed.length - cut`)이라는 점이 코드에서 보이지 않는다. 독자는 "둘이 진짜 따로 움직일 수 있는 경우가 있나?" 하고 멈추게 된다. 변수를 하나 없애면 불변식이 코드 자체로 증명된다.
- **제안**: `remainingCount` 제거 후 while 조건을 `uncompressed.length - cutIdx > MIN_RECENT_RAW_TURNS`로 교체. 산술이 한 군데로 집약되어 invariant가 코드에서 자명해진다.

### INFO — 블록 주석의 한국어/수식 혼용 밀도가 높음

- **위치**: `agent-memory-injection.ts` L241–L249 (9줄짜리 블록 주석)
- **상세**: 불변식(Σ, fixedOverhead, bit-identical) 설명이 단일 괄호 안에 몰려 있어, 처음 읽는 개발자가 한 번에 파싱하기 어렵다. 중요한 두 가지 사실 — (1) remainingTokens 는 fixedOverhead 를 포함한 채로 시작하므로 turn 토큰만 빼도 된다는 것, (2) 배열 복사/shift 제거로 진짜 O(n)이라는 것 — 을 각각 별개의 문장으로 나누면 훨씬 스캐너블해진다. 현재 구조는 올바르지만 주석 자체가 "too dense"이다.
- **제안**: 블록 주석을 두 단락으로 분리. 첫 단락: 불변식("currentTokens에 fixedOverhead가 이미 포함돼 있으므로 빼면 안 된다"). 두 번째 단락: O(n) 근거("배열 copy/shift 제거").

### INFO — 테스트 오라클 `referenceCut`이 구현 내부 논리를 복제 — 향후 drift 위험

- **위치**: `agent-memory-injection.spec.ts` L563–L583
- **상세**: `referenceCut`은 이전 O(n²) 루프를 그대로 재현한 독립 oracle이며, `estimateTurnTokens`를 직접 import해서 사용한다. 이는 의도적 선택(bit-identical 검증)이지만 두 가지 drift 경로가 존재한다:
  1. `estimateTurnTokens` 또는 `estimateWorkingMemoryTokens`의 내부 공식이 바뀌면 oracle과 구현이 동시에 영향받으므로 테스트가 여전히 통과하면서 새 공식의 정확성은 검증하지 않는다.
  2. `MIN_RECENT_RAW_TURNS` 상수가 변경될 경우 `referenceCut`의 하드코딩 `2`(`referenceCut(turns, currentTokens, budget, 2)`)와 실제 상수가 어긋나 oracle이 잘못된 기대값을 생산한다.
- **위험 평가**: 즉각적 버그는 아니며 테스트 커버리지는 탁월하다. 그러나 oracle이 상수를 직접 참조하지 않는 점은 silent drift 경로가 된다.
- **제안**: `referenceCut(turns, currentTokens, budget, 2)` 호출 시 하드코딩 `2` 대신 `MIN_RECENT_RAW_TURNS`를 import해 사용한다. `MIN_RECENT_RAW_TURNS`가 `export`되지 않으면 테스트를 위해 export하거나, 최소한 주석으로 "이 값은 `MIN_RECENT_RAW_TURNS`와 동기화 필요"를 명시한다.

### INFO — O(n) 복잡도 테스트의 읽기 횟수 상한 `4 * N`의 근거가 주석에만 있음

- **위치**: `agent-memory-injection.spec.ts` L729
- **상세**: `expect(totalReads).toBeLessThanOrEqual(4 * N)` — 4의 의미(prelude 1회 + 루프 내 최대 1회 + renderThreadAsSystemText 최대 2회)가 코드 위 주석에 설명되어 있긴 하다. 다만 `renderThreadAsSystemText`가 몇 번 텍스트를 읽는지는 외부 함수 구현에 의존하므로, 해당 함수가 변경되면 `4 * N` bound가 silent하게 부정확해질 수 있다.
- **제안**: 상수를 named variable로 추출하고, 주석에 "renderThreadAsSystemText가 turn당 최대 2회 이상 읽으면 이 bound를 재검토" 라는 연계 경고를 추가한다. 현재 주석도 나쁘지 않으므로 LOW 우선순위.

---

## 요약

핵심 O(n) 증분 구현 자체는 정확하고 불변식 주석이 상당히 충실하다. 유지보수성 관점의 주요 약점은 두 가지다. 첫째, `cut`과 `remainingCount`라는 두 변수가 항상 `uncompressed.length - cut`으로 환원되는 파생 관계임에도 별개 변수로 관리되어 "두 카운터가 독립적으로 어긋날 수 있나?"라는 인지 부하를 남긴다. 둘째, 테스트 오라클 `referenceCut`이 `MIN_RECENT_RAW_TURNS` 상수를 하드코딩(`2`)으로 전달해 상수 변경 시 silent drift 경로가 열린다. 전체 코드 품질은 양호하며 주석·테스트 커버리지 모두 수준급이다.

---

## 위험도

LOW

---

BLOCK: NO
