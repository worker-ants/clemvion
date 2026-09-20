# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건 모두 기능 결함이 아닌 문서/커밋구성 정확성 이슈(1건은 이미 이전 라운드에서 처분 확인된 재확인). 나머지는 전부 1차 리뷰(17_35_12) WARNING 조치가 실제로 유효함을 12개 reviewer 가 교차 확인한 INFO. forced reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서(주석 drift) | 트랜잭션 블록 인라인 주석이 아직 존재하지 않는 `plan/complete/rotate-lost-update.md` 경로를 인용(실제는 `status: in-progress` 인 `plan/in-progress/rotate-lost-update.md`). 같은 diff 의 다른 세 곳(CHANGELOG, spec-draft 문서, e2e 주석)은 정확한 경로를 쓴다. 저장소에 동일 유형 stale 참조 선례(`integration-oauth.service.ts:2066` → 존재하지 않는 plan 인용)가 이미 있어 새 결함 클래스는 아니다. (requirement·documentation 두 reviewer 공통 지적) | `codebase/backend/src/modules/integrations/integrations.service.ts:1165` | plan 이 실제로 이동하는 시점에 맞춰 경로를 갱신하거나, `CHANGELOG.md` 방식대로 디렉터리 없이 파일명만 인용해 향후 이동에 무관하게 만든다 |
| 2 | 스코프 | 커밋 `f3ea25d02` 에 이번 작업과 무관한 main Gate C(YAML frontmatter quoting) 수정 1줄이 함께 묶여 있음. 되돌리면 게이트가 재실패하므로 1차 리뷰 `RESOLUTION.md` WARNING 7 이 이미 "유지" 로 처분한 사안 — 이번 라운드는 그 상태가 변함없음을 재확인한 것으로 신규 결함은 아니다 | `plan/complete/spec-draft-integration-error-facts.md:2` | 추가 조치 불요(이미 처분됨). 향후 "선행 PR 이 깨뜨린 게이트 수정"과 "이번 기능 변경"이 겹치면 커밋을 분리하는 습관 권고 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/5-integration.md` 의 rotate 서술이 이번에 코드로 들어온 `pessimistic_write` 재읽기 잠금 메커니즘(락 안 재읽기+재검증)을 언급하지 않아, 같은 문서 안 형제 흐름(reauthorize/request_scopes, 잠금 명시)과 정보 비대칭이 생긴다. 코드는 의도적으로 옳다(`plan/in-progress/rotate-lost-update.md` §B·D, `/consistency-check --impl-prep`(`review/consistency/2026/09/20/16_58_56`) BLOCK:NO 로 사전 검증) — spec 서술이 그 개선을 아직 못 따라간 것. requirement·documentation 두 reviewer 공통 지적이며, 이미 `--impl-prep` cross_spec INFO#1 이 "비차단, `spec_impact: none` 유지 가능(선택 사항)" 으로 처분함 | `spec/data-flow/5-integration.md` (rotate 서술 blockquote) | 코드는 그대로 두고, "rotate 도 동일하게 연결 테스트 이후 `pessimistic_write` 로 재읽어 병합한다(CONC H-3 동일 패턴)" 한 줄을 추가하는 spec draft 를 project-planner 경로로 넣는 것을 권장(필수 아님, 이미 유예된 선택 사항) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/아키텍처 | 1차 리뷰 WARNING(락 전/후 권한재검사·머지+구조검증 로직 복제)이 `assertCanRotate`/`mergeAndValidateCredentials` private 헬퍼로 정확히 해소됨. 두 헬퍼는 `Pick<Integration,...>` 최소 인터페이스 + "왜 두 지점에서 쓰이는지" 설명하는 JSDoc 을 갖춤 (architecture·maintainability·concurrency·side_effect 공통 확인) | `integrations.service.ts:1082`(assertCanRotate), `:1100`(mergeAndValidateCredentials) | 조치 불요 |
| 2 | 아키텍처 | `rotate()` 가 144→104줄로 줄었지만 여전히 인가·도메인검증·외부I/O·트랜잭션·감사·이벤트 발행을 한 메서드가 오케스트레이션. 지금 복잡도는 임계 미도달 | `integrations.service.ts:1121-1224` | 세 번째 유사 트랜잭션 unit-of-work 사례가 생기면 그때 커맨드/파이프라인 형태로 재구성 고려 |
| 3 | 성능 | 락 안 `update()` 후 별도 `findOne()` 재조회 — SELECT 왕복 1회 추가(PK 조회라 영향 미미) | `integrations.service.ts` rotate() 트랜잭션 콜백 하단 | `returning('*')` 로 UPDATE+조회 병합 가능하나 우선순위 낮음 |
| 4 | 동시성/side-effect/DB/테스트 | 1차 리뷰 WARNING 6(e2e `BEGIN`~`COMMIT` 무방비 구간) 조치가 실패 경로에서도 DB 행 락·대기 중인 `pending` 요청을 `try/finally` 로 정확히 정리함을 4개 reviewer 가 교차 확인 | `integration-rotate-concurrency.e2e-spec.ts` (BEGIN~finally 블록) | 조치 불요 |
| 5 | 테스트 | 신규 뮤테이션 커버리지 테스트(workspaceId 스코핑, freshErrors 재검증)가 후속 리팩터(두 검증 로직이 공유 헬퍼로 통합)로 판별력을 잃지 않았는지 testing reviewer 가 새 뮤턴트로 직접 재검증 — GREEN 141 / RED 1(신규 테스트만) | `integrations.service.spec.ts:1381,1429` | 조치 불요. 일반 습관: 뮤테이션으로 정당화한 테스트 직후 같은 PR 에서 그 코드를 리팩터하면 리팩터 후 뮤턴트를 한 번 더 재실행 |
| 6 | 요구사항 | spec §8 "Personal → 본인 것만" 권한이 `assertCanRotate` 에 코드로 강제되지 않음(organization-scope 만 검사) — `git show` 대조 결과 이번 PR 이전부터 동일했던 기존 갭, 이번 diff 의 회귀 아님 | `integrations.service.ts` assertCanRotate | 이번 PR 범위 조치 불요. 별도 트래커로 "personal-scope 통합 소유자 검증 부재" planner 전달 권장 |
| 7 | 문서화(프로세스 관측) | documentation reviewer 가 검토 도중 `integrations.service.ts` 작업 트리에 자신이 만들지 않은 uncommitted 뮤테이션(`mergeAndValidateCredentials` 호출을 인라인 merge 로 되돌린 형태)을 일시 관측 — 병렬 세션/이전 뮤테이션 테스트의 원복 누락으로 추정. `git checkout`/`restore` 사용 금지 지침에 따라 되돌리지 않고 커밋 스냅샷 기준으로만 분석. **SUMMARY 작성 시점 재확인 결과 `git status --short` 클린 — 이미 해소됨** | `codebase/backend/src/modules/integrations/integrations.service.ts` (일시적) | 조치 불요(자연 해소 확인). 향후 유사 관측 시 세션 소유자 원복 여부부터 확인할 것 |
| 8 | DB/동시성 | 락 대기 상한(lock/statement timeout) 없음, `authType` 락 안 재검증 없음 — 둘 다 기존에 문서화된 의도적 유예(임계구간에 외부호출 없어 대기 밀리초)·불변 전제(authType 은 생성 후 불변)로, 신규 리스크 아님 | `integrations.service.ts` rotate() 트랜잭션 블록 | 조치 불요, rotate 호출 빈도 급증 시 재검토 |
| 9 | 유저 가이드 동반 갱신 | `doc-sync-matrix.json` 20개 trigger 전수 매칭 결과 0건 매칭 — 신규 필드/에러코드/엔드포인트/UI 문자열 없음, 외부 계약(성공 200·실패 시 기존 값 유지) 불변 확인 | `.claude/config/doc-sync-matrix.json` 대조 | 갱신 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 헬퍼 통일로 보안 직결 로직 drift 위험 제거(긍정), 신규 인젝션/시크릿 노출 없음 |
| performance | NONE | 트랜잭션 임계구간 짧고 외부 I/O 밖에 위치, update+재조회 병합 여지는 INFO |
| architecture | LOW | 1차 WARNING(로직 복제) 해소 확인, rotate() 절차형 오케스트레이션 잔존은 INFO |
| requirement | LOW | plan 경로 주석 오류(WARNING), spec 잠금 서술 누락(SPEC-DRIFT), personal-scope 권한갭(기존, INFO) |
| scope | LOW | f3ea25d02 무관 커밋 혼입(WARNING, 이미 처분), 나머지 범위 정확 |
| side_effect | LOW | e2e try/finally 로 1차 WARNING(트랜잭션·pending 누수) 해소 확인 |
| maintainability | NONE | 헬퍼 추출로 중복 해소, 변수명 drift 는 JSDoc 으로 설명됨 |
| testing | NONE | 리팩터 후에도 신규 테스트 판별력 유지를 재-뮤테이션으로 실측 확인, 수치 일치 |
| documentation | LOW | plan 경로 주석 오류(WARNING, requirement 와 동일 건), 검토 중 일시적 dirty 상태 관측·해소 |
| database | LOW | DB 동작 자체 변경 없음, 락 타임아웃 부재 등은 기존 유예 사항 |
| concurrency | LOW | 헬퍼 추출이 behavior-preserving 임을 확인, e2e 정리 로직이 실제 커넥션 누수 차단 |
| user_guide_sync | NONE | 매트릭스 20개 trigger 전수 매칭 0건, 갱신 불요 |

## 발견 없는 에이전트

- user_guide_sync — 매트릭스 20개 trigger 중 매칭 0건, "해당 없음"으로 명시적 결론

## 권장 조치사항

1. `codebase/backend/src/modules/integrations/integrations.service.ts:1165` 의 인라인 주석 경로를 `plan/in-progress/rotate-lost-update.md` 로 정정하거나 파일명만 인용하도록 변경한다 (WARNING #1).
2. (선택, 비차단) `spec/data-flow/5-integration.md` 의 rotate 서술에 `pessimistic_write` 재읽기 잠금 메커니즘 한 줄을 추가하는 spec draft 를 project-planner 경로로 고려한다 (SPEC-DRIFT #1) — 코드 revert 아님, spec 갱신만.
3. 이번 PR 범위 밖 항목으로, personal-scope 통합의 "본인 것만" 소유자 검증 부재를 별도 트래커에 기록해 planner 에 전달한다 (INFO #6, 회귀 아님).
4. WARNING #2(무관 커밋 혼입)는 이미 처분됨 — 향후 유사 상황에서 게이트 수정과 기능 변경 커밋을 분리하는 습관만 권고.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync (12명)
  - **제외**: 표 (2명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(사유 상세 미제공 — 이번 diff 에 의존성 파일(package.json/lock 등) 변경 없음으로 추정) |
  | api_contract | 라우터 판단(사유 상세 미제공 — controller/DTO 변경 없어 API 계약 불변으로 추정) |
