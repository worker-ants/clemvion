# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 2건(그중 1건은 SPEC-DRIFT — 코드/가이드는 정확하고 spec 6개 문서가 낡음). forced whitelist(7명) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음. 실질 코드 변경은 정적 스캐너 발행 축 추가 두 파일뿐이며, 3라운드에 걸쳐 mutation·진리표 대조군·실측 검증이 촘촘히 이뤄진 상태.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec 6개 파일이 여전히 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`을 "코드"로 서술 — 이번 배치가 정정한 가이드 문장(코드가 아니라 메시지 접두)과 정면으로 어긋난다. 실측(`execution-engine.service.ts:7121·7125·7130`, `:8016` `nodeExec.error={message}`에 `code` 필드 없음)이 코드/가이드가 옳음을 확인. 이 배치가 이미 이 사실을 발견해 `plan/in-progress/spec-draft-nullable-notation-followups.md:3419-3438`에 근거·선례(`3-loop.md:189-191`)와 함께 planner 몫으로 정확히 등재해 두었다 | `spec/5-system/4-execution-engine.md` §3.0, `spec/3-workflow-editor/2-edge.md` §6.1, `spec/3-workflow-editor/0-canvas.md` §11.2.2, `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/1-logic/7-map.md` §6, `spec/4-nodes/1-logic/9-foreach.md` §6 | 코드는 유지. `project-planner`가 위 6개 spec을 `3-loop.md` §6 형식(발행 문자열 전문을 "메시지" 열에)으로 통일. 같은 트래커 3440행의 `3-error-handling.md §1.4` 앵커 표기 택일 항목도 연동돼 있어 함께 처분 |
| 2 | Testing | `staleEntries` 헬퍼(`list.filter(e => !cited.has(e.token))`)가 실제로 "인용 안 됨"을 판정하는지 겨눈 합성 대조군이 없다 — 두 호출부 모두 실코퍼스의 베이스라인-0 검증(`toEqual([])`)뿐이라, 두 목록이 커지기 전까지는 필터 방향이 뒤집혀도(부정 누락 등) 우연히만 잡힌다 | `guide-identifier-existence.test.ts:64`(정의), 호출부 `:291`, `:408` | `staleEntries([{token:"NOT_CITED"}], new Set(["OTHER"]))` → `["NOT_CITED"]`, `staleEntries([{token:"CITED"}], new Set(["CITED"]))` → `[]` 같이 판정이 갈리는 두 값을 명시적으로 고정하는 합성 케이스 추가 (1줄짜리 함수라 비용 낮음) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 신규 정규식 3종(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`)은 기존 안전 패턴(`UPPER_SNAKE`) 조합이라 ReDoS 없음, 입력도 저장소 자신의 정적 텍스트 | `guide-identifier-scan.ts` 정규식 선언부 | 조치 불필요 |
| 2 | Security | 파일 경로 전부 하드코딩 상대경로/소스 상수 — path traversal 벡터 없음, 하드코딩 시크릿 없음 | `guide-identifier-existence.test.ts`, diff 전체 | 조치 불필요 |
| 3 | Requirement | `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표가 `guide-identifier-existence.test.ts`를 안 싣는다(이 diff 범위 밖, 기존 서술) | `spec/conventions/user-guide-evidence.md:68` | 다음에 이 가드 계열을 만질 때 표를 갱신해 "3건 뿐"으로 오인하지 않게 |
| 4 | Requirement | `collectCatalogCodes`의 spec 카탈로그 읽기가 존재 가드 없이 하드 `fs.readFileSync` | `guide-identifier-existence.test.ts` `catalogCodes` 선언부 | 기존 관행과 일치, 조치 불요(이전 라운드에서도 처분됨) |
| 5 | Scope | 커밋 범위에 리뷰/일관성-검토 산출물 51개 포함 — 정상 워크플로 산출물(review는 gitignore 대상 아님, CLAUDE.md 의무 게이트 부산물) | `review/code/2026/09/13/{19_23_22,19_51_33}/**`, `review/consistency/2026/09/13/{18_40_54,19_23_31,19_51_39}/**` | 조치 불필요 |
| 6 | Scope | 라운드 2 fix 커밋이 지목된 두 코드 파일 밖으로 번지지 않음, plan 트래커 추가분(+64/-2)도 실제 발견을 정본에 옮긴 정상 부산물 | `a4b98eda8`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불필요 |
| 7 | Maintainability | `where`/`why` 필드 vacuity 하한이 형제 목록과 다른 값(20 vs 30)인데 이름 붙은 상수가 없음 (라운드 1부터 이월) | `guide-identifier-existence.test.ts:219-220` vs `:394-395` | 다음 편집 시 `WHERE_MIN_LENGTH`/`WHY_MIN_LENGTH` 류 상수로 추출 고려 |
| 8 | Maintainability | 같은 파일에 정규식 매치 수집의 두 관용구(`matchAll` vs 수동 `lastIndex`) 공존 (의도적 유예, 파일 상단 주석에 명시) | `guide-identifier-scan.ts:456-484`, `:494-505`, `:536-558` vs `:281-291` | 조치 불요, 다섯 번째 축 추가 시 결정 필요 |
| 9 | Maintainability | `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 이름이 한 토큰만 다르고 제약이 정반대(JSDoc 대조표로 완화됨) | `guide-identifier-scan.ts:300`, `:333` | 조치 불요, 세 번째 목록 생기면 대조표 갱신 |
| 10 | Maintainability | "where 검증" 테스트가 항목·위치 조합마다 `walkTree`를 반복 호출(상한 5로 성장 억제됨) | `guide-identifier-existence.test.ts:224-260` | 조치 불요 |
| 11 | Testing | `where` 필드의 파일-존재/줄-내용 검증(인라인, 함수로 미분리)이 0건·2건 이상 매치 분기를 겨눈 합성 fixture 없음 — 회귀 시 실패는 하되 스택트레이스로 진단 비용 상승 | `guide-identifier-existence.test.ts:224` 내 `:241-258` | 급하지 않음. 향후 `verifyWhereRef` 순수 함수로 분리 시 3갈래 합성 대조군 추가 |
| 12 | Documentation | `review/code/2026/09/13/19_23_22/requirement.md`가 이번 프롬프트 번들에서 diff 누락 표시됨 — 저장소 직접 확인 결과 정상 34줄 파일, 프롬프트 조립 과정의 누락일 뿐 코드/문서 결함 아님 | 해당 세션 파일 | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정적 스캐너/문서 정정만, 신규 정규식 ReDoS 없음, 시크릿 없음 |
| requirement | LOW | 기능 구현 정확(68/68 GREEN, 독립 뮤테이션 RED 확인), SPEC-DRIFT 6개 spec 파일이 이미 planner 몫으로 등재됨 |
| scope | NONE | 59개 파일 전부 계획서 체크리스트 1:1 대응 또는 의무 게이트 산출물, 이탈 없음 |
| side_effect | NONE | 신규 헬퍼 전부 순수 함수/읽기 전용, 전역 상태·네트워크·시크릿 없음 |
| maintainability | LOW | 3라운드 지적된 실질 결함 전부 해소, 잔여는 전부 이월 INFO |
| testing | LOW | 68/68·3368/3368 GREEN, `staleEntries` 판별 fixture 누락(WARNING) |
| documentation | NONE | 이전 라운드 지적 전부 해소 확인, 신규 서술도 소스와 일치 |

## 발견 없는 에이전트

(해당 없음 — 7개 에이전트 모두 최소 1건 이상의 참고/경고 사항을 기록)

## 권장 조치사항
1. `project-planner`가 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 SPEC-DRIFT 항목(3419-3438행)을 처리해, spec 6개 파일(`4-execution-engine.md` §3.0, `2-edge.md` §6.1, `0-canvas.md` §11.2.2, `0-common.md`, `7-map.md` §6, `9-foreach.md` §6)을 `3-loop.md` §6 형식으로 통일 — 코드/가이드는 유지, spec만 갱신. 연동된 `3-error-handling.md §1.4` 앵커 표기 항목도 함께 처분.
2. `guide-identifier-existence.test.ts`의 `staleEntries` 헬퍼에 판별 fixture(값이 갈리는 두 케이스) 1쌍 추가 — 이 파일이 다른 모든 신규 함수에 적용한 규율과 일관성을 맞춘다.
3. (급하지 않음) 다음에 `where` 검증 로직을 순수 함수로 분리할 계기가 생기면 0건/2건 이상 매치 분기의 합성 대조군을 함께 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff와 관련성 낮음(정적 스캐너/문서 변경, 성능 critical path 없음) |
  | architecture | router 판단상 이번 diff와 관련성 낮음(신규 아키텍처 결정 없음) |
  | dependency | router 판단상 이번 diff와 관련성 낮음(의존성 변경 없음) |
  | database | router 판단상 이번 diff와 관련성 낮음(DB 접근 코드 없음) |
  | concurrency | router 판단상 이번 diff와 관련성 낮음(동시성 코드 없음) |
  | api_contract | router 판단상 이번 diff와 관련성 낮음(API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff와 관련성 낮음(가이드 정합성은 requirement/documentation이 커버) |