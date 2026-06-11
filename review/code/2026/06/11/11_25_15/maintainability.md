# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: consistency review 산출물 + spec 변경 파일 (prod-fail-closed-guards 브랜치)

---

## 발견사항

### [WARNING] `7-llm-client.md` 프로덕션 차단 설명 — 단일 문장 200자 초과, 읽기 어려움
- **위치**: `spec/5-system/7-llm-client.md` §7.1 `**프로덕션 차단**:` 변경 줄
- **상세**: 기존 1문장에 `assertProductionConfig` 참조, 괄호 내 모듈 경로, 관할 env 변수 목록(JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL·OAUTH_STUB·LLM_STUB), 태스크 ID(refactor 04 C-1·M-4·M-7)가 모두 하나의 문장에 중첩 parenthetical 로 들어가 있다. 독자가 주어(`부팅 가드`)·술어(`throw`)·수식(`assertProductionConfig` 위치)·대상(env 목록)을 파악하려면 여러 번 재독이 필요하다.
- **제안**: 핵심 사실 문장과 부연 정보를 분리. 예시:
  ```
  - **프로덕션 차단**: `NODE_ENV=production` + `LLM_STUB_MODE=true` 조합이면 부팅 시 throw 한다.
    가드 위치: `main.ts` 가 호출하는 `assertProductionConfig`(`common/config/production-guards.ts`).
    관할 항목: JWT_SECRET · ENCRYPTION_KEY · MCP_ALLOW_INSECURE_URL · OAUTH_STUB · LLM_STUB (refactor 04 C-1·M-4·M-7).
  ```

---

### [WARNING] `14-external-interaction-api.md` `iext_*` bullet — 이미 긴 parenthetical 에 추가 인라인 삽입
- **위치**: `spec/5-system/14-external-interaction-api.md` §8.3 `iext_*` 서술 항목 (line ~648)
- **상세**: 변경 전에도 이 bullet 은 한 문단 분량의 복잡한 parenthetical 을 포함하고 있었다. 변경 후 `JWT_SECRET`/`ENCRYPTION_KEY` 부팅 가드, `assertProductionConfig` 모듈 경로, `INTERACTION_JWT_SECRET` 예외 설명이 추가로 삽입되어 중첩 괄호(이중 소괄호 + em-dash) 구조가 3단계 이상이 된다. 단일 bullet 안에서 주제가 (1) per_execution 서명 방식, (2) fallback 순서, (3) production fail-closed, (4) assertProductionConfig 예외 설명으로 4가지가 섞인다.
- **제안**: bullet 을 sub-section 또는 nested bullet 으로 분리. 최소한 `assertProductionConfig` 관련 부연을 별도 bullet 또는 blockquote 로 꺼내 depth 를 줄인다. 긴급하지 않으나 후속 문서 정비 시 우선 대상.

---

### [WARNING] `secret-store.md §3.3` 인라인 bullet — 한 항목에 정책·근거·예외·비교가 복합
- **위치**: `spec/conventions/secret-store.md` §3.3 신규 추가 bullet
- **상세**: 신규 bullet 이 (1) placeholder 임을 경고, (2) 운영자 생성 명령(`openssl rand -hex 32`), (3) production 차단 조건(미설정 OR 예시 키), (4) `assertProductionConfig` 모듈 언급, (5) dev/test/e2e 면제를 단일 문장으로 담는다. 앞에 이미 존재하는 "부팅 시 미설정 / 빈 문자열이면 fail-fast" 항목과 내용이 부분 중복(미설정 → fail-fast)되면서 차이(예시 키도 차단)를 구분하기 어렵다. 독자가 두 항목의 관계를 추론해야 한다.
- **제안**: 기존 "미설정/빈 문자열 → fail-fast" 항목과 신규 "예시 키 → production 거부" 항목의 차이를 명시적으로 연결하거나, 두 항목을 묶어 "production fail-closed 조건" 단일 항목으로 재구성한다. 예:
  ```
  - 부팅 시 미설정/빈 문자열이면 fail-fast (`SecretResolver` init 단계).
  - `NODE_ENV=production` 에서 미설정이거나 공개 예시 키(all-zero·옛 `0123…`)이면 부팅 거부
    (`assertProductionConfig`) — 위 fail-fast 에서 잡히지 않는 "예시 키 복붙" 케이스를 추가 차단.
  ```

---

### [INFO] `1-auth.md` §2.1 blockquote — 본문 사실 서술과 Rationale 근거가 혼재
- **위치**: `spec/5-system/1-auth.md` §2.1 신규 blockquote (lines 244+)
- **상세**: blockquote 가 "Access Token 은 `JWT_SECRET` 으로 서명된다"(사실)와 "단일 가드 블록으로 응집한 이유는 §Rationale 참조"(사실 + 근거 위임)을 섞어 놓는다. blockquote 안에서도 `main.ts` 의 `assertProductionConfig` 함수 위치를 괄호로 인라인 설명하고 있어 본문과 Rationale 사이의 경계가 모호하다. 바로 아래 `## Rationale` 섹션에 "Production fail-closed 가드" 항목이 따로 존재하여, 같은 내용이 두 곳에 요약 형태로 분산된다.
- **제안**: blockquote 를 순수 사실 1~2문장으로 압축하고 "설계 근거는 §Rationale 참조" 한 줄만 남긴다. 이미 Rationale 에 상세 설명이 있으므로 blockquote 의 중복 요약은 삭제해도 정보 손실 없음.

