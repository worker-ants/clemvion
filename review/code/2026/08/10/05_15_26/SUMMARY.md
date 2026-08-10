# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. testing 리뷰가 Gate C 의 핵심 불변식(`spec_impact` 가 실재 spec 파일을 가리켜야 한다)이 실제로는 "저장소 안 아무 실재 파일"만 요구해 우회 가능함을 직접 재현(WARNING). maintainability 리뷰는 이 PR 이 스스로 세운 "판정 로직은 `plan-scan.ts` 로 추출" 원칙을 `spec-plan-completion.test.ts` 자신은 지키지 않는 구조적 불일치를 지적(WARNING). 나머지는 INFO/LOW 수준.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `makeSpecExists` 가 "실재하는 spec **파일**"이 아니라 "저장소 안 아무 실재 파일"을 인정한다 — Gate C 의 핵심 불변식이 우회된다. `specExists("codebase/frontend/package.json")`, `specExists("CLAUDE.md")` 가 모두 `true` 를 반환(둘 다 spec 파일 아님). `spec_impact: ["CLAUDE.md"]` 가 게이트를 통과한다. 기존 테스트는 빈 문자열/공백/디렉터리만 겨냥하고 "실재하지만 spec 밖" 케이스는 fixture 가 없어 회귀 시 어떤 테스트도 빨개지지 않는다. | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:112-123` (`makeSpecExists`) | `p.startsWith("spec/") &&` 제약 추가 + "실재하지만 spec 밖" 파일을 거부하는 회귀 fixture 추가 |
| 2 | Testing | `rawScalar` 가 첫 줄 매칭 정규식(`m` 플래그)이라, 진짜 `started:` 보다 앞선 필드의 multi-line block-scalar(`\|`/`>`) 값 안에 `started:`/`owner:`/`worktree:` 로 시작하는 줄이 있으면 그 줄이 먼저 매치돼 오검출된다(직접 재현 확인). 이 값이 `isIsoDate`/`hasMalformedStarted`/`isGateCEnforced` 로 그대로 흘러가 Gate C 판정을 오염시킬 수 있는데, export 되어 재사용되는 이 함수만 유일하게 직접 단위 테스트가 없다. | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:214-218` (`rawScalar`) | `rawScalar` 전용 테스트 추가(현재 동작을 의도적으로 받아들인다면 주석 명시), 또는 정규식을 frontmatter 최상위 키(들여쓰기 0)만 매칭하도록 좁힘 |
| 3 | Maintainability | Gate C 판정 로직(`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`)이 같은 PR 이 방금 확립한 "판정 로직은 `plan-scan.ts` 로 추출" 원칙을 따르지 않고 `spec-plan-completion.test.ts`(`*.test.ts`) 안에 production 로직으로 남아 있다. 향후 다른 스크립트(예: pre-commit hook)가 재사용하려면 `*.test.ts` 파일을 import 해야 하는 비정상적 의존이 생긴다. | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:57,63,68,96,112` | `startedDate`/`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`(+`GATE_C_CUTOFF`/`NONE_VALUES`)를 `plan-scan.ts` 로 이동, 테스트 파일은 import 해서 사용 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `it("every completed plan has parseable frontmatter")` 가 이미 계산된 `parsedPlans` 를 재사용하지 않고 `findUnparseablePlans(root)` 로 `plan/complete/**` 를 다시 walk+read+parse — "한 번만 읽어 공유" 설계 의도와 이 테스트만 어긋남(정확성 문제는 없음, 저장소 커질수록 I/O 2배). | `spec-plan-completion.test.ts:164-178` (vs 137-144) | `parsedPlans.filter((p) => p.parsed === null).map((p) => p.rel)` 로 교체 |
| 2 | Testing | `describe("Gate C — plan-completion spec-consistency")` 블록이 fixture 가 아니라 실제 저장소 `plan/complete/**` 데이터에 직접 의존 — 코드 변경 없이도 향후 plan frontmatter 상태에 따라 실패 가능(기존 관용구와 동일한 의도된 패턴). | `spec-plan-completion.test.ts:132-233` | 조치 불요, 기록 목적 |
| 3 | Requirement | `spec-impl-evidence.md` frontmatter `code:` 목록에 `plan-scan.ts` 는 등재됐으나 신설 `plan-scan.test.ts` 는 빠짐(기존 페어링 관례에서 벗어남). build gate 는 glob ≥1 매치만 요구해 실패로 이어지지 않음(직접 실행 확인). | `spec/conventions/spec-impl-evidence.md:15` | 다음에 문서 만질 때 `plan-scan.test.ts` 를 `code:` 리스트에 추가 |
| 4 | Scope | `plan-scan.ts` 가 사전 존재하던 `checkPlanFrontmatter`/`ISO_DATE` 류를 `plan-scan.ts` 로 통합한 부분은 범위 밖 리팩토링처럼 보일 수 있으나, 이 PR 이 고치는 것과 동일한 버그 클래스(느슨한 날짜 검증)를 공유해 통합이 정당화됨. | `codebase/frontend/src/lib/docs/plan-scan.ts` 전반 | 조치 불요 |
| 5 | Side Effect | `danglingSpecImpact` 시그니처가 `(root, impact)` → `(impact, specExists)` 로 breaking change — 이전 리뷰 라운드 WARNING(fs 하드코딩 결합) 해소 목적의 의도된 변경. 호출부 전수 확인(`grep`) + `tsc --noEmit`(0 에러) + `vitest run`(986/986 GREEN)으로 파손 없음 실측. | `spec-plan-completion.test.ts:96` | 조치 불요, 향후 유사 변경 시 grep+tsc 관례 유지 권장 |
| 6 | Side Effect | 신설 `makeSpecExists`/`findUnparseablePlans` 는 읽기 전용 파일시스템 접근만 수행(쓰기/삭제 없음). | `spec-plan-completion.test.ts:112`, `plan-scan.ts:184` | 조치 불요 |
| 7 | Side Effect | 신규 테스트("every completed plan has parseable frontmatter")는 실 저장소 `plan/complete/**` 상태에 결합된 CI 게이트 — 향후 실패 시 원인은 실제 plan frontmatter 손상이지 이 PR 의 회귀가 아님. | `spec-plan-completion.test.ts:174` | 조치 불요, 참고 기록 |
| 8 | Side Effect | `makeSpecExists` 의 경로 결합(`path.join(root, p)`)이 이론상 `root` 밖 경로도 stat 가능하나, `p` 의 유일한 소스는 저장소 내 신뢰된 frontmatter 값이고 읽기 전용이라 실질 위험 없음. | `spec-plan-completion.test.ts:114` | 조치 불요 |
| 9 | Maintainability | `GATE_C_CUTOFF` 값이 코드·`plan-lifecycle.md`·`spec-impl-evidence.md` 세 곳에 하드코딩되어 있고 문서가 "3곳 동시 갱신" 을 요구하지만 이를 강제하는 자동 검사는 없음. | `spec-plan-completion.test.ts:30` | 여유가 되면 코드 상수를 문서 문자열과 비교하는 캐너리 테스트 추가 |
| 10 | Maintainability | `plans.length` 하한 가드(`toBeGreaterThan(10)`)에 근거 설명 없는 매직 넘버. | `spec-plan-completion.test.ts:161` | 상수화 또는 근거 한 줄 추가 |
| 11 | Maintainability | 동일 `block` 에 대해 `rawScalar(block, "started")` 가 `startedDate`/`hasMalformedStarted` 등 여러 경로에서 각자 재호출됨 — 기능 문제는 없으나 "단일 진입점" 철학과 미묘히 어긋남. | `spec-plan-completion.test.ts:47-51, 63-66` | 필수 아님, 헬퍼로 합치는 것 고려 |
| 12 | Maintainability | fixture 작성 보일러플레이트를 `plan-scan.test.ts` 는 `write()` 헬퍼로 추출했으나 같은 디렉터리의 `spec-links.test.ts` 는 인라인 반복 — `__tests__` 공유 fixture 유틸 부재 신호(이번 PR 범위 밖). | `plan-scan.test.ts:25-28` | 여유 시 `write()` 를 공용 헬퍼로 승격 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | Gate C 핵심 불변식 우회 가능(`makeSpecExists`), `rawScalar` 미검증 갈래 |
| requirement | NONE | spec·구현 라인 단위 정확 일치(js-yaml 롤오버, gray-matter 캐시 우회 등 실측 검증). `code:` 목록 등재 누락만 INFO |
| scope | LOW | 3파일 변경 전부 "plan-lifecycle-gates" 단일 주제로 수렴, 무관한 변경 없음. 기존 로직 통합은 정당화된 범위 내 |
| side_effect | LOW | `danglingSpecImpact` breaking change 는 의도적·검증됨. 읽기 전용 접근만, 새 CI 게이트는 의도된 결합 |
| maintainability | LOW | 판정 로직이 자기 PR 원칙(로직은 `plan-scan.ts` 로) 미준수. 매직넘버·중복호출 등 INFO 다수 |

