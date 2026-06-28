# 문서화(Documentation) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix (2차 라운드)

## 발견사항

### [INFO] `.env.example` — `HOOKS_MAX_BODY_BYTES` 등재 확인 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/.env.example` L99–107
- 상세: 1차 리뷰(15_41_50) 및 consistency 검토에서 `.env.example` 미등재가 WARNING/INFO 로 지적됐으나, 실제 파일을 확인한 결과 L99–107 에 "Webhook route body-parser limit" 블록으로 `HOOKS_MAX_BODY_BYTES=1048576` 와 동작 설명이 이미 포함돼 있다. 이전 리뷰 산출물의 지적은 오탐에 해당하며 추가 조치 불필요.
- 제안: 없음.

### [INFO] `triggers.mdx` — 인증 webhook 1MB 한도 반영 확인 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/frontend/src/content/docs/02-nodes/triggers.mdx` L97
- 상세: consistency 검토의 명명 충돌 결과에서 "프론트엔드 사용자 문서 stale — 인증 webhook 1MB 한도를 '예정(Planned)'으로 기술"이라고 지적했으나, 실제 파일 L97에는 이미 "인증 webhook 은 **1MB**(초과 시 `413 PAYLOAD_TOO_LARGE`)"로 구현 완료 상태가 반영돼 있다. stale 지적은 오탐이다.
- 제안: 없음.

### [WARNING] `spec/5-system/12-webhook.md` `## Rationale` — WH-NF-02 옵션 C 결정 근거 미기재
- 위치: `spec/5-system/12-webhook.md` `## Rationale` 섹션 말미
- 상세: rationale_continuity 리뷰에서도 지적됐으나 코드 리뷰 관점에서 재확인: WH-NF-02 옵션 C(인증 webhook 1MB 라우트 스코프 분리) 채택과 기각된 대안(옵션 A: 전역 1MB; 옵션 B: 현행 박제)의 결정 근거가 `12-webhook.md ## Rationale` 에 없다. 구현 과정에서 확정된 세 기술 결정 — ① `bodyParser: false` + hooks 먼저 등록하는 순서 의존성, ② `HOOKS_MAX_BODY_BYTES_CEILING` 16MiB OOM 방지 클램프, ③ `req._body` 가드로 전역 재파싱 방지 — 이 plan 체크박스에만 존재하며 plan 이 `complete/` 로 이동되면 추적이 소실된다. 문서화 관점의 핵심 공백이다.
- 제안: `spec/5-system/12-webhook.md ## Rationale` 에 "WH-NF-02 옵션 C — 분리 임계 구현" 항을 추가하고 (a) 기각 옵션 A·B 요약, (b) `bodyParser: false` 순서 의존성, (c) `HOOKS_MAX_BODY_BYTES_CEILING` 근거를 기록한다.

### [WARNING] `spec/5-system/2-api-convention.md` · `3-error-handling.md` Rationale — `PAYLOAD_TOO_LARGE` 전역 표준 코드 등재 근거 미기재
- 위치: `spec/5-system/2-api-convention.md ## Rationale`; `spec/5-system/3-error-handling.md ## Rationale`
- 상세: `PAYLOAD_TOO_LARGE` 가 전역 표준 봉투 코드로 등재되고 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 공존하게 됐으나, 두 코드가 공존하는 이유(도메인 전용 vs 전역 표준 구분 기준)가 Rationale 에 없다. 향후 유지보수자가 유사한 상황에서 잘못된 패턴을 선택할 위험이 있다.
- 제안: 두 spec 의 Rationale 에 "413 `PAYLOAD_TOO_LARGE` 를 전역 표준 봉투 코드로 등재하고 도메인 전용 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 공존하는 이유"를 1~2행으로 추가.

### [INFO] `captureRawBody` 인라인 주석 — `buf.length` 체크 재도입 방지 주석 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` L73
- 상세: `if (buf) {` 라인에 `// 빈 Buffer(length===0)도 세팅 — 빈 본문 서명 검증을 위해. buf.length 체크 재도입 금지.` 인라인 주석이 이미 있다. 1차 문서화 리뷰(15_41_50)에서 이 주석의 추가를 권장했는데 이미 반영된 상태다.
- 제안: 없음. 조치 완료 확인.

### [INFO] `hooks-body-parser.ts` — 공개 API 상수·함수 JSDoc 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts`
- 상세: `HOOKS_ROUTE_PREFIX`, `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING`, `GLOBAL_MAX_BODY_BYTES`, `resolveHooksMaxBodyBytes`, `createHooksBodyParsers` 모두 JSDoc 을 보유하며 spec 참조(WH-NF-02), env override 범위, 순서 의존성까지 명시한다. 비공개 함수 `captureRawBody`·`buildBodyParsers` 는 의도 설명과 인라인 주석이 충분하다.
- 제안: 없음.

