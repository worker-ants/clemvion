---
title: 4-integration — Database 연결 테스트의 쿼리 대기 · §6 의 연결 테스트 절 번호
status: in-progress
owner: project-planner
worktree: integration-testers-5c2d91
started: 2026-09-19
spec_impact:
  - spec/2-navigation/4-integration.md
---

# 4-integration — Database 연결 테스트의 쿼리 대기 · §6 의 연결 테스트 절 번호

같은 브랜치의 구현(`plan/in-progress/integration-db-http-testers.md`) 리뷰가 드러낸 spec 쪽 두 자리. 둘 다 사실 정정이다 —
새 동작을 정하지 않는다.

## 왜

1. **§5.4 쿼리 대기** — `/ai-review` `review/code/2026/09/19/15_02_57` WARNING 4 `[SPEC-DRIFT]`. §5.4 는 «연결 대기는 10초» 만 적는다.
   구현(`database-connection-tester.ts`)은 `SELECT 1` 에도 10초 상한을 둔다 — pg `query_timeout`, mysql2 쿼리 `timeout`. 연결만 묶으면
   인증까지 끝낸 뒤 응답하지 않는 서버에 쿼리가 매달린다. 구현이 옳고 spec 문장이 그 한 칸을 놓쳤다. 사용자 가이드 · CHANGELOG 는 이미
   «연결 · `SELECT 1` 각각 10초» 로 적는다.
2. **§6 의 절 번호** — `--impl-prep` `review/consistency/2026/09/19/13_21_00` INFO 1. §6 «상태 전이» 의 `pending_install` 설명이 연결
   테스트 endpoint 의 `INTEGRATION_INCOMPLETE` 반환을 `§9.3` 으로 가리킨다. `POST /api/integrations/:id/test` 행과 그 가드 서술은
   **§9.1** «목록·CRUD» 표에 있다(§9.3 은 «사용처·활동»). 그 INFO 는 «§9.2» 라고 적었는데 그것도 틀렸다 — 표 행 위치로 확인.

## 변경

### A. §5.4 테스트 문장

«연결 대기는 10초.» →

«연결과 `SELECT 1` 을 각각 10초까지 기다린다 — 연결만 묶으면 인증 뒤 응답하지 않는 서버에 쿼리가 매달린다.»

### B. §6 `pending_install` 설명의 괄호

«(연결 테스트 endpoint 는 별도로 `INTEGRATION_INCOMPLETE` 반환 — §9.3.)» →

«(연결 테스트 endpoint 는 별도로 `INTEGRATION_INCOMPLETE` 반환 — §9.1.)»

## 비대상

- 연결 테스트의 **동시 실행 상한**(프로세스당 2, 넘으면 줄) · **닫기 상한**(1초 뒤 소켓 파괴)은 구현의 견고성 장치라 spec 에 싣지 않는다.
  CHANGELOG 가 운영자에게 알린다. 계약으로 묶을 필요가 생기면(예: 줄 길이 제한 · 거부 응답) 그때 §9.2 에 적는다 — 트래커 «연결 테스트의
  `dns.lookup` 이 스레드풀을 쥔다» 항목.
- §14.1 이 노드 런타임 코드를 `HTTP_{status}` · `HTTP_4XX` 로 섞어 적는 것(같은 impl-prep INFO 6)은 이 draft 에 넣지 않는다 — 어느 쪽이
  맞는지 노드 spec 과 대조가 먼저다. 트래커에 남긴다.

## Rationale

- **A 를 «구현을 spec 에 맞춰 되돌리기» 로 처리하지 않는 이유**: 쿼리 상한을 빼면 인증까지 통과한 뒤 멈추는 서버가 연결 테스트를 무한히
  붙잡는다 — 그 PR 이 동시 실행 상한을 도입했으므로 붙잡힌 테스트가 다른 연결 테스트까지 막는다. spec 문장이 한 칸 좁았다.
- **동시 실행 상한 · 닫기 상한을 spec 에 싣지 않는 기준**: 응답의 모양(코드 · 필드 · 상태)을 바꾸지 않는 견고성 장치는 CHANGELOG 로
  알린다. 요청을 거부하거나 새 결과 코드를 내게 되면 그때 계약이 되므로 §9.2 · §14.1 에 적는다.
- **B 의 번호를 표 행 위치로 정한 이유**: 서술이 가리키는 대상은 «연결 테스트 endpoint 의 `pending_install` 가드» 이고, 그 가드를 적은 곳이
  §9.1 표의 `:id/test` 행이다(Rationale «연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식» 도 같은 행을 가리킨다).

## 체크리스트

- [x] `--spec` 이 draft — `review/consistency/2026/09/19/15_30_56` **BLOCK: NO** (Critical 0 · WARNING 1 · INFO 5). WARNING 1(트래커
      «소소한 표기 두 건» 이 §6 부분만 해소되는데 축소가 안 적혔다) → 트래커 항목을 §14.1 단독으로 줄이고 §6 해소를 적었다. INFO 1(«계약 vs
      견고성 장치» 기준 명문화) → 아래 Rationale 한 줄. INFO 5(종결 체크리스트의 draft 단수) → 구현 plan 에 두 draft 를 적었다. INFO 2~4 조치 불요
- [x] spec 반영 (planner 커밋)
- [ ] 이 draft `plan/complete/` 로 (구현 plan 과 같은 PR 의 마무리 커밋)
