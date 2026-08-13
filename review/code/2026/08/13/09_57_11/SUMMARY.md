# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 전 9개 reviewer(강제 7명 전원 포함)가 결과를 확보했고, 직전 라운드(`08_36_21`)가 낸 WARNING 5건이 이번 diff 로 전부 해소됐음을 다수 reviewer 가 코드 직접 열람·테스트 실행으로 재확인했다. 남은 것은 INFO 수준 관찰뿐이며 즉시 조치가 필요한 항목은 없다.

> **강제 화이트리스트 이행 확인**: router 가 forced 로 지정한 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`)이 모두 결과를 반환했다(누락 없음). skipped 5명(`performance, dependency, database, concurrency, api_contract`)은 router 판단으로 제외됐다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `idempotency.interceptor.spec.ts` 가 1341줄로 계속 커지며 5개 관심사가 top-level `describe` 로만 분리됨. 헤더의 "N번째 describe" 서수 요약 방식이 파일이 커질수록 갱신 누락 위험을 키움(이전 라운드에서 실제로 한 번 stale 됐던 패턴) | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` | 당장 조치 불요. describe 가 더 늘면 파일 분리 또는 서수 대신 이름 나열 방식 검토 |
| 2 | testing | 신규 `it.each` 4케이스가 `await Promise.resolve()` 2틱을 쓰는데 같은 파일 기존 SET 실패 테스트는 1틱 — 근거 주석 없이 값이 다름 | `idempotency.interceptor.spec.ts:1107-1108` (신규) vs `:944` (기존) | 주석으로 이유 명시하거나 1틱 관례로 통일. 우선순위 낮음(현재 통과, 실패 방향 아님) |
| 3 | testing | "닫힌 집합" 타입 좁힘이 향후 다시 `string` 으로 넓어지는 역행 회귀를 잡을 영구 테스트/게이트가 없음. `tsc --noEmit` 프로브는 일회성이라 삭제됐고, `*.spec.ts` 는 `ts-jest` 가 타입을 strip 함. `check-backend-typecheck-ratchet.py` 도 진단 "개수" 비교만 해 이 회귀 형태는 놓침 | `business-metrics.service.ts` | 별도 타입 전용 fixture 추가 검토 |
| 4 | documentation | `IdempotencyInterceptor` 클래스 docstring 의 "다섯 fail-open 경로" 표에 `reason` 라벨 매핑이 나타나지 않음 | `idempotency.interceptor.ts` 클래스 상단 표 | 선택 사항. 표에 `reason` 컬럼 추가 또는 매핑 요약 한 줄 부기 |
| 5 | architecture | `BusinessMetricsService` 가 서로 무관한 도메인 계측을 한 클래스에 계속 누적(6번째 instrument 추가). 현재 크기는 문제 아님 | `business-metrics.service.ts` | 조치 불요. instrument 10개 이상 되면 도메인별 sub-facade 분리 검토 |
| 6 | architecture | `RedisFailOpenComponent` 유니온이 멤버 1개(`idempotency`)뿐 — 신규 소비자마다 `metrics` 모듈 수정 필요. 의도된 마찰(cardinality 제어)로 문서에 근거 있음 | `business-metrics.service.ts` | 조치 불요. 소비자 5개 이상 되면 등록 테이블 방식 검토 |
| 7 | security | 라벨 파라미터가 리터럴 유니온으로 닫혀 있어 Prometheus label-cardinality 공격면이 오히려 좁아짐(이전 INFO 해소 확인) | `business-metrics.service.ts` | 조치 불요 |
| 8 | scope | `review/**`, `spec/**`, `plan/**` 변경분은 프로젝트 규약상 이번 작업 사이클이 생성해야 하는 정규 산출물 | 해당 디렉터리 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 리터럴 유니온으로 label cardinality 공격면 축소 확인. 자격증명·인젝션·인가 우회 없음 |
| architecture | LOW | 계측 파사드 확장 관찰 2건 + DI 레이어링 INFO 1건, 모두 기존 확립 패턴 |
| requirement | NONE | 직전 라운드 WARNING 5건 전부 코드/spec 직접 대조·jest 57/57·eslint 0건으로 해소 재확인 |
| scope | NONE | `git diff origin/main...HEAD` 전량 대조, 목적 외 변경 없음 |
| side_effect | NONE | 생성자 확장 하위호환(`@Optional()` trailing), 메트릭 호출 non-throwing, spy 격리 정상 |
| maintainability | LOW | 테스트 파일 비대화 구조적 관찰(INFO) 1건, 이전 라운드 개선 4건 반영 확인 |
| testing | LOW | 핵심 테스트 갭(서비스 본문 미실행) 해소 확인 + 뮤테이션 재현 검증. INFO 2건(틱 불일치, 타입 회귀 감지 부재) |
| documentation | NONE | WARNING 5건 전부 코드 대조로 해소 확인. INFO 1건(docstring 표 reason 매핑 누락) |
| user_guide_sync | NONE | 매트릭스 20행 중 매칭 0건(frontend 변경 0건, 실행/디버깅 흐름 행동 변경 없음) |