## 발견 없는 에이전트

없음 — 5개 reviewer 모두 최소 1건 이상의 발견사항(WARNING 또는 INFO) 보고.

## 권장 조치사항
1. `makeSpecExists` 에 `p.startsWith("spec/")` 제약을 추가하고 "실재하지만 spec 밖" 파일을 거부하는 회귀 fixture 를 추가한다 — Gate C 의 존재 이유(어떤 spec 을 건드렸는지 강제)를 실제로 방어하기 위한 필수 조치.
2. `rawScalar` 에 대한 전용 단위 테스트를 추가하거나(현재 동작이 의도적이면 주석으로 명시), 필요 시 정규식을 최상위 키만 매칭하도록 좁힌다.
3. Gate C 판정 함수들(`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`)을 `plan-scan.ts` 로 이동해 이 PR 이 세운 "로직은 non-test 모듈에" 원칙을 자신에게도 적용한다.
4. (선택) `spec-impl-evidence.md` 의 `code:` 목록에 `plan-scan.test.ts` 추가, `GATE_C_CUTOFF` 3중 동기화 캐너리 테스트, `findUnparseablePlans` 중복 스캔 제거 등 INFO 항목은 여유 있을 때 처리.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(5명) 강제 실행. `agents_forced`: maintainability, requirement, scope, side_effect, testing — 전원 결과 확보됨(누락 없음).