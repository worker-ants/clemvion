# Background output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. fire-and-forget 격리 컨트랙트 + `meta.backgroundRunId` (모니터링 API 조회 키) 유지. 잔여 권고 없음.
> (2026-05-16 구현 분석) handler 가 schema·spec 부합. credential-leak 가드(`rawConfig` 명시 echo, spread 회피) 적용 — 다른 noof handler 의 baseline 사례. 단 `meta.durationMs` 가 spec §5.1 표에 "engine inject" 가 아닌 "handler 측정" 으로 명시되어 있음 (Principle 2 의 engine 공통 주입 정책과 미세 비대칭 — fire-and-forget 의도로 정당화). spec 본문이 이미 명시하므로 변경 권고 없음.

> 대상 spec: `spec/4-nodes/1-logic/12-background.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/12-background.md:96-111` — §5.1 (port `main`, pass-through):

```json
{
  "config": {
    "notes": "Fan out analytics event after user signup",
    "notifyOnFailure": true,
    "maxDurationMs": 300000
  },
  "output": { "event": "user_signup", "userId": "u_1" },
  "meta": {
    "durationMs": 0,
    "backgroundRunId": "8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234",
    "forkedAt": "2026-05-10T05:04:37.123Z"
  },
  "port": "main"
}
```

§5.2 — `background` 포트는 핸들러가 활성화하지 않음 (별도 ExecutionContext, fire-and-forget).

## 진단

Background 는 **fire-and-forget 특수 컨테이너 + pass-through**. 메인 흐름의 단계 1개 + background 흐름은 별도.

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 메인 흐름 통과 (`main` 포트) | input pass-through | 적절 — Logic 공통 §10 |
| background 본문 진입 | (별도 ExecutionContext, 메인 노드의 output 아님) | 적절 — fire-and-forget 격리 컨트랙트 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input pass-through | 적절 | spec §5.1 |
| `meta.backgroundRunId: UUID v4` | 적절 (meta) | 모니터링 API 의 조회 키 — 워크플로우 실행 내 백그라운드 run 식별. 비즈니스 데이터 아닌 식별자 |
| `meta.forkedAt: ISO8601` | 적절 (meta) | fork 시점 타임스탬프 |
| `meta.durationMs` | 적절 | 핸들러 자체의 즉시 처리 시간 (fire-and-forget) — 백그라운드 본문 시간 아님 |
| `meta.jobId?` (예약) | 적절 (meta) | BullMQ job ID — 향후 모니터링 API 확장 지점 |
| `config.notes` / `notifyOnFailure` / `maxDurationMs` (raw echo) | 적절 | Principle 7 |
| `port: 'main'` (handler return) | 적절 | 항상 `main`. `background` 포트는 엔진이 별도 활성화 |

부적절 항목 없음.

추가 점검:

- **`backgroundRunId` 의 위치** — `meta` vs `output` 검토:
  - `meta` 에 두면 다운스트림이 `$node["X"].meta.backgroundRunId` 로 접근 — Principle 2 (실행 메트릭) 에 정확히 맞지는 않음 (식별자 ≠ 메트릭)
  - `output` 에 두면 비즈니스 데이터로 분류 — 그러나 메인 흐름의 후속 노드가 이 ID 를 받아 모니터링 API 호출에 사용한다면 비즈니스적 가치 있음
  - 현 spec 은 `meta` 선택 — Principle 2 의 "토큰/모델/duration 외 실행 컨텍스트 식별자" 카테고리로 해석 가능. 합리적이며 변경 권장 안 함.
