# Review Resolution — 03-maintainability M-2 (API_BASE_URL 통합 + 3001→3011)

리뷰 SUMMARY: `review/code/2026/06/24/20_17_55/SUMMARY.md`
**위험도 LOW · Critical 0 · Warning 0** → resolution-applier 의무 트리거 아님(Critical+Warning=0).
아래는 INFO 발견에 대한 main 직접 처분.

## 반영 (Addressed)

| # | 카테고리 | 조치 | 커밋 |
| --- | --- | --- | --- |
| 1·2 | Testing | `src/lib/api/__tests__/constants.test.ts` 신규 작성 (vitest). `API_BASE_URL`·`WS_BASE_URL` env 설정/미설정 + `getServerApiBaseUrl()` 우선순위 3경로(INTERNAL→NEXT_PUBLIC→fallback) 검증. **각 fallback 케이스에 `not.toContain("3001")` 회귀 가드** 포함 — 3001 재도입 자동 차단 (7 tests pass) | review-fix |
| 5 | Maintainability | `constants.ts` 의 `"http://localhost:3011/api"` 리터럴 2곳 중복 제거 → private `LOCAL_API_FALLBACK` 상수 1곳 정의 후 `API_BASE_URL`·`getServerApiBaseUrl()` 양쪽 참조. SoT 파일 내부 drift 차단 | review-fix |

> #2 의 client.test.ts/ws-client.test.ts 개별 assert 대신 constants.test.ts 단일 모듈에서 fallback 포트를 일괄 커버(권장안 2의 "또는 constants.test.ts 에서 일괄 커버" 선택지). 회귀 가드 본질(3011 고정·3001 금지)을 정의처에서 직접 검증하므로 동치이며 중복이 적다.

## 보류 (Deferred — 근거 명시)

| # | 카테고리 | 보류 사유 |
| --- | --- | --- |
| 3 | Security | `getServerApiBaseUrl()` 에 `typeof window` throw guard 추가 — 본 PR 은 **behavior-preserving 리팩터**다. throw 도입은 새 런타임 동작이고, 리뷰도 "클라이언트 호출 시 NEXT_PUBLIC fallback 으로 degrade 해 실제 보안 임팩트 낮음" 으로 INFO 판정. 함수는 서버 모듈(auth-providers)에서만 호출되며 정적 호출 그래프상 클라이언트 진입 경로 없음. 별도 hardening 으로 분리. |
| 2 | Security | env 미설정 시 HTTP 평문 fallback — CI/배포 파이프라인 레벨 정책(필수 env 검증)이며 frontend 소스 범위 밖. plan §M-2 옵션 비교에서 **옵션 B(env 강제)는 명시 기각**(DX 비용 과다), 채택안 A(fallback 통일)와 상충하므로 본 PR 에서 도입 부적합. |
| 4 | Security | OAuth `startOauth()` provider 삽입 — 이번 PR 이 건드린 라인이 아니며(기존 코드, import 만 변경), provider 는 TS union 타입 + `enabledProviders.includes()` 조건 렌더로 제약됨. 무관 코드 변경 회피(scope). |
| 6·8·9·10·11 | Maint./Doc./Security | 리뷰가 모두 **"이번 PR 범위 외"/"기존 코드"** 로 명시한 선재 항목 (ws-client `@/` alias·JSDoc, register-form `EMAIL_RE`, login-form TOTP 상수, console.* 노출). 무관 리팩터 끼워넣기는 scope 위반 — 별도 grooming 대상. |
| 7 | Documentation | `INTERNAL_API_URL` 의 `.env.example`/배포 문서 기재 — 인프라 문서 영역이며 frontend 코드 PR 범위 밖. 본 PR 의 `getServerApiBaseUrl()` JSDoc 이 우선순위를 코드 옆에 명시하므로 즉시 혼선 위험은 낮음. 인프라 문서 grooming 백로그로 이월. |

## 재검증

review-fix 커밋(테스트·dedup) 후 TEST WORKFLOW 재수행: lint·unit·build (결과는 plan/커밋에 반영).
e2e 는 dedup 이 값-동일(동작 불변)이고 추가분은 unit 테스트라 런타임 동작 변화 없음 — 직전 e2e PASS(214) 유효.
