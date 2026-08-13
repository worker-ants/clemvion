# Plan 정합성 검토 — spec/data-flow/ (impl-done, diff-base origin/main)

## 검토 범위 요약

`origin/main...HEAD` diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
/ `.spec.ts` 두 파일뿐이다 — `readKey`/`hashBody` 경계값 테스트(길이 상한 양쪽 · 공백뿐인 키 ·
trim 동등성 · 배열/조인-문자열 헤더 · body nullish 동등성 · 키 순서 의존)와 캐시 엔트리
`statusCode` **값 범위** 검증(`isHttpStatusCode`, `MIN/MAX_HTTP_STATUS_CODE`)을 추가한다.
`spec/data-flow/` 문서 자체는 이번 diff 로 전혀 변경되지 않았다.

`plan/in-progress/backend-lint-gate-broken-on-main.md` 를 대조한 결과, 이 diff 가 구현하는
내용(`readKey`/`hashBody` 경계값 · `isHttpStatusCode` 범위 검사)은 그 plan 의 체크리스트 항목
**"`readKey`/`hashBody` 경계값 테스트 부재"**(`12_55_52` testing INFO 10)와 커밋 단위로 정확히
1:1 대응하며, 그 항목은 이미 "완료 (2026-08-13, `eia-idem-key-boundary`)" 로 plan 에 기록돼
있다(`git log`: `70a16c5c8`·`d876b5b8a`). 새로 결론을 내리거나 plan 이 "결정 필요" 로 남긴
항목과 충돌하는 지점은 찾지 못했다.

이 세션 직전 라운드(`review/consistency/2026/08/13/01_49_10/plan_coherence.md`,
`01_10_53/plan_coherence.md`)가 이미 같은 diff 계열(캐시 엔트리 손상 방어 + 경계값 테스트)을
검토해 WARNING 1건을 남겼고, 그 WARNING 은 `backend-lint-gate-broken-on-main.md` 에 "선행
조건이 충족됐다" 로 반영됐다(commit `bf56cd21c`). 이후 커밋(`c724ed841` docstring 문단 재배치,
`9ff7c4ef2`/`325b91e45` 리뷰 수렴, `72db62a7b` 등 spec 커밋)을 대조했으나 **target 문서 자체의
그 부분은 여전히 수정되지 않은 채**라 동일 WARNING 이 이번 라운드에도 유효하다 — 아래 발견사항
참고.

## 발견사항

- **[WARNING]** `spec/data-flow/15-external-interaction.md` 의 "전 경로 fail-open (warn)" /
  "Redis 미가용 시" 단일 축 프레이밍이, 이번 diff 계열(`isHttpStatusCode` 범위 검사 +
  캐시 엔트리 손상 가드)로 코드가 더 정밀해진 뒤에도 여전히 그대로 남아 있다
  - target 위치:
    - `spec/data-flow/15-external-interaction.md:308` (§4 외부 의존 표) — "Redis | 내부 |
      blacklist · idempotency · seq · BullMQ. **전 경로** fail-open (warn) — 가용성 우선"
    - `spec/data-flow/15-external-interaction.md:374-387` (§Rationale "Fail-open 정책의 일관 표기")
      — "토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 **Redis/DB 미가용 시**
      fail-open"
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 미체크 항목
    **"`data-flow/15` 의 '전 경로 fail-open (warn)' 이 실제보다 한 칸 넓다"**(`23_48_39`
    rationale_continuity INFO 1 로 최초 등재, `00_20_21` 에서 두 축 — (1) 기동 시 미주입은
    warn 없음, (2) "미가용" 을 "미가용 또는 손상" 으로 확장 — 으로 구체화, `01_10_53`/`01_49_10`
    plan_coherence 가 반복 확인 후 "✅ 착수 가능 — 선행 조건이 충족됐다" 로 판정) — **여전히
    `[ ]` 미완료.**
  - 상세: `idempotency.interceptor.ts` 의 클래스 docstring(코드 SoT)은 이제 5-path 표로
    "경로 1(기동 시 미주입)만 warn 없음, 나머지 넷은 warn" 을 정확히 구분하고, `isHttpStatusCode`
    (`MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE`)와 앞선 캐시 엔트리 손상 가드가 "Redis 는
    가용한데 데이터만 오염된" 별개 실패 축을 코드에 실체화했다. 반면 target 문서는 여전히
    (1) §4 표에서 5경로를 "전 경로 …(warn)" 으로 뭉뚱그리고, (2) §Rationale 을 "Redis/DB
    미가용" 단일 축으로만 프레이밍한다 — 코드와 spec 서술의 간극이 이번 diff 로 더 벌어진
    채다. `developer` 는 `spec/` 쓰기 권한이 없어(CLAUDE.md §Skill 체계) planner 턴을
    기다리는 상태이고, plan 이 이미 "착수 가능" 으로 표시해 뒀음에도 아직 실행되지 않았다.
  - 제안: 새로 발견된 결함이 아니라 **이미 추적 중인 항목이 여전히 유효함의 재확인**이다 —
    이 PR 이 target 을 직접 고칠 필요는 없다(developer 권한 밖). planner 턴에서
    (a) §4 표를 "전 경로" → "경로 1(기동 시 미주입) 제외 나머지 warn" 으로 좁히고,
    (b) §Rationale 문장을 "Redis/DB 미가용 **또는 캐시 엔트리·payload 손상** 시 fail-open" 으로
    확장하며, (c) plan 이 이미 지목해 둔 §2.2 Redis 표("손상 엔트리도 fail-open 대상") 보강까지
    **세 자리를 한 턴에** 맞추면 된다 — `backend-lint-gate-broken-on-main.md` 해당 항목 본문이
    이미 이 세 자리를 명시해 뒀다.

## 요약

이번 diff(`idempotency.interceptor.ts`/`.spec.ts` — `readKey`/`hashBody` 경계값 테스트 +
`isHttpStatusCode` 범위 검사)는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 가
사전에 상세히 설계·추적·완료 처리한 항목과 커밋 단위로 정확히 일치하며, plan 이 "결정 필요" 로
남긴 항목을 우회하거나 다른 plan 의 후속 항목을 무효화하는 지점은 없다. 유일한 이슈는
`spec/data-flow/15-external-interaction.md` 의 fail-open 서술이 이 diff 계열로 더 뚜렷해진
코드 사실(5-path 표, 손상은 "미가용" 과 다른 축)을 아직 반영하지 못한 채라는 점인데, 이는
같은 plan 이 이미 "착수 가능" 으로 표시해 둔 planner 턴 대기 항목이며 직전 두 라운드
(`01_10_53`, `01_49_10`)가 이미 같은 내용으로 지적했다 — 새로 발견된 결함이 아니라 기존
추적이 이번 라운드에도 계속 유효함을 재확인한 것이다.

## 위험도
LOW
