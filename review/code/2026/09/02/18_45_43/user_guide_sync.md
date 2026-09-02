# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 적재한 SSOT

- `.claude/config/doc-sync-matrix.json` — `rows[]` 20건 Read
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표 + §자주 누락되는 항목 보조 (전 라운드 리뷰 산출물과 대조로 갈음)

## 변경 범위 확정

이번 리뷰 대상 changeset 은 `git diff 6ffadb1f4 HEAD`(spec 결정 커밋 이후 ~ 현재 `1bd2000d5`, 3개 커밋:
`b019d7de3` feat + `a9316a0a6` 리뷰 1R fix + `1bd2000d5` 리뷰 2R fix)로 62개 파일이며, prompt 의 파일
목록(파일 1~62)과 파일명 diff 로 정확히 일치함을 확인했다(`git diff --name-only` vs prompt 파일 목록,
차이 0). 즉 이번 라운드는 WS 소켓 수명↔토큰 수명 종속 기능(`auth.token_expired`)의 **누적 changeset
전체**(구현 + 지난 두 리뷰 라운드의 fix)를 대상으로 한다.

핵심 코드: `websocket-events.types.ts`(신규 `AuthEventType`/`AuthTokenExpiredPayload`),
`websocket.gateway.ts`(신규 만료 타이머), `ws-client.ts`(신규 구독·재핸드셰이크). 나머지는 그 테스트,
CHANGELOG, plan 문서, `review/**` 프로세스 아티팩트.

## 발견사항

