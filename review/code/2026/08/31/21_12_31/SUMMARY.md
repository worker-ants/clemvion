# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 코드 변경(엔진 에러 코드 9지점 리다이렉트 + AST 가드 신설)은 순수 기계적 치환으로 CRITICAL/WARNING 없음. 유일한 실질 WARNING 은 `plan/complete/exec-intake-followups.md` 문서 한 곳의 동기화 갭(3라운드째 같은 결함 클래스가 세 번째 위치에 재발)이며 동작·계약에는 영향 없다. **forced 화이트리스트(7명) 전원 결과 확보 완료 — 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `plan/complete/exec-intake-followups.md` ④ 단락("옮기지 않은 것과 그 이유")이 2R fix(`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 앵커 추가)를 반영하지 못해 여전히 두 카테고리만 나열 — `error-codes.ts` JSDoc·`CHANGELOG.md` 는 이미 3R 에서 세 카테고리로 정정됐으나 이 plan 문서만 원 커밋(`adc4a3ff6`) 시점 그대로 남은, 같은 결함 클래스의 세 번째 미반영 인스턴스 | `plan/complete/exec-intake-followups.md:47-51` | 목록에 세 번째 항목(`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` — `RehydrationError.code` 리터럴 유니온, 생성자 positional 인자, 2R 추가)을 보강 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `ANCHORED_ELSEWHERE` 안 사유(reason) 문자열이 각 4회·2회 완전히 동일하게 복붙됨 (신규 발견) — 근거 서술 변경 시 일부만 고치면 drift 를 잡는 테스트가 없음 | `engine-error-code-anchor-guard.ts:38-45, 49-52` | 그룹별 사유를 상수로 한 번만 선언해 재사용 (우선순위 낮음) |
| 2 | testing | 신설 `EngineErrorCode` 상수에 `ErrorCode` 와 대칭인 전용 형식 검증 테스트(key===value, UPPER_SNAKE) 부재 | `error-codes.spec.ts` (describe 블록 부재), 대상 `error-codes.ts:147` | `describe('EngineErrorCode', …)` 블록 추가 |
| 3 | testing | `ErrorCode`/`EngineErrorCode` 두 네임스페이스 간 키 중복을 막는 테스트 없음 — SoT 분리 원칙을 명시했지만 충돌 시 조용히 "이미 앵커됨" 취급 | `error-codes.ts:8, 147`; 가드 병합 지점 `engine-error-code-anchor-guard.ts:70` | 두 `Object.keys()` 교집합이 빈 집합인지 단언하는 테스트 1개 추가 |
| 4 | testing | `collectBoundCodes` 의 리터럴 표현식 판정이 `StringLiteral` 만 인정 — 템플릿 리터럴/문자열 연결식은 형태 범주 안에서도 우회 가능(설계상 의도된 축소, docstring 미부기) | `engine-error-code-anchor-guard.ts:174-183` | 우선순위 낮음. docstring 에 "리터럴 표현식은 StringLiteral 만" 한 줄 추가 고려 |
| 5 | side_effect | 신규 공개 export 표면 추가(`EngineErrorCode`, `EngineErrorCodeValue`) — 순수 additive, 기존 export 무영향 | `error-codes.ts` | 조치 불요 |
| 6 | side_effect | `ANCHORED_ELSEWHERE`/`CODE_BINDING_NAMES` 가 `readonly`/freeze 없이 mutable 하게 export 됨 — 현재 소비처(단일 spec, 읽기 전용)에서는 실질 위험 없음 | `engine-error-code-anchor-guard.ts:21, 30` | 향후 소비처 증가 시 `Object.freeze`/`ReadonlySet` 고려 |
| 7 | maintainability | `collectBoundCodes` 의 `record()` 경로와 `NewExpression` 분기가 동일한 `hits.push({code, file, line})` 로직을 복사 유지 (기존 유예 재확인, 상태 변화 없음 — "3번째 소비처 등장 시 착수" 트리거 아직 미충족) | `engine-error-code-anchor-guard.ts:174-183, 197-210` | 조치 불요(기존 판단 유지) |
| 8 | scope | 신규 AST 가드 3파일(484줄)이 최소 처방(리다이렉트 9지점)보다 넓음 — plan 명시 산출물 + 저장소 기존 형제 패턴(`redis-fail-open-catalog-guard.ts`) 준수로 스코프 이탈 아님 | `repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,spec.ts}` | 조치 불요 |
| 9 | scope | 누적 diff(42파일) 중 33개는 직전 3라운드 ai-review 산출물 — 저장소 확립 관례(review/code/** 커밋), 무관 기능 혼입 없음 | `review/code/2026/08/31/{20_27_29,20_43_35,20_59_14}/**` | 조치 불요 |
| 10 | requirement | `EngineErrorCode` 경계 규칙이 `EXECUTION_TIME_LIMIT_EXCEEDED` 등 개념상 유사한 `ErrorCode` 소속 엔진 코드에는 소급 적용되지 않음 (알려진 트레이드오프, 1라운드부터 재확인) | `error-codes.ts` (`ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` 등) | 조치 불요 |
| 11 | requirement | spec fidelity 재확인 — `error-codes.md` §3 / `5-system/3-error-handling.md` / `5-system/4-execution-engine.md` 와 실제 코드 대조 결과 일치, `spec_impact: none` 정확 | 해당 spec 문서 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 인젝션·시크릿·인증/인가·입력검증·ReDoS·경로탐색 전부 위험 없음 |
| requirement | NONE | INFO 2건 (경계 미소급 트레이드오프 재확인, spec fidelity 재확인) — Critical/Warning 없음, 테스트 14/14 PASS 재실행 확인 |
| scope | NONE | INFO 2건 (가드 3파일 확장 범위, 이전 라운드 리뷰 산출물 포함) — 은닉/drive-by 변경 없음 |
| side_effect | NONE | INFO 5건 (신규 export 표면, 값 무변경 확인, 읽기전용 가드, mutable export, git rename 정상 처리) |
| maintainability | NONE | INFO 2건 (사유 문자열 반복 — 신규, `record()`/`NewExpression` 중복 — 기존 유예 유지) |
| testing | LOW | INFO 3건 (EngineErrorCode 전용 테스트 부재, 키 중복 방지 테스트 부재, 리터럴 표현식 우회 가능성) — 프로덕션 회귀 테스트 557건 통과 재확인 |
| documentation | LOW | WARNING 1건 (plan 문서 ④ 단락이 2R fix 미반영 — 3번째 위치 재발) — 3R 의 W1/W2/INFO13/INFO14 는 모두 정확히 반영됨 확인 |

## 발견 없는 에이전트

- security (실질 발견 0건 — "확인한 항목" 만 기록, 위험도 NONE)

## 권장 조치사항

1. `plan/complete/exec-intake-followups.md` ④ 단락에 `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 카테고리(2R 추가분)를 보강해 `error-codes.ts` JSDoc·`CHANGELOG.md` 와 3문서 정합을 맞춘다 (WARNING, documentation).
2. (선택) `error-codes.spec.ts` 에 `EngineErrorCode` 전용 형식 테스트 + `ErrorCode`/`EngineErrorCode` 키 중복 방지 테스트를 추가한다 (testing INFO 2·3).
3. (선택) `ANCHORED_ELSEWHERE` 반복 사유 문자열을 상수로 추출한다 (maintainability INFO 1).
4. 나머지 INFO(4~11)는 현재 실질 위험이 없어 조치 불요 — 기록 목적으로만 유지.

## 라우터 결정

- `routing_status`: **all** (전체 7명 강제 실행, router 미사용/전원 화이트리스트)
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보 완료(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |
