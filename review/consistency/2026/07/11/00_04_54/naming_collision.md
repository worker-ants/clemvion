# 신규 식별자 충돌 검토 — spec-fix-webchat-eia-drift.md

## 대상 요약

target 은 `spec/7-channel-web-chat/` 내 사전 존재 drift 3건(D-1 rate-limit 중복 서술 제거,
D-2 `NAV-WC-06` 상태 배지 flip, D-3 `embed-config` 응답 봉투 표기 보강)을 정정하는
**spec-only, 코드 무변경** 문서다. 세 항목 모두 **기존 식별자를 수정/정리**하는 작업이며,
어느 것도 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·spec 파일을
**신규로 창설**하지 않는다.

- D-1: `4-security.md` 기존 서술 삭제 + EIA §8.4 참조로 축약 — 신규 식별자 없음.
- D-2: `NAV-WC-06` (기존 요구사항 ID, `spec/2-navigation/_product-overview.md:222` 에 이미 존재)의
  상태 배지만 `🚧` → `✅` 로 변경 — ID 자체는 신규 부여가 아님.
- D-3: `embed-config` 엔드포인트(`GET /api/hooks/:endpointPath/embed-config`, `EmbedConfigDto`)는
  이미 `hooks.controller.ts:61` 에 구현돼 있고 spec 3곳(`3-auth-session.md`, `4-security.md` §3-①·Rationale I3)의
  누락된 `{ data }` 봉투 표기만 보강 — 신규 endpoint/타입 없음.
- plan 파일 경로 `plan/in-progress/spec-fix-webchat-eia-drift.md` 는 기존 `spec-fix-*`(spec-only 수정 plan)
  명명 컨벤션과 일치하며 기존 파일과 겹치지 않는다 (`find plan -iname '*webchat-eia-drift*'` 확인, 유일).

## 발견사항

- **[INFO]** plan 내부 체크리스트/Rationale 라벨(`D-1`/`D-2`/`D-3`, `R-D1`/`R-D2`/`R-D3`)이 무관한
  기존 plan 문서의 동일 라벨과 표기상 겹친다
  - target 신규 식별자: `D-1`·`D-2`·`D-3` (본문 섹션 헤더), `R-D1`·`R-D2`·`R-D3` (`## Rationale` 내부)
  - 기존 사용처: `plan/complete/cafe24-backlog-residual.md:1377`(`Polish 완료분(C-3/D-1/E-1/E-3/F-2/F-3)`),
    `:1388`(`- [ ] **D-2** (defer ...)`) — Cafe24 백로그의 완전히 무관한 항목(BullMQ 에러 격리 정책 등)에
    동일 `D-1`/`D-2` 라벨 재사용. 또한 `spec/4-nodes/7-trigger/providers/discord.md` 의 `R-D-3`
    (`Interactions Webhook only` 결정, `plan/complete/...discord...` §R-D-3 참조 다건)와 하이픈만 다른
    유사 표기(`R-D-3` vs `R-D1`)가 존재.
  - 상세: 두 라벨셋 모두 **문서 로컬 스코프**(그 plan 파일 안에서만 참조)이며, `NAV-WC-*`/`ND-*`/`ED-AI-*` 류
    formal 요구사항 ID 네임스페이스에 속하지 않는다. target 의 `R-D1` 은 target plan 자신의
    `## Rationale` 절에서만 self-reference 되고 spec 파일 본문에 기입되는 것이 아니므로 실질 충돌은 없다.
    이 letter+number 라벨 재사용 패턴은 저장소 전반의 다수 plan(예: `A-1`/`B-2`/`C-3` 류)에서
    이미 통용되는 관행이라 규약 위반은 아니다.
  - 제안: 조치 불필요(정보성). 다만 향후 두 plan 을 같은 대화/문서에서 교차 참조할 일이 생기면
    `D-1`(webchat) 처럼 파일명을 함께 명시해 라벨만으로 지칭하지 않을 것을 권장.

## 요약

target 이 실제로 새로 만드는 식별자(요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·spec 파일)는
없다 — D-1/D-2/D-3 세 항목 모두 기존 코드·기존 spec ID(`NAV-WC-06`)·기존 endpoint(`embed-config`)에 대한
**문서 정합화**(삭제/참조화·상태 flip·봉투 표기 보강)이며, plan 파일 경로도 기존 `spec-fix-*` 컨벤션을 따른다.
유일한 관찰 사항은 plan 내부의 비공식 체크리스트/Rationale 라벨(`D-1`~`D-3`, `R-D1`~`R-D3`)이 무관한
기존 plan 문서에서 동일 라벨로 이미 쓰이고 있다는 점인데, 두 라벨셋 모두 문서-로컬 스코프라 실질적
혼선 가능성은 낮아 INFO 로만 기록한다.

## 위험도

NONE
