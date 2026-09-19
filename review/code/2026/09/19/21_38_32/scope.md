# 변경 범위(Scope) 리뷰 — SSRF 가드 통합 (smtp-ssrf-cgnat-8d41b2)

## 검토 배경

`plan/in-progress/ssrf-guard-integration-unify.md` 가 정의한 작업 범위: (1) `http-safety.ts` 가 IPv4-mapped IPv6
를 IPv4 대역으로 되돌려 판정, (2) SMTP 가드(`smtp-host-guard.ts`)를 `ssrf.util` 대신 `http-safety` 기반으로 교체,
(3) 관련 주석 정정(`SMTP_BLOCK_PRIVATE_HOSTS` phantom → `ALLOW_PRIVATE_HOST_TARGETS`), (4) 테스트 추가.
`git diff origin/main` 으로 실제 diff 전문을 직접 확인(프롬프트가 잘라낸 파일 3·4·7·8·11 포함)하여 프롬프트에 표시된
스니펫과 실제 변경분이 일치하는지 대조했다 — 전부 일치, 프롬프트가 숨긴 부분에 별도 변경 없음.

## 발견사항

- **[INFO]** SMTP 가드 파일이 `common/utils/` 에서 `nodes/integration/send-email/` 로 이동 — plan 이 명시한 의도적 결정
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (신규), `codebase/backend/src/common/utils/smtp-host-guard.ts`(삭제), `codebase/backend/src/common/utils/smtp-host-guard.spec.ts`(삭제)
  - 상세: 파일 이동은 리팩터 성격이 있어 "요청 이상의 변경" 여부를 확인했다. `plan/in-progress/ssrf-guard-integration-unify.md` 체크리스트에 "SMTP 가드는 `nodes/integration/send-email/` 로 옮겼다(`common` → `nodes` 역방향 import 를 만들지 않으려고)" 라고 근거가 명시돼 있고, 이동에 따른 모든 import 경로 갱신(`integrations.service.ts`, `integrations.service.spec.ts`, `send-email.handler.ts`, `send-email.handler.spec.ts`)이 diff 에 일관되게 반영돼 있어 누락된 곳이 없다. 범위 이탈이 아니라 문서화된 설계 결정이므로 INFO 로만 남긴다.
  - 제안: 조치 불필요.

- **[INFO]** `integrations.service.ts` / `send-email.handler.ts` 주석 변경은 plan 항목 3(주석 정정)에 정확히 대응
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (testEmailTransport 메서드 내부, `isSmtpHostBlocked` 호출 직전 주석), `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts` (동일 패턴)
  - 상세: "SSRF 완화 (opt-in) — `SMTP_BLOCK_PRIVATE_HOSTS` 정책이 켜진 경우" → "SSRF 가드 (기본 ON) … `ALLOW_PRIVATE_HOST_TARGETS=true` 로만 끈다"로 변경. 이는 무관한 주석 손질이 아니라, plan 이 명시한 "phantom 식별자 정정" 작업이며 실제 동작(opt-out, 기본 ON)과 주석 서술(opt-in 으로 오기)의 불일치를 바로잡는 것. `git diff` 로 대조한 결과 두 파일 모두 이 주석 블록 외 다른 본문 변경이 없다(import 경로 한 줄 제외).
  - 제안: 조치 불필요.

- **[INFO]** `scripts/backend-typecheck-baseline.json` 변경(197→194, `http-safety.spec.ts` 행 삭제)은 결과물이지 의도치 않은 설정 변경 아님
  - 위치: `scripts/backend-typecheck-baseline.json`
  - 상세: 이 파일은 auto-generate ratchet baseline(주석에 "손으로 고치지 말고 `--update` 로 재생성"이라 명시)이다. plan 체크리스트에 "build 의 타입체크 ratchet 이 `http-safety.spec` 3 → 4 를 잡았다 … 4 → 0, baseline 197 → 194 — `1e07cf5cf`" 라고 실측·근거가 남아 있고, 실제 diff 도 `http-safety.spec.ts: 3` 행 삭제 + total 감소뿐이라 이번 PR 이 만든 신규 타입 오류가 아니라 기존 오류를 해소한 결과다. "총량을 올리는" 방향이 아니라 낮추는 방향이라 설정 변경 위험 기준(§8)에 해당하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `review/consistency/2026/09/19/21_02_09/**` 6개 파일과 `plan/in-progress/ssrf-guard-integration-unify.md` 는 harness 산출물/작업 추적 문서로, 코드 변경 스코프 밖이지만 CLAUDE.md 규약상 필수 동반 산출물
  - 위치: `review/consistency/2026/09/19/21_02_09/{SUMMARY,cross_spec,convention_compliance,naming_collision,plan_coherence,rationale_continuity}.md`, `_retry_state.json`, `meta.json`, `plan/in-progress/ssrf-guard-integration-unify.md`
  - 상세: CLAUDE.md 는 `developer` 가 구현 착수 직전 `consistency-check --impl-prep` 을 의무화하고 그 산출물은 `review/consistency/**` 에 두도록 정의한다. 진행 중 작업 문서도 `plan/in-progress/<name>.md` 에 두는 것이 정식 위치다. 즉 이 파일들은 "코드 변경과 무관한 파일 수정"이 아니라 규약이 요구하는 동반 산출물이다.
  - 제안: 조치 불필요.

