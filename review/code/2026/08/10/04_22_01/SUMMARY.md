# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 결함 없음. 5개 reviewer(architecture/requirement/scope/dependency/documentation)가 동일한 문서-코드 불일치(stale docstring)를 독립적으로 지적해 병합 전 정정을 권고하며, 그 외 테스트 커버리지·DRY·edge-case 성격의 WARNING 다수가 있으나 모두 병합을 막을 수준은 아님.

> **라우팅 참고**: 이번 세션은 router 를 사용하지 않고(routing=skipped) 전체 14개 reviewer 를 실행했으며, forced 화이트리스트(`maintainability, requirement, scope, security, side_effect, testing`) 6명 전원 포함 14명 전원의 결과 전문을 확보했다. 누락된 reviewer 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서/스코프(중복 지적: architecture, requirement, scope, dependency) | `plan-scan.ts` 모듈 상단 docstring 이 "Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는 아직 독립 구현으로 남아 있고, 통합은 `docs-guard-walker-dedup.md` 에 등재했다"고 서술하지만, 같은 커밋에서 `spec-plan-completion.test.ts` 의 `collectCompletePlans` 는 이미 `collectCompletePlanMarkdown` 위임으로 전환됐다. 연결된 `plan/in-progress/docs-guard-walker-dedup.md` 의 "2026-08-10 추가" 절도 스스로 이 통합이 끝났다고 정정해 두었는데, `plan-scan.ts` 쪽 주석만 갱신이 누락됨 | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:18-22` (vs 실제: `spec-plan-completion.test.ts:62-64`) | docstring 을 "Gate C 의 `collectCompletePlans` 도 이 PR 에서 `collectCompletePlanMarkdown` 위임으로 통합 완료"로 갱신. `docs-guard-walker-dedup.md` §"함께 볼 것 — Gate C 의 4번째 walker" 절 체크박스도 완료로 정리해 문서 내부 모순 해소 |
| 2 | requirement | `enforced` 필터(Gate C cutoff 판정)가 export 된 `isGateCEnforced` predicate 를 재사용하지 않고 동일 로직(`startedDate` + cutoff 비교)을 인라인으로 복제 — 이 PR 자신이 반복 경계하는 "판정 로직 이중화가 조용히 갈린다" 패턴 재발 | `spec-plan-completion.test.ts:71-79` (인라인) vs `:38-41` (`isGateCEnforced` 정의, 미사용) | `enforced` 필터를 `isGateCEnforced(parsed.data)` 호출로 교체 |
| 3 | requirement | `spec_impact` 배열의 비-문자열 원소가 실제 강제 경로(`each spec_impact spec path exists`)의 `typeof p === "string"` 필터에서 걸러져 dangling 목록에서 조용히 빠짐 — `[123]` 같은 배열도 Gate C 를 통과. 더 엄격한 `hasValidSpecImpact` 헬퍼는 존재하지만 synthetic 테스트에서만 쓰이고 실제 게이트에는 미배선 | `spec-plan-completion.test.ts:108-117` (실제 강제) vs `:43-57` (`hasValidSpecImpact`, 미사용) | dangling 계산을 `typeof p !== "string" || !fs.existsSync(...)` 로 바꾸거나 `hasValidSpecImpact` 를 실제 게이트에서 재사용해 판정 단일화 |
| 4 | performance | Gate C `enforced` 필터링과 per-plan 블록이 같은 complete plan 의 frontmatter 를 두 번 읽고 두 번 파싱(파일 I/O + YAML 파싱 중복). 현재는 grandfather cutoff 로 `enforced` 가 비어 있어 실비용 0이나, cutoff 이후 작업이 누적되면 해당 plan 수만큼 정확히 2배 비용 발생 | `spec-plan-completion.test.ts:71-79`(전수 파싱) / `:95`(재파싱) | 필터 단계에서 `{abs, rel, data}` 캐시 배열을 만들어 재사용 (gray-matter 자체 캐시는 신뢰 불가하므로 앱 레벨 캐시 필요) |
| 5 | testing | `parseFrontmatterSafe`(gray-matter 캐시 오염 우회용 신규 단일 진입점)를 직접 겨냥한 회귀 테스트가 없음. 현재 커버리지는 뮤테이션 테스트로 실측 확인은 됐으나(`matter(raw,{})`→`matter(raw)` 뮤테이션 시 2개 테스트 RED), 그 근거가 서로 다른 describe 블록의 **바이트 동일 fixture 재사용 + 선언 순서**라는 우연에 의존 — fixture 문자열이나 블록 순서가 바뀌면 신호 없이 커버리지 소실 | `plan-scan.ts:121-128`(`parseFrontmatterSafe`) | `parseFrontmatterSafe` 를 직접 import 해 "동일한 깨진 문자열을 연속 두 번 호출해도 둘 다 null" 을 단언하는 독립 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/maintainability(중복) | `rawScalar(block, key)` 가 `key` 를 이스케이프 없이 동적 정규식에 보간 — 현재 호출부는 리터럴 `"started"` 한 곳뿐이라 도달 불가능한 이론적 표면이나, private 헬퍼치고 범용 시그니처라 향후 확장 시 함정 여지 | `plan-scan.ts:196-200`(정의), `:280`(호출) | JSDoc 에 "리터럴 키만 허용" 명시하거나 메타문자 이스케이프 추가 |
| 2 | security | `spec_impact` 경로가 `fs.existsSync(path.join(root, p))` 에 이스케이프/화이트리스트 없이 사용 — `p`=`../../etc/passwd` 류로 root 밖 존재 여부 탐지 이론상 가능하나, 출처가 커밋된 신뢰 콘텐츠이고 결과는 boolean 만 노출돼 실질 공격 표면 아님 | `spec-plan-completion.test.ts:110-112` | 필요시 `spec_impact` 값을 `spec/` 하위로 제한하는 방어적 검증 고려(필수 아님) |
| 3 | architecture | `plan-scan.ts` 한 파일이 순회/파싱 인프라/종료-status 판정/필드 검증 네 책임을 겸함(현재 300줄 규모에서는 무리 없음) | `plan-scan.ts` 전체 | 향후 확장 시 `plan-walk.ts`/`plan-frontmatter-rules.ts` 분리 검토 |
| 4 | architecture | `findNonTerminalCompletedPlans` 는 판정 로직이 FS 순회와 섞여 있어 `checkPlanFrontmatter` 처럼 순수 fixture 로 직접 겨눌 수 없음(현재도 FS fixture 로 커버 중이라 공백은 아님) | `plan-scan.ts:157-170` | `isTerminalStatus` 류 순수 predicate 분리 고려(우선순위 낮음) |
| 5 | requirement | `startedDate()` 는 `started` 값의 달력 유효성(day-rollover 등)을 검증하지 않음 — 형식이 깨진 완료 plan 의 `started` 는 Gate C 를 fail-open 으로 영구 우회 가능(테스트로 의도적 문서화됨) | `spec-plan-completion.test.ts:27-34` | (선택) `Number.isNaN` 체크 추가 또는 완료 plan `started` 에도 `isIsoDate` 급 검증 적용 여부를 `plan-lifecycle.md` 에 명문화 |
| 6 | side_effect | 정렬 비교자가 절대경로 기본 문자열 정렬에서 `relPath.localeCompare` 로 변경 — 판정(pass/fail)에는 영향 없고 테스트 리포트 순서만 환경별로 달라질 수 있음 | `plan-scan.ts:84` | 순서 결정성이 필요하면 단순 `<`/`>` 비교로 고정 |
| 7 | maintainability | `WORKTREE_PLACEHOLDER` 정규식이 5개 한/영 대안을 한 줄 alternation 으로 묶어 개별 의도 주석 없음 | `plan-scan.ts:187` | 각 대안에 짧은 인라인 주석 또는 명명된 하위 상수로 분리 |
| 8 | maintainability | `startedDate`(Gate C 전용, 느슨한 검증) 와 `isIsoDate`(엄격한 라운드트립 검증) 가 같은 `started` 필드를 다른 강도로 파싱 — 버그는 아니나 교차 참조 부재로 오인 위험 | `spec-plan-completion.test.ts:27` vs `plan-scan.ts:212` | `startedDate` 에 "컷오프 비교 전용, 필드 유효성 검증은 `isIsoDate` 소관" 한 줄 교차 참조 추가 |
| 9 | maintainability | `expect(plans.length).toBeGreaterThan(10)` 임계값 10 이 근거 주석 없이 하드코딩 | `spec-plan-completion.test.ts:88` | 근거(실측 plan 개수 대비 여유값) 한 줄 추가 |
| 10 | documentation | "Pure enforcement predicates — provably live" 주석이 실제 배선(predicate 미사용, 인라인 중복)보다 강하게 읽힘. 이전 라운드(`03_47_21/requirement.md`)에서 이미 스코프 외로 처분된 사안 — 신규 아님 | `spec-plan-completion.test.ts:36-37`, `:131-132` | (선택) "predicates 는 현재 enforcement 루프와 별도 구현" 한 줄 추가 |
| 11 | documentation | `PlanMdFile`/`NonTerminalPlan`/`FrontmatterViolation`/`FrontmatterViolationKind` 등 일부 export 타입에 독스트링 없음(파일명이 자기설명적이라 실질 장애는 없음) | `plan-scan.ts` (해당 export 4곳) | 파일 전체 문서화 수준에 맞춰 한 줄 요약 추가(급하지 않음) |
| 12 | dependency | 새 외부 패키지 없음, `gray-matter` 는 기존 `dependencies` 재사용(버전 변경 없음) | `codebase/frontend/package.json:49` | 조치 불요 |
| 13 | performance | 트리 워크(`walkPlanMarkdown`)가 vitest 파일 격리로 인해 여러 진입점에서 중복 실행될 수 있음 — 현재 plan 규모(수십 건)에서 무시 가능 | `plan-scan.ts:59`, 호출부 `:157`/`:294`, `spec-plan-completion.test.ts:68` | 규모 증가 시 `globalSetup` 공유 캐시 고려(무효화 시점 명시 필요) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO 3건(동적 정규식 key 이스케이프 부재, spec_impact path traversal 이론적 표면, YAML 파서 일반 위험) — 전부 도달 불가/저위협 |
| performance | LOW | Gate C 이중 파싱(WARNING, 현재 비용 0), 트리 워크 중복(INFO) |
| architecture | LOW | stale docstring(WARNING, 타 4개 reviewer 와 동일 발견), SRP 경계(INFO) |
| requirement | LOW | stale docstring(WARNING), isGateCEnforced 인라인 중복(WARNING), spec_impact 비-문자열 우회(WARNING), started 달력검증 부재(INFO). spec fidelity 는 line-level 전량 일치 |
| scope | LOW | 커밋 목적과 diff 1:1 일치, 무관 변경 없음. stale docstring(WARNING) |
| side_effect | LOW | 읽기 전용 순수 함수, 정렬자 변경(INFO) 외 부작용 없음 |
| maintainability | LOW | 정규식/날짜파서/임계값 근거 부재 등 INFO 4건, 구조적 문제 없음 |
| testing | LOW | parseFrontmatterSafe 우연 커버리지(WARNING), 나머지 커버리지 탄탄(뮤테이션 실측 검증) |
| documentation | LOW | 기존 처분된 사안 재확인(INFO), 독스트링 밀도 낮은 타입 일부(INFO) |
| dependency | LOW | 신규 패키지 없음, stale docstring(WARNING, 의존관계 서술 부정확) |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음 (전부 동기 fs, 순수 함수) |
| api_contract | NONE | 해당 없음 |
| user_guide_sync | NONE | 해당 없음 (doc-sync-matrix 21 trigger 전부 미매치) |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync

## 권장 조치사항
1. `plan-scan.ts` 상단 docstring 을 실제 코드 상태(Gate C `collectCompletePlans` 위임 통합 완료)에 맞춰 갱신하고, `plan/in-progress/docs-guard-walker-dedup.md` 의 관련 체크박스도 동기화한다 (5개 reviewer 중복 지적, 가장 우선순위 높은 조치).
2. `enforced` 필터를 `isGateCEnforced(parsed.data)` 재사용으로 교체해 판정 로직 이중화를 제거한다.
3. `spec_impact` dangling 검증에서 비-문자열 원소도 거부하도록 필터를 수정하거나 `hasValidSpecImpact` 를 실제 게이트에 배선한다.
4. `parseFrontmatterSafe` 의 캐시-우회 계약(동일 문자열 반복 파싱 시 둘 다 null)을 직접 겨냥하는 독립 단위 테스트를 추가한다.
5. (선택, 낮은 우선순위) Gate C 이중 파싱 캐싱, `rawScalar` 키 이스케이프, `startedDate`/`isIsoDate` 교차 참조 주석, 하드코딩 임계값 근거 등 INFO 항목은 후속 정리 시 일괄 반영.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행(forced 화이트리스트 `maintainability, requirement, scope, security, side_effect, testing` 포함 전원). 제외된 reviewer 없음, forced 전원 결과 확보됨.