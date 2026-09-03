# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 실질 코드(WS `auth.token_expired` 타이머 헬퍼 3파일)는 5개 리뷰어가 NONE 판정. 유일한 WARNING(3명 중복 발견)은 `codebase/**` 가 아니라 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 문서 렌더링 결함이며 코드 동작에는 영향 없음. forced whitelist(7명) 전원 + 추가 concurrency 포함 8명 전원 결과 확보(누락 없음, 강제 미이행 없음).

## Critical 발견사항

_없음._

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability / scope / documentation | 최신 커밋(`a1984f196`)이 plan 트래커의 인용(blockquote) 문단에 리뷰 링크(`12_16_24/SUMMARY.md`)를 문장 중간에 끼워 넣으면서 (a) 형제 줄과 다르게 들여쓰기(`      > ` 6칸)가 빠져 렌더러에 따라 리스트/인용 블록 밖으로 이탈할 수 있고, (b) "...였다." 와 "추적한다고 적으면서 추적처를 만들지 않았다." 사이가 갈라져 문장이 부자연스럽게 끊기며, (c) 같은 문단 안에서 라벨 마이그레이션이 절반만 됨(`:190` 은 `서브사이클 11_57_58` 로 정정됐지만 바로 다음 `:191` 의 `2R reviewer` 는 옛 라벨 그대로 남음) — 이 자체가 없애려던 라벨 혼선을 같은 문단 안에서 재발시킴 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:190-194` (특히 `:191`, `:193`) | 링크(`상세: [...]`)를 문장 끝(`:194` 뒤)으로 옮기고 형제 줄과 동일한 `      > ` 접두를 맞춘다. `:191` 의 `2R reviewer` 를 `서브사이클 12_16_24 reviewer` 로 마저 통일해 신·구 라벨 체계가 한 문단 안에서 섞이지 않게 한다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect / concurrency | `notice.unref(); cutoff.unref();` 는 의도된 가용성 하드닝이나, 그레이스풀 셧다운 도중 프로세스가 먼저 종료되면 대기 중이던 사전 통지(`notice`)/강제종료(`cutoff`) 콜백이 미실행될 수 있는 트레이드오프. 코드 주석 + plan 문서에 이미 열린 추적 항목으로 명시돼 있어 신규 미해결 리스크 아님 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:222-227`; `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(서브사이클 `12_16_24` W1) | 조치 불요 — 배포 런북 실체화 시 이관 |
| 2 | security / side_effect / concurrency | `armExpiryTimers` 진입부 선제 `clearExpiryTimers(client.id)` 호출(조기 `return` 앞)은 좀비 타이머(같은 `client.id` 재사용 시 옛 emit/disconnect 잔존) 제거 목적의 의도된 변경이며 인가 우회 경로 아님(`client.id` 는 서버 생성값, 재무장은 항상 새로 검증된 JWT `exp` 기반) | `codebase/backend/src/modules/websocket/websocket.gateway.ts:180-185` | 조치 불요 |
| 3 | security / side_effect | `MSG_AUTH_TOKEN_EXPIRING` 상수 export 는 기존 리터럴과 바이트 단위로 동일한 값의 additive 변경 — 신규 정보 노출·시크릿 하드코딩 아니며 기존 소비자 영향 없음(private 성격, `websocket.service.ts` 재-export 목록에도 미포함) | `codebase/backend/src/modules/websocket/websocket-events.types.ts:307-315` | 조치 불요 |
| 4 | side_effect | `expiryTimers` 맵 값 타입 non-optional 화(`{notice?;cutoff?}`→`{notice;cutoff}`) — private 필드라 외부 시그니처 영향 없음, `handleDisconnect` 도 같은 커밋에서 함께 정합화됨 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-159` | 조치 불요 |
| 5 | security | JWT 검증 실패 시 `catch{}` → 일반화된 `'Invalid token'` emit 패턴은 이번 diff 범위 밖(변경 없음)이며 민감정보 노출 없음 확인(회귀 없음) | `codebase/backend/src/modules/websocket/websocket.gateway.ts:294-298` | 조치 불요 |
| 6 | side_effect / testing | `jest.spyOn(global, 'setTimeout')` 은 `try/finally` 로 `mockRestore()` 보장 + `describe` 블록 단위 fake-timer 격리(`beforeEach`/`afterEach`) — 교차 테스트 오염 없음 | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:884-897`, `:723-728` | 조치 불요, 확인 기록 |
| 7 | maintainability | `Math.max(0, …)` clamp 근거 주석이 `untilNotice`/`cutoff` 두 곳에 거의 동일 문구로 중복 — 기존 라운드(`12_40_10`)가 "2곳뿐이라 둔다, 3번째 생기면 통합"으로 이미 유예한 판단 유지 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:194-197`, `:211-213` | 조치 불요(기존 유예 유지), 3번째 사용처 생기면 통합 |
| 8 | testing | `expSeconds` 가 `NaN`/`Infinity` 인 경로 전용 테스트 없음 — `undefined` 케이스와 동일 분기 공유해 실사용 리스크 낮음. 3라운드 연속 이월, 판단 유지(우선순위 낮음) | `codebase/backend/src/modules/websocket/websocket.gateway.ts:185` | 조치 불요(기존 판단 유지), 여유 시 `exp: NaN` 케이스 1건 추가 |
| 9 | testing | `review/code/2026/09/03/11_57_58/RESOLUTION.md` 의 "backend unit 9,232" 수치가 이번 라운드 실측(9,233 passed + 1 skipped)과 1건 차이 — 그 라운드 종료 시점 스냅샷이라 이후 3R 테스트 추가분 반영으로 추정, 코드 결함 아님 | `review/code/2026/09/03/11_57_58/RESOLUTION.md` | 조치 불요(참고용) |
| 10 | requirement | 직전 3라운드(`11_57_58`→`12_16_24`→`12_40_10`)가 지적한 모든 WARNING(JSDoc 오귀속 2건, 조기 `return` 순서 회귀, notice→cutoff 순서 미검증, plan 라벨 충돌+존재하지 않는 PR 번호 인용)이 현재 `HEAD` 에서 전부 해소됨을 독립 재확인. 핵심 기능은 spec §1.2/§4.6/Rationale `R-ws-socket-lifetime-binds-token` 과 line-level 로 일치, TODO/FIXME 류 없음 | `codebase/backend/src/modules/websocket/{websocket.gateway.ts, websocket-events.types.ts, websocket.gateway.spec.ts}` | 조치 불요 |
| 11 | requirement | "배포 런북" 미실체화(plan 안 참조 4건 누적)는 새 항목이 아니라 이미 근거·재개 신호(5번째 참조 시 실제 문서로 수렴)가 명시된 기존 유예 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:179-198` | 조치 불요 |
| 12 | requirement (프로세스 메모) | 리뷰 종료 직전 `git status --short` 에서 `websocket.gateway.ts` 에 커밋되지 않은 워킹트리 수정(notice/cutoff 등록 순서 교환)을 순간 관측 — 동시에 다른 reviewer(testing)가 진행 중이던 뮤테이션 검증(§검증 방법 참조, cp 백업→뮤테이션→원복 방식)과 형태가 일치. 이 리뷰는 그 파일을 건드리지 않았고 위 판정은 커밋된 `HEAD`(`a1984f196`) 기준 | (해당 없음 — 프로세스 관측) | 조치 불요. 다음 라운드에도 같은 파일이 흔들리면 실제 레이스로 승격 조사 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. 인증/인가·시크릿·인젝션 해당 없음 |
| requirement | NONE | 3라운드 이월 WARNING 전부 해소 확인, spec 일치 |
| scope | LOW | plan 문서 blockquote 훼손 1건(WARNING) 외 스코프 이탈 없음 |
| side_effect | LOW | `.unref()` 트레이드오프 등 전부 의도/문서화됨, 새 미해결 부작용 없음 |
| maintainability | LOW | plan 문서 WARNING(위와 동일 이슈) 외 코드는 양호 |
| testing | NONE | 3건 뮤테이션 전부 RED 확인(vacuous 아님), 전체 스위트 GREEN(9,233 passed) |
| documentation | LOW | plan 문서 WARNING(위와 동일 이슈) 외 JSDoc 배치 등 정상 |
| concurrency | NONE | 단일 스레드 event loop 전제상 경쟁조건 없음, `.unref()` 트레이드오프는 기존 추적 항목 |

## 발견 없는 에이전트

- security, requirement, testing, concurrency — CRITICAL/WARNING 없음(NONE)

## 권장 조치사항

1. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:190-194` 의 인용 링크 위치를 문단 끝으로 옮기고 들여쓰기(`      > `)를 형제 줄과 통일, `:191` 의 `2R reviewer` 라벨을 `서브사이클 12_16_24 reviewer` 로 마저 통일한다(WARNING #1, 유일 조치 필요 항목).
2. 그 외 INFO 항목은 전부 이미 코드 주석/plan 문서에 근거가 명시된 기존 유예이거나 확인 완료 사항 — 추가 조치 불요.

## 라우터 결정

- `routing=all` (router 가 전체 실행 선택, 제외 없음):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (8명)
  - **제외**: 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |

- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음). `concurrency` 는 forced 목록 밖이나 `routing=all` 로 함께 실행됨.