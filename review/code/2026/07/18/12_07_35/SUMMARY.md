# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL/WARNING(security·requirement·scope·side_effect·documentation·user_guide_sync)은 전부 NONE 이나, testing reviewer 가 mutation 실측으로 실제 갭(WARNING 1건)을 확인함. forced(router_safety) 6개 reviewer 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 프로덕션 엔트리포인트 `collectCodeStringLiterals` 가 `.tsx` 파일명으로 테스트 스위트 어디에서도 호출되지 않음. mutation 실측(내부를 `parseGuardSource` 우회하는 `ts.ScriptKind.TS` 하드코딩으로 되돌려도 8개 테스트 전원 green)으로 확인됨 — 이 파일이 스스로 방어하겠다고 선언한 "미래 `.tsx` 사이트" 위협 모델에 대해 증명되지 않은 가정에 의존. 오늘은 모든 `REGISTRY_SITES`가 `.ts` 라 프로덕션 정확성엔 즉각 영향 없음 | `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` — `collectCodeStringLiterals` 정의부(137행 부근), `.tsx`/`.ts` self-test(286·320행 부근) | `.tsx` JSX 자가테스트 옆에 `collectCodeStringLiterals(tsxSite, "result-view.tsx")` 를 직접 호출해 실제 엔트리포인트가 `parseGuardSource` 를 우회하는 회귀도 잡히도록 어서션 추가(가능하면 JSX 속성/표현식 전용 리터럴로 threat model 정확히 겨냥) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` spec/conventions/interaction-type-registry.md 가 이 worktree(fork-point `463aee139`) 기준으로 "grep 가드/grep 검증/grep 대상"이라는 옛 용어를 §1.2 rule 3·§2.1(2곳)·§4·§5(2곳)에 여전히 담고 있으나, 코드(리뷰 대상 두 파일)는 이미 전부 "AST 가드"로 정정됨. fork-point 이후 origin/main 에 별도 PR `22cc48ef3`(#977)이 이미 이 wording 을 해소했고 이 worktree 는 아직 그 커밋을 받지 않은 상태 — 이 changeset 이 만든 drift 가 아님 | `spec/conventions/interaction-type-registry.md` §1.2(56행)·§2.1(77-78행)·§4(124행)·§5(143·154행) | 코드 변경 불필요. main 과 merge/rebase 시 `22cc48ef3` 이 자동 합류하는지만 확인 |
| 2 | Documentation | 파일 최상단 "Adding a new value" 체크리스트가 값-목록 SoT(`interaction-type-registry.ts`)의 `INTERACTION_TYPE_VALUES` 갱신 단계를 명시적으로 나열하지 않음. 다만 `_noMissingInteractionType`(양방향 `Exclude` 컴파일타임 잠금)이 누락 시 `tsc` 를 깨뜨리는 fail-safe 로 최종 발견되므로 완전 미검증은 아님 | `interaction-type-exhaustiveness.test.ts` L48-53(파일 최상단 JSDoc) | 체크리스트에 "`interaction-type-registry.ts` 의 `INTERACTION_TYPE_VALUES`/`IS_MULTI_TURN_INTERACTION` 갱신" 단계 추가 시 컴파일 에러 우회 없이 바로 올바른 순서 안내 가능 |
| 3 | Testing | `.ts` 캐스트 self-test(`"parses a .ts angle-bracket cast as a cast, keeping its literal (not TSX)"`)가 TypeScript 파서의 error-recovery 동작(비공개 구현 세부사항)에 의존 — 향후 `typescript` 메이저 업그레이드가 이 휴리스틱을 바꾸면 가드 로직 회귀 없이도 이 테스트만 flip 될 수 있음 | `interaction-type-exhaustiveness.test.ts` 320행 부근 | 즉각 조치 불요. `typescript` 업그레이드 PR 실패 시 "가드 로직 회귀"보다 "파서 error-recovery 변경"을 먼저 배제하라는 주석을 남겨두면 향후 트리아지 비용 절감 |
| 4 | Maintainability | `WaitingInteractionType`/`ConversationTurnSource` 두 exhaustiveness `describe` 블록(약 42줄)이 사이트·값 목록·라벨만 다르고 완전히 동일한 이중 루프+throw 구조 반복 | `interaction-type-exhaustiveness.test.ts:357-378`, `:396-417` | `assertExhaustiveLiterals(sites, values, enumLabel, specAnchor)` 공용 헬퍼로 추출 가능(현재 2회 반복이라 즉시 강제할 임계치는 아님) |
| 5 | Maintainability | `interaction-type-registry.ts` 의 컴파일타임 exhaustiveness 단언 쌍(`_noMissingInteractionType`/`_noMissingSource`)이 3줄 관용구를 이름만 바꿔 반복 | `interaction-type-registry.ts:34-38`, `:53-55` | 제네릭 헬퍼로 추출 가능하나 TS 타입 레벨 단언 특성상 각 사이트에 구체 타입 직접 바인딩이 필요해 추출 이득이 크지 않음(선택사항) |
| 6 | Maintainability | `readRepoFile` 의 저장소 루트 상대경로가 `"../../../../../"` 단일 문자열로 이어져 있어, 같은 코드베이스의 다른 `__dirname` 유틸(`join(__dirname, "..", "..", "..")` 형태)과 스타일 불일치 — 깊이 확인이 슬래시 개수 세기에 의존 | `interaction-type-exhaustiveness.test.ts:79-82` | `join(__dirname, "..", "..", "..", "..", "..", relPath)` 로 세그먼트 분리 시 기존 관례와 일관, 깊이 검증 용이 |
| 7 | Maintainability | `describe("collectCodeStringLiterals", …)` 블록에 성격이 다른 두 self-test(`parseGuardSource`/`treeContainsJsx` 파스-경로 정합성 검증)가 함께 배치됨 | `interaction-type-exhaustiveness.test.ts:198-344` | `describe("parseGuardSource / treeContainsJsx")` 로 분리 시 실패 시 어느 계약이 깨졌는지 테스트명만으로 더 빠르게 파악 가능(시급하지 않음) |
| 8 | Testing (긍정) | `scriptKindForFile`/`parseGuardSource`/`collectStringLiteralsFrom`/`treeContainsJsx` 로의 함수 분리가 단위 테스트 용이성을 개선하고, PR #972 WARNING #2 급 "자가테스트가 실제 코드 경로와 분리되어 회귀를 못 잡는" 패턴을 상당 부분 방지 | 두 파일 전반 | 없음 — 모범 사례로 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 런타임 코드 아님(테스트+타입 레벨 상수 모듈), 공격 표면 없음 |
| requirement | NONE | mutation 실측으로 "단일 파스 chokepoint" JSDoc 주장 정합성 확인, 기능 완전성 결함 없음. SPEC-DRIFT 1건은 이미 origin/main 별도 PR 로 해소됨 |
| scope | NONE | plan 체크리스트·직전 리뷰(11_39_42) WARNING #1·#2 후속 반영과 diff 가 1:1 대응, 범위 이탈 없음 |
| side_effect | NONE | 신설/변경 함수 전부 비-export 지역 함수, 프로덕션 export 표면·전역 상태·I/O 무변경 |
| maintainability | LOW | 경미한 구조적 중복 4건(INFO) — 헬퍼 추출 여지는 있으나 시급성 낮음 |
| testing | MEDIUM | `collectCodeStringLiterals` 가 `.tsx` 파일명으로 exercise 되지 않음을 mutation 실측으로 확인(WARNING). error-recovery 의존 self-test 1건(INFO) |
| documentation | NONE | JSDoc rationale 품질 높음(git history 대조 검증). 체크리스트 SoT 단계 누락 1건(INFO, fail-safe 존재) |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전수 대조, 매치 0건(enum 값 변경 없음, 주석·테스트 메커니즘 변경만) |

## 발견 없는 에이전트

- user_guide_sync — "발견사항: 없음, 해당 없음"으로 명시적 보고 (doc-sync-matrix 매치 0건)

## 권장 조치사항
1. **(WARNING 대응)** `.tsx` JSX self-test 옆에 실제 엔트리포인트 `collectCodeStringLiterals(tsxSite, "result-view.tsx")` 를 직접 호출하는 어서션을 추가해, 그 함수가 `parseGuardSource` 를 우회하는 회귀도 이 파일 하나로 잡히도록 한다(testing WARNING #1).
2. **(선택, 낮은 우선순위)** `WaitingInteractionType`/`ConversationTurnSource` exhaustiveness `describe` 블록 중복을 공용 헬퍼(`assertExhaustiveLiterals`)로 추출 — 즉시 강제할 임계치는 아님(maintainability INFO #4).
3. **(선택, 낮은 우선순위)** "Adding a new value" 체크리스트에 `interaction-type-registry.ts` SoT 갱신 단계를 명시해 컴파일 에러 우회 발견 대신 직접 안내(documentation INFO #2).
4. **(조치 불요)** spec 문서의 "grep 가드" 잔존 용어(SPEC-DRIFT #1)는 이 changeset 밖 origin/main PR #977 이 이미 해소 — merge/rebase 시 자동 정합 확인만.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (6명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관(테스트/타입 레벨 변경, 런타임 성능 영향 없음) |
  | architecture | router 판단상 이번 diff 와 무관(아키텍처 구조 변경 없음) |
  | dependency | router 판단상 이번 diff 와 무관(신규 의존성 도입 없음) |
  | database | router 판단상 이번 diff 와 무관(DB 접근 코드 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(비동기/동시성 로직 없음) |
  | api_contract | router 판단상 이번 diff 와 무관(API 계약 변경 없음) |