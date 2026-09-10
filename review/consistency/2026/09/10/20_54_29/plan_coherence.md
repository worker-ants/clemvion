# Plan 정합성 검토 — target: `spec/7-channel-web-chat`

## 검토 개요

이 PR 의 실제 구현 diff(3파일/48줄)는 `spec/7-channel-web-chat` 범위와 무관한 **의존성 버전
상향**이다 (`codebase/backend/package.json`: `csv-parse` `^7.0.1→^7.0.2`, `nodemailer`
`^9.0.5→^9.1.1` / `codebase/channel-web-chat/package.json`, `codebase/frontend/package.json`:
`next` `^16.2.12→^16.3.3`). target scope 의 spec 델타는 0개 파일이며, 이는 프롬프트가 명시한
대로 코드 전용 PR 에서 정상이다.

이 변경을 뒷받침하는 작업 plan 은 `plan/in-progress/deps-audit-floor-refresh-2026-09.md`
(status: in-progress, owner: developer, `spec_impact: none`) 이며, `spec/7-channel-web-chat`
을 포함해 어떤 spec 영역에도 영향을 선언하지 않았다 — 이 PR 자체의 성격(보안 override 바닥
갱신 + 직접 의존 상향)과 일치한다.

## 발견사항

없음.

- **미해결 결정과의 충돌**: 없음. `deps-audit-floor-refresh-2026-09.md` · `deps-guard-hardening.md`
  두 plan 모두 "결정 필요"로 남긴 항목(`grep '결정 필요|미해결|TBD|보류'`)이 없고, 이번 PR 의
  버전 상향(`next`·`nodemailer`·`csv-parse`)은 두 plan 이 실측 근거(CVE advisory·override 바닥
  표)와 함께 명시적으로 결정한 항목이다.
- **선행 plan 미해소**: 없음. `deps-guard-hardening.md` 의 P3 후속 항목(libc: 필드 진동,
  `check-pnpm-security-config.py` 전용 테스트 부재)은 이번 PR 의 실측(pnpm 10.34.5 재해소 결과)을
  이미 인용해 갱신돼 있고, 이번 PR 이 그 후속을 선행 조건으로 가정하지도 않는다(별도 PR 판단으로
  명시적으로 분리됨).
- **후속 항목 누락**: 없음. `deps-audit-floor-refresh-2026-09.md` §2.5 는 `/ai-review` 라운드
  1 의 WARNING(INFO 6: `check-pnpm-security-config.py` 테스트 부재)을 `deps-guard-hardening.md`
  로 정확히 이관해 등재했고, `#1301`(csv-parse dependabot PR) 흡수·자동 종료 경로도 체크리스트에
  반영돼 있다. `spec/7-channel-web-chat` 관련 in-progress plan(`webchat-*.md`,
  `chat-channel-*.md`) 중 `package.json`/`next` 버전을 참조하는 항목은 없어(grep 0건), 이번
  minor 버전 상향이 무효화하거나 새로 만들어야 하는 후속은 확인되지 않는다.
- spec 문서(`spec/7-channel-web-chat/1-widget-app.md` §R4, `_product-overview.md`)는 "Next.js
  CSR 전용" 이라는 아키텍처만 선언하고 구체적 버전을 고정하지 않으므로, 이번 minor 버전 상향은
  spec 이 선언한 어떤 제약과도 충돌하지 않는다.

## 요약

Plan 정합성 관점에서 이번 변경은 `spec/7-channel-web-chat` 과 직접 접점이 없는 순수 의존성
버전 상향이며, 그 배경 plan(`deps-audit-floor-refresh-2026-09.md`)은 자신이 남긴 후속(P3
libc/테스트 갭)을 `deps-guard-hardening.md` 로 정확히 이관·교차참조해 두었다. 미해결 결정을
우회한 정황, target 이 가정하는 미해소 선행 조건, 후속 plan 무효화·누락 모두 발견되지 않았다.

## 위험도

NONE
