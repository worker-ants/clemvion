# 변경 범위(Scope) 리뷰 — SSRF 가드 통합 3라운드 누적 diff (smtp-ssrf-cgnat-8d41b2)

## 검토 방법

`git diff --stat origin/main...HEAD` 로 이 브랜치의 전체 누적 diff(커밋 `a14fb8f8f`~`bb4c5381b`, 54개 파일)를 직접 확인하고,
프롬프트가 크기 제한으로 생략한 `http-safety.ts` 전문은 `git diff origin/main...HEAD -- <path>` 로 별도 조회했다.
`plan/in-progress/ssrf-guard-integration-unify.md` 가 정의한 작업 범위(①IPv4-mapped IPv6를 품은 IPv4 대역으로 판정 통일,
②SMTP 가드를 `ssrf.util` 대신 `http-safety` 기반으로 교체, ③phantom 주석 정정, ④테스트 보강)와, 이미 완료된 1·2라운드
`/ai-review` RESOLUTION.md 의 조치 항목 전부를 대조했다. 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 결과
`review/code/2026/09/19/22_24_32/`(이번 세션 산출물) 외 변경 없음 — 세션 시작 시점과 동일, 뮤테이션 없음).

## 발견사항

- **[INFO]** 문서(`.mdx` ko/en) 변경이 plan 의 4개 항목 목록에 명시적으로 없었지만, 2라운드 리뷰(`review/code/2026/09/19/22_00_32`)의
  WARNING(가이드가 Database·HTTP 만 적고 Email 을 빠뜨림)에 대한 조치로 추가됐다 — 범위 이탈 아님
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx:69`,
    `integration-management.mdx:80`
  - 상세: 두 파일 모두 "Database and HTTP" → "Database, HTTP and Email (SMTP)" + CGNAT 언급을 추가했다. plan 본문에는 문서 갱신이
    명시돼 있지 않았으나, CLAUDE.md 는 구현 완료 후 `/ai-review` critical/warning 조치를 "상시 승인된 강제 의무"로 규정하고,
    2라운드 RESOLUTION.md(`W1`)가 이 조치의 근거·커밋(`fce34b77b`)을 명시한다. 또한 이 문서가 서술하는 차단 대상(Email/SMTP)은
    이번 PR 이 실제로 바꾼 동작(SMTP 가드가 이제 CGNAT 도 막는다)과 직접 연결돼 있어, 무관한 문서 손질이 아니라 이번 변경이
    부정확하게 만든 서술을 바로잡은 것이다.
  - 제안: 조치 불필요 — 정상적인 리뷰-수렴 흐름.

- **[INFO]** `scripts/backend-typecheck-baseline.json` 변경(197→194)은 이번 diff 가 추가한 테스트 파일의 타입 오류를 해소한
  결과이지, 무관한 설정 변경이 아니다
  - 위치: `scripts/backend-typecheck-baseline.json` (해당 diff는 프롬프트에 스니펫 없이 파일만 나열됨)
  - 상세: 원인은 이번 PR 자신이 만든 `http-safety.spec.ts` 의 `mockedLookup` 타입 정의 변경(`jest.mocked(lookup)` → 명시적
    오버로드 타입)이며, ratchet baseline 은 총량을 낮추는 방향(자동 생성 파일, 손 편집 아님)이라 §8 설정 변경 위험 기준에
    해당하지 않는다. 1라운드 scope 리뷰(`review/code/2026/09/19/21_38_32/scope.md`)가 이미 같은 결론을 냈고, 이번 3라운드
    diff 에서 그 파일의 추가 변경은 없다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 4개 백로그 항목은 실제 코드 변경이 아니라
  이번 작업이 "비대상"으로 명시적으로 유예한 결정(`ssrf.util`의 CGNAT/`::` · `http-safety.ts` 폴더 위치 · 소비자 넷의
  `instanceof` 통일 · 기존 spec drift 4건)을 등재한 것 — plan 본문·RESOLUTION.md 조치 항목과 1:1 대응, 임의 확장 아님
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4891`~`4917`
  - 상세: CLAUDE.md 는 유예된 항목을 "그 턴에 plan/" 등재하도록 요구한다(`feedback_review_fix_stale_loop.md`). 네 항목 모두
    이번 PR 이 스스로 발견했지만 의도적으로 범위 밖(제품 판단 필요·별도 planner 턴 필요·수렴 예외)으로 둔 것들과 정확히
    대응하며, 코드 변경은 수반하지 않는다.
  - 제안: 조치 불필요.

## 점검했으나 범위 이탈 없음 (양성 확인)

- **핵심 로직 변경**: `http-safety.ts`(`git diff` 전문 직접 확인) 는 `SsrfBlockedError` 클래스 도입 + `canonicalIPv6`/`mappedIPv4`
  두 헬퍼 추가 + `isBlockedIPv6` 내부 최소 수정뿐이다. 기존 `PRIVATE_V4_RANGES`·`assertSafeOutboundUrl`/
  `assertSafeOutboundHostResolved` 시그니처·export 표면은 그대로다. CGNAT 대역 자체는 이번 diff 가 새로 추가한 것이 아니라
  (plan 실측표: `100.64.0.1` 은 원래도 `http-safety` 에서 "막음") IPv4-mapped 판정만 신규다 — plan 항목 1과 정확히 일치.
- **SMTP 가드 교체**: `smtp-host-guard.ts` 가 `common/utils` 에서 삭제되고 `nodes/integration/send-email/` 로 신설되며
  구현이 `ssrf.util` 호출에서 `assertSafeOutboundHostResolved` 호출로 바뀐 것은 plan 항목 2와 정확히 일치. 호출부 4곳
  (`integrations.service.ts:13`, `integrations.service.spec.ts:27`, `send-email.handler.ts:24`,
  `send-email.handler.spec.ts:4`) 모두 새 경로로 동반 갱신됐고 옛 경로 참조는 남지 않았다.
- **주석 정정**: `integrations.service.ts:1594`~`1596`, `send-email.handler.ts:176`~`178` 의 "`SMTP_BLOCK_PRIVATE_HOSTS`
  opt-in"(존재한 적 없는 phantom 플래그) → "`ALLOW_PRIVATE_HOST_TARGETS=true` 로만 끄는 opt-out, 기본 ON" 정정은 plan 항목
  3과 정확히 일치하며, 두 파일 모두 이 주석 블록과 import 경로 한 줄 외 본문 변경이 없다.
  `http-safety.ts` 헤더 JSDoc 확장(“Send Email 도 이 구현을 공유한다”·한국어 문단으로 폴더 위치 사유 설명)도 이번 변경의
  핵심을 정확히 반영하는 필수 주석 갱신이다.
- **테스트**: `http-safety.spec.ts`(mapped 판정 14케이스 + 대조군 4 + 정규화 폴백 2 + 공인 대상 4 + 통합 테스트 5),
  `smtp-host-guard.spec.ts`(신규, CGNAT·`::`·mapped·opt-out·오류 재던짐), e2e `integration-connection-test.e2e-spec.ts`
  B2(HTTP/DB/Email 3케이스) 는 모두 plan 항목 4가 예고한 형태와 1:1 대응하며, 그 이상의 임의 테스트 확장은 없다.
- **CHANGELOG·`.env.example`**: 1라운드 WARNING(보안 동작 변경인데 CHANGELOG 없음 · `.env.example` 헤더가 Send Email 을
  빠뜨림)에 대한 조치로, RESOLUTION.md 가 해당 커밋(`a1e1a591b`)을 명시한다 — 무관한 설정/문서 손질이 아니라 이 PR 이
  일으킨 배포 영향의 정직한 기록이다.
- **`review/**`·`review/consistency/**` 신규 파일 전부**: CLAUDE.md 가 의무화한 `--impl-prep` consistency-check 산출물과
  `/ai-review` 1·2라운드 산출물(SUMMARY/RESOLUTION/agent reports/meta.json/`_retry_state.json`)이며, 이번 3라운드 리뷰가
  대상으로 삼는 diff 자체에 포함된 것은 이 harness 규약이 요구하는 표준 흐름이지 범위 이탈이 아니다.
- **미착수로 남긴 구조적 지적**: 1라운드 architecture WARNING("`http-safety.ts` 가 `http-request/` 폴더 안에 있다")은 spec
  frontmatter `code:` 경로와 동반 변경이 필요해 planner 턴으로 트래커에 넘겼고, 2라운드 architecture WARNING("소비자 넷의
  catch 가 `instanceof` 아님")은 동작 차이가 없는 수렴 예외로 처리하고 트래커에 등재했다 — 둘 다 방치가 아니라 문서화된
  유예이며, 스코프 확장(임의로 더 큰 리팩터를 끌어들임)을 하지 않은 것 자체가 올바른 판단이다.

## 요약

이 브랜치의 3라운드 누적 diff(54개 파일)는 `plan/in-progress/ssrf-guard-integration-unify.md` 가 사전에 정의한 4개 항목에
정확히 대응하는 핵심 코드 변경(`http-safety.ts`의 IPv4-mapped IPv6 판정 통일, SMTP 가드의 `http-safety` 기반 교체, phantom
주석 정정, 테스트 보강)과, 그 위에 1·2라운드 `/ai-review`가 지적한 CRITICAL/WARNING 에 대한 조치(에러 클래스화, CHANGELOG·
`.env.example`·통합 가이드 문서 갱신, 정규화 폴백 테스트 보강, 트래커 등재)로만 구성된다. `git diff` 전문을 직접 대조한
결과 프롬프트 스니펫과 실제 변경 사이에 숨겨진 추가 변경은 없었고, 의도 이상의 리팩터링·요청하지 않은 기능 확장·무관한
파일 수정·의미 없는 포맷팅 뒤섞임·불필요한 임포트/주석 변경은 발견되지 않았다. 문서(`mdx`)·설정(`backend-typecheck-baseline.json`)·
plan 백로그 항목처럼 plan 본문에 직접 명시되지 않은 부수 변경들도 전부 이번 변경이 유발한 사실 관계 갱신이거나 프로젝트가
표준으로 요구하는 리뷰-수렴/harness 산출물이어서 범위 이탈로 보지 않는다.

## 위험도
NONE
