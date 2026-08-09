# Code Review 통합 보고서

## 전체 위험도
**LOW** — 차단 사유 없음. `plan-scan.ts` 추출은 직전 라운드의 vacuous-pass(status 위반 검사가 158 테스트 내내 한 번도 실행되지 않던 문제)를 근본적으로 해소했으나, 같은 성격의 무관측 분기 1건(status가 non-string일 때 skip)과 walker 중복 잔존(Gate C `collectCompletePlans`)이 지엽적으로 남아 있다. Critical 없음, 6개 reviewer 전원(requirement/scope/side_effect/maintainability/testing/security) 결과 확보 — forced 화이트리스트 이행 완료, 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `findNonTerminalCompletedPlans`의 `status`가 문자열이 아닐 때(빈 값/`no`/숫자 등) 조용히 skip하는 분기가 어떤 fixture 로도 exercise 되지 않음 — 이 PR이 다른 5곳에서 막으려던 것과 동일한 형태의 무관측 분기(반전·삭제돼도 11개 테스트 중 무엇도 RED 안 됨) | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:119` | `plan-scan.test.ts` fixture에 `status:`(빈 값) 또는 `status: no`/`status: 123` 같은 non-string 값을 가진 `plan/complete/*.md`를 추가하고, 결과에서 제외됨을 명시적으로 단언 |
| 2 | Maintainability | 스택 기반 디렉터리 순회(walk) 골격이 `walkPlanMarkdown`/`collectSpecMarkdown`/`collectCodebaseSources` 3벌로 중복 — 이 PR이 "네 벌 → 세 벌"로 줄였을 뿐 "walker 가 조용히 갈라진다"는 근본 패턴은 재발 여지가 있음 | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:43-70`, `spec-links.ts:132-152`, `spec-links.ts:320-344` | 공용 `walkTree(root, {skipDir, includeFile})` 헬퍼로 세 walker를 파생시키는 후속 리팩터 고려 |
| 3 | Maintainability | `SpecMdFile` 타입이 이름과 달리 spec 이 아닌 plan 문서·`.ts`/`.tsx` 코드 소스까지 구조적 타이핑으로 흘러들어감(`collectCodebaseSources(): SpecMdFile[]`) — 시그니처만 보면 오독하기 쉬움 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:119-122`, `:320` | 공유 파라미터/리턴 타입을 `MdFile`/`SourceFile` 같은 도메인 중립 이름으로 변경, `SpecMdFile`은 실제 spec markdown 전용으로 한정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Testing | Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans`가 여전히 독립 구현으로 남아 `plan-scan.ts`와 규칙(값)을 손으로 재동기화해야 함(현재는 값 일치 확인됨) | `spec-plan-completion.test.ts:59-83` vs `plan-scan.ts:35-70` | 후속 작업으로 `collectCompletePlanMarkdown` 재사용 전환 또는 parity 테스트 추가 |
| 2 | Requirement | `findNonTerminalCompletedPlans`의 빈 문자열(`status: ""`) 케이스가 fixture로 커버되지 않음 — 다만 현재 로직은 안전한 방향(과대검출)이라 버그는 아님 | `plan-scan.ts:118-122` | 우선순위 낮음, 즉시 조치 불요 |
| 3 | Side Effect | `TERMINAL_STATUSES`가 신규 export(`ReadonlySet`)로 모듈 경계를 넘는 공유 상수가 됨 — 런타임 불변성은 타입에만 의존, `Object.freeze` 없음 | `plan-scan.ts:90-95` | 당장 불요. 계속 다른 모듈로 퍼지면 `Object.freeze` 로 런타임까지 잠글 것 |
| 4 | Side Effect | 완료-plan status 검사가 `0-`/`_` 접두 파일을 새로 면제하도록 스캔 범위가 좁아짐(의도적, fixture로 고정, 현재 데이터엔 무영향) — 그러나 상단 주석이 이를 "예전부터 있던 규칙"처럼 서술해 다소 부정확 | `plan-scan.ts:29-37`, `:77-80` | 기능 조치 불요. 주석을 "완료 status 검사는 이번에 새로 이 면제를 갖게 됐다"로 정정 권장 |
| 5 | Side Effect | `collectLivePlanMarkdown` 반환 타입명이 `SpecMdFile`→`PlanMdFile`로 바뀌었으나 구조적으로 동일해 호출부 영향 없음(하위 호환 의도대로 동작) | `spec-links.ts:17,289`, `plan-scan.ts:24-27` | 조치 불요 |
| 6 | Maintainability | `{absPath, relPath}` 형태 인터페이스가 `PlanMdFile`/`SpecMdFile`/`SpecRecord` 3곳에서 독립 재정의됨 | `plan-scan.ts:24-27`, `spec-links.ts:119-122`, `spec-frontmatter-parse.ts:31-37` | 공용 `MdFileRef` 인터페이스로 통합 고려(급하지 않음) |
| 7 | Maintainability | 완료-plan 최소 개수 하한 `5`가 세 테스트에 매직넘버로 하드코딩됨 | `plan-frontmatter.test.ts:72,158,170` | `const MIN_EXPECTED_PLANS = 5` 로 명명 상수화 |
| 8 | Maintainability | `walkPlanMarkdown`의 `bucket` 매개변수가 원시 `string`으로 열려 있어 오타 시 조용히 빈 배열 반환 가능 | `plan-scan.ts:45` | `bucket: "in-progress" \| "complete"` 로 리터럴 유니온 타입 좁히기 |
| 9 | Maintainability | `decodeAnchor` 헬퍼가 사용부보다 한참 뒤(파일 최하단)에 정의돼 국소적 가독성 저하(동작엔 문제없음, 호이스팅) | `spec-links.ts:362-368` (정의) vs `:207,238` (사용) | `slugify` 근처로 이동 고려, 사소함 |
| 10 | Testing | `walkPlanMarkdown`의 `relPath` 정렬이 독립 검증되지 않음 — 테스트가 결과에 `.sort()`를 재적용 후 비교해 구현 정렬이 깨져도 GREEN 유지 | `plan-scan.ts:68`, `plan-scan.test.ts:105-111` | 정렬이 계약이면 역순 입력 + `.sort()` 없이 원본 순서 단언 테스트 추가. 계약 아니면 무시 가능 |
| 11 | Scope | `spec-links.ts`에 추가된 `import { collectLivePlanMarkdown } from "./plan-scan"`이 임포트 그룹 순서(node 내장→상대→외부 라이브러리)를 다소 어긋나게 함 | `spec-links.ts` 상단 import 영역 | 스타일 수준, 조치 불요 |
| 12 | Security | `bucket` 파라미터는 하드코딩 리터럴만 전달되어 경로 탐색 공격 표면 없음 | `plan-scan.ts:43-49,74,79` | 조치 불요(문제 없음 확인) |
| 13 | Security | YAML frontmatter 파싱은 신뢰 경계 밖 입력을 받지 않으며(자체 커밋된 `plan/**.md`), 파싱 실패는 전부 try/catch로 흡수 | `plan-scan.ts:113-117`, `plan-frontmatter.test.ts:92-93` | 조치 불요 |
| 14 | Security | 신규/변경 정규식 전부 선형(비-재귀) 패턴 — ReDoS 표면 없음 | `plan-frontmatter.test.ts:47-48`, `spec-links.ts:78-79,100,317` | 조치 불요 |
| 15 | Security | 에러 처리에서 민감정보 노출 없음(모든 예외 흡수 또는 리포 상대경로만 노출) | `spec-links.ts:889-894`, `plan-scan.ts:113-117` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | Spec(`.claude/docs/plan-lifecycle.md §4`)·Gate C와 line-level 일치 확인, 리팩터 전후 동작 등가성 diff 검증, 19 files/2839 tests 전량 PASS. INFO 2건(Gate C 워커 잔존, 빈 문자열 status 미커버) |
| scope | NONE | 4개 파일 전부 커밋 이력이 밝힌 단일 목적(status 검사 vacuous-pass 근본 해결) 추출에 정확히 대응. 범위 이탈 없음 |
| side_effect | LOW | 파일시스템 쓰기는 테스트 fixture(임시 디렉터리)에만 국한, 프로덕션 경로 없음. `0-`/`_` 면제 신설(의도적, fixture로 고정)과 관련 주석의 부정확성이 유일한 실질 지적 |
| maintainability | LOW | walker 3벌 중복, `SpecMdFile` 타입 이름 오용이 WARNING 2건. 나머지는 INFO(매직넘버, 타입 중복정의 등) |
| testing | LOW | status non-string skip 분기 무관측(WARNING), Gate C walker 중복(INFO), 정렬 미검증(INFO). 핵심 목적(vacuous-pass 해소)은 달성 확인 |
| security | NONE | read-only 정적 가드 코드, 외부 입력 없음. 경로탐색·YAML 인젝션·ReDoS·정보노출 전부 문제 없음 확인 |

## 발견 없는 에이전트

scope, security — 실질 결함 없음(NONE), 확인 근거만 기록.

## 권장 조치사항
1. `findNonTerminalCompletedPlans`의 `status` non-string skip 분기를 exercise 하는 fixture(빈 값/`no`/숫자)를 `plan-scan.test.ts`에 추가 — 이번 PR의 핵심 목표(무관측 분기 제거)를 완전하게 만드는 유일한 남은 조각.
2. `SpecMdFile` 타입을 도메인 중립 이름(`MdFile`)으로 분리해 plan/코드소스 파일에 "spec" 이름이 오용되지 않게 정리.
3. 후속 작업으로 Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans`를 `plan-scan.ts`의 `walkPlanMarkdown`/`collectCompletePlanMarkdown` 재사용으로 전환해 "네 벌 → 한 구현" 목표를 완결.
4. (선택) walker 순회 골격 3벌(`walkPlanMarkdown`/`collectSpecMarkdown`/`collectCodebaseSources`)을 공용 헬퍼로 파라미터화, 매직넘버 `5` 상수화, `bucket` 타입 리터럴 유니온 좁히기 — 급하지 않은 정리성 항목.

## 라우터 결정

- `routing=all` (router 미선별, 전체 실행 지시):
  - **실행**: requirement, scope, side_effect, maintainability, testing, security (6명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |