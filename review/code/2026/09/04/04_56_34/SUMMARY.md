# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 0건, 9개 reviewer(security/performance/architecture/requirement/scope/side_effect/maintainability/testing/documentation) 전원 성공 응답 확보(forced 화이트리스트 7명 전원 포함, 결과 누락 없음). 남은 것은 INFO 15건뿐이며 대부분 이전 9라운드 리뷰에서 이미 검토·유예가 확정된 항목의 재확인이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | `findCastOffenders`/`findUntypedNullableColumns` 가 동일한 818개 파일 목록의 내용을 캐시 없이 각자 `fs.readFileSync` 로 다시 읽는다 | `nullable-type-lie-cast.spec.ts:81,92,104`, `nullable-type-lie-cast-guard.ts:43-52,104-121` | 조치 불필요 수준(이전 라운드 확정). 다음 접촉 시 파일 내용 1회 로드 후 맵으로 두 함수에 전달하는 구조 고려 가능 |
| 2 | architecture | 테스트 전용 primitive(`collectTsFiles` 등)가 build-exclude 되지 않는 `common/` 레이어에 위치 — dist 에 죽은 코드로 포함됨 | `common/__test-utils__/source-scan.ts:1-22` | 조치 불필요(순수 함수라 실피해 없음). devDependency import 가 추가되는 시점에 재평가 |
| 3 | architecture / maintainability | 범용 스캔 primitive(`collectTsFiles` 등)와 도메인-특정 predicate(`countRawUpdateReturning`, `countNullAsUnknownAsCasts` 등)가 한 모듈에 공존 | `common/__test-utils__/source-scan.ts` | 지금은 분리 비용이 이득보다 큼. predicate 가 3~4개 넘으면 파일 분리 고려 |
| 4 | architecture / maintainability | `collectTsFiles` 위임 1줄 래퍼 이름이 가드마다 4종으로 다름(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`), 1곳은 래퍼 없이 직접 호출 | `audit-action-binding-guard.ts:47-48`, `masked-reject-callers-guard.ts:48-52`, `nullable-type-lie-cast-guard.ts:38-40`, `redis-fail-open-catalog-guard.ts:93-94`, `engine-error-code-anchor-guard.ts:157` | 이미 2R·9R 에서 유예 확정(각 가드 spec 이 이름 참조 중이라 통일 시 별건). 다음에 이 파일들을 개별로 만질 때 통일 검토 |
| 5 | requirement | `collectTsFiles` 는 `root` 미존재 시 `fs.readdirSync` 예외를 그대로 던짐 — 명시적 에러 핸들링 없음 | `common/__test-utils__/source-scan.ts:249-271` | 조치 불필요(대체된 5개 walker 도 동일하게 무방비였고 호출부가 전부 상수/픽스처 경로라 발현 불가 — behavior-preserving 리팩터 범위 내) |
| 6 | requirement | plan 의 planner-턴 후속 항목(`spec/1-data-model.md` §2.9 `next_run_at` 표기, `2-api-convention.md` §2.2 `/api/auth/*` 네임스페이스 예외)이 실재하는 spec 갭으로 확인되었으나 여전히 `[ ]` 상태 | `plan/in-progress/entity-nullable-column-type-mismatch.md` — `## 할 일` | 조치 불필요 — developer 권한 밖(§자기-반증형 소정정 5조건 미충족), 다음 planner 턴에서 흡수 |
| 7 | scope | 한 브랜치에 리팩터(walker 5종 → `collectTsFiles` 통합)와 신규 기능(`findStaleSpecCasts` 가드)이 섞여 있음 | 커밋 `63d5cdaa6` vs `46f464583` | 조치 불필요 — 후자가 전자의 산출물에 의존, 둘 다 plan 이 사전 명시한 항목이라 분리 실익 없음 |
| 8 | scope | plan 문서에 "한 자리만 고치는 버릇" 회고 표(7행) 신규 추가 | `plan/in-progress/entity-nullable-column-type-mismatch.md` | 조치 불필요 — 저장소의 기존 리뷰 이력 기록 관례와 일치 |
| 9 | scope | diff 120개 파일 중 110개가 `review/code/2026/09/04/{01_48_39..04_37_28}/**` 이전 라운드 산출물 | `review/code/2026/09/04/**` | 조치 불필요 — `/ai-review` 워크플로 표준 산출물, gitignore 대상 아님(프로젝트 컨벤션) |
| 10 | side_effect | 9R 조치 커밋(`34ce41086`)의 `collectTsFiles` 이중 호출 → 단일 호출+`filter` 병합이 fs 접근을 줄이는 방향인지 검증 | `nullable-type-lie-cast.spec.ts` (`저장수 전수` describe) | 조치 불필요 — 새 부작용 표면 없음, 순수 읽기 함수·가변 상태 누수 없음 확인됨 |
| 11 | maintainability | `COLUMN_DECL`(`type:` 누락 검사용)과 `WIDENED_DECL`(넓혀진 필드명 수집용)이 "괄호 균형 데코레이터 + 필드 선언" 파싱 구조를 각각 손으로 중복 유지 | `nullable-type-lie-cast-guard.ts:77-78`(`COLUMN_DECL`), `:168-169`(`WIDENED_DECL`) | 지금 통합 불필요(매치 대상이 실제로 다름). 괄호 균형 규칙을 고칠 일이 생기면 그 부분만 공유 헬퍼로 추출 고려 |
| 12 | testing | `widenedEntityFields` 의 동명-충돌 배제 로직이 `@Column` 조합 fixture 로만 검증됨 — `@ManyToOne`/`@OneToOne` 관계 필드끼리의 동명 충돌(저장소에 `user`/`trigger`/`integration` 3건 실재)은 전용 캐너리 없음 | `nullable-type-lie-cast-guard.ts:192-205`(`widenedEntityFields`), 대조 테스트 `nullable-type-lie-cast.spec.ts:344-370` | 급하지 않음(오늘 저장소에서 미발현). `[대조군]` 테스트에 관계 데코레이터 버전을 `it.each` 로 추가하거나 docstring 에 "Column/관계 데코레이터 구분 안 함" 명시 |
| 13 | documentation | 직전 라운드(9R) `documentation.md` 요약의 "잔여 planner-턴 항목 2건" 서술이 실측(3건: §2.9·§2.2·§5.4)과 다름 | `review/code/2026/09/04/04_37_28/documentation.md` | 조치 불필요 — 이번 diff 가 만든 결함 아님(세 항목 모두 `origin/main` 이전부터 존재), 리뷰 산출물 자체는 시점 스냅샷이라 사후 정정 대상 아님 |
| 14 | documentation | `masked-reject-callers-guard.ts`/`redis-fail-open-catalog-guard.ts` 의 위임 함수 docstring 이 `.d.ts` 제외를 언급하지 않음 | 해당 두 파일 | 8R·9R 에서 이미 유예 확정, 재확인 결과도 실질 위험 없음(`src` 하위 `.d.ts` 0개) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 인젝션/시크릿/인증/ReDoS 전 축에서 보안 표면 자체가 없음(정적분석 도구, 신뢰 경로만 스캔) |
| performance | NONE | INFO 1건 — 파일 내용 이중 읽기(조치불요 확정). walker 통합·이중 워크 제거는 검증 완료 |
| architecture | LOW | INFO 3건 — build-exclude 비대칭, 유틸/도메인 predicate 공존, 래퍼 이름 4종 불일치(전부 재확인, 이전 라운드 유예) |
| requirement | LOW | INFO 2건 — 에러 핸들링 부재(기존 동작 유지), plan planner-턴 잔여 항목(개발자 권한 밖) |
| scope | NONE | INFO 3건 — 리팩터+기능 혼재, plan 회고표 추가, review 산출물 포함(전부 조치불요) |
| side_effect | LOW | INFO 1건 — 9R 커밋의 fs 접근 병합 검증(문제없음), 전역상태/fs/env/네트워크 전 축 재확인 |
| maintainability | LOW | INFO 2건 — 정규식 구조 중복(통합 불필요), 래퍼 이름 불일치(유예) |
| testing | LOW | INFO 1건 — 관계 필드(`@ManyToOne`/`@OneToOne`) 동명충돌 배제 전용 fixture 부재 |
| documentation | NONE | INFO 2건 — 9R 리포트 카운트 오류(diff 범위 밖), `.d.ts` 언급 누락(유예) |

## 발견 없는 에이전트

- security — 검토 결과 발견사항 0건(NONE)

## 권장 조치사항

1. (선택) `widenedEntityFields` 의 동명-충돌 배제 로직에 관계 데코레이터(`@ManyToOne`/`@OneToOne`) 조합 대조군 테스트를 `it.each` 로 1건 추가 — 저장소에 실재하는 3건(`user`/`trigger`/`integration`)이 정적으로는 안전해 보이나 캐너리로 고정되어 있지 않음(testing #12).
2. (선택) `COLUMN_DECL`/`WIDENED_DECL` 의 "괄호 균형 데코레이터 파싱" 부분을 다음에 만질 때 공유 헬퍼로 추출 고려(maintainability #11).
3. (선택) `collectTsFiles` 위임 래퍼 4종의 이름을 다음에 해당 가드 파일들을 개별로 만질 기회에 통일(architecture/maintainability #4).
4. (필수 아님, planner 턴) `spec/1-data-model.md` §2.9 `next_run_at` 표기 정정과 `spec/5-system/2-api-convention.md` §2.2 `/api/auth/*` 네임스페이스 예외 — developer 권한 밖이므로 다음 planner 턴에서 흡수(requirement #6).
5. 그 외 항목은 전부 이전 9라운드 리뷰에서 근거를 갖고 조치 불필요로 확정된 것들의 재확인이며 즉각 조치 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단(diff 에 신규/변경 의존성 없음 — 정적분석 도구 리팩터 + plan 문서) |
  | database | router 판단(diff 에 DB 스키마/쿼리 변경 없음 — `.entity.ts` 등 프로덕션 코드 변경 없음) |
  | concurrency | router 판단(diff 가 순수 함수 + 격리된 tmpdir 테스트뿐, 동시성 표면 없음) |
  | api_contract | router 판단(diff 에 API 엔드포인트/DTO 변경 없음) |
  | user_guide_sync | router 판단(diff 가 내부 test-utils/repo-guards 리팩터 + plan 문서, 사용자 대상 문서 영향 없음) |