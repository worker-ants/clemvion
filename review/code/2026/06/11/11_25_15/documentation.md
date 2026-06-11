# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `production-guards.ts` — 파일 수준 JSDoc 에 `@param` 보완 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` 파일 헤더 + `assertProductionConfig` JSDoc
- 상세: 파일 수준 블록 주석(lines 1–25)과 함수 JSDoc(lines 63–66)은 존재하며 내용이 충실하다. `assertProductionConfig` 는 `@param env` 가 있으나 `@throws` 태그가 없다. 이 함수는 실패 시 `Error` 를 throw 하므로, 테스트·호출자 작성 시 에러 경계를 파악할 수 있도록 `@throws {Error} production fail-closed 가드 위반 시` 태그 추가를 고려한다.
- 제안: `assertProductionConfig` JSDoc 에 `@throws {Error} production 에서 위반 항목 발견 시 기동 거부 메시지와 함께 throw` 1줄 추가.

---

### [INFO] `production-guards.ts` — `isFlagOn` 함수 JSDoc 에 `@returns` 미기술
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` lines 51–57
- 상세: `isFlagOn` 은 JSDoc 주석이 있으나 `@param value` 및 `@returns` 태그가 없다. 이 함수는 `main.ts` 의 warn 정책에서도 재사용될 예정임이 주석에 명시돼 있어 공개 API 에 준하는 문서가 필요하다.
- 제안: `@param {string | undefined} value 환경변수 값` 및 `@returns {boolean} `'true'` 또는 `'1'` 이면 true, 그 외 false` 추가.

---

### [INFO] `INSECURE_JWT_SECRETS` / `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 상수 — 동기화 의무가 주석에만 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` lines 27–48
- 상세: 두 상수 모두 "**동기화 의무**" 를 JSDoc 주석 본문에 기술했다. 이 의무는 운영 보안에 직결되는 중요 절차이나, 관련 spec (`spec/conventions/secret-store.md §3.3`) 이나 `README`/`.env.example` 에는 이 Set 이 존재한다는 사실과 갱신 규칙이 언급되지 않는다. 코드 주석 외에 최소 1개의 정식 문서 위치에 이 동기화 의무가 기록되어야 한다.
- 제안: `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 또는 `spec/conventions/secret-store.md §R5` 에 "`.env.example` 의 `JWT_SECRET`/`ENCRYPTION_KEY` placeholder 를 변경할 때는 `production-guards.ts` 의 `INSECURE_JWT_SECRETS`/`KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set 에 동기화한다" 한 줄을 추가한다. 현재는 코드 주석에만 있어 spec 관점에서 불완전하다.

---

### [WARNING] `spec/5-system/3-error-handling.md` — `TOKEN_INVALID` 설명에서 reuse 탐지 케이스 누락으로 에러 코드 표 완전성 저하
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/5-system/3-error-handling.md` §1.2 `TOKEN_INVALID` 행
- 상세: 변경 후 설명이 "변조/형식 오류" 만 남아 `spec/data-flow/2-auth.md §1.4` 의 `is_revoked=true` 재사용(reuse 탐지) 경로에서 여전히 `TOKEN_INVALID` 를 반환한다는 사실이 에러 코드 SoT 에서 사라졌다. 클라이언트 개발자가 에러 코드 표만 보면 refresh reuse 탐지 응답이 어느 코드인지 알 수 없는 문서 공백이다. consistency check(cross_spec.md WARNING) 에서도 동일하게 지적됐다.
- 제안: `TOKEN_INVALID` 설명을 "변조/형식 오류 또는 reuse 탐지(is_revoked 토큰 재사용)" 수준으로 복원하거나, 최소한 `data-flow/2-auth.md §1.4` 의 교차 참조 링크를 남긴다.

---

### [INFO] `spec/5-system/1-auth.md` §2.1 blockquote — 설계 근거와 사실 기술이 혼재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/5-system/1-auth.md` §2.1 테이블 직후 추가된 blockquote
- 상세: blockquote 는 `JWT_SECRET` production fail-closed 의 enforcement 사실(어디서, 어떻게)과 설계 근거("인증 우회 가능") 를 함께 담고 있다. CLAUDE.md 규약("결정의 배경·근거 → `## Rationale`")에 따르면 근거는 Rationale 섹션에 있어야 한다. Rationale 섹션("Production fail-closed 가드")이 동일 PR 에서 추가됐으나, blockquote 에도 요약이 중복돼 구조 경계가 흐릿하다. 다만 blockquote 분량이 짧고 Rationale 참조 포인터가 명시돼 있어 CRITICAL은 아니다.
- 제안: blockquote 를 "JWT_SECRET 미설정/예시값/32자 미만이면 부팅 거부 (`assertProductionConfig`). 근거: §Rationale "Production fail-closed 가드"" 와 같이 사실 기술 + 포인터로 압축하고, 설계 근거 본문은 Rationale 섹션에만 두어 중복을 제거한다.

