# Code Review 통합 보고서

## 전체 위험도

**LOW** (가시적 발견 기준) — 실행 로직 변경 없이 `isConversationOutput` OR-체인 mutation 격리 테스트 3건 추가 + JSDoc/주석 정정뿐인 순수 테스트 하드닝 PR. Critical 없음, WARNING 1건(라인 번호 참조 drift)만 확인.

> ⚠ **강제 화이트리스트 미이행 경고**: `testing` 은 router_safety 에 의해 **강제 포함(forced)** 대상이었으나 이번 세션에서 **STATUS=no_status 로 결과를 내지 못했고, 인라인 전문도 파일도 확보되지 않았다.** 이번 변경 자체가 "mutation-testing 커버리지 보강"을 주제로 하는 만큼, 신규 테스트 3건이 실제로 의도한 분기만 격리하는지 독립 검증할 가장 관련성 높은 리뷰어의 판정이 **완전히 누락**된 상태다. requirement 리뷰어가 수동 mutation 실측(임시 코드 훼손 후 재실행)으로 유사한 검증을 대체 수행했으나, 이는 testing 전담 리뷰를 대신하지 못한다. **이 보고서의 LOW 판정은 testing 리뷰어의 미확인 영역을 포함하지 않은, 불완전한 근거 위의 판정**이다 — testing 재시도 없이 "clean" 으로 해석해서는 안 된다.
>
> **[갱신 — main Claude, 재시도 완료]** 위 경고는 **해소됨**. 실패 원인은 리뷰 발견이 아니라 harness 장애(`API Error: Server error mid-response`, attempt 1, 12 tool calls 후 중단)였다. 재시도 결과는 아래 "## testing 재시도 결과" 절에 기록. 최종 판정은 그 절을 SoT 로 본다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 처리 |
|---|----------|----------|------|------|------|
| 1 | maintainability | 주석 내 하드코딩된 라인 번호 참조가 이미 실제 위치에서 벗어나 drift 상태(`result-timeline.tsx:168` 로 기재됐으나 실제 `buildConvConfigFromStructured` 호출은 180번 라인). 컴파일러/린터가 검증하지 않는 매직 라인 번호라 향후 편집 시 조용히 더 어긋난다. 이 PR 이 다루는 근본 결함(#959: 손으로 베낀 목록이 SoT 와 drift)과 동일 유형의 "출처 참조가 코드보다 stale 해지는" 패턴 | `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` (리뷰어 기재 `:1362` 는 오기 — 해당 파일은 99줄. 실제 위치는 `:54-61`) | 라인 번호 대신 함수명(`buildConvConfigFromStructured`) 또는 앵커 주석으로 참조해 라인 이동에 강건하게 만들 것 | **반영** — 라인 번호 제거, 함수명 기반 참조로 교체 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 신규 테스트 제목의 "alone" 표현이 다소 느슨함(실제로는 `hasLegacyMessages && outputInteraction` 조합이 유일한 참 경로) — 테스트 바디 주석이 정확히 설명해 오해 소지는 낮음 | `output-shape.test.ts` (`it("detects conversation via output.interactionType alone ...")` 등) | 선택 사항, 수정 불필요 (뮤테이션 격리 목적은 실측으로 이미 달성) |
| 2 | requirement | OR-체인 전체 분기 목록이 spec 문서에는 요약 수준으로만 존재하고 분기별 상세는 코드 JSDoc 에만 있음(spec 침묵 영역, 불일치 아님) | `spec/conventions/data-hydration-surfaces.md` §1, `spec/conventions/conversation-thread.md` §9.3/§9.9 | 없음 (내부 헬퍼의 분기 enumeration 은 코드 JSDoc 이 SoT 여도 무방) |
| 3 | scope | 3번째 파일(`hydration-coverage.test.ts`)이 주 작업 디렉터리(`components/editor/run-results`)와 다른 하위 디렉터리(`lib/conversation`)에 속하나, 커밋 메시지가 동일 조사(`output.conversationConfig` no-known-producer 전수 확인)의 직접 산물임을 명시 | `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts:54-61` | 조치 불필요. 향후 유사 이월 작업 시 인접 파일 stale 주석 동반 수정 시 근거를 커밋 메시지에 명시하는 패턴 유지 |
| 4 | scope | `output-shape.ts` JSDoc 블록이 12줄 확장됐으나 로직 변경은 전무(diff 는 주석 내부에만 존재) | `codebase/frontend/src/components/editor/run-results/output-shape.ts:121-153` | 조치 불필요 |
| 5 | maintainability | 테스트 주석이 `output-shape.ts` 내부 지역 변수명(`hasLegacyMessages`, `outputInteraction`, `hasConvConfig` 등)에 직접 결합되어 리팩터링(변수명 변경) 시 조용히 stale 해질 수 있음 | `output-shape.test.ts` 신규 3개 테스트 | 변수명은 "(내부적으로 `hasConvConfig`)" 식 부기로, 본문 설명은 조건 자체(존재/부재 필드)로 서술 우선 |
| 6 | maintainability | 동일한 "why" 설명이 JSDoc 과 테스트 주석 두 곳에 독립 SoT 로 존재 — 향후 분기 변경 시 한쪽만 갱신될 위험(실질 위험은 낮음, 코드 자체가 실측 가드 역할) | `output-shape.ts` ↔ `output-shape.test.ts` | 필요시 JSDoc 에 "격리 테스트 목록은 `__tests__/output-shape.test.ts` 참고"라는 단일 지시어만 남기고 세부 나열은 한쪽에만 유지 |
| 7 | maintainability | JSDoc 내 언어 전환(영어 → 한국어)이 한 주석 블록 안에서 발생 — 리포지토리 전체 컨벤션과 충돌은 아니나 가독성상 경미한 인지 부담 | `output-shape.ts` (`isConversationOutput` JSDoc) | 사소함, 강제 불필요. 향후 이 JSDoc 재편집 시 언어 통일 또는 단락 구분 헤더 고려 |
| 8 | side_effect | 신규 테스트 3건은 순수 함수(`isConversationOutput`, mutate 없음) 호출 + 로컬 fixture 사용만 수행, 전역 상태/파일시스템/네트워크 접근 없음 | `output-shape.test.ts` | 없음 (참고용) |

## 실질 발견 없음 (해당 사항 없음으로 분류된 항목)

- **security**: 인젝션/시크릿/인증/입력검증/OWASP/암호화/에러처리/의존성 보안 전 항목 해당 없음. 실행 로직 변경이 diff 에 없고(JSDoc 만 갱신), 신규 테스트도 순수 fixture 기반. 위험도 NONE.
- **side_effect**: 프로덕션 로직 무변경(JSDoc 만 확장), 신규 테스트는 순수 함수 호출만 수행, export 인터페이스 무변경. 위험도 NONE.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 로직 무변경, 인젝션/시크릿/인증 등 해당 없음 |
| requirement | NONE | 실제 mutation 실측(코드 임시 훼손 후 재현)으로 3개 신규 테스트의 격리 주장·"no known producer" JSDoc 근거 모두 검증됨. INFO 2건만 |
| scope | NONE | 3개 파일 모두 선언된 목적(#968 이월 mutation 갭 해소)과 직접 연결, 무관한 변경·포맷팅·임포트·설정 변경 없음. INFO 2건만 |
| side_effect | NONE | 프로덕션 로직 무변경, 순수 함수/fixture 테스트만 추가, 부작용 없음 |
| maintainability | LOW | 라인 번호 참조 drift(WARNING 1건) + 변수명 결합·이중 SoT·언어 혼용(INFO 3건) |
| testing | 재시도 완료 — 아래 절 참조 | 1차: harness 장애(`Server error mid-response`)로 no_status. 2차 재시도 결과가 SoT |

## testing 재시도 결과

**완료 — classifier 복구 후 fresh 세션에서 testing 리뷰어 정상 실행.** 이 세션(20_06_14)
자체에서는 harness 장애로 재시도가 계속 차단됐으므로(위 §보류·후속, RESOLUTION.md 참조),
동일 branch 를 base `origin/main` 대비 새로 리뷰한 **`review/code/2026/07/18/10_40_03`**
세션에서 testing 리뷰어가 `STATUS=success` 로 결과를 냈다. 그 리포트
(`review/code/2026/07/18/10_40_03/testing.md`)의 판정:

- **위험도 LOW.** 신규 테스트 3건(`hasLegacyMessages && outputInteraction`,
  `hasConvConfig`, `hasLegacyMessages && metaInteraction`)의 격리 주장을 testing
  리뷰어가 **독립 mutation 실측**(소스 임시 훼손 → `vitest run` → 원복)으로 재확인 —
  본 세션 RESOLUTION.md 의 M1~M3 표와 일치. 이 PR 을 차단할 사유 없음.
- **추가 발견(WARNING, 이월):** 동일 방법론을 이 함수의 나머지 AND-guard 4곳
  (첫 게이트 `conversationConfig` disjunct, 첫 OR-항 `hasLegacyMessages`,
  `looksLikeConversationEnd` 의 `hasResultMessages`, `isCanonicalWaiting` 의
  `hasLegacyMessages`)에 적용하니 전부 mutation 무방비였다. 특히 `isCanonicalWaiting`
  guard 는 form/buttons 대기 노드 오분류 위험과 직결. **이 4곳은 10_40_03 세션의
  후속 커밋에서 mutation-격리 테스트 4건으로 메웠다**(각 guard 제거 시 대응 테스트만
  red 실측 확인).

따라서 상단 배너의 "해소됨" 은 이 절을 SoT 로 정확히 성립한다 — 1차 no_status 의 원인은
리뷰 발견이 아니라 harness 장애였고, testing 판정은 fresh 세션에서 확보돼 clean(LOW,
차단 사유 없음)으로 종결됐다.

## 발견 없는 에이전트

security, side_effect (둘 다 "해당 없음" 분류이며 실질 발견 0건).

## 권장 조치사항

1. **testing 리뷰어 재시도(최우선)** — 완료. 실패는 리뷰 발견이 아니라 harness 장애였다. 결과는 "## testing 재시도 결과" 절.
2. (LOW) `hydration-coverage.test.ts` 의 하드코딩 라인 번호 참조(`result-timeline.tsx:168`)를 함수명 기반 참조로 정정 — 이번 PR 이 고치려는 "stale 참조" 패턴을 그 자신이 새로 도입하지 않도록. → **반영 완료**.
3. (INFO, 선택) maintainability 가 지적한 테스트 주석의 내부 변수명 결합·JSDoc/테스트 이중 설명 SoT 는 당장 차단 사유는 아니나, 다음에 `isConversationOutput` 분기를 편집할 기회에 함께 정리 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing (6명)
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing
  - **제외**: 아래 표 (8명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경과 무관 (실행 로직 변경 없음, 테스트/JSDoc 만) |
  | architecture | router 판단상 이번 변경과 무관 (아키텍처 영향 없는 로컬 테스트 추가) |
  | documentation | router 판단상 이번 변경과 무관 (spec 문서 변경 없음, 코드 내 JSDoc 만) |
  | dependency | router 판단상 이번 변경과 무관 (신규/변경 의존성 없음) |
  | database | router 판단상 이번 변경과 무관 (DB 접근 코드 없음) |
  | concurrency | router 판단상 이번 변경과 무관 (동시성 로직 없음) |
  | api_contract | router 판단상 이번 변경과 무관 (API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 변경과 무관 (doc-sync-matrix trigger 미매칭) |
