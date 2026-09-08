# Plan 정합성 검토 — `spec-draft-followups-batch-a.md`

## 검토 방법

target 의 A-1~A-6 6개 배치를 자매 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`
전문과 대조하고, 그 문서에서 target 이 "닫는다" 고 주장하는 각 항목이 실제로 미체크(`[ ]`) 상태로
남아 있는지, target 이 인용하는 baseline 문구가 현재 spec/코드와 정확히 일치하는지 실측했다
(`CLAUDE.md` 스킬 표, `developer/SKILL.md`·`project-planner/SKILL.md` 경로별 권한 표,
`secret-store.md:69-96`, `14-external-interaction-api.md:888-969`, `2-api-convention.md`/
`swagger.md` frontmatter `code:`, `triggers.service.ts` `findAll`/`TRIGGER_RESPONSE_STRIP_COLUMNS`,
`user-entity-exposure-guard.ts`/`user-secret-absence.ts` 파일 존재). 이전 라운드
(`review/consistency/2026/09/08/11_14_39/plan_coherence.md`)의 WARNING·INFO 가 이번 draft 개정
(A-6 신설)에서 반영됐는지도 확인했다. 그 외 `plan/in-progress/**` 전체(약 65개 파일, 상당수는
프롬프트 예산 초과로 본문 생략)에서 같은 spec 파일·같은 절을 겨누는 활성 편집 충돌이 있는지
grep 으로 훑었다.

## 이전 라운드 대비 — 반영 확인

- `11_14_39` WARNING(`secret-store.md`/EIA `§7.1` 의 "노출 창 미해소" 서술이 이미 거짓인데
  target 이 갱신 안 함)은 이번 draft 의 **A-6 신설**로 해소됐다. 실측: 두 파일 모두 현재도
  해당 현재형 문구를 그대로 갖고 있고(`secret-store.md:69` "노출 창은 아직 설계대로 닫혀
  있지 않다", `14-external-interaction-api.md:934` "현재 이 컬럼은 응답에도 나간다 …
  미해결 결함"), 코드 실측(`triggers.service.ts:99-186` `TRIGGER_RESPONSE_STRIP_COLUMNS`
  에 `notificationSecretV2` 포함 + 응답 경계 스트립)이 A-6 의 "#1291 로 닫혔다" 주장을
  뒷받침한다. A-6 은 이 정합성 사슬을 정확히 집는다.
- `11_14_39` INFO(`pending_plans` 게이트가 파일 존재만 보고 항목 매칭은 안 봄)도 이번 draft
  A-2-2 안에 동일 문구로 이미 반영돼 있다.

## 발견사항

- **[WARNING]** 체크리스트의 "자매 트래커 체크박스 5건 플립"이 실제 대상 개수를 과소 집계한다
  - target 위치: `## 체크리스트`(문서 끝) — "- [ ] 자매 트래커(`spec-draft-nullable-notation-followups.md`)
    체크박스 5건 플립" 줄. 바로 두 줄 위 "- [ ] A-2 `2-trigger-list.md` **4건**" 이 이미 A-2 자체가
    단일 항목이 아님을 명시하고 있어, 같은 체크리스트 안에서 산술이 어긋난다.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 섹션의
    미체크(`- [ ]`) 항목 — 실측 라인: `969`(CLAUDE.md harness, A-1) · `1121`(R-2 폐기, A-2-1) ·
    `1137`(frontmatter status, A-2-2) · `1148`(auth config dead-end, A-2-3) · `1203`(botToken,
    A-2-4) · `1183`(도메인 에러 코드, A-3) · `901`(§5.4 신규 검출축, A-4) · `1266`(User 7컬럼,
    A-5) · `1841`(노출 창 낡음, A-6 — "스코프 추가"로 이번 draft 에 새로 편입).
  - 상세: target 이 이번 턴에 닫는 자매 트래커의 물리적 `- [ ]` bullet 은 최소 **9개**다
    (A-2 하나가 4개 bullet 로 쪼개져 있고, A-6 은 원래 "5건" 서술에 포함되지 않았던 추가
    스코프다). 그런데 마지막 체크리스트 항목은 "5건" 이라고 숫자를 못 박는다. 이 문서 자체가
    반복 지적해 온 실패 패턴(A-4 "개수를 세지 않는다", 프로젝트 메모
    `feedback_stale_plan_claims_and_checklist_sync.md` "체크박스 = 실제 상태")과 같은 클래스다
    — 실행자가 "5건"을 문자 그대로 따르면 A-2 의 4개 bullet 중 최소 3개(또는 A-6 포함
    4개)가 스펙 편집은 끝났는데 트래커에는 `[ ]` 로 남는다. `spec-draft-nullable-notation-followups.md`
    의 lifecycle 완료 조건("체크박스 전부 `[x]` + 미해결 follow-up 0건", 같은 저장소
    `harness-review-gate-followups.md` 헤더가 명시)을 영구히 못 만족시키는 결과로 이어진다.
  - 제안: 체크리스트 항목을 "자매 트래커의 해당 bullet 9개(A-1 1 · A-2 4 · A-3 1 · A-4 1 ·
    A-5 1 · A-6 1) 전부 플립 — 개별 열거로 확인, 숫자만으로 종료 판단 금지"로 바꾸거나,
    최소한 실행 직전 자매 트래커를 열어 target 의 각 A-N 이 대응하는 bullet 을 전수 대조하는
    단계를 명시한다.

## 요약

target 은 직전 라운드(`11_14_39`)의 WARNING·INFO 를 A-6 신설과 A-2-2 문구로 정확히 반영했고,
6개 배치(A-1~A-6)가 인용하는 baseline 문구·코드 실측은 모두 현재 저장소 상태와 일치해 stale
근거나 미해결 결정 우회는 발견되지 않았다. 다른 `plan/in-progress/**` 항목 중 같은 spec 파일의
같은 절을 겨누는 활성 편집 충돌도 없다. 유일한 실질적 결함은 문서 자신의 회계 오류다 —
체크리스트 마지막 항목이 자매 트래커에서 플립해야 할 bullet 수를 "5건"으로 적었으나 실제로는
그 문서의 물리적 미체크 항목 중 최소 9개가 이번 draft 의 스코프 안에 들어온다(바로 위 줄이
"A-2 4건"이라고 스스로 적어 둔 것과도 모순). CRITICAL 급 결정 충돌이 아니라 사후 트래킹 누락
리스크이며, 방치하면 자매 plan 이 실제로는 다 처리됐는데도 체크리스트상 미완료로 남는다.

## 위험도

LOW
