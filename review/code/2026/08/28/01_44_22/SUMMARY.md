# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(테스트 주석 자기모순, malformed 에러 가드 커버리지 0, CHANGELOG 누락)은 전부 기능 정확성에는 영향 없는 문서·테스트 보완 항목이며, forced 7개 reviewer 전원 결과 확보(누락 없음).

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/문서 정합 (requirement) | 신규 캐너리 테스트 바로 위 JSDoc 이 "CT-S9/S10 은 error 를 객체로 보내 direct 분기로 통과, 이 회귀를 못 잡는다"고 서술하지만, 같은 diff 에서 CT-S9/S10 은 이미 문자열 error 로 정정됐고 direct 분기 자체가 삭제되어 이 서술이 파일 안에서 자기모순이다 | `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2186` | CT-S9/S10 이 이미 production shape 을 쓰는 현재 상태와, 이 캐너리가 여전히 필요한 이유(예: 최소 조합 단독 검증)를 정확히 재서술 |
| 2 | 테스트 커버리지 (testing) | `extractNodeErrorPayload` 의 malformed 구조화 에러 가드(`if (!code \|\| !message) return null;`)가 테스트 커버리지 0 — 가드를 `if (false) return null;` 로 뮤테이션해도 87/87 GREEN 유지로 실증. 이 PR 이 direct 분기(W4)에 적용한 "커버리지 0인 방어 분기는 위험" 원칙이 같은 함수의 이 가드에는 적용되지 않음 | `codebase/frontend/src/lib/websocket/use-execution-events.ts:94` | `code`/`message` 누락·비문자열 fixture 로 "배너가 안 뜬다" 음성 테스트 추가, 또는 도달 불가능이 확실하면 가드 자체 제거 |
| 3 | 문서화 (documentation) | 이번과 동일 계급(필드 shape 오독으로 조용히 죽어 있던 경로를 고쳐 사용자 관측 동작이 바뀜)의 과거 수정들은 전부 `CHANGELOG.md` 에 "운영 영향" 문단과 함께 기록해 온 저장소 관례(예: `CHANGELOG.md:485`)인데, 이번 diff 에는 CHANGELOG 항목이 없음 | `CHANGELOG.md` (신규 항목 부재) | Unreleased 섹션에 결함 요지 + "이 배포 이후 사용자가 처음 배너를 보게 된다(회귀 아님)" 운영 영향 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 (side_effect) | 종전에 항상 `null` 을 반환해 죽어있던 `system_error` 배너 APPEND 콜백이 이 변경으로 프로덕션에서 처음 실질 발동 — 의도된 활성화이나 배포 후 신규 배너가 회귀로 오인되지 않도록 인지 필요(WARNING #3 CHANGELOG 항목과 동일 사실) | `use-execution-events.ts` `handleNodeCompleted`/`handleNodeFailed` | 코드 조치 불요, PR 설명/배포 노트에 명시(WARNING #3과 연동) |
| 2 | 부작용 (side_effect) | `extractNodeErrorPayload` 시그니처 축소(`(rawError, rawOutput)`→`(rawOutput)`) — export 없음, 호출부 2곳(diff 내 동반 수정)뿐이라 외부 파급 없음 확인 | `use-execution-events.ts` `extractNodeErrorPayload` 정의부 | 없음(확인 기록) |
| 3 | 유지보수성 (maintainability) | `handleNodeCompleted`/`handleNodeFailed` 두 핸들러의 errorPayload 추출→정규화→append 블록(~20줄)이 거의 동일하게 중복 — 이전 라운드에서 스코프 밖으로 defer된 pre-existing 이슈, 이번 diff 가 정확히 그 블록의 호출 인자를 양쪽 다 고친 지점이라 위험 재확인됨 | `use-execution-events.ts:813-835` vs `:909-931` | 공유 헬퍼(`appendSystemErrorIfNeeded` 등)로 단일 지점화 — 이번 PR 범위 밖 |
| 4 | 유지보수성 (maintainability) | `asRecord(asRecord(domain)?.error)` 이중 중첩 호출이 한 줄에 압축돼 즉시 읽기엔 밀도가 높음(JSDoc 이 보완 중) | `use-execution-events.ts:90` | 중간값에 이름을 준 2줄로 분리(선택) |
| 5 | 유지보수성 (maintainability) | `payload.output` 필드 타입이 두 핸들러에서 다르게 표기(`Record<string, unknown>` vs `unknown`) — 공유 `NodeHandlerOutput` 타입 부재가 근본 원인 | 두 `useCallback` payload 타입 리터럴 | 공유 타입 정의로 통합(이번 PR 범위 밖) |
| 6 | 유지보수성 (maintainability) | `extractNodeErrorPayload` JSDoc(26줄)이 포스트모템 서술까지 포함해 함수 본문보다 김 — 컨벤션과 일치, 재발 방지 가치 있으나 향후 spec 갱신 시 이 JSDoc 도 갱신 대상임을 유의 | `use-execution-events.ts:58-83` | 조치 불요, 향후 §4.1-a 갱신 시 동반 갱신 |
| 7 | 테스트 (testing) | `details` 키 자체가 없는(`undefined`) 구조화 에러 조합 미검증 | `use-execution-events.ts:95-98` | `details` 생략 fixture 로 `retryable: false` fallback 고정 테스트 추가 |
| 8 | 테스트 (testing) | "does NOT APPEND" 테스트 2건이 새 production shape(문자열 error) 대신 옛 object-shape error fixture 사용 — 게이트에서 조기 차단되어 공허 테스트는 아니지만 이 PR 의 "fixture=production shape" 원칙과 어긋남 | `use-execution-events.test.ts` 해당 두 테스트 | 문자열 error 형태로 교체(급하지 않음) |
| 9 | 테스트 (testing) | 상위 describe 블록 주석이 여전히 "output.error"(1단계)로 잔존 | `use-execution-events.test.ts:1965` | `output.output.error` 로 교체 |
| 10 | 문서화 (documentation) | diff 범위 밖 인접 주석(`payload.output` 필드 위)이 이 PR 이 disambiguate 한 wire/domain 용어 혼동을 표면적으로 재현("output.error" 표기, AI Agent 자신의 도메인 필드를 가리킴) — 기술적으로는 틀리지 않으나 나란히 읽으면 재혼동 위험 | `use-execution-events.ts:865-868` | "(AI Agent 자신의 domain output 필드 — wire 관점 output.output.error 와 동일)" 구절 추가(범위 밖) |
| 11 | 문서화 (documentation) | 이전 라운드 RESOLUTION.md 가 수용한 "PR 설명에 배너 최초 노출 명시" 권고가 PR 미생성으로 아직 미이행 | `plan/in-progress/system-error-banner-live-ws.md` 체크리스트 | PR 생성 시 본문에 명시 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증우회·XSS 등 신규 리스크 없음. `asRecord` 도입으로 입력 검증 오히려 강화, 배너는 JSX 텍스트 전용 렌더링으로 XSS 안전 |
| requirement | LOW | 핵심 결함 수정이 spec(§4.1-a, node-output.md Principle 0)과 line-level 일치, 87/87 통과·tsc 클린. 신규 캐너리 JSDoc 자기모순 1건(WARNING #1) |
| scope | NONE | 전 diff 가 plan 체크리스트 + 직전 라운드 WARNING 4건과 1:1 대응, 무관한 파일·설정·포맷팅 변경 없음 |
| side_effect | LOW | 죽어있던 배너 콜백이 프로덕션에서 처음 발동(의도된 활성화, INFO #1). 전역상태/네트워크/직접 mutation 신규 위험 없음 |
| maintainability | LOW | 이전 라운드 WARNING 4건 전부 해소 확인. 남은 건 전부 INFO(기존 중복, 타입 표기 불일치 등) |
| testing | LOW | 회귀 방지 설계(캐너리+뮤테이션 실증) 우수하나, malformed 에러 가드 커버리지 0을 뮤테이션으로 직접 실증(WARNING #2) |
| documentation | LOW | 핵심 JSDoc/주석은 이전 WARNING 4건 성실히 반영·spec 인용 정확. CHANGELOG 누락(WARNING #3) + PR 설명 미이행(INFO #11) |

## 발견 없는 에이전트

security, scope — 실질 발견사항 없음(NONE 판정, 확인 절차는 각 보고서 참고)

## 권장 조치사항
1. `extractNodeErrorPayload` 의 malformed 구조화 에러 가드(`!code || !message`)에 대한 음성 테스트 추가 — 뮤테이션으로 커버리지 0이 실증됐으므로 이 PR 이 스스로 세운 "커버리지 없는 방어 분기는 위험" 원칙을 동일하게 적용
2. `CHANGELOG.md` 에 이번 결함(배너 최초 노출, 회귀 아님) 항목 추가 — 저장소 관례 및 운영 담당자 인지 목적
3. 신규 캐너리 테스트 JSDoc 주석을 같은 diff 내 CT-S9/S10 정정 상태와 일치하도록 재서술
4. (낮은 우선순위, 범위 밖 가능) `details` 부재 조합 테스트, "no APPEND" fixture 의 object→string shape 통일, 상위 describe 주석 정정, 두 핸들러 간 ~20줄 중복 추출은 후속 작업으로 트래킹

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. 전체 reviewer(7명) 실행됨.
- **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
- **제외**: 없음
- **강제 포함(router_safety)**: security, requirement, scope, side_effect, maintainability, testing, documentation — forced 전원 결과 확보됨(누락 없음)