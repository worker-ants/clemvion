# RESOLUTION — `review/code/2026/09/06/01_13_50`

**원 결과**: Critical 0 · WARNING 7 · 위험도 MEDIUM · forced 7명 전원 산출물 확보
**처분**: WARNING 6건 수정 · 1건은 이미 등재된 추적 항목(조치 불요)

## W1·W2 (documentation) — CHANGELOG 가 이 브랜치가 닫은 유출의 **절반만** 적고 있었다

이 문서는 개발 노트가 아니라 **보안 공지**다. 그런데 표에는 처음 찾은 두 필드만 있었고,
같은 세션의 후속 리뷰가 찾아낸 두 건이 빠져 있었다 (`grep triggerToken|signing` 매치 0건).

| 추가한 행 | 무엇인가 |
|---|---|
| `config.notification.signing.secret` · `.secretRef` | 평문 서명 secret + store ref (JSONB 안) |
| `config.interaction.triggerToken` | **영구 평문** bearer 토큰 (`itk_*`) |

`triggerToken` 에는 **별도 권고**를 달았다 — 앞의 셋과 달리 회전 유예가 없는 영구 값이라
*"유예 중에만 non-null"* 이라는 완화가 걸리지 않는다. 노출된 트리거는
`POST /api/triggers/:id/interaction/revoke-token` 으로 재발급해야 한다(엔드포인트 경로는
컨트롤러에서 확인).

W2 도 같은 비대칭이었다 — `ScheduleDto.trigger` 축소는 최상단에 상세히 적혔는데 **구조가
같은** `TriggerDto.workflow` 엔티티 전체 노출과, 같은 커밋이 함께 고친 `PATCH` 응답 필드
소실 버그(`useDefineForClassFields`)는 없었다. 대칭으로 채웠다.

## W3 (side_effect) — `findAll` blast-radius 는 **문서화**를 택했다

`toResponse` 가 던지므로 한 행만 어긋나도 목록 요청 전체가 500 이 된다. 종전에는 그 행만
필드가 빠지고 나머지는 200 이었다.

**행 격리(스킵/부분 실패)를 택하지 않았다** — 두 대안 모두 더 나쁘다:

- 키 생략 → `ScheduleDto.trigger` 는 §5.4 **기본형** 선언이라 **계약 위반**이다.
- 행 스킵 → 목록에서 행이 조용히 사라진다. 사용자는 스케줄이 없어진 것으로 읽는다.

`Schedule.trigger_id` 는 NOT NULL 1:1 + FK `onDelete: 'CASCADE'` 라 정상 데이터로는 도달할
수 없다. 도달했다면 **가려서는 안 되는 데이터 손상**이다. 이 판단을 CHANGELOG 에 blockquote
로 명시했다 — 리뷰어가 요구한 것이 정확히 "의도된 설계면 트레이드오프를 명시" 였다.

## W4 (requirement) — 문서한 보장이 구현보다 넓었다 (또)

`TriggerDto.workflow` JSDoc 이 *"생성 응답에만 없다"* 고 단정하는데, `chatChannel` 을 포함한
`PATCH` 는 `setupChatChannel` 뒤 **`relations` 없는 재조회**로 `result` 를 통째로 갈아치워
그 응답에서도 `workflow` 가 빠졌다. §5.4 키 생략형이라 계약 검증자도 못 잡는 자리다.

**주장을 좁히지 않고 구현을 맞췄다** — 재조회에 `relations: ['workflow']` 를 실었다.
리뷰어도 *"§5.4 일관성 관점에서 후자 권장"* 이라 적었다. 같은 응답 DTO 가 경로에 따라 다른
모양을 내는 것이 문제의 본질이지, 주석이 문제가 아니다.

## W5 (testing) — 두 래칫의 부분집합 관계가 주석으로만 있었다

`EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건, 전수)와 `OPTIONAL_NULLABLE_DRIFT`(`ExecutionDto`
10건)의 관계를 코드가 강제하지 않아, 한쪽만 갱신돼도 두 스펙이 각자는 그린이었다.

**두 목록을 서로 비교하지 않았다** — 그러면 둘 다 같이 틀린 경우를 못 잡는다. 대신
`ExecutionDto` 쪽 스펙을 **전수 래칫이 쓰는 바로 그 스캐너**에 물렸다:

```ts
const scanned = findOptionalNullableResponseFields(
  [path.join(__dirname, 'execution-response.dto.ts')], srcRoot);
expect(scanned.filter(o => o.key.includes(':ExecutionDto.')).map(o => o.field).sort())
  .toEqual([...OPTIONAL_NULLABLE_DRIFT].sort());
expect(scanned.length).toBeGreaterThan(0);   // 0건이면 위 단언이 조용히 통과한다
```

`:ExecutionDto.` 로 거른 것은 그 파일에 다른 클래스도 살기 때문이다 — **주어를 함께** 물어야
한다. 마지막 줄은 vacuous 방지용이다.

## W6 (testing) — 단언 헬퍼 자신에게 테스트가 없었다

`expectNarrowedScheduleTriggerRef` 는 여섯 자리의 **유일한 양성 수단**인데 자기 검증이
없었다 — 헬퍼가 무르게 바뀌면 여섯 자리가 **동시에** 조용히 통과한다.

`schedule-trigger-ref.spec.ts` 신설. 통과 경로만 보지 않고 **실패해야 하는 경로**를 각각
문다: 여분 키 · 비밀 키 혼입(2종) · 기대 키 누락 · 참조 자체 부재, 그리고 `withWorkflow` 를
**양방향으로** — 한 방향만 두면 옵션을 무시하는 구현이 절반의 호출부에서 통과한다.

## W7 (security) — 조치 불요

deny-list 4벌 구조. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
선언적 SoT 전환으로 등재돼 있고, **그 제안이 네 축 중 하나만 덮는다**는 반증도 항목에 함께
적혀 있다.

## INFO — 확인만

`format: 'uri'` 미선언 · `t` 변수명 · unit 의 중복 호출 · `AlertRuleDto.lastTriggeredAt` 의
"발화" 어휘 · import 두 줄 — 전부 사소하거나 이전 라운드에서 처분됐다.

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS (52s) |
| unit | PASS |
| build | PASS (141s) |
| e2e | PASS — 297 |

신규 스펙 2건(헬퍼 6 케이스 · 래칫 부분집합 1 케이스)은 각각 단독 실행으로 GREEN 확인.
