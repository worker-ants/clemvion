# Documentation Review

## 발견사항

### 1. 깨진 spec 내부 앵커 링크 (13건 — 자동 검증 도구 확인)

- **[CRITICAL]** `spec/5-system/11-mcp-client.md#23-internal-bridge` 앵커가 11개 파일에서 참조되지만 실제 헤딩은 `### 2.3 Internal Bridge (in-process)` 이므로 GitHub-style slug 는 `23-internal-bridge-in-process` 로 생성됨. `(in-process)` 부분이 빠진 잘못된 앵커가 전 코드베이스에 퍼져 있음.
  - 위치: `spec/1-data-model.md:247`, `spec/0-overview.md:101`, `spec/2-navigation/4-integration.md:950`, `spec/3-workflow-editor/4-ai-assistant.md:345`, `spec/4-nodes/4-integration/0-common.md:128`, `spec/4-nodes/4-integration/4-cafe24.md:3,11,337`, `spec/4-nodes/3-ai/0-common.md:38`, `spec/4-nodes/3-ai/1-ai-agent.md:25`, `spec/conventions/cafe24-api-metadata.md:3`
  - 상세: `python3 scripts/check-doc-links.py` 실행 결과 BROKEN=13 확인. 헤딩 변경 또는 앵커 일괄 수정이 필요함.
  - 제안: `spec/5-system/11-mcp-client.md`의 `### 2.3 Internal Bridge (in-process)` 헤딩을 `### 2.3 Internal Bridge` 로 단순화하거나, 11개 참조 파일의 앵커를 `#23-internal-bridge-in-process` 로 일괄 수정.

- **[CRITICAL]** `spec/conventions/cafe24-api-metadata.md#6-allowlist-와의-관계` 앵커가 존재하지 않음. 실제 섹션은 `## 7. allowlist 와의 관계` (line 190).
  - 위치: `spec/2-navigation/4-integration.md:951`
  - 상세: 섹션 번호가 6 → 7로 변경됐거나 최초 작성 시 오타. 참조 코드와 실제 헤딩이 불일치.
  - 제안: 참조 앵커를 `#7-allowlist-와의-관계` 로 수정.

- **[CRITICAL]** `spec/4-nodes/3-ai/0-common.md#11-conversation-context` 앵커가 존재하지 않음. 실제 섹션은 `## 10. Conversation Context` (line 129). `## 11. CHANGELOG` 가 그 다음 섹션임.
  - 위치: `spec/conventions/conversation-thread.md:3` (관련 문서 헤더)
  - 상세: 섹션 번호 오기재(11 → 10).
  - 제안: 앵커를 `#10-conversation-context-자동-컨텍스트-주입` 으로 수정.

---

### 2. README FRONTEND_URL 포트 불일치

- **[CRITICAL]** README 내 `backend/.env` 예시(line 183)에 `FRONTEND_URL=http://localhost:3000`으로 명시되어 있으나, 동일 파일 하단 Google OAuth 설정 섹션(line 356)에 `FRONTEND_URL=http://localhost:3002`가 병기되어 있고 주석마저 "기본값이 3002라서 실제 포트와 일치하는지 확인"이라고 안내함. 실제 docker-compose.yml 상 frontend 컨테이너 포트는 3012이며, README 아키텍처 서술(line 217)은 `http://localhost:3000`을 정식 주소로 명기함.
  - 위치: `README.md:183, 217, 354-357` / `docker-compose.yml:176`
  - 상세: 세 가지 포트(3000, 3002, 3012)가 공존하는 혼란 상태. 개발자가 OAuth redirect URI 를 잘못 등록할 위험.
  - 제안: 사용 환경(host dev vs. docker fullstack)별 정확한 포트를 명확히 구분해 기재. docker fullstack 모드는 3012, host dev 는 3000 으로 통일 안내.

---

### 3. README 구조 훼손 — `# integration (SSO)` 잘못된 헤딩 수준

