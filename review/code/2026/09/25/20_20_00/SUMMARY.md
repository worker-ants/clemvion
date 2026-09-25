# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드 변경 없음(README 문서 정정 + unit 테스트 1건 추가). CRITICAL 없음. WARNING 3건(테스트 커버리지 갭 1 · plan 문서 정합성 1 · README 가독성 1)은 모두 비차단. forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `transferOwnership()` 트랜잭션 내 재검사 조건 `!requesterMembership \|\| role !== 'owner'` 의 OR 중 "요청자 멤버십 자체가 소멸(null)"하는 가지가 신규 테스트로도 여전히 미검증. 동시 `leaveWorkspace`/`removeMember` 경합 시 처리되지 않은 예외로 샐 잠재 위험 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `transferOwnership()` 재검사 분기 (신규 테스트: `workspaces.service.spec.ts:1149-1185`) | 형제 케이스 추가 — 무락 선행은 owner, 락 재검사 시 `memberRepo.findOne` 이 요청자 쪽에서 `null` 반환하도록 하여 `!requesterMembership` 가지를 직접 고정 |
| 2 | Documentation | plan 이 `--impl-prep` 경고 W2·W3 를 "트래커(`spec-draft-nullable-notation-followups.md`)에 등재"했다고 서술하지만, 실제로 해당 트래커 파일 어디에도 두 항목의 흔적이 없음(`grep`·`git log` 로 확인) — plan 이 `complete/` 로 이동하면 두 개의 실제 spec 모호성 후속 조치가 영구 유실 위험 | `plan/in-progress/canary-readme-recheck-test.md:30-31` (W2·W3 처분란) | (a) 실제로 트래커에 항목 추가, 또는 (b) "등재"를 "등재 예정"으로 낮추고 plan `## 체크리스트`에 별도 미결 항목으로 남겨 유실 방지 |
| 3 | Maintainability | README 캐너리 절 설명이 한 문장에 두 데코레이터 정의·부팅 거부 조건·조용한 스킵·역할 오판정·cross-tenant 노출까지 5개 개념을 욱여넣어 가독성 저하. 위아래 문단은 불릿으로 나뉘어 있어 국지적 비일관 | `codebase/backend/README.md:52` | 원인→결과 짝으로 불릿 2개 분리 (`@WorkspaceId()` 실패 → 조용한 스킵 / `@WorkspaceParam(...)` 실패 → 역할 오판정) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/DB/Concurrency/Requirement/Architecture (통합) | 신규 테스트가 `transferOwnership` 의 기존 TOCTOU 방어(무락 선행 인가 → 트랜잭션 안 `pessimistic_write` 재검사)를 정확히 고정함을 직접 확인 — role 비교를 제거하는 뮤테이션 주입 시 신규 테스트만 RED, 전체 스위트(98건) 회귀 없음. README 정정 문구도 `workspace-reflection-canary.ts`/`workspace.decorator.ts` 실제 구현·로그 포맷과 line-level 로 정합 | `workspaces.service.ts:756-762`(재검사 분기), `workspaces.service.spec.ts:1149-1185`(신규 테스트), `README.md:52,57-58` | 조치 불요 — 커버리지 보강이 유효함을 다수 리뷰어가 교차 확인 |
| 2 | Maintainability | 신규 테스트가 기존 `setupOwnerLookup` 헬퍼와 거의 동일한 요청자 조회 골격을 인라인으로 재작성 — 소규모 중복 | `workspaces.service.spec.ts:1151-1165` (vs `setupOwnerLookup`, 1068-1094) | 급하지 않음. 필요 시 `setupOwnerLookup` 을 `role` 해석 함수를 받도록 확장 고려 |
| 3 | Maintainability | `memberRepo.findOne` 호출 인자 타입 shape 가 파일 곳곳에 조금씩 다르게 인라인 반복 정의 | `workspaces.service.spec.ts` 여러 곳 (신규 테스트 포함) | 급하지 않음. 필요 시 `type MemberFindOneOpts` 공용 alias 로 추출 |
| 4 | Maintainability | 부팅 로그 설명 불릿이 두 판별의 로그 포맷·부분 파손 조건을 한 문장에 압축해 스캔이 상대적으로 어려움 | `README.md:57` | 급하지 않음. 향후 절 수정 시 하위 불릿/코드 스팬으로 분리 고려 |
| 5 | Architecture | mock 이 TypeORM `lock` 옵션 유무로 owner/admin 을 가르는 방식은 서비스가 락 전략을 바꾸면(예: 낙관적 락 전환) 테스트가 무의미해질 결합을 갖지만, 같은 파일의 기존 `deleteWorkspace` 테스트들도 동일 관용구를 쓰고 있어 새로운 결합 도입은 아님 | `workspaces.service.spec.ts:1152` | 조치 불요. 향후 락 전략 리팩터링 시 이 관용구를 쓰는 테스트(최소 3곳) 동반 갱신 필요성만 인지 |
| 6 | Requirement | 리뷰 입력 diff 번들의 plan 파일(`canary-readme-recheck-test.md`) 스냅샷이 최신 커밋(`c7dd3ef1d`, TEST WORKFLOW 체크 완료)보다 뒤처져 있음 — 실제 디스크 파일은 이미 최신 상태 확인. 코드 결함 아닌 리뷰 하네스의 diff-base 시점 갭 | `plan/in-progress/canary-readme-recheck-test.md` 체크리스트 "TEST WORKFLOW" 항목 | 조치 불요 — 실제 파일은 최신, 리뷰 종결 판정에 영향 없음 |
| 7 | Performance | 신규 테스트의 mock 검증 코드가 `mock.calls` 를 `map` 후 `filter` 로 배열을 두 번 순회 — 테스트 전용, 호출 횟수가 테스트당 최대 2건으로 실질 영향 없음 | `workspaces.service.spec.ts:1176-1180` | 조치 불요 |
| 8 | Maintainability(관측) | 리뷰 진행 중 `workspaces.service.ts` 가 일시적으로 modified 상태로 관측(재검사 조건 중 `role` 비교가 빠진 형태 — plan 상 "뮤턴트 V1" 과 형태 일치)됐다가 즉시 clean 으로 복귀. testing 리뷰어가 같은 세션에서 cp 기반 백업/원복으로 수행한 자체 뮤테이션 검증(위 INFO #1)과 시점·형태가 일치하며, 최종 `git status --short` 로 저장소가 clean 함을 재확인함 | (관측 시점 한정, 파일 자체는 diff 대상 아님) | 조치 불요 — 정상적인 뮤테이션 검증 절차의 일시적 부작용으로 판단, 잔존 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드 변경 없음. README 정정·신규 테스트 모두 정합 확인, 시크릿/인젝션/인가 우회 없음 |
| performance | NONE | 런타임 코드 변경 없음. 테스트 mock 의 이중 배열 순회는 실질 영향 없는 참고 사항 |
| architecture | NONE | 새 아키텍처 표면 없음. 기존 double-checked locking 패턴·잠금 순서 규약과 일관 |
| requirement | NONE | README·신규 테스트 모두 실제 구현과 line-level 정합. plan diff 스냅샷 지연은 하네스 갭(코드 결함 아님) |
| scope | NONE | 실 코드 변경 2파일만 plan 요구와 1:1 대응, 부가 리팩토링 없음. 나머지 9파일은 규약상 정상 산출물 |
| side_effect | NONE | 상태/전역변수/파일시스템/인터페이스 등 8개 축 모두 저촉 없음. 테스트 격리 양호 |
| maintainability | LOW | README 초장문 문장 가독성(WARNING) + 소규모 테스트 중복·타입 반복(INFO) |
| testing | LOW | 신규 테스트 뮤테이션 검증으로 유효성 확인(GREEN/RED) + 재검사 OR 조건 중 null 가지 미검증(WARNING) |
| documentation | LOW | README·테스트 문서 정합 양호하나, plan 의 "트래커 등재" 주장이 실제로는 미등재(WARNING) |
| dependency | NONE | 의존성 매니페스트·임포트 변경 없음, 검토 대상 자체 없음 |
| database | NONE | DB 접근 코드 변경 없음. 기존 이중검사 락 패턴이 올바르게 구현돼 있음을 확인 |
| concurrency | NONE | 신규 동시성 코드 없음. TOCTOU 방어 분기·잠금 순서 모두 기존 그대로 정상 |
| api_contract | NONE | 컨트롤러/DTO/라우트/응답 계약 변경 없음, 검토 대상 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전수 대조, 매칭 0건(README 변경은 자기충족적 target 이행) |

## 발견 없는 에이전트

security, performance, scope, side_effect, dependency, database, concurrency, api_contract, user_guide_sync — 모두 위험도 NONE, 확인 성격의 INFO 외 별도 조치 필요 발견사항 없음.

## 권장 조치사항

1. `transferOwnership()` 재검사 OR 조건의 "요청자 멤버십 소멸(null)" 가지를 고정하는 형제 unit 테스트 추가 (WARNING #1).
2. `plan/in-progress/canary-readme-recheck-test.md` 의 W2·W3 "트래커 등재" 서술을 실제 등재로 이행하거나, "등재 예정"으로 정정하고 plan 체크리스트에 별도 미결 항목으로 남겨 `complete/` 이동 전 유실 방지 (WARNING #2).
3. (선택, 급하지 않음) `README.md:52` 의 과밀 문장을 원인→결과 불릿 2개로 분리해 가독성 개선 (WARNING #3).
4. (선택, 급하지 않음) `workspaces.service.spec.ts` 의 `setupOwnerLookup` 소규모 중복과 `memberRepo.findOne` 인자 타입 반복 정의는 다음 리팩터링 기회에 정리 (INFO #2, #3).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. 전체 reviewer 14명 실행(제외 없음).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음).
- **실행**: 위 14명 전원(`security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`).
- **제외**: 없음.