## 점검했으나 범위 이탈 없음 (양성 확인)

- `http-safety.ts` 본문 변경은 plan 항목 1(IPv4-mapped IPv6 판정)에 정확히 대응하는 두 헬퍼 함수(`canonicalIPv6`, `mappedIPv4`) 추가와 `isBlockedIPv6` 내부 최소 수정뿐 — 기존 IPv4/CIDR 로직·`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 시그니처·export 표면은 그대로.
- 신규 테스트(`http-safety.spec.ts`, `smtp-host-guard.spec.ts` 신규 위치, e2e `integration-connection-test.e2e-spec.ts` B2 케이스)는 모두 plan 항목 4("테스트 — mapped 두 형 × 대역 · 공인 mapped 통과 대조군 / CGNAT · `::` · opt-out")가 예고한 항목과 1:1 대응하며, 그 이상의 임의 테스트 확장(예: 무관한 엣지케이스 대량 추가)은 없다.
- `http-safety.spec.ts` 의 `mockedLookup` 타입 재정의(`jest.mocked(lookup)` → 명시적 오버로드 타입)는 기능 확장이 아니라 타입체크 ratchet 이 잡은 실제 타입 오류(3→4) 수정이며, 커밋 이력(`1e07cf5cf`)에 별도 커밋으로 분리돼 있어 "구현 변경에 무관한 수정이 섞임" 문제도 아니다.
- import 문 변경은 전부 파일 이동에 따른 경로 갱신뿐(`common/utils/smtp-host-guard` → `nodes/integration/send-email/smtp-host-guard`) — 사용하지 않는 임포트 추가/정리는 없음.
- `http-safety.ts` 파일 상단 JSDoc 확장(SMTP 도 이 구현을 공유한다는 서술 추가)은 plan 의 핵심 변경(SMTP 가드 통합)을 정확히 반영하는 필수 주석 갱신이며, 무관한 주석 편집이 아니다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커의 두 항목을 닫는 목적이 plan frontmatter 에 명시돼 있으나, 이 세션의 diff 에 그 트래커 파일 자체의 수정은 포함되어 있지 않다(체크리스트 마지막 항목 "트래커 두 항목 해소 … 이 plan `plan/complete/` 로"는 아직 미완료 `[ ]`로 남아 있어 이번 diff 범위와 일치).

## 요약

이번 diff 는 `plan/in-progress/ssrf-guard-integration-unify.md` 가 사전에 정의한 4개 항목(IPv4-mapped IPv6 판정 통일, SMTP 가드를 `http-safety` 기반으로 교체, phantom 주석 정정, 테스트 보강)에 정확히 대응하며, 파일 이동·주석 변경·설정 파일(`backend-typecheck-baseline.json`) 변경까지 전부 그 plan 문서 또는 커밋 이력에 근거가 명시돼 있다. 프롬프트가 크기 제한으로 생략한 4개 파일(`integrations.service.ts`/`.spec.ts`, `send-email.handler.ts`/`.spec.ts`)도 `git diff origin/main` 원본과 대조해 프롬프트 스니펫과 완전히 일치함을 확인했다 — 숨겨진 추가 변경 없음. 의도 이상의 리팩터링, 요청하지 않은 기능 추가, 무관한 파일 수정, 의미 없는 포맷팅 뒤섞임은 발견되지 않았다.

## 위험도

NONE