---

### [INFO] `spec/5-system/7-llm-client.md` §7.1 — 단일 문장이 200자 이상, 가독성 저하
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/5-system/7-llm-client.md` `**프로덕션 차단**:` 항목 수정 줄
- 상세: 변경 후 문장이 `assertProductionConfig` 참조 + 관할 env 나열 parenthetical + 가드 함수 위치를 단일 문장에 담아 200자를 초과한다. 내용 자체는 정확하나 관리·가독성이 낮다. 동일 이슈가 convention_compliance.md(INFO)에서도 지적됐다.
- 제안: 두 문장으로 분리하거나 "가드 위치"/"적용 대상 env" 를 불릿 목록으로 분리해 가독성을 개선한다.

---

### [INFO] `spec/5-system/1-auth.md` §Rationale — Rationale 항목 제목에 구현 task ID 포함, 기존 패턴과 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/5-system/1-auth.md` `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP (refactor 04 C-1·M-4·M-7)` 제목
- 상세: 기존 Rationale 항목들(`### 1.4.A`, `### 1.5.B` 등)은 번호 또는 의미 기반 제목을 쓰며 plan task ID 를 포함하지 않는다. 신규 항목만 `(refactor 04 C-1·M-4·M-7)` 을 제목 줄에 직접 박아 패턴 불일치가 발생한다. 구현·역사를 이름에 박지 않는 안정적 명명 원칙에 어긋난다.
- 제안: `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL` 처럼 보호 대상 변수만으로 제목을 구성하고, task ID 는 본문 첫 줄 괄호 안에 두거나 삭제한다.

---

### [INFO] `spec/4-nodes/4-integration/1-http-request.md` — `ALLOW_PRIVATE_HOST_TARGETS` production warn 정책 미기술
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/4-nodes/4-integration/1-http-request.md` §4
- 상세: 신규 정책("절대 금지 플래그는 throw, 정당 용도 있는 플래그는 warn")이 `spec/5-system/11-mcp-client.md §3.2` 에 추가됐으나, `ALLOW_PRIVATE_HOST_TARGETS` 의 1차 출처(`1-http-request.md §4`)에는 production 환경에서 부팅을 막지 않고 warn 로그만 남긴다는 사실이 없다. 이 플래그의 production 동작을 알고 싶은 독자는 mcp-client spec 에서 간접 확인해야 한다.
- 제안: `spec/4-nodes/4-integration/1-http-request.md §4` 의 `ALLOW_PRIVATE_HOST_TARGETS` 설명 뒤에 "production 에서 켜져 있으면 부팅은 하되 warn 로그만 남긴다 (`assertProductionConfig` warn 분기)" 한 줄을 추가해 플래그의 production 동작을 1차 출처에서 확인 가능하게 한다.

---

### [INFO] `spec/2-navigation/10-auth-flow.md` — `OAUTH_STUB_MODE` production throw 미기술
- 위치: `spec/2-navigation/10-auth-flow.md` §5 (line 333)
- 상세: `spec/5-system/7-llm-client.md §7.1` 에서 `assertProductionConfig` 가 `OAUTH_STUB·LLM_STUB` 를 응집했다고 명시했으나, `10-auth-flow.md` 는 `OAUTH_STUB_MODE` 의 production throw 보증을 언급하지 않아 동일 env 변수에 대한 설명이 비대칭이다.
- 제안: `10-auth-flow.md §5` 의 `OAUTH_STUB_MODE` 설명 뒤에 "production(`NODE_ENV=production`)에서는 `assertProductionConfig` 가 `OAUTH_STUB_MODE=true` 를 throw 해 활성화를 차단한다" 한 줄을 추가하거나, `spec/5-system/1-auth.md §Rationale` 에서 `10-auth-flow.md` 로의 교차 참조 링크를 추가한다.

---

### [INFO] `spec/conventions/secret-store.md` — Rationale 섹션 없이 본문에 설계 근거 기술
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/conventions/secret-store.md` §R5
- 상세: `R5` 는 `## Rationale` 섹션 안 `### R5` 하위 항목으로 올바르게 위치하고 있다. 단, `§3.3` 본문 bullet 에도 설계 근거("secret store 가 사실상 평문")가 인라인으로 포함돼 있어 Rationale 섹션과 내용이 일부 중복된다. CLAUDE.md 3섹션 원칙("본문은 latest-only 사실, 근거는 Rationale")과 약간 거리가 있다.
- 제안: §3.3 본문 bullet 을 "운영 사실(`openssl rand -hex 32` 로 신규 생성 필요)" 만 남기고 설계 근거는 `§R5` 참조 포인터로 처리하는 것이 권장된다. 긴급 수정 대상은 아님.

