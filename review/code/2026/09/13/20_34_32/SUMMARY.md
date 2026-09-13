# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(JSDoc 주석이 엉뚱한 블록 위로 밀림, 8줄 이동으로 해소). SPEC-DRIFT 1건은 이미 developer 가 실측·근거와 함께 plan 트래커에 등재해 project-planner 로 위임 완료된 상태(이 PR 자체에 대한 조치 요구 아님). forced reviewer 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | JSDoc 주석("발행 축 수집기 3종의 합성 경계 대조군...")이 원래 설명 대상 블록(`describe("발행 축 수집기 — 경계 대조군")`)에서 두 블록 떨어진 엉뚱한 블록(`describe("staleEntries — 판별 대조군")`) 바로 위에 얹혀 있음. 라운드 2(`isMessagePrefixOnly` export 승격)에서 밀리기 시작해 라운드 3(`staleEntries` 대조군 추가)이 한 칸 더 벌림. 3라운드 동안 어떤 checker 도 못 잡음 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:512-519`(JSDoc), `:520`(엉뚱한 대상), 원래 대상 `:568` | JSDoc 블록을 `:566`(`isMessagePrefixOnly` describe 닫는 `});`) 다음, `:568` describe 바로 위로 이동(8줄 이동, `staleEntries` describe 는 이미 자체 인라인 설명이 있어 JSDoc 불필요) |

## 참고 (INFO) 및 SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec 6~7개 파일이 여전히 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "에러 코드"처럼 서술 — 실측(`execution-engine.service.ts:7121,7125,7130,8016`)으로 이 배치가 정정한 가이드 문장(메시지 접두일 뿐, `code` 필드 없음)과 어긋남. 코드/가이드가 옳고 spec 이 낡음 | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/3-workflow-editor/2-edge.md:202`, `spec/4-nodes/1-logic/{0-common:83, 7-map:179-180, 9-foreach:209-210}.md` | 이 PR 조치 불요 — developer 가 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3404-3456` 에 근거·선례·처분 옵션과 함께 등재해 project-planner 위임 완료. planner 집행 시 `3-loop.md §6` 형식(발행 문자열 전문을 "메시지" 열에)으로 통일 + `3-error-handling.md §1.4` 카탈로그 backfill 과 연동 |
| 2 | requirement | `spec/conventions/user-guide-evidence.md §2` "Build-time 가드(3건)" 표가 `guide-identifier-existence.test.ts` 를 여전히 미포함(기존 상태, 이 diff 가 만든 것 아님) | `spec/conventions/user-guide-evidence.md:68` vs `PROJECT.md:300` | 이 가드 계열을 다음에 만질 때 §2 표 갱신 |
| 3 | requirement | `where` 검증 탐색 루트가 `codebase/backend/src` 하드코딩 — 향후 `packages/`/frontend 소스 근거 등록 시 그 항목만 "0건" fail-loud | `guide-identifier-existence.test.ts` `walkTree(root, ["codebase/backend/src"], …)` | 오늘은 안전(등록 3건 전부 backend/src 안). 넷째 등록이 밖을 가리키면 탐색 루트 배열 확장 |
| 4 | requirement/side_effect | `collectCatalogCodes`/카탈로그 SoT read 가 `readIfPresent` 가드 없이 describe 최상위에서 하드 `fs.readFileSync` (3라운드 연속 기존 관행, 재확인) | `guide-identifier-existence.test.ts:82-87, 110-115` | 조치 불요. 이 스위트 하드 리드 전체를 통일 리팩터할 기회에 함께 |
| 5 | maintainability | `collectMatches` 호출부의 capture-group 인덱스(숫자 리터럴)가 정규식 정의와 100줄 이상 분리 — 대조군이 사실상 회귀 방어 중이라 낮은 우선순위 | `guide-identifier-scan.ts:260,263,266` (정의) / `:373,385,427` (소비) | 급하지 않음. 다음 손댈 때 named capture group(`(?<token>...)`)으로 전환 |
| 6 | maintainability | vacuity 하한 리터럴(`>10`,`>30`,`>2`,`>20`)이 이름 없는 상수(3라운드 연속 미조치, 실질 위험 낮음) | `guide-identifier-existence.test.ts:219-220, 395-396` | 급하지 않음 |
| 7 | testing | `where` 필드의 `hits.length !== 1`(0건/2건 이상) 분기를 겨눈 합성 fixture 없음(라운드 3에서 이미 지적·명시적 유예) | `guide-identifier-existence.test.ts:246` | 조치 불요(기존 유예). 향후 순수 함수 분리 시 함께 대조군 추가 |
| 8 | user_guide_sync | `userguide-gui-flow-section` trigger 가 glob 상 매칭되나 실질은 GUI 흐름 절이 아닌 경고 문구 정정(회색지대, 실질 갭 없음) | `logic.mdx:114`, `logic.en.mdx:103` | 조치 불필요 — 참고용 |
| 9 | security | 경로 리터럴 전부 저장소 내부 상수/커밋 배열 리터럴, 정규식 5종 ReDoS 패턴 아님, 목록 값은 식별자 이름일 뿐 비밀값 아님 | `guide-identifier-scan.ts:136-266, 300-354`, `guide-identifier-existence.test.ts:41-48,56-60,242-245` | 조치 불필요 |
| 10 | side_effect | 신규 export 5종은 순수 추가(기존 시그니처 변경 없음), `matchAll` 기반 무상태 사용으로 `.lastIndex` 오염 없음, 순수 함수·읽기 전용 I/O만 | `guide-identifier-scan.ts:260-291` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | dev-time 전용 문서 검증 테스트, 신뢰 경계 밖 입력 없음, ReDoS 없음 |
| requirement | LOW | 기능 구현 정확·71/71 GREEN·독립 실측 재현. SPEC-DRIFT 1건(기존, 이미 등재) + INFO 3건(기존) |
| scope | NONE | 79개 변경 파일 전부 plan 체크리스트/게이트 산출물/정확한 등재로 설명, 무관한 변경 없음 |
| side_effect | NONE | 순수 함수·읽기 전용 I/O, 신규 상태/전역/부작용 없음 |
| maintainability | LOW | 라운드 1~3 지적 전부 해소 확인, 신규 INFO 1건(capture-group 인덱스 분리, 낮은 우선순위) |
| testing | NONE | fix 커밋 뮤테이션 독립 재현(필터 반전 → 4건 FAIL), 신규 WARNING/CRITICAL 없음 |
| documentation | LOW | WARNING 1건(JSDoc 위치 밀림, 8줄 이동으로 해소) 외 전부 재확인·문제 없음 |
| user_guide_sync | NONE | KO/EN 동시 정정, 재발 방지 가드까지 포함한 이상적 동반 갱신 사례. INFO 1건(회색지대, 실질 갭 없음) |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상 1건 이상 보고(대부분 "확인 후 문제 없음" 성격의 긍정적 검증 포함).

