# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `extractLinks()` 멀티라인 링크 매칭 수정 자체는 정확하고 테스트도 탄탄하지만, 같은 커밋이 `plan/in-progress/harness-review-gate-followups.md` 에 추가한 "해소" 예시 문구가 **바로 이 PR 이 고치는 그 가드**(`plan-frontmatter.test.ts` → `findBrokenPlanLinks`, build-blocking)를 새로 RED 로 만든다 — 실측 재현 완료(`requirement` reviewer). forced whitelist(8명) 전원 결과가 확보되어 있어 이 Critical 이 누락 없이 반영됨을 확인함.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `plan/in-progress/harness-review-gate-followups.md` 의 새 예시 문구 `` [a]`code`(b) `` 가 인라인 코드 마스킹 규칙에 의해 빈 코드스팬 2개+코드스팬 1개로 소비되고, 남은 텍스트가 `[a](b)` 링크를 새로 만든다. 이 파일은 top-level `plan/in-progress/*.md` 라 `findBrokenPlanLinks`(target filter 없음) 스코프에 들어가 `b` 파일 부재로 DEAD 판정 — `vitest run plan-frontmatter.test.ts` 실측 RED 확인. `spec-impl-evidence.md` 가 이 테스트를 build 차단으로 명시하므로 이 상태로는 PR 이 자기 자신의 빌드를 깬다. | `plan/in-progress/harness-review-gate-followups.md:100` | 예시 문구를 펜스 코드블록(` ``` `)으로 감싸거나, 대괄호/괄호 인접이 재현되지 않도록 문구를 바꾼다(예: 폭이 다른 문자로 대체). 이후 `vitest run plan-frontmatter` 로 GREEN 재확인 필수. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | maintainability | `extractLinks` 한 함수가 사전필터·마스킹+줄매핑 생성·오프셋 테이블 계산·정규식매칭+이진탐색 4단계를 모두 수행 — 함수 길이 15줄→57줄로 증가, 개별 단계 단위테스트 불가 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:131-187` | `buildMaskedLines()`/`lineForOffset()` 등으로 마스킹·오프셋계산·이진탐색을 분리해 각 단계를 이름 있는 단위로 독립 테스트 가능하게 한다 |
| 3 | maintainability | 펜스 경계 줄과 펜스 내부 줄 분기가 완전히 동일한 3줄(`masked.push("]"); srcLineOf.push(i+1); continue;`)을 반복 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:145-153` | `isFenceLine` 변수로 조건을 병합해 중복 제거 |
| 4 | testing | 한 문서 안에 멀티라인 링크가 **2개 이상**일 때 각 매치가 올바른 원본 줄에 귀속되는지 고정하는 회귀 테스트가 없음. 리뷰어가 로직을 저장소 밖에서 복제해 프로브한 결과 현재는 정확하나(2개 링크/혼재/3줄 스팬 모두 정상), 이 사각지대는 과거에도 두 번 실측으로 드러난 이력이 있어 향후 off-by-one 회귀가 침묵 통과할 위험 | `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:274` 이하 (모든 `it` 이 문서당 링크 1개만 다룸) | "한 문서에 멀티라인 링크 2개" 및 "단일라인 뒤 멀티라인 혼재" 케이스를 회귀 테스트로 추가 |
| 5 | documentation | `MdLink.line`(및 `LinkViolation.line`) 의 의미가 "그 줄"에서 "링크가 **시작한** 줄"로 바뀌었고 `raw` 도 개행을 포함할 수 있게 됐는데, 인터페이스 선언 자체에는 이 계약 변경이 문서화되어 있지 않음(구현부 인라인 주석에만 존재) | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:74` (`MdLink` 인터페이스) | `line`/`raw` 필드 옆에 한 줄 주석으로 새 계약(멀티라인 시 첫 줄 보고, raw 에 개행 포함 가능)을 명시 |
| 6 | documentation | `plan/in-progress/harness-review-gate-followups.md` 최상단 "현재 상태(2026-08-11 갱신)" 요약이 "재남는 이유는 셋" 이라 서술하는데, 이번 diff 로 그 중 하나로 추정되는 항목(2026-08-11 실측 추가분)이 `[x]` 로 해소 처리되면서도 상단 개수/사유 목록은 갱신되지 않아 다음 독자가 혼동할 소지 | `plan/in-progress/harness-review-gate-followups.md:23-38` (요약) vs `:46` (해소 처리된 항목) | 상단 요약에 이번 해소 사실을 반영하거나, 해당 항목이 "셋" 중 무엇과 관련되는지(혹은 별개인지) 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 7 | security | 링크 타깃 경로 해석(`path.resolve`+`existsSync`)이 상위 디렉터리 이탈을 정규화/화이트리스트하지 않음. 다만 입력이 저장소 자신의 신뢰된 markdown 이고 노출 결과도 존재 여부뿐이라 현재 스코프에서 실질 위험 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` `findBrokenLinksInFiles` (~292행, 미변경) | "신뢰된 in-repo markdown 전용, 사용자 제출 콘텐츠 재사용 금지" 주석 명시 권장 |
| 8 | security | 신규 `LINK_RE`(`[^\]]*`/`[^)\n]+`)는 중첩 정량자 없어 ReDoS 위험 없음 — 확인 목적 기록 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:82` | 조치 불요 |
| 9 | security | 테스트 픽스처의 `mkdtempSync`/`rmSync` 사용은 예측불가 유일 경로+자기 디렉터리만 삭제라 TOCTOU/경합 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` | 조치 불요 |
| 10 | performance | 파일당 `masked`/`srcLineOf`/`startOf` 배열 + 재조립 문자열 `body` 추가 할당으로 피크 메모리가 대략 2~3배 증가. 다만 사전필터 통과율(11.9%)과 통상 파일 크기 고려 시 실질 영향 미미 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:131-187` | 조치 불요. 향후 훨씬 큰 생성 파일까지 스캔 범위가 확장되면 재검토 |
| 11 | performance | 매치→원본 줄 역산에 이진 탐색(O(log L)) 도입 — 적절한 복잡도, 선형 탐색 대비 개선 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:176-183` | 조치 불요 |
| 12 | performance | `regex.exec` 호출이 파일당 1회로 줄어 정규식 setup 오버헤드 감소 — 정확성 수정의 부수 개선 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:168-185` | 조치 불요 |
| 13 | scope | 워크트리 슬러그(`eslint10-upgrade`)와 실제 작업 주제(spec-link 멀티라인 매칭 수정)가 불일치. 코드 diff 자체는 eslint10 관련 변경 0건으로 scope 위반은 아님 | `.claude/worktrees/eslint10-upgrade-5e3cf9/` (인프라 메타데이터) | 조치 불요(정보성). 워크트리 재사용 시 plan frontmatter `worktree` 필드와의 정합 점검 권장 |
| 14 | side_effect | `extractLinks()` 반환값 계약이 넓어져(멀티라인 포착) 상위 4개 공개 가드 함수 모두 더 많은 링크를 검사하게 됨 — 의도된 변경이며 plan 문서에 뮤테이션+라이브 트리 전수 GREEN 근거 기록됨 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:131` | 조치 불요 |
| 15 | side_effect | 모듈 스코프 공유 가변 정규식 `LINK_RE`(`g` 플래그)의 `lastIndex` 상태 — 현재 동기 순차 호출 패턴에서는 안전, 향후 병렬/재진입 호출 시에만 잠재 리스크 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:82` | 병렬화 도입 시에만 재검토 |
| 16 | maintainability | 마스킹 결과를 `masked`/`srcLineOf`/`startOf` 세 병렬 배열로 관리 — 인덱스 동기화가 암묵적 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:139-166` | 단일 객체 배열(`{text, srcLine, start}[]`)로 통합 고려. 함수 분리(발견 #2) 시 자연히 캡슐화 가능 |
| 17 | testing | 멀티라인 링크가 ANCHOR(자기참조/교차파일 앵커 불일치) 위반으로 잡히는 통합 경로가 테스트되지 않음(DEAD 경로만 고정) | `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:334-348` | ANCHOR kind 경로도 멀티라인 입력으로 한 번은 통과시키는 케이스 추가 |
| 18 | testing | `mkMultiLink` 헬퍼가 2줄 스팬만 생성 — 3줄 이상 스팬은 회귀 테스트로 고정되지 않음(리뷰어 프로브로 현재 정확함은 확인) | `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:288-290` | 우선순위 낮음. 여유 시 3줄 스팬 케이스 추가 |
| 19 | documentation | (긍정 관찰) JSDoc·인라인 주석·plan 뮤테이션 근거 표 등 문서화 수준이 전반적으로 높음. README/spec 문서 drift 없음(공개 API 계약 불변, 상위 spec 은 알고리즘 세부 언급 안 함) | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 경로 정규화 부재(INFO), ReDoS 없음, 테스트 픽스처 안전 |
| performance | NONE | 메모리 소폭 증가는 무시 가능, 이진탐색·exec 호출 감소는 개선 |
| requirement | **CRITICAL** | plan 예시 문구가 `plan-frontmatter.test.ts` 를 RED 로 만듦(build 차단) — 실측 재현 완료 |
| scope | NONE | 3파일 모두 단일 결함 수정에 직결, 무관한 변경 없음. 워크트리 이름 불일치는 INFO |
| side_effect | NONE | 함수 계약 확장은 의도적이고 근거 기록됨, 전역상태/네트워크/env 변경 없음 |
| maintainability | LOW | `extractLinks` 책임 과다(WARNING), 펜스 분기 중복(WARNING), 병렬 배열 패턴(INFO) |
| testing | LOW | 2개 이상 멀티라인 링크 회귀 테스트 부재(WARNING), ANCHOR 경로·3줄 스팬 미테스트(INFO) |
| documentation | LOW | `MdLink.line`/`raw` 계약 변경 미문서화(WARNING), plan 상단 요약 stale 가능성(WARNING) |

## 발견 없는 에이전트

없음 (8개 에이전트 전원 최소 1건 이상 발견 — NONE 위험도 에이전트도 INFO 급 관찰 보고).

## 권장 조치사항

1. **[최우선]** `plan/in-progress/harness-review-gate-followups.md:100` 의 예시 문구를 펜스 코드블록으로 감싸거나 재작성해 `plan-frontmatter.test.ts` RED 를 해소하고, `vitest run plan-frontmatter` 로 GREEN 재확인 후 커밋한다 (requirement CRITICAL).
2. `extractLinks()` 를 마스킹/오프셋계산/이진탐색 단계로 분리하고 펜스 분기 중복을 병합한다 (maintainability WARNING #2, #3).
3. 한 문서에 멀티라인 링크가 2개 이상인 경우와 단일라인+멀티라인 혼재 케이스를 회귀 테스트로 추가한다 (testing WARNING #4).
4. `MdLink.line`/`raw` 인터페이스 선언에 새 계약(멀티라인 시 첫 줄 보고, 개행 포함 가능)을 한 줄 주석으로 명시한다 (documentation WARNING #5).
5. `plan/in-progress/harness-review-gate-followups.md` 상단 "현재 상태" 요약을 이번 해소 사실과 동기화한다 (documentation WARNING #6).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨 (forced 이행 완료, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 diff 와 무관 (기존 아키텍처 구조 변경 없음) |
  | dependency | 의존성/패키지 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 (순수 동기 함수) |
  | api_contract | 외부 API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음 |
