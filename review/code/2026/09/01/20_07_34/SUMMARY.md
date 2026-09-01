# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 코드 자체(6개 패키지 lint glob 따옴표 수정, `parser.ts` no-case-declarations 해소, `error-shape.spec.ts` 타입 유도 리팩터)는 CRITICAL 0건·실행 회귀 없음(전 reviewer 실측 확인)이나, 동봉된 `plan/` 문서 두 건에서 **같은 diff 안의 코드 변경과 모순되는 stale 체크리스트**(3개 reviewer 중복 지적) + **plan 이동 시 새로 생긴 dead link** + **재검증 없이 강화된 잘못된 커밋 귀속**이 발견돼 WARNING 4건으로 집계된다. Forced reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서-코드 정합(SCOPE) | plan 체크리스트가 "`parser.ts:317` no-case-declarations 는 원인이 환경이면 이 PR 에서 고치지 않는다"고 unchecked(`- [ ]`)로 명시했는데, 같은 diff 의 `parser.ts:317`(`case TokenType.LParen: {`)이 정확히 그 결함을 이미 고쳤다. 3명(requirement·scope·testing)이 독립적으로 동일 지적. | `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:124-127` (대응 코드: `codebase/packages/expression-engine/src/parser.ts:317`) | 체크박스를 `[x]`로 바꾸고 원문은 취소선으로 보존한 채 "이 diff 에서 함께 해소, lint 0 에러로 확인"을 정정문으로 추가 |
| 2 | 문서-코드 정합(SCOPE) | 같은 plan 파일의 "로컬-CI 툴체인 차이 규명" 항목(재개 신호: "이 PR 의 packages-checks 결과")도 미해결로 남아 있으나, 실제 근본 원인(따옴표 없는 lint glob 이 셸에서 축소 해석되는 문제)은 같은 diff(6개 패키지 `package.json`)가 이미 규명·수정했다. | `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:118-122` | 조사 결과("설치방식 가설 아니라 glob quoting 버그")와 적용한 수정을 반영해 체크 상태 갱신 |
| 3 | 문서(DOCUMENTATION) | `plan/in-progress/`→`plan/complete/`로 이동하며 새로 생성된 문서가, 스스로 "죽은 링크를 고쳤다"고 자평하는 배너 바로 아래에서 **반대 방향의 dead link**를 새로 만들었다 — `spec-sync-user-profile-gaps.md`는 여전히 `plan/in-progress/`에 있는데 `./` 상대경로로 참조. `plan/complete/**`는 상대링크 build guard 범위 밖이라 자동 미탐지. | `plan/complete/spec-draft-avatar-storage-key.md:381` (382행도 형태 점검 권장) | `../in-progress/spec-sync-user-profile-gaps.md`로 정정, plan-lifecycle 이동 체크리스트에 "이동 문서 자신의 outgoing 링크 재계산" 항목 추가 검토 |
| 4 | 문서(DOCUMENTATION) | "실측"으로 이전 결론을 정정한다는 배너가, 인접한 미검증 사실(도입 커밋을 `4afab7ca1`로 귀속)을 재검증 없이 그대로 인용·강화했다. `git log --diff-filter=A`로 확인 시 실제 신설 커밋은 `8ff827ef6`(#1233)이며 `4afab7ca1`은 독스트링 7줄만 추가한 커밋. | `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:35, 76, 116` | 커밋 식별자를 `8ff827ef6`(#1233)으로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용(SIDE_EFFECT) | lint glob quoting(`eslint src/**/*.ts` → `eslint "src/**/*.ts"`)이 단순 quoting 이 아니라 **셸 glob 확장 방식 변경으로 6개 패키지의 실제 lint 대상 파일 집합을 넓힌다**(quote 없이는 `src/` 최상위 `.ts` 파일이 애초에 lint 대상에서 빠져 있었음, 실측 확인). 현재는 5개 미수정 패키지에 quoted 패턴 직접 실행해 신규 위반 없음을 확인했으나, 향후 새 최상위 파일 추가 시 처음 걸리는 lint 실패의 원인 추적에 참고 가치. | `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,masked-markers,node-summary}/package.json:11` | 조치 불요, PR 설명에 "lint 스코프 확장" 한 줄 기록 권장 |
| 2 | 유지보수성(MAINTAINABILITY) | `error-shape.spec.ts`의 `SubclassName` 매핑 타입(중첩 조건부 타입 + `Exclude`)은 진입장벽이 있으나 이 파일에 국한되고 근거 주석·뮤테이션 검증(7번째 클래스 추가 → 3 RED)이 딸려 있어 실질 부담 낮음 | `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:64-74` | 조치 불요(재사용 필요 시 이름 있는 유틸리티 타입으로 승격 고려) |
| 3 | 의존성(DEPENDENCY) | plan 문서가 CI(서브트리 설치) vs 로컬(전체 워크스페이스 설치) 간 pnpm hoisting 차이를 별도 미해결 조사 항목으로 투명하게 추적 중 — 이번 PR 의 결함은 아님 | `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:118-122` | 조치 불요, 후속 확정 시 monorepo 전역 유사 클래스 점검 권고 |
| 4 | 부작용(SIDE_EFFECT) | `spec-draft-avatar-storage-key.md` plan 이동이 `git mv`가 아니라 delete+add(별도 blob hash)로 처리됨 — 규약에 맞는 의도된 이동이나, "git mv + multi-pathspec add = 침묵 stale 커밋" 실패 패턴과 같은 조작 형태 | `plan/in-progress/spec-draft-avatar-storage-key.md`(삭제) / `plan/complete/spec-draft-avatar-storage-key.md`(신규) | 커밋 후 `git show HEAD:<new-path>`로 반영 확인 권고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | plan 체크리스트 자기모순(WARNING 1) — 나머지 핵심 코드 변경 3갈래는 실측(lint/test 재실행)으로 의도대로 동작 확인 |
| scope | MEDIUM | plan 체크리스트 자기모순 2건(WARNING 1,2) — 코드 변경 자체는 최소 범위, 근거 뚜렷 |
| documentation | MEDIUM | plan 이동 시 dead link 신설(WARNING 3) + 커밋 오귀속 재확산(WARNING 4) — 코드 문서화는 모범적 |
| side_effect | LOW | lint 스코프 실질 확장(INFO 1, 실측상 회귀 없음) + plan 이동 형태(INFO 4) |
| testing | LOW | plan 체크리스트 자기모순(WARNING 1과 동일 건) — 뮤테이션 검증으로 전수성 캐너리·회귀 안전성 직접 확인 |
| dependency | NONE | 의존성 그래프 변경 없음, hoisting 조사는 별도 추적 중(INFO 3) |
| maintainability | NONE | 코드 품질 개선(컨벤션 통일), 상급 타입 패턴 진입장벽 참고(INFO 2) |
| security | NONE | 신규 기능·입력 처리 경로 없음, 인젝션/시크릿/인가 우회 등 미발견. 동봉 spec draft 의 아바타 업로드 설계(UUID obscurity+SVG 제외)는 기존 결정 재확인일 뿐 이번 diff 의 신규 도입 아님 |

## 발견 없는 에이전트

- security — 실질 코드 변경(lint quoting, 타입 술어 리팩터, switch 블록 스코프)에서 보안 결함 없음. 인용된 아바타 업로드 설계는 참고용 문맥일 뿐 CRITICAL/WARNING 판정 대상 아님(리뷰어 자체 판단).

## 권장 조치사항

1. `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` 체크리스트 정정 — `parser.ts:317` 항목(:124-127)을 `[x]`로, "로컬-CI 툴체인 차이" 항목(:118-122)을 실제 근본원인(lint glob quoting)으로 갱신 (WARNING 1, 2)
2. `plan/complete/spec-draft-avatar-storage-key.md:381`의 dead relative link 정정 (`../in-progress/spec-sync-user-profile-gaps.md`) (WARNING 3)
3. `expression-engine-error-shape-spec-broken-on-main.md:35,76,116`의 도입 커밋 오귀속(`4afab7ca1`→`8ff827ef6`) 정정 (WARNING 4)
4. 커밋 후 `git show HEAD:plan/complete/spec-draft-avatar-storage-key.md`로 이동 반영 확인 (INFO 4, 예방적)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, dependency (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)
  - **제외**: 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 성능 특성 변경 없음(lint 스크립트/타입 리팩터/문서 이동) |
  | architecture | 라우터 판단 — 구조적 변경 없음 |
  | database | 라우터 판단 — DB 접근 코드 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 관련 코드 변경 없음 |
  | api_contract | 라우터 판단 — API 계약 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 영향 없음 |