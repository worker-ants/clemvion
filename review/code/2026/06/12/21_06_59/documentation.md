# 문서화(Documentation) 리뷰 — refactor-04-security (3차 라운드)

이전 라운드(20:32:29)의 documentation.md 에서 식별된 WARNING 1건(`clearRefreshTokenCookie` 경고 주석 부재)과
INFO 1건(`setRefreshTokenCookie` JSDoc 누락)이 이번 라운드 커밋에 반영됐는지 확인한다.
아울러 이번 diff 에 포함된 review/code·consistency 산출물 파일들, plan 문서 등 변경 전체를 문서화
관점에서 추가 검토한다.

---

## 발견사항

### [INFO] `clearRefreshTokenCookie` — 이전 라운드 WARNING 해소 확인
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` L52-55
- 상세: 이전 documentation.md(20:32:29)의 WARNING("set/clear 경로 일치 제약 경고 주석 부재")이
  현재 코드에 JSDoc 블록으로 정확히 반영됐다. `/** ... **중요**: path 는 ... 반드시 일치해야
  한다 — 불일치 시 브라우저가 쿠키를 삭제하지 못해 logout 후에도 쿠키가 잔존한다(silent
  failure). */` 형태의 JSDoc 으로 명시됐다. 처리 완료.
- 제안: 없음.

### [INFO] `setRefreshTokenCookie` — JSDoc 여전히 부재 (이전 라운드 INFO 미해소)
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` L33-50
- 상세: 이전 라운드에서 INFO 로 지적된 `setRefreshTokenCookie` JSDoc 누락이 이번 커밋에서도
  추가되지 않았다. `options.rememberMe`, `options.cookieDomain` 파라미터의 의미, `/api/auth`
  path 한정 부작용, `SameSite=None` 시 `Secure` 강제 동작이 호출부에서 즉각 파악하기 어렵다.
  이전 라운드 INFO 수준으로 기능 동작 무관이나 공개 함수 문서화 미완 상태가 지속된다.
- 제안: `setRefreshTokenCookie` 상단에 `@param res`, `@param token`, `@param options.rememberMe`
  (remember-me 에 따른 maxAge 분기), `@param options.cookieDomain` (도메인 스코프),
  `@remarks` (path 한정·SameSite 정책) 수준의 JSDoc 추가.

### [INFO] `websocket.gateway.ts` — `channelAuthorizers` 인터페이스 주석의 `Promise.resolve` 래핑 의도 이미 명시 (이전 라운드 WARNING 해소 확인)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L77-92
- 상세: 이전 라운드의 maintainability/documentation WARNING("Promise.resolve 래핑 의도 미문서화")이
  `channelAuthorizers` JSDoc 블록 내 "`authorize` 반환은 항상 Promise — 동기 판별(예: notifications)도
  `Promise.resolve(...)` 로 감싸 시그니처를 통일한다(호출부의 `await` 단일화)." 문장으로 반영됐다.
  처리 완료.
- 제안: 없음.

### [INFO] README.md — 신규 환경변수 3종 문서화 이미 반영됨 (이전 라운드 WARNING 해소 확인)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/README.md` L197-211
- 상세: 이전 라운드 및 user_guide_sync WARNING 에서 지적된 "README.md `## 환경 변수` 신규 3종
  (`ENABLE_SWAGGER_IN_PROD`, `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP`) 누락"이
  이번 커밋 diff 에 포함된 README 블록에서 해소됐다. 세 변수 모두 `# Security` 항목 아래에
  기본값·동작·보안 상충관계를 설명하는 주석과 함께 등재돼 있다. 처리 완료.
- 제안: 없음.

