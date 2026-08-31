# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 급 기능·보안·스코프 결함 없음. `maintainability` 리뷰가 발견한 plan 문서(`exec-intake-followups.md`) 내 "완료" 선언과 "미착수" 옛 메모의 자기모순 1건만 WARNING. 7개 forced reviewer(`security`/`requirement`/`scope`/`side_effect`/`maintainability`/`testing`/`documentation`) 전원 결과 확보됨 — 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `plan/complete/exec-intake-followups.md` ARCH#5 완료 기록에서, 이번 diff가 새로 삽입한 "완료 (2026-08-31)" 선언(21~94행) 바로 아래에 그 완료를 정확히 반증하는 옛 "미착수 확인 (2026-08-29)" 메모(95~110행: "`nodes/core/error-codes.ts` 한 파일에 ... 혼재하고, `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 ... 하드코딩 문자열이다")가 취소선 없이 그대로 남아 자기모순을 이룬다. 같은 파일 128행에 "옛 문장은 취소선으로 남기고 완료 서술을 붙이는" 확립된 관례가 있는데 이번 편집만 따르지 않았다. | `plan/complete/exec-intake-followups.md:21-110` | 95~110행(2026-08-29 블록)을 취소선 처리하거나, "21~94행의 완료 기록으로 대체됨" 한 줄을 덧붙여 시간순을 명확히 한다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | AST 가드의 5형태 스캔 범위 밖에 있는, 이번 diff와 무관한 사전 존재 코드 2곳(`explicitCode === 'LLM_RATE_LIMIT'` 동등비교, `foreach-executor.ts` 의 삼항식 `errorCode`) — 가드가 스스로 문서화한 경계와 정합하는 확인 사항, 결함 아님 | `ai-turn-orchestrator.service.ts:1288`, `foreach-executor.ts:103` | 조치 불요. 확장하려면 별도 후속 항목으로. |
| 2 | Requirement | `EngineErrorCode` 경계 규칙이 `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` 등에는 소급 적용되지 않음 — plan에 "의도된 스코프 축소"로 명시, 이미 타입 앵커 보유 재확인 | `workflow-errors.ts:212` | 조치 불요. |
| 3 | Scope | 신규 AST 가드 3파일(484줄)이 "9지점 리다이렉트"라는 최소 처방보다 넓은 산출물 — 4라운드 연속 "plan 명시 산출물 + 기존 형제 패턴 계승"으로 스코프 이탈 아님 처분 | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,spec.ts}` | 조치 불요. |
| 4 | Scope | 이번 라운드 실질 델타는 직전 라운드(21_12_31) 발견 3건(plan 세 번째 미러, `EngineErrorCode` 형식 검사, 겹침-없음 전제 검사)에 정확히 국한 — 무관한 리팩터링 없음 | `error-codes.spec.ts`, `plan/complete/exec-intake-followups.md` | 조치 불요. |
| 5 | Scope / Side-effect | 누적 diff 55개 중 44개는 1~4라운드 `/ai-review` 산출물(RESOLUTION/SUMMARY/reviewer 리포트/meta.json) — 저장소 관례에 부합하는 의도된 파일시스템 쓰기, 비실행 문서 | `review/code/2026/08/31/{20_27_29,20_43_35,20_59_14,21_12_31}/**` | 조치 불요. |
| 6 | Side-effect | `ANCHORED_ELSEWHERE`/`CODE_BINDING_NAMES` 가 `Object.freeze`/`ReadonlySet` 없이 mutable export — 유일 소비처는 읽기 전용이라 현재 실질 위험 없음(4라운드째 동일 결론) | `engine-error-code-anchor-guard.ts:21,30` | 조치 불요. 소비처가 늘면 freeze 고려. |
| 7 | Testing | `EngineErrorCodeValue` 타입이 아직 어떤 소비처에서도 쓰이지 않는 순수 미사용 export — 형제 `ErrorCodeValue` 패턴 계승 목적의 선제적 대칭 구조로 판단, 기능 갭 아님 | `error-codes.ts:173-174` | 조치 불요. 향후 소비처 생기면 사용. |
| 8 | Documentation | `CHANGELOG.md` 가 4라운드에서 신설된 "설계 전제(무교집합) 검증 테스트" 를 언급하지 않음 — 기존 서술이 틀리거나 자기모순은 아니라 오해 유발 없음 | `CHANGELOG.md` (Unreleased 항목) | 우선순위 낮음. 한 문장 추가 시 서사 완결. |
| 9 | Testing | 4라운드 testing INFO 2건(형식 검사 비대칭·키 충돌 미검증)이 이번 라운드 신규 테스트 3개로 정확히 해소됨을 재실행(32/32 GREEN)으로 확인 — 결함 아님, 확인 기록 | `error-codes.spec.ts:46-66` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 문자열 리터럴→상수 리다이렉트, 값 byte-identical. 시크릿/인젝션/인가 신규 위험 없음. 신규 AST 가드는 읽기 전용·테스트 전용. |
| requirement | NONE | 9지점 값 byte-identical 확인, jest 32/32·tsc 재실행 GREEN. spec 4문서(line-level) 대조 불일치 없음. |
| scope | NONE | `git diff --stat` 전수 대조로 은닉 변경 없음. 실질 델타는 직전 라운드 지적 3건에 정확히 국한. |
| side_effect | NONE | 전역상태/env/네트워크/이벤트 발행 방식 무변화. 유일 인터페이스 변화는 순수 추가 export. |
| maintainability | LOW | plan 문서 내 "완료" 선언과 옛 "미착수" 메모가 취소선 없이 공존 — 자기모순(WARNING 1건). 소스 코드 축은 4라운드째 무결함. |
| testing | NONE | 4라운드 갭(형식 검사·키 충돌) 신규 테스트로 해소 확인(32/32 재실행). `EngineErrorCodeValue` 미사용 export는 INFO. |
| documentation | NONE | 3개 미러 문서(JSDoc/CHANGELOG/plan) 전부 정합 확인(4R W1 fix 반영 재확인). CHANGELOG 소소한 언급 누락은 INFO. |

## 발견 없는 에이전트

security, requirement, scope, side_effect, testing, documentation — Critical/Warning 없음(INFO만 존재하거나 전무).

## 권장 조치사항

1. `plan/complete/exec-intake-followups.md:95-110` 의 2026-08-29 "미착수 확인" 블록을 취소선 처리하거나 "21~94행의 완료 기록으로 대체됨" 한 줄을 추가해, 같은 항목 안에 "완료"와 "미착수"가 시간순과 반대로 공존하는 자기모순을 해소한다. (WARNING #1)
2. (선택, 낮은 우선순위) `CHANGELOG.md` 에 `EngineErrorCode`/`ErrorCode` 무교집합 검증 테스트 신설을 한 문장 추가해 이 세션의 "설계 전제는 전부 테스트로 고정했다" 서사를 완결한다. (INFO #8)

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: `routing=all`. 전체 reviewer(7명: security, requirement, scope, side_effect, maintainability, testing, documentation) 강제 포함(`router_safety`) 실행. 제외된 reviewer 없음. forced 전원 결과 확보됨(누락 없음).
