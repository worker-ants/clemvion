# RESOLUTION — `review/consistency/2026/09/05/22_25_00`

**BLOCK: YES** · Critical **1** · WARNING **2** · INFO **4**. **전건 조치 완료.**

## Critical — 내가 쓴 규범이 세 필드를 열거했는데 둘만 닫았다

| # | 지적 | 조치 |
|---|---|---|
| 1 | `Trigger.config.interaction.triggerToken`(`itk_*`, **영구 평문** bearer 토큰)이 `GET/POST/PATCH /api/triggers` 응답에 그대로 나간다 | **스트립 추가** + 뮤테이션 확인 |

**지적이 정확하고, 아픈 자리다.** 두 턴 전 planner 에서 내가 직접 쓴
`secret-store.md §1.1` 이 금지 대상을 **이름으로 셋** 열거한다 —
`AuthConfig.config` 자격증명 · **`Trigger.config.interaction.triggerToken`** ·
`Trigger.notification_secret_v2`. 이 PR 은 그중 **둘만** 닫았다.

그리고 §1 이 이 필드를 secret store 비대상으로 인정한 근거 (c) 는
*"발급 응답에 **1회만** 노출"* 이다 — 목록·상세에 매번 실리면 **그 근거 자체가 무너진다.**
`19_59_16` 라운드에서 `notification_secret_v2` 의 "1회 노출" 근거가 같은 방식으로 반증됐던
것과 **같은 형태**다.

**검증자가 못 잡은 이유도 지적대로다** — `TriggerDto.config` 가
`additionalProperties: true` 인 **열린 스키마**라, §5.4 응답-계약 대조도 정적 가드도
그 안을 보지 않는다. 열린 map 안의 비밀은 두 검증자 **모두의** 사각지대다.

조치: `INTERACTION_RESPONSE_STRIP_KEYS` 를 `NOTIFICATION_SIGNING_STRIP_KEYS` 와 동형으로
추가하고 `sanitizeForResponse` 가 `config.interaction` 도 정화한다. 발급 경로
(`revokePerTriggerToken`)의 1회성 평문 반환은 **영향 없다** — 그쪽은 값을 직접 반환하지
트리거 엔티티를 거치지 않는다.

**판별력 실측**: 스트립 검사를 지운 뮤턴트에 RED. 같은 블록의 비-비밀 필드
(`tokenStrategy`)가 살아남는 것도 함께 단언해, 통째로 지우는 구현으로 퇴행해도 잡힌다.

> **세 번 같은 형태로 좁았다** — chat-channel 만(→ notification.signing 누락),
> config JSONB 만(→ 엔티티 컬럼 누락), 그리고 이번(→ interaction 누락).
> `sanitizeForResponse` JSDoc 에 그 이력을 적고, **다음 축이 생기면 목록을 늘리지 말고
> 선언적 SoT 로 옮기라**고 남겼다.

## WARNING 조치

| # | 지적 | 조치 |
|---|---|---|
| 1 | `ScheduleDto.trigger` **필드** JSDoc 의 내부 리뷰 경로가 `introspectComments` 로 **공개 OpenAPI description** 이 된다 | **`//` 주석으로 이동.** 이유도 그 자리에 적었다 |
| 2 | 같은 라운드에 신설된 자매 `TriggerDto.workflow` 가 nav-spec 후속 트래커에서 빠졌다 | **항목 확장** — 두 DTO 의 `trigger`/`workflow` 를 한 묶음으로 |

W1 은 등급 차이가 중요하다 — **클래스** JSDoc 은 스키마로 승격되지 않지만(선행 라운드
실측) **필드** JSDoc 은 승격된다. 종전 라운드들이 "실질 유출 없음" 으로 처분한 것은
클래스 쪽이었고, 이번 것은 필드 쪽이라 실제로 나간다.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | 클래스 JSDoc 경위 서사 3번째 | **조치 불요** — 승격 안 됨(실측). 다음 편집 시 정리 |
| 2 | `secret-store.md §1` stale 서술 | **이미 등재** (planner) |
| 3 | `ScheduleDto` 키-생략 사유 nav-spec 미반영 | **이미 등재**, W2 로 확장 |
| 4 | `IntegrationDto.appUrl` 이 자매 plan 열거에서 누락 | **조치 불요** — 머지 후 planner 가 실제 diff 를 보고 반영한다 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`22:39:05`) |
| unit | **PASS** (`22:40:05`) |
| build | **PASS** (`22:41:26`) |
| e2e | **PASS** — **296** 통과 (`22:44:01`) |

## 보류·후속 항목

W2 로 확장한 nav-spec 항목이 planner 몫으로 남는다. 새로 만든 후속은 없다.
