# Code Review 통합 보고서

## 전체 위험도
**NONE** — 5개 reviewer(testing/requirement/scope/side_effect/maintainability) 전원 결과 확보. Critical 0건, Warning 1건(테스트 갭). 나머지는 전부 INFO(설계 의도 확인·정보성 관찰).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `ALL_WS 가 export 상수 전부를 담는다` 테스트가 "새 상수 누락"을 실제로는 못 잡는 경로가 있다 — 스펙 파일에 하드코딩된 7개 named-import 배열과 `ALL_WS`(런타임 값)를 비교하는 구조라서, 누군가 `workspace-id-fixtures.ts` 에 새 상수를 추가하면서 `ALL_WS` 에도 넣는 걸 잊고 spec 파일도 함께 안 건드리면, 양쪽이 우연히 같은 개수(예: 여전히 7개)로 일치해 GREEN 이 나온다 — 테스트가 방지하겠다고 선언한 바로 그 실패 모드를 못 잡음 | `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:58-72` | `import * as fixtures from './workspace-id-fixtures'` 로 모듈 네임스페이스를 통째로 가져와 `Object.entries` 에서 string 타입 값을 자동 추출해 `ALL_WS` 와 대조하면 스펙 파일 갱신 없이도 export 목록 변화를 반영할 수 있다. 최소한 이 갭(스펙 파일도 함께 갱신해야만 유효하다는 전제)을 테스트 docstring 에 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 로드 시점 배선 검증(`/^\s*assertAllUnique\(ALL_WS\);/`)이 소스 텍스트의 정확한 포맷(세미콜론·줄바꿈 없음)에 결합 — 포맷 변경 시 허위 RED 가능 | `workspace-id-fixtures.spec.ts:42-56` | 현재로도 실용적 트레이드오프, 필수 수정 아님. 향후 손댈 때 TS AST 방식 고려 가능 |
| 2 | testing | 경계 케이스(전부 동일 값, 2쌍 이상 중복)는 테스트되지 않음. `Set` 기반 단순 카운트라 회귀 위험은 낮음 | `workspace-id-fixtures.ts:78-86` (`assertAllUnique`) | 우선순위 낮음, 필요시 케이스 추가 |
| 3 | testing/requirement | `uuid.ts` docstring(SoT)에 없는 사실 2건("이 둘이 유일한 방어선" 등)이 `uuid.spec.ts`/`workspace-id-fixtures.ts` 에 선별 보존됨 — 정적 서술이라 새 호출부 추가 시 조용히 stale 해질 수 있음(테스트로 강제되지 않음) | `uuid.spec.ts:49-58`, `workspace-id-fixtures.ts:47-51` | 조치 불요, 인지만 |
| 4 | requirement | spec fidelity: 변경 영역이 `spec/5-system/1-auth.md` frontmatter `code:` 글로브 밖(`__test-utils__/**` 미포함)이며, spec-linked 파일(`uuid.ts`)의 실제 로직은 이번 diff 에서 변경 없음 | `spec/5-system/1-auth.md` frontmatter, `uuid.ts`(무변경) | 조치 불요 — SPEC-DRIFT 아님 |
| 5 | scope | 구현이 plan 원문의 "1줄 스케치"보다 넓음(순수 함수 추출 + 전용 spec 6케이스) — 코드·plan 양쪽에 근거가 명시된 의도적 확장, scope-creep 아님 | `workspace-id-fixtures.ts:78`, `workspace-id-fixtures.spec.ts` 전체(신규) | 조치 불요 |
| 6 | side_effect | `assertAllUnique(ALL_WS)` 가 모듈 최상위(import-time)에서 실행돼 로드 시 throw 하면 이 모듈을 import 하는 3개 소비 스위트가 동시 실패. 의도된 fail-fast 캐너리이며, 프로덕션 코드에서는 이 모듈을 import하지 않음(grep 확인) | `workspace-id-fixtures.ts:88` | 현재 문제 없음. 향후 프로덕션 코드가 `__test-utils__` import 하지 않도록 경계 유지 |
| 7 | side_effect | 신규 spec 이 `readFileSync` 로 이웃 소스 파일을 읽음(읽기 전용, 이동/rename 시 다른 실패 메시지로 깨질 수 있음) | `workspace-id-fixtures.spec.ts:46-49` | 정보성, 조치 불요 |
| 8 | maintainability | `assertAllUnique` 에러 메시지가 이 픽스처 모듈의 소비 맥락(cross-tenant 테스트 무의미화)에 강하게 결합 — 범용 재사용 시 부적합할 수 있음 | `workspace-id-fixtures.ts:81-85` | 현재 범위에서 개선 불요. 다른 모듈로 승격 시 메시지 매개변수화 검토 |
| 9 | maintainability | 소스 텍스트 정규식 배선 검증 패턴은 포맷 의존적이나, 실패 방향이 "조용히 통과"가 아니라 "시끄럽게 RED"이고 저장소 내 선례(`catalog-sync.spec.ts` 등)와 일관 | `workspace-id-fixtures.spec.ts:42-56` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | LOW | export 완전성 테스트의 vacuous 갭(WARNING) + 경미한 INFO 2건 |
| requirement | NONE | 배선 검증 테스트는 의도된 트레이드오프(뮤테이션 테스트로 로드베어링 실증), spec fidelity 이상 없음 |
| scope | NONE | changeset 4개 파일이 plan 의 2개 후속 항목과 1:1 대응, 구현 확장은 문서화된 의도 |
| side_effect | LOW | import-time throw 가 3개 스위트 동시 실패 가능(의도된 캐너리, 프로덕션 영향 없음 확인) |
| maintainability | NONE | 함수 짧고 명확, 네이밍 일관, 문서 중복 제거로 오히려 개선 방향 |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 INFO 이상 발견).

## 권장 조치사항

1. (WARNING) `workspace-id-fixtures.spec.ts` 의 "`ALL_WS` 완전성" 테스트를 `import * as fixtures` + `Object.entries` 자동 추출 방식으로 바꿔, 새 상수가 스펙 파일 갱신 없이도 검증 대상에 포함되도록 한다. 최소한 현재의 "스펙 파일도 함께 갱신해야 유효하다"는 전제를 테스트 docstring 에 명시.
2. (INFO, 선택) 향후 `workspace-id-fixtures.ts` 를 리팩터링할 계획이 있다면 정규식 기반 배선 검증을 TS AST 파싱으로 교체 검토 — 현재 스코프에서는 필수 아님.
3. 나머지 INFO 항목은 모두 문서화된 의도적 설계 트레이드오프이거나 정보성 관찰로, 즉각 조치 불요.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(강제 화이트리스트: maintainability, requirement, scope, side_effect, testing) 실행. 5명 전원 결과 확보됨. 제외된 reviewer 없음.