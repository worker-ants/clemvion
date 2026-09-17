# Rationale 연속성 검토 — spec/2-navigation/ (--impl-prep)

## 검토 범위와 방법

target 은 `spec/2-navigation/` 전체 번들(대부분 컨텍스트 예산으로 절단, `2-trigger-list.md` ·
`1-workflow-list.md` · `3-schedule.md` 만 본문 포함)이다. 실제 착수 예정 작업은
`plan/in-progress/trigger-save-partial-patch.md` — `TriggersService.update()`(창 1)의
통째 엔티티 `save()` 를 부분 객체 `save()` 로 좁히는 developer 작업이며, `spec_impact: none`
(spec 텍스트는 이번 PR 에서 건드리지 않는다)이다. 이 문서가 근거로 드는 과거 결정·기각 이력이
실재하는지를 `git log`/코드 주석/트래커 원문과 직접 대조해 검증했다.

## 검증한 인용의 사실관계

1. **`2-trigger-list.md` §3 "외부 provider 호출은 락 밖" 근거로 인용된 "Cafe24 토큰 갱신이
   같은 락을 기각한 사유"** — `spec/2-navigation/4-integration.md:1444` 를 직접 열어 확인.
   `pg_advisory_xact_lock(hashtext(integrationId))` 를 "lock 보유 중 HTTP 요청을 transaction
   안에 묶어야 해 DB 커넥션 점유 시간이 늘고" 라는 사유로 기각한 문장이 실재한다. 인용 정확.
