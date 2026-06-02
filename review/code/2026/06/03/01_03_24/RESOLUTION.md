# RESOLUTION — 01_03_24

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드(plan) | 59c28d41 | plan/in-progress/system-status-page.md §A `"ok"` → `"healthy"` 전면 교정 |
| W-2 | 코드 | 59c28d41 | `@ApiOperation` description 에 "admin role 제한 없음 — 집계 카운트만 반환, 민감정보 미노출" 추가 |
| W-3 | 코드 | 59c28d41 | `Loader2` 스피너 → `SystemStatusSkeleton` (animate-pulse div 기반) 교체. spec §2.5 준수. Skeleton 컴포넌트 없어 Tailwind 직접 구현 |
| W-4 | 코드 | 59c28d41 | `inspect()` `getJobCounts` + `isPaused` → `Promise.all([...])` 병렬화. 큐당 Redis RTT 1회 절감 |
| W-5 | 코드 | 59c28d41 | `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 즉시 평가 → `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` 게터 함수 도입. service 는 게터 호출로 전환. 기존 상수 `@deprecated` 유지 |
| W-6 | 코드 | 59c28d41 | `useFactory` 인덱스 매핑 → `Map<name, queue>` 기반 조회. `MONITORED_QUEUES` 와 `inject` 순서 불일치로 인한 무음 오매핑 방지 |
| W-7 | 코드(docs) | 59c28d41 | `codebase/frontend/src/content/docs/07-workspace-and-team/system-status.{mdx,en.mdx}` 신설 (KO/EN 동시) |

## INFO 조치 (선택 항목, 가치 높아 함께 처리)

| INFO # | 조치 commit | 내용 |
|--------|-------------|------|
| I-1 | 59c28d41 | `catch(err)` + `this.logger.error(...)` 추가 — Redis 장애 무음 실패 방지 |
| I-8 | 59c28d41 | `deriveHealth` 복합 우선순위 테스트 2건 추가 (paused+failed 동시, waiting+failed 동시) |
| I-9 | 59c28d41 | `computeUtilization` `Math.min(…, 1)` 상한 추가 + 테스트 케이스 |
| I-11 | 59c28d41 → **388ac7b3 되돌림** | e2e 가 constants 를 import 하면 큐 상수가 서비스 파일→nodes 그래프(`@workflow/node-summary`)를 전이 로드해 e2e jest 모듈 해석이 깨짐. 블랙박스 e2e 원칙에 따라 하드코딩 + SoT 동기화 주석으로 복원 (docker 기동 후 e2e 실행에서 발견) |
| I-12 | 59c28d41 | `.env.example` `SYSTEM_STATUS_FAILED_THRESHOLD` / `SYSTEM_STATUS_DELAYED_THRESHOLD` 기본값·설명 추가 |
| I-13 | 59c28d41 | `spec/2-navigation/_product-overview.md` NAV-SS-01~06 🚧(계획) → ✅ |
| I-14 | 59c28d41 | `spec/5-system/_product-overview.md` NF-OB-06 🚧(계획) → ✅ |
| I-15 | 59c28d41 | `spec/2-navigation/_layout.md` Marketplace 배치 주석 "Statistics 아래" → "System Status(10) 이후" |
| I-16 | 59c28d41 | `refetchInterval: (query) => query.state.status === "error" ? false : 5000` — 에러 시 폴링 중단 |
| I-17 | — (확인만) | `sharedConnection: true` 재등록은 NestJS BullMQ 패턴상 안전. 각 `registerQueue` 는 독립 DI 토큰을 생성하며 기존 큐 옵션을 덮어쓰지 않는다. 코드 변경 불필요. |
| I-19 | 59c28d41 | `isCron` → `isSystemGroup` 변수명 교정 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (13 passed, system-status.service.spec 포함 — 기존 10 + 신규 3)
- build : 통과
- e2e   : **통과** (143 tests, system-status 3건 포함 — docker 데몬 기동 후 실행. 로그 `_test_logs/e2e-20260603-072640.log`). 최초엔 docker 미가동으로 차단됐으나 재실행 시 I-11 import 가 모듈 로드를 깨 1회 실패 → 388ac7b3 으로 복원 후 PASS.

## 보류·후속 항목

- INFO I-2 (캐싱): 5초 폴링 결과 in-memory TTL 캐시. 다중 사용자 규모 확인 후 별도 PR 검토.
- INFO I-3 (useMemo 그룹핑): 프론트엔드 렌더 최적화. 현재 큐 수(12개)에서 성능 영향 미미.
- INFO I-4 (fan-in 문서화): `system-status.constants.ts` 에 도메인 횡단 레지스트리 주석 이미 존재. 추가 조치 불필요 수준.
- INFO I-5 (타입 미러링): 공유 패키지 또는 openapi-typescript 중장기 검토.
- INFO I-6 (extractData 타입 단언): API 클라이언트 레이어 리팩토링 — 별도 scope.
- INFO I-7 (e2e CI): e2e 작성 완료. 환경 차단으로 CI 결과 대기.
- INFO I-10 (프론트 컴포넌트 테스트): extractData/QueueCard 단위 테스트 — 별도 PR.
- INFO I-18 (HEALTH_DOT/GAUGE_FILL 중복): 의도적 의미 분리(dot size vs gauge fill) 로 현재는 유지. 추후 통합 가능.
