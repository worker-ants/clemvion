# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 리팩터(엔진 에러 코드 9지점 맨 문자열 → `EngineErrorCode`/`ErrorCode` 상수 리다이렉트 + 신규 AST 회귀 가드)로 CRITICAL·기능적 WARNING 없음. 유일한 WARNING 2건은 documentation 관점 — 2라운드 fix(생성자 positional 인자 스캔 확장 + `RESUME_*` 앵커 추가)가 상위 산문 문서(`error-codes.ts` JSDoc, `CHANGELOG.md`)에 역전파되지 않아 두 곳 모두 "옮기지 않은 것" 목록이 실제보다 한 카테고리 적게 서술됨.

7개 reviewer(security, requirement, scope, side_effect, maintainability, testing, documentation) 전원 forced 목록에 포함되어 실행되었고, 전원 결과 확보(success, 전문 인라인 확보 + 디스크 파일 존재 확인). 누락·재시도 필요 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `EngineErrorCode` JSDoc 의 "여기 있는 것 / 없는 것" bullet 목록이 실제 `ANCHORED_ELSEWHERE` 레지스트리보다 한 카테고리 적다 — 2라운드에서 추가된 `RehydrationError` 생성자 positional 인자 그룹(`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`)이 "아래 둘" 목록에서 빠짐. 같은 docstring 안 바로 다음 문단(137~141행)은 이 fix 를 정확히 인용하는데 위 목록만 fix 이전 상태에 멈춰 있어 자기모순 | `codebase/backend/src/nodes/core/error-codes.ts:132-135` | 133~135행 사이에 세 번째 bullet(`RehydrationError.code` 생성자 positional 인자) 추가, "아래 둘" → "아래 셋" 정정 |
| 2 | documentation | `CHANGELOG.md` 의 "옮기지 않은 것도 있다" 단락도 동일하게 두 카테고리만 나열 — `RESUME_*`/`RehydrationError` 그룹이 빠져 원 커밋 시점 서술에서 2라운드 fix 이후 갱신되지 않음. 이 저장소는 가드/하드닝성 변경도 CHANGELOG 에 정확히 기록하는 확립된 관례가 있음(1라운드 W1 이 이 관례 근거로 지적됨) | `CHANGELOG.md:20-24` | 2라운드 fix(생성자 인자 스캔 확장, `RESUME_*` 앵커 추가, "6번째 형태에서 멈춘" 경계 결정) 반영 문단 추가 또는 최소 "옮기지 않은 것" 목록에 세 번째 그룹 보강 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | diff 32개 파일 중 21개가 이번 작업 자체가 아니라 선행 두 리뷰 라운드(`20_27_29`, `20_43_35`)의 산출물 — 프로젝트 표준 저장 위치 관례(`review/code/**` 커밋)에 부합, 무관 작업 혼입 아님 | `review/code/2026/08/31/{20_27_29,20_43_35}/**` | 조치 불요 |
| 2 | scope | 신규 회귀 가드 3파일(480줄)이 "9지점 리다이렉트"라는 원 처방보다 넓은 산출물 — plan 문서(`exec-intake-followups.md` ARCH#5)가 명시한 산출물이고 저장소 기존 형제 가드 패턴(`redis-fail-open-catalog-guard.ts`)을 그대로 따름 | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}` | 조치 불요 |
| 3 | scope | 2라운드 가드 스캔 범위 확장(생성자 positional 인자 형태 추가)은 원 diff 이후 발생한 후속 커밋 — `20_43_35` WARNING 대응으로 정상적 결함 수정, 6번째 형태(일반 메서드 인자)에서 스스로 경계 확정 | `engine-error-code-anchor-guard.ts:126-152` | 조치 불요 |
| 4 | side_effect | 리다이렉트된 값 전부 원본 리터럴과 동일 — DB 영속값/FE·알림 분기 계약 무변경 | `error-codes.ts`, `execution-engine.service.ts`, `shutdown-state.service.ts`, `ai-turn-orchestrator.service.ts` | 조치 불요 |
| 5 | side_effect | 신규 export(`EngineErrorCode`, `EngineErrorCodeValue`)는 barrel 재수출 없어 표면 국소적, 순수 additive | `error-codes.ts` | 조치 불요 |
| 6 | side_effect | 신규 repo-guard 3파일은 파일시스템 read-only, jest `testRegex`(`.*\.spec\.ts$`)로 `-guard.ts`/`-fixture.ts` 는 별도 스위트로 수집 안 됨 | `engine-error-code-anchor-guard.ts` | 조치 불요 |
| 7 | side_effect | plan 문서 이동(`in-progress` → `complete`)은 git rename 으로 정상 인식(delete+add 아님) | `plan/complete/exec-intake-followups.md` | 조치 불요 |
| 8 | side_effect | `ANCHORED_ELSEWHERE` 예외 목록 크기 변동(`RESUME_FAILED` 제거)에도 하한 단언(`.length >= Object.keys(...).length`)이 상대적 결속이라 vacuous 하지 않음 확인 | `engine-error-code-anchor.spec.ts`, `engine-error-code-anchor-guard.ts` | 조치 불요(확인 기록) |
| 9 | maintainability | `collectBoundCodes` 내 hit 기록 로직이 두 곳에 중복 — `record()` 클로저 경로와 생성자 positional 인자 분기가 같은 `hits.push({code,file,line})` 로직을 각각 보유(4번째 형태 추가 시 신규 발생, 5줄 내외) | `engine-error-code-anchor-guard.ts:178-182`(record), `:203-209`(생성자 분기) | 우선순위 낮음. `pushHit()` 헬퍼로 분리해 `record()`와 생성자 분기 양쪽이 재사용하도록 |
| 10 | maintainability | `unwrapAsExpression` 패턴 + 픽스처 디렉터리 경로 리터럴 중복 — 2라운드부터 이미 지적·의도적 미조치("3번째 소비처 생기면 착수"), 이번 라운드도 소비처 2곳으로 변화 없음 | `readDeclaredCodes`(86-88행), `collectBoundCodes`(193-195행); `engine-error-code-anchor.spec.ts:72,111` | 조치 불요(기존 판단 유지) |
| 11 | testing | 대상 3서비스의 기존 회귀 테스트가 여전히 맨 문자열로 코드값 단언 — "상수 참조로 바꾸면 리네임 회귀를 오히려 못 잡는다"는 근거로 1라운드부터 의도적 미조치, 근거 유효 | `ai-turn-orchestrator.service.spec.ts:983` 등 | 조치 불요(기존 판단 유지) |
| 12 | testing | `findUnanchored` positive-path 미검증 갭 — 2라운드에서 `relDir` 개방 + positive-path 테스트 신설로 이미 해소, 이번 라운드 코드 불변 재확인 | `engine-error-code-anchor-guard.ts` | 조치 불요(완료됨) |
| 13 | documentation | 가드 spec 주석의 예시 수치("가장 짧은 것이 45자")가 실측(AST 파싱 결과 최소값 64자, `ERROR_PORT_FALLBACK`)과 다름 — 테스트 통과(`>20`)엔 영향 없으나 근거 수치 자체가 틀림 | `engine-error-code-anchor.spec.ts:140` | "45자" → "64자"로 정정 또는 구체 수치 제거. 우선순위 낮음 |
| 14 | documentation | `plan/complete/exec-intake-followups.md` 의 "완료" 서술이 "테스트 11건"이라 적었으나 최종 상태는 14건(2라운드 fix 반영) — 1라운드 시점 개수로 소급 갱신 안 됨 | `plan/complete/exec-intake-followups.md:58` | "테스트 11건" → "테스트 14건"으로 갱신 또는 라운드별 명시 |

## SPEC-DRIFT

없음. requirement reviewer 가 `[SPEC-DRIFT]` 태그를 부여한 발견사항 없음 — 4개 신규 상수 값·상태 전이 서술이 spec 문서와 line-level 로 일치함을 확인.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 순수 리팩터, 인젝션·시크릿·인가·에러 노출 정책 영향 없음 |
| requirement | NONE | 발견 없음 — 9지점 리다이렉트 100% 완결, spec 4개 문서와 line-level 일치, 이전 라운드 WARNING(생성자 인자 스캔 누락) 해소 확인 |
| scope | NONE | 발견 없음 — diff 가 payload/plan 서술과 100% 일치, 은닉 변경 없음. INFO 3건(리뷰 산출물 포함, 가드 확장 등은 관례·정상 대응) |
| side_effect | NONE | 발견 없음 — 리다이렉트 값 완전 동일, barrel 재수출 없음, repo-guard read-only. INFO 5건 |
| maintainability | NONE | INFO 2건 — hit 기록 로직 5줄 내외 신규 중복 1건, 기존 처분 유지 1건 |
| testing | NONE | 코드 변경 없음(2라운드 이후), 가드 spec 14/14 + 서비스 spec 101/101 GREEN 실행 확인. INFO 2건(모두 기존 처분 재확인) |
| documentation | LOW | WARNING 2건 — 2라운드 fix 가 `error-codes.ts` JSDoc·`CHANGELOG.md` 에 역전파 안 됨(자기모순 상태). INFO 2건(주석 수치 오류, plan 테스트 개수 오래됨) |

## 발견 없는 에이전트

- security — 검토 관점 전체(인젝션/시크릿/인가/입력검증/OWASP/암호화/에러노출/의존성)에서 위험 없음
- requirement — 기능 완전성·spec fidelity 확인 결과 CRITICAL/WARNING 없음

## 권장 조치사항

1. `error-codes.ts:132-135` 의 `EngineErrorCode` JSDoc bullet 목록에 세 번째 카테고리(`RehydrationError` 생성자 positional 인자 — `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`) 추가하고 "아래 둘" → "아래 셋"으로 정정 (WARNING 1)
2. `CHANGELOG.md:20-24` 의 "옮기지 않은 것" 단락에 2라운드 fix(생성자 인자 스캔 확장, `RESUME_*` 앵커 추가, 6번째 형태에서 멈춘 경계 결정) 반영 (WARNING 2)
3. (낮은 우선순위) `engine-error-code-anchor.spec.ts:140` 주석 수치 "45자" → 실측 "64자"로 정정
4. (낮은 우선순위) `plan/complete/exec-intake-followups.md:58` "테스트 11건" → "테스트 14건"으로 갱신
5. (낮은 우선순위, 선택) `engine-error-code-anchor-guard.ts` 의 hit 기록 로직 중복(178-182행/203-209행)을 `pushHit()` 헬퍼로 통합 — 가드/테스트 전용 코드라 긴급성 낮음

## 라우터 결정

- `routing=all` (라우팅 모드: 전체 실행)
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 forced, 전원 결과 확보 확인됨 (미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |
