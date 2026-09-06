# RESOLUTION — `review/code/2026/09/05/21_40_37`

전체 위험도 **MEDIUM** · Critical **0** · WARNING **7** · INFO **13+**.
**실질 WARNING 4건 조치, 3건은 사유와 함께 유예.**

## W1 이 결정적이었다 — 그 지적을 따랐더니 **실제 drift 2건**이 나왔다

지적: *"`TriggerDto` 계약 대조가 생성(POST) 한 곳뿐 — CHANGELOG 가 지목한 유출 경로의
목록·PATCH 에는 배선되지 않았다. 이 PR 목적이 자기 보안수정의 절반에 미적용."*

맞다. 배선하니 **두 가지가 즉시 터졌다**:

| 위반 | 경로 | 원인 |
|---|---|---|
| `workflow` **[undeclared]** | 목록 · PATCH | `leftJoinAndSelect('t.workflow','w')` / `relations:['workflow']` 가 **Workflow 엔티티 전체**를 싣는데 `TriggerDto` 는 선언조차 없었다 |
| `name` **[missing]** | PATCH | `Object.assign(trigger, rest, …)` 가 **로드된 값을 `undefined` 로 덮어썼다** |

### `name` 이 사라진 진짜 원인

`target: ES2023` 이고 `useDefineForClassFields` 를 끄지 않아, DTO 의 optional 필드가 **값 없이도
`undefined` 인 own property** 로 생성된다. `{...rest}` 가 그것을 옮기고 `Object.assign` 이
로드된 `trigger.name` 을 지운다.

DB 는 무사하다 — TypeORM 이 `undefined` 를 UPDATE 에서 건너뛴다. **응답에서만 필드가
사라진다.** 그래서 지금까지 아무도 못 봤다. 값이 없는 필드를 걸러 내도록 고쳤다.

> **뮤턴트가 따로 필요 없다** — 수정 **전** 상태가 곧 뮤턴트이고, 그 상태의 e2e 가
> `name [missing]` 으로 RED 였다. 수정 후 296 통과.

`workflow` 는 `ScheduleDto.trigger` 와 같은 처방으로 좁혔다 — `TriggerWorkflowRefDto`
(`id`·`name`, FE 소비 전부)를 선언하고 응답 경계에서 그 형태로 만든다.

## 나머지 WARNING

| # | 지적 | 조치 |
|---|---|---|
| 2 | JSDoc 이 캐시를 *"Jest **worker** 단위로 격리"* 라 주장 — 실측은 **파일** 단위 | **정정.** 내가 또 근거를 틀리게 썼다 |
| 3 | `toResponse` 가 private 이라 unit 불가 — 검증이 e2e 뿐 | **unit 을 만들었다.** 아래 |
| 4 | strip deny-list 3벌 (OCP) | **유예** — 팀이 이미 "4번째 재발 시 `@Sensitive()`" 로 문서화. JSDoc 에 재발 이력을 적어 뒀다 |
| 5 | `C-3` 안에 같은 주석 블록이 두 번 (편집 잔여물) | **제거** |
| 6 | 가드 스펙의 JSDoc 2개가 대상 `describe` 에서 100줄 이상 분리 — 이 PR 에서 **세 번째** 재발 | **재배치** |
| 7 | 스케줄 `trigger` 축소가 breaking change | **조치 완료로 간주** (3라운드 처분) |

### W3 — 분기를 지우니 unit 이 스스로 드러났다

`toResponse` 에서 `trigger` 방어 분기를 없애자(§5.4 상시 존재로 선언했으므로) 기존
컨트롤러 unit 2건이 깨졌다 — mock 이 `{ id: 'sch-1' }` 이라 `trigger` 가 아예 없었기
때문이다. **그 mock 이 비현실적이었다**(실제 서비스는 네 경로 모두 채운다).

mock 을 현실적으로 바꾸고 **비밀 컬럼을 일부러 채운 뒤**, 응답의 `trigger` 가 참조 필드로
좁혀지고 `notificationSecretV2`·`chatChannelTokenV2` 가 없음을 단언했다. 리뷰어가 요구한
unit 커버리지가 이렇게 생겼다 — 추출 리팩터(제안된 `schedule-response.mapper.ts`) 없이.

> 추출은 **하지 않는다**: 이 라운드에 이미 동작 수정 2건이 들어갔고, 순수 함수 추출은
> 검증 수단을 바꾸지 않으면서 diff 만 넓힌다. 그 판단을 남긴다.

## INFO 처분

전부 **이미 등재 / 이월 / 확인 기록**이다. 새로 조치한 것 없음. 특히:

- INFO#4(allow-list vs deny-list 비대칭)는 **관찰이 옳다** — 다음 `sanitizeForResponse`
  재설계 때 allow-list 전환을 우선 검토하도록 W4 유예 사유에 함께 적었다.
- INFO#12·#13(`saved.trigger` 뮤테이션이 DB 미반영)은 side_effect 가 안전을 확인했다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`22:14:16`) |
| unit | **PASS** (`22:15:16`) |
| build | **PASS** (`22:16:56`) |
| e2e | **PASS** — **296** 통과 (`22:19:57`) |

## 보류·후속 항목

W3(추출)·W4(선언적 SoT)는 사유와 함께 유예했고 조건부라 등재하지 않는다 — 조건이 오면 그
변경이 스스로 판단을 데려온다.
