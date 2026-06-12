# RESOLUTION — 13_34_23

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 (설정·운영) | 코드 | (단일 commit) | `resolveMemoryLimitMb()` — 잘못된 값/clamp 시 `console.warn` 추가. 미설정(undefined/빈문자열)은 조용한 기본값 유지 |
| W2 (하위호환) | 문서 | (단일 commit) | CHANGELOG.md 에 "Code 노드 isolated-vm 전환 후속" 섹션 신설 — base64 비문자열 `TypeError` breaking change 항목 기술 |
| W3 (documentation) | 코드 | (단일 commit) | `_buildIsolateContext` JSDoc W13 문장을 SoT로 갱신(더 구체적으로 재서술). `BOOTSTRAP_SOURCE` JSDoc 의 상세 설명은 유지. `resolveMemoryLimitMb()` JSDoc 에 "정수만 유효, 소수 절사" 및 console.warn 동작 추가 |

### 선택 INFO 처리

- **I5 (.env.example 섹션 위치)**: `CODE_NODE_MEMORY_LIMIT_MB` 를 `# Execution Engine` 섹션 내 `# Code Node` 서브헤더 아래로 이동. 파일 말미의 중복 항목 제거.
- **I2/I3 (정수 유효, 소수 절사)**: `resolveMemoryLimitMb()` JSDoc 및 `.env.example` 주석에 "정수만 유효, 소수 절사" 명시.

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- build : 통과
- e2e   : 통과 (188/188)

## 보류·후속 항목

- **INFO #1 [SPEC-DRIFT]** spec `4-nodes/5-data/2-code.md` §4 line 130, §7.1 line 376 의 `memoryLimit: 128` 하드코딩 → env 조정 가능 설명으로 갱신 필요. **코드 변경 없음(코드 정확)**. `project-planner` 후속 위임. 본 PR 범위 밖 + 비차단 INFO — 별도 spec PR 강제 아님.
- **INFO #4** `resolveMemoryLimitMb` `@internal` 에도 `export` 노출 — TypeScript 미강제. 현재 규모 허용. 장기 개선 대상.
- **INFO #6** `error-codes.ts` `CODE_MEMORY_LIMIT` 주석 128MB 하드코딩 — 낮은 우선순위 개선 대상.
- **INFO #7** `resolveMemoryLimitMb` 부동소수점 테스트 케이스(`'256.9'`) 미포함 — 동작은 JSDoc 에 문서화됨. 테스트 추가는 선택.
- **INFO #8** `backend-labels.test.ts` 스냅샷: 확인 결과 해당 검사 없음 + unit PASS → 무영향.
- **INFO #9** `jest.retryTimes(2)` describe 전체 적용 — 현재 허용.
- **INFO #10** `$execution.startedAt` 미구현 — 기존 문제, 별도 spec 정비 대상.
- **INFO #11** `syntaxIsolate` Worker Threads 도입 시 경쟁 조건 가능 — 현재 단일 이벤트 루프에서 무해.