---

### [INFO] `review/consistency/2026/06/11/10_17_44/plan_coherence.md` — `## 발견사항` 이전 제목 섹션 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/review/consistency/2026/06/11/10_17_44/plan_coherence.md`
- 상세: 다른 consistency check 파일들(`convention_compliance.md`, `naming_collision.md` 등)은 `#` 수준 제목으로 시작하나, 이 파일은 `## 발견사항` 으로 바로 시작해 파일 수준 `#` 제목이 없다. 구조 불일치로 파싱 도구나 요약 생성 시 오탐 원인이 될 수 있다.
- 제안: 파일 상단에 `# Plan 정합성 검토 결과 (10_17_44)` 와 같은 `#` 수준 제목을 추가해 구조를 통일한다.

---

### [INFO] `review/consistency/2026/06/11/10_52_27/SUMMARY.md` 두 버전 간 WARNING 건수 불일치 — 이전 버전(10_17_44) 과 비교
- 위치: `review/consistency/2026/06/11/10_52_27/SUMMARY.md` vs `review/consistency/2026/06/11/10_17_44/` 세트
- 상세: 10_17_44 세션은 `rationale_continuity.md` 에서 CRITICAL 2건(Rationale 삭제)을 보고했으나 10_52_27 SUMMARY 는 이를 "rebase 후 오탐 해소"로 처리했다. 이 해소 근거가 SUMMARY 의 `>` blockquote 한 줄로만 기술돼 있어, 두 버전을 순서대로 읽는 독자가 해소 경위를 추적하기 어렵다. 의사결정 맥락(어떤 rebase, PR B #537 이 무엇인지)이 SUMMARY 외부에 기록되지 않는다.
- 제안: SUMMARY 의 해소 메모에 "PR B #537 = auth-refresh-rotation-atomic 브랜치 squash merge" 정도의 한 줄 주석을 추가해 독자가 컨텍스트 없이도 경위를 이해할 수 있게 한다.

---

## 요약

이번 변경은 `production-guards.ts` 신규 모듈 + `spec/5-system/` 5개 파일의 spec 문서화로 구성된다. 코드 문서화(JSDoc) 수준은 전반적으로 양호하며 파일·함수·상수 모두 주석이 존재한다. 미비점은 `@throws`/`@returns` 태그 누락과 보안 동기화 의무가 코드 주석에만 있고 spec SoT에는 미기술된 부분이다. spec 문서 관점에서는 `TOKEN_INVALID` 설명 단축으로 에러 코드 표의 완전성이 저하된 점(WARNING)이 가장 실질적인 문서화 결함이며, 나머지 발견사항은 Rationale-본문 분리 패턴 불일치, 환경변수 production 정책의 1차 출처 미기술, Rationale 제목 패턴 불일치 등 구조적 개선 사항(INFO)이다. 핵심 기능(fail-closed 가드)의 설명은 spec과 코드 양쪽에 충분히 기술돼 있다.

## 위험도

LOW

STATUS: OK
