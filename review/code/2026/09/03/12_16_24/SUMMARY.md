# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/차단 결함 없음. 실질 발견은 문서-실측 불일치(런북 항목 부재 주장) 1건(WARNING)과 사소한 포맷/커버리지 보완 INFO 다수뿐이며, 핵심 하드닝(타이머 누수 방지·JSDoc 오귀속 복원·unref 도입)은 뮤테이션 검증까지 마쳐 유효함이 확인됨. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `setTimeout(...).unref()` 도입이 그레이스풀 셧다운 중 `notice`/`cutoff` 콜백 미실행을 유발할 수 있는데, 이 트레이드오프가 "배포 런북에서 이미 별도 추적 중"이라는 `RESOLUTION.md`/`SUMMARY.md`(11_57_58 라운드)의 주장은 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(:151-164) 실측 대조 결과 근거가 없다 — 그 자리의 런북 항목 2건은 다른 주제(지터 없음 재연결 스파이크, 배포 전환 창)이고 unref·셧다운 상호작용을 다루는 항목은 plan 어디에도 없음 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:225-226`; 근거 인용처 `review/code/2026/09/03/11_57_58/RESOLUTION.md`, `SUMMARY.md` | "런북에서 추적 중" 문구를 철회하거나, plan 에 "unref 도입으로 그레이스풀 셧다운 중 notice/cutoff 콜백이 미실행될 수 있음"을 명시하는 런북 항목을 실제로 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | maintainability / scope / documentation (중복 통합) | JSDoc 오귀속 복원 과정에서 `*/` 와 대상 선언 사이에 빈 줄이 신규로 생겨, 파일 전역 관례(빈 줄 없음, 다른 10곳+17곳과 대조 확인)와 불일치 — 기능 영향은 없음(TS 컴파일러 API `ts.getJSDocCommentsAndTags` 로 정상 귀속 확인됨) | `codebase/backend/src/modules/websocket/websocket.gateway.ts:176` (`armExpiryTimers` 앞); `codebase/backend/src/modules/websocket/websocket-events.types.ts:302` (`AuthTokenExpiredPayload` 앞) | 두 곳 모두 `*/` 다음 빈 줄 제거해 선언과 붙임 |
| 3 | testing | rearm 테스트가 "옛 타이머 생존 여부"를 개별이 아닌 합계(sum)로만 단언 — 리크 방향 결함은 잡지만 신원(누가 emit했는지) 식별력은 약함 | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:819-829` | `expect(oldEmits).toBe(0); expect(newEmits).toBe(1);` 로 개별 단언 |
| 4 | testing | `cutoff` 의 `Math.max(0, untilCutoff)` 음수 분기(이미 만료된 `exp` 로 connect)를 직접 exercise 하는 테스트 없음 — notice 클램프만 커버됨 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:212-221`; 테스트 `websocket.gateway.spec.ts:732-877` | `connectWithExp('client-exp-past', -10)` 류 시나리오 추가해 "연결 즉시 disconnect 스케줄" 단언 |
| 5 | testing | 회귀 근거 "N축 RED" 수치가 문서 간 불일치(plan: 3축 vs `RESOLUTION.md:62`: 4축) — "선제 해제"와 "W3 위치"가 같은 지점을 이중 계산한 것으로 추정, 실제 재현도 3축만 확인됨 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`; `review/code/2026/09/03/11_57_58/RESOLUTION.md:62` | 두 문서 숫자 통일, "선제 해제"/"W3 위치" 동일 지점 여부 명시 |
| 6 | testing | `expSeconds` 가 `NaN`/`Infinity` 인 경우를 직접 exercise 하는 테스트 없음(우선순위 낮음 — `undefined` 케이스와 동일 조기 return 경로) | `codebase/backend/src/modules/websocket/websocket.gateway.ts:186` | 필요 시 `exp: NaN` 케이스 1개 추가 |
| 7 | documentation | plan 의 "이월 INFO 5건 — 한 번에 닫았다" 체크리스트 항목이, 그 닫는 커밋(`69aad5d5d`) 자체가 새 리뷰 라운드에서 재발 3건(JSDoc 오귀속 2 + W3 회귀)을 만들었다가 후속 커밋(`b75e6a76b`)으로 고친 하위 사이클을 교차 참조하지 않음. 커밋 메시지 "리뷰 1R" 라벨이 원 PR(#1266) 리뷰 라운드와 동일 이름 재사용되어 `git log -S` 추적 시 혼동 가능 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` (게이트 93-106) | plan 항목에 "닫는 과정에서 새 리뷰 라운드가 재발 3건을 잡아 `b75e6a76b`로 추가 정정"한 줄 + `review/code/2026/09/03/11_57_58/` 링크 추가 |
| 8 | concurrency | `expiryTimers` Map 이 `client.id` 문자열만으로 항목을 식별 — `connectionStateRecovery` 가 실제로 켜지는 시점에는 지연된 구 소켓의 `handleDisconnect` 가 방금 재연결로 무장된 새 타이머를 지울 수 있는 순서 의존성 잠재. 현재는 해당 옵션이 꺼져 있어 도달 불가(코드베이스 전체에 `connectionStateRecovery` 참조 없음), 팀도 이미 판단 유지로 명시 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:184, 236-242, 318` | 현재 조치 불요. `connectionStateRecovery` 실제 도입 시 세대 토큰/소켓 참조 비교 방어 추가 검토 |
| 9 | maintainability | `Math.max(0, …)` clamp 근거 주석이 `untilNotice`/`cutoff` 두 지점에 유사 반복(완전 복붙은 아니고 두 번째가 축약 참조) | `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`armExpiryTimers` 내부) | 현재 2곳뿐이라 조치 불요, 3번째 clamp 추가 시 공통 주석 통합 검토 |
| 10 | requirement / scope / documentation (중복 통합) | 리뷰 도중 여러 reviewer 가 병렬 실행 중인 다른 reviewer 의 뮤테이션 검증 산출물(W3 회귀 재현, `MSG_AUTH_TOKEN_EXPIRING` 리터럴 1단어 치환)을 워킹트리에서 일시 관측 — 이 diff 와 무관하며 재확인 시점(`git status --short`)에는 이미 원상 복구되어 있었음. 어느 reviewer 도 직접 되돌리지 않고 관찰만 함(정책 준수) | `codebase/backend/src/modules/websocket/websocket.gateway.ts`; `codebase/backend/src/modules/websocket/websocket-events.types.ts` | 조치 불요(이미 해소). 병합 전 `git status --short` 재확인 권장 |
| 11 | security/performance | `setTimeout(...).unref()` 은 프로세스가 다른 활성 핸들 없이 종료 직전이면 발화 전에 죽을 수 있음(공격 표면 확대 아님 — 소켓 자체가 소멸). 이전 라운드에서 이미 식별·처분됨(WARNING #1 과 별개로, 리스크 존재 자체는 이견 없음, "추적 근거 문서"만 WARNING #1 대상) | `codebase/backend/src/modules/websocket/websocket.gateway.ts:225-226` | 배포 런북 항목 실제 추가(WARNING #1 과 동일 조치로 해소) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가/암호화/입력검증 로직 변경 없음. unref 관련 INFO 재확인만 |
| performance | NONE | 모든 변경이 O(1), 핫패스 아님. unref 는 오히려 셧다운 성능 개선 |
| requirement | NONE | 직전 라운드 WARNING 3건 해소 확인(뮤테이션 RED 재현). spec §1.2/§4.6/§9.2 정합 |
| scope | NONE | plan 5개 이월 항목과 diff 1:1 대응, 스코프 이탈 없음. INFO 2건(빈 줄, 병렬 뮤테이션 관측) |
| side_effect | **LOW** | unref 셧다운 트레이드오프의 "런북 추적 중" 근거 부재(WARNING) |
| maintainability | LOW | JSDoc 빈 줄 잔여물(INFO), clamp 주석 반복(INFO) |
| testing | LOW | 뮤테이션 3종으로 신규 테스트 유효성 확인(vacuous 아님). 커버리지 보완 여지 3건 + 문서 수치 불일치 |
| documentation | LOW | JSDoc 오귀속 복원 확인(긍정), 빈 줄 잔여물 + plan 교차참조 누락(INFO), 병렬 뮤테이션 관측 |
| concurrency | LOW | 핵심 하드닝 검증 완료. `connectionStateRecovery` 미도입 상태에서의 잠재 순서 의존성(도달 불가, INFO) |
| api_contract | NONE | WS wire 계약 값 단위 동일 유지, breaking change 없음. 재무장 조기-clear 는 "1회 emit" 불변식 보강 |

## 발견 없는 에이전트

security, performance, requirement, api_contract — Critical/Warning 없음(INFO 포함 전무 또는 순수 확인성 INFO만).

## 권장 조치사항
1. (WARNING #1 해소) `review/code/2026/09/03/11_57_58/RESOLUTION.md`/`SUMMARY.md` 의 "배포 런북에서 이미 추적 중" 문구를 철회하거나, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 에 "unref 도입으로 그레이스풀 셧다운 중 notice/cutoff 콜백이 미실행될 수 있음"을 명시하는 런북 항목을 실제로 추가한다.
2. `websocket.gateway.ts:176` 및 `websocket-events.types.ts:302` 의 JSDoc-선언 사이 신규 빈 줄 2곳을 제거해 파일 관례와 통일한다.
3. (선택, 낮은 우선순위) testing INFO 3건 — rearm 개별 단언, cutoff 음수-clamp 테스트 추가, plan vs RESOLUTION "N축 RED" 수치 통일.
4. (선택) plan 체크리스트에 재발-재수정 하위 사이클(`69aad5d5d` → 11_57_58 라운드 → `b75e6a76b`) 교차 참조 한 줄 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단 — 이번 diff 범위 밖(신규 아키텍처 변경 없음) |
  | dependency | router 판단 — 신규 의존성 추가 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 대상 변경 없음 |
