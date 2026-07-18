# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 0건. 6개 reviewer 전원(전량 router_safety 강제 포함) 결과 확보 완료(forced 미이행 없음). `maintainability` 가 사소한 중복/네이밍 관련 INFO 3건으로 LOW 를 보고했을 뿐, 즉시 조치가 필요한 결함은 발견되지 않았다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `spec/conventions/interaction-type-registry.md` 가 여전히 "grep 가드" 워딩을 쓰고 있어 이번 브랜치의 두 대상 파일("AST 가드"로 정정됨)과 문면상 어긋난다. 실측 결과 `origin/main` 은 별도 PR(#977)에서 이미 정정 완료했고 이 브랜치가 그 fork-point 이후분을 아직 받지 못한 브랜치 분기(staleness)일 뿐, 이번 PR 이 만든 불일치가 아니다 | `spec/conventions/interaction-type-registry.md` §1.2/§2.1/§5 | 코드 수정 불요. merge/rebase 시 origin/main 의 정정판과 자동 수렴(구조적 충돌 없음). SPEC-DRIFT 아님(브랜치 동기화 문제) |
| 2 | requirement / testing | `collectCodeStringLiterals` 는 `StringLiteral`/`NoSubstitutionTemplateLiteral` 만 수집하고, 보간이 있는 템플릿 리터럴(`TemplateExpression`)의 head/middle/tail 정적 텍스트는 수집하지 않는다 | `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:131-149` | 현재 3개 REGISTRY_SITES 는 해당 패턴을 안 써서 즉시 영향 없음. 향후 보간 템플릿으로 분기 값을 표현하는 사이트가 추가되면 self-test 케이스 함께 추가 권장 |
| 3 | maintainability | 두 enum(`WaitingInteractionType`/`ConversationTurnSource`) exhaustiveness `describe` 블록이 missing 수집→이중 for 루프→에러 메시지 조립까지 거의 1:1 중복 | `interaction-type-exhaustiveness.test.ts:285-306` vs `:324-345` | `assertExhaustiveLiterals(sites, values, enumLabel, specSection)` 공용 헬퍼로 추출하면 세 번째 registry-site enum 추가 시 복붙 방지. 현재 diff 범위 밖이라 후속 정리로 미뤄도 무방 |
| 4 | maintainability | `collectCodeStringLiterals` 함수 본문(~15줄) 대비 JSDoc(~40줄, PR #968/#972/#977 회귀 이력 전부 포함)이 훨씬 길다 | `interaction-type-exhaustiveness.test.ts:100-131` 부근 | 회귀 방지 목적의 의도적 트레이드오프로 현행 유지 가능. 더 늘어나면 "왜" 설명은 spec/conventions 로 분리하고 docstring 은 "무엇" 요약+링크로 축약 고려 |
| 5 | maintainability | 최상단 상수 네이밍이 두 enum 사이 비대칭 (`REGISTRY_SITES`/`ENUM_VALUES` vs `SOURCE_REGISTRY_SITES`/`SOURCE_ENUM_VALUES`) | `interaction-type-exhaustiveness.test.ts:69,80` vs `:318,322` | `INTERACTION_TYPE_REGISTRY_SITES`/`INTERACTION_TYPE_ENUM_VALUES` 로 대칭 리네이밍 고려. 로컬 스코프라 우선순위 낮음 |
| 6 | testing | `readRepoFile` 의 상대경로 계산(`../../../../../`)에 대한 직접 단위 테스트 부재 — 3개 레지스트리 사이트 읽기 성공이라는 간접 통합 결과에만 의존 | `interaction-type-exhaustiveness.test.ts:82-85` | 선택사항. `join(__dirname, ...)` 이 repo root 알려진 파일(예 `package.json`)을 가리키는지 확인하는 경계 테스트 추가 시 향후 리팩터링 에러 메시지 명확화 |
| 7 | testing | `describe("scriptKindForFile", ...)` 단위 테스트와 엔트리포인트 관통 self-test 가 커버리지 일부 중복 | `interaction-type-exhaustiveness.test.ts:236-245` vs `:247-256` | 의도적 belt-and-suspenders(과거 "프록시로만 테스트하면 회귀를 못 잡는다" 지적 대응)로 판단됨. 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 사용자 입력·네트워크 처리 없는 순수 정적 dev/test 가드. 인젝션/시크릿/인증/암호화 등 공격 표면 없음 |
| requirement | NONE | vitest 7/7 pass + mutation 실측(하드코딩 되돌리기 시 신규 self-test 만 red)으로 "회귀 방지" 주장 실증. INFO 2건(#1, #2) |
| scope | NONE | fork-point 대비 실제 코드 변경은 리뷰 대상 2파일뿐이며 전부 plan 후속 항목과 1:1 대응. 스코프 이탈 없음 |
| side_effect | NONE | 파일시스템 읽기 전용, 전역 상태·시그니처·인터페이스 변경 없음. 헬퍼 3종 통합은 비-export 내부 정리 |
| maintainability | LOW | 신규 코드(`scriptKindForFile`, self-test 3건) 품질 양호. INFO 3건(#3~#5)은 기존 패턴 또는 의도적 트레이드오프 |
| testing | NONE | 3가지 mutation 시나리오 직접 실행 검증(캐스트 되돌리기·missing/throw 배선 손상·설계상 알려진 특성 확인). INFO 3건(#2, #6, #7) |

## 발견 없는 에이전트

security, scope, side_effect — 실질 이슈 없음(security: 공격 표면 부재, scope: 스코프 이탈 없음, side_effect: 부작용 표면 없음).

## 권장 조치사항

1. (선택, 후속) 세 번째 registry-site enum 이 추가되는 시점에 두 exhaustiveness `describe` 블록을 공용 헬퍼로 추출해 복붙 방지 (INFO #3).
2. (선택, 후속) 보간 템플릿 리터럴 기반 분기 값이 등장하면 `collectCodeStringLiterals` 확장 + self-test 케이스 추가 (INFO #2).
3. (조치 불요) `spec/conventions/interaction-type-registry.md` 의 잔여 "grep" 워딩은 브랜치 동기화 문제이며 merge/rebase 시 origin/main 의 이미 정정된 버전과 자동 수렴 (INFO #1).
4. 즉시 블로킹 조치는 없음 — 현재 상태로 push/merge 진행 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing` (6명)
  - **제외**: 표 (아래, 8명)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (전원 forced, 결과 전량 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경 범위와 무관 (순수 dev/test 정적 가드 + 주석 정정) |
  | architecture | router 판단상 이번 변경 범위와 무관 |
  | documentation | router 판단상 이번 변경 범위와 무관 |
  | dependency | router 판단상 이번 변경 범위와 무관 (신규 의존성 없음) |
  | database | router 판단상 이번 변경 범위와 무관 |
  | concurrency | router 판단상 이번 변경 범위와 무관 |
  | api_contract | router 판단상 이번 변경 범위와 무관 |
  | user_guide_sync | router 판단상 이번 변경 범위와 무관 |