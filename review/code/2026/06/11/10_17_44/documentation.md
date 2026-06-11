# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `isFlagOn` 내부 함수에 JSDoc 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` (내부 함수 `isFlagOn`)
- 상세: `isFlagOn`은 파일-private 헬퍼이지만, `.env` boolean 토글 관례("정확히 'true'/'1'만 ON")는 다른 모듈에도 파급되는 규약이다. 현재 인라인 주석(`// 정확히 문자열 'true' 또는 '1' 만 ON ...`)은 충분하나, 이 함수를 외부로 export 하거나 다른 곳에서 재사용하게 될 경우를 대비해 JSDoc 추가를 고려할 수 있다. 현 상태에서는 주석이 의도를 잘 설명하므로 blocker는 아니다.
- 제안: 현재 상태 유지 가능. 향후 export 시 `@param value - 환경변수 문자열 / @returns 정확히 'true' 또는 '1'인 경우 true` 수준 JSDoc 추가.

### [INFO] `production-guards.ts` 모듈 문서 — `INTERACTION_JWT_SECRET` 예외 미언급
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` — 상단 모듈 JSDoc
- 상세: 모듈 JSDoc은 "경계 — 본 모듈은 throw 정책(fail-closed) 전용"이라고 명시하고 `ALLOW_PRIVATE_HOST_TARGETS` warn 예외는 서술하지만, `INTERACTION_JWT_SECRET`이 같은 fail-closed 패밀리임에도 이 파일이 아닌 `InteractionTokenService` 생성자에 별도 유지된다는 사실을 코드에서 직접 읽을 수 없다. spec 문서(`14-external-interaction-api.md`)에는 기재되어 있으나, 이 파일의 독립적 가독성(누군가 가드를 확장할 때 `INTERACTION_JWT_SECRET`을 여기에 추가하려는 시도를 막기 위한 설명)을 높이는 관점에서 한 줄 주석이 도움이 된다.
- 제안: 모듈 JSDoc 또는 `assertProductionConfig` 함수 주석에 "주의: `INTERACTION_JWT_SECRET`의 fail-closed는 `InteractionTokenService` 생성자에 별도 유지된다 — 해당 서비스 생성자 참조" 한 줄 추가.

### [INFO] `.env.example` 의 `ENCRYPTION_KEY` 구 주석 라인 중복 경고 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/.env.example`, `# Encryption` 섹션
- 상세: 변경 후 `.env.example`의 `ENCRYPTION_KEY` 값이 `0000...0000`으로 바뀌었고 새 경고 주석("MUST regenerate", "Generate with: openssl rand -hex 32", production refuses to boot 참조)이 추가되었다. 이 문서화 자체는 매우 적절하다. 단, 파일 상단 헤더의 일반 관례("Secrets show 'change-me-*' placeholders")가 이제 ENCRYPTION_KEY와 일치하지 않는다 — `ENCRYPTION_KEY`는 `change-me-*` 패턴이 아닌 all-zero 패턴을 쓰기 때문이다. 사소한 불일치이지만 독자 혼선 가능성이 있다.
- 제안: 파일 상단 `Convention` 주석에 "ENCRYPTION_KEY 처럼 all-zero placeholder 를 쓰는 경우도 있으며, production-guards.ts 가 이를 부팅 시 탐지한다" 한 줄을 추가하거나, 관례 설명을 "known-insecure placeholder" 패턴으로 일반화.

### [INFO] `plan/complete/security-jwt-secret-fallback.md` frontmatter — `status: backlog` vs 실제 `superseded`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/plan/complete/security-jwt-secret-fallback.md`
- 상세: diff에서 추가된 원본(신규 파일 스냅샷)의 frontmatter에는 `status: backlog`가 있으나, 전체 파일 컨텍스트에는 `status: superseded`로 이미 반영되어 있다. 즉 최종 파일 상태는 올바르다. 단, 파일이 `plan/complete/` 경로에 있으면서 frontmatter `worktree: (unstarted)` 가 그대로 남아 있어 lifecycle 정합성이 불완전하다 — 완료·superseded 파일의 worktree 필드는 실제 worktree 이름이나 "N/A(superseded)" 등으로 갱신되는 것이 이력 추적에 유리하다.
- 제안: `worktree` 필드를 실제 구현 worktree 이름(`prod-fail-closed-guards`)으로 갱신하거나, superseded 처리 시 해당 PR/worktree 참조를 명시.

### [INFO] spec 문서 내 괄호 중첩으로 인한 가독성 저하
- 위치: `spec/5-system/14-external-interaction-api.md` 변경 라인 (iext_* 설명 단락)
- 상세: 변경된 문장은 이미 긴 괄호 중첩 구조에 추가 설명이 삽입되어 독자가 한 문장에서 괄호 3~4 겹을 파악해야 한다. 내용 자체는 정확하고 기술적으로 충실하지만, spec 문서의 가독성 관점에서 불편하다.
- 제안: 핵심 부분("`INTERACTION_JWT_SECRET` 만은 `InteractionTokenService` 생성자 throw 로 별도 유지")을 별도 blockquote 또는 각주 수준 note 로 분리해 주 문장 흐름을 단순화.

### [INFO] `spec/5-system/7-llm-client.md` 변경 — 참조 경로 정확성
- 위치: `spec/5-system/7-llm-client.md` — "프로덕션 차단" 항목
- 상세: 변경 후 `assertProductionConfig`(`common/config/production-guards.ts`)에 응집된 항목 목록이 `JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL·OAUTH_STUB·LLM_STUB`로 나열되어 있다. 이 목록은 현재 구현과 정확히 일치한다. 다만 향후 가드가 확장될 때 이 인라인 열거를 spec에서 동기화해야 하는 부담이 생긴다. SoT를 production-guards.ts로 명확히 지목하는 문구로 충분하므로 열거 대신 "production-guards.ts 참조"로 단순화하는 것이 유지보수성에 유리하다.
- 제안: "JWT_SECRET·ENCRYPTION_KEY·..." 나열 대신 "production-guards.ts 참조(현재 OAUTH_STUB, LLM_STUB, JWT_SECRET, ENCRYPTION_KEY, MCP_ALLOW_INSECURE_URL 포함)"처럼 SoT를 명시하고 목록은 예시 수준으로 처리.

## 요약

전체적으로 이번 변경은 문서화 품질이 높다. `production-guards.ts`의 모듈 JSDoc, 공개 상수(`INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS`)의 "동기화 의무" 주석, `assertProductionConfig`의 `@param` 문서, `.env.example`의 경고 주석, spec 3개 파일(`1-auth.md`, `11-mcp-client.md`, `7-llm-client.md`, `14-external-interaction-api.md`)의 동기화 모두 꼼꼼하게 수행되었다. 발견된 사항은 모두 INFO 수준이며 구현 정확성이나 운영 안전성을 위협하지 않는다. 가장 실질적인 개선 포인트는 `INTERACTION_JWT_SECRET` 예외 처리 근거를 `production-guards.ts` 코드 내에도 짧게 명시하는 것과, plan 파일의 `worktree` frontmatter 갱신이다.

## 위험도

NONE