- **`output` 에 본문 결과가 없음** — fire-and-forget 컨트랙트의 핵심. spec §5.2 가 "메인 흐름에서 본문 결과 접근 불가" 명시. 결과를 받아야 하면 Parallel 사용. 적절.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": {
    "notes": <string raw>,
    "notifyOnFailure": <boolean>,
    "maxDurationMs": <number>
  },
  "output": { /* input 전체 pass-through */ },
  "meta": {
    "durationMs": <number>,                          // handler-side fork 처리 시간 (보통 0~수 ms)
    "backgroundRunId": <UUID v4>,                    // 본문 run 식별자
    "forkedAt": <ISO8601>,                            // fork 시점
    "jobId"?: <string>                               // BullMQ job ID (향후 확장)
  },
  "port": "main"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- fire-and-forget 노드의 메인 흐름은 본질적으로 pass-through — `output` 에 본문 결과를 두면 격리 컨트랙트 위반.
- `backgroundRunId` 는 모니터링용 식별자로 `meta` 에 위치 — Principle 2 의 실행 컨텍스트 메트릭 카테고리에 부합.
- 본문 컨텍스트의 노드들은 자체 NodeExecution 레코드를 가지며 `parentNodeExecutionId` 로 Background 그룹에 묶임 — 본 noof output 이 아니라 별도 관측 영역.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/logic/background/{background.handler.ts, background.schema.ts, background.handler.spec.ts, background.component.ts}`. schema.spec.ts 부재 (schema 가 매우 단순해 별도 분리 불필요).

1. **spec §5 ↔ handler return 정합성 (fire-and-forget 컨테이너)**:
   - `background.handler.ts:63-79` 의 return 객체 `{ config: { notes, notifyOnFailure, maxDurationMs }, output: input, meta: { durationMs, backgroundRunId, forkedAt }, port: 'main' }` — spec §5.1 JSON 과 정합.
   - `output: input` pass-through — Logic 공통 §10 부합 (`port: 'main'` 분류).
   - `port: 'main'` 만 반환 — `background` 포트는 엔진(`ExecutionEngineService.scheduleBackgroundBody`) 별도 활성화 (spec §5.2 + §4 의 fire-and-forget 격리 컨트랙트). 부합.
   - `meta.backgroundRunId` 는 `randomUUID()` (`:56`) 로 생성 — Date.now() 충돌 회피 의도 (`background.handler.ts:28-29` comment). 모니터링 API 조회 키.

2. **schema ↔ spec config 정합성**:
   - `backgroundNodeConfigSchema` (`background.schema.ts:31-64`): `notes` (string, default `""`) / `notifyOnFailure` (boolean, default false) / `maxDurationMs` (int, min 0, default 300000). spec §1 표와 일치.
   - 표현식(`{{ }}`) 미사용 — spec §1 footnote 명시, schema 도 정적 default 만 사용.

3. **validate 일관성**:
   - `background.handler.ts:40-46` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors` 만 사용 — schema 가 모든 필드 default 보유, warningRules / validateConfig 부재. SSOT 침범 없음.
   - **gap1**: `background.schema.ts:75-84` (`backgroundNodeMetadata`) 에 `warningRules` / `validateConfig` 둘 다 부재 — schema 가 default 로 모든 필드 흡수하므로 의도. 하지만 `maxDurationMs < 0` 같은 invalid 값은 zod 단계에서 거부 (`.min(0)`), handler-side 직접 거부 안 함. 정합.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만 (spec §6 명시: "runtime 에러 포트를 갖지 않는다"). 본문 실패는 메인 status 에 무영향 (격리). 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1 (config ↔ output 직교): `output = input` pass-through 라 config 리터럴 echo 잔재 없음. 부합.
   - Principle 2 (meta 실행 메트릭): `meta.durationMs` (handler 측정) / `meta.backgroundRunId` (식별자) / `meta.forkedAt` (timestamp). spec §5.1 표에 명시. **미세 비대칭**: `durationMs` 가 spec §5.1 출처 표에 "handler 측정" 으로 명시되어 있어 다른 노드의 "engine inject" 와 다름. 그러나 fire-and-forget 의 핸들러측 처리 시간만 의미 있어 정당화 (spec §5.1 footnote: "백그라운드 본문 시간 아님").
   - Principle 5: `port: 'main'` 정적 string. 부합.
   - Principle 6: `main` / `background` 정적 포트 (시스템 예약어). 부합.
   - Principle 7 (credential leak 가드): `background.handler.ts:64-68` 가 `rawConfig.notes` / `notifyOnFailure` / `maxDurationMs` 명시 echo (spread `...rawConfig` 회피). 향후 schema 가 confidential 필드를 passthrough 로 추가해도 누수 차단 — **baseline 사례**. test `background.handler.spec.ts:84-103` (`apiKey` 시나리오) 가 이를 강제.
   - Principle 9: Background 는 fire-and-forget 특수 컨테이너로 다른 컨테이너의 `output: null` → 오버라이트 패턴을 따르지 않음 (spec 0-common §3 footnote). 의도된 비대칭.
   - Principle 11: `meta.jobId?` 선택 필드 (spec §5.1 + schema `:21`) — handler 는 미발행 (`background.handler.spec.ts:146-156` 명시 검증). 향후 엔진이 stamp.

