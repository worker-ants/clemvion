# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 3건(전부 문서/유지보수성 성격, 동작 영향 없음) + SPEC-DRIFT 1건(이미 planner 위임 상태로 등재됨). forced 화이트리스트(7명) 전원 결과 확보 완료 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `collectMatches(regex, group)` 의 정규식-캡처그룹 짝이 타입으로 강제되지 않아, 향후 축 추가 시 그룹 번호가 어긋나도 조용히 `undefined` 가 `Set`에 섞여 들어갈 수 있다 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:309-319`(정의), 호출부 `:401`·`:413`·`:455` | `(regex, group)` 을 분리 인자 대신 `{ rx, group }` 형태로 정규식과 함께 묶거나, 그룹 번호를 이름 있는 상수(`QUOTED_LITERAL_TOKEN_GROUP` 등)로 선언해 어긋남을 grep 으로 잡을 수 있게 한다 |
| 2 | 유지보수성 | `guide-identifier-scan.ts` 상단 주석이 152줄(첫 `export` 이전 전체)에 달하는 리뷰-라운드 서사로, 같은 내용이 `CHANGELOG.md`·`review/code/**/RESOLUTION.md` 에도 중복돼 있어 향후 정정 시 일부만 갱신되고 나머지가 낡을 위험이 있다 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-152`(특히 `:12-20`, `:70-72`, `:88-99`) | "지금 이 함수가 왜 이런 모양인가"의 최소 설계 근거만 소스에 남기고, "라운드 N 이 무엇을 지적/수정했는가" 류의 세션 서사는 `RESOLUTION.md`(기존 SoT)로 이관 |
| 3 | 문서화 | `plan/in-progress/error-code-emission-axis.md` §D-2 의 "등록 대상 3종" 표가 라운드5·6 이 각각 삽입한 두 블록인용에 의해 1행과 2~3행 사이에서 쪼개져, CommonMark/GFM 렌더링 시 3행 표가 아니라 1행 표 + 정렬 안 된 평문 2줄로 나타난다(동작 영향 없음, 이 문서 자신의 "등록 대상은 §D-2 의 3종" 서술과 렌더링 결과가 어긋남) | `plan/in-progress/error-code-emission-axis.md:167-184` | 183-184행(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 행)을 169행 바로 아래로 옮겨 표를 3행 연속으로 복원하고, 두 블록인용(171-182행)은 표 전체가 끝난 뒤(185행 이후)로 이동 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec 6개 파일이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 여전히 정식 에러 코드처럼 서술 — 이 PR 이 정정한 유저 가이드 문장(`code` 필드 없음, 메시지 접두일 뿐)과 직접 모순된다. 코드가 맞고(실측 근거: `execution-engine.service.ts:8017` — `nodeExec.error = { message }`, `code` 필드 부재) spec 6파일이 낡은 쪽이므로 CRITICAL 이 아니라 SPEC-DRIFT. 같은 파일군에 이미 정확한 선례(`3-loop.md:189-191`, 발행 문자열 전문 인용)가 있다 | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` | 코드/가이드는 현행 유지. spec 반영은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 해당 항목(대상 6파일·근거·해법 옵션 명시됨) 집행 시, `3-loop.md:189-191` 형태(발행 문자열 전문 인용)로 통일하거나 `3-error-handling.md §1.4` 에 `CONTAINER_*` backfill — 두 옵션 중 planner 턴에서 택일. **developer 스코프가 아니므로 이번 PR 의 누락이 아니라 의도된 위임** |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 신규 정규식 3종(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`)은 기존에 안전성이 확인된 `UPPER_SNAKE` 패턴을 감싸는 형태로 정량자 매치 범위가 겹치지 않아 ReDoS 전제가 성립하지 않음. `parseWhereRefs` 정규식도 단순 선형 패턴 | `guide-identifier-scan.ts`(정규식 선언부), `guide-identifier-existence.test.ts`(`parseWhereRefs`) | 조치 불요 |
| 2 | 보안 | 하드코딩된 시크릿/자격증명, `child_process`/`eval`/네트워크 호출 없음. 신규 파일 read 는 전부 하드코딩된 저장소 상대경로 대상이라 경로탐색 벡터 없음 | diff 전체 | 조치 불요 |
| 3 | 요구사항 | "발행 축"(메시지 접두로만 등장 ∩ 카탈로그 미등재 ⇒ `GUIDE_NON_EMITTED_VOCABULARY` 등록 강제) 이 선언대로 정확히 구현·배선됨 — 등록 3항목의 `where`/`why` 줄 번호를 소스에서 재실측해 전부 일치 확인 | `guide-identifier-scan.ts`(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/`isMessagePrefixOnly`/`computeNonEmittedOffenders`), `guide-identifier-existence.test.ts` | 조치 불요 |
| 4 | 요구사항 | `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 가 "`spec/conventions/user-guide-evidence.md §2` 에 아직 미등재"임을 스스로 정확히 자백 — SoT 를 존재하지 않는 곳으로 가리키는 과거 클래스의 오류 없음 | 각 파일 JSDoc/헤더 주석, `PROJECT.md:300` | 조치 불요 |
| 5 | 범위 | 실질 코드 변경은 8개 파일로 국한(순증 약 836줄), 나머지 198개 파일은 이 저장소가 강제하는 표준 리뷰/컨시스턴시 게이트의 정상 산출물(`review/**`). 런타임 프로덕션 코드·설정 파일·포맷팅 drive-by 변경 없음 | `git diff origin/main --stat` 분류 | 조치 불요 |
| 6 | 부작용 | 신규 export(`collectQuotedLiterals` 등 6종)는 전부 순수 함수/불변 상수이며 기존 export 시그니처 무변경. 이전 라운드 지적 이름 충돌(`staleEntries` vs `internal-package-registration-guard.ts` export)은 `staleGuideEntries`(비공개)로 개명해 해소 확인 | `guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` | 조치 불요 |
| 7 | 부작용 / 유지보수성 | `SOURCE_ROOTS`/`skipBuildDirs`/`collectMatches`/`staleGuideEntries` 추출이 실제로 파일 내 중복 정의(백엔드 소스 루트가 두 곳에 따로 있던 것 등)를 하나로 합쳐 긍정적 DRY 개선으로 확인됨 | `guide-identifier-existence.test.ts:55-57,108-113`, `guide-identifier-scan.ts:309-319` | 조치 불요 |
| 8 | 테스트 | 라운드7·8 신규 테스트(`resolveSourceLines` 유일성 가드 4종, `parseWhereRefs` 잔여 대조군 2종)를 뮤테이션(`SOURCE_ROOTS`에서 `packages` 제거)으로 직접 재현 — 정확히 겨눈 1건만 RED, 나머지 81건 GREEN. 격리 실행으로 `sourceLinesCache` 모듈스코프 공유가 순서 의존 위험을 만들지 않음도 확인 | `guide-identifier-existence.test.ts`(`resolveSourceLines`/`sourceLinesCache` 관련 describe 블록) | 조치 불요 |
| 9 | 테스트 | `parseWhereRefs` 의 `refs.length === 0` 분기(잔여가 빈 문자열이 되는 경우) 미도달, `[2건 이상]` fixture 의 실코퍼스(`index.ts` 55개) 결합 — 둘 다 라운드3~9에서 이미 지적·유예 문서화된 기존 항목이며 이번 라운드의 신규 갭 아님, fail-loud 방향이라 위험 방향도 안전 | `guide-identifier-existence.test.ts`(`parseWhereRefs`, `resolveSourceLines — 유일성 가드`) | 조치 불요(기존 유예 유지) |
| 10 | 문서화 (운영 참고) | 리뷰 세션 시작 시점에 이 워크트리에서 `guide-identifier-existence.test.ts` 의 `SOURCE_ROOTS`(`["codebase/backend/src", "codebase/packages"]` → `["codebase/backend/src"]`)가 **다른 세션으로 추정되는 미커밋 뮤테이션** 상태였음을 관측. 이 PR 의 committed diff 에는 포함되지 않으며, 이번 통합 보고서의 대상도 아님 — 병행 세션 산출물과의 혼동 방지를 위해 기록만 남김 | `guide-identifier-existence.test.ts`(`SOURCE_ROOTS` 선언부, 리뷰 시점 워킹트리 상태) | 이 PR 종결 전 워크트리가 committed 상태와 일치하는지(다른 세션 뮤테이션 잔존 여부) 재확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| 보안 (security) | NONE | 하드코딩 시크릿·경로탐색·ReDoS·코드실행 벡터 없음 |
| 요구사항 (requirement) | LOW | 발행 축 구현이 선언대로 정확히 배선됨(재실측 일치); spec 6파일 SPEC-DRIFT(이미 planner 위임 등재 상태) |
| 범위 (scope) | NONE | 실질 변경 8파일로 국한, 임의 기능 확장 없음; `review/**` 198파일은 정상 게이트 산출물 |
| 부작용 (side_effect) | NONE | 순수함수/불변상수만 추가, 이름충돌 해소 확인, 전역상태·env·네트워크 부작용 없음 |
| 유지보수성 (maintainability) | LOW | `collectMatches` 그룹번호 미검증(WARNING), 소스 파일에 리뷰 서사 누적으로 CHANGELOG/RESOLUTION 과 중복(WARNING) |
| 테스트 (testing) | NONE | 라운드7·8 신규 테스트를 뮤테이션으로 직접 검증해 판별력 확인, 신규 CRITICAL/WARNING 없음 |
| 문서화 (documentation) | LOW | `plan` §D-2 표가 블록인용 삽입으로 렌더링 붕괴(WARNING); 병행 세션 미커밋 뮤테이션 관측 기록(운영 참고) |

## 발견 없는 에이전트

없음 — 7개 에이전트 전원이 최소 INFO 이상의 발견(대부분 "확인 후 문제없음" 포함)을 보고했다.

## 권장 조치사항

1. `plan/in-progress/error-code-emission-axis.md` §D-2 표 위치 정정 — 183-184행을 169행 바로 아래로 옮겨 표를 3행 연속으로 복원하고, 두 블록인용은 표 뒤로 이동 (저비용·즉시 가능)
2. `guide-identifier-scan.ts` 의 `collectMatches(regex, group)` 짝을 이름 있는 상수/구조체로 묶어 향후 축 추가 시 캡처그룹 미스매치로 인한 조용한 미탐지를 방지
3. `guide-identifier-scan.ts` 상단 152줄의 리뷰-라운드 서사를 `RESOLUTION.md`/`CHANGELOG.md` 로 이관하고 소스엔 최소 설계 근거만 유지 — 중복 서사로 인한 향후 정정 누락 위험 축소
4. spec 6파일의 `CONTAINER_*` 서술 정정([SPEC-DRIFT])은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 해당 항목을 planner 턴에서 집행 — `3-loop.md:189-191` 형태 통일 또는 `3-error-handling.md §1.4` backfill 중 택일
5. (운영 참고) 이 PR 종결 전, 문서화 리뷰어가 관측한 병행 세션의 미커밋 뮤테이션(`SOURCE_ROOTS`)이 워크트리에 잔존하지 않는지 재확인

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 완료
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, = 실행 전원). forced 화이트리스트 미이행 없음
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 범위(문서 정정 + 테스트 전용 정적 스캐너)에 성능 영향 표면 없음 |
  | architecture | router 판단 — 프로덕션 아키텍처 변경 없음 |
  | dependency | router 판단 — 의존성/패키지 변경 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 관련 런타임 코드 변경 없음 |
  | api_contract | router 판단 — API 계약 변경 없음 |
  | user_guide_sync | router 판단 — 유저 가이드 정합성은 documentation/requirement 축이 커버 |