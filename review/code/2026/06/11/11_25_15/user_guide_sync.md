# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

검토 브랜치: `claude/plan-complete-turn-timing-aa533b` → `prod-fail-closed-guards`
매트릭스 적재: `.claude/config/doc-sync-matrix.json` rows[] 17개 항목 색인 완료

---

## 발견사항

### [WARNING] spec-major-change — production-guards.ts 신규 구현 파일이 spec frontmatter code: 글로브 미포함

- 변경 파일: `codebase/backend/src/common/config/production-guards.ts` (신규), `spec/5-system/1-auth.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/14-external-interaction-api.md`
- 매트릭스 항목: `spec-major-change` — "frontmatter code: / status: / pending_plans: 정합 갱신; status: implemented 이면 code: 글로브 ≥1 매치 보장"
- 누락된 동반 갱신: `spec/5-system/1-auth.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/11-mcp-client.md` 중 최소 하나의 frontmatter `code:` 섹션에 `codebase/backend/src/common/config/production-guards.ts` 커버 글로브 추가
- 상세: 변경된 세 spec 파일 본문이 `common/config/production-guards.ts` 와 `assertProductionConfig` 를 명시적으로 인용한다. 그러나 `1-auth.md` 의 `code:` 글로브는 `codebase/backend/src/common/guards/*.ts` 만 포함하며 `config/` 경로는 미포함이다. `7-llm-client.md` 와 `11-mcp-client.md` 의 `code:` 글로브도 이 파일을 포함하지 않는다. `spec-impl-evidence.md` 컨벤션은 `status: implemented` 이면 `code:` 글로브가 ≥1 매치를 보장하고, `status: partial` 이면 구현된 부분에 해당하는 코드는 역시 글로브에 반영돼야 한다고 규정한다. 현재 세 파일 모두 `status: partial` 이나 `assertProductionConfig` 관련 구현이 완료된 상태이므로 글로브 누락은 spec-coverage 갭을 만든다. `spec-code-paths.test.ts` 가드가 이를 탐지할 수 있다.
- 제안: `spec/5-system/1-auth.md` frontmatter `code:` 에 `codebase/backend/src/common/config/production-guards.ts` 한 줄(또는 `codebase/backend/src/common/config/*.ts` 글로브)을 추가한다. 나머지 두 파일은 `1-auth.md` 를 참조 SoT 로 두는 구조라면 추가 불필요하나, 각 spec 이 독립적으로 `assertProductionConfig` 를 언급하므로 각각 추가하거나 하나를 SoT 로 정리하는 것이 권장된다.

---

### [WARNING] env-runtime-change — .env.example·main.ts 부팅 가드 변경 시 README.md 미갱신

- 변경 파일: `codebase/backend/.env.example`, `codebase/backend/src/main.ts`
- 매트릭스 항목: `env-runtime-change` — "환경 변수·기동 방법·런타임 변경 (제품 최종 상태) → README.md"
- 누락된 동반 갱신: `README.md`
- 상세: `.env.example` 의 `ENCRYPTION_KEY` 주석이 production fail-closed 경고("NODE_ENV=production refuses to boot if this placeholder is used")로 갱신됐고, `main.ts` 의 부팅 시퀀스가 바뀌었다(기존 분산된 `if (production && OAUTH_STUB_MODE)` / `if (production && LLM_STUB_MODE)` 블록들이 `assertProductionConfig(process.env)` 단일 호출로 통합). 이 변경은 프로덕션 배포자가 참조하는 "환경 변수·기동 방법" 의 변경이다. `env-runtime-change` 행은 이 변경 유형 시 `README.md` 동반 갱신을 요구한다. 현재 `README.md` 는 변경 set 에 없다. 사용자(운영자)가 placeholder `ENCRYPTION_KEY` 로 production 부팅을 시도하면 즉시 실패한다는 사실이 가이드에 반영되지 않는다.
- 제안: `README.md` 의 환경 변수 설정 또는 배포 주의사항 섹션에 "production 환경에서 `JWT_SECRET`/`ENCRYPTION_KEY`/`MCP_ALLOW_INSECURE_URL` 을 기본값·placeholder 그대로 두면 부팅이 거부된다 (`assertProductionConfig`)" 한 줄을 추가한다. 정도가 가볍다면 `.env.example` 주석으로 충분하다고 볼 수 있으나, `README.md` 배포 섹션이 있다면 동반 갱신이 권장된다.

---

### [INFO] auth-session-flow-change — auth.module.ts 변경이 user-guide 07-workspace-and-team 트리거 가능성

- 변경 파일: `codebase/backend/src/modules/auth/auth.module.ts`
- 매트릭스 항목: `auth-session-flow-change` — "codebase/backend/src/modules/auth/** 변경 → codebase/frontend/src/content/docs/07-workspace-and-team/ 관련 페이지 + e2e 보강 점검"
- 상세: `auth.module.ts` 의 변경 내용은 `useFactory` 내 `jwt.secret` 조회 시 `?? 'fallback'` dead-branch 제거 + `getOrThrow` 전환이다. 이것은 사용자 가시적인 인증 흐름(로그인·세션·워크스페이스 권한)을 바꾸지 않는다 — production 에서는 이미 `assertProductionConfig` 가 sentinel 을 막고, dev/test 는 `dev-jwt-secret` fallback 이 그대로 작동한다. `07-workspace-and-team` 문서는 사용자 대면 인증 UX 를 설명하는 곳이므로 이 내부 리팩터는 해당 문서를 바꿀 필요가 없다. 다만 매트릭스 행이 glob 트리거로 활성화되므로 reviewer 판단을 기록한다.
- 판정: 회색지대(INFO). 사용자 가이드 변경 불필요.

---

## 요약

매트릭스 rows[] 17개 중 트리거에 매칭된 항목: `spec-major-change`(글로브 매칭 — spec/5-*/**), `env-runtime-change`(시맨틱 — .env.example + main.ts 부팅 변경), `auth-session-flow-change`(글로브 매칭 — auth.module.ts). 누락 2건 발견: (1) `production-guards.ts` 신규 구현 파일이 3개 spec 파일의 frontmatter `code:` 글로브에 미포함 [WARNING], (2) `.env.example` + `main.ts` 부팅 가드 변경 시 `README.md` 미갱신 [WARNING]. `auth.module.ts` dead-branch 제거는 사용자 가시적 인증 흐름 변경이 아니므로 07-workspace-and-team 문서 갱신 불필요 [INFO].

## 위험도

MEDIUM

STATUS=success ISSUES=2
