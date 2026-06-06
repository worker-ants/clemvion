# 변경 범위(Scope) Review

## 리뷰 대상 커밋

PR-B2a follow-up — LLM_STUB_MODE 문서화 · EIA §8.3 검증 · e2e ENCRYPTION_KEY 교정 + POST /api/llm-configs 경로 커버

---

## 발견사항

### 파일 1: `codebase/backend/test/execution-park-resume.e2e-spec.ts`

- **[INFO]** DB 직접 insert 우회를 정식 API 경로(`POST /api/llm-configs`)로 교체
  - 위치: diff hunk @@ -564,20 +564,26 @@
  - 상세: plan/in-progress/exec-park-b2a-followup.md §④ 에 명시된 조치 그대로 이행. 제거된 `db.query INSERT INTO llm_config` 우회 코드는 ENCRYPTION_KEY 32-char 길이 불일치를 회피하기 위한 임시 방편이었고, 이를 정식 API 호출로 교체하면서 해당 경로의 e2e 커버도 확보. 변경 범위 내.
  - 제안: 없음.

- **[INFO]** 주석 교체 — 이전 주석(우회 이유 설명)이 새 흐름(정식 API 경로)을 설명하는 주석으로 교체됨
  - 위치: diff hunk 상단 주석 블록
  - 상세: 우회 이유를 설명한 주석이 삭제되고 새 경로(암호화 저장 경로 e2e 커버 의도)를 설명하는 주석이 추가됨. 변경 의도와 완전히 일치하며 설명 목적의 정당한 주석 교체임.
  - 제안: 없음.

### 파일 2: `docker-compose.e2e.yml`

- **[INFO]** `ENCRYPTION_KEY` 32-char(16B) → 64-hex(32B) 교정
  - 위치: diff hunk @@ -134,7 +134,14 @@
  - 상세: `crypto.util.ts`의 AES-256-GCM이 `Buffer.from(key,'hex')`로 정확히 32B를 요구하므로 기존 32-char 키는 `POST /api/llm-configs` 호출 시 500을 유발했음. 교정값은 64-hex(32B)로 정확하며, 이는 plan §④(a) 조치 그대로. `INTEGRATION_ENCRYPTION_KEY`는 credentials-transformer가 SHA-256 derive를 사용해 길이 무관이므로 기존 값 유지 — 주석으로 명시. 변경 범위 내.
  - 제안: 없음.

- **[INFO]** 주석 7줄 추가 — ENCRYPTION_KEY 요구사항과 INTEGRATION_ENCRYPTION_KEY의 차이 설명
  - 위치: diff hunk 주석 블록
  - 상세: 길이 요구사항과 "운영 절대 사용 금지" 경고를 문서화하는 주석 추가. 향후 혼동 방지에 유용하며 의도된 변경의 설명적 부산물로 정당함.
  - 제안: 없음.

### 파일 3: `plan/in-progress/exec-park-b2a-followup.md`

- **[INFO]** 신규 plan 파일 생성
  - 위치: 전체 파일
  - 상세: CLAUDE.md 규약에 따라 worktree 작업에 대응하는 plan 파일을 `plan/in-progress/`에 생성. frontmatter `worktree`, `started`, `owner` 포함. 변경 범위 내.
  - 제안: 없음.

### 파일 4: `spec/5-system/14-external-interaction-api.md`

- **[INFO]** §8.3 "Token 일반 규약" — 단일 bullet을 `itk_*` vs `iext_*` 두 family로 명확화
  - 위치: diff hunk @@ -646,7 +646,9 @@
  - 상세: 기존 "secret은 trigger별 분리"가 `iext_*`(per_execution)에도 적용되는 것처럼 읽혀 spec-drift처럼 보였으나, 코드는 의도된 설계(`INTERACTION_JWT_SECRET` 단일 글로벌 secret)를 따르고 있었음. plan §② 에 명시된 "§8.3를 itk_*/iext_* 두 family로 명확화" 조치 그대로. 변경 범위 내.

- **[INFO]** §10.1 Swagger 설명 1줄 업데이트 — `interaction-token` scheme 설명에 두 family 구분 반영
  - 위치: diff hunk @@ -769,7 +771,7 @@
  - 상세: §8.3 변경과 일관성 유지를 위해 Swagger scheme 설명도 동기화. 1줄 변경으로 범위 내.
  - 제안: 없음.

### 파일 5: `spec/5-system/7-llm-client.md`

- **[INFO]** §7 API 키 보안 아래 `§7.1 테스트 전용 Stub 모드 (LLM_STUB_MODE)` 섹션 추가
  - 위치: diff hunk @@ -343,6 +343,13 @@
  - 상세: plan §① "spec/5-system/7-llm-client.md에 LLM_STUB_MODE 섹션 추가" 조치 그대로. env-gated stub, 프로덕션 fail-closed, 캐시 우선순위를 문서화. 추가만 있고 기존 내용 삭제/변경 없음. 변경 범위 내.
  - 제안: 없음.

---

## 요약

5개 파일 모두 `plan/in-progress/exec-park-b2a-followup.md`에 사전 정의된 4개 항목(①②③④)의 범위 안에 있다. 파일 1·2는 plan §④(e2e ENCRYPTION_KEY 교정 + 정식 API 경로 교체), 파일 3은 plan 파일 자체(새 worktree 작업 등록), 파일 4는 plan §②(EIA §8.3 명확화), 파일 5는 plan §①(LLM_STUB_MODE 문서화)에 각각 정확히 대응한다. plan §③(durable 컬럼 doc-sync — data-flow/3-execution.md·0-overview.md)은 이 커밋에 포함되지 않으나, 이는 해당 항목이 project-planner 도메인이어서 별도로 진행될 것으로 보이며 범위 이탈이 아니다. 불필요한 리팩토링·무관한 파일 수정·포맷팅만의 변경·임포트 정리 등 scope creep 요소는 발견되지 않는다.

---

## 위험도

NONE