- **[INFO]** `auth-session-flow-change` trigger 매칭 확인 — 이전 두 라운드가 지적한 동반 갱신 누락이
  **이번 changeset 안에서 이미 해소됨** (신규 결함 아님, 확인 기록 목적)
  - 변경 파일: `codebase/backend/src/modules/websocket/websocket.gateway.ts`(`armExpiryTimers`/
    `TOKEN_EXPIRY_LEAD_MS`), `codebase/frontend/src/lib/websocket/ws-client.ts`(`refreshAndReconnect`)
  - 매트릭스 항목: `doc-sync-matrix.json` row `auth-session-flow-change`(`trigger.match:"semantic"`,
    glob 은 `codebase/backend/src/modules/auth/**` 이지만 semantic 이므로 경로가 아니라 "인증·권한·
    세션 흐름 변경"이라는 의미로 매칭 — 이 변경은 텍스트북 사례). targets: `"codebase/frontend/src/
    content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"`.
  - 확인한 것:
    1. **docs 양쪽 로케일** — `codebase/frontend/src/content/docs/07-workspace-and-team/
       password-and-sessions.mdx`(+`.en.mdx`) 에 동일 내용의 Callout 이 **양쪽 다** 추가됐다
       (`git diff --stat` 확인: 두 파일 각 +8줄). 내용도 실제 구현과 부합 — "실시간 연결은
       로그인 갱신 시 자동 재연결"(=`auth.token_expired` 사전 통지 + 재핸드셰이크, §9.2) +
       "다른 기기 로그아웃 시 그 기기의 실시간 화면은 최대 15분 안에 끊김"(=access token TTL
       900초 상한, revoke 는 refresh family 만 무효화하고 그 소켓은 자연 `exp` 까지 산다는
       카브아웃의 사용자 표현 — `TOKEN_EXPIRY_LEAD_MS`/access token TTL 실측과 일치, "최대"라는
       상한 표현이라 실제 소켓 발급 후 경과 시간에 관계없이 참).
    2. **e2e** — 여전히 이번 changeset 에 없다. 다만 지난 라운드(`18_18_53/user_guide_sync.md`)가
       "유예 근거가 `review/**`(SoT 아님)에만 있어 다음 사람이 재발견해야 한다"고 지적한 정보
       유실 위험은 해소됐다 — `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트에
       "e2e — 유예. 근거를 여기 적는다(`review/**` 는 SoT 가 아니다, 2R W5)" 항목이 신설되어
       유예 이유(현 e2e 하네스가 boot-only 게이트라 런타임 토큰 TTL 주입 표면이 없음)와 **재개
       신호**(하네스에 런타임 설정 주입이 생기거나 이 경로의 회귀가 실제 관측될 때)를 명시한다.
       이는 "조용한 누락"이 아니라 이 저장소의 확립된 유예 등재 관례(측정 가능한 근거 + 재개
       신호를 SoT 인 `plan/`에 기록)를 그대로 따른 것이다.
  - 결론: docs 쪽은 **완전히** 동반 갱신됐고, e2e 쪽은 **의도적·근거 있는 유예**로 SoT 에 적절히
    등재돼 있어 이번 라운드에서 추가로 지적할 결함이 없다. 조치 불요.

- **[INFO]** `run-debug-flow-change` grey-zone 재확인 — 여전히 결론 없음(회색 지대), 상태 변화 없음
  - 변경 파일: `codebase/frontend/src/lib/websocket/ws-client.ts`
  - 매트릭스 항목: `run-debug-flow-change`(semantic) — targets: `codebase/frontend/src/content/docs/
    05-run-and-debug/`
  - 상세: 1R 리뷰가 이미 "이 WS 재연결 로직이 기존 `use-execution-events.ts` 의 realtime-fallback
    toast 노출 빈도에 간접 영향을 줄 수 있으나, `05-run-and-debug/*.mdx` 는 애초에 그 fallback 동작을
    문서화하지 않고 있어 이번 PR 이 새로 '문서화된 계약'을 깬 것은 아니다"로 판단했다(INFO, 조치
    불요). 이번 changeset(2R) 에 이 판단을 바꿀 만한 추가 변경이 없어 동일하게 grey-zone 유지.
  - 제안: 조치 불요.

## 매칭했으나 이상 없음으로 판단한 항목 (참고)

- `new-node`/`node-schema-change` — `codebase/backend/src/nodes/**` 변경 없음(전수 `git diff` 확인, 0건)
- `new-ui-string` — `.tsx` 변경 없음(전부 `.ts`/`.md`/`.json`/`.mdx`)
- `new-warning-code`/`new-error-code` — `error-codes.ts`/`ws-error-codes.ts`/warningRules 변경 없음(전수 확인)
- i18n dict / `backend-labels.ts` — `codebase/frontend/src/lib/i18n/**` 변경 0건(`git diff --stat` 확인).
  `auth.token_expired` payload 의 `message` 필드는 `ws-client.ts` 가 소비하지 않고(재핸드셰이크
  트리거로만 사용) 렌더링되지 않으므로 dict/backend-labels 대상 아님
- `new-userguide-section-dir` — `content/docs/` 신규 디렉토리 없음(기존 `07-workspace-and-team/` 안의
  기존 파일에 Callout 추가일 뿐) → `locale.ts` `SECTION_LABELS_BY_LOCALE` 갱신 불필요
- `integration-provider-change`/`expression-language-change`/`new-bullmq-queue`/spec 관련 행 —
  대상 경로(`06-integrations-and-config/`, `packages/expression-engine/**`,
  `system-status.constants.ts`, `spec/**`) 모두 이번 changeset 밖

## 요약

매트릭스 20개 trigger 중 이번 누적 changeset(62개 파일, `6ffadb1f4..HEAD`)에 실제로 매칭된 것은 1개 —
`auth-session-flow-change`(WS 소켓 수명↔토큰 수명 종속) — 이며, 그 target(07-workspace-and-team 가이드
+ e2e)에 대해 docs 는 ko/en 양쪽 완전히 동반 갱신됐고 e2e 는 측정된 근거·재개 신호와 함께 plan(SoT)에
적절히 유예 등재됐다. 지난 두 라운드(`17_38_12`, `18_18_53`)가 반복 지적한 "가이드·e2e 동반 갱신 누락"
WARNING 은 이번 2R fix 커밋에서 해소됐다. CRITICAL 등급 trigger(i18n parity, warning/error code ko
매핑, 신규 섹션 디렉토리 locale 등록)는 대상 파일이 changeset 에 없어 매칭되지 않았다. 신규로 지적할
동반 갱신 누락은 없다.

## 위험도

NONE
