# 신규 식별자 충돌 검토 — `spec/7-channel-web-chat/3-auth-session.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-28

---

## 발견사항

### 1. 충돌 없음 — frontmatter `id: web-chat-auth-session`

- target 신규 식별자: `web-chat-auth-session`
- 기존 사용처: 전체 spec ID 목록 조회 결과 해당 값은 본 파일에만 존재
- 상세: `spec/7-channel-web-chat/` 내 나머지 5개 파일은 `web-chat-architecture` / `web-chat-widget-app` / `web-chat-sdk` / `web-chat-security` / `web-chat-admin-console` 를 사용하며, 다른 영역 spec ID 와도 겹치지 않는다. `web-chat-` prefix 는 영역 전역 고유성을 명시 확보한 컨벤션이다(`4-security.md` 의 인라인 주석에도 이 의도가 기술되어 있음).
- 결론: 충돌 없음.

---

### 2. **[INFO]** Rationale 번호 `R3`~`R6` — 동일 영역 타 spec 과 번호 충돌 가능성

- target 신규 식별자: `### R3`, `### R4`, `### R5`, `### R6` (auth-session 내 Rationale 절)
- 기존 사용처:
  - `spec/7-channel-web-chat/1-widget-app.md` — `### R4` (Next.js CSR 전용), `### R5` (show/hide 직교 2축), `### R6` (eager 시작)
  - `spec/7-channel-web-chat/2-sdk.md` — `### R2` (스니펫 로더+npm), `### R3` (구독 해제·전역명 충돌 방지), `### R4` (show/hide vs open/close 두 축), `### R5` (command-queue 스텁)
  - `spec/7-channel-web-chat/4-security.md` — `### R1`~`### R5`
  - `spec/5-system/14-external-interaction-api.md` — `### R3` (SSE 채택), `### R4` (per_execution default)
- 상세: Rationale 번호는 **문서 로컬 앵커**이므로 다른 파일의 같은 번호와 교차 충돌은 기술적으로 없다. 그러나 auth-session 본문이 `EIA §R4` 를 참조하는 행(line 86)이 있는데, 같은 문서 내에 `### R4` 가 별도 정의(재로드 401 낙관적 refresh)되어 있어 빠른 독해 시 혼동 소지가 있다. auth-session 의 `§R4` 와 EIA 의 `§R4` 는 의미가 다르다(전자 = 재로드 401 처리 전략, 후자 = per_execution default 선택 근거).
- 제안: `EIA §R4` 참조 문장에 상위 문서명을 명확히 표기하거나, 앵커 링크(`[EIA §R4](../5-system/14-external-interaction-api.md#r4-per_execution-토큰을-default-로)`)를 인라인 삽입해 "본 문서의 R4"와 구분. 기능 상 충돌은 아니므로 INFO 등급.

---

### 3. 충돌 없음 — API endpoint `GET /api/hooks/:path/embed-config`

- target 신규 식별자: `GET /api/hooks/:path/embed-config` (§3 세션 시퀀스 step 0)
- 기존 사용처: `spec/7-channel-web-chat/4-security.md` §3-① 에서 동일 endpoint 를 SoT 로 정의하고, auth-session 이 참조 형태로 인용. EIA spec 에는 존재하지 않음. webhook spec 에도 해당 sub-path 미정의.
- 상세: 두 문서가 동일 endpoint 를 가리키지만 4-security 가 SoT 이고 auth-session 이 부트 시퀀스 설명에서 언급하는 구조다. 중복 선언이 아니라 참조 사용이므로 충돌 없음.

---

### 4. 충돌 없음 — 이벤트/SSE 이름

- target 에서 사용하는 이벤트: `execution.waiting_for_input`, `execution.ai_message`, `execution.completed`/`failed`/`cancelled` (§3 시퀀스 step 4·6·8 등)
- 기존 사용처: EIA spec `§3.2 EIA-NX-02`, SSE stream 정의 (EIA-IN-03, §5) 와 완전히 일치하는 동일 이름을 참조.
- 상세: auth-session 은 이 이름을 신규 정의하지 않고 EIA SoT 를 인용. 충돌 없음.

---

### 5. 충돌 없음 — 환경변수·설정키

- target 은 신규 ENV var 또는 config key 를 도입하지 않는다. `sessionStorage` 키 `clemvion-web-chat:session:*` 는 브라우저 client-side 저장소 키로, 서버 환경변수·설정 키 네임스페이스와 별개 영역이다.
- 기존 사용처: 해당 storage key prefix 는 auth-session 에서만 등장(구 localStorage 잔류 항목 정리 맥락에서 1회 언급). 다른 spec 파일에서 동일 prefix 정의 없음.
- 상세: 충돌 없음.

---

### 6. 충돌 없음 — 파일 경로

- target 경로: `spec/7-channel-web-chat/3-auth-session.md`
- 기존 사용처: `spec/7-channel-web-chat/` 내 파일명은 `0-architecture.md` / `1-widget-app.md` / `2-sdk.md` / `4-security.md` / `5-admin-console.md` / `_product-overview.md`. 번호 `3-` prefix 는 본 파일에만 사용.
- 상세: 명명 컨벤션(숫자 prefix + kebab-case) 을 준수하며, 기존 파일과 중복 없음. 충돌 없음.

---

## 요약

`spec/7-channel-web-chat/3-auth-session.md` 가 도입하는 신규 식별자는 frontmatter ID(`web-chat-auth-session`), 파일 경로, 참조 endpoint, 이벤트 이름 모두 기존 코퍼스와 충돌이 없다. 단 하나 주목할 점은 문서 내부 Rationale 번호 `R4` 와 동일 문서에서 교차 참조하는 `EIA §R4` 가 서로 다른 내용을 가리켜 빠른 독해 시 혼동 여지가 있다는 것이다. 이는 기술적 충돌이 아니라 가독성 문제이므로 INFO 등급으로 분류했다. 전체적으로 식별자 충돌 위험은 없다.

## 위험도

NONE
