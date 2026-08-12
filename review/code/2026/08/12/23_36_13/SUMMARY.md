# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/기능 결함 없음. `IdempotencyInterceptor` 의 캐시 엔트리 내부 `responseJson` 손상 방어(신규 `discardCorruptEntry` 헬퍼 + 파싱 순서를 `bodyHash` 판정 뒤로 고정)가 spec(§R8·EIA-IN-11·EIA-RL-02·fail-open 요구)과 line-level 로 일치하며, 직전 라운드(`23_24_08`)가 지적한 WARNING 3건(테스트 단언 얕음·docstring stale·CHANGELOG 누락)도 소스 대조로 반영 확인됐다. 이번 라운드의 유일한 WARNING 은 테스트 인라인 주석 하나가 이번 PR 자체가 교체한 옛 docstring 문구를 그대로 인용하고 있는 순수 문서 드리프트(기능 영향 없음)이다. forced whitelist 7명(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원 결과 확보 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 테스트 파일 인라인 주석이 이번 PR 이 교체한 클래스 docstring 옛 문구("세 경로 모두 fail-open")를 그대로 인용 — 그 문구는 이번 PR 로 "다섯 경로 표"로 바뀌어 더 이상 존재하지 않는다. 기능·테스트 정확성에는 영향 없음(테스트 자체는 SET 실패 fail-open 을 정상 검증) | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:819` | 819번 줄 주석을 현재 docstring 표현("다섯 경로 모두 fail-open")에 맞게 갱신하거나 구체 문구 인용 대신 도메인 사실만 서술하도록 완화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 손상 캐시 처리 시 원본 `err.message` 를 새니타이징 없이 warn 로그에 삽입(이론적 log-injection). Redis 직접 쓰기 권한(이미 인프라 침해 전제)이 있어야 조작 가능 — 신뢰 경계 미확장, 파일 전체 기존 관례의 확장일 뿐 | `idempotency.interceptor.ts:224-226`(신설), `:307-309`, `:315-317`(기존) | 조치 불요. 구조화 로깅 전환은 파일 전체 범위의 별도 후속 |
| 2 | security | `JSON.parse` 결과에 런타임 스키마 검증 없이 캐스팅(엔트리/내부 payload 둘 다). `bodyHash` undefined 시 fail-safe(409) 방향이라 위험 낮음 | `idempotency.interceptor.ts:159,183,195` | 조치 불요. 스키마 검증 원하면 별도 후속 |
| 3 | security | 손상 파싱 실패가 이제 500 대신 fail-open 처리 — 예외가 `GlobalExceptionFilter` 까지 새던 경로가 사라져 정보 노출 표면 축소(개선) | `idempotency.interceptor.ts:176-186` | 없음 |
| 4 | scope | 바깥(엔트리) JSON 손상 경로에도 이번 diff 에서 처음 warn 로그가 추가됨 — "내부 responseJson 손상"이라는 표제보다 한 칸 넓은 변경. 직전 라운드에서 이미 지적·"수용" 처분됨 | `idempotency.interceptor.ts:161` | 조치 불요(이미 처분). 향후 plan 항목 제목을 "손상 처리 전체"로 넓게 적을 것 |
| 5 | scope | 클래스 docstring 을 5경로 표로 갱신하며 이번 diff 와 무관하게 선재했던 "직렬화 실패" 누락 항목까지 함께 정합화 — 은폐 아닌 정당한 동반 수정 | `idempotency.interceptor.ts:62-71` | 없음 |
| 6 | side_effect | 기존(비변경) 테스트가 새 warn 부작용을 mock 없이 실행해 콘솔 노이즈 발생. 기능·assertion 영향 없음. 직전 라운드에서 이미 식별·WARNING 문턱 아래로 판정되어 미조치 | `idempotency.interceptor.spec.ts:505` | `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 추가해 형제 테스트와 일관화(낮은 우선순위) |
| 7 | side_effect | `res.status()` mutate 시점이 payload 파싱 성공 이후로 이동 — 파싱 실패 시 응답 객체가 mutate 된 채 크래시하던 부분 상태변경이 제거됨(개선) | `idempotency.interceptor.ts` `intercept()` `switchMap` | 없음 |
| 8 | maintainability | 에러 메시지 포맷팅 삼항식(`err instanceof Error ? err.message : String(err)`)이 파일 내 4곳 반복 | `idempotency.interceptor.ts:145,225,308,316` | 파일-로컬 `formatErr(err)` 헬퍼로 추출 |
| 9 | maintainability | `switchMap` 콜백이 한 클로저에서 6개 분기(캐시 미스/엔트리 손상/bodyHash 불일치/payload 손상/에러 재현/성공 재현) 처리 — 순환 복잡도가 파일 내 다른 메서드보다 높음. 조기 반환으로 중첩은 1단계 유지 | `idempotency.interceptor.ts:149-202` | 현재 조치 불요. 6번째 분기 추가 시 private 메서드 추출 재고 |
| 10 | maintainability | `discardCorruptEntry` 판별 파라미터가 로그 문구용 한/영 혼합 리터럴 유니온 타입(`'엔트리' \| 'payload'`) — 현재 로직 분기에는 안 쓰여 무해 | `idempotency.interceptor.ts:220` | 조치 불요. 향후 로직 분기 조건으로 쓰이면 내부 식별자/표시 문구 분리 |
| 11 | requirement | 클래스 docstring 서두 문장("fail-open + warn 로그")이 5경로 전체에 획일 적용되는 것처럼 읽히나, 경로 #1(`!this.redis` 조기 반환)은 warn 을 남기지 않음(표 자체는 정확). 선재 패턴, 이번 diff 신규 결함 아님 | `idempotency.interceptor.ts:62-71`, `:106-108` | 서두 문장을 "경로에 따라 warn 로그 동반"으로 완화하거나 표에 "warn 없음" 명시(낮은 우선순위) |
| 12 | requirement | 구형 테스트(`:505-535`)가 신규 `discardCorruptEntry` warn 경로를 mock 없이 통과 — side_effect #6 과 동일 사안, 기능 결함 아님 | `idempotency.interceptor.spec.ts:505-535` | side_effect #6 제안과 동일(낮은 우선순위) |
| 13 | testing | "에러 재현 분기" 캐너리 주석이 리팩터 이전 모델("두 분기 각각 커버")을 서술하나, 현재는 `cachedPayload` 파싱이 한 곳으로 통합돼 200/409 테스트가 동일 소스 라인을 탄다 — 사실상 중복 테스트지만 향후 재분기 회귀에는 여전히 유효한 보험 | `idempotency.interceptor.spec.ts:631` | 주석을 "재발 방지용 회귀 가드(현재는 200 케이스와 동일 코드 경로)"로 정정(급하지 않음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신뢰 경계 미확장, 새 취약점 없음. INFO 4건(로그 인젝션 이론적 위험, 스키마 미검증, fail-open 전환은 개선) |
| requirement | NONE | spec §R8·EIA-IN-11·EIA-RL-02 와 line-level 일치, 직전 WARNING 3건 반영 확인(테스트 33/33 실행 GREEN). INFO 8건 |
| scope | NONE | 16파일 중 실질 변경 4파일만 단일 plan 항목에 정확히 수렴. INFO 2건(모두 이미 처분/정당) |
| side_effect | LOW | private 메서드 추가만, 공개 인터페이스 불변. WARNING 없음, INFO 2건(콘솔 노이즈, 개선 사항) |
| maintainability | LOW | 심각한 유지보수성 문제 없음. 직전 WARNING 3건 반영 확인. INFO 3건(반복 패턴, 분기 수, 타입) |
| testing | NONE | 뮤테이션 실측으로 순서 캐너리 유효성 검증(RED 확인 후 원복). INFO 1건(주석 정확도) |
| documentation | LOW | 문서화 전반 우수. WARNING 1건(테스트 주석이 교체된 docstring 옛 문구 인용) |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 보고).

## 권장 조치사항

1. (WARNING) `idempotency.interceptor.spec.ts:819` 의 인라인 주석을 현재 클래스 docstring 표현("다섯 경로 모두 fail-open")에 맞게 갱신 — 옛 "세 경로" 문구 인용 제거.
2. (INFO, 선택) 형제 테스트와의 일관성을 위해 `idempotency.interceptor.spec.ts:505` 에 `Logger.prototype.warn` mock 추가해 테스트 실행 중 콘솔 노이즈 제거.
3. (INFO, 선택) 반복되는 `err instanceof Error ? err.message : String(err)` 삼항식(4곳)을 `formatErr(err)` 헬퍼로 추출.
4. (INFO, 선택) `idempotency.interceptor.spec.ts:631` 주석을 현재 코드 경로 실태("200 케이스와 동일 라인")에 맞게 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 forced, 전원 결과 확보됨(화이트리스트 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(캐시 엔트리 파싱 방어 리팩터)와 무관 |
  | architecture | router 판단상 이번 diff 와 무관(구조 변경 없음, private 메서드 추가만) |
  | dependency | router 판단상 이번 diff 와 무관(의존성 변경 없음) |
  | database | router 판단상 이번 diff 와 무관(DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(동시성 제어 로직 변경 없음) |
  | api_contract | router 판단상 이번 diff 와 무관(외부 API 계약 변경 없음, 내부 인터셉터 파싱 로직만) |
  | user_guide_sync | router 판단상 이번 diff 와 무관(사용자 가이드 문서 대상 아님) |
