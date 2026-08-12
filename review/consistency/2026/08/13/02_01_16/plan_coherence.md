# Plan 정합성 검토 — `plan/in-progress/spec-draft-redis-key-registry.md`

## 발견사항

- **[WARNING]** 삭제되는 phantom 키 `core:{wsId}:rate:{userId}` 가 이미 **재도입이 예정된 후속 작업**과
  겹친다 — 근거 미연결
  - target 위치: 제안 변경 §2 표 (`§9.2 core:{wsId}:rate:{userId}` → **제거** + 각주
    "API rate limit 은 in-memory(`@nestjs/throttler` 기본 storage)")
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` 잔여 항목 "**A-3
    follow-up — Layer 1 (분산 throttle store)**"(미해결, `[ ]`) — "기존 30/min IP
    throttle 을 Redis 분산 store 로 이전(멀티 인스턴스 quota 직렬화). `@nestjs/throttler`
    storage 가 **전역 단일 설정**이라 **모든 throttled 엔드포인트에 영향** … 별 infra PR 로
    분리(deferred, 사용자 결정 2026-06-02)."
  - 상세: target 의 실측("API rate limit 은 storage 설정 없이 기본 in-memory") 자체는
    현재 코드 기준으로 정확하다. 문제는 각주의 **의도**다 — "지웠다는 사실과 이유가 남아야
    다음 사람이 되살리지 않는다" 고 명시적으로 적었는데, `@nestjs/throttler` 의 storage 를
    Redis 로 옮기는 작업이 **이미 사용자 결정(2026-06-02)으로 확정된 채 별 infra PR 로
    defer 된 상태**로 다른 plan 에 살아 있다. 그 storage 가 "전역 단일 설정" 이라는
    서술은 이 IP-throttle 전환이 **API rate limit 을 포함한 모든 throttled 엔드포인트**에
    영향을 준다는 뜻이라, A-3 follow-up 이 언젠가 집행되면 유사한 Redis 키가 다시
    생긴다. 즉 "되살리지 않도록" 이라는 각주의 취지와, 이미 결정된 "언젠가 되살아난다"
    는 사실이 서로 어긋난다 — target 이 이 연결을 몰랐다면 각주만 보고 미래
    구현자가 잘못된 결론(Redis 백업 rate limit 은 검토된 적 없다)을 낼 위험이 있다.
  - 제안: target 의 §9.2 각주 또는 신설 `spec/conventions/redis-keys.md` 의
    "워크스페이스 스코프를 언제 넣는가" 절에 A-3 follow-up 을 교차 참조해 두면(예: "현재
    제거하지만 `cafe24-backlog-residual.md` A-3 follow-up 집행 시 Redis 백업 storage 로
    재도입될 수 있다"), 그 시점의 구현자가 새 인벤토리에 등재하지 않고 넘어가는(=이번
    조사가 고치려는 바로 그 결함) 재발을 막는다. target 문서 갱신 권장(plan 자체 변경은
    불요).

- **[WARNING]** SSE/notification 분산 fan-out 이 도입되면 신규 Redis pub/sub 채널이
  생기는데 target 인벤토리 설계가 이를 예비하지 않는다
  - target 위치: 제안 변경 §1 "전역 인벤토리" 설계(포인터 방식) + 실측 표(현재 존재하는
    pub/sub 채널 `integration:cache:invalidate` 1건만 등재)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 미구현
    항목 "**분산(다중 인스턴스) SSE / notification fan-out**"(§R10, 미해결 `[ ]`) —
    "현재 `SseAdapter`·`NotificationFanout` 모두 … in-process(in-memory) RxJS 구독만
    하고 Redis pub/sub 발행/구독이 없음 … 다중 인스턴스에서 … Redis pub/sub 도입
    필요."
  - 상세: 이 항목이 구현되면 `integration:cache:invalidate` 와 같은 성격의 신규
    pub/sub 채널이 EIA 계열에 생긴다. target 의 신설 규약 문서는 "명명 규칙 · 워크스페이스
    스코프 조건 · 포인터 인벤토리" 세 가지만 담을 계획이라 **새 키/채널이 코드에 추가될
    때 이 문서에 반영해야 한다는 유지보수 원칙**이 명시적으로 없다. §9.2 가 방치돼
    phantom 항목을 남긴 원인(등재·삭제 프로세스 부재)과 같은 클래스의 재발 소지다.
  - 제안: 신설 규약 문서 내용 항목에 "새 Redis 키/채널 도입 시 이 인벤토리(또는 소유
    문서)에 등재한다" 는 한 줄 유지보수 원칙을 추가하면, 이 항목처럼 이미 알려진 예정
    작업뿐 아니라 앞으로 생길 모든 신규 키에 일반적으로 적용된다. target 문서 갱신
    권장(plan 자체 변경은 불요).

## 검증된 정합 사항 (참고, 발견 아님)

- target Overview 가 "원 백로그 항목" 으로 인용하는 `backend-lint-gate-broken-on-main.md`
  의 미해결 checklist 항목("EIA 계열 Redis 키가 §9.1/§9.2 에 없다", `19_56_51`
  convention_compliance INFO 4)을 실제로 대조 확인 — **현재도 미해결(`[ ]`) 로 남아
  있고**, target 체크리스트 5번째 항목("`backend-lint-gate-broken-on-main.md` 의 원
  항목 종결 + '실측으로 형태가 커졌다' 기록")이 이를 정확히 인수해 닫을 계획을 세워
  뒀다. 정합.
- 원 항목이 제시한 두 대안("EIA 계열을 묶어 §9.2 에 등재" vs "§9.1 의 '모든' 을 실제
  범위로 좁힌다") 중 target 은 후자를 택하면서 별도 규약 문서로 SoT 를 분리한다 —
  대안 자체와 모순 없음.
- `spec/data-flow/15-external-interaction.md` 의 idempotency 캐시 키 포맷은
  developer 턴(`eia-r8-cache-scope-4ae434`, 현재 세션과 동일 worktree)이 이미
  3-세그먼트(`interaction:idempotency:<executionId>:<route>:<key>`)로 완료해 뒀고,
  target 의 실측 표도 동일 포맷을 정확히 반영한다. `spec-draft-eia-r8-alignment.md`
  (별개 planner 턴, 전 항목 완료)의 잔여 2-세그먼트 diff 서술은 이미 실행된 과거
  변경 이력일 뿐 현재 파일 상태와 어긋나지 않는다.
- `4-execution-engine.md` frontmatter `pending_plans`(execution-engine-residual-gaps.md
  · retry-turn-terminal-guard.md · exec-intake-followups.md)는 전부 §11/§4.3/§8
  등 §9 (Redis 키) 와 무관한 표면을 추적 중이라, target 이 §9.1/§9.2 만 정정해도
  `status: partial` 근거나 pending_plans 유효성과 충돌하지 않는다.
- `execution-engine-residual-gaps.md` G3(§9.2 `exec:cont:seq` TTL, ✅ DONE)이 이미
  §9.2 를 수정해 뒀지만 target 의 phantom 제거·각주 추가 범위와 겹치지 않는 별도
  행이라 충돌 없음.
- 워크스페이스 스코프 관련 미해결 "결정 필요" 항목은 다른 in-progress plan 에서
  발견되지 않았다 — target 의 "지금은 어느 키도 워크스페이스로 안 넣는다" 결정이
  우회하는 상위 결정이 없다.
- `spec/conventions/redis-keys.md` 신설을 이미 진행 중이거나 계획 중인 경쟁 plan
  없음(중복 착수 아님).

## 요약

target(`spec-draft-redis-key-registry.md`)이 인용하는 "원 백로그 항목"은
`backend-lint-gate-broken-on-main.md` 의 미해결 checklist 항목과 정확히 일치하며,
target 자신의 체크리스트가 그 항목을 종결하는 계획까지 담고 있어 선행 plan 과의
직접 충돌이나 미해결 결정 우회는 발견되지 않았다. 다만 target 이 "실재하지 않는
항목을 지운다"는 원칙으로 삭제하는 §9.2 phantom 키 중 하나(`core:{wsId}:rate:{userId}`,
API rate limit)는 이미 사용자 결정으로 확정·defer 된 다른 plan(`cafe24-backlog-residual.md`
A-3 follow-up)이 향후 Redis 백업 storage 로 재도입을 예정하고 있어, target 의 "되살리지
않기 위한" 각주 취지와 어긋날 소지가 있다. 또한 신설 규약 문서 설계에 "새 키 도입 시
등재" 라는 명시적 유지보수 원칙이 없어, 이미 다른 plan 에 등재된 또 하나의 예정 Redis
표면(SSE/notification 분산 fan-out 의 pub/sub 채널)이 향후 같은 방식으로 누락될 수
있다. 두 건 모두 target 문서에 교차 참조 한 줄을 추가하는 수준으로 해소 가능하며,
현재 draft 를 막을 정도의 결함은 아니다.

## 위험도

LOW
