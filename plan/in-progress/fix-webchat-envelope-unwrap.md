---
worktree: fix-webchat-envelope-unwrap-9519af
started: 2026-06-06
owner: developer
---

# 웹챗 위젯 `{ data }` 봉투 미언랩 버그 수정

> 작성일: 2026-06-06

## 배경 / 증상

`/demo` 에서 메시지 전송 → `POST /api/hooks/:path` 가 **202 + interaction(token/endpoints) 정상 반환**하는데도
위젯이 SSE 를 열지 않고 응답이 오지 않음.

## 근본 원인

백엔드 전역 `TransformInterceptor` 가 성공 응답을 `{ data: {...} }` 로 래핑한다 (webhook spec §3.1/§405 — **SoT, 불변**).
그런데 위젯의 `eia-client` 가 success-path body 를 언랩하지 않고 최상위에서 필드를 읽음:

- `eia-client.startConversation()` → `res.interaction` 이 `undefined` (실제값 `res.data.interaction`)
- `use-widget.persist()` → `if (!res.interaction) return null` → `openStream()` 미호출 → SSE 안 열림

→ 202 는 받지만 `EventSource` 자체가 생성 안 됨. (`fetchEmbedConfig` 는 이미 `json.data ?? json` 으로 올바르게 언랩 중 — 누락은 eia-client 에 국한.)

## 결정

- 백엔드 봉투가 SoT → 백엔드 불변. **프론트가 언랩하도록 수정**.
- 봉투를 생략해 오도한 spec 예시(EIA §4.1, channel-web-chat 0-architecture/3-auth-session) 를 봉투 반영하도록 갱신 → **project-planner 위임**.

## 체크리스트

- [x] consistency-check --impl-prep — `review/consistency/2026/06/06/02_34_39/` **BLOCK: NO** (WARNING 3건은 모두 본 plan 의 spec 갱신/plan 추적 항목과 일치)
- [x] 테스트 선작성/수정 (eia-client.test.ts — 봉투 shape 으로 교정 + getStatus/refreshToken 봉투 + 하위호환 회귀)
- [x] eia-client 언랩 helper 적용 (unwrapData → startConversation/getStatus/refreshToken). commit 91786ca1
- [x] (spec) project-planner 위임 완료 — 3곳 봉투 반영 + frontmatter pending_plans 등록. commit 84b5fa07
      - `spec/7-channel-web-chat/3-auth-session.md §3` 시퀀스 2행
      - `spec/7-channel-web-chat/0-architecture.md §3` EIA 매핑 표 "대화 시작" 행 (`expiresAt` 보강)
      - `spec/5-system/14-external-interaction-api.md §4.1` 응답 예시 + 전송 봉투 note
- [x] TEST WORKFLOW — lint ✓ / unit ✓(143) / build ✓(TS clean) / e2e ✓(174 passed, 78s).
      ※ 변경은 channel-web-chat 독립 SPA 한정(백엔드/프론트 import edge 없음). lint/unit/build 는 affected
        package 직접 실행, e2e 는 dockerized backend(`make e2e-test`) 로 cross-stack 회귀 net 확보. backend/
        frontend/sdk 로컬 stage 는 fresh worktree 의 packages/sdk prepare-script(tsc<@types/node) 사전 결함으로
        bundled 실행 불가 — 본 변경과 무관(상세 RESOLUTION).
- [ ] /ai-review + SUMMARY (진행 중)
- [ ] consistency-check --impl-done
- [ ] plan complete 이동