---

### [INFO] `1-auth.md` §Rationale "Production fail-closed 가드" 제목에 태스크 ID 포함
- **위치**: `spec/5-system/1-auth.md` §Rationale 신규 항목 제목 `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP (refactor 04 C-1·M-4·M-7)`
- **상세**: 기존 Rationale 항목(`### 1.4.A`, `### 1.5.B`, `### 2.3.A`)은 번호/의미 기반 제목을 쓰고 plan 태스크 ID 를 포함하지 않는다. 신규 항목만 `(refactor 04 C-1·M-4·M-7)` 을 제목에 직접 포함해 패턴 불일치가 생긴다. 태스크 ID 는 plan 관리용이며 spec 의 영속성 있는 이름과 다른 생명주기를 가진다.
- **제안**: 제목을 `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL` 으로 변경하고 태스크 ID 는 본문 첫 줄에 `(refactor 04 C-1·M-4·M-7 로 구현)` 형태로 이동 또는 삭제.

---

### [INFO] consistency review 산출물 두 세트(10_17_44, 10_52_27) — `cross_spec.md` 헤더 불일치
- **위치**: `review/consistency/2026/06/11/10_17_44/cross_spec.md` vs `review/consistency/2026/06/11/10_52_27/cross_spec.md`
- **상세**: 첫 번째 세트(`10_17_44`)의 `cross_spec.md` 는 `# Cross-Spec 일관성 검토 결과` H1 제목과 `## 발견사항` H2 구조를 갖지만, 두 번째 세트(`10_52_27`)의 `cross_spec.md` 는 H1 제목 없이 `## 발견사항` 으로 시작한다. `plan_coherence.md` 도 동일 패턴: 두 번째 세트는 H1 없이 시작. 산출물 파일들의 헤더 구조가 세트 간 일관되지 않아 자동 파싱이나 SUMMARY 집계 시 불안정성이 생길 수 있다. `10_52_27/cross_spec.md` 끝에 `STATUS: SUCCESS` 줄이 있는 반면 다른 파일들은 없거나 다른 형식(마지막 줄에 `STATUS: OK`)을 쓰고 있다.
- **제안**: 동일 sub-agent 가 생성하는 산출물은 동일한 H1 제목 패턴(`# <검토유형> 검토 결과`)을 갖도록 sub-agent 프롬프트 또는 템플릿을 표준화한다.

---

### [INFO] `meta.json` 파일 두 개 모두 trailing newline 없음
- **위치**: `review/consistency/2026/06/11/10_17_44/meta.json` 및 `review/consistency/2026/06/11/10_52_27/meta.json`
- **상세**: diff 에서 두 JSON 파일 모두 `\ No newline at end of file` 로 끝난다. 내용상 문제는 없으나 일부 JSON 파서 / diff 도구가 경고를 내며, 프로젝트의 다른 JSON 파일들이 trailing newline 을 가지고 있다면 일관성이 깨진다.
- **제안**: orchestrator 가 `meta.json` 을 생성할 때 파일 끝에 개행 1개를 추가한다.

---

### [INFO] `_retry_state.json` — `agents_pending` 목록이 완료 후에도 5개 전체 기록
- **위치**: `review/consistency/2026/06/11/10_52_27/_retry_state.json`
- **상세**: `agents_success`, `agents_fatal` 이 모두 빈 배열 `[]` 이고 `agents_pending` 에 5개가 그대로 남아 있다. 파일이 세션 완료 후의 스냅샷이 아니라 초기 상태 그대로 커밋된 것으로 보인다. `agents_success: []` 상태에서 SUMMARY.md 가 생성됐다면 이후 retry 를 위한 상태 추적 로직이 올바르게 종결되지 않은 것일 수 있다. 적어도 완료 후에는 `agents_success` 가 채워진 상태여야 파일의 의미가 정확하다.
- **제안**: 세션이 정상 완료된 경우 `agents_pending → agents_success` 이동을 상태 파일에 반영하고 커밋하거나, 초기 상태 파일임을 파일명이나 필드(`"status": "initial"`)로 명시한다. 현재는 상태 파일이 실행 중 중단된 것과 구분이 안 된다.

---

## 요약

이 변경은 production fail-closed 가드(`assertProductionConfig`)를 spec 에 명문화한 작업으로, 기능·정확성 면에서는 기존 Rationale 과 일관된다. 유지보수성 관점의 주요 문제는 세 개의 spec 파일(`7-llm-client.md`, `14-external-interaction-api.md`, `secret-store.md`)에서 공통적으로 나타나는 **과도한 인라인 밀도**: 단일 bullet 또는 문장 안에 사실 서술·근거·예외·참조·태스크 ID 가 중첩되어 독자가 한 번에 소화하기 어렵다. `1-auth.md` 의 blockquote-Rationale 이중 요약 구조는 같은 내용이 두 곳에 흩어져 수정 시 동기화 부담을 만든다. consistency review 산출물 자체는 H1 헤더 누락, trailing newline, `_retry_state.json` 완료 상태 미반영 등 소규모 일관성 결함이 있으나 내용의 품질에는 영향을 주지 않는다.

---

## 위험도

LOW
