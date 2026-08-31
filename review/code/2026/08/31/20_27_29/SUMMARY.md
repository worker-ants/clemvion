# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 리팩터(맨 문자열 에러 코드 9지점 → `EngineErrorCode`/`ErrorCode` 상수 리다이렉트 + AST 회귀 가드 신설)로 CRITICAL/기능적 결함 없음. 유일한 실질 이슈는 `CHANGELOG.md` 미갱신(WARNING 1건). forced(router_safety) 7개 reviewer 전원(`security`/`requirement`/`scope`/`side_effect`/`maintainability`/`testing`/`documentation`) 결과 정상 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `CHANGELOG.md` 에 이번 변경(신규 `EngineErrorCode` 레이어 신설 + 9지점 리다이렉트 + AST 앵커 가드 추가)에 대한 항목이 없음 — 이 저장소는 동작 변경이 없는 가드/하드닝성 변경도 `## Unreleased` 에 일관되게 기록해 온 확립된 관례가 있음(예: 최근 "raw UPDATE/DELETE … RETURNING 회귀 가드" 항목) | `CHANGELOG.md` (이번 diff 8개 파일에 미포함) | `## Unreleased` 섹션에 리다이렉트 지점·설계 근거(파일은 하나·const 는 둘)·AST 가드 신설을 요약한 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | 가드 spec 의 문턱값(`declared.size > 30`, `reason.length > 20`)에 왜 그 숫자인지 근거 주석이 없음 | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts` | 근거를 한 줄 주석으로 남기거나, `ANCHORED_ELSEWHERE` 크기처럼 실제 개수 기반 동적 계산으로 전환 |
| 2 | testing | `findUnanchored` 자체의 위반-검출 경로가 저장소가 "현재 클린"한 상태에만 간접 의존 — 픽스처를 겨냥한 positive-path(위반이 실제로 검출된다) 단위 테스트가 없음 | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:200-204` (`findUnanchored`) | `collectBoundCodes` 처럼 `relDir` 파라미터를 열어 `__tests__` 픽스처 디렉터리를 대상으로 "앵커 없는 `FIXTURE_*` 코드가 검출된다" 테스트 추가 |
| 3 | requirement | fixture 파일 상단 `/* eslint-disable @typescript-eslint/no-unused-vars */` 가 실제로는 불필요(전부 export 되어 애초에 위반 없음) — eslint 가 "Unused eslint-disable directive" 경고 | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-fixture.ts:15` | 지시어 제거 (또는 `eslint --fix`) |
| 4 | testing | 리다이렉트 대상 3서비스의 기존 회귀 테스트는 여전히 맨 문자열로 코드 값을 단언(`toBe('LLM_RATE_LIMIT')` 등) — 값이 동일해 현재는 안전(568/568 GREEN 확인)하나, 향후 코드값 리네임 시 "테스트만 초록, 상수는 이미 바뀜" drift 를 못 막음 | `execution-engine.service.spec.ts:5049,5077,5091` 외, `shutdown-state.service.spec.ts:133`, `ai-turn-orchestrator.service.spec.ts:980-1191` | 필수 아님 — 후속으로 테스트도 `EngineErrorCode`/`ErrorCode` 상수 참조로 전환 고려 |
| 5 | maintainability | `EngineErrorCode` JSDoc 과 `ANCHORED_ELSEWHERE`(가드 파일)의 "왜 옮기지 않았는가" 서술이 부분 중복 — 한쪽만 갱신되면 stale 해질 여지 | `codebase/backend/src/nodes/core/error-codes.ts` vs `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` | 현재는 통합 불요. 향후 `ANCHORED_ELSEWHERE` 항목이 늘면 JSDoc 쪽을 "가드 소스 참조"로 축약하는 방향 고려 |
| 6 | requirement | `EngineErrorCode` 신설의 경계 규칙("엔진 자신이 싣는 값")이 `EXECUTION_TIME_LIMIT_EXCEEDED` 등 개념상 동일한 자매 코드에는 소급 적용되지 않음 — 다만 plan 완료 기록(`exec-intake-followups.md`)이 이를 의도된 스코프 축소로 명시 | `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` 등) | 조치 불요(문서화된 트레이드오프). 후속 `EngineErrorCode` 확장 시 경계 판단 기준을 JSDoc 에 한 줄 보강 권장 |
| 7 | side_effect | plan 문서 이동(`in-progress/` → `complete/`)이 `git mv` 가 아니라 delete+add 형태 — 이 저장소는 과거 "git mv + multi-pathspec add" 로 인한 침묵 stale 커밋 이력이 있음 | `plan/in-progress/exec-intake-followups.md` → `plan/complete/exec-intake-followups.md` | 커밋 전 `git show HEAD:plan/complete/exec-intake-followups.md` 로 최종 스테이징 내용 재확인 |
| 8 | scope | 신규 회귀 가드 3파일(약 360줄)이 "9개 맨 문자열 리다이렉트"라는 최소 요청보다 넓은 산출물 — 다만 저장소에 이미 존재하는 형제 패턴(`redis-fail-open-catalog-guard.ts`+spec)을 그대로 따랐고 plan 문서가 이를 작업 산출물로 명시해 스코프 이탈로 보기 어려움 | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}` (전부 신규) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견사항 없음 — 문자열 값 치환 전후 완전 동일, 인젝션/시크릿/인증/암호화 관점 신규 위험 없음 |
| requirement | NONE | INFO 3건. 실행 검증: `engine-error-code-anchor.spec.ts` 11/11, 영향받는 3개 서비스 spec 568/568, `tsc`/`eslint` 클린, 맨 문자열 잔존 없음(grep) |
| scope | NONE | INFO 1건(가드 파일이 저장소 기존 관례를 따른 확장, 스코프 이탈 아님). `git diff --stat` 대조로 은닉 변경 없음 확인 |
| side_effect | NONE | INFO 5건(신규 public export, 문자열 값 일치, import 경로, repo-guard read-only, plan 이동 확인) — 전역 상태/네트워크/이벤트 발행 영향 없음 |
| maintainability | NONE | INFO 2건(가드 spec 매직넘버 근거 부족, JSDoc-가드 서술 부분 중복). 컨벤션 일관성·중복 없는 AST 로직은 긍정 평가 |
| testing | NONE | INFO 3건(findUnanchored positive-path 테스트 부재, 기존 테스트 맨문자열 유지, premise 테스트 설계 우수). 568건 회귀 테스트 실측 GREEN |
| documentation | LOW | WARNING 1건(`CHANGELOG.md` 미갱신). JSDoc/SoT 링크/양방향 plan 링크 등 나머지 문서화는 전부 정확함을 교차검증 |

## 발견 없는 에이전트

- **security** — 발견사항 없음(명시적으로 "없음"으로 보고, 참고 확인 사항만 기록)

## 권장 조치사항

1. `CHANGELOG.md` `## Unreleased` 섹션에 이번 변경(엔진 에러 코드 9지점 리다이렉트 + `EngineErrorCode` 신설 + AST 앵커 가드) 항목 추가 — 유일한 WARNING (documentation)
2. (낮은 우선순위) `engine-error-code-anchor-fixture.ts:15` 의 불필요한 `eslint-disable` 지시어 제거
3. (낮은 우선순위) `findUnanchored` 에 `relDir` 파라미터를 열어 픽스처 기반 positive-path 위반 검출 단위 테스트 추가
4. (낮은 우선순위) 가드 spec 의 매직넘버(30/20)에 근거 주석 추가 또는 동적 계산으로 전환
5. (선택) 커밋 전 `git show HEAD:plan/complete/exec-intake-followups.md` 로 plan 문서 이동 최종 내용 재확인

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 전원, 결과 전원 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(순수 문자열 리다이렉트 + 읽기 전용 AST 가드)와 무관 |
  | architecture | 아키텍처 구조 변경 없음(같은 파일 내 const 추가) |
  | dependency | 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 외부 API 계약 변경 없음(문자열 값 불변) |
  | user_guide_sync | 사용자 가이드 대상 변경 없음(내부 리팩터) |