- **[WARNING]** `README.md:328`에 `# integration (SSO)` 가 h1 수준 헤딩으로 작성되어 있어 문서 최상위 제목(`# Clemvion`)과 동등 레벨로 인식됨. 하위 섹션인 `## Google OAuth 연동 설정`과의 위계가 역전되어 있음.
  - 위치: `README.md:328`
  - 상세: 의도는 `## integration (SSO)` 또는 `## Google OAuth 연동 설정`의 서브섹션이어야 함. 현 상태에서 마크다운 렌더러는 이 절을 최상위 문서 제목과 동급으로 취급함.
  - 제안: `# integration (SSO)` → `## integration (SSO)` 로 변경하거나 별도 섹션 없이 `## Google OAuth 연동 설정`으로 합침.

---

### 4. README 환경변수 템플릿에서 `INTEGRATION_ENCRYPTION_KEY` 누락

- **[WARNING]** `README.md` 의 `backend/.env` 예시 블록(line 155–196)에는 `ENCRYPTION_KEY` 만 있고 `INTEGRATION_ENCRYPTION_KEY` 가 없음. 그러나 동일 README의 k8s 런타임 환경변수 안내(line 309)에는 `INTEGRATION_ENCRYPTION_KEY`가 명시되어 있음. backend 코드에서도 실제로 사용됨(`credentials-transformer.spec.ts` 참조).
  - 위치: `README.md:155-196` (env 템플릿 블록)
  - 상세: 신규 개발자가 `.env` 설정 시 `INTEGRATION_ENCRYPTION_KEY`를 누락할 수 있어 통합 자격증명 암호화 실패가 런타임에 발생.
  - 제안: `backend/.env` 예시에 `INTEGRATION_ENCRYPTION_KEY=<32-byte-hex>` 항목 추가.

---

### 5. frontend/README.md 에 npm 전용 규약 위반 — yarn/pnpm/bun 안내

- **[WARNING]** `frontend/README.md:10-14` 의 Getting Started 섹션에 `yarn dev`, `pnpm dev`, `bun dev` 명령이 예시로 나열됨. 프로젝트 규약(`CLAUDE.md`)은 "npm 을 사용한다. (yarn, pnpm 등을 사용하지 않는다.)"를 명시.
  - 위치: `frontend/README.md:10-14`
  - 상세: Next.js scaffold 기본 README가 그대로 남아 있어 프로젝트 규약과 불일치. 기여자 혼란 유발.
  - 제안: yarn/pnpm/bun 줄 제거, npm 단일 명령만 유지.

---

### 6. packages/ 하위 패키지에 README 없음

- **[WARNING]** `packages/expression-engine`과 `packages/node-summary` 에 README.md 가 존재하지 않음.
  - 위치: `/Volumes/project/private/clemvion/packages/expression-engine/`, `/Volumes/project/private/clemvion/packages/node-summary/`
  - 상세: 두 패키지는 frontend/backend 모두에서 `file:` 의존성으로 참조됨. 패키지 목적, API, 빌드 방법이 root README 와 backend README 에 산재되어 있으나 패키지 자체 README 가 없어 패키지 단독 탐색 시 컨텍스트 부재.
  - 제안: 각 패키지에 최소한의 README(목적, 빌드/사용법, export API 간략 설명) 추가.

---

### 7. Spec 파일 대부분 `## Rationale` 섹션 부재 (85개 중 56개)

