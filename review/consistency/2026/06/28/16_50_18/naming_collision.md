# 신규 식별자 충돌 검토

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
대상 문서: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`

---

## 발견사항

### 요구사항 ID 충돌

충돌 없음. `KB-GR-MD-*` / `KB-GR-EX-*` / `KB-GR-DM-*` / `KB-GR-SR-*` / `KB-GR-PA-*` / `KB-GR-UI-*` / `KB-GR-OB-*` / `NF-GR-*` ID군은 `spec/5-system/10-graph-rag.md` 에서만 사용되며 다른 spec 파일에 동일 prefix 의 충돌 ID가 발견되지 않았다.

---

### 엔티티/타입명 충돌

- **[INFO]** `document:graph_error` 이벤트명 dead-declared 불일치
  - target 신규 식별자: `spec/5-system/10-graph-rag.md §6` 의 WebSocket 이벤트 테이블 — `document:graph_started`, `document:graph_progress`, `document:graph_completed`, `document:graph_retry`, `document:graph_failed` (5종 emit)
  - 기존 사용처: `spec/5-system/8-embedding-pipeline.md:293` 및 `spec/5-system/6-websocket-protocol.md:739` 가 graph 이벤트를 6종(`_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`)으로 나열하고 있다. `document:graph_error` 를 포함한 6개 이벤트가 `8-embedding-pipeline.md` 및 `6-websocket-protocol.md` 에 기술된다.
  - 상세: `10-graph-rag.md §6` 이벤트 테이블에는 `document:graph_error` 가 없고 동일 문서 주석에서 "dead-declared"로 설명한다. 반면 `6-websocket-protocol.md:739` 는 `/ _error /` 를 포함한 6종을 열거한다. 이벤트 목록이 두 spec 문서 간 일치하지 않는다. 실제 미emit 이지만 두 문서가 다른 집합을 선언하여 혼란을 준다.
  - 제안: `spec/5-system/6-websocket-protocol.md:739` 의 `_error` 항목 옆에 dead-declared 주석(`— dead-declared, 실제 미emit`)을 추가해 `10-graph-rag.md §6` 주석과 정합시키거나, `10-graph-rag.md §6` 테이블에 `document:graph_error` 행을 추가하고 dead-declared 임을 명시한다. 어느 방향이든 두 문서를 일치시켜야 한다.

---

### API endpoint 충돌

충돌 없음.

- `spec/5-system/1-auth.md §5` 의 WebAuthn 엔드포인트(`/api/auth/2fa/webauthn/...`)는 기존 다른 spec 파일에 동일 method + path 로 중복 정의된 항목이 없다. `spec/2-navigation/10-auth-flow.md` 와 `spec/data-flow/2-auth.md` 는 해당 엔드포인트를 참조만 하며 별도 정의하지 않는다.
- `spec/5-system/10-graph-rag.md §5` 의 `/api/knowledge-bases/:id/re-extract`, `/api/knowledge-bases/:id/entities`, `/api/knowledge-bases/:id/relations`, `/api/knowledge-bases/:id/graph/stats`, `/api/knowledge-bases/:id/graph/visualization` 등도 다른 spec 에서 중복 정의되지 않는다. `spec/2-navigation/5-knowledge-base.md` 와 `spec/data-flow/6-knowledge-base.md` 는 이를 참조 형태로만 기술한다.

---

### 이벤트/메시지명 충돌

- **[INFO]** `document:graph_error` dead-declared 정합 (위 엔티티/타입명 충돌 항목과 동일 이슈)

그 외 충돌 없음. `document:graph_*` 이벤트명 패턴은 `document:embedding_*` 와 대칭적으로 설계되어 있고, embedding/graph 접두 namespace 가 구분되어 있어 이름 충돌이 없다.

---

### 환경변수·설정키 충돌

- **[INFO]** `WEBAUTHN_ALLOW_FALLBACK` 환경변수 단독 참조처
  - target 신규 식별자: `spec/5-system/1-auth.md §1.4.3` 에서 `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_ALLOW_FALLBACK` 4개 env 정의
  - 기존 사용처: grep 결과 `spec/` 전체에서 이 env 변수들은 `spec/5-system/1-auth.md` 에만 정의되며 다른 spec 문서가 독립적으로 재정의하지 않는다. 코드에서는 `codebase/backend/src/common/config/webauthn.config.ts` 가 단독 구현처.
  - 상세: 충돌은 없으나 `WEBAUTHN_ALLOW_FALLBACK` 에 대해 spec 은 "개발·로컬·시연 한정, 운영 사용 금지" 를 명시하고 있고 production fail-closed 가드(§Rationale "Production fail-closed 가드")가 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 류의 운영 절대금지 항목을 throw 로 차단한다고 기술한다. 그러나 `WEBAUTHN_ALLOW_FALLBACK=1` 은 그 가드 목록에 포함되지 않는다. 이는 현재 spec 에서 의도된 누락인지 또는 향후 가드 대상인지가 불명확하다.
  - 제안: spec §Rationale "Production fail-closed 가드" 의 대상 목록에 `WEBAUTHN_ALLOW_FALLBACK` 을 추가하거나, 의도적 비포함 사유를 Rationale 에 한 문장으로 기술한다.

그 외 env 변수(`TRUST_CF_CONNECTING_IP`, `COOKIE_SAMESITE`)는 `spec/5-system/1-auth.md` 와 `spec/data-flow/1-audit.md` 가 정합하게 교차 참조하고 있어 충돌 없음.

---

### 파일 경로 충돌

충돌 없음. `spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 는 기존 파일이며 신규 파일 생성이 아니다. 기존 명명 컨벤션(`N-name.md`) 을 따르고 있고 다른 파일과 경로 중복이 없다.

---

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 가 도입하는 신규 식별자(요구사항 ID·엔티티명·API 엔드포인트·에러 코드·이벤트명·환경변수)는 기존 다른 spec 문서와 의미 충돌을 일으키는 항목이 발견되지 않았다. 다만 WebSocket 이벤트 `document:graph_error` 의 dead-declared 상태가 `spec/5-system/6-websocket-protocol.md` 와 `spec/5-system/10-graph-rag.md §6` 사이에서 표현 방식이 달라 소비자 혼란 가능성이 있으며, `WEBAUTHN_ALLOW_FALLBACK` env var 의 production fail-closed 가드 대상 여부가 spec 상에서 명시되지 않은 점이 참고 사항이다. 두 항목 모두 INFO 수준으로 차단 사안은 아니다.

---

## 위험도

NONE
