# Code Review 통합 보고서 (단위 3)

리뷰: webhook 하드닝 유지보수 백로그 (M-1 client-ip 반환형 / M-2 filter 테스트 / M-3 getStatusById 캡슐화)

## 전체 위험도
**MEDIUM** — Critical 0. 테스트 보강·observability 개선 중심 WARNING. 핵심 리팩터 방향은 옳음.

## Critical
해당 없음.

## WARNING 처분
| # | 카테고리 | 발견 | 처분 |
|---|----------|------|------|
| 1 | Testing | `getStatusById` 단위 테스트 부재 | **fix** — executions.service.spec 에 정상·null·예외흡수 3케이스 추가 |
| 2 | Testing | mock `getStatusById` 가 executionId 미전달 | **fix** — mock 이 id 받아 findOne 위임 |
| 3 | Testing/side_effect | `extractClientIp`(full) 는 string\|null 잔류 — 비대칭 | **fix(문서)** — client-ip.ts 에 두 함수 반환형 분리 의도 JSDoc 명시. full 통일은 auth/* 소비처 ripple 로 범위 밖 |
| 4·9 | Security/Arch | `getStatusById` DB 오류 silent `.catch` | **fix** — `logger.warn` 추가(observability). 기존 getActiveExecutionStatus 도 silent 였음(동작 보존+보강) |
| 5 | Requirement | QueryFailedError 테스트 양성 단언 누락 | **fix** — message `toBe(...)` 추가 |
| 6 | Requirement | `if (!status)` 가독성 | **fix** — `if (status == null)` |
| 7 | Maintainability | `select: ['id','status']` 배열형 | **fix** — `{ id: true, status: true }` 객체형 |
| 8 | Maintainability | IIFE mock "2곳 중복" | **오탐** — `provide: ExecutionsService` 는 1곳뿐(line 90). reviewer line 번호(1618/1736) 부정확 → 미변경 |
| 10 | Performance | inbound 마다 getActiveExecutionStatus DB 조회 | **미변경** — PK 단건 조회·기존 동작 보존. 캐시는 backlog |

## INFO 처분 (발췌)
- INFO 4: getStatusById JSDoc @remarks(no-throw) → **fix**.
- INFO 5·6: mock "23개"·spec "(과거 null)" 주석 → **fix(간결화)**.
- INFO 10: non-23505 QueryFailedError → 500 회귀 테스트 → **fix**.
- INFO 11: 순수 IPv6 normalize 테스트 → **fix**.
- INFO 1·2 (SPEC-DRIFT): extractClientIpFromHeaders 반환형 spec 미기록 → **미변경**. spec §2.3 은 IP 추출 **정책**(헤더 기반·req.ip 폴백 없음)을 기술하며 TS 반환형(null vs undefined)은 구현 세부라 spec 변경 불요.
- INFO 3 (step 번호 중복)·12 (moduleRef:any)·13 (log injection)·7 (HooksService SRP): pre-existing/backlog → 미변경.
- INFO 14: req.ip 폴백 갭 → 단위 2(D-12, PR #770)에서 처리됨.

## 에이전트별 위험도
security LOW · performance LOW · architecture LOW · requirement LOW · scope NONE · side_effect LOW · maintainability LOW · testing MEDIUM · documentation LOW · dependency LOW · database NONE · concurrency NONE · api_contract NONE · user_guide_sync NONE

## TEST
lint·unit(48)·TS build 통과. build:docker·e2e 는 docker.io 레지스트리 인프라(DeadlineExceeded)로 로컬 미실행 → PR CI 위임(사용자 docker-infra 진행 기조). 상세 RESOLUTION.md.
