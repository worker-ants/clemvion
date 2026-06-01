# Code Review 통합 보고서

> 리뷰 대상: channel-web-chat-followups (공개 webhook 남용 방어 + SDK API 보강)
> 생성일: 2026-06-02

## 전체 위험도

**MEDIUM** — 보안·요구사항·동시성 영역에서 실효적 방어를 약화시키는 WARNING 항목 15건 존재. Critical 항목 없음. 대부분은 현 운영에서 즉각 위험은 낮으나 수정 권장.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | X-Forwarded-For 신뢰 체계 미검증 — 클라이언트가 헤더를 조작하면 rate-limit 키 우회 가능 | `public-webhook-throttle.guard.ts` `extractClientIp()` | `trust proxy` 설정 또는 인프라 레이어에 따른 XFF 신뢰 위치 고정 |
| 2 | 보안 | Fixed-Window 경계 버스팅 — 윈도우 경계에서 최대 2배 트래픽 허용 | `public-webhook-quota.service.ts` | spec에 fixed-window 버스팅 허용을 명문화; 더 강한 방어 시 sliding-window 전환 검토 |
| 3 | 보안 | Fail-Open 정책 — IP 미식별 요청이 rate-limit 없이 통과 | `public-webhook-throttle.guard.ts` `canActivate()` | IP 없는 요청에 공유 버킷(`wh:rl:no-ip`) 적용 또는 fail-closed 정책 재검토 |
| 4 | 요구사항 | `PUBLIC_WEBHOOK_QUOTA_REDIS` 주입 토큰이 `HooksModule`에 미등록 — 토큰 기반 DI 경로가 실제로 동작함을 보장하는 장치 없음 | `hooks.module.ts`, `public-webhook-quota.service.ts` | 모듈에 해당 provider 등록하거나 `@Inject` 토큰 방식 제거 |
| 5 | 요구사항 | spec §4 v1 기본인 "동시 ≤3 캡" 미구현 — spec과 코드 범위 간 갭 잔존 | `public-webhook-quota.service.ts` 주석, plan | spec §4에 v1.1 이연 사유 명문화하도록 project-planner 위임 |
| 6 | 요구사항 | `measureBodyBytes` 직렬화 실패 시 0 반환 — 크기 제한 우회 가능 경로 | `public-webhook-throttle.guard.ts` L113-125 | 직렬화 불가 시 `return this.maxBodyBytes + 1`로 보수적 차단 처리 |
| 7 | 동시성 | `INCR`-`EXPIRE` 비원자적 분리 — 크래시 시 TTL 없는 키 영구 잔존, 해당 IP 영구 rate-limit 위험 | `public-webhook-quota.service.ts` `incrWithWindow()` | Lua 스크립트로 INCR+EXPIRE 원자화 (`redis.eval`) |
| 8 | 아키텍처 | Guard가 body 크기 측정 로직 포함 — 단일 책임 경미 위반 | `public-webhook-throttle.guard.ts` `measureBodyBytes` | 현재 구조 유지 가능, Content-Length 기반 조기 차단을 중장기 후보로 기록 |
| 9 | API 계약 | 에러 응답 형식 불일치 — Guard의 `{ error: { code, message } }` 구조가 NestJS 기본 HttpException 포맷과 상이하여 동일 엔드포인트 내 혼재 | `public-webhook-throttle.guard.ts`, `hooks.controller.ts` | 프로젝트 공통 에러 포맷 또는 `ExceptionFilter` 기준으로 통일 |
| 10 | API 계약 | 429/413 Swagger 응답 스키마 미등록 — description 문자열만 존재, 바디 구조 미명시 | `hooks.controller.ts` 데코레이터 | `@ApiResponse` `schema`/`example` 옵션으로 `{ error: { code, message } }` 구조 명시 |
| 11 | 테스트 | Guard의 `measureBodyBytes` 분기 커버리지 갭 — `null body`, `string body`, 직렬화 불가 경로 미커버 | `public-webhook-throttle.guard.spec.ts` | 세 경로에 대한 테스트 케이스 추가 |
| 12 | 테스트 | NestJS DI 컨텍스트 통합 테스트 없음 — `@UseGuards`·`@InjectRepository` 연결이 런타임에서만 검증 | `hooks.module.ts`, `hooks.controller.ts` | `createTestingModule` 또는 e2e 테스트에 공개 webhook 429 케이스 추가 |
| 13 | 문서화 | 신규 config 키(`publicWebhook.*`) 운영 문서 미반영 — 기본값·Redis fail-open 동작을 소스 코드 탐색 없이 파악 불가 | `public-webhook-quota.service.ts`, `public-webhook-throttle.guard.ts` | `.env.example` 또는 백엔드 설정 문서에 `publicWebhook.*` 섹션 추가 |
| 14 | 성능 | 매 요청마다 동일 DB 조회 2회 — Guard 1회 + HooksService 1회 | `public-webhook-throttle.guard.ts` `canActivate()` | Guard 조회 결과를 `req.__trigger`에 전달해 Service 재사용 |
| 15 | 성능 | Redis 왕복 최악 4회 직렬화 — `incrWithWindow` INCR+EXPIRE 순차 await × 2 키 | `public-webhook-quota.service.ts` `incrWithWindow()` | Redis `pipeline`으로 INCR+EXPIRE를 단일 왕복으로 통합 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | Redis 연결 TLS 미강제 — 평문 전송 가능 (rate-limit 카운터만 저장, 기밀 위험 낮음) | `public-webhook-quota.service.ts` 초기화 블록 | 프로덕션에서 `redis.tls` 기본값 true 강제 또는 배포 문서 명시 |
| 2 | 보안 | `measureBodyBytes` rawBody 미전달 시 JSON.stringify 추정값 사용 — 32KB 한도 부정확 가능 | `public-webhook-throttle.guard.ts` `measureBodyBytes()` | NestJS 앱 설정에 `rawBody: true` 필수 포함 |
| 3 | 보안 | `wc:resize` payload CSS 값 검증 없음 — origin 검증 통과 후 처리이므로 실제 위험도 낮음 | `bridge.ts` `applyResize()` | CSS 단위 허용 목록 정규식 검증 추가 검토 |
| 4 | 보안 | `data-global` 속성값 검증 없음 — 프로토타입 오염 가능성 (사이트 운영자 제어 속성, 위험도 낮음) | `loader-entry.ts` `resolveGlobalName()` | 식별자 패턴 검증 정규식 추가 |
| 5 | 아키텍처 | Guard가 `Repository<Trigger>` 직접 의존 — 레이어 경계 경미 노출 | `public-webhook-throttle.guard.ts` constructor | 현 복잡도 허용; 판정 로직 복잡화 시 `WebhookPolicyService` 위임 검토 |
| 6 | 아키텍처 | `PublicWebhookQuotaService`가 Redis 인스턴스를 DI 컨테이너 외부에서 직접 생성 | `public-webhook-quota.service.ts` constructor | 장기적으로 공용 `RedisModule` 도입 검토 |
| 7 | 아키텍처 | `extractClientIp` 헬퍼 중복 — `hooks.service.ts`와 동명 로직 분산 (주석에서 인식, 미이동) | `public-webhook-throttle.guard.ts` | 공용 `src/common/utils/http.ts`로 추출 |
| 8 | 요구사항 | spec `2-sdk §1` 메서드 목록에 `off()` 미반영 (코드가 spec 앞서 있음) | `spec/7-channel-web-chat/2-sdk.md §1` | project-planner가 `off(event, cb?)` 추가 및 Rationale 명문화 |
| 9 | 요구사항 | spec §4 "메시지 4KB 제한" 적용 레이어 불명확 | `spec/7-channel-web-chat/4-security.md §4` | spec에서 적용 레이어(EIA interact vs webhook gate) 명시하도록 위임 |
| 10 | 테스트 | hourly 한도 테스트가 Redis key 이름 포맷에 직접 의존 — key 변경 시 false-pass 위험 | `public-webhook-quota.service.spec.ts` | key 포맷 상수를 서비스에서 export하고 테스트가 참조 |
| 11 | 테스트 | `hourlyNewMax` config override 테스트 누락 | `public-webhook-quota.service.spec.ts` | `hourlyNewMax` 오버라이드 케이스 추가 |
| 12 | 테스트 | `onModuleDestroy` quit 경로 미테스트 | `public-webhook-quota.service.spec.ts` | quit 정상·예외 두 케이스 테스트 추가 |
| 13 | 테스트 | `extractClientIp` XFF 다중 IP·빈 cf-connecting-ip 엣지 케이스 미테스트 | `public-webhook-throttle.guard.spec.ts` | 해당 케이스 추가 |
| 14 | 테스트 | `maxBodyBytes` config override 경로 미테스트 | `public-webhook-throttle.guard.spec.ts` | 작은 `maxBodyBytes` 주입 guard로 한도 초과·미만 케이스 검증 |
| 15 | 테스트 | `applyResize` `state` 필드 누락 시 `dataset.wcState` 미변경 검증 없음 | `bridge.spec.ts` | state 누락 케이스 추가 |
| 16 | 테스트 | `installGlobal` boot 예외 발생 시 큐 replay 계속 진행 여부 미검증 | `loader.spec.ts` | 예외 boot 다음 open 항목이 실행됨을 검증 |
| 17 | 테스트 | boot 전 `off` 호출 시 동작 미테스트 | `loader.spec.ts` | boot 없이 off 호출 시 throw 없음 검증 |
| 18 | 문서화 | web-chat-sdk README 예제에 `off()` 및 unsubscribe 패턴 미포함 | `codebase/packages/web-chat-sdk/README.md` | `chat.off()` 또는 `const unsubscribe = chat.on(...)` 패턴 한 줄 추가 |
| 19 | 문서화 | `applyResize` JSDoc에 "필수" 이유 미기술 | `bridge.ts` `applyResize` JSDoc | iframe 자체 크기 제어 불가 이유 한 줄 추가 |
| 20 | 문서화 | `Unsubscribe` 타입 공개 API 표면 노출 여부 미언급 | `types.ts` `Unsubscribe` | re-export 대상 여부 주석 명시 |
| 21 | 문서화 | `loader-entry.ts` `document.currentScript` 타이밍 의존성 미문서화 | `loader-entry.ts` | IIFE 완료 후 null 타이밍 한 줄 주석 추가 |
| 22 | 문서화 | 공개 webhook rate-limit 동작이 user-guide(`triggers.mdx`) 미반영 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` | 공개 webhook 제한 callout 추가 |
| 23 | 유지보수 | `PublicWebhookQuotaService` Redis 초기화 분기가 생성자에 집중 — early-return 3개 | `public-webhook-quota.service.ts` constructor | 현 크기 수용 가능; TLS/auth 옵션 추가 시 private static 팩터리 메서드 분리 검토 |
| 24 | 유지보수 | `ReqShape` 인터페이스 인라인 선언 중복 — guard와 테스트 각각 별도 정의 | `public-webhook-throttle.guard.ts`, 테스트 파일 | guard 상단에 export하고 테스트에서 import |
| 25 | 유지보수 | Redis 윈도우 시간 리터럴 `60`, `3600` — 명명된 상수 부재 | `public-webhook-quota.service.ts` `consumeStart` | `MINUTE_WINDOW_SEC`, `HOUR_WINDOW_SEC` 상수 추가 |
| 26 | 유지보수 | Swagger description에 `32KB` 하드코딩 — 상수와 별도 유지 필요 | `hooks.controller.ts` `@ApiPayloadTooLargeResponse` | description 단순화 또는 변경 시 함께 갱신 주석 추가 |
| 27 | 부작용 | `on()` 반환 타입 `void→Unsubscribe` 변경 — internal-only v0.x, 모든 호출처 갱신 완료 | `bridge.ts`, `types.ts` | 릴리즈 노트에 명시 권장 |
| 28 | 부작용 | `installGlobal()` 비-함수 점유 가드 추가 — 기존 silent overwrite 동작 변경 | `loader.ts` | 릴리즈 노트에 동작 변화 명시 권장 |
| 29 | 부작용 | `@clemvion/web-chat` → `@workflow/web-chat` 패키지명 변경 — monorepo 내부로 한정 | `web-chat-sdk/package.json` | 이전 import 잔존 여부 monorepo 전체 grep 확인 권장 |
| 30 | 의존성 | `@InjectRepository(Trigger)` DI가 `HooksModule.imports`에 `Trigger` 엔티티 공급 선언을 전제 — diff에 imports 변경 없음 | `hooks.module.ts` | imports 배열에 `TypeOrmModule.forFeature([Trigger])` 포함 여부 명시적 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | XFF 신뢰 체계 미검증, fail-open IP 미식별 우회, fixed-window 버스팅 |
| requirement | MEDIUM | DI 토큰 미등록, spec §4 "동시 ≤3 캡" 미구현, measureBodyBytes 0 반환 우회 |
| concurrency | LOW | INCR-EXPIRE 비원자 분리로 TTL 없는 키 영구 잔존 위험 |
| performance | LOW | 매 요청 DB 조회 2회, Redis 왕복 최악 4회 직렬화 |
| architecture | LOW | Guard 단일 책임 경미 위반, extractClientIp 중복 |
| api_contract | LOW | 에러 응답 포맷 불일치, Swagger 스키마 미등록 |
| testing | LOW | measureBodyBytes 분기 커버리지 갭, DI 통합 테스트 부재 |
| documentation | LOW | 신규 config 키 운영 문서 미반영 |
| scope | LOW | extractClientIp 중복 헬퍼 잔존 (유보 허용, 주석 명시) |
| side_effect | LOW | 반환 타입·점유 가드 동작 변화 (모두 내부 전파 완료) |
| maintainability | LOW | Redis 윈도우 리터럴, ReqShape 인라인 중복 |
| dependency | LOW | @InjectRepository DI 전제 확인 필요 |
| user_guide_sync | LOW | 공개 webhook 제한 user-guide 미반영 |

---

## 발견 없는 에이전트

없음 (전체 13개 에이전트가 1건 이상 발견).

---

## 권장 조치사항

1. **(수정 권장) INCR-EXPIRE 원자화** — `incrWithWindow()`를 Lua 스크립트 또는 pipeline으로 원자화하여 TTL 없는 키 영구 잔존 위험 제거 (동시성 WARNING #7).
2. **`measureBodyBytes` 직렬화 실패 시 0 반환 수정** — `return this.maxBodyBytes + 1`로 보수적 차단 처리 (요구사항 WARNING #6).
3. **`PUBLIC_WEBHOOK_QUOTA_REDIS` 토큰 HooksModule 등록** — provider 등록하거나 `@Inject` 토큰 방식 제거 (요구사항 WARNING #4).
4. **에러 응답 포맷 통일 + Swagger 스키마 등록** — Guard 429/413 응답 바디를 프로젝트 공통 포맷에 맞추고 스키마 명시 (API 계약 WARNING #9, #10).
5. **Guard 매 요청 DB 조회 중복 제거** — Guard 조회 결과를 `req.__trigger`로 전달해 HooksService 재사용 (성능 WARNING #14).
6. **Redis pipeline 도입** — `consumeStart`의 두 키 INCR+EXPIRE를 단일 pipeline으로 통합 (성능 WARNING #15).
7. **`measureBodyBytes` 분기 테스트 추가** — null body, string body, 직렬화 불가 경로 커버 (테스트 WARNING #11).
8. **NestJS DI 통합 테스트 추가** — `createTestingModule` 또는 e2e에 공개 webhook 429 케이스 (테스트 WARNING #12).
9. **운영 설정 문서 갱신** — `.env.example` 또는 백엔드 문서에 `publicWebhook.*` 키 기본값·Redis fail-open 동작 명시 (문서화 WARNING #13).
10. **spec 갭 해소 (project-planner 위임)** — spec §4 "동시 ≤3 캡" v1.1 이연 명문화, `2-sdk §1`에 `off()` 추가, "메시지 4KB" 적용 레이어 명시.
11. **IP fail-open 정책 재검토** — IP 미식별 요청에 공유 버킷 적용 또는 fail-closed 전환 spec 수준 논의 (보안 WARNING #3).
12. **`extractClientIp` 공용 util 추출** — 두 파일 중복 제거, 정책 불일치 위험 해소 (아키텍처 INFO #7).

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`).

- **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency`, `concurrency`, `api_contract`, `user_guide_sync` (13명)
- **제외**: 1명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | database | 변경 파일에 DB 마이그레이션·스키마·ORM 엔티티 변경 없음 — rate-limit은 Redis 기반, DB는 read-only trigger 조회만 |

- **강제 포함(router_safety)**: `dependency`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명)