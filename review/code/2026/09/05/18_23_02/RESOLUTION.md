# RESOLUTION — `review/code/2026/09/05/18_23_02`

전체 위험도 **HIGH** · Critical **1** · WARNING **11** · INFO **8**. **Critical + 실질
WARNING 전건 조치 완료.**

## Critical — 내가 좁힌 바로 그 엔드포인트에 테스트가 0건이었다

| # | 지적 | 조치 |
|---|---|---|
| 1 | `GET /api/schedules/:id` 를 때리는 테스트가 unit·e2e 어디에도 없다. 이 PR 이 trigger narrowing 을 배선한 자리인데 200 반환조차 검증되지 않는다 | **테스트 신설** |

지적이 맞다. `grep` 으로 재확인했다. 넣은 것은 세 가지다:

1. `GET /api/schedules/:id` → 200 + `assertMatchesContract(..., ScheduleDto)`
2. **남아야 할 4필드를 양성으로 단언** — `expect(Object.keys(trigger).sort()).toEqual([...])`.
   계약 대조는 "선언에 없는 키" 를 잡지만, **무엇이 남아야 하는가**는 안 잡는다. 좁히기가
   과해져 `workflowId` 가 사라져도 계약 대조는 통과한다.
3. 목록 경로(`findAll`) — 배열 매핑은 별도 코드 경로다 (WARNING #2).

## WARNING 조치

| # | 지적 | 조치 |
|---|---|---|
| 1 | **보안** — `config.notification.signing.secretRef` 가 스트립 목록에 없다 | **고쳤다.** 아래 |
| 2 | `findAll`/`update` 경로에 계약 대조 미배선 | **반영** (Critical 조치에 포함) |
| 3 | unit fixture 에 비밀 필드가 없어 strip 을 되돌려도 전부 그린 | **고쳤다.** 아래 |
| 4 | `contractForDto` 메모이제이션에 테스트 없음 | **추가** — 같은 promise 반환·재사용 2건 |
| 5 | `TRIGGER_RESPONSE_STRIP_COLUMNS` 이중 순회 중 첫 루프가 죽은 코드 | **제거** |
| 6 | rename 뒤 stale 메서드명 주석 | **갱신** |
| 7 | `chatChannelHealth`·`notificationHealth`·`rerankMode` 가 닫힌 union 인데 enum 미선언 | **추가** |
| 8 | CHANGELOG "24필드" vs 표 합계 23 | **정정** (23) |
| 9 | 스케줄 `trigger` 축소가 breaking change | **문서화 유지** — FE 소비처 4곳 실측 일치. 보안상 되돌릴 사안 아님 |
| 10 | 신규 선언이 optional/nullable drift 를 소폭 확장 | **정정 + 래칫** — `--impl-done` Critical 1 과 같은 항목, 그쪽 RESOLUTION 참조 |
| 11 | KB `example` 값이 실제 기본값과 불일치 | **정정** (0 / 50) |

### W1 — 또 한 칸 좁았다

`sanitizeForResponse` 가 `config.chatChannel` 의 `botTokenRef`·`inboundSigningRef` 는 빼면서
`config.notification.signing.secretRef` 는 두고 있었다. **같은 등급·같은 이유**인데 목록이
chat-channel 쪽에만 있었다 — 이 PR 이 고친 결함("방어가 한 칸 좁았다")과 **같은 형태**가
한 칸 옆에 또 있었던 셈이다.

`secret`(정규화 전 평문이 스쳐 가는 자리, `normalizeNotificationSecretRef` 참조)과 함께
`NOTIFICATION_SIGNING_STRIP_KEYS` 로 뺐고, config 정화를 `chatChannel` 유무와 **무관하게**
적용한다(종전 조기 return 제거는 이미 했으나 config 쪽은 여전히 chatChannel 조건부였다).

파생 플래그(`hasBotToken` 같은)는 두지 않았다 — 프런트엔드 소비처가 0곳이라 새 필드를
만들 이유가 없다.

### W3 — e2e 만이 이 결함을 물던 상태였다

`triggers.service.spec.ts` fixture 에 `notificationSecretV2`/`chatChannelTokenV2` 가 아예
없어, **스트립 로직을 통째로 되돌려도 그 파일 75개 테스트가 전부 그린**이었다. 비밀을 채운
fixture 로 2건을 추가했다 — 하나는 secret 컬럼 + `signing` 키, 하나는 **`chatChannel` 이
없는 트리거**(조기 return 회귀 방지).

**뮤턴트로 확인했다**: `NOTIFICATION_SIGNING_STRIP_KEYS` 검사를 지우면 그 테스트가 RED.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | `consecutiveNetworkFailures` FE 참조 0곳 | **이미 등재** — 제거는 wire 변경이라 별도 항목 |
| 2 | 스트립 목록이 두 상수로 분산 | 조치 불요 — 이번에 세 번째 목록이 생겼으므로 다음 재발 시 SoT 통합 검토 |
| 3 | 조인 자식 과다노출 방지 패턴이 모듈마다 다름 | 조치 불요 — 세 번째 재발 시 convention 승격 |
| 4 | module-level 캐시 도입 | 조치 불요 — `tsconfig.build.json` exclude 유지 |
| 5 | 뮤턴트 RED 수치가 실제 방어망보다 넓게 서술됐을 수 있다 | **정정.** 낡을 수 있는 숫자를 빼고 **어느 스위트가 RED 이고 위반 목록이 무엇을 지목하는지**로 다시 적었다 |
| 6 | 주석의 "FE 참조 수" 가 시점 고정이라 stale 가능 | 조치 불요 — 그 숫자는 "왜 선언했는가" 의 근거이지 계약이 아니다 |
| 7 | import 병합 가능 | 조치 불요(사소) |
| 8 | `formatVersion` 은 추적 중인 기존 갭 | 조치 불요 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** |
| unit | **PASS** — 447 스위트 / 9,414 통과 |
| build | **PASS** |
| e2e | **PASS** — 51 스위트 / 295 통과 |

**e2e 면제 아님.**

## 보류·후속 항목

이 라운드가 새로 만든 후속은 없다. INFO#2·#3 은 "세 번째 재발 시" 라는 조건부 판단이고
등재하지 않는다 — 조건이 오면 그 변경이 스스로 이 판단을 데려온다.
