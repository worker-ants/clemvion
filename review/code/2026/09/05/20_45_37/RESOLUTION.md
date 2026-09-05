# RESOLUTION — `review/code/2026/09/05/20_45_37`

전체 위험도 **MEDIUM** · Critical **0** · WARNING **8** · INFO **13**.
**실질 WARNING 전건 조치 완료.**

## W2 — `create()` 를 고치면서 자매 `update()` 를 두었다

| # | 지적 | 조치 |
|---|---|---|
| 2 | `update()` 의 `saved.trigger = trigger ?? schedule.trigger` 가 여전히 `if (schedule.isActive)` 안에 있어, PATCH 로 비활성화하면 응답에서 `trigger` 키가 사라진다 | **고쳤다** — 대입을 조건 밖으로, `create()` 와 같은 형태로 |

**이 세션에서 같은 패턴이 반복됐다.** 직전 라운드에서 `create()` 의 동일 결함을 고치면서
바로 아래 `update()` 를 보지 않았다. `user` 를 좁히고 `workspace` 를 둔 것, chat-channel
strip 목록을 고치고 `notification.signing` 을 둔 것과 같은 형태다 — **지적받은 자리만 고치고
형제를 두는 것.**

`trigger` 가 `@ApiPropertyOptional` 이라 §5.4 계약 대조로는 안 잡힌다는 지적도 맞다.
그래서 아래 W1 테스트를 **양성 단언**(키가 있어야 한다)으로 썼다.

## WARNING 조치

| # | 지적 | 조치 |
|---|---|---|
| 1 | `create({isActive:false})` 회귀를 잠그는 테스트가 없다 | **e2e `C-3` 신설** |
| 3 | `toResponse()` unit 테스트 전무 | **e2e 로 대체.** 아래 참조 |
| 4 | 메모이제이션 **실패 축출** 분기가 미검증 — 그 줄을 지워도 GREEN | **테스트 추가.** 뮤턴트로 RED 확인 |
| 5 | `allowMissing` 의 **중첩 경로** 기능 미검증 | **테스트 추가** — 얕은 이름으로는 면제되지 않음을 함께 단언 |
| 6 | CHANGELOG 가 `appUrl` 을 "키 생략형 예외" 로 적는데 실제 선언은 기본형 | **정정.** 첫 판이 키 생략형이었고 **e2e 가 그것을 반증**했다는 이력까지 적었다 |
| 7 | `contractForDto` JSDoc 이 새 상수에 밀려 함수에서 분리 | **이동.** 상수에는 한 줄 주석을 따로 달았다 |
| 8 | 스케줄 `trigger` 축소가 breaking change | **조치 완료로 간주** — 이전 라운드에서 처분·문서화 |

### W1·W3 — 별도 `it()` 로 분리해야 했다

처음엔 새 케이스를 기존 테스트 C 안에 넣었는데, **PATCH 비활성화가 그 뒤의
`is_active = true` DB 단언을 깨뜨렸다**(e2e 가 잡았다). 남의 테스트 상태를 바꾸면 안 되므로
`C-3` 으로 분리하고, 자기 스케줄을 새로 만들어 쓰도록 고쳤다.

W3(unit)는 넣지 않았다 — `toResponse` 는 private 이고, 그것을 unit 으로 감싸려면 컨트롤러
mock 을 새로 세워야 한다. **같은 분기를 e2e 가 실물로 덮는다**: 생성(비활성)·조회·목록·
PATCH 네 경로에서 `trigger` 키와 남는 필드를 양성으로 단언한다.

> 다만 **`toResponse` 의 두 조건 분기 중 `t` 부재 경로는 여전히 미도달**이다(INFO#10).
> 스케줄에 트리거가 없는 상태를 e2e 로 만들 방법이 없다 — 생성이 항상 트리거를 만든다.
> 그 분기는 방어적 코드이고, 도달 경로가 생기면 그때 고정한다.

### W1 테스트가 내 선언을 한 번 반증했다

`POST` 응답의 `trigger` 에 `workflow` 까지 4키를 기대했는데 **3키**였다 — 생성 경로가 방금
저장한 엔티티를 붙이므로 관계가 로드되지 않는다. `ScheduleTriggerRefDto.workflow` 를
`@ApiPropertyOptional` 로 선언한 것이 옳았고, 내 단언이 과했다. 두 경로(생성 3키 · 조회
4키)를 각각 고정하도록 고쳤다.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | strip 목록이 3벌로 늘었다(같은 결함 2회 재발) | **JSDoc 에 그 사실을 적었다.** 네 번째면 `@Sensitive()` 류로 SoT 를 엔티티로 |
| 2 | 두 drift 래칫이 주석으로만 동기화 | 다음 상환 시 파생 단언으로 |
| 3·5 | strip 루프 중복 · DTO 배경 주석 반복 | 조치 불요(이월) |
| 4 | 지역 변수 `t` | 조치 불요(이월) |
| 6 | 클래스명 폴백 `'?'` 매직 리터럴 | 조치 불요(사소) |
| 7 | `*LastError` 가 향후 payload 를 담게 되면 노출 경로 | 조치 불요 — adapter 변경 시 불변식 고정 권고만 |
| 8·9 | `consecutiveNetworkFailures` · `formatVersion` | **이미 등재** |
| 10·11 | `toResponse` 미도달 분기 · `appUrl` 비-null 분기 | 위 W3 답변 참조 / 시급성 낮음 |
| 12 | PR 이 "secret 유출 수정" 보다 넓다 | **PR 제목·본문에 상위 과제명 명시** |
| 13 | 신규 module-level 캐시 | 조치 불요 — 이전 라운드에서 평가·수용 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`21:14:03`) |
| unit | **PASS** — 447 스위트 / **9,418** 통과 (`21:21:37`) |
| build | **PASS** (`21:23:02`) |
| e2e | **PASS** — 51 스위트 / **296** 통과 (`21:17:08`) |

> **인프라 실패 1회** — postgres healthcheck 실패로 e2e 가 한 번 죽었다. 회귀가 아니라
> **디스크 압박**이었다(빌드 캐시 32GB). `make e2e-down` + `builder prune`/`image prune`
> 로 42GB 회수 후 정상 통과. 볼륨 prune 은 하지 않았다.

## 보류·후속 항목

이 라운드가 새로 만든 후속은 없다. INFO#1 은 "네 번째 재발 시" 조건부라 등재하지 않는다 —
조건이 오면 그 변경이 스스로 이 판단을 데려온다.