### [INFO] review/consistency/2026/06/12/20_50_19/SUMMARY.md — Resolution 섹션 문서화 완전성
- 위치: `review/consistency/2026/06/12/20_50_19/SUMMARY.md`
- 상세: SUMMARY.md 의 `## Resolution` 블록이 Critical 1·2 해소 근거(Critical #1 수정 완료,
  Critical #2 오탐 확정 + 573 tests PASS 검증)와 WARNING 처리 현황을 체계적으로 기록했다.
  보류 항목(W6/W7/W8)도 cross-plan 주석으로 이유를 명시해 후속 담당자가 맥락을 파악할 수 있다.
  문서화 품질 우수.
- 제안: 없음.

### [INFO] `condition-evaluator.util.ts` — `MAX_REGEX_LENGTH` 상수 JSDoc 에 선정 근거 보강 미완
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` L37-41
- 상세: 이전 라운드 maintainability INFO 에서 "`MAX_REGEX_LENGTH = 200` 선정 근거를 상수 JSDoc 에 한 줄
  추가하면 값 변경 시 판단 기준이 명확해진다"고 지적했다. 현재 JSDoc(`Cap on user-authored regex
  pattern length to mitigate ReDoS exposure. Mirrored by ...`)은 목적을 기술하지만 "200" 값
  자체의 선정 근거(safe-regex 와 2차 방어 관계, 기존 조건 평가 노드 규약 계승)는 여전히 없다.
  기능 무관 INFO 수준 미비사항이다.
- 제안: JSDoc 에 `* 200자 기준은 기존 switch/filter/transform 노드 규약을 계승; safe-regex 가 1차
  방어, 길이 상한은 AST 분석 한계(alternation-overlap 등)를 보완하는 2차 방어.` 한 줄 추가.

### [INFO] `safe-html.ts` — `ALLOWED_URI_REGEXP` 세 번째 대안 의도 주석 미완
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`
- 상세: security.md, maintainability.md 에서 공통 지적: `ALLOWED_URI_REGEXP` 의 세 번째 대안
  `[a-z+.-]+(?:[^a-z+.:-]|$)` 이 relative URL/anchor 를 허용하기 위한 패턴임을 설명하는
  인라인 주석이 없다. 향후 URI scheme 목록 수정 시 이 패턴의 의도를 모르면 실수로 제거하거나
  위험한 scheme 을 허용하는 오수정이 발생할 수 있다.
- 제안: 패턴 정의 옆에 `// relative URL / anchor (#hash, /path, ?query) 허용` 주석 1줄 추가.

### [INFO] `client-ip.ts` — `extractClientIp` 의 암묵적 `process.env` 의존 문서화 미완
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` L34-37
- 상세: side_effect.md WARNING 에서 지적: `shouldTrustCfConnectingIp()` 를 인자 없이 호출해
  `process.env` 전역에 암묵적으로 의존한다. 현재 `extractClientIp` JSDoc 의 SECURITY 블록은
  보안 의도를 잘 설명하나, 테스트에서 `process.env.TRUST_CF_CONNECTING_IP` 를 직접 조작해야
  하는 테스트 격리 부작용이 함수 레벨 문서에 언급되지 않는다.
- 제안: `extractClientIp` JSDoc 에 `@remarks process.env.TRUST_CF_CONNECTING_IP 에 암묵 의존 —
  테스트 격리 시 직접 조작 또는 서명 확장(env = process.env 기본값) 고려.` 한 줄 추가.
  또는 side_effect.md 제안대로 `extractClientIp(req, env = process.env)` 로 서명 확장.

### [INFO] spec 갱신 항목 — 이번 라운드 diff 내 spec-draft plan 문서 포함
- 위치: `plan/in-progress/spec-draft-refactor-04-security-drift.md` (추정)
- 상세: consistency_check SUMMARY 의 Resolution 이 spec/1-data-model.md §2.18.1 `ip_address`
  설명 정정, websocket §3.3 권한 검증 단락 채널 목록 갱신, swagger.md Rationale 신설을 완료했다고
  기록한다. 이전 라운드의 SPEC-DRIFT 4건(W1~W4) + refresh cookie path WARNING(W10) 모두
  spec-draft plan 에서 처리돼야 한다. 본 diff 에 해당 spec 파일 변경이 포함됐는지 planner 가
  최종 확인해야 한다.
- 제안: planner 위임 확인.

---

## 요약

이번 3차 라운드(21:06:59) diff 는 이전 두 라운드에서 지적된 주요 문서화 이슈의 해소를 확인시켜 준다.
가장 중요했던 `clearRefreshTokenCookie` 경고 주석(이전 WARNING)은 JSDoc 블록으로 정식 반영됐고,
`channelAuthorizers` 의 `Promise.resolve` 래핑 의도(이전 WARNING)도 JSDoc 에 기술됐다.
README.md 신규 환경변수 3종(이전 WARNING)도 `# Security` 섹션에 완전히 문서화됐다.
잔여 미비사항은 모두 INFO 수준이다: `setRefreshTokenCookie` JSDoc 부재(이전 라운드 INFO 미해소),
`MAX_REGEX_LENGTH` 선정 근거 주석 미완, `ALLOWED_URI_REGEXP` 세 번째 대안 의도 주석 미완,
`extractClientIp` 의 암묵적 `process.env` 의존 문서화 미완. spec 갱신 후행 항목은 planner 위임.

## 위험도

LOW

STATUS=success ISSUES=1
