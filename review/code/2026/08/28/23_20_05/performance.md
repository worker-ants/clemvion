# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `it.each(BLOCKERS)` 루프 안에서 lockfile 을 매 케이스마다 재읽기·재파싱 (동일 인자로 4회 반복 호출)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:72`
  - 상세: `const entries = readPeerRanges(readLockfile(), BLOCKER_NAMES);` 가 `it.each(BLOCKERS)` 콜백 내부에 있어, `BLOCKERS` 4개 항목 각각에 대해 (a) `pnpm-lock.yaml`(현재 트리 기준 ~765KB·22,537줄) 을 `fs.readFileSync` 로 동기 재읽기하고 (b) 같은 `BLOCKER_NAMES` 를 대상으로 전체 lockfile 라인을 처음부터 다시 정규식 파싱합니다. 인자(`readLockfile()`, `BLOCKER_NAMES`)가 매 반복 동일하므로 결과도 동일 — 순수한 중복 계산·중복 I/O 입니다. 프로덕션 핫패스가 아니라 CI 테스트 실행 시간에만 영향(수십 ms 수준 추정)이라 심각도는 낮지만, 파일 헤더 주석이 "lockfile 은 6MB 급" 이라고 명시할 만큼 큰 파일을 다루는 코드라는 점에서 습관적으로 남으면 향후 파일이 더 커지거나 `it.each` 케이스 수가 늘 때 누적 비용이 커질 수 있습니다.
  - 제안: `readPeerRanges(readLockfile(), BLOCKER_NAMES)` 호출을 `describe` 블록 상단(또는 `beforeAll`)으로 끌어올려 1회만 계산하고, `it.each` 콜백은 그 결과 맵에서 `entries.get(name)` 만 조회하도록 바꾸면 I/O·파싱 호출이 4회 → 1회로 줄어듭니다.

- **[INFO]** `readPeerRanges` 가 원하는 패키지를 모두 찾은 뒤에도 파일 끝까지 라인 순회를 계속함
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:104` (`for (const raw of lockText.split("\n"))` 루프 전체, 종료 조건 없음)
  - 상세: `wanted` 크기(현재 4개)만큼 `out` 에 항목이 채워져도 루프가 조기 종료하지 않고 전체 lockfile(22,537줄)을 끝까지 스캔합니다. `wanted` 대비 `out.size` 로 조기 `break` 가 가능한 구조입니다. 다만 lockfile 크기가 현재 수준(수백 KB~1MB대)이고 테스트 전용 코드라 실질적 영향은 미미합니다.
  - 제안: (선택) `if (out.size === wanted.size) break;` 를 키 매칭 분기 뒤에 추가하면 대상 패키지가 lockfile 앞쪽에 있을 경우 스캔량을 줄일 수 있습니다. 다만 게이트 목적(정확성)에 비해 이득이 작아 우선순위는 낮습니다.

- **[INFO]** `lockText.split("\n")` 로 전체 파일을 배열로 메모리에 적재
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:104`
  - 상세: 스트리밍 라인 리더(`readline` 등) 대신 `split("\n")` 을 사용해 파일 전체 텍스트와 그 라인 배열(수만 개 문자열 조각)이 동시에 메모리에 존재합니다. 파일 크기가 현재 규모에서는 문제되지 않으나, 앞서 지적한 4회 반복 호출과 결합하면 매 반복마다 이 배열이 새로 생성·GC 대상이 됩니다(1번 항목 수정 시 자연히 1회로 줄어듦).
  - 제안: 1번 항목(호이스팅)을 적용하면 이 할당도 1회로 줄어들어 별도 조치는 불필요합니다.

## 요약

이번 변경은 신규 테스트 전용 가드 파일(`eslint10-unblock-guard.ts`, `eslint10-unblock.test.ts`)과 plan 문서 갱신으로, 프로덕션 런타임 경로에는 영향이 없습니다. 알고리즘은 O(lockfile 라인 수) 선형 스캔으로 적절하고, N+1 DB/API 호출·블로킹 I/O로 인한 서비스 영향·캐시 무효화 이슈는 없습니다. 유일하게 눈에 띄는 점은 `it.each(BLOCKERS)` 루프 안에서 동일한 lockfile 읽기·파싱을 4회 반복한다는 것인데, 이는 CI 테스트 실행 시간에 국한된 경미한 중복 계산으로 실제 사용자·서비스 성능에는 영향을 주지 않습니다. 전반적으로 성능 관점의 위험은 없습니다.

## 위험도

NONE