## 발견 없는 에이전트

security, requirement, scope, side_effect, documentation, user_guide_sync — Critical/Warning 없음(NONE 위험도).

## 권장 조치사항

1. (선택) `IdempotencyInterceptor` docstring 표에 `reason` 라벨 매핑 추가.
2. (선택) 신규 `it.each` 2틱 대기에 근거 주석 추가 또는 1틱 통일.
3. (선택, 낮은 우선순위) 유니온이 `string` 으로 재확장되는 회귀를 감지할 영구 게이트 고려.
4. 즉시 조치 필요한 항목 없음 — 현재 상태로 병합 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: 7명 전원 결과 확보됨, 이행 완료.
  - **제외**: `performance`(계측 배선이라 성능 표면 아님) · `dependency`(신규 의존성 없음) · `database`(스키마/쿼리 변경 없음) · `concurrency`(동시성 로직 변경 없음) · `api_contract`(외부 계약 변경 없음)

---

## 이 라운드 처분 (main Claude)

CRITICAL·WARNING 0 이라 `RESOLUTION.md` 는 필요 없으나, **INFO 3 은 조치했다** — 이유는
그 지적이 이 PR 의 주제 자체이기 때문이다. WARNING 5(직전 라운드)의 핵심이 "문서한 보장이
구현보다 넓다" 였고, 그걸 유니온으로 좁혔는데 **좁힌 채로 유지될 보장은 다시 없었다**.
같은 결함의 한 층 위 반복이다.

`@ts-expect-error` 캐너리를 붙였다(커밋 `409e7ff6c`). ratchet 이 `tsc --noEmit -p
tsconfig.json` 을 **파일별**로 대조하고 양방향 변화에 실패하므로, 넓어지면 지시자가 소비되지
않아 TS2578 이 되고 이 파일 진단 수가 baseline(0)에서 올라 CI 가 막는다.

두 번 좁게 잡았다가 고쳤고 둘 다 실측으로 드러났다:
1. prettier `--fix` 가 호출을 두 줄로 쪼개 지시자가 대상 줄을 못 덮었다(진단 4건).
2. 그걸 피하려 타입 별칭 대입 형태로 바꿨더니 **별칭만** 검사하게 돼 `reason: string`
   되돌림 뮤턴트 2건이 생존했다. 보장의 주체는 별칭이 아니라 메서드다.

최종: 뮤턴트 **3/3 RED**, 정상 상태 ratchet 199건/38파일 유지.

INFO 1·2·4~8 은 무조치 — 트리거 조건이 문서에 있거나(1·5·6) 실패 방향이 아니거나(2)
선택 사항(4)이고, 7·8 은 확인 결과 문제 없음이다.
