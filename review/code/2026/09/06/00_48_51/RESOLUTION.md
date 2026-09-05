# RESOLUTION — `review/code/2026/09/06/00_48_51` (+ consistency `00_48_52`)

**원 결과**: 코드 리뷰 Critical 0 · WARNING 4 · 위험도 **MEDIUM** ·
consistency **BLOCK: NO** · Critical 0 · WARNING 2
**처분**: 두 게이트의 WARNING 전부 코드 수정. 겹치는 항목 1건은 **네 리뷰어가 독립 재현**한
같은 결함이다.

## W1 (양 게이트 공통, security·side_effect·api_contract·cross_spec 4명) — 내가 만든 CWE-209

직전 라운드에서 `toResponse` 의 익명 `TypeError` 를 *"불변식을 이름으로"* 던지도록 고쳤는데,
**그 수정 자체가 정보 노출을 만들었다.**

```
GlobalExceptionFilter.catch
  ├ exception instanceof HttpException → message 를 응답 바디로 그대로 흘린다
  └ 매핑되지 않은 순수 Error       → UNHANDLED_ERROR_MESSAGE 로 마스킹 + logger.error
```

즉 **옛 `TypeError` 가 오히려 안전했다** — 마스킹 분기에 걸리고 로그도 남았다. 내가 던진
`InternalServerErrorException(문자열)` 은 `HttpException` 분기라 `schedule.id`·컬럼명
`trigger_id`·NOT NULL 제약·"join/relation 누락" 힌트가 **500 바디로 나갔고 로그에는 남지도
않았다.** 직전 라운드의 *"어차피 500 이라 가용성은 그대로"* 라는 내 판단은 **어느 분기를
타는지를 보지 않은 것**이었다.

**수정** — 진단은 로그로, 응답은 `3-error-handling.md` 의 `INTERNAL_ERROR` 고정 문구로.

```ts
this.logger.error(`Schedule ${schedule.id} has no loaded trigger — …`);
throw new InternalServerErrorException({
  code: 'INTERNAL_ERROR',
  message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
});
```

**새 에러 코드를 만들지 않았다** — 리뷰어가 제안한 `SCHEDULE_TRIGGER_MISSING` 은 공개 에러
카탈로그(`3-error-handling.md`) 등재가 필요하고 그것은 `spec/` 쓰기, 즉 planner 몫이다.
기존 `INTERNAL_ERROR` 로 규약을 만족하므로 권한 밖으로 넘기지 않고 이 브랜치에서 닫았다.

## W4 (testing) — 그 방어 분기에 테스트가 없었다

W1 과 같은 자리다. 리뷰어 지적대로 **던지는가**를 물고, 거기에 더해 **무엇을 말하지
않는가**까지 물었다.

```ts
expect(serialized).not.toContain('sch-leak-probe');
expect(serialized).not.toContain('trigger_id');
expect(serialized).not.toContain('join');
```

`message` 만 보면 다른 필드로 새는 변형을 놓치므로 `response` 직렬화 **전체**를 본다.

**뮤테이션 실측**

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| 첫 판으로 되돌리기 (진단 문자열을 예외 인자로) | RED | **RED** |
| 가드 삭제 (던지지 않고 키 생략) | RED | **RED** |

## W3 (maintainability) — 같은 키 단언이 여섯 자리에 복제

리뷰어는 다섯 곳을 셌는데 **실제로는 여섯이었다** — C-3 의 생성-부재 단언(키 3개 형태)이
같은 클래스인데 목록에서 빠져 있었다. 전수로 세어 여섯 자리 전부 교체했다.

`src/shared/testing/schedule-trigger-ref.ts` 의
`expectNarrowedScheduleTriggerRef(trigger, { withWorkflow })` 로 접었다. 이 디렉터리는
`tsconfig.build.json` 이 dist 에서 제외하므로 jest 전역을 써도 프로덕션 번들을 오염시키지
않는다 (같은 이유로 `response-contract.ts` 가 이미 여기 있다).

| 자리 | withWorkflow |
|---|---|
| e2e `GET /:id` · `GET /` 목록 · `PATCH` | `true` |
| e2e C-3 생성 응답 | `false` |
| unit `create` · `update` (mock 에 관계 없음) | `false` |

**헬퍼가 무르지 않았음을 확인** — `toResponse` 의 좁히기를 `{ ...t }` 로 되돌리는 뮤턴트에
컨트롤러 unit **2건 RED**.

## W2 (documentation) — 내 CHANGELOG 편집이 문단 귀속을 깨뜨렸다

직전 라운드에 넣은 blockquote 가 뒤 문단을 삼켜, **17개 축의 특징**(*"키가 없어도 null 이어도
맞는 조합"*)이 **6개 축 설명에 붙어** 읽혔고 인용 접두 `>` 도 중간에 끊겼다.

**수정** — `두 검증자 어느 쪽도 잡지 못했다` 문단을 17개 축 설명 **바로 뒤**로 되돌리고,
6개 축 blockquote 를 그 다음 독립 블록으로 뒀다.

## consistency W2 (naming_collision) — 이름은 접두어 하나 차이, shape 는 다름

`TriggerWorkflowRefDto`(`id`+`name`) vs `ScheduleTriggerWorkflowRefDto`(`name`).

**개명하지 않고 상호 참조 JSDoc 을 택했다** — 필드가 다른 것은 결함이 아니라 **의도**이고
(각 응답의 소비처가 읽는 것만 담는다: 트리거 화면은 `t.workflow?.id` 로 링크를 걸지만
스케줄 화면은 이름만 표시한다), 개명은 공개 OpenAPI 스키마 이름을 바꾸는 일이다. 두 클래스
JSDoc 에 **서로를 가리키고 왜 다른지·갈아 끼우지 말 것**을 적었다 — checker 가 "최소한" 으로
제시한 선택지다.

## INFO — 조치 불요 (확인만)

`consecutiveNetworkFailures` 노출 · deny-list 4벌 · 전역 캐시 · 참조 동일성 · `secret-store.md
§1` stale 화 · ratchet fixture `code:` 미등재 · `spec_impact` 범위 — 전부 이전 라운드에서
처분됐거나 plan 트래커가 이미 추적 중이며, 뒤 넷은 **`spec/` 쓰기라 developer 권한 밖**이다.

`workflow-crud.e2e-spec.ts` 의 import 두 줄 분리는 이번에도 남긴다 — 이 브랜치가 만든 것이
아니고 스타일 수준이다.

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS (53s) — 첫 실행에서 `unicorn/catch-error-name` 1건, `err` 로 고쳐 재실행 |
| unit | PASS |
| build | PASS (143s) |
| e2e | PASS — 297 |