- **[WARNING]** CLAUDE.md 및 spec/0-overview.md §8 는 "`N-name.md` 본문 끝에 `## Rationale` 섹션 권장"을 정책으로 명시하나, 비-conventions, 비-`_prefix` spec 파일 85개 중 56개(66%)에 Rationale 섹션이 없음.
  - 위치: `spec/4-nodes/1-logic/` 하위 9개, `spec/4-nodes/6-presentation/` 하위 5개, `spec/2-navigation/` 하위 10개, `spec/3-workflow-editor/` 하위 4개, `spec/5-system/` 하위(`11-mcp-client.md`, `12-webhook.md`, `2-api-convention.md`, `3-error-handling.md`, `5-expression-language.md`, `7-llm-client.md`, `9-rag-search.md`) 등
  - 상세: 결정 근거가 코드나 PR 커밋 메시지에 흩어져 미래 기여자가 설계 의도를 추론해야 함.
  - 제안: 특히 설계 결정이 비자명한 complex 노드(loop, parallel, foreach, map, ai-agent 등)와 핵심 시스템 스펙(webhook, mcp-client, error-handling)부터 우선 추가.

---

### 8. Spec 내 deprecated `prd/` 경로 참조 잔존 (Rationale 섹션에 한정)

- **[INFO]** docs-consolidation(2026-05-12) 이후에도 일부 spec Rationale/출처 주석에 `prd/` 경로가 역사 참조 형태로 남아 있음. 실제 파일은 이미 삭제·흡수된 상태이므로 링크로 동작하지 않음.
  - 위치: `spec/5-system/10-graph-rag.md:582,600-601` (Rationale 내 "PRD 위치 prd/9-graph-rag.md"), `spec/3-workflow-editor/4-ai-assistant.md:795,1397,1497-1499`, `spec/5-system/4-execution-engine.md:909`, `spec/5-system/13-replay-rerun.md:9`
  - 상세: `spec/0-overview.md:9`처럼 `> 출처: prd/0-overview.md — docs-consolidation...으로 흡수` 방식은 역사 메모로서 의도적이며 허용 범위. 그러나 Rationale 내 표 항목(`| PRD 위치 | 별도 파일 prd/9-graph-rag.md |`)이나 `## Rationale`의 변경 이력 행으로 기재된 경우는 "아직 참조 가능한 문서인 것처럼" 오독될 수 있음.
  - 제안: Rationale 내 prd/ 경로 언급 시 `(삭제됨, docs-consolidation으로 흡수)` 주석을 병기하거나, 이미 흡수된 spec 경로를 cross-link 로 대체.

---

### 9. spec 내 `memory/` 경로 참조 잔존 — 원본 메모 경로 명시

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md:784,819,892,1004` 와 `spec/5-system/4-execution-engine.md:895`에 `_원본 메모: memory/workflow-ai-assistant-decisions.md_` 형태로 `memory/` 경로가 남아 있음.
  - 위치: 상기 5개 줄
  - 상세: 역사 출처 표기로서 의도된 것이나, `memory/` 디렉토리는 이미 삭제됨. 문서 자동 링크 검사기가 이를 깨진 파일 참조로 탐지할 수 있음.
  - 제안: `_원본 메모 (삭제됨): memory/workflow-ai-assistant-decisions.md_` 로 "(삭제됨)" 명기하거나, `plan/complete/archive/from-memory/` 내 해당 파일이 존재한다면 상대 경로로 교체.

---

### 10. CHANGELOG 단일 "Unreleased" 섹션 — 이전 릴리즈 이력 부재

- **[INFO]** `CHANGELOG.md` 가 "Unreleased — Node Output Contract Unification" 한 개 항목만 존재. 이전 릴리즈 이력(cafe24 통합, replay/rerun, graph-rag, embedding-pipeline 등 최근 다수 기능)이 기록되지 않음.
  - 위치: `CHANGELOG.md`
  - 상세: 최근 커밋 로그에서 cafe24 HMAC nonce, replay/rerun spec, MCP client 등 주요 변경이 다수 확인됨. CHANGELOG 를 단일 "Unreleased" 로 유지하면 외부 기여자나 운영자가 배포 단위 변경을 파악하기 어려움.
  - 제안: 배포 단위(PR/milestone)별 versioned 항목 추가 또는 "Unreleased" 아래 subsection 으로 기능 분류. 최소한 cafe24 통합, replay-rerun spec, MCP client 기능을 별도 항목으로 구분.

---

### 11. backend/README.md 의 환경변수 목록 불완전

- **[INFO]** `backend/README.md`의 환경변수 섹션은 `DB_*`, `REDIS_*`, `JWT_*`, `S3_*`, `MAIL_*`, `ENCRYPTION_KEY` 만 나열하고 `INTEGRATION_ENCRYPTION_KEY`, `OAUTH_STUB_MODE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `APP_URL`, `FRONTEND_URL` 등 실제 필요한 환경변수 다수가 누락됨.
  - 위치: `backend/README.md:29-35`
  - 상세: 간략한 README 이므로 "자세한 내용은 root README 참조" 안내를 추가하거나 root README env 섹션으로 위임하는 링크가 필요.
  - 제안: `backend/README.md`에 root README 의 환경변수 섹션으로 링크 추가 또는 간략 목록 보완.

