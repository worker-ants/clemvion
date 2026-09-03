# RESOLUTION — entity nullable 배치 3 리뷰 1R

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **1** · INFO 7
reviewer 9명 실행(라우터가 performance·architecture·dependency·concurrency·user_guide_sync 제외),
forced 7명 전원 결과 확보.

## W1 — `AuthConfigDto.ipWhitelist` (조치함, 판단을 바꿨다)

**나는 이걸 스코프 아웃했었다. 리뷰어가 내가 안 본 사실을 댔다** — `AuthConfigsController` 가
엔티티를 **별도 DTO 매핑 없이 그대로 반환**하므로 `GET /auth-configs` 응답의
`ipWhitelist` 에 **실제로 `null` 이 실려 나간다.** 문서 흠결이 아니라 살아있는 클라이언트
위험이다.

그런데 리뷰어 제안을 그대로 베끼지 않고 규약을 확인했다 — `?`(키 생략)와 `null`(present)은
[API 규약 §5.4](../../../../../spec/5-system/2-api-convention.md) 가 구분하는 축이라 잘못
베끼면 반대로 간다. 확인 결과 **§5.4 가 리뷰어 제안 형태를 그대로 지정**한다:

> `null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`

더 결정적인 것은 같은 절의 적용 범위다 — *"본 규칙은 앞으로 도입·**변경되는** 필드에
적용한다"*. 이 diff 가 이 필드의 nullability 를 **바꿨으므로** 규약 적용 대상이다.

```
- @ApiProperty({ type: [String], example: [] })
- ipWhitelist: string[];
+ @ApiPropertyOptional({ type: [String], nullable: true, example: [] })
+ ipWhitelist?: string[] | null;
```

같은 DTO 의 `lastUsedAt?: string | null` 과 동일한 형태다. **동작 변경 없음** — 스키마가
실제와 어긋나 있던 것을 바로잡는다.

**나머지 48건은 여전히 별개 축이다.** 이 diff 가 그 엔티티들을 건드리지 않으므로 §5.4 의
적용 조건("변경되는 필드")에 해당하지 않는다. 자의적인 "한 자리만 고치기" 가 아니라 규약이
그은 선이다.

## INFO 조치

| # | 항목 | 처리 |
|---|---|---|
| 1 | plan 체크박스 "tsc 비-spec 0 확인" 미체크 | `[x]` + **매 배치 반복 규칙**임을 명시 |
| 2 | CHANGELOG 미갱신 | **항목 추가** (아래 근거) |
| 3 | plan 문장 접합부 | 후보 검토 문단을 인용 블록으로 분리 |
| 4 | plan 이 컨트롤러 캐스트 제거를 누락 | 제거한 캐스트 **두 곳**을 표로 명시 |
| 5 | 가드의 구조적 한계 (증상 기반) | 후속 축으로 기록, 이번 범위 밖 |
| 6 | `folders.controller.spec.ts` 위임 단언 부재 | 선재 갭, 낮은 우선순위 |
| 7 | `/api/auth/*` 명명 gap | 이미 planner 턴 후속으로 추적 중 |

**INFO#2 는 실측으로 판단했다.** 최근 30개 머지 중 CHANGELOG 를 건드린 것은 **7건**이고
전부 관측 가능한 동작·wire 변경(`feat`/`fix`)이다. 배치 1·2 는 순수 내부 타입이라 생략이
옳았다. 그러나 **배치 3 은 W1 로 OpenAPI 계약을 바꾼다** — 스키마로 타입을 생성하는
클라이언트에게 보이므로 항목을 달았다.

## 리뷰가 시킨 게 아닌데 이번에 찾은 것 — 내 훑기 방법이 좁았다

INFO#3 을 처리하며 후보 목록을 "폐기·흡수됨" 으로 접으려다 **실측했더니 (e) 가 아직 살아
있었다** (`auth.service.spec.ts:58` `lockedUntil: null as unknown as Date`).

원인은 항목이 아니라 **방법**이다. 배치 말 캐스트 훑기를 *그 배치가 넓힌 필드*로만 돌렸는데,
**낡은 캐스트는 어느 배치가 넓혔든 남는다** — 저건 배치 1 이 넓힌 필드다.

대상을 **"지금 넓혀져 있는 필드 전체"**(엔티티 AST 에서 `| null` 필드명 **122종**)로 바꿔
다시 돌리니 저장소 전체 잔존이 **2건**이었고 둘 다 제거했다. 각각 대조군으로 유효성 확인 —
엔티티를 되돌리면 오류 **2건**(`folders.service.spec.ts`) · **7건**(`auth.service.spec.ts`).

plan 의 가드-사각지대 항목에 이 방법 정정을 기록했다.

## 검증 (조치 후 재실행)

lint **PASS** · unit backend **9,250**(443 suites) · build **PASS** · e2e **292**(부팅 확인) ·
ratchet **197/36** · `tsc` 비-spec 오류 **0** · 가드 **12/12**.
