# RESOLUTION — 단위 3 webhook 유지보수 백로그

리뷰 세션: `review/code/2026/06/28/22_30_54` (RISK: MEDIUM, Critical 0, Warning ~10)

## 조치 항목

| # | 분류 | 발견 | 조치 |
|---|------|------|------|
| W-1 | Testing | `getStatusById` 단위 테스트 부재 | executions.service.spec 에 `getStatusById` describe(정상·null·DB예외 흡수+warn) 추가 |
| W-2 | Testing | mock getStatusById 가 executionId 미전달 | mock 이 `executionId` 받아 `findOne({ where: { id } })` 위임 |
| W-3 | Testing/side_effect | `extractClientIp`(full) string\|null 잔류 비대칭 | client-ip.ts `extractClientIp` JSDoc 에 두 함수 반환형 분리 의도 명시(full 통일은 auth/* ripple 로 범위 밖) |
| W-4·W-9 | Security/Arch | `getStatusById` DB 오류 silent `.catch` | `.catch` 에 `logger.warn` 추가(observability) |
| W-5 | Requirement | QueryFailedError 양성 message 단언 누락 | `toBe('Resource already exists or has been modified concurrently.')` 추가 |
| W-6 | Requirement | `if (!status)` 가독성 | `if (status == null)` 로 교체 |
| W-7 | Maintainability | `select: ['id','status']` 배열형 | `select: { id: true, status: true }` 객체형 |
| INFO-4 | Documentation | getStatusById no-throw 미명시 | JSDoc `@remarks` 추가 |
| INFO-5 | Documentation | mock "23개" 하드코딩 | "기존 테스트 사이트" 로 간결화 |
| INFO-6 | Documentation | client-ip.spec "(과거 null)" 이력 주석 | 간결화 |
| INFO-10 | Testing | non-23505 QueryFailedError 케이스 누락 | filter.spec 에 23502 → 500 회귀 테스트 추가 |
| INFO-11 | Testing | 순수 IPv6 normalize 테스트 누락 | client-ip.spec 에 `2001:db8::1` 보존 단언 추가 |

> 위 fix 는 본 세션 REVIEW WORKFLOW 커밋(`refactor(backend): 단위 3 ai-review 반영`)에 포함.

### 미변경 (오탐 / 범위 밖 / pre-existing)
- **W-8 (오탐)**: "IIFE mock 2곳 중복" — `provide: ExecutionsService` 는 spec 에 **1곳뿐**(line 90). reviewer line 번호(1618/1736) 부정확.
- **W-10**: inbound 마다 getActiveExecutionStatus DB 조회 — PK 단건·기존 동작 보존. 캐시는 backlog.
- **INFO-1·2 (SPEC-DRIFT)**: `extractClientIpFromHeaders` 반환형 null→undefined 가 spec §2.3 미기록. spec §2.3 은 IP 추출 **정책**(헤더 기반·req.ip 폴백 없음)을 기술하며 TS 반환형은 구현 세부 → spec 변경 불요.
- **INFO-3·7·12·13**: step 번호 중복·HooksService SRP·`moduleRef:any`·log injection — pre-existing/backlog.
- **INFO-14**: req.ip 폴백 갭 — 단위 2(D-12, PR #770)에서 처리.

## TEST 결과
- **lint**: 통과 (`_test_logs/lint-20260628-224527.log`)
- **unit**: 통과 — 48 suites, getStatusById/filter/client-ip 신규 케이스 포함 (`_test_logs/unit-20260628-224609.log`)
- **build**: TS/앱 빌드 4 stack 통과. **`build:docker` 는 docker.io `node:24-alpine` manifest fetch `DeadlineExceeded`(레지스트리 인프라, 코드 무관)로 실패**.
- **e2e**: 보류 (사용자 응답 인용) — 동일 docker.io 레지스트리 인프라 차단. 사용자 결정 **"e2e는 취소하고 이후 진행"**(단위 2 turn). 로컬 미실행, **PR CI 가 build:docker·e2e 독립 실행해 최종 검증**.

## 보류·후속 항목
- build:docker·e2e: docker.io 레지스트리 인프라 차단 — PR CI 위임. 레지스트리 회복 시 로컬 재현 가능.
- backlog: HooksService SRP 분리(ChatChannelWebhookHandler 등), getActiveExecutionStatus 인메모리 캐시(busy conversation).
