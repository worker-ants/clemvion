# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `extractLinks` 가 한 함수 안에서 4가지 서로 다른 알고리즘 단계(사전 필터 → 펜스/인라인코드 마스킹 + 원본 줄 매핑 생성 → 오프셋 테이블 계산 → 정규식 매칭 + 이진 탐색으로 줄 복원)를 모두 수행해, 이번 변경으로 함수 길이가 약 15줄 → 57줄로 늘어났다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:131`–`187` (`extractLinks` 함수 전체)
  - 상세: 마스킹 텍스트 생성(+ `srcLineOf` 매핑)과 오프셋 테이블 계산(`startOf`), 이진 탐색을 이용한 매치 위치 → 원본 줄 복원이 각각 독립적인 책임인데 한 함수에 인라인돼 있다. 현재는 `extractLinks` 를 통째로 돌려야만 각 단계를 간접적으로 검증할 수 있고, 개별 단계(예: 이진 탐색으로 올바른 줄을 찾는지)를 독립적으로 단위 테스트할 수 없다.
  - 제안: `buildMaskedLines(lines): { body, srcLineOf, startOf }` 같은 헬퍼로 마스킹+오프셋 계산을 분리하고, `lineForOffset(startOf, srcLineOf, index)` 로 이진 탐색을 분리하면 각 단계가 이름을 갖고 독립적으로 테스트 가능해진다. 함수 하나가 길어진 것 자체보다, 서로 다른 관심사(문자열 마스킹 vs. 위치 역산)가 한 몸에 섞인 것이 향후 수정 시 회귀 위험을 높인다.

- **[WARNING]** 펜스 경계 줄과 펜스 내부 줄 분기가 완전히 동일한 3줄(`masked.push("]"); srcLineOf.push(i + 1); continue;`)을 반복한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:145`–`153`
  - 상세: `if (FENCE_RE.test(line)) { inFence = !inFence; masked.push("]"); srcLineOf.push(i + 1); continue; }` 바로 다음에 `if (inFence) { masked.push("]"); srcLineOf.push(i + 1); continue; }` 가 이어지는데, 두 블록의 실행 내용이 정확히 같다(펜스 토글 여부만 다르다). 조건을 하나로 합칠 수 있는 자리인데 분리돼 있어, 이후 이 로직을 고칠 때(예: 펜스 마스킹 문자를 바꿔야 하는 경우) 두 곳을 동시에 고쳐야 한다는 사실을 놓치기 쉽다.
  - 제안: `const isFenceLine = FENCE_RE.test(line); if (isFenceLine) inFence = !inFence; masked.push(isFenceLine || inFence ? "]" : line.replace(/\`[^\`]*\`/g, "")); srcLineOf.push(i + 1);` 형태로 병합하면 동일 동작을 유지하면서 중복을 제거할 수 있다.

- **[INFO]** 마스킹 결과를 `masked`/`srcLineOf`/`startOf` 세 개의 병렬 배열(parallel array)로 관리한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:139`–`166`
  - 상세: 인덱스 `k` 로 세 배열을 함께 순회해야 의미가 성립하는 구조라, 배열 중 하나만 갱신을 빠뜨리는 실수가 생기면(예: 향후 필드 추가 시) 조용히 인덱스가 어긋날 수 있다. 지금은 3개뿐이라 위험이 낮지만, 필드가 하나만 더 늘어도 관리 부담이 커지는 패턴이다.
  - 제안: `{ text, srcLine, start }[]` 같은 단일 객체 배열로 묶으면 인덱스 동기화를 컴파일러/구조가 보장해준다. 다만 현재 규모에서는 필수는 아니며, 함수 분리(첫 번째 발견사항)를 먼저 하면 자연히 캡슐화될 여지가 있다.

- **[INFO]** 테스트 파일에서 `root`(임시 디렉터리) + `writeDoc` 헬퍼 + `beforeAll`/`afterAll` 보일러플레이트 패턴이 파일 전체에서 5회(그중 `writeDoc` 정의는 2회) 반복되는데, 이번 diff 가 그 패턴을 한 번 더 그대로 복제했다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:282`–`286` (새로 추가된 `writeDoc` 정의)가 같은 파일 `:229`–`233` 의 기존 `writeDoc` 정의와 완전히 동일하다.
  - 상세: 파일 안에 이미 동일한 패턴(임시 디렉터리 생성 → `writeDoc` → `afterAll` 정리)이 4개의 `describe` 블록에 걸쳐 존재했고(기존 코드베이스 스타일과 일치하므로 이번 diff 의 새 결함은 아님), 이번 변경이 그 관행을 그대로 따라 다섯 번째 인스턴스를 추가했다. 개별 테스트 가독성에는 문제가 없지만, 이 스캐폴딩을 고칠 일이 생기면(예: 임시 디렉터리 prefix 정책 변경) 5곳을 모두 찾아 고쳐야 한다.
  - 제안: 시급하지 않음(기존 스타일과 일관되고, positive/negative 픽스처 분리가 오히려 각 describe 를 자기완결적으로 만드는 의도적 설계일 수 있음). 다만 여섯 번째 인스턴스가 추가되기 전에 `withTmpDir(prefix, fn)` 같은 공용 fixture 헬퍼로 추출하는 것을 고려할 만하다.

## 요약

이번 변경은 `extractLinks` 를 줄 단위 매칭에서 마스킹된 전문(全文) 매칭으로 바꾸는 실질적인 버그 수정이며, 각 설계 결정(인라인 코드 삭제 vs 공백 치환, 줄 번호 원복, 펜스 경계에서 `]` 삽입)에 대한 근거를 함수 상단 JSDoc 과 diff 주석에 촘촘히 남겨 "왜 이렇게 했는가" 를 다음 사람이 추적할 수 있게 했다는 점이 강점이다. 다만 그 대가로 `extractLinks` 자체가 마스킹·오프셋 계산·이진 탐색까지 한 함수에 떠안아 책임이 늘었고, 그 과정에서 펜스 관련 두 분기가 완전히 동일한 코드를 반복하는 사소한 중복이 남았다. 테스트 파일은 새 시나리오(멀티라인 텍스트 링크, 목적지 줄바꿈 금지, 펜스 사이 링크 금지, 통합 경로에서의 DEAD 검출)를 빠짐없이 왕복 방향으로 고정해 회귀 방지 측면에서 우수하지만, 파일 전체에 걸쳐 이미 존재하던 fixture 보일러플레이트 중복을 한 벌 더 늘렸다. 전반적으로 심각한 가독성·복잡도 문제는 없고, 지적된 함수 분리·중복 제거는 지금 당장 막아야 할 결함이라기보다 다음 리팩토링 시 챙기면 되는 개선 여지다.

## 위험도

LOW