## 권장 조치사항

1. `guide-identifier-existence.test.ts:512-519` 의 JSDoc 블록을 `:568` describe 바로 위로 이동(8줄 이동, WARNING #1 해소).
2. (선택, 급하지 않음) `collectMatches` 호출부를 named capture group 으로 전환해 정규식-그룹 인덱스 결합을 제거.
3. SPEC-DRIFT 항목(spec 6~7개 파일의 `CONTAINER_*` "코드" 서술)은 이 PR 조치 대상 아님 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커를 통해 project-planner 가 별도 턴에서 집행.
4. 그 외 INFO 항목들(vacuity 하한 리터럴 명명, `where` 0건/2건 분기 대조군, 카탈로그 하드 리드 통일)은 이 스위트를 다음에 손댈 때 함께 처리해도 무방.

## 라우터 결정

- `routing=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨. 강제 화이트리스트 미이행 없음.
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관(런타임 성능 영향 없는 dev-time 테스트 변경) |
  | architecture | router 판단상 이번 diff 와 무관(아키텍처 구조 변경 없음) |
  | dependency | router 판단상 이번 diff 와 무관(의존성 변경 없음) |
  | database | router 판단상 이번 diff 와 무관(DB 접근 코드 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(동시성 코드 없음) |
  | api_contract | router 판단상 이번 diff 와 무관(API 계약 변경 없음, backend 코드 미변경) |