# 신규 식별자 충돌 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

이번 diff 는 `spec/5-system/` 의 4개 파일(`1-auth.md`, `11-mcp-client.md`, `14-external-interaction-api.md`, `3-error-handling.md`)과 `spec/5-system/7-llm-client.md` 에 걸쳐 **production fail-closed 가드 응집(refactor 04 C-1·M-4·M-7)** 을 명문화한다. 신규 도입 식별자는 다음이다:

- `assertProductionConfig` (함수명, `common/config/production-guards.ts`)
- `production-guards.ts` (파일 경로, 모듈명)
- `refactor 04 C-1` / `refactor 04 M-4` / `refactor 04 M-7` (내부 태스크 레이블)
- `JWT_SECRET` fail-closed 설명 블록 (`1-auth.md §2.1` 신규 callout)
- `MCP_ALLOW_INSECURE_URL` fail-closed 설명 블록 (`11-mcp-client.md §3.2` 확장)
- `ENCRYPTION_KEY` fail-closed 교차 언급 (`14-external-interaction-api.md §8.3` 개정)
- `TOKEN_INVALID` description 단축 (`3-error-handling.md §2`)

---

## 발견사항

### 1. INFO — `refactor 04 M-4` 레이블 사용처 불일치 (대소문자)

- **target 신규 식별자**: `refactor 04 M-4` (7-llm-client.md 및 14-external-interaction-api.md)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/4-nodes/4-integration/2-database-query.md` §Rationale 제목에 `refactor 04 m-4` (소문자 m)
- **상세**: 동일 리팩터 태스크를 지칭하면서 대소문자 표기가 다르다. `7-llm-client.md` 가 `M-4`, `database-query.md` 가 `m-4`. 의미 충돌은 아니나 검색·grep 일관성이 떨어진다.
- **제안**: `spec/4-nodes/4-integration/2-database-query.md` §Rationale 제목의 `m-4` 를 `M-4` 로 통일하거나, target 쪽을 소문자로 내려 통일. 프로젝트 내 기존 선례(`refactor 04 M-7`, `refactor 04 C-1` 등)가 모두 대문자이므로 `database-query.md` 를 대문자로 수정하는 방향이 자연스럽다.

---

### 2. INFO — `TOKEN_INVALID` 설명 축소 — data-flow 와 약식 정합

- **target 신규 식별자**: 변경 없음 (코드 `TOKEN_INVALID` 유지). 단, `3-error-handling.md §2` 의 설명 컬럼이 `"변조/형식 오류"` 만으로 단축됨 (기존: `"변조/형식 오류, refresh 토큰 미존재/소유자 부재, 또는 refresh 회전 시 조건부 revoke 매칭 0건(동일 토큰 동시 회전 경합 — data-flow §1.4)"` 포함)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/data-flow/2-auth.md` line 164 — `Svc-->>C: 401 TOKEN_INVALID` (reuse 탐지 경로에서 발행)
- **상세**: 코드 자체는 동일하므로 식별자 충돌 없음. 그러나 설명 단축으로 인해 `3-error-handling.md` 의 설명과 `data-flow/2-auth.md §1.4` 의 reuse 탐지 → `TOKEN_INVALID` 경로 사이에 독자가 관계를 추적하기 어려워진다. data-flow 에서 `TOKEN_INVALID` 를 발행하는 세 경로(refresh 토큰 미존재/소유자 부재, reuse 탐지) 가 더 이상 error-handling 표 설명에 나타나지 않는다.
- **제안**: `3-error-handling.md §2` 의 `TOKEN_INVALID` 설명에 `data-flow/2-auth.md §1.4` 교차 참조를 한 줄 남겨 두거나, 설명을 `"변조/형식 오류 · 만료 token 재사용·미존재 등 — 상세: [data-flow §1.4](../data-flow/2-auth.md#14-refresh-token-회전)"` 정도로 보완. (충돌이 아니라 가독성 권장 사항)

---

### 3. INFO — `assertProductionConfig` 신규 도입 — 기존 spec 에 이미 암묵 언급된 것을 명시화

- **target 신규 식별자**: `assertProductionConfig` 함수명 + `common/config/production-guards.ts` 모듈 경로
- **기존 사용처**: 이번 diff 이전 origin/main 의 어떤 spec 파일에도 이 이름이 등장하지 않았음. (codebase 에는 이미 구현돼 있고, 이번 spec 변경으로 처음 문서화됨.)
- **상세**: 식별자 충돌 없음. 기존 `7-llm-client.md` origin/main 본문은 "main.ts 부팅 가드가 ... throw 한다" 로만 기술했고 함수 이름이 없었다. 이번 diff 가 처음으로 `assertProductionConfig` / `production-guards.ts` 를 spec 에 명기한다. 동일 이름·경로가 다른 의미로 사용된 사례 없음.
- **제안**: 없음. 정상적인 구현 후 spec 명문화.

---

### 4. INFO — `ALLOW_PRIVATE_HOST_TARGETS` warn 정책 — 기존 spec 과 일치 확인

- **target 신규 식별자**: `ALLOW_PRIVATE_HOST_TARGETS` warn(warn 만, throw 아님) 정책을 `11-mcp-client.md §3.2` 에 명기
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/spec/4-nodes/4-integration/1-http-request.md`, `3-send-email.md`, `2-navigation/4-integration.md` — 동일 ENV var 가 SSRF opt-out 으로 사용됨. 이들 어디에도 production warn 정책은 기술되지 않았음.
- **상세**: 식별자 충돌 없음. `ALLOW_PRIVATE_HOST_TARGETS` 라는 환경변수 이름은 기존과 동일. 이번 diff 가 MCP 맥락에서 "이 플래그는 warn, `MCP_ALLOW_INSECURE_URL` 은 throw" 라는 정책 경계를 추가한다. http-request / database-query / send-email spec 에는 이 production warn 동작이 미기술된 상태이므로, 향후 해당 spec 에 교차 참조 또는 동일 설명을 보완하면 일관성이 높아진다.
- **제안**: 반드시 필요한 수정은 아니지만, `spec/4-nodes/4-integration/1-http-request.md §4` 의 `ALLOW_PRIVATE_HOST_TARGETS` 설명에 "production 에서 경고 로그만 발생 (부팅 차단 없음)" 한 줄 보완 권장.

---

## 요약

이번 diff 는 production fail-closed 가드(`assertProductionConfig`, `production-guards.ts`)를 spec 에 처음 명문화하고, `JWT_SECRET`·`ENCRYPTION_KEY`·`MCP_ALLOW_INSECURE_URL` 의 fail-closed 정책과 `ALLOW_PRIVATE_HOST_TARGETS` 의 warn 정책 경계를 각 관련 spec 에 배치한다. 신규 도입된 식별자 중 기존 다른 의미로 쓰이는 것은 없으며, API endpoint·이벤트명·엔티티명 충돌도 발견되지 않는다. `refactor 04 m-4` 대소문자 불일치(INFO), `TOKEN_INVALID` 설명 단축으로 인한 data-flow 교차 참조 손실(INFO), `ALLOW_PRIVATE_HOST_TARGETS` warn 정책이 http-request 등 관련 spec 에 미전파(INFO) — 세 가지 모두 명명 혼선 방지 차원의 일관성 제안이며 블로킹 사안이 아니다.

## 위험도

NONE
