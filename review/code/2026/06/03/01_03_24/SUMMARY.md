# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — API 계약 어휘 불일치(`"ok"` vs `"healthy"`) 및 복수 WARNING 항목 존재. 기능 정확성은 양호하나 spec draft 잔존 오류·로딩 UX 괴리·유저 가이드 누락 등 배포 전 해소 권장 사항 다수.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | API Contract | `plan/in-progress/system-status-page.md` §A spec draft 에 `"ok"` 어휘가 잔존 — 구현 DTO·프론트·e2e 가 사용하는 `"healthy"` 와 불일치. 외부 소비자에게 노출 시 계약 오해 발생 가능 | `plan/in-progress/system-status-page.md` §A §2/§3 | spec draft 의 `"ok"` → `"healthy"` 로 전면 교정 |
| W-2 | API Contract | Swagger `@ApiOperation` description 에 "admin role 불요, 인증 사용자 전원 접근 가능" 이라는 의도가 누락 — 보안 리뷰어·API 소비자가 의도적 설계인지 판단 불가 | `system-status.controller.ts` | `@ApiOperation` description 에 role 제한 없음 이유 한 줄 추가 |
| W-3 | Requirement | 로딩 상태가 spec `§2.5` 명세의 "스켈레톤" 대신 `Loader2` 스피너로 구현 — UX 패턴 불일치 | `frontend/src/app/(main)/system-status/page.tsx` 라인 117–121 | `Skeleton` 컴포넌트로 교체하거나 spec §2.5 를 "스피너" 로 교정(project-planner 위임) |
| W-4 | Performance | `inspect()` 내 `getJobCounts` → `isPaused` 순차 호출 — 서로 독립적인 두 Redis 호출을 직렬화, 큐당 RTT 2회 낭비 | `system-status.service.ts` 라인 628–642 | `Promise.all([handle.queue.getJobCounts(...), handle.queue.isPaused()])` 병렬화 |
| W-5 | Side Effect | `system-status.constants.ts` 환경변수 모듈 로드 시 즉시 평가 — ConfigModule 초기화 전 실행 시 기본값으로 고정, 런타임 변경 불가 | `system-status.constants.ts` 라인 197–198, 231–234 | `ConfigService` 주입 방식으로 전환 또는 테스트 격리를 위해 `jest.resetModules()` 패턴 명시 |
| W-6 | Side Effect | `useFactory` 인덱스 매핑 — `MONITORED_QUEUES` 와 `queues[]` 인덱스 일치를 암묵적으로 가정. 큐 추가/순서 변경 시 런타임까지 잘못된 meta↔queue 매핑이 무음으로 통과 | `system-status.module.ts` 라인 338–345 | `queue.name` 기반 조회로 교체하거나 최소 "inject 순서 = MONITORED_QUEUES 순서" 주석 명시 |
| W-7 | User Guide | 신규 System Status UI 페이지(사이드바 메뉴 노출, 전체 로그인 사용자 접근)에 대한 유저 가이드 MDX 페이지 전혀 없음 | `codebase/frontend/src/content/docs/` | 기존 07-workspace-and-team 섹션 내 서브페이지 추가 또는 신규 섹션 생성 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Security | `inspect()` catch 블록 내 서버 측 logger 호출 없음 — Redis 장애 시 예외 완전 소멸, 운영 원인 추적 불가 | `system-status.service.ts` 라인 653 | `catch (err)` 로 변경 후 `this.logger.error(...)` 추가 |
| I-2 | Performance | 5초 폴링에 결과 캐싱 없음 — 다중 사용자 시 Redis 부하 선형 증가 | `system-status.service.ts`, `page.tsx` 라인 939 | `getOverview()` 결과 3–5초 TTL in-memory 캐시 도입 |
| I-3 | Performance | 프론트엔드 `data.queues.filter()` 렌더마다 반복 — GROUP_ORDER × queues 중첩 순회 | `page.tsx` 라인 994–995 | `useMemo` 로 그룹핑 메모이제이션 |
| I-4 | Architecture | `system-status.constants.ts` 가 12개 도메인 모듈에 fan-in 의존 — 큐 추가 시 이 파일도 갱신 필요 | `system-status.constants.ts` 라인 1–12 | "도메인 횡단 레지스트리" 로 명시 문서화 (이미 SoT 주석 존재) |
| I-5 | Architecture | 프론트엔드 타입(`QueueHealth` 등)이 백엔드 DTO를 수동 미러링 — 타입 드리프트 위험 | `page.tsx` 라인 869–895 vs `system-status-response.dto.ts` | 공유 `packages/` 타입 패키지 또는 openapi-typescript 중장기 검토 |
| I-6 | Architecture | `extractData` 헬퍼의 이중 타입 단언(`as {...}` → `as T`) — 런타임 구조 미보장 | `page.tsx` 라인 906–909 | API 클라이언트 레이어 interceptor 로 래핑 해제 통합 |
| I-7 | Requirement | e2e 테스트 로컬 Docker 미가동으로 실행 불가 — CI 환경 위임 상태 | `test/system-status.e2e-spec.ts`, plan 체크리스트 | CI 통과 후 plan 체크박스 갱신 |
| I-8 | Testing | `deriveHealth` 복합 조건 우선순위 테스트 미비 — `paused + failed 초과 → down`, `waiting>0, active=0, failed>=threshold → down` 케이스 미검증 | `system-status.service.spec.ts` | 해당 우선순위 케이스 테스트 추가 |
| I-9 | Testing | `utilization > 1.0` 엣지 케이스 (`active > concurrency`) 백엔드 미처리·미테스트 | `system-status.service.ts` `computeUtilization`, `page.tsx` | 서비스 스펙에 엣지 케이스 추가; 백엔드도 `Math.min(result, 1)` 상한 처리 또는 명시 |
| I-10 | Testing | 프론트엔드 컴포넌트 테스트 전무 — `extractData`, `QueueCard` 분기 로직 등 테스트 가치 높음 | `page.tsx` 전체 | 프로젝트 프론트엔드 테스트 패턴 따라 핵심 헬퍼·컴포넌트 단위 테스트 추가 |
| I-11 | Testing | e2e `EXPECTED_QUEUE_NAMES` 하드코딩 — `MONITORED_QUEUES` 와 독립 관리로 동기화 누락 위험 | `test/system-status.e2e-spec.ts` 라인 728–741 | `SYSTEM_STATUS_QUEUE_NAMES` 직접 import 또는 동기화 의무 주석 명시 |
| I-12 | Documentation | 신규 환경변수 `SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD` 가 `backend/.env.example` 에 누락 가능 | `system-status.constants.ts` 라인 231–234 | `.env.example` 에 기본값·설명 주석 포함 추가 |
| I-13 | Documentation | `spec/2-navigation/_product-overview.md` NAV-SS-01~06 상태가 구현 후에도 "🚧(계획)" 으로 잔존 | `spec/2-navigation/_product-overview.md` | NAV-SS-01~06 → ✅ 갱신 |
| I-14 | Documentation | `spec/5-system/_product-overview.md` NF-OB-06 상태 "🚧 (계획)" 잔존 | `spec/5-system/_product-overview.md` | `🚧` → `✅ (구현 완료 — GET /api/system-status/overview)` 갱신 |
| I-15 | Documentation | `spec/2-navigation/_layout.md` Marketplace 배치 예정 주석이 System Status 삽입 이후 부정확 | `spec/2-navigation/_layout.md` 라인 3055 | "Statistics 아래" → "System Status(10) 이후" 로 갱신 |
| I-16 | Side Effect | 프론트엔드 `refetchInterval: 5000` — 401 오류 후에도 5초 폴링 지속, 서버 로그 오염 | `page.tsx` 라인 932–940 | `refetchInterval` 조건부 중단 (`query.state.status === 'error' ? false : 5000`) 또는 전역 401 인터셉터 연동 |
| I-17 | Side Effect | `BullModule.registerQueue` `sharedConnection: true` 재등록 — 기존 큐 모듈 옵션 덮어쓰기 가능성 확인 필요 | `system-status.module.ts` 라인 326–332 | `@nestjs/bullmq` 중복 등록 동작 확인; ai-review INFO-12 공유 Redis 연결 정책과 정합성 검토 |
| I-18 | Maintainability | `HEALTH_DOT` 과 `GAUGE_FILL` 상수 값 동일 — 중복 | `page.tsx` 라인 911–915, 923–927 | 단일 `HEALTH_BG_COLOR` 상수로 통합 또는 의도적 분리 주석 명시 |
| I-19 | Maintainability | `isCron` 변수명이 `queue.group === "system"` 을 표현 — 의미 불일치 가능 | `page.tsx` 라인 1057 | `isSystemGroup` 으로 변수명 변경 |
| I-20 | Scope | `review/consistency/` 산출물 파일 다수 PR 포함 — 의무 절차 결과물로 정당, 범위 이탈 아님 | `review/consistency/2026/06/03/` | 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | catch 블록 서버 로깅 부재(INFO), 그 외 이슈 없음 |
| performance | LOW | `getJobCounts`/`isPaused` 순차 호출 병렬화 필요(WARNING) |
| architecture | LOW | 전반적으로 적절한 설계; fan-in 결합·타입 미러링은 INFO |
| requirement | LOW | 로딩 스켈레톤 → 스피너 UX 불일치(WARNING) |
| scope | NONE | 범위 이탈 없음, 모든 변경 의도 정당 |
| side_effect | LOW | 환경변수 즉시 평가·인덱스 매핑 암묵 결합(WARNING 2건) |
| maintainability | LOW | 상수 중복·타입 미러링·변수명 등 INFO 수준 |
| testing | LOW | 복합 조건 테스트 미비·utilization 엣지·프론트 테스트 전무(INFO) |
| documentation | LOW | env.example 누락·spec 상태 갱신 필요(INFO) |
| dependency | NONE | 신규 외부 의존성 없음, 기존 패키지만 활용 |
| database | NONE | DB 레이어 미사용, 검토 대상 없음 |
| concurrency | N/A (파일 없음) | 출력 파일 미생성 — 재시도 필요 |
| api_contract | MEDIUM | spec draft `"ok"` vs 구현 `"healthy"` 불일치(WARNING), Swagger role 설명 누락(WARNING) |
| user_guide_sync | LOW | 시스템 상태 페이지 유저 가이드 MDX 전무(WARNING), i18n parity 충족 |

