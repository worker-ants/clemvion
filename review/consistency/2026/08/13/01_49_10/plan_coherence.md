# Plan 정합성 검토 — spec/data-flow/ (impl-done, diff-base origin/main)

## 검토 범위 요약

이번 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` /
`.spec.ts` 두 파일뿐이며, 캐시 엔트리·payload 손상 방어(`isIdempotencyEntry`·`isHttpStatusCode`·
`discardCorruptEntry`)와 `readKey`/`hashBody` 경계값 테스트를 추가한다. `spec/data-flow/` 문서
자체는 이번 diff 로 변경되지 않았다.

`plan/in-progress/backend-lint-gate-broken-on-main.md` 를 대조한 결과, 이 diff 가 구현하는
내용(캐시 엔트리 손상 방어 · readKey/hashBody 경계값 · §R8 캐시 대상 조건)은 전부 그 plan 의
`[x]` 완료 항목과 1:1 로 대응한다 — 새로 결론을 내리거나 plan 의 결정과 충돌하는 지점은 찾지
못했다. 다만 **target 문서(spec/data-flow/15-external-interaction.md) 자체가, 같은 plan 이 이미
"착수 가능" 으로 판정해 둔 두 군데의 알려진 부정확을 아직 반영하지 못한 채 남아 있다** — 아래
발견사항 참고.

## 발견사항

- **[WARNING]** `spec/data-flow/15-external-interaction.md` 의 "전 경로 fail-open (warn)" /
  "Redis 미가용 시" 프레이밍이 이번 diff 로 더 정밀해진 코드 사실과 어긋난 채 남아 있다
  - target 위치:
    - `spec/data-flow/15-external-interaction.md:308` (§4 외부 의존 표) — "Redis | 내부 |
      blacklist · idempotency · seq · BullMQ. **전 경로** fail-open (warn) — 가용성 우선"
    - `spec/data-flow/15-external-interaction.md:333` (§Rationale "Fail-open 정책의 일관 표기")
      — "토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 **Redis/DB 미가용 시**
      fail-open"
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 미체크 항목
    **"`data-flow/15` 의 '전 경로 fail-open (warn)' 이 실제보다 한 칸 넓다"**(`23_48_39`
    rationale_continuity INFO 1 로 등재, `00_20_21` 에서 두 축으로 구체화, `01_10_53`
    plan_coherence 가 "✅ 착수 가능 — 선행 조건이 충족됐다" 로 판정) — 여전히 `[ ]` 미완료.
  - 상세: 이번 diff 가 신설한 `idempotency.interceptor.ts` 클래스 docstring(§`intercept()` 위)은
    이제 5개 fail-open 경로를 표로 명시하며 **"경로 1(기동 시 미주입)을 뺀 넷이 warn 을
    남긴다"** 고 정확히 적는다. 그런데 바로 다음 문장이 여전히 target 문서의 "전 경로
    fail-open (warn)" 문구를 "그 요구다" 로 인용한다 — 코드 자신의 표와 인용문이 서로 모순된
    상태로 diff 에 들어갔다. target 문서 §4 표와 §Rationale 은 그 모순의 근원이다: (1) §4 표는
    "전 경로 …(warn)" 이라 적어 기동 시 미주입(warn 없음)까지 warn 대상으로 뭉뚱그리고, (2)
    §Rationale 은 fail-open 트리거를 "Redis/DB **미가용**" 하나로만 프레이밍하는데, 이번 diff 가
    추가한 캐시 엔트리·payload **손상**(`discardCorruptEntry`, 경로 4·5)은 Redis 가 **가용한데
    데이터만 오염된** 별개 실패 축이라 이 프레이밍 밖에 있다. 두 gap 모두 plan 이 이미 실측·
    특정해 "착수 가능" 으로 표시했지만, developer 는 `spec/` 쓰기 권한이 없어(CLAUDE.md §Skill
    체계) planner 턴을 기다리는 상태이고 아직 실행되지 않았다.
  - 제안: planner 턴으로 (a) §4 표를 "전 경로" → "경로 1(기동 시 미주입) 제외 나머지 warn"
    (또는 표 형태로 세분화)로 좁히고, (b) §Rationale 문장을 "Redis/DB 미가용 **또는 캐시
    엔트리·payload 손상** 시 fail-open" 으로 확장한다. `plan/in-progress/
    backend-lint-gate-broken-on-main.md` 해당 항목을 함께 체크.

## 요약

이번 PR 의 코드 diff(idempotency 캐시 엔트리/payload 손상 방어 + `readKey`/`hashBody` 경계값
테스트)는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 가 사전에 상세히 설계·추적한
항목들과 정확히 일치하며, plan 이 "결정 필요" 로 남긴 항목을 우회하거나 다른 plan 의 후속 항목을
무효화하는 지점은 없다. 유일한 이슈는 target 문서(spec/data-flow/15-external-interaction.md)
자체가 이 diff 로 더 뚜렷해진 코드 사실(5-path fail-open 표, warn 미적용 경로 1, 손상은
"미가용" 과 다른 축)을 아직 반영하지 못했다는 점이며, 이는 같은 plan 이 이미 "착수 가능" 으로
표시해 둔 planner 턴 대기 항목이다 — 새로 발견된 결함이 아니라 기존 추적이 계속 유효함을
재확인한 것이다.

## 위험도
LOW
