# RESOLUTION — `review/code/2026/09/06/00_00_23`

**원 리뷰 결과**: Critical 0 · WARNING 3 · 위험도 LOW · forced 7명 전원 산출물 확보
(`forced_missing=[]`, `unfinished=[]`, reviewer 10/10 `has_report=true`)
**처분**: WARNING 3건 전부 코드 수정 + 사각지대 1건 추가 폐쇄

## W1 (requirement) — `IntegrationDto.appUrl` 서술이 MakeShop 을 빠뜨렸다

공개 JSDoc 이 *"cafe24 Private 앱의 관리자 URL — 그 외에는 `null`"* 이었는데, **MakeShop
ShopStore 설치 통합도 이 필드를 채운다.** spec 은 이미 옳게 적고 있었고 코드 설명만 낡았다.

**실측으로 확인** — `INTEGRATION_DERIVED_REGISTRY` 의 `makeshop` 분기가
`buildMakeshopInstallUrl(ctx.appBaseUrl, entity.installToken)` 을 반환한다
(`integrations.service.ts`). spec `4-integration.md §9.1` 도 두 갈래를 명시한다.

**수정** — JSDoc 을 두 갈래 + `null` 조건으로 정정하고, 위쪽 배경 주석의 *"cafe24 Private
이 아니면"* 도 *"채우는 통합이 아니면"* 으로 넓혔다. 이 필드는 Swagger 로 공개되므로
makeshop 연동 개발자가 오판할 수 있는 자리였다.

## W2 (maintainability) — `sanitizeForResponse` 5책임 78줄

직전 라운드에서 `omitKeys` 를 뽑았지만 **메서드 자체는 여전히 다섯 책임**(JSONB 3축 +
엔티티 컬럼 + workflow 좁히기)을 한 몸에 갖고 있었다.

**수정** — 축마다 이름 있는 **모듈 레벨 순수 함수**로 분해하고 메서드는 얇은 오케스트레이터로
남겼다. 클래스 상태를 안 쓰므로 직접 단위 테스트가 가능하다.

| 축 | 함수 |
|---|---|
| `config.chatChannel` (+ `hasBotToken` 파생) | `stripChatChannelSecrets` |
| `config.interaction` | `stripInteractionSecrets` |
| `config.notification.signing` | `stripNotificationSigningSecrets` |
| 엔티티 컬럼 (제자리 삭제) | `deleteSecretColumns` |
| 조인된 `workflow` | `narrowWorkflowRef` |

메서드 JSDoc 의 축 목록도 **축 ↔ 상수 ↔ 함수** 3열 표로 바꿔, 다음 축을 추가할 때 어디를
건드려야 하는지가 한눈에 보이게 했다.

### 리팩터가 가드를 죽이지 않았음을 뮤테이션으로 확인 — 그 과정에서 사각지대 1건 발견

다섯 함수를 각각 **항등**으로 바꿔 돌렸다. 1차 실행에서 **`chatChannel` 축만 살아남았다**:

| 뮤턴트 | 1차 (분해 직후) | 조치 후 |
|---|---|---|
| `stripChatChannelSecrets` → 항등 | **GREEN (생존)** | RED |
| `stripInteractionSecrets` → 항등 | RED | RED |
| `stripNotificationSigningSecrets` → 항등 | RED | RED |
| `deleteSecretColumns` → no-op | RED ×3 | RED ×3 |
| `narrowWorkflowRef` → 원본 반환 | RED | RED |

생존 원인은 **unit fixture 에 `config.chatChannel` 블록이 아예 없었던 것** — 이 브랜치가
이미 두 번 고친 *"fixture 에 비밀이 없어 스트립을 되돌려도 그린"* 과 **정확히 같은 형태**가
네 번째 축에 남아 있었다. e2e 만이 이 축을 물고 있었다.

fixture 에 `botToken`·`botTokenRef`·`inboundSigningRef` 를 채우고, 부재 3건 + 비-비밀
보존(`provider`) + 파생 플래그(`hasBotToken === true`)를 단언해 닫았다. 이제 **다섯 뮤턴트가
전부 unit 에서 죽는다** — 리팩터 검증이 그 자체로 커버리지 갭을 하나 메웠다.

## W3 (maintainability) — JSDoc 이 자기 대상에서 분리 (5번째 재발)

`triggers.service.spec.ts` 의 *"응답 정화 회귀 — e2e 만이 이 결함을 물던 상태였다"* 블록이
설명 대상(`응답에서 회전 secret 컬럼과 notification.signing 비밀이 제거된다`)이 아니라
그 앞의 `PATCH 에서 생략된 필드는...` 테스트 위에 붙어 있었다.

**수정** — 블록을 자기 테스트 바로 위로 옮겼다. 같은 패턴의 5번째 재발이므로, 직전 라운드에서
세운 **배치 규칙**(신규 항목은 블록 끝에 붙이고 JSDoc 은 대상에 붙인다)을 이 파일에도 적용한 것.

## INFO — 조치 불요 (근거 확인만)

| # | 항목 | 판단 |
|---|---|---|
| 1 | deny-list 4벌 fail-open | 이번 라운드에 tracker 등재 완료. 제안된 `@Sensitive()` 는 네 축 중 하나만 덮는다는 반증을 항목에 함께 적었다 |
| 2 | 좁히기 책임이 트리거=서비스 / 스케줄=컨트롤러로 갈림 | 각자 근거 문서화됨, 유예 유지 |
| 3 | 래칫이 두 파일에 부분집합 중복 | 상호 참조 주석으로 완화 완료 |
| 5 | e2e import 두 줄 분리 | 사소, 블로킹 아님 |
| 8 | `consecutiveNetworkFailures` 노출 | 이미 등재 |
| 12 | 스케줄 `trigger` 축소 breaking | 소비처 전수 실측 결과를 직전 라운드에서 CHANGELOG 에 기록 |
| 14~16 | 컨트롤러 unit 대칭·`cfg` null 방어 | 급하지 않음, 다음에 손댈 때 |

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS (52s) |
| unit | PASS — backend 447 suites / 9,422 passed (1 skipped) |
| build | PASS (143s) |
| e2e | PASS — 297 |

뮤테이션: 위 표대로 **5/5 RED** (1차 1건 생존 → fixture 보강 후 재실행).
