# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 검토 범위와 전제

이번 호출은 `--impl-prep spec/5-system/` 이며, target 은 diff 가 아니라 `spec/5-system/` 전체
코퍼스다. 실제 착수 대상 작업은 `plan/in-progress/trigger-lock-followups.md`(트리거 config
advisory lock `#1334` 의 developer 범위 후속 5건, `spec_impact: none`)이므로, 다음 두 축을 함께
봤다:

1. `spec/5-system/` 코퍼스 내부(및 상호 참조하는 `spec/2-navigation/2-trigger-list.md` ·
   `3-schedule.md` · `4-integration.md` 의 Rationale) 가 자기 자신과 모순되는 곳이 있는가.
2. 착수 예정인 다섯 항목이 과거 Rationale(특히 `plan/complete/trigger-config-lost-update.md`
   가 확정한 트리거 단위 advisory lock 설계와 그 대조 선례)을 재도입·번복하는가.

번들이 컨텍스트 예산 초과로 절단한 `12-webhook.md` · `14-external-interaction-api.md` ·
`15-chat-channel.md` 는 트리거 관련 코드(`triggers.service.ts`)의 실제 SoT 이므로 저장소에서
직접 열어 확인했다.

## 발견사항

이번 다섯 항목 및 `spec/5-system/` 코퍼스 범위에서 **CRITICAL·WARNING 급 Rationale 연속성
위반은 발견되지 않았다.**

- **[INFO] `#1334` CHANGELOG 의 반증된 주장 정정을 이번 PR 산출물에서 실제로 확인할 것**
  - target 위치: `plan/in-progress/trigger-lock-followups.md` §"④ — Trigger 행을 지우는 경로는
    둘이 아니라 셋이다"
  - 과거 결정 출처: 루트 `CHANGELOG.md:31-34` (*"삭제 경로 둘 다"* 가 advisory lock 경합을
    닫는다는 서술) — spec 문서가 아니라 root 파일이라 `spec_impact: none` 판단 자체는 맞다
    (spec 어디에도 이 주장이 없음을 grep 으로 확인).
  - 상세: 완료된 `#1334` 는 "삭제 경로 2곳이 같은 advisory lock 을 공유해 실무적으로 닫혀
    있다"고 기록했으나, 이번 plan 의 재실측으로 `Workflow`/`Workspace` 삭제의 FK
    `onDelete: 'CASCADE'` 라는 **DB 레벨 세 번째 경로**가 advisory lock 을 전혀 거치지 않는다는
    점이 드러났다. 이는 과거 결정의 "무근거 번복"이 아니라 — plan 이 이미 명시하듯 — **반증된
    전제를 실측으로 교체하고 CHANGELOG 를 함께 고치겠다고 선언**한 모범적인 경로다. 다만 이
    교정이 코드 fix 와 분리되어 누락되면(코드만 고치고 CHANGELOG 문구는 "둘 다"로 남으면) 다음
    사람이 다시 같은 오판(락이 전 경로를 덮는다)을 반복할 위험이 있다.
  - 제안: item ④ 커밋에 CHANGELOG 정정(“삭제 경로는 셋이며, FK CASCADE 경로는 advisory lock
    을 거치지 않는다”)을 반드시 동반해 커밋 단위로 짝을 맞출 것. `codebase/**` JSDoc 정정(②)과
    한 커밋에 묶는 계획도 동일한 이유로 유지 권장.

- **[INFO] Cafe24 advisory-lock 기각 선례와의 경계는 유지되고 있음 — 확장 시 재인용 필요**
  - target 위치: (해당 없음 — 현재 plan 은 이 경계를 넘지 않음, 확인용 기록)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "BullMQ
    `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소" 절의 "검토 후 배제한 대안 —
    PostgreSQL advisory lock" (트랜잭션 안에 외부 HTTP 호출을 묶어야 하는 부담을 이유로 기각).
  - 상세: `plan/complete/trigger-config-lost-update.md` §"반대 선례와의 대조"가 이미 이 기각
    선례를 명시 인용하며 "트리거 config PATCH 는 HTTP 호출을 lock 안에 두지 않는다"는 이유로
    트리거 단위 advisory lock 채택을 정당화해 두었다. 이번 다섯 항목(개명·JSDoc·`timeoutMs`
    검증·`affected` 확인·테스트) 은 잠금 메커니즘 자체를 바꾸지 않으므로 이 경계를 재론할
    필요가 없다 — 위반이 아니라 **경계가 잘 유지되고 있다는 확인**으로 기록한다.
  - 제안: 없음(현행 유지). 다만 향후 이 lock 의 보유 범위를 넓히는 변경(예: 외부 호출을 lock
    안으로 끌어들이는 방향)이 제안되면, 반드시 이 기각 선례를 재인용해 "왜 이번엔 다른가"를
    명시해야 한다.

- **[INFO] `findByIdForUpdate` 개명은 저장소 SQL 관용구(`FOR UPDATE`, 7개 파일)와의 연상
  충돌 축소가 목적 — 재명명 시 그 대조축을 문면에 반영할 것**
  - target 위치: `plan/in-progress/trigger-lock-followups.md` 항목 ①, 실측표 ①행
  - 과거 결정 출처: 없음(신규 대조 — Rationale 위반 사안 아님, 명명 축은 naming_collision
    checker 소관)
  - 상세: plan 이 스스로 "체커 문면(다른 식별자와의 충돌)보다 좁게" 판정했다고 정확히
    기록했다 — 이는 Rationale 연속성 관점에서는 문제가 아니라 오히려 바람직한 자기 교정이다.
    본 checker 관점에서는 별도 조치 불필요.
  - 제안: 없음. 코드 리뷰 단계에서 개명 근거 문구가 "확립된 관용구와의 충돌"이 아니라
    "SQL `FOR UPDATE` 와의 연상 오독 방지"로 정확히 좁혀 적히는지만 확인.

## 요약

이번 사이클의 실제 착수 대상(`trigger-lock-followups.md` 5건)은 `spec_impact: none` 이 맞고,
다섯 항목 모두 이미 완료된 `#1334`가 명시적으로 "후속 등재"해 둔 항목이거나(①②③⑤) 재실측으로
드러난 좁은 실결함(④)이며, 어느 것도 `spec/5-system/` 이나 상호 참조 spec
(`2-trigger-list.md`·`3-schedule.md`·`4-integration.md`)의 `## Rationale`에 기록된 결정·원칙을
이유 없이 뒤집거나 이미 기각된 대안(Cafe24 advisory-lock 기각 선례 등)을 재도입하지 않는다.
오히려 ④는 과거 CHANGELOG 주장이 반증됐음을 실측으로 밝히고 그 정정을 코드 fix와 짝지어
계획하는, 이 프로젝트가 요구하는 "결정 번복 시 새 Rationale 동반" 원칙에 부합하는 사례다.
`spec/5-system/` 코퍼스 자체(전체 포함된 `1-auth.md`·`2-api-convention.md`·
`3-error-handling.md` 및 절단분을 직접 열람한 `12-webhook.md`·`15-chat-channel.md`)에서도
자기 모순되는 Rationale 항목은 발견하지 못했다. CHANGELOG 정정의 실제 이행 여부(위 INFO 1건)만
후속 커밋에서 확인하면 된다.

## 위험도

LOW
