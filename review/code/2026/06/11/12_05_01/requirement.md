# 요구사항(Requirement) 리뷰

## 리뷰 대상

- `codebase/backend/README.md` — 배포 주의 섹션 가드 조건 확장
- `codebase/backend/src/common/config/production-guards.spec.ts` — Set-sync 테스트 fragility 수정 + 주석 정정

---

## 발견사항

### [INFO] README 가드 조건 목록이 실제 `assertProductionConfig` 구현과 완전히 일치함

- 위치: `codebase/backend/README.md` 38–41행
- 상세: 변경 후 README 의 4개 불릿(`JWT_SECRET 미설정·예시/기본값이거나 32자 미만`, `ENCRYPTION_KEY 미설정/예시 키`, `OAUTH_STUB_MODE=true 또는 LLM_STUB_MODE=true`, `MCP_ALLOW_INSECURE_URL=true`)이 `production-guards.ts` 의 실제 throw 분기(`isFlagOn(OAUTH_STUB_MODE)`, `isFlagOn(LLM_STUB_MODE)`, `!jwtSecret || INSECURE_JWT_SECRETS.has(jwtSecret)`, `jwtSecret.length < MIN_JWT_SECRET_LENGTH`, `!encryptionKey || KNOWN_EXAMPLE_ENCRYPTION_KEYS.has(encryptionKey)`, `isFlagOn(MCP_ALLOW_INSECURE_URL)`)와 정확히 대응한다.
- 제안: 없음 (변경 정합성 확인).

### [INFO] beforeAll 패턴이 선언 스코프와 올바르게 결합됨

- 위치: `production-guards.spec.ts` 195–199행
- 상세: `let envExampleContent: string` 이 `describe` 블록 스코프에 선언되고 `beforeAll` 내부에서 할당되므로, 이후 `it` 케이스들이 실행 시점에 이미 채워진 값을 참조한다. `beforeAll` 이 동기 콜백(`() => { ... }`)으로 `fs.readFileSync` 를 감싸는 형태라 async 레이스 조건도 없다. 파일 부재 시 스위트 전체가 아닌 해당 `describe` 블록만 실패하는 의도도 정확히 구현됐다.
- 제안: 없음.

### [INFO] `jwtConfig` 주석 정정이 실제 동작과 일치함

- 위치: `production-guards.spec.ts` 205–208행 (기존 주석 대비)
- 상세: `registerAs('jwt', () => ({...}))` 는 팩토리 함수를 반환하므로, `jwtConfig()` 호출이 `{ secret, accessExpiration, refreshExpiration }` 객체를 직접 반환한다. 수정된 주석("registerAs 가 반환한 팩토리 함수 자체이므로, 직접 호출하면 설정 객체를 반환한다")이 `jwt.config.ts` 구현과 일치한다. 테스트 코드(`cfg.secret`)도 올바른 필드를 참조한다.
- 제안: 없음.

### [INFO] spec 열거 목록에 OAUTH_STUB_MODE/LLM_STUB_MODE 누락 — SPEC-DRIFT

- [SPEC-DRIFT] `spec/5-system/1-auth.md` §"Production fail-closed 가드" 의 대상 목록(558–566행)이 `JWT_SECRET`, `ENCRYPTION_KEY`, `MCP_ALLOW_INSECURE_URL` 세 항목만 나열하며 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 를 대상 불릿으로 명시하지 않는다. 실제 `production-guards.ts` 구현 및 README 변경은 이 두 stub 플래그를 가드 대상으로 포함하고 있으며, `spec/5-system/7-llm-client.md` §7.1과 `.env.example` 주석도 해당 throw 동작을 언급한다. 코드가 틀린 것이 아니라 spec 불릿 목록이 낡았다.
- 위치: `spec/5-system/1-auth.md` 558–566행
- 상세: 타이틀 "Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP (refactor 04 C-1·M-4·M-7)" 자체도 OAUTH_STUB/LLM_STUB 를 제목에서 누락하고 있다. 코드는 올바르게 구현됐고 되돌리는 것이 오답이다.
- 제안: 코드 유지 + spec 반영. `spec/5-system/1-auth.md` §"Production fail-closed 가드" 대상 목록에 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 불릿 추가 및 섹션 제목에도 해당 플래그 포함. `project-planner` 위임.

---

## 요약

이번 변경은 두 가지 독립적인 수정을 포함한다. (1) `production-guards.spec.ts` 의 `.env.example` 동기 읽기를 `describe` 최상위에서 `beforeAll` 로 이동하여 파일 부재 시 전체 스위트 로드 실패를 방지했으며, 변수 선언 스코프와 `beforeAll` 배치가 Jest 생명주기와 올바르게 결합돼 기능 완전성에 결함이 없다. (2) `README.md` 배포 주의 섹션이 단일 문장에서 4개 불릿으로 구조화되어 실제 `assertProductionConfig` 의 throw 조건(`OAUTH_STUB_MODE`, `LLM_STUB_MODE`, `JWT_SECRET` 미설정/예시/길이 부족, `ENCRYPTION_KEY` 미설정/예시, `MCP_ALLOW_INSECURE_URL`)과 1:1 로 대응하는 정확한 문서가 됐다. 코드 구현과 스펙의 기능 요구사항은 충족됐으나, `spec/5-system/1-auth.md` §"Production fail-closed 가드" 본문 목록이 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 를 대상 불릿으로 명시하지 않아 spec 갱신이 필요하다 (SPEC-DRIFT, 코드 버그 아님).

## 위험도

LOW