---

## 발견 없는 에이전트

- **database**: 이번 변경에 PostgreSQL/ORM 레이어 코드 없음. 검토 대상 해당 없음.
- **dependency**: 신규 외부 패키지 추가 없음. 기존 의존성만 활용, 취약점·라이선스 이슈 없음.
- **scope**: 범위 이탈 없음. 단일 기능 추가에 집중, 무관한 수정 없음.

---

## 권장 조치사항

1. **(W-1) spec draft 어휘 교정** — `plan/in-progress/system-status-page.md` §A 의 `"ok"` → `"healthy"` 전면 교정. 외부 소비자 계약 오해 방지.
2. **(W-3) 로딩 UX 스켈레톤 구현** — `Loader2` 스피너를 `Skeleton` 컴포넌트로 교체하거나, project-planner 에 spec §2.5 교정 위임.
3. **(W-4) `inspect()` 병렬화** — `getJobCounts`/`isPaused` → `Promise.all` 로 큐당 1 Redis RTT 절감.
4. **(W-2) Swagger 인가 설명 추가** — `@ApiOperation` description 에 "role 제한 불필요 — 집계 카운트만 반환" 한 줄 추가.
5. **(W-7) 유저 가이드 MDX 추가** — `codebase/frontend/src/content/docs/07-workspace-and-team/` 내 system-status 서브페이지 신설.
6. **(W-5/W-6) 환경변수 로딩 및 인덱스 매핑 안전화** — `ConfigService` 주입 또는 `jest.resetModules()` 패턴 문서화; `queue.name` 기반 매핑 교체.
7. **(I-1) catch 블록 로깅** — `this.logger.error(err, ...)` 추가로 Redis 장애 무음 실패 방지.
8. **(I-12) `.env.example` 갱신** — `SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD` 기본값·설명 추가.
9. **(I-13/I-14) spec 상태 갱신** — `_product-overview.md` 의 NAV-SS-01~06, NF-OB-06 상태 ✅ 로 갱신.
10. **(I-8/I-9) 테스트 보강** — `deriveHealth` 복합 조건 우선순위 케이스 및 `utilization > 1.0` 엣지 케이스 테스트 추가.

---

## 라우터 결정

라우터 미사용 — `routing=fallback-all`. 전체 reviewer 실행.

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
- **제외**: 없음

> 참고: `concurrency` reviewer 는 출력 파일(`concurrency.md`)이 존재하지 않아 내용을 통합하지 못했습니다. 재시도 필요 1건.