2. **트리거 lock 도입 커밋(`60be0712a`, #1334)의 커밋 메시지 자체**가 이 정확히 같은 cafe24
   선례를 "기각된 대안의 재도입이 아니라 그 반론을 받은 설계" 로 인용하며 외부 호출을 락
   밖에 명시적으로 둔 이력이 있다 — 현재 spec 문구·현재 코드 주석(`triggers.service.ts:630-631`)
   모두 이 설계와 일치한다.
3. **`trigger-save-partial-patch.md` 가 인용하는 "창 1을 `update()`+재조회로 바꿨다가 되돌린
   이력"** — `codebase/backend/src/modules/triggers/triggers.service.ts:625-628` 주석에 "종전에
   이 자리를 `update` + 재조회로 바꿨다가 되돌린 이력이 있다 — 반환 엔티티·subscriber·
   `endpointPath` UNIQUE 충돌 경로의 의미가 함께 달라져 단위 6개 케이스가 RED 였다" 로 그대로
   존재. 이번 plan 은 이 이력을 근거로 **동사(`save`)는 유지하고 대상 객체만 좁히는** 설계를
   택했다 — 기각된 대안(=`update()` 전환)의 무근거 재도입이 아니라, 기각 사유를 피해가는 다른
   축(저장 대상의 폭)을 바꾸는 설계다.
4. **`plan/in-progress/trigger-save-partial-patch.md` 가 닫으려는 "developer 항목 7"** —
   `spec-draft-nullable-notation-followups.md:4505` 원문과 대조해 문구·범위가 정확히 일치함을
   확인했다. 형제 항목 8~11 은 이번 plan 의 스코프에 없다고 명시돼 있고 실제로 plan 본문도
   그 넷을 건드리지 않는다 — 과잉 종결(미완료 항목을 완료로 둔갑) 없음.

이 네 가지는 모두 "실제 이력 없이 기각·번복을 지어내는" 패턴(과거 다른 세션에서 지적된 실패
모드)에 해당하지 않음을 뜻한다 — 인용이 전부 실재 이력에 근거한다.

## 발견사항

- **[INFO]** §3 ⚠️ "실측되지 않은 잔여" 문구는 이 plan 이 머지되면 즉시 stale 해진다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3, "⚠️ **실측되지 않은 잔여**: PATCH 의
    기본 저장 경로(엔티티 통째 저장)는 ① … ② … 확인되지 않았다" 문단
  - 과거 결정 출처: 같은 문서 §3 "동시 쓰기 직렬화" 절(commit `217fadecb`, #1342)이 이 잔여를
    처음 등재했고, `spec-draft-nullable-notation-followups.md` developer 항목 7 이 추적한다
  - 상세: `trigger-save-partial-patch.md` 는 정확히 이 ①②를 실측·수정하는 작업이다. 계획대로
    되면 "엔티티 통째 저장" 이라는 전제 자체가 코드에서 사라지므로, 이 ⚠️ 문단은 (a) 더 이상
    "실측 안 됨" 이 아니라 "실측했고 고쳤다" 로, (b) "기본 저장 경로 = 엔티티 통째 저장" 이라는
    서술 자체도 갱신돼야 한다. plan 은 이 정정을 **의도적으로 이번 PR 범위에서 제외**하고
    "planner 턴 후속 등재" 로 넘기는데(§"이 PR 이 안 하는 것"), 이는 CLAUDE.md 의 자기-반증형
    소정정 조건 2("예고·트리거 문장만 developer 가 고칠 수 있다") 를 감안하면 role 경계상
    올바른 판단이다 — 다만 그 사이 창(코드는 고쳐졌는데 spec 은 "미실측" 이라고 계속 말하는
    구간)이 남는다는 뜻이므로 계속 추적이 필요하다.
  - 제안: 코드 변경이 머지되는 시점에 반드시 (1) 트래커 developer 항목 7 을 `[x]` 로 닫고
    (2) 같은 커밋 또는 즉각 후속 planner PR 에서 §3 ⚠️ 문단을 "① 시끄러운 실패로 실측(23503/23502)
    · ② 실결함이었고 부분 객체 save 로 수정됨" 으로 갱신할 것 — plan 체크리스트에 이미 이
    순서가 적혀 있으므로(체크박스 항목 "트래커 항목 7 `[x]` + planner 후속(⚠️ 정정) 등재") 새로
    지시할 내용은 없고, 이 라운드에서 그 순서가 실제로 지켜지는지만 확인하면 된다.

- **[INFO]** 번들 절단으로 미검증인 교차 참조 다수 — 판단에 영향 없음을 개별 확인
  - target 위치: 프롬프트 번들의 "⚠️ 컨텍스트 예산 초과로 생략된 파일 15개" 절 및
    `4-integration.md`/`5-system/*.md` 등 20여 개 관련 spec 이 본문 없이 절단됨
  - 상세: 이번 검토에서 실제로 인용·의존되는 자리(4-integration.md 의 cafe24 lock 기각 사유)는
    직접 `Read`/`grep` 으로 열어 대조했다. 그 외 절단된 문서들은 이번 target(§3 CASCADE/lock
    서술)과 직접 연결점이 없어 보여 전수 대조는 하지 않았다 — 이 사실이 "문제 없음의 근거"는
    아니므로, 향후 같은 스코프를 다시 검토할 때는 이번에 절단된 목록을 참고해 새로 관련된
    자리가 생겼는지만 재확인하면 된다.

## 요약

`spec/2-navigation/2-trigger-list.md` §3 의 동시성 계약 서술과, 그 서술이 남긴 "실측되지 않은
잔여" 를 닫으려는 `trigger-save-partial-patch.md` 의 설계는 과거 Rationale 과 정면으로 배치되지
않는다. 인용된 세 개의 핵심 이력(Cafe24 락 기각 사유, `update()`+재조회 되돌림 이력, 트래커
developer 항목 7 의 원문)을 모두 직접 대조해 실재함을 확인했고, 이번 plan 은 기각된 대안을
말없이 재도입하는 대신 그 기각 사유를 피하는 다른 설계축(저장 동사는 유지, 저장 대상 폭만 축소)을
선택했다 — 이는 이 저장소가 이미 확립한 "기각 사유를 받아들인 설계" 패턴(#1334 커밋 메시지의
표현 그대로)의 연장이다. 유일한 잔여 리스크는 구조적인 것이 아니라 시점상의 것 — 코드가 먼저
고쳐지고 spec 의 ⚠️ 문단 정정은 role 경계상 별도 planner 턴으로 미뤄지므로, 그 후속이 실제로
집행되는지 다음 라운드에서 확인이 필요하다.

## 위험도

LOW