6. **handler 테스트 (`background.handler.spec.ts`)**:
   - validate (default / fully-populated / `maxDurationMs=0`)
   - execute main pass-through (input 그대로 / config echo / `{{ }}` template echo / rawConfig spread 회피 — `apiKey` leak 가드)
   - Phase 2 meta (durationMs / backgroundRunId / forkedAt ISO8601 / unique backgroundRunId / no jobId / 5-field invariant)
   - **누락**:
     - `maxDurationMs=0` 의 무제한 동작은 엔진(BullMQ) 측 — handler 테스트 범위 밖.
     - `notifyOnFailure` 가 본문 실패 시 알림 발송하는 시나리오는 엔진 통합 테스트 영역.

7. **횡단 일관성 (컨테이너 / fire-and-forget)**:
   - Background 만 `containerId` 멤버십 패턴 사용 안 함 (forward-reachable 본문 — spec 0-common §3 footnote). 의도된 차이.
   - `main` / `background` 두 포트 비대칭 — handler 는 `main` 만 반환, `background` 는 엔진이 별도 활성화. 다른 컨테이너 (Loop / ForEach / Map / Parallel) 의 `body` / `branch_<i>` 비활성화 패턴(엔진 책임) 와 일관.
   - credential leak 가드(명시 echo)는 Background / Send Email / HTTP Request 등 외부 통합 노드 패턴 — Background 가 가장 단순한 baseline.

8. **구현 품질**: clean. `randomUUID()` 로 충돌 회피 (Date.now() 회피 명시), `rawConfig` 명시 echo (credential 누수 차단), `Logger` 미사용 (fire-and-forget — 본문 실행 시 별도 worker 가 로깅). 매직 넘버 / dead code 없음.

## 종합 개선안 (2026-05-16)

- [ ] (spec) §5.1 출처 표의 `meta.durationMs` 가 "handler 측정" 임을 다른 컨테이너의 "engine inject" 와 비교해 footnote 추가 — fire-and-forget 의도 명시. 근거: `background.handler.ts:73-74` vs Loop/ForEach 의 엔진 inject 패턴. 변경 자체는 미세하나 conventions 횡단 일관성 검토 시 혼동 가능.
- [ ] (impl) `meta.jobId` 엔진 stamp 후속 작업 — `ExecutionEngineService.scheduleBackgroundBody()` 가 BullMQ job add 후 NodeExecution.outputData 에 stamp. 현 handler 미발행(`background.handler.spec.ts:146-156`) 은 의도된 분리 유지. 본 plan 은 spec 본문에 명시 반영 권고만 — 별도 plan 으로 추적.
- [ ] (frontend) `background:run:<id>` WebSocket 채널 구독 / 상태 표시 UI — spec §8.5 명시. plan 외부 (별도 plan 추적).
