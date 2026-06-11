# 신규 식별자 충돌 Check — `spec/5-system/` (refactor 04 C-1·M-4·M-7)

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

## 발견사항

### [INFO] `common/config/index.ts` barrel 에 `production-guards` 미포함
- target 신규 식별자: `production-guards.ts` (신규 파일)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/index.ts` — 기존 config 파일들을 barrel export
- 상세: `common/config/` 폴더의 기존 파일(`jwt.config.ts`, `app.config.ts` 등)은 `index.ts` 에서 re-export 된다. `production-guards.ts` 는 `main.ts` 에서 직접 named import 하며 barrel 에 포함되지 않는다. 이는 의도적 패턴으로 추정되나(main.ts 전용 진입점), 이후 다른 모듈이 `isFlagOn` 을 재사용하려 할 때 barrel 부재로 import 경로가 길어질 수 있다. 충돌은 아님.
- 제안: 의도적 미포함이면 `index.ts` 주석 또는 `production-guards.ts` 파일 헤더에 "main.ts 전용, barrel 불포함 의도" 한 줄 명시를 고려. 필수 조치 아님.

### [INFO] 요구사항 서브태스크 ID `C-1` 은 다른 refactor 파일에도 로컬 사용
- target 신규 식별자: `refactor 04 C-1` (spec 및 plan 서술에 사용)
- 기존 사용처: `plan/complete/auth-refresh-rotation-atomic.md` 라인 10 (`refactor 05 C-1`), `plan/complete/deps-security-hygiene.md` 라인 15 (`refactor 07 C-1`), `plan/complete/backend-msg-i18n-impl.md` 라인 21 (`P3-C-1`)
- 상세: `C-1` / `M-4` / `M-7` 은 각 refactor 파일 내부의 로컬 순번이다. `refactor 04 C-1`, `refactor 05 C-1` 은 각자 다른 plan 파일에 스코프되어 있으며, spec 본문·코드 심볼로 표출되는 식별자가 아니라 plan 추적용 태그이다. 실질 충돌 없음.
- 제안: 현 `refactor XX Y-N` 패턴을 그대로 유지해도 무방. refactor 번호가 스코프를 명확히 구분한다.

### [INFO] `secret-store.md §R5` — 기존 R1–R4 에 순차 추가
- target 신규 식별자: `spec/conventions/secret-store.md` §Rationale 내 `R5`
- 기존 사용처: `spec/conventions/secret-store.md` — R1(라인 295), R2(라인 301), R3(라인 307), R4(라인 313) (origin/main 기준)
- 상세: 이번 브랜치가 R5 를 추가한다. 번호 순서가 유지되어 기존 섹션 ID 와 충돌 없음.
- 제안: 변경 불필요.

---

## 분석 상세

### 1. 요구사항 ID 충돌

Target diff 는 요구사항 ID(`KB-GR-*`, `NF-*`, `WH-*` 등 형식)를 신규 부여하지 않는다. `spec/5-system/1-auth.md §Rationale` 과 `spec/conventions/secret-store.md §R5` 에 서술 블록이 추가되었으나, 이는 기존 섹션 구조를 확장하는 산문이며 고유 요구사항 ID 를 신규로 할당하지 않는다. 충돌 없음.

### 2. 엔티티/타입명 충돌

신규 도입된 TypeScript 심볼:

| 심볼 | 위치 |
|------|------|
| `assertProductionConfig` | `codebase/backend/src/common/config/production-guards.ts` (신규 파일) |
| `isFlagOn` | 동일 파일 |
| `INSECURE_JWT_SECRETS` | 동일 파일 |
| `KNOWN_EXAMPLE_ENCRYPTION_KEYS` | 동일 파일 |
| `MIN_JWT_SECRET_LENGTH` | 동일 파일 |

전수 검색 결과: `production-guards.ts` 는 origin/main 에 없는 신규 파일이며, 위 5개 심볼은 `codebase/backend/src/` 전체에서 해당 파일(`production-guards.ts`·`production-guards.spec.ts`·`main.ts`) 외 어디에도 정의·import 되지 않는다. 충돌 없음.

### 3. API endpoint 충돌

Target diff 는 새 API endpoint 를 정의하지 않는다. 충돌 없음.

### 4. 이벤트/메시지명 충돌

WebSocket 이벤트명·BullMQ 큐명·SSE 이벤트명을 신규로 도입하지 않는다. 충돌 없음.

### 5. 환경변수·설정키 충돌

| 변수 | 변경 내용 |
|------|----------|
| `JWT_SECRET` | 기존에도 동일 명칭으로 사용 중. 신규 도입이 아니라 기존 변수에 production 부팅 가드 제약 추가. |
| `ENCRYPTION_KEY` | 동일. 기존 변수에 production 가드 강화. |
| `MCP_ALLOW_INSECURE_URL` | `spec/5-system/11-mcp-client.md §3.2` 에 기존 정의된 변수. enforcement 절 추가만. |

신규 ENV var 명이 추가된 것은 없다. `INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS`, `MIN_JWT_SECRET_LENGTH` 는 TypeScript 내부 상수이며 환경변수가 아니다. 충돌 없음.

### 6. 파일 경로 충돌

| 경로 | 기존 존재 여부 |
|------|--------------|
| `codebase/backend/src/common/config/production-guards.ts` | 기존 없음 |
| `codebase/backend/src/common/config/production-guards.spec.ts` | 기존 없음 |

`common/config/` 폴더의 기존 파일명 패턴은 `<domain>.config.ts` (예: `jwt.config.ts`, `app.config.ts`) 이다. `production-guards.ts` 는 `guards` suffix 를 사용해 시각적으로 구별되며, 기존 파일과 이름이 겹치지 않는다. 파일 경로 충돌 없음.

---

## 요약

refactor 04 C-1·M-4·M-7 변경이 도입한 신규 식별자(`assertProductionConfig`, `isFlagOn`, `INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS`, `MIN_JWT_SECRET_LENGTH`, 파일 `production-guards.ts`) 는 기존 codebase 나 spec 어디서도 다른 의미로 사용 중인 동명 식별자가 없다. 환경변수(`JWT_SECRET`, `ENCRYPTION_KEY`, `MCP_ALLOW_INSECURE_URL`) 는 기존 정의 변수에 가드 제약을 추가한 것으로 신규 도입이 아니다. spec Rationale ID(`R5`) 는 R1–R4 의 자연스러운 연속이며, plan 서브태스크 ID(`refactor 04 C-1`)는 refactor 번호로 스코프가 분리된 로컬 순번이다. CRITICAL 또는 WARNING 수준의 식별자 충돌은 발견되지 않았으며 모두 INFO 수준의 참고 사항이다.

## 위험도

NONE
