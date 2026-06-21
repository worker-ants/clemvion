# RESOLUTION — M-7 fresh review (resolution 후 재검토)

리뷰 세션: `review/code/2026/06/21/16_16_49/` (위험도 **LOW**, Critical 0, Warning 3).
이전 세션 `15_56_59` 의 fix(W-1 kb UUID 가드·W-5 fail-closed·W-6 count assertion + 보안 테스트
보강)를 커버하는 fresh review. 이전에 FIXED 한 항목들은 본 세션 warning 에서 사라졌고(security NONE),
남은 3 warning 은 전부 **prior-DEFER 계승** 또는 **plan 명시 의도된 결과**다.

## Warning (전부 DEFER / 의도된 trade-off)

| # | 카테고리 | 처리 | 근거 |
|---|----------|------|------|
| 1 | 유지보수성/테스팅 | **DEFER (계승)** | `useFactory` inject 배열 module/spec 이중 관리. `15_56_59` W-4 에서 이미 DEFER. gateway spec 의 authorizer 개수 assertion(정확히 5개)이 wiring drift 봉인책으로 동작 중 — 즉시 blocking 아님. 공유 helper 추출은 테스트 투명성↔DRY 트레이드라 보류. |
| 2 | 유지보수성 | **DEFER (계승)** | 채널 prefix 리터럴(`matches`/`slice` vs `VALID_CHANNEL_PREFIXES`) 이중 하드코딩. `15_56_59` W-3 에서 DEFER. 본 fresh review 에서 추가된 **fail-closed(W-5)+개수 assertion(W-6)** 이 "동기화 어긋남 → silent regression" 위험을 봉인. `static readonly PREFIX` 상수화는 후속 후보. |
| 3 | 아키텍처 | **ACCEPTED (의도된 결과)** | 모듈-레벨 양방향 순환(C-2 클러스터) 잔존. M-7 은 gateway **생성자**의 서비스-레벨 forwardRef 3개를 제거했고, 모듈-레벨 forwardRef 는 spec §4.4 단일 sink(도메인→WS emit) 때문에 유지됨이 plan §M-7 에 명시. **e2e 205 PASS 로 부팅 안정성 확인**. 구조적 해소(이벤트 버스/단방향화)는 C-2 백로그. |

## SPEC-DRIFT (INFO — project-planner 후속, 비차단)

본 2건은 `15_56_59` 의 보안 fix(W-1·W-5)가 **spec §3.3 보다 앞서간** 결과다. impl 은 spec 약속의
**상위집합**(superset)이라 모순이 아니라 문서 완전성 갭이다 — 비차단.

| # | 내용 | 후속 |
|---|------|------|
| 1 | `kb:{documentId}` 비-UUID 선차단이 코드에 추가됐으나 spec §3.3 권한 검증 표 `kb:` 행에 미기재. `execution:`/`workflow:`/`background:run:` 행엔 "(비-UUID 선차단)" 이미 명시 → **kb 만 누락**. | **project-planner**: §3.3 `kb:` 행에 "(비-UUID 선차단)" 추가(기존 sibling 패턴 확장, product 의미 변화 없음). developer 는 spec read-only 라 위임. |
| 2 | fail-closed(매칭 authorizer 없는 valid 채널 = 기본 거부) 정책이 코드에 추가됐으나 spec §3.3 미기재. 현재 모든 valid prefix 에 authorizer 존재라 정상 경로 무영향(방어적). | **project-planner**: §3.3 에 "매칭 authorizer 없는 valid 채널 = 기본 거부" 정책 명시 검토. |

> `/consistency-check --impl-done spec/5-system/6-websocket-protocol.md` 로 위 drift 가 **BLOCK:NO**(비차단)임을 확인한다. impl ⊇ spec(방어적 선차단·fail-closed 가 관찰 가능 결과를 바꾸지 않음)이라 차단 사유 아님.

## 처리한 INFO

- **notifications `Promise.resolve` 주석**: `async` 무-await ESLint 회피 의도를 코드 주석 3줄로 명시(INFO-3). 코드 동작 무변.

## 남긴 INFO (후속 후보, 비차단)

- `BackgroundRunsService` export 유지 — gateway 직접 참조 제거됐으나 타 소비처 audit 후 후속 PR 에서 제거 검토.
- `WorkflowChannelAuthorizer` 의 `findById().then(true).catch(false)` 패턴 — 전용 `verifyWorkflowOwnership` 추가는 WorkflowsService 변경이라 M-7 범위 밖.
- `.catch(() => false)` 가 DB 오류를 인가 거부로 위장 — M-7 이전부터 존재. catch 로깅 추가는 범위 밖.

## 결론

Critical 0. Warning 3 전부 prior-DEFER 계승 또는 plan 명시 의도 결과(회귀 없음). SPEC-DRIFT 2건은
비차단 INFO 로 project-planner 후속(`/consistency-check --impl-done` 으로 BLOCK:NO 확인). M-7 핵심
가치(gateway 서비스 forwardRef 역전·OCP·DI 부팅 안정) 전부 달성.
