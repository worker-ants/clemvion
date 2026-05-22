# RESOLUTION — 15_08_07

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1        | 코드  | c837e538    | authType 값 영문 리터럴 → t("triggers.authHmac/authBearer/authNone") |
| W2        | 코드  | c837e538    | Enabled 배지 → t("triggers.externalInteraction.interactionEnabled") |
| W3        | 코드  | (별 plan)   | handleSave useMutation 통일 — `plan/in-progress/trigger-drawer-refactor-async.md` |
| W4        | 코드  | (별 plan)   | copyText 중복 → useCopyToClipboard 훅 추출 — `plan/in-progress/trigger-drawer-copy-hook.md` |
| W5        | 코드  | (별 plan)   | getWebhookUrl 포트 하드코딩 — `plan/in-progress/webhook-url-env.md` |
| W6        | 코드  | (별 plan)   | drawer 단위 테스트 신설 — `plan/in-progress/trigger-drawer-tests.md` |
| W7        | 코드  | (별 plan)   | Recent Calls 제거 회귀 테스트 — `plan/in-progress/trigger-drawer-tests.md` |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4448 passed)
- e2e   : 통과 (98/98)

## 보류·후속 항목

- INFO-1 (spec §2.3.1 Recent Calls 행): commit c837e538 에서 제거 완료
- INFO-2 (plan 체크박스): commit c837e538 에서 [x] 갱신 완료. git mv → plan/complete/ 는 PR 마무리 commit 에서 처리
- INFO-3 (urlLabel 키 의식적 선택): 의식적 선택 (EIA 카드가 Webhook 카드와 동일 레이블 공유). 근거 주석 추가는 별 plan 으로 분리
- INFO-4 (ExternalInteractionCard JSDoc stale): commit c837e538 에서 "편집·rotate·revoke 지원 (PR #265)" 로 정정 완료
- INFO-5 (err.message 노출): 기존 패턴, `plan/in-progress/trigger-drawer-refactor-async.md` 에 포함 검토
- INFO-6 (window.confirm): 기존 패턴, 커스텀 다이얼로그 도입은 별 plan
- INFO-7 (isActive drawer toggle spec 회색지대): spec draft 작성 완료, project-planner 위임 — `plan/in-progress/spec-fix-isactive-drawer-toggle.md`
- INFO-8 (tokenStrategy 코드 노출): commit c837e538 에서 t("...tokenStrategyPerTrigger/PerExecution") 교체 완료
- W3/W4/W5/W6/W7: PR 범위 밖 리팩토링 — 별 plan 신설 완료 (plan/in-progress/)
