# 신규 식별자 충돌 검토

scope: `spec/5-system/14-external-interaction-api.md` (+ `spec/5-system/7-llm-client.md`, `spec/data-flow/3-execution.md`, `codebase/backend/test/execution-park-resume.e2e-spec.ts`, `docker-compose.e2e.yml`)

diff-base: origin/main

---

## 발견사항

### 1. 요구사항 ID / 엔티티·타입명 충돌

이번 diff 에서 새로 부여된 요구사항 ID 는 없다. 기존 `EIA-AU-*`, `EIA-IN-*`, `EIA-NX-*` 식별자 본문도 변경되지 않았다. 신규 엔티티·DTO·인터페이스 명 도입도 없다.

판정: **충돌 없음.**

---

### 2. API endpoint 충돌

- **이번 diff 가 새로 도입한 endpoint**: 없음. e2e 테스트가 기존 `POST /api/llm-configs` 를 호출하는 방식으로 교체되었을 뿐, 엔드포인트 자체는 기존 spec (`spec/5-system/7-llm-client.md`) 에 이미 정의된 것이다.
- `spec/5-system/14-external-interaction-api.md` 의 spec 변경은 §8.3 기존 토큰 기술 문서를 더 상세화한 것으로, 새 endpoint 를 추가하지 않는다.

판정: **충돌 없음.**

---

### 3. 환경변수·설정키

- **`INTERACTION_JWT_SECRET`** — `spec/5-system/14-external-interaction-api.md` §8.3 에서 새로 명시적으로 기술되었다. 코드(`interaction-token.service.ts:89`)에는 이미 구현되어 있었고, 이번 diff 가 spec 에 처음 등장시킨 식별자다.
  - `.env.example` 에 항목이 없다. `JWT_SECRET` 과 혼동될 소지가 있지만 별개 변수이며 코드 fallback 체인(`INTERACTION_JWT_SECRET` → `jwt.secret` → `JWT_SECRET` → `'interaction-fallback'`)이 이미 구현되어 있어 충돌은 없다.
  - `JWT_SECRET`(`codebase/backend/.env.example:79`) 과 이름이 유사하나 의미와 도메인이 명확히 구분된다.

- **`LLM_STUB_MODE`** — `spec/5-system/7-llm-client.md` §7.1 에서 새로 spec 화되었다. 코드(`main.ts`, `llm.service.ts`)와 `docker-compose.e2e.yml:150` 에 이미 존재하며 spec 이 구현을 따라잡는 문서화 추가다.
  - `OAUTH_STUB_MODE`(`codebase/backend/.env.example:202`)와 명명 패턴이 동일하며 의미도 유사(stub 모드 게이트)다. 두 변수가 별도 도메인(LLM vs OAuth)에 각자 쓰인다는 점은 명확하고 충돌·혼용 소지는 낮다.
  - `.env.example` 에 `LLM_STUB_MODE` 항목이 없다. `OAUTH_STUB_MODE` 는 `.env.example:202` 에 있으나 `LLM_STUB_MODE` 만 누락된 상태다. 이는 문서 불일치(INFO 수준)이며 기능 충돌은 아니다.

판정:

- **[INFO]** `INTERACTION_JWT_SECRET` — spec 에 처음 등장하는 ENV key 이나 코드 구현은 선행 완료. `.env.example` 등재 누락.
  - target 신규 식별자: `INTERACTION_JWT_SECRET` (`spec/5-system/14-external-interaction-api.md` §8.3)
  - 기존 사용처: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:89` 에서 이미 사용 중 (spec 이 코드를 뒤따른 문서화)
  - 상세: 새 이름이 아니라 기존 코드 변수를 spec 에 처음 명시한 것. `.env.example` 에 항목 미등재 — 운영자가 키를 모를 수 있음.
  - 제안: `codebase/backend/.env.example` 에 `INTERACTION_JWT_SECRET=` 항목을 `JWT_SECRET` 근처에 추가해 운영자 가시성 확보.

- **[INFO]** `LLM_STUB_MODE` — spec §7.1 신설이나 코드·docker-compose 선행 구현. `.env.example` 누락.
  - target 신규 식별자: `LLM_STUB_MODE` (`spec/5-system/7-llm-client.md` §7.1)
  - 기존 사용처: `docker-compose.e2e.yml:150`, `codebase/backend/src/main.ts:56`, `codebase/backend/src/modules/llm/llm.service.ts:78`
  - 상세: `OAUTH_STUB_MODE` 와 패턴이 동일하므로 혼동 위험은 낮다. `.env.example` 에만 항목이 없다.
  - 제안: `.env.example` 에 `# LLM_STUB_MODE=false` 항목을 `OAUTH_STUB_MODE` 인근에 추가.

---

### 4. 이벤트·메시지명 충돌

이번 diff 는 새 webhook·queue·SSE 이벤트 이름을 도입하지 않는다. `spec/data-flow/3-execution.md` 의 변경도 기존 시퀀스 다이어그램 메모 갱신이며 새 이벤트명은 없다.

판정: **충돌 없음.**

---

### 5. 파일 경로 충돌

이번 diff 가 생성하는 새 파일은 없다. 기존 파일 수정만 포함된다. 명명 컨벤션 위반 없음.

판정: **충돌 없음.**

---

### 6. 토큰 prefix 충돌

- `iext_`, `itk_`, `wsk_` 는 `spec/1-data-model.md:587` 에 이미 외부 상호작용 API 도메인 prefix 로 열거되어 있으며, 이번 diff 가 §8.3 에 상세화한 내용과 일치한다. prefix 의 의미 충돌 없음.

판정: **충돌 없음.**

---

## 요약

이번 변경(exec-park-b2a-followup)의 식별자 충돌 위험은 매우 낮다. 핵심 코드 변경(`execution-park-resume.e2e-spec.ts`)은 기존 `POST /api/llm-configs` endpoint 를 이미 올바르게 사용하는 방식으로 교체한 것이며, 새 식별자를 도입하지 않는다. Spec 변경(`14-external-interaction-api.md` §8.3, `7-llm-client.md` §7.1)은 기존 코드 구현을 문서화하는 추격(catch-up) 작업이다. 유일한 주의 사항은 `INTERACTION_JWT_SECRET`과 `LLM_STUB_MODE` 두 ENV 변수가 `.env.example`에 미등재되어 있다는 것으로, 이는 운영자 가시성 문제이지 식별자 충돌이 아니다.

## 위험도

LOW
