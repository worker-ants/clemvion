# RESOLUTION — 01_32_03

> Branch: claude/channel-web-chat-followups-1feff2
> Commit: 85350518
> Resolved: 2026-06-02

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| W1 (XFF 신뢰) | 코드 | documented-accepted-risk | 인프라·trust proxy 책임; rate-limit은 best-effort. 코멘트 추가 |
| W2 (fixed-window 버스팅) | spec | spec draft 위임 | `plan/in-progress/spec-fix-public-webhook-security.md` |
| W3 (fail-open IP) | 코드 | documented-accepted-risk | spec graceful-degradation 의도. fail-closed 는 정당한 webhook 차단 위험. 코멘트 추가 |
| W4 (DI 토큰 미등록) | 코드 | fixed (comment) | `@Optional()` 패턴 JSDoc 명시 — HooksModule provider 등록 불필요 (ChannelConversationService 동일) |
| W5 (동시 ≤3 캡 미구현) | spec | spec draft 위임 | `plan/in-progress/spec-fix-public-webhook-security.md` |
| W6 (measureBodyBytes 0 반환) | 코드 | **fixed** | 직렬화 불가 시 `maxBodyBytes + 1` 반환 — 보수적 차단 |
| W7 (INCR-EXPIRE 비원자) | 코드 | **fixed** | Redis pipeline 으로 INCR 결과 확인 후 EXPIRE, 단일 RTT |
| W8 (Guard SRP 경미 위반) | 코드 | documented-accepted-risk | 현 복잡도 수용 — Content-Length 조기 차단은 중장기 후보 |
| W9 (에러 포맷 불일치) | 코드 | resolved-as-consistent | GlobalExceptionFilter 가 `{ error:{code,message} }` 중첩 형태 언래핑 — 이미 일관성 있음 |
| W10 (Swagger 스키마 미등록) | 코드 | **fixed** | `@ApiTooManyRequestsResponse` + `@ApiPayloadTooLargeResponse` schema+example 추가 |
| W11 (measureBodyBytes 커버리지) | 테스트 | **test-added** | null/string/object/직렬화-불가(순환) 4 branch 테스트 추가 |
| W12 (DI 통합 테스트 부재) | 테스트 | documented-accepted-risk | `createTestingModule` 통합 테스트는 별도 e2e 범위 — RESOLUTION 기록 |
| W13 (config 문서 미반영) | 문서화 | **fixed** | `.env.example` 에 `publicWebhook.*` 섹션 + 기본값·fail-open 동작 설명 추가 |
| W14 (DB 조회 2회) | 코드 | **fixed** | Guard 가 `req.__publicWebhookTrigger` 에 조회 결과 첨부; `PublicWebhookReqExtension` 타입 export |
| W15 (Redis 왕복 최악 4회) | 코드 | **fixed** | pipeline 으로 INCR+EXPIRE 단일 왕복(W7 와 동시 해결) |

## TEST 결과

- lint  : 통과 (backend hooks 파일 eslint clean)
- unit  : 통과 (backend hooks 60 passed; web-chat-sdk 40 passed)
- build : 통과 (web-chat-sdk tsc + esbuild)
- e2e   : 면제 (화이트리스트: 변경 범위가 unit-level guard/service/SDK 에 한정; DB 마이그레이션·외부 API 계약 변경 없음)

## 보류·후속 항목

### spec draft 위임 (ESCALATE=spec)
- `plan/in-progress/spec-fix-public-webhook-security.md` — 아래 4 항목 project-planner 처리:
  - W2: spec/7-channel-web-chat/4-security.md §4 에 fixed-window 버스팅 허용 명문화
  - W5: spec/7-channel-web-chat/4-security.md §4 에 동시 캡 v1.1 이연 명문화
  - Info#8: spec/7-channel-web-chat/2-sdk.md §1 메서드 목록에 `off(event, cb?)` 추가
  - Info#9: spec §4 에 "메시지 4KB" 적용 레이어(webhook gate vs EIA interact) 명시

### documented-accepted-risk
- W1 (XFF): 인프라·`trust proxy` 설정은 배포 레이어 책임. 애플리케이션 강제 불가.
- W3 (fail-open IP): spec의 graceful-degradation 의도. fail-closed 전환 시 spec 수정 필요 → project-planner.
- W8 (Guard SRP): 현 복잡도 수용. Content-Length 기반 조기 차단은 중장기 후보로 plan 기록 가능.
- W12 (DI 통합 테스트): e2e/createTestingModule 통합 테스트 — 별도 followup.
- Info Redis-TLS: 프로덕션 배포 문서(`.env.example` Redis 섹션 `REDIS_TLS` 주석)에 이미 언급됨.

### INFO 항목 처리 완료
- Info#10: makeMinKey/makeHourKey 상수 export → 테스트 직접 의존 제거
- Info#11,12: quota service onModuleDestroy + hourlyNewMax override 테스트 추가
- Info#13,14: guard extractClientIp XFF-multi/empty + maxBodyBytes override 테스트 추가
- Info#15,16,17: bridge/loader 엣지케이스 테스트 추가
- Info#18,19,20,21: README/JSDoc/코멘트 문서화 개선
- Info#25: MINUTE_WINDOW_SEC/HOUR_WINDOW_SEC 명명 상수 export
- Info#22 (user-guide triggers.mdx): user-guide 업데이트는 별도 PR/followup 범위
- Info#23 (생성자 복잡도): 현 크기 수용 가능 — 주석에 TLS/auth 추가 시 팩터리 메서드 분리 권장 언급
- Info#24 (ReqShape 중복): guard 에서 `export interface ReqShape` 로 통일 — 테스트 import 가능
- Info#26 (Swagger 32KB 하드코딩): description 에 상수와 sync 필요 주석 추가 검토 → 저위험 미뤄도 됨
- Info#27,28 (릴리즈 노트): on() Unsubscribe 반환 + installGlobal 점유 가드 변경 — 릴리즈 노트 작성 시 반영
- Info#29 (@workflow/web-chat 패키지명): monorepo 내부 전파 완료; 잔여 grep 확인은 별도 PR
- Info#30 (@InjectRepository DI): HooksModule 에 `TypeOrmModule.forFeature([Trigger, Node])` 이미 포함 확인 (hooks.module.ts:17)
