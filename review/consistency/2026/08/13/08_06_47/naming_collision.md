# 신규 식별자 충돌 검토 — `plan/in-progress/backend-lint-gate-broken-on-main.md`

## 검토 범위 참고

target 문서는 `spec/` draft 가 아니라 `plan/in-progress/` 진행 문서(`--spec` 모드로 호출됨)다.
프롬프트에 포함된 "관련 spec 본문" 섹션은 예산 초과로 **113개 spec 파일 전부가 생략**되어
비어 있었으므로, 이번 검토가 지목하는 식별자마다 관련 spec/코드 파일을 직접 `Read`/`grep` 으로
열어 대조했다(`spec/5-system/14-external-interaction-api.md`,
`spec/data-flow/15-external-interaction.md`, `spec/5-system/4-execution-engine.md`,
`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`,
`codebase/backend/test/*.e2e-spec.ts`, `.github/workflows/*`, `.github/actions/**`).

target 문서 자체는 대부분 **이미 완료된 작업의 이력**이며, 마지막 항목(§idempotency 캐시 키
execution/route 스코프, 커밋 시점 워크트리 `eia-r8-cache-scope-4ae434`)이 이번 세션에서
가장 최근에 도입된 식별자다. 아래는 그 식별자들과 기존 사용처를 대조한 결과다.

## 발견사항

- **[INFO]** EIA 계열 Redis 키가 실행 엔진 키 레지스트리 컨벤션과 형태가 다르다 (target 자체 self-flag, 독립 검증 완료)
  - target 신규 식별자: `interaction:idempotency:<executionId>:<route>:<key>` (3-세그먼트,
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:21`
    `REDIS_KEY_PREFIX = 'interaction:idempotency:'` + `docs/idempotency 스코프`)
  - 기존 사용처: `spec/5-system/4-execution-engine.md` §9.1 은 "**모든** Redis 키는
    `{service}:{workspaceId}:{resource}:{id}:{sub}` 를 따른다" 고 선언하고 §9.2 표에
    `exec:*` 계열 키를 등재한다. `interaction:idempotency:*` 는 `grep` 결과 그 문서에
    **전혀 등장하지 않는다.**
  - 상세: 이름이 겹쳐서 다른 의미로 쓰이는 CRITICAL 형 충돌은 아니다 — `interaction:` 과
    `exec:` 네임스페이스가 분리돼 있어 실제 키 값이 부딪힐 일은 없다. 다만 두 레지스트리가
    분기해(§9.1 이 "모든" 이라 선언한 규칙을 EIA 계열이 따르지 않음 — `workspaceId` 세그먼트
    부재, prefix 가 `{service}` 자리에 `interaction` 을 쓰지만 §9.2 표에는 미등재) 향후
    "Redis 키는 execution-engine §9 를 보면 전수 파악된다" 고 가정하는 코드/도구가 생기면
    이 계열을 놓칠 수 있다.
  - target 문서는 이 갭을 스스로 이미 인지·기록했다(`19_56_51 convention_compliance INFO 4`,
    체크박스 미해결 `- [ ]`). 새로 발견한 사실이 아니라 **독립 검증으로 확인**한 것이며,
    target 이 이미 정확히 같은 결론(planner 작업으로 §9.1 범위를 좁히거나 EIA 계열을 묶어
    등재)을 적어 뒀으므로 별도 제안 없이 기존 처분 방침에 동의한다.

- **[INFO]** `ChannelUpdate.idempotencyKey` 는 두 모듈에서 나타나지만 동일 개념 — 충돌 아님 (검증만)
  - target 신규 식별자 아님, 확인 차 기록: `hooks.service.spec.ts` 의 mock `channelUpdate` 도
    `idempotencyKey` 필드를 쓰는데, `chat-channel/types.ts:129` 의 `ChannelUpdate.idempotencyKey`
    (target §`CCH-SE-02` dead-field 항목이 지목한 그 필드)와 **같은 타입·같은 의미**다 —
    hooks 모듈이 webhook 트리거 경유로 chat-channel 업데이트를 처리하는 테스트일 뿐, 별개
    idempotency 개념이 아니다. 이름 재사용에 의한 혼선 소지 없음.

## 충돌 없음으로 확인한 항목 (검토 관점별)

1. **요구사항 ID** — `EIA-RL-02`, `EIA-IN-11` 은 `spec/5-system/14-external-interaction-api.md`
   에 각 1곳만 정의돼 있고 target 이 재정의하지 않는다. `IDEM-1`~`IDEM-5` (e2e 테스트 라벨,
   `codebase/backend/test/external-interaction.e2e-spec.ts`) 는 그 파일에만 존재하는 새 식별자로
   기존 다른 의미의 `IDEM-*` 사용처 없음.
2. **엔티티/타입명** — `HttpResponseLike`(interface), `isIdempotencyEntry()`(type guard) 는
   `idempotency.interceptor.ts` 에만 정의되고 다른 파일에서 동명의 타입/함수로 재사용되지 않는다.
3. **API endpoint** — target 은 기존 `interact`/`cancel` 엔드포인트의 캐싱 조건·키만 바꿨고
   새 endpoint 를 추가하지 않았다. 충돌 대상 없음.
4. **이벤트/메시지명** — 이번 변경분에 신규 webhook/queue/sse 이벤트 이름 도입 없음.
5. **환경변수·설정키** — `codebase/backend/package.json` `lint` 스크립트에 추가된
   `--max-warnings 0` 은 ESLint 표준 플래그이고, CI 잡 이름 `typecheck-ratchet` 은
   `backend-checks.yml` 에만 존재. 신규 워크플로 `backend-checks.yml`, `_changed-paths.yml`,
   `.github/actions/pnpm-workspace/action.yml` 은 기존 `frontend-checks.yml` /
   `packages-checks.yml` / `web-chat-checks.yml` 등과 동일한 `*-checks.yml` 명명 컨벤션을 따르며
   이름이 겹치는 기존 파일 없음(디렉터리 실측 확인).
6. **파일 경로** — `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts` 는 기존
   `*.e2e-spec.ts` 46개와 동일한 kebab-case 기능명 컨벤션을 따르고 경로 충돌 없음. target 문서
   경로(`plan/in-progress/backend-lint-gate-broken-on-main.md`) 자체도 유일하다(동명 파일 없음).

## 요약

target 문서(대부분 완료 이력을 담은 대형 진행 plan)가 이번 세션까지 도입한 식별자 —
Redis 키 `interaction:idempotency:<executionId>:<route>:<key>`, `HttpResponseLike`,
`isIdempotencyEntry()`, `IDEM-1`~`IDEM-5` e2e 라벨, `backend-checks.yml` 등 CI 파일 — 를
전수 grep/대조한 결과 기존 사용처와 **다른 의미로 겹치는 CRITICAL/WARNING 급 충돌은 없다.**
유일하게 언급할 사항은 EIA 계열 Redis 키가 `4-execution-engine.md` §9.1/§9.2 의 "모든 키는
이 패턴" 선언·레지스트리 표와 형태·등재 여부가 어긋난다는 점인데, 이는 이름 재사용에 의한
충돌이 아니라 네임스페이스 분리(등재 누락)이며 target 문서가 이미 자체 발견해 미해결
체크박스로 남겨 두고 있어 새로운 지적이 아니다.

## 위험도

LOW
