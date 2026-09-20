---
title: schedule-trigger e2e 「D. PATCH cron」이 하루 1분 창에서 거짓 실패한다 — 비교를 «다르다» 에서 «새 cron 이 만드는 값인가» 로
status: complete
owner: developer
worktree: schedule-cron-flake-2f9a4c
started: 2026-09-20
completed: 2026-09-20
spec_impact: none
---

# 「D. PATCH cron → nextRunAt 재계산」의 시각 충돌

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «`schedule-trigger` e2e 「D. PATCH cron → nextRunAt
재계산」이 하루 1분 창에서 실패한다»(`plan/complete/ssrf-catch-instanceof.md` 작업 중 실측으로 발견).

## 무엇이 문제인가

테스트는 `0 10 * * *`(Asia/Seoul)로 스케줄을 만들고 `*/1 * * * *` 로 PATCH 한 뒤 `nextRunAt` 이 **달라졌는지** 본다.
그런데 두 cron 의 다음 실행이 **같아지는 1분**이 매일 있다 — 09:59 KST 에는 분 단위 cron 의 다음 실행도 `10:00 KST`
(`01:00:00Z`)다. 그러면 재계산이 정상인데도 «안 바뀌었다» 로 읽힌다.

**실측** (`review/code/2026/09/20/09_35_16/RESOLUTION.md` §TEST 결과 · 트래커 `spec-draft-nullable-notation-followups.md` 의 해당
항목에 기록): 호스트 09:58 KST 에 돌린 e2e 에서 이 한 건만 실패했고(`expect(received).not.toBe("2026-09-20T01:00:00.000Z")`),
10:02 KST 재실행은 366 전부 통과했다.

## 무엇이 잘못된 비교인가

«다르다» 는 **재계산의 대리 지표**다. 값이 달라지는 것은 재계산의 결과일 뿐이고, 두 cron 이 같은 시각을 가리키면 그 대리
지표가 무너진다. 봐야 하는 것은 «PATCH 뒤의 `nextRunAt` 이 **새 cron** 이 만드는 값인가» 다.

## 할 것

1. 생성 cron 을 `0 0 1 1 *`(매년 1월 1일, 같은 파일 E 케이스가 쓰는 값)로 바꾼다 — 분 단위 cron 이 만드는 «1분 안» 창 밖이다.
2. 판정을 «다르다» 에서 «새 cron 이 만드는 값인가» 로 바꾼다 — PATCH 응답의 `nextRunAt` 이 요청 시점부터 1분 안(부하 여유 30초)
   이고 초 자리가 0(분 경계)이다.
3. **옛 값과의 비교는 형태를 막론하고 뺀다.** 1라운드 리뷰가 «연 1회 cron 은 겹칠 수 없다» 를 반증했고(12/31 23:59 KST: 둘 다
   1월 1일 00:00), 그래서 넣은 대체 단언(«생성 cron 의 값은 창 밖이다»)마저 2라운드 리뷰가 같은 결함 클래스로 반증했다
   (연말 90초). ~~생성 cron 의 값은 그 창 밖임을 함께 단언한다~~ — 폐기. 근거: `review/code/2026/09/20/12_17_18` W1 · 그
   RESOLUTION.

**남는 잔여**(3라운드 W1, 등재): 반대 방향의 좁은 창 — 12/31 23:58:30 ~ 01/01 00:00:30 KST 근방에서는 생성 cron 의 값 자체가
위 창 안이라 재계산이 없어도 통과한다(거짓 통과, 연 ~2분). e2e 는 시각을 고정할 수 없어 닫지 못한다.

## 비대상

- 서비스 코드(`schedules.service.ts` 의 재계산 로직) — 정상이다. 바꾸는 것은 테스트의 비교뿐이다.
- 같은 파일의 다른 cron 케이스 — 겹침이 성립하지 않는다(E 는 연 1회, C·G·H 는 값을 비교하지 않는다).

## 테스트

이 항목 자체가 테스트 수정이다. 판별력은 **서비스 쪽 뮤턴트**로 본다 — `update()` 의 «cron 이 바뀌면 `nextRunAt` 재계산»
블록을 지우면 이 테스트가 RED 여야 한다(지금 형태도, 고친 형태도).

## 체크리스트

- [x] `--impl-prep spec/2-navigation/` — `review/consistency/2026/09/20/11_21_16` BLOCK: NO. WARNING 1(요구사항 카탈로그
  `NAV-WF-02` 상태가 상세 spec 의 «미구현» 과 어긋남)은 이 작업과 무관한 기존 불일치 — 트래커에 planner 항목으로 등재했다
- [x] 테스트 수정 · 뮤턴트로 판별력 — 서비스의 재계산 블록을 지우면 RED 다. 세 라운드에 걸쳐 단언이 줄어드는 동안
  (옛 값 비교 두 형태를 차례로 폐기) **매번 다시 확인**했고, 마지막 형태(«1분 안 · 분 경계» 만)에서도 RED 다
- [x] TEST WORKFLOW (lint · unit · build · e2e 366). unit 1회차는 jest 워커 SIGSEGV 로 `webauthn.service.spec.ts` 가
  실행되지 못했다 — 이 변경(backend e2e 파일 하나)과 무관하고 재실행 통과
- [x] `/ai-review` 수렴 — 네 라운드. 1R `review/code/2026/09/20/11_54_10`(W3 → `a8ddcfb32`: «달라졌다» 제거 ·
  여유 확대 · 인용 정정 · 분 경계 단언) · 2R `12_17_18`(W2 → `b40b5b98f`: 1R 이 넣은 «옛 값은 창 밖» 도 같은 창을
  만들어 옛 값 비교를 통째로 제거) · 3R `12_45_31`(W4 → `5d551ad73`: 주석 · plan 이 가리키던 옛 설계 정정, 잔여는 등재) ·
  4R `13_12_35`(W1 → `568fd2ecd`: 주석 인용을 전체 경로로). 3R RESOLUTION 에서 상한을 4로 늘리고 4R 을 검증 라운드로 못 박았다
- [x] `--impl-done` — `review/consistency/2026/09/20/13_34_15` BLOCK: NO, Critical · Warning 0 (5/5 NONE)
- [x] 트래커 해소 + 후속 둘 등재(연말 ~2분 거짓 통과 창은 기존 «cron 재계산 happy-path 단위 테스트» 항목에 합침 ·
  `NAV-WF-02` 카탈로그 상태 불일치는 planner 항목) · 이 plan `plan/complete/` 로
