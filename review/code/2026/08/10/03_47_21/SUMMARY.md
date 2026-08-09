# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 5건은 전부 기존 저장소 부채의 확장/정정 성격(성능 낭비, walker 중복, 신규 주석의 근거 오류)이며 배포 차단 사유가 아니다. 강제(forced) reviewer 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음. (requirement.md 는 인라인 전문으로만 도착해 있어 본 요약 작성 중 디스크에 새로 영속화함)

이번 변경은 전부 `codebase/frontend/src/lib/docs/__tests__/` 하위 빌드-타임 docs/plan-lifecycle 가드(vitest)와 `.claude/docs/plan-lifecycle.md` 문서로, 런타임 서비스·API·DB·인증 경로는 전혀 포함하지 않는다. `database`/`api_contract`/`user_guide_sync` 3개 reviewer 는 스코프 밖으로 "발견사항 없음"을 명시적으로 보고했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `extractLinks` 가 마크다운 링크 문법(`](`)이 전혀 없는 소스 파일에도 매번 전체 라인 스캔(펜스 검사+코드스팬 치환+링크 정규식 exec)을 수행. 실측: 대상 2072개 파일 중 `](` 포함 파일은 35개(1.7%)뿐 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:82-106` (`extractLinks`) | `fs.readFileSync` 직후 `if (!text.includes("("))` 같은 값싼 사전 필터로 대부분 파일을 즉시 skip |
| 2 | 아키텍처 | plan-tree walker를 "하나로 합친다"는 PR 목표에도 `spec-plan-completion.test.ts` 의 `collectCompletePlans` 가 `plan-scan.ts` 의 `collectCompletePlanMarkdown` 과 여전히 독립 구현으로 남아 있고, 두 구현이 같은 파일 집합을 반환한다는 것을 강제하는 자동 테스트가 없음("현재 일치"는 수동 실측일 뿐) | `spec-plan-completion.test.ts:59-83` vs `plan-scan.ts:59-96` | `collectCompletePlanMarkdown` 로 교체하거나, 교체가 어려우면 두 구현의 반환 집합 동등성을 검증하는 계약 테스트 1개 추가 |
| 3 | 아키텍처 | gray-matter 캐시 우회 관용구(`matter(raw, {})`)가 파일 경계를 넘어 4곳(plan-scan.ts 2곳 + spec-plan-completion.test.ts 2곳)에 손으로 중복. `spec-links.ts` 가 이미 `plan-scan.ts` 를 SoT 로 import 하는 선례가 있음에도 공유 헬퍼 대신 4번째 복제를 택함 — 5번째 파서 호출 추가 시 `{}` 누락 위험 반복 | `plan-scan.ts:139,249`, `spec-plan-completion.test.ts:97,118` | `plan-scan.ts` 에 `parseFrontmatterSafe(raw): Record<string, unknown> | null` 단일 헬퍼 export, 4개 호출부 전부 교체 (concurrency/side_effect 리뷰어도 동일 패턴을 확인, 현재는 4곳 모두 안전하게 방어돼 있음을 재확인) |
| 4 | 유지보수성 | 디렉터리 트리 DFS 순회 골격이 `spec-links.ts` 내부에서 `collectSpecMarkdown`/`collectCodebaseSources` 두 번 거의 동일하게 반복 — plan 계열 중복(#2)과 달리 이 중복은 어떤 후속 plan 에도 추적되지 않은 상태 | `spec-links.ts:131-152`(`collectSpecMarkdown`), `spec-links.ts:319-343`(`collectCodebaseSources`) | 공유 `walkTree(root, { skipDir, fileFilter })` 헬퍼로 추출 |
| 5 | 문서화 | `spec-plan-completion.test.ts` 신설 주석("이 가드와 `plan-scan.ts` 는 같은 트리를 파싱하므로 서로의 캐시를 밟는다")의 근거가 실측과 다름 — 이 저장소 Vitest 기본 `isolate:true` 하에서 gray-matter 캐시는 테스트 **파일 간에는 공유되지 않는다**(직접 프로브로 반증: 서로 다른 파일에서 같은 깨진 YAML 을 각각 호출 시 둘 다 독립적으로 throw). `{}` 옵션 fix 자체는 옳으나, 진짜 이유는 **같은 파일 안에서** 같은 plan 을 2번(필터 단계+per-plan 단계) 파싱하기 때문 | `spec-plan-completion.test.ts:93-97` | "서로의 캐시를 밟는다" 문구를 "같은 파일 안에서 같은 plan 을 두 번 파싱하므로"로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/유지보수성 | `spec-plan-completion.test.ts` 가 enforced plan 하나당 frontmatter 를 2번(1차 필터+2차 per-plan describe) read+parse. 2차 호출엔 1차와 달리 `try/catch` 가 없어 "캐시가 안전하다"는 불변식에 암묵 의존 | `spec-plan-completion.test.ts:90-103`, `:118` | `readFrontmatterData(abs)` 헬퍼로 1회 파싱 결과를 양쪽에서 재사용 |
| 2 | 테스팅 | `collectCompletePlans`(Gate C sibling walker) 는 자매 함수 `collectCompletePlanMarkdown` 과 달리 negative-path fixture 커버리지가 없음 — `archive/` 제외·`0-`/`_` 인덱스 제외가 실저장소 데이터 우연 형태로만 통과 | `spec-plan-completion.test.ts:59-83` | `plan-scan.test.ts` fixture 재사용해 동일 negative-path 케이스 추가, 또는 WARNING #2 통합을 앞당김 |
| 3 | 테스팅 | `hasValidSpecImpact` 의 `NONE_VALUES` 대소문자/trim/`n-a`/`na` 분기가 fixture 로 검증되지 않음 — `.trim()`/`.toLowerCase()` 를 지워도 스위트가 GREEN 일 가능성(죽은 코드 경로 의심) | `spec-plan-completion.test.ts:25,47-48,171-179` | `"NONE"`, `" none "`, `"n/a"`, `"na"` 케이스 추가 |
| 4 | 테스팅 | `walkPlanMarkdown` 의 `archive/` 제외가 깊이 1 fixture 로만 검증, 깊이 ≥2(`nested/archive/`) 미검증 | `plan-scan.ts:74`, `plan-scan.test.ts:44` | `plan/complete/nested/archive/deep.md` 케이스 추가(선택) |
| 5 | 요구사항 | `findFrontmatterViolations` 가 export 되지만 실제 production 가드(`plan-frontmatter.test.ts`)는 이를 쓰지 않고 `checkPlanFrontmatter` 를 필드별로 직접 호출 — 기능 결함 아니나 존재 이유가 코드만으론 불분명 | `plan-scan.ts:283`, 유일 소비처 `plan-scan.test.ts:302` | JSDoc 에 "convenience wrapper, production guard 는 필드별 인라인 사용" 한 줄 추가(선택) |
| 6 | 아키텍처 | Gate C 의 순수 판정 함수(`isGateCEnforced`/`hasValidSpecImpact`)가 이번 PR 이 다른 로직에 적용한 "SoT 모듈로 추출" 원칙과 달리 여전히 `.test.ts` 안에 인라인 — pre-existing, 이번 diff 범위 아님 | `spec-plan-completion.test.ts:38,43` | `docs-guard-walker-dedup.md` 통합 시 `plan-scan.ts` 로 함께 이관 고려 |
| 7 | 유지보수성 | `PlanMdFile`(plan-scan.ts)과 `SpecMdFile`(spec-links.ts)이 필드까지 완전히 동일한 구조로 중복 선언 | `plan-scan.ts:31-34`, `spec-links.ts:119-122` | 한쪽에서 `MdFile` 로 일반화해 공유 |
| 8 | 성능 | `slugCache` 가 `findBrokenLinksInFiles` 호출 단위로 스코프돼 3개 공개 entry-point 간 공유되지 않음(영향은 제한적) | `spec-links.ts:187-196` | 필요시 모듈 스코프 캐시로 승격(선택) |
| 9 | 성능 | 코드스팬 제거 정규식이 라인 루프 내부 리터럴이라 매 반복 새 `RegExp` 생성(`LINK_RE`/`FENCE_RE` 와 달리 모듈 스코프 아님) | `spec-links.ts:94` | 모듈 스코프 `CODE_SPAN_RE` 로 끌어올리기 |
| 10 | 보안 | `rawScalar` 의 `new RegExp(...)` 문자열 보간이 `key` 를 이스케이프하지 않음 — 현재는 정적 리터럴 단일 호출뿐이라 실공격면 없음 | `plan-scan.ts:217` | 향후 동적 `key` 호출 추가 시 정규식 특수문자 이스케이프 추가 |
| 11 | 문서화 | 두 번째 gray-matter 캐시우회 호출부(`spec-plan-completion.test.ts:118`)에 설명 주석/포인터가 없어 단독 열람 시 이유가 안 보임 | `spec-plan-completion.test.ts:118` | `// 이유는 위 enforced 필터 주석 참조` 한 줄 추가 |
| 12 | 문서화 | 같은 PR 이 신설한 `plan/in-progress/docs-guard-walker-dedup.md` 의 요약 문장("plan walker 를 네 벌 → 한 벌로 줄였다")이 `plan-scan.ts` 자신의 헤더 주석이 명시적으로 경계 지은 "그중 둘만 합쳤다"는 서술과 자기모순 — 실측 결과 `plan-scan.ts` claim 이 정확, 후속 plan 요약 줄이 오독 소지 | `plan-scan.ts:15-22` 대 `plan/in-progress/docs-guard-walker-dedup.md`(리뷰 대상 밖) | 다음에 그 plan 문서를 손댈 때 요약 문장을 "3벌 중 2벌 통합, Gate C 4번째는 별도"로 정정 |
| 13 | 부작용/의존성 | 신설 build gate(완료 plan status 검사·살아있는 plan 링크 검사)가 이 diff 파일 범위를 넘어 `plan/` 트리 전체에 CI 실패 표면을 새로 연다 — 의도된 기능이며 오늘 시점 실 데이터(980 tests)로 무해함을 실측 확인 | `.claude/docs/plan-lifecycle.md` §4/§5, 소비처 `plan-frontmatter.test.ts`(diff 밖) | 조치 불요, 향후 무관한 PR 이 이 게이트에 걸릴 수 있음을 팀에 공유 |
| 14 | 부작용 | 같은 저장소의 `spec-frontmatter-parse.ts:113` 는 여전히 옵션 없는 `matter(raw)`(캐시 사용) — 오늘은 `spec/**` 만 읽어 이 diff 의 `plan/**` 스캐너와 콘텐츠가 겹치지 않아 무해하나, "두 트리가 안 겹친다"는 전제가 코드로 강제되지 않음 | `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:113`(diff 밖) | 후속으로 동일 `{}` 패턴 적용 시 이 hazard 클래스가 저장소 전체에서 소거됨 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO 4건(모두 실공격면 없음 확인) |
| performance | LOW | extractLinks 전수 스캔 낭비(WARNING), 이중 파싱/정규식 재생성(INFO) |
| architecture | LOW | walker 중복 동등성 미보장(WARNING), 캐시우회 헬퍼 부재(WARNING) |
| requirement | LOW | spec 문서-코드 line-level 일치 확인, 뮤테이션 테스트로 가드 실효성 검증. INFO 2건만 |
| scope | NONE | 직전 라운드 WARNING 6건이 정확히 수복됨, 범위 이탈 없음 |
| side_effect | LOW | gray-matter 캐시 fix 정확, 신설 게이트 blast radius 실측 무해 확인 |
| maintainability | LOW | spec-links.ts 내부 DFS 중복(WARNING), 타입/이중파싱 중복(INFO) |
| testing | LOW | NONE_VALUES 미검증 가능 죽은 코드, sibling walker fixture 갭 |
| documentation | LOW | 신설 주석의 캐시 근거 오류(WARNING), 후속 plan 요약 자기모순(INFO) |
| dependency | NONE | 신규 의존성 없음, 내부 의존 구조 개선 방향 확인 |
| database | NONE | 해당 없음 (DB 코드 없음) |
| concurrency | LOW | 공유 캐시 hazard 이미 방어됨 확인(INFO 2건) |
| api_contract | NONE | 해당 없음 (API 코드 없음) |
| user_guide_sync | NONE | 해당 없음 (매트릭스 22 trigger 전수 불일치) |

