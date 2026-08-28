# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 8개 reviewer(forced 7명 전원 결과 확보 포함) 모두 실행 완료·전문 확보됨. 실질 결함은 "SoT 문서 갱신 누락"(requirement+documentation 공통 지적)과 두 곳의 테스트 커버리지 갭(testing)뿐이며, 신규 코드는 테스트 전용 repo-guard + plan 문서로 프로덕션 런타임에 영향 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/SoT drift | plan/guard 가 이번에 확정한 "차단자는 4개(react-hooks 포함)" 정정이, plan 문서 자신이 지명한 SoT(`codebase/frontend/eslint.config.mjs` 헤더)에는 반영되지 않았다. 그 헤더는 여전히 "eslint-plugin-react-hooks 는 registry latest(7.1.1) 기준 이미 eslint 10 지원 → 차단자 아님"이라는 옛 결론을 담고 있어, `pnpm-workspace.yaml` 의 exact 핀(7.0.1) 때문에 우리 트리에서는 여전히 차단된다는 사실이 빠져 있다. requirement·documentation 두 reviewer 가 동일 항목을 독립 지적. | `codebase/frontend/eslint.config.mjs` (헤더 실측 표, diff 밖 파일); 관련 정정: `plan/in-progress/deps-peer-gating-and-eslint10.md:185`; 관련 guard 주석: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:14` | `eslint.config.mjs` 헤더 표에 4번째 행(또는 각주)을 추가해 "registry latest 는 10 지원하지만 우리 트리 override 핀(7.0.1) 때문에 여전히 차단자"임을 명시. developer 권한으로 즉시 수정 가능(spec 아님, planner 턴 불요) |
| 2 | 테스트 커버리지 | `readPeerRanges` 의 top-level 키 정규식이 "packages: 섹션 전용"이라는 주석 주장이 코드로 강제되지 않고 테스트도 없다. 실측 결과 `pnpm-lock.yaml` 의 `snapshots:` 섹션에도 동일 이름 키가 매칭 가능한 형태로 존재하며, 현재는 그 항목들이 `peerDependencies:` 하위블록이 없어 `out.set()` 재호출이 우연히 발생하지 않을 뿐이다("우연히 안전"이지 "구조적으로 안전"이 아님). | `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:79-93`(docstring), `:106`(키 정규식) | `eslint10-unblock.test.ts` 의 합성 SAMPLE 에 `snapshots:` 스타일 동일-이름·괄호-한정자 키를 추가해, 섞여도 결과가 오염되지 않음을 명시적으로 단언하는 케이스 추가 |
| 3 | 테스트 커버리지 | `termMajorFloor` 의 `~` 연산자 분기가 어떤 테스트로도 도달·관측되지 않는다. 정규식 alternation(`\^\|~\|>=\|>`)에서 `~` 를 제거하는 뮤테이션을 넣어도 현재 스위트가 전부 GREEN 으로 남는다. | `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:138`; 테스트 부재 위치: `eslint10-unblock.test.ts:105-128`(`allowsEslint10 (합성)`) | `allowsEslint10("~9.5.0")` → false, `allowsEslint10("~10.5.0")` → true 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/테스트 | `it.each(BLOCKERS)` 루프 안에서 `readLockfile()`+`readPeerRanges()` 를 매 케이스(4회) 재호출 — 동일 인자로 중복 I/O·재파싱. performance·testing 양쪽에서 공통 지적 | `eslint10-unblock.test.ts:72` | `describe`/`beforeAll` 로 1회만 계산 후 결과 맵에서 조회하도록 호이스팅 |
| 2 | 성능 | `readPeerRanges` 가 원하는 패키지를 모두 찾아도 조기 종료 없이 파일 끝까지 순회 | `eslint10-unblock-guard.ts:104` | (선택) `out.size === wanted.size` 조건으로 조기 break — 이득 작아 우선순위 낮음 |
| 3 | 유지보수성 | lockfile 들여쓰기 폭(2/4/6칸)이 세 정규식에 매직 넘버로 흩어져 있고, 그 불변식이 이름으로 드러나지 않음 | `eslint10-unblock-guard.ts:106,115,123` | `INDENT` 상수화 후 파생시키거나 주석으로 관계 명시 |
| 4 | 유지보수성 | `BLOCKERS` 의 "upstream" 3개 항목이 동일 `lever` 문자열을 3회 반복 | `eslint10-unblock-guard.ts:92,97,102` | `UPSTREAM_LEVER` 상수로 추출 |
| 5 | 유지보수성 | `it.each` 실패 메시지가 7줄 템플릿 리터럴로 단언 로직과 얽혀 있음 | `eslint10-unblock.test.ts:83-92` | 메시지 조립을 헬퍼 함수로 분리(선택) |
| 6 | 유지보수성 | `readPeerRanges` 지역 변수명(`wanted`,`current`,`out`)이 다소 일반적 | `eslint10-unblock-guard.ts:98-101` | `wantedNames`,`currentPkg` 등으로 구체화(선택) |
| 7 | 요구사항 | `readPeerRanges` 가 동일 패키지명이 중복 해소될 경우 `Map.set` 이 조용히 마지막 값으로 덮어씀 — 현재 데이터로는 미관측이나 가드의 fail-closed 철학과 비일관 | `eslint10-unblock-guard.ts:127` | 중복 발견 시 throw 하거나 "단일 버전 가정" 주석 명시(급하지 않음) |
| 8 | 문서화 | `readLockfile()` 만 파일 내 다른 모든 export 와 달리 JSDoc 이 없음 | `eslint10-unblock-guard.ts:174` | 한 줄 JSDoc 추가 |
| 9 | 테스트 | mock 없이 실제 lockfile/package.json 을 읽는 설계는 캐너리 목적에 부합하는 의도적 선택(긍정 평가) | `eslint10-unblock.test.ts:52-101` | 조치 불요 |
| 10 | 테스트 | "peerDependencies 블록이 eslint: 를 못 만나고 형제 키로 끝나는" 경로가 합성 SAMPLE 로 직접 커버되지 않음(최종 관측 동작은 다른 테스트가 커버) | `eslint10-unblock.test.ts:131-169` | 회귀 고정용 케이스 추가(낮은 우선순위) |
| 11 | 보안/부작용 | 신뢰 경계 밖 입력 없음, 시크릿 없음, ReDoS 없음, 읽기 전용 I/O, 순수 함수, 신규 전역은 파일 스코프에 격리 — 공격 표면·부작용 사실상 없음 | 전체 diff | 조치 불요 |
| 12 | 범위 | diff 가 커밋 메시지·plan 체크리스트 의도와 정확히 일치, 무관한 리팩토링·설정 변경 없음 | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 공격 표면 없음, 시크릿·ReDoS·인증 관련 문제 없음 |
| performance | NONE | `it.each` 4회 중복 I/O(INFO) 외 문제 없음 |
| requirement | LOW | SoT 문서(`eslint.config.mjs` 헤더) 미갱신(WARNING); Map.set 중복 덮어쓰기(INFO) |
| scope | NONE | 발견 없음 — diff 가 의도와 정확히 일치 |
| side_effect | NONE | 읽기 전용 I/O, 순수 함수, 신규 전역 격리 |
| maintainability | LOW | 매직 넘버·문자열 중복 등 INFO 다수, 구조적 결함 없음 |
| testing | LOW | `snapshots:` 섹션 매칭 갭(WARNING), `~` 연산자 미커버(WARNING) |
| documentation | LOW | SoT 문서 미갱신(WARNING, requirement 와 동일 사안); `readLockfile` JSDoc 누락(INFO) |

