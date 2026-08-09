# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — Critical 은 없다. 가장 높은 개별 위험도는 side_effect 의 MEDIUM(gray-matter 프로세스-전역 캐시 오염 hazard, 실측 확인)이며, 이 밖에 WARNING 6건(유지보수성 컨벤션 위반 2건, 테스트 갭 2건, 문서 stale 근거 1건, 캐시 hazard 1건)이 있다. `forced` 화이트리스트(maintainability/requirement/scope/security/side_effect/testing) 전원 결과가 확보되어 있고, 강제 대상 중 결과 누락은 없다 — 위 MEDIUM 은 이 forced 목록 안의 side_effect reviewer 가 실제로 발견한 항목이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용/데이터무결성 | `findNonTerminalCompletedPlans` 가 gray-matter 의 프로세스-전역 캐시(`matter.cache`) 회피 옵션(`{}`)을 누락 — 같은 파일의 `checkPlanFrontmatter` 는 명시적으로 방어한 바로 그 hazard. `gray-matter@4.0.3` 소스 확인 결과, 파싱 throw 시 부분 상태가 캐시에 남아 동일 content 재파싱이 조용히 다른 결과(`data=undefined`)를 반환한다. `spec-plan-completion.test.ts:93,114` 가 같은 `plan/complete/**` 트리를 옵션 없이 재파싱해 크로스파일 캐시 오염 경로가 실재함을 확인(현재는 두 소비자 모두 결과가 우연히 skip 으로 수렴해 관측 가능한 버그는 없음) | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:124` (vs 방어 예시 `:220-226`) | `matter(fs.readFileSync(f.absPath, "utf8"), {})` 로 통일해 캐시 우회. `spec-plan-completion.test.ts` 도 동일 정정 검토 |
| 2 | 유지보수성 | 디렉터리 트리 워커(stack 기반 DFS + 스킵판정 + 파일필터 + sort) 골격이 3벌로 중복 — 이 PR 이 스스로 "walker 가 조용히 어긋난다" 고 지목한 문제의식을 절반만 해소(plan 트리 walker 2벌은 통합했으나 spec/codebase 소스 walker 2벌은 미통합) | `plan-scan.ts:53`(`walkPlanMarkdown`), `spec-links.ts:132`(`collectSpecMarkdown`), `spec-links.ts:335`(`collectCodebaseSources`) | 공유 `walkFiles(roots, {skipDir, include})` 헬퍼로 통합하거나, 최소한 `plan-scan.ts` 헤더 주석에 "spec-links.ts 의 두 walker 는 아직 미통합" 을 명시해 오독 방지. `plan/in-progress/docs-guard-walker-dedup.md` 범위에 포함 검토 |
| 3 | 문서화/컨벤션 | `findBrokenPlanLinks` JSDoc 이 이 PR 스스로 못박은 "코드 주석은 현재 규칙만 담는다(회고 서사는 커밋/plan 산출물로)" 원칙을 정면으로 위반 — 특정 날짜("Measured 2026-08-09/10")·건수(8/9번째/135)·초안 수정 이력이 영구 주석으로 박제되어 plan grooming 에 따라 stale 해질 위험 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:280-296` (측정 서사), `:296`("135" 수치, 시점 라벨 없음) | 측정 서사·수치는 커밋 메시지/`plan/complete/` 산출물로 이관하고 JSDoc 은 "무엇을·왜 좁게·어떤 예외" 만 유지 |
| 4 | 테스트/데이터유효성 | 공백-only `worktree`/`owner` 값(`"   "`)이 무검사로 통과 — trim 없이 `length === 0` 만 검사. 직접 재현 결과 위반 0건 반환. 이 파일의 존재 이유 자체("살아있지만 죽은 값이 조용히 통과하는 것을 막는다")를 정확히 침해하는 형태이며 해당 분기를 겨눈 fixture 없음 | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:234-242`(worktree), `:249-252`(owner) | `wt.trim().length === 0` / `owner.trim().length === 0` 로 정정 + `plan-scan.test.ts` 에 공백-only 케이스 fixture 추가 |
| 5 | 테스트/스코프 | `plan/complete/**` 하위 디렉터리 이름의 `0-`/`_` 접두가 필터링되지 않음 — `isLifecyclePlan` 은 파일명에만 적용되고 디렉터리 재귀는 `archive` 리터럴만 제외. 직접 재현해 `plan/complete/0-batch/child.md` 가 수집 대상에 포함됨을 확인. 헤더 주석의 "0-/_ 는 인덱스 파일" 서술이 디렉터리에도 적용되는지 어느 fixture 로도 고정되어 있지 않음 | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:66-70`(재귀 분기), `:36-47`(`isLifecyclePlan`) | 의도된 동작이면 pin fixture 추가, 의도가 아니면 디렉터리명도 필터 대상에 포함 |
| 6 | 문서화 | `WORKTREE_PLACEHOLDER` 의 rationale 이 `#576` 으로 이미 폐기된 "plan-coherence 충돌 검출"(cross-worktree 동시 작업 충돌 검토) 메커니즘을 근거로 듦 — 이번에 `plan-scan.ts` 로 신규 추출되면서도 훨씬 이전(#457)부터 남아있던 부정확한 근거를 그대로 복제 | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:140-143`, `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:33-35` | 근거를 현재 유효한 이유(예: `plan_guard.py` 의 worktree↔plan 매칭 무력화 방지, data-hygiene)로 교체하고 `#576` 폐기 이력을 함께 남김 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `rawScalar` 의 동적 `RegExp` 생성이 `key` 를 문자열 보간 — 이론적으로 정규식 인젝션 클래스지만 호출부가 하드코딩 리터럴 키(`"started"`) 1곳뿐이라 현재 악용 불가 | `plan-scan.ts:154` | 향후 동적 키로 확장 시 이스케이프 또는 화이트리스트 관례 고려. 현재 조치 불요 |
| 2 | 성능 | `findNonTerminalCompletedPlans` 가 caller 마다 `plan/complete/**` 전체를 재순회+재파싱, 메모이제이션 없음 | `plan-scan.ts:119` | 여러 가드가 같은 root 를 반복 호출하는 패턴이 늘면 프로세스-스코프 캐시 고려. 현재 규모에서는 불요 |
| 3 | 성능 | `plan-frontmatter.test.ts` 의 두 인접 테스트가 동일 파일 집합에 대해 링크를 두 번(`findBrokenPlanLinks` 내부 + non-vacuity 카운트) 추출 | `plan-frontmatter.test.ts:111-133` | 링크 총 개수를 `findBrokenPlanLinks` 반환값에 포함하거나 결과 공유. 우선순위 낮음 |
| 4 | 아키텍처 | `collectLivePlanMarkdown` 이 `plan-scan.ts`(정의)와 `spec-links.ts`(재-import+재-export) 양쪽에서 노출되어 정본 import 경로가 이원화 | `plan-scan.ts:83`, `spec-links.ts:17,1071` | 재-export 지점에 `@deprecated — import from ./plan-scan` JSDoc 추가 |
| 5 | 문서화/스코프 | `plan-scan.ts` 모듈 헤더가 "158 tests 전량 GREEN 인데 위반 분기가 한 번도 실행되지 않았다" 류의 리뷰 경위·구체 수치를 담아 이 changeset 이 스스로 세운 "코드 주석=현재 규칙만" 원칙과 결이 다름(WARNING #3 과 같은 계열, 다른 파일) | `plan-scan.ts:1-26` | maintainability/documentation 관점에서 "장기 유지 주석 vs 커밋 이력" 기준으로 추가 정리 고려. 차단 사유는 아님 |
| 6 | 부작용 | 모듈 최상위 가변 `g`-플래그 정규식 `LINK_RE` 의 `lastIndex` 상태 공유 — 현재는 매 호출 전 명시적으로 리셋되어 안전하나, 향후 재진입/async 화 시 경합 가능한 footgun | `spec-links.ts:78,95,97` | 리팩터 시 함수-지역 변수 또는 호출마다 새 RegExp 인스턴스 생성 고려 |
| 7 | 유지보수성 | 거의 동일한 frontmatter fixture 빌더(`fm`, `frontmatter`)가 한 테스트 파일에 공존 | `plan-scan.test.ts:28,192` | 통합하거나 두 헬퍼의 관계를 주석으로 명시. 우선순위 낮음 |
| 8 | 유지보수성 | `slugify`/`headingSlugs` 가 "마크다운 파싱→heading 수집" 보일러플레이트를 각자 인라인 반복 | `spec-links.ts:42-48, 51-70` | `parseHeadings(text)` 소헬퍼로 추출 고려. 필수 아님 |
| 9 | 테스트(파이프라인) | 이번 diff 에 포함된 `spec-links.test.ts`(+95라인)가 testing reviewer 페이로드의 "리뷰 대상 파일" 목록에서 누락 — 직접 확인 결과 실제 코드는 `findBrokenPlanLinks` 를 5개 `it` 로 충실히 커버해 코드 자체엔 문제 없음. 프롬프트 조립 로직의 갭 | `_prompts/testing.md` (대상 소스 아님) | orchestrator 의 diff→reviewer 페이로드 매핑이 `*.test.ts` 를 빠짐없이 포함하는지 별도 점검 |
| 10 | 테스트 | non-vacuity 캐너리(`toBeGreaterThan(50)`)가 실저장소 plan 개수/링크 총합에 결속 — 과거 유사 캐너리가 grooming 으로 오탐 이력 있음(주석에 기록됨) | `plan-frontmatter.test.ts` (non-vacuity 테스트) | 즉각 조치 불요, 향후 grooming 으로 마진이 좁아지면 재검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 로컬 vitest 가드, 외부 입력 없음. `rawScalar` 정규식 보간은 INFO(악용 불가) |
| performance | LOW | 반복 호출 시 재계산/재파싱 미메모이즈 INFO 3건, 현재 규모에서 체감 영향 없음 |
| architecture | LOW | plan/spec/codebase walker 3중 구조적 잔여 중복(INFO, WARNING #2 와 동일 대상), export 경로 이원화 |
| requirement | LOW | spec(`plan-lifecycle.md §4`) 대비 3대 불변식 line-level 구현 일치, 978 tests PASS 확인. WARNING 2건(gray-matter 캐시, JSDoc 회고서사) — 위 통합표 #1, #3 과 동일 |
| scope | NONE | 4개 파일 모두 단일 목표로 수렴, 무관 수정/미사용 import/의미없는 포맷팅 없음. INFO 1건(헤더 회고 서사) |
| side_effect | **MEDIUM** | gray-matter 프로세스-전역 캐시(`matter.cache`) 오염 hazard — 실측 검증 및 크로스파일(`spec-plan-completion.test.ts`) 실재 확인. 위 통합표 #1 |
| maintainability | LOW | walker 3중 중복(WARNING), JSDoc 회고 서사(WARNING), 소소한 헬퍼 중복 INFO 다수 |
| testing | LOW | 공백-only worktree/owner 미검사(WARNING), `0-`/`_` 디렉터리 미필터(WARNING), 페이로드 누락 등 INFO |
| documentation | LOW | `WORKTREE_PLACEHOLDER` stale 근거(WARNING), "135" 수치 시점 라벨 부재(INFO) |
| dependency | NONE | package.json/lockfile diff 0줄, 기존 의존성 재사용만, 순환 의존 없음, 프로덕션 번들 영향 없음 |
| database | NONE | DB 관련 코드 전무 |
| concurrency | NONE | 전부 동기 함수, 공유 가변 상태 없음 |
| api_contract | NONE | HTTP/API 계약 요소 전무 |
| user_guide_sync | NONE | doc-sync-matrix 21건 전수 대조 매칭 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync (모두 "해당 없음" — 리뷰 대상 도메인 자체가 부재)

## 권장 조치사항

1. `findNonTerminalCompletedPlans` 의 `matter(...)` 호출에 `{}` 옵션을 추가해 gray-matter 프로세스-전역 캐시 오염 hazard 를 제거한다(WARNING #1, MEDIUM 근거). 가능하면 `spec-plan-completion.test.ts` 도 동일 패턴으로 정정.
2. `worktree`/`owner` 빈 값 검사에 `.trim()` 을 추가해 공백-only placeholder 우회를 막고 회귀 fixture 를 고정한다(WARNING #4).
3. `plan/complete/**` 하위 디렉터리명의 `0-`/`_` 접두 처리 의도를 확인하고, 의도된 동작이면 pin fixture 를, 아니면 필터를 추가한다(WARNING #5).
4. `WORKTREE_PLACEHOLDER` rationale 을 `#576` 폐기 이후에도 유효한 근거로 교체한다(WARNING #6).
5. `findBrokenPlanLinks` JSDoc 의 회고 서사(측정 날짜·건수)를 커밋 메시지/plan 산출물로 옮기고 "현재 규칙"만 남긴다(WARNING #3).
6. 여유가 있으면 `plan-scan.ts`/`spec-links.ts` 사이 디렉터리 워커 3중 중복을 공유 헬퍼로 통합하거나, 최소한 미통합 범위를 헤더 주석에 명시한다(WARNING #2, `docs-guard-walker-dedup.md` 범위 검토).

## 라우터 결정

- `routing=skipped` — 라우터 미사용(사유 미기재), 전체 reviewer 14명 실행(제외 없음).
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음
- **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |