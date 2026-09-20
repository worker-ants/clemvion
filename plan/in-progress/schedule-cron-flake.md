---
title: schedule-trigger e2e 「D. PATCH cron」이 하루 1분 창에서 거짓 실패한다 — 비교를 «다르다» 에서 «새 cron 이 만드는 값인가» 로
status: in-progress
owner: developer
worktree: schedule-cron-flake-2f9a4c
started: 2026-09-20
spec_impact: none
---

# 「D. PATCH cron → nextRunAt 재계산」의 시각 충돌

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «`schedule-trigger` e2e 「D. PATCH cron → nextRunAt
재계산」이 하루 1분 창에서 실패한다»(`plan/complete/ssrf-catch-instanceof.md` 작업 중 실측으로 발견).

## 무엇이 문제인가

테스트는 `0 10 * * *`(Asia/Seoul)로 스케줄을 만들고 `*/1 * * * *` 로 PATCH 한 뒤 `nextRunAt` 이 **달라졌는지** 본다.
그런데 두 cron 의 다음 실행이 **같아지는 1분**이 매일 있다 — 09:59 KST 에는 분 단위 cron 의 다음 실행도 `10:00 KST`
(`01:00:00Z`)다. 그러면 재계산이 정상인데도 «안 바뀌었다» 로 읽힌다.

**실측** (`plan/complete/ssrf-catch-instanceof.md` 의 TEST 결과에 기록): 호스트 09:58 KST 에 돌린 e2e 에서 이 한 건만 실패했고
(`expect(received).not.toBe("2026-09-20T01:00:00.000Z")`), 10:02 KST 재실행은 366 전부 통과했다.

## 무엇이 잘못된 비교인가

«다르다» 는 **재계산의 대리 지표**다. 값이 달라지는 것은 재계산의 결과일 뿐이고, 두 cron 이 같은 시각을 가리키면 그 대리
지표가 무너진다. 봐야 하는 것은 «PATCH 뒤의 `nextRunAt` 이 **새 cron** 이 만드는 값인가» 다.

## 할 것

1. 생성 cron 을 `*/1 * * * *` 와 **절대 겹칠 수 없는** 값으로 바꾼다 — `0 0 1 1 *`(매년 1월 1일, 같은 파일 E 케이스가 쓰는 값).
   분 단위 cron 의 다음 실행은 늘 1분 안이므로 연 1회 cron 과 같아질 수 없다.
2. 단언을 하나 더한다 — PATCH 응답의 `nextRunAt` 이 **호출 시점부터 약 1분 안**이다(새 cron 이 만드는 값의 성질). 값이
   우연히 같아지는 창이 사라졌으므로 «다르다» 도 그대로 둔다: 둘 다 통과해야 재계산이 실제로 일어난 것이다.

## 비대상

- 서비스 코드(`schedules.service.ts` 의 재계산 로직) — 정상이다. 바꾸는 것은 테스트의 비교뿐이다.
- 같은 파일의 다른 cron 케이스 — 겹침이 성립하지 않는다(E 는 연 1회, C·G·H 는 값을 비교하지 않는다).

## 테스트

이 항목 자체가 테스트 수정이다. 판별력은 **서비스 쪽 뮤턴트**로 본다 — `update()` 의 «cron 이 바뀌면 `nextRunAt` 재계산»
블록을 지우면 이 테스트가 RED 여야 한다(지금 형태도, 고친 형태도).

## 체크리스트

- [x] `--impl-prep spec/2-navigation/` — `review/consistency/2026/09/20/11_21_16` BLOCK: NO. WARNING 1(요구사항 카탈로그
  `NAV-WF-02` 상태가 상세 spec 의 «미구현» 과 어긋남)은 이 작업과 무관한 기존 불일치 — planner 항목으로 등재한다
- [x] 테스트 수정 · 뮤턴트로 판별력 — 뮤턴트 둘 다 RED: (1) 서비스의 재계산 블록 삭제 → 옛 단언이 잡는다,
  (2) 같은 뮤턴트 + **옛 «다르다» 단언 제거** → 새 «1분 안» 단언 홀로 잡는다(이 수정의 요지 — 충돌 창에서도 관측이 남는다)
- [x] TEST WORKFLOW (lint · unit · build · e2e 366). unit 1회차는 jest 워커 SIGSEGV 로 `webauthn.service.spec.ts` 가
  실행되지 못했다 — 이 변경(backend e2e 파일 하나)과 무관하고 재실행 통과
- [ ] `/ai-review` 수렴
- [ ] `--impl-done`
- [ ] 트래커 해소 · 이 plan `plan/complete/` 로
