# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md (finalizeStalledExhausted 트랜잭션화)

## 검토 범위 확인

`git diff origin/main...HEAD` 를 절대경로 워크트리에서 직접 실측했다. `spec/5-system/` 아래
실제 변경은 `spec/5-system/4-execution-engine.md` §7.1 본문 1문장 추가뿐이다(그 외 변경분은
CHANGELOG.md, execution-engine.service.ts/spec.ts, plan/in-progress/*, review/code 등
non-spec 파일). 이 diff 는 `finalizeStalledExhausted`(BullMQ stalled 재배달 소진 →
`WORKER_HEARTBEAT_TIMEOUT` 마감)의 Execution UPDATE + 자식 NodeExecution cascade UPDATE 를
`dataSource.transaction` 으로 묶은 버그 수정을 문서화한다 — 자매 함수 `cancelParkedExecution`
· `markWebChatIdleTimeout` 은 이미 원자적이었고 이 경로만 열려 있었다는 것이 근거
(`plan/in-progress/eia-stalled-atomicity.md`).

프롬프트에 번들된 Rationale 발췌(channel-web-chat, auth-session, data-flow, 0-overview,
data-model, navigation 등)는 이번 diff 영역과 겹치지 않는 cross-reference 번들이며, 실제
변경 파일(`4-execution-engine.md`)의 Rationale(§1.1 "원자성 보장", "크래시/재시작 RUNNING
세그먼트 제어된 re-drive", "PR4 — BullMQ stalled 자동 재배달")을 1차 대조 대상으로 삼았다.

## 발견사항

없음. 아래는 대조 근거다.

- **§1.1 "원자성 보장" (line 82) 과의 정합**: 기존 Rationale 은 "`running ↔ waiting_for_input`
  전이는 짝이 되는 `NodeExecution` 상태 변경과 **단일 DB 트랜잭션**으로 묶여 commit/rollback
  된다"는 불변식을 이미 선언하고 있다. 이번 diff 는 그 불변식이 **아직 적용되지 않았던 한
  경로**(`finalizeStalledExhausted`)를 자매 두 함수(`cancelParkedExecution` ·
  `markWebChatIdleTimeout`, 둘 다 이미 트랜잭션)와 동형으로 맞춘 것이다 — 원칙을
  **위반**하는 게 아니라 **완성**한다.
- **기각된 대안의 재도입 아님**: `4-execution-engine.md` 전체(§1.1, §7.1 PR3/PR4 rationale)를
  grep 했으나 "이 함수는 트랜잭션이 불필요하다/개별 autocommit 이 의도적이다" 라고 명시적으로
  채택·정당화한 과거 결정은 없다. 즉 이번 변경이 뒤집는 "기각된 대안"이 존재하지 않는다 —
  단순 누락(hardening 미적용)의 시정이다.
- **결정 번복 시 새 Rationale 요구 — 해당 없음**: 이번 변경은 기존 설계 결정을 번복하는 것이
  아니라 기존에 이미 선언된 원칙(§1.1 원자성 보장, PR3/PR4 rationale 의 "cascade 마감" 패턴)에
  **미달했던 구현을 원칙에 맞춘 정정**이다. 정정 근거는 소스 위치(§7.1 본문 인라인,
  2026-08-15 각주) · `CHANGELOG.md` · `plan/in-progress/eia-stalled-atomicity.md` 세 곳에
  일관되게 기록돼 있어 "무근거 번복"에 해당하지 않는다.
- **암묵적 invariant 우회 아님**: cascade 대상(`status='running'` 조건부 UPDATE, 커밋 후
  emit)·no-op 조건(`affected=0`)·at-least-once 재실행 경계 등 §7.1 기존 invariant 는 diff
  전후로 그대로다(`CHANGELOG.md`: "수신자 영향 없음 — 이벤트 payload·상태 전이·no-op 조건
  모두 그대로"). 트랜잭션 경계 도입은 그 invariant 들을 우회하지 않고 오히려 부분 커밋으로
  invariant 가 깨지던 창(유령 `RUNNING`)을 닫는다.

## INFO — 선택적 보완 제안

- **[INFO] 전용 Rationale 서브섹션 부재는 이번 변경의 성격상 문제 아님, 그러나 향후 유사 사례
  대비 참고할 점**
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 (line 851, PR4 문단 내 인라인
    각주로만 존재, `## Rationale` 절(line 1328+)에는 별도 표제 항목 없음)
  - 과거 결정 출처: 같은 문서 `## Rationale` 의 "PR4 — BullMQ stalled 자동 재배달" 항목
    (line 1457)이 `finalizeStalledExhausted` 의 dead-letter 마감 로직을 정의한 자리
  - 상세: 이 문서의 다른 유사 정정(예: "Pre-park read-window 정규화", "재개 race 보장을 DB
    원자 claim 으로")은 `## Rationale` 절에 독립 표제(`###`)를 두어 정정 배경·기각 대안·근거를
    한곳에 모으는 관례를 따른다. 이번 트랜잭션화는 본문 인라인 각주 + CHANGELOG + plan 세 곳에
    분산 기록되어 있어 추적은 가능하지만, 문서 내부의 `## Rationale` 관례와는 형식이 다르다.
    다만 이는 새로운 설계 결정이 아니라 기존 원칙(§1.1)에 대한 정정이므로 CRITICAL/WARNING
    수준은 아니다.
  - 제안(선택): `## Rationale` 의 "PR4 — BullMQ stalled 자동 재배달" 항목 말미에 1줄
    "(2026-08-15: 자매 함수와 동형으로 트랜잭션화 — 상세는 §7.1 인라인 각주)" 를 추가하면
    이 문서의 기존 Rationale 열람 패턴(끝 절만 보고 결정사를 파악)과 완전히 정합해진다.
    강제 사항 아님.

## 요약

이번 diff(`spec/5-system/4-execution-engine.md` §7.1 1문장 + 대응 코드)는 문서가 이미 선언한
"원자성 보장" 불변식(§1.1)을 자매 함수와 동형으로 미적용 경로에 확장 적용한 정정이며, 과거
Rationale 이 기각한 대안을 재도입하거나 합의 원칙을 위반하는 지점은 발견되지 않았다. 결정
번복도 아니어서 새 Rationale 의무도 발생하지 않는다. 유일한 코멘트는 형식적 완결성을 위해
`## Rationale` 절에도 1줄 포인터를 남기면 좋겠다는 INFO 수준 제안뿐이다.

## 위험도

NONE