## 발견 없는 에이전트

- `database` — 해당 없음 (SQL/ORM/DB 코드 없음)
- `api_contract` — 해당 없음 (HTTP/DTO/라우팅 코드 없음)
- `user_guide_sync` — 해당 없음 (doc-sync-matrix 22 trigger 전수 불일치)

## 권장 조치사항

1. `spec-links.ts` `extractLinks` 에 `](` 존재 여부 사전 필터를 추가해 2072개 중 98%가 넘는 무관 파일의 라인 스캔을 스킵 — CI 가드 실행 시간 절감 (WARNING #1).
2. gray-matter 캐시 우회 관용구를 `plan-scan.ts` 의 공유 헬퍼(`parseFrontmatterSafe`)로 통합해 4곳 손 복제 및 향후 회귀 위험 제거 (WARNING #3).
3. `spec-plan-completion.test.ts` 신설 주석의 "서로의 캐시를 밟는다" 근거를 "같은 파일 내 이중 파싱" 으로 정정 — 실행 모델 오해 방지 (WARNING #5).
4. `spec-links.ts` 내부 `collectSpecMarkdown`/`collectCodebaseSources` DFS 중복을 공유 `walkTree` 헬퍼로 추출 — 유일하게 아직 추적되지 않은 중복 (WARNING #4).
5. `collectCompletePlans`(Gate C)와 `collectCompletePlanMarkdown`(plan-scan.ts) 동등성을 보장하는 최소 계약 테스트를 추가하거나 `docs-guard-walker-dedup.md` 통합을 앞당김 (WARNING #2).
6. 여유가 있으면 INFO 항목 중 `hasValidSpecImpact` NONE_VALUES 케이스 fixture 보강, `archive/` 중첩 깊이 케이스 추가 등 테스트 커버리지 갭을 낮은 우선순위로 정리.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재), 전체 14개 reviewer 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 성공)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 완료 (강제 화이트리스트 미이행 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |