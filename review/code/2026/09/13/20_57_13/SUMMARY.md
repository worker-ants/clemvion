# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 코드 변경은 테스트/문서 인프라 2파일 + 가이드 문장 2건 정정으로 한정. Critical 0건, WARNING 2건(둘 다 테스트/문서 국소 결함, 기능 영향 없음) + SPEC-DRIFT 1건(developer 권한 밖, planner 위임 필요). Forced whitelist(7명) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | "카탈로그 탈출구" 필터(`.filter((t) => !catalogCodes.has(t))`)가 실제 offender 판정 체인에서 뮤테이션(해당 줄 삭제)돼도 71/71 GREEN 유지 — 회귀 테스트 보호가 없음을 직접 실측(원복 완료). `[한계]`/`[대조군]` 테스트는 offender 계산과 분리된 병렬 구현이라 실제 코드 경로 변경을 감지하지 못함 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:192-199` (대비: `:326-340`) | `computeNonEmittedOffenders(tokens, prefixOnly, catalogCodes, registered)` 같은 정본 함수를 `guide-identifier-scan.ts` 에 추출해, 베이스라인 테스트와 대조군 테스트가 동일 함수를 호출하도록 통일 |
| 2 | documentation | 신규 JSDoc이 함수 개명 이력을 자기모순으로 서술 — "**`staleGuideEntries` 로 이름을 바꿨다** — 첫 판은 `staleGuideEntries` 였는데"(원래 이름은 `staleEntries` 여야 문장이 성립). 같은 배치의 `plan/in-progress/error-code-emission-axis.md:317` 은 정확히 서술해 코드 JSDoc과 plan 서술이 갈림 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:66` | "첫 판은 `staleGuideEntries` 였는데" → "첫 판은 `staleEntries` 였는데" 로 한 단어 정정 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] 이번에 정정된 가이드 서술("메시지 접두일 뿐 전용 에러 코드 아님")이 이제 spec 6개 파일의 "CONTAINER_* 에러로 실행 실패" 서술과 어긋남. 이는 이번 배치가 만든 결함이 아니라, 가이드만 실측(코드가 `.code` 없이 메시지 접두만 발행)에 먼저 맞춰지면서 기존 spec-코드 간극이 spec-가이드 간극으로 드러난 것. developer 권한 경계상 이번 배치는 spec 을 건드리지 않았고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 미체크(`- [ ]`) 항목으로 이미 planner 위임 완료 | `spec/5-system/4-execution-engine.md:331-332` (§3.0) 외 5개 — `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` | `project-planner` 가 `plan/in-progress/spec-draft-nullable-notation-followups.md:3427,3448` 의 미체크 항목을 통해 위 6개 spec 파일을 "메시지 접두이며 구조화 코드 아님"으로 정정(또는 §1.4 카탈로그 backfill 대안 확정). `spec/4-nodes/1-logic/3-loop.md:189-191` 이 이미 올바른 선례(발행 문자열 전문 인용) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `GUIDE_NON_EMITTED_VOCABULARY.where` 필드가 산문 설명과 구조화된 위치 참조(`file.ts:line[·line...]`)를 한 문자열에 섞어, 전용 미니 파서(`parseWhereRefs`)와 그 대조군 4건을 요구 | `guide-identifier-scan.ts:333-354`, `guide-identifier-existence.test.ts:54-61,271-284` | 급하지 않음 — 등록이 늘거나 표기 형식을 다시 손댈 때 `refs: {file, line}[]` 구조화 필드 분리 고려 |
| 2 | testing | `EXTERNAL_VOCABULARY_CAP`/`NON_EMITTED_VOCABULARY_CAP` 이 "같은 값" 이라는 주석상 불변식을 단언이 강제하지 않음 | `guide-identifier-existence.test.ts:21-27` | `expect(NON_EMITTED_VOCABULARY_CAP).toBe(EXTERNAL_VOCABULARY_CAP)` 추가 또는 상수 통합 |
| 3 | testing | `where` 파싱 검증의 `hits.length !== 1`(다중/부재 파일) 분기가 현재 코퍼스·합성 테스트 어느 쪽으로도 도달하지 않음 | `guide-identifier-existence.test.ts:254-258` | 낮은 우선순위 — 존재하지 않는 파일명을 가리키는 합성 `where` 로 겨누는 테스트 추가 고려 |
| 4 | requirement | `spec/conventions/user-guide-evidence.md §2`(Build-time 가드 표)에 `guide-identifier-existence.test.ts` 미등재 — 이번 PR 이전부터 있던 선재 상태 | `spec/conventions/user-guide-evidence.md:68-76` vs `PROJECT.md:300` | 이번 PR 범위 밖 — 별도 트래커 항목 등재 고려 |
| 5 | requirement | `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 모두 토큰 중복 등록을 막는 유일성 검사 없음(항목 수 적어 실질 위험 낮음) | `guide-identifier-existence.test.ts:112,120-121` | 목록이 커지면 유일성 단언 추가 고려 |
| 6 | requirement | `where` 위치 검증이 `codebase/backend/src` 로만 스코프 고정, `packages` 미검증(현재 등록 3건 전부 backend/src 안이라 문제 없고 fail-safe) | `guide-identifier-existence.test.ts:203` | 조치 불필요 — JSDoc 한 줄로 스코프 한계 명시 고려 |
| 7 | maintainability | 라운드 1~4 이월 항목(4라운드 연속, 변화 없음): `collectMatches` 호출부 capture-group 인덱스 매직넘버 · vacuity 하한 리터럴 이름 없음 · `matchAll` vs 수동 `lastIndex` 관용구 공존(의도적 유예 명시됨) · `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 유사 이름(JSDoc 대조표로 완화) · `where` 검증이 항목마다 `walkTree` 재호출(상한 5로 억제) | `guide-identifier-scan.ts:260,263,266,300,333`, `guide-identifier-existence.test.ts:228-229,233-269,404-405` | 조치 불필요 — 실질 위험 낮음, 회귀 시 대조군이 방어 |
| 8 | scope | `review/code/**`·`review/consistency/**` 산출물 90여 개(4 ai-review + 5 consistency-check 라운드)가 diff 부피 대부분을 차지 — CLAUDE.md 지정 정식 저장 위치이며 각 라운드가 실질 결함을 발견·수정한 수렴 과정으로 확인됨 | `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32}/**`, `review/consistency/2026/09/13/{...}/**` | 조치 불필요 — 다음 사람 혼동 방지 위해 매 라운드 서두에 "실질 코드 변경 파일 목록" 명시하는 관례 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | 사실주장(가이드 정정 근거) 5갈래 실측 전수 일치. SPEC-DRIFT 1건(6개 spec 파일, planner 위임 완료) |
| maintainability | LOW | `where` 필드 구조 개선 여지(INFO), 이전 라운드 이월 저위험 항목 다수(변화 없음) |
| testing | LOW | 카탈로그 탈출구 필터가 실제 offender 로직에서 뮤테이션에 무방비(WARNING, 71/71 GREEN 생존 실측) |
| documentation | LOW | JSDoc 자기모순 오타 1건(WARNING) — 개명 전 이름을 잘못 인용 |
| security | NONE | 코드 변경은 테스트/스캐너 전용, 프로덕션 런타임 미접촉. ReDoS·경로조작·시크릿 노출 없음 |
| scope | NONE | 실질 코드 변경 4파일이 plan 목표와 1:1 대응, 스코프 이탈 없음 |
| side_effect | NONE | 라운드4 수정(로컬 함수 개명+JSDoc 재배치)은 순수 리팩터, 실행 경로·시그니처·인터페이스 영향 없음 |

## 발견 없는 에이전트

- **security** — ReDoS 안전성(정규식 구조 확인)·경로 조작 벡터 없음(파일명만 비교)·하드코딩 시크릿 없음을 확인, 위험도 NONE. 실질적 문제 제기 없음.
- **scope** — 실질 코드 변경이 plan 목표 범위와 정확히 일치함을 확인, 위험도 NONE. 스코프 이탈·불필요한 리팩토링·무관한 변경 없음.
- **side_effect** — 라운드4 증분(개명·주석 이동)이 실행 코드 변경 없는 순수 리팩터임을 확인, 위험도 NONE. 상태/파일시스템/네트워크/시그니처 부작용 없음.

## 권장 조치사항

1. (WARNING #1) `computeNonEmittedOffenders` 정본 함수를 `guide-identifier-scan.ts` 에 추출해 베이스라인 테스트와 `[한계]`/`[대조군]` 테스트가 동일 로직을 공유하도록 통일 — 카탈로그 탈출구가 실제로 발화하는 시점(§1.4 backfill 이후) 이전에 회귀 안전망을 확보.
2. (WARNING #2) `guide-identifier-existence.test.ts:66` JSDoc의 "첫 판은 `staleGuideEntries` 였는데"를 "첫 판은 `staleEntries` 였는데"로 정정.
3. (SPEC-DRIFT) `project-planner` 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 관련 미체크 항목을 통해 `spec/5-system/4-execution-engine.md §3.0` 외 5개 spec 파일을 "메시지 접두이며 구조화 코드 아님"으로 정정.
4. (INFO, 선택) `EXTERNAL_VOCABULARY_CAP`/`NON_EMITTED_VOCABULARY_CAP` 동일성 단언 추가 — 저비용 안전장치.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 전원 — 이번 실행분과 동일. 전원 결과 확보됨, 누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(정적 스캐너/테스트 전용)에 성능 관련 표면 없음으로 제외(구체 사유는 원본 라우팅 결정 파일 참조) |
  | architecture | router 판단 — 아키텍처 변경 없음으로 제외 |
  | dependency | router 판단 — 의존성 매니페스트 변경 없음으로 제외 |
  | database | router 판단 — DB 접근 코드 변경 없음으로 제외 |
  | concurrency | router 판단 — 동시성 코드 변경 없음으로 제외 |
  | api_contract | router 판단 — API 계약 변경 없음으로 제외 |
  | user_guide_sync | router 판단 — 가이드 동기화 표면 변경 없음으로 제외(단, requirement/documentation 이 가이드 문장 정정 자체는 교차 검증함) |