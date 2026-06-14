## 발견사항

### 발견사항 없음 (모든 점검 관점 통과)

target 문서 `spec/5-system/14-external-interaction-api.md` 에 대해 아래 4개 점검 관점을 순서대로 검토했다.

---

#### 점검 1: 기각된 대안의 재도입

**검토 대상 기각 결정 목록:**

| 결정 ID | 기각된 대안 | target 에서의 상태 |
|---------|------------|-----------------|
| R2 | Notification 응답 body 로 인터랙션 받기 (1 notification = 1 응답 동기 모델) | 미채택 유지. target 은 inbound 를 별도 REST `/interact` 로 분리 — R2 기각 대안과 충돌 없음 |
| R3 | Long-polling 외부 이벤트 스트림 | 미채택 유지. target §5.2 는 SSE 전용 |
| R5 | 외부 WebSocket 채널 신설 | 미채택 유지. target §5.2 SSE+REST 조합만 정의. §R5 "재도입 트리거" 조건이 충족되지 않은 채로 external WS 가 재도입되지 않음 |
| R10 | NotificationDispatcher 를 실행 엔진 내부에서 직접 호출 | 미채택 유지. target §9.3·§R10 에서 facade 계층 분리 원칙을 반복 확인 — 엔진 단일 sink 정책 위반 없음 |
| R11 | 기존 `/api/executions/:id/*` 에 Guard 분기로 두 토큰 family 수용 또는 동일 path 에 별도 controller 등록 | 미채택 유지. target §10 의 `@Controller('external/executions')` prefix 분리 일관 |
| R12 | inbound·outbound 알고리즘 표기 통일 (`sha256` 또는 `hmac-sha256` 둘 중 하나로) | 미채택 유지. target §3.1 EIA-NX-03 과 §R12 가 두 표기 분리를 명시적으로 유지 |
| R13 | WS 와 EIA REST 에서 동일 에러 코드명 강제 통일 | 미채택 유지. target §5.1 표가 `STATE_MISMATCH`·`MESSAGE_TOO_LONG` 을 REST 표면 전용 코드로 정의하고 동치 cross-ref 제공 |

기각된 대안 중 target 에서 재도입된 사례 없음.

---

#### 점검 2: 합의된 원칙 위반

**검토한 핵심 원칙:**

1. **엔진 단일 sink 정책** (실행 엔진 §4.4 Rationale): target 의 `NotificationFanout`·`sse-adapter`·`ChatChannelDispatcher` 가 모두 facade 계층 형제 listener 로 위치하며, 엔진 내부가 외부 sink 를 직접 호출하지 않는다. §R10 에서 동일 원칙을 재확인.

2. **TX commit 후 emit 규약** (EIA-RL-04): target §9.3 가 after-commit hook / outbox pattern 으로 명시. 원칙 준수.

3. **최소 권한 / per_execution default** (R4): target §3.3 EIA-AU-03, §8.3, §R4 가 일관되게 `per_execution` 을 default 로 유지.

4. **in-process scope 오염 방지 invariant** (§3.3.1): HTTP Guard 가 합성하는 ctx 에서 `scope` set 금지가 구조적 제약으로 유지됨. DTO whitelist 방어 정의. invariant 위반 없음.

5. **facade 원칙** (R10·R11): 외부 API 가 internal 실행 경로와 routing prefix / 인증 family 모두 분리. 원칙 준수.

6. **at-least-once + dedup** (R7, EIA-RL-01): SSE `id:` 와 notification `seq` 가 동일 monotonic counter 공유. 원칙 준수.

원칙 위반 사례 없음.

---

#### 점검 3: 결정의 무근거 번복

target 에서 기존 결정을 번복하는 변경 사항을 검색한 결과:

- BullMQ base-4 backoff (spec 본래 의도) vs. 구현된 base-2 backoff 의 차이는 **번복이 아니라 구현 갭**으로 §3.1 EIA-NX-06·§6.6 에서 "(Planned·미구현)" 으로 명시 기록됨. 새 Rationale 없이 결정을 뒤집은 것이 아님.

- `per_trigger` 토큰을 `Trigger.config.interaction.triggerToken` JSONB 평문 보관하면서 "향후 secret store 통합 검토" 라고 기재함. 이는 secret store 원칙 (§7.1 주석)의 잠재적 완화이나, 동일 단락에서 그 사유 ("현재 JSONB 평문, 향후 검토") 를 명기하고 있어 Rationale 없는 번복이 아님.

번복으로 판정될 항목 없음.

---

#### 점검 4: 암묵적 가정 충돌

검토한 시스템 invariant:

1. **`scope: 'in_process_trusted'` 는 HTTP 경로에서 set 불가**: §3.3.1 의 Guard·DTO 의무 제약이 이를 구조적으로 차단. Invariant 유지됨.

2. **`iext_*` 는 단일 글로벌 `INTERACTION_JWT_SECRET` 으로 서명**: §8.3 에서 명시. production fail-closed 가드 패턴 동형 유지. 충돌 없음.

3. **`itk_*` 는 trigger-scoped opaque 토큰**: §7.3 의 `Trigger.config.interaction.triggerToken` 경로. cross-trigger cross-validate 가 일어나지 않는 invariant 유지.

4. **SSE 는 EventSource 헤더 미지원으로 `?token=` 허용, 그 외는 `Authorization: Bearer`**: §8.3 에서 동일 invariant 유지. 다른 endpoint 에 query-param 토큰을 허용하는 표현 없음.

5. **`notification.url` 은 `https://` 만 허용 (dev 예외)**: EIA-NX-09 에서 invariant 유지.

Invariant 우회 사례 없음.

---

## 요약

`spec/5-system/14-external-interaction-api.md` target 문서는 자체 `## Rationale` (R1–R13) 에서 기각된 모든 대안(Notification 동기 응답 모델, Long-polling, 외부 WebSocket 신설, 엔진 내부 직접 sink 호출, 동일 경로 토큰 family 분기)을 재도입하지 않으며, 합의된 설계 원칙(엔진 단일 sink + facade 계층, TX commit 후 emit, per_execution default, in-process scope 오염 방지 invariant, prefix·인증 분리)을 일관되게 준수하고 있다. BullMQ backoff 구현 갭과 `itk_*` 평문 보관 사항은 각각 "(Planned)" 표기와 인라인 근거로 명시되어 있어 무근거 번복이 아니다. Rationale 연속성 관점에서 특이사항이 없다.

## 위험도

NONE