### [INFO] `spec/5-system/12-webhook.md` frontmatter `code:` — `hooks-body-parser.ts` 미등재
- 위치: `spec/5-system/12-webhook.md` frontmatter `code:` 배열
- 상세: WH-NF-02 구현 핵심 파일인 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 가 spec frontmatter `code:` 목록에 없다. spec-coverage 도구가 이 파일과 webhook spec 간 연결을 추적하지 못하게 된다. cross_spec 리뷰에서도 동일 지적이 있었다.
- 제안: `spec/5-system/12-webhook.md` frontmatter `code:` 에 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 추가.

### [INFO] e2e 파일 상단 JSDoc — 본문 크기 경계 케이스(J/K/L/M/N) 미반영
- 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 파일 상단 JSDoc 블록
- 상세: 파일 상단 JSDoc 이 이번에 추가된 본문 크기 경계 케이스(J: 512KB HMAC 통과, K: >1MB 413, L: 공개 32KB 초과 413, M: 인증 >1MB 413, N: non-webhook 100KB 초과 413)를 나열하지 않는다. 1차 문서화 리뷰(15_41_50)에서 동일 항목을 지적했으나 이 라운드 diff 에도 미반영이다.
- 제안: 파일 상단 JSDoc 에 "본문 크기 경계(WH-NF-02 옵션 C): 인증 webhook 512KB 통과 / >1MB 413 PAYLOAD_TOO_LARGE / 공개 32KB 초과 413 PUBLIC_WEBHOOK_BODY_TOO_LARGE / non-webhook 100KB 초과 413" 항목 추가.

### [INFO] `http-exception.filter.spec.ts` — 파일 상단 모듈 설명 주석 없음
- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` L1
- 상세: 신규 단위 테스트 파일에 파일 수준 커버 범위 설명 주석이 없다. 1차 리뷰(15_41_50)에서 동일 항목을 선택적 권장으로 지적했으나 미반영이다.
- 제안: 선택적. 파일 상단에 한 줄 주석 추가 고려.

### [INFO] `spec/data-flow/10-triggers.md` L98 — "인증 webhook 무제한 통과" 표현 oualifier 부재
- 위치: `spec/data-flow/10-triggers.md` L98
- 상세: cross_spec 리뷰에서 지적된 사항. Guard 범위에서 인증 webhook 이 무제한 통과하는 것은 사실이나, WH-NF-02 구현 이후 1MB body-parser 게이트가 추가됐음이 이 문서에 미반영돼 있어 오독 여지가 있다.
- 제안: "인증 webhook 은 이 Guard(IP rate-limit + 32KB 본문)를 무제한 통과(본문 크기는 `/api/hooks/*` 라우트 스코프 1MB body-parser 가 별도 게이트, SoT: Spec Webhook WH-NF-02)"로 qualifier 추가.

### [INFO] `spec/7-channel-web-chat/4-security.md` §4 L143 — "무제한 통과" 표현 동기화 권장
- 위치: `spec/7-channel-web-chat/4-security.md` L143
- 상세: rate-limit 맥락에서 "인증 webhook(서버-to-서버)은 무제한 통과한다"로 기술되어 있으며, 동 §4 에 "body 32KB: webhook gate 구현됨 v1" 내용이 혼재해 인증 webhook 의 1MB body 게이트가 언급되지 않으면 body 제한도 없다는 오독 가능성이 있다.
- 제안: rate-limit 주석에 "rate-limit 에 한함. 본문 크기는 라우트 스코프 body-parser 별도 게이트(SoT: Spec Webhook WH-NF-02)" 단서 추가.

---

## 요약

이번 2차 라운드 리뷰에서 문서화 품질의 전반적인 수준은 1차 라운드 평가와 동일하게 우수하다. `.env.example` 의 `HOOKS_MAX_BODY_BYTES` 등재와 `triggers.mdx` 의 인증 webhook 1MB 한도 반영은 이미 완료된 것으로 확인돼 consistency 리뷰의 일부 지적이 오탐임을 정정한다. `captureRawBody` 의 `buf.length` 체크 재도입 방지 인라인 주석도 이미 추가돼 있다. 핵심 미흡 사항은 두 가지 WARNING 이다: `spec/5-system/12-webhook.md ## Rationale` 에 WH-NF-02 옵션 C 결정 근거(기각 대안 포함)가 없어 plan 이 `complete/` 로 이동된 후 결정 추적이 소실될 위험이 있으며, `2-api-convention.md` 와 `3-error-handling.md` 의 Rationale 에도 `PAYLOAD_TOO_LARGE` 전역 표준 코드 등재 근거가 없다. spec frontmatter `code:` 목록의 `hooks-body-parser.ts` 미등재, e2e 파일 JSDoc 의 신규 케이스 미반영, data-flow·channel-web-chat spec 의 "무제한 통과" 표현 qualifier 부재는 INFO 수준 개선 여지다.

---

## 위험도

LOW

STATUS: SUCCESS