## 발견 없는 에이전트

- scope (발견사항 없음, 위험도 NONE)

## 권장 조치사항

1. `codebase/frontend/eslint.config.mjs` 헤더의 실측 표를 갱신해 "차단자는 4개(react-hooks 포함, 우리 트리 pin 기준)"를 반영한다 — requirement·documentation 두 reviewer 가 공통 지적한 WARNING #1, developer 권한으로 즉시 수정 가능.
2. `eslint10-unblock.test.ts` 의 합성 SAMPLE 에 `snapshots:` 스타일 동일-이름 키 케이스를 추가해 `readPeerRanges` 의 "packages: 전용" 보장을 구조적으로 고정한다(WARNING #2).
3. `allowsEslint10` 의 `~` 연산자 분기(`~9.5.0`→false, `~10.5.0`→true)를 커버하는 테스트를 추가해 뮤테이션 생존을 없앤다(WARNING #3).
4. (선택, 낮은 우선순위) `it.each` 루프의 lockfile 4회 재읽기를 1회로 호이스팅하고, `BLOCKERS` 의 중복 `lever` 문자열을 상수화한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단(구체적 사유 미제공 — 이번 diff 가 테스트 전용 repo-guard + plan 문서로 아키텍처 변경 없음에 기인한 것으로 추정) |
  | dependency | router 판단(사유 미제공 — 신규 의존성 추가 없음) |
  | database | router 판단(사유 미제공 — DB 관련 코드 없음) |
  | concurrency | router 판단(사유 미제공 — 동시성 코드 없음) |
  | api_contract | router 판단(사유 미제공 — API 계약 변경 없음) |
  | user_guide_sync | router 판단(사유 미제공 — 사용자 가이드 대상 변경 없음) |