---

### 12. backend 핵심 서비스에 JSDoc 밀도 저조

- **[INFO]** `backend/src/modules/execution-engine/execution-engine.service.ts` (4,733 라인)는 프로젝트 핵심 복잡 모듈이나 JSDoc 주석이 63개 블록에 불과하며 공개 메서드 대부분에 파라미터/반환값 설명 없음. 노드 핸들러 파일 15개(`split`, `foreach`, `merge`, `switch`, `variable-declaration`, `if-else`, `filter`, `loop`, `code`, `transform`, `form`, `chart`, `template`, `carousel`, `table`)에 JSDoc 블록 자체가 0개임.
  - 위치: `backend/src/nodes/logic/`, `backend/src/nodes/presentation/`, `backend/src/nodes/data/`
  - 상세: spec/conventions/swagger.md 는 DTO JSDoc 주석 추가를 강제하지만 핸들러 함수 자체에 대한 JSDoc 규약은 명시되지 않음. 핵심 비즈니스 로직 함수에 최소한의 목적 주석 부재.
  - 제안: 최소한 핸들러의 `handle()` 메서드에 처리 개요, 특수 포트(error/done), 사이드이펙트 관련 한 줄 JSDoc 추가.

---

### 13. frontend/README.md — create-next-app 보일러플레이트 잔존

- **[INFO]** `frontend/README.md:104-112` 의 "Learn More" 섹션에 Next.js 공식 문서 링크와 GitHub 저장소 링크가 그대로 남아 있음. 프로젝트 고유 문서로 대체되지 않음.
  - 위치: `frontend/README.md:104-112`
  - 상세: 미관상 문제이며 외부 기여자에게 "아직 설정이 안 된 프로젝트"로 오인될 수 있음.
  - 제안: 제거하거나 프로젝트 spec/docs 링크로 대체.

---

## 요약

전반적으로 spec 문서는 단일 진실 원칙(single source of truth)에 맞게 잘 구조화되어 있고 docs-consolidation 전환도 대부분 완료된 상태다. 그러나 `check-doc-links.py` 검증 결과 스펙 간 내부 앵커 링크 13건이 깨져 있으며 — 특히 `spec/5-system/11-mcp-client.md` 헤딩 변경에 따른 파급이 11개 파일에 걸쳐 있어 즉각 수정이 필요하다. README 에서는 FRONTEND_URL 포트(3000/3002/3012 혼재)와 INTEGRATION_ENCRYPTION_KEY 누락이 신규 개발자·운영자 온보딩을 방해하는 실질적 오류다. 56개 spec 파일의 Rationale 섹션 부재는 장기 유지보수 비용을 높이는 구조적 gap이며, 두 내부 패키지에 README 가 없는 점도 보완이 필요하다. frontend/README.md 에 잔존하는 비-npm 패키지 관리자 안내는 프로젝트 규약과 직접 충돌한다.

## 위험도

HIGH
