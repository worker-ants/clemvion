# 신규 식별자 충돌 검토 — `spec/7-channel-web-chat/3-auth-session.md`

## 발견사항

### 발견사항 1
- **[WARNING]** Rationale 절 내 `R3`~`R6` 번호가 같은 영역의 타 spec 파일들과 중복
  - target 신규 식별자: `3-auth-session.md` 내 `### R3` (토큰 전략), `### R4` (낙관적 refresh), `### R5` (봉투 언랩), `### R6` (sessionStorage)
  - 기존 사용처:
    - `spec/7-channel-web-chat/1-widget-app.md:110` — `### R4. Next.js CSR 전용`
    - `spec/7-channel-web-chat/1-widget-app.md:115` — `### R5. show/hide(가시성) vs open/close(패널) 직교 2축`
    - `spec/7-channel-web-chat/1-widget-app.md:122` — `### R6. 워크플로우 시작 — 패널 open 시(eager)`
    - `spec/7-channel-web-chat/4-security.md:164` — `### R3. 남용 방어 rate-limit`
    - `spec/7-channel-web-chat/4-security.md:196` — `### R4. 마크다운 sanitize`
    - `spec/7-channel-web-chat/4-security.md:202` — `### R5. iframe sandbox allow-same-origin`
  - 상세: Rationale 번호는 파일 내에서만 로컬 식별자로 쓰이지만, 같은 영역(`7-channel-web-chat/`) 안의 여러 파일이 `R3`, `R4`, `R5`, `R6` 를 각각 다른 주제에 사용하고 있다. 이미 크로스 문서 참조 시 파일명을 명시(`[3-auth-session §R6]`, `[1-widget-app §R6]`)하는 관행이 자리 잡혀 있어 실제 링크 충돌은 없고, 다른 문서들의 참조도 모두 파일 경로를 함께 기술하고 있다(1-widget-app.md:77, 4-security.md:37, 2-sdk.md:94 등). 따라서 기계적 충돌은 없으나, 번호만 보고 같은 영역 내 다른 파일의 Rationale 절로 오독할 혼동 가능성이 있다.
  - 제안: 현 파일 내 로컬 참조(`근거 §R6`, `(§R3)`)는 독자가 같은 파일 안을 찾도록 의도된 것이므로 동작 상 문제 없다. 단, 영역 내 Rationale 번호를 파일 간 겹치지 않도록 번호 공간을 나누거나(`3-auth-session` 은 R10~), 파일 약칭 prefix(`AS-R6`, `WA-R6`)를 사용하는 컨벤션을 영역 관습으로 정립하면 혼동 여지가 사라진다. 긴급 수정 사항은 아니나 명확화 권장.

### 발견사항 2
- **[INFO]** `eia-client.ts` 코드 파일이 두 개의 spec 에서 동시에 소유됨
  - target 신규 식별자: `3-auth-session.md` frontmatter `code:` 항목 — `codebase/channel-web-chat/src/lib/eia-client.ts`
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:13` frontmatter `code:` — 동일 파일 `codebase/channel-web-chat/src/lib/eia-client.ts` 를 이미 등재
  - 상세: 같은 구현 파일이 두 spec 의 `code:` 항목에 중복 열거되어 있다. `eia-client.ts` 는 EIA 표면을 소비하는 클라이언트 모듈이므로 `14-external-interaction-api.md`(서버 계약 명세)와 `3-auth-session.md`(클라이언트 세션 흐름 명세) 양쪽 모두 관련이 있는 것은 타당하다. 의미 충돌은 없으며 spec 소유권이 양분되는 것도 아니다. 다만, coverage 도구가 이 파일을 두 spec 에 동시에 귀속시키는 경우 중복 카운트가 발생할 수 있다.
  - 제안: 선택적 명확화. EIA spec 을 "서버측 계약 소유자", `3-auth-session.md` 을 "클라이언트 구현 구현 증거"로 역할을 주석 구분해 두거나, `eia-client.ts` 항목을 위젯 영역 spec(`3-auth-session.md`)에만 두고 EIA spec 에서는 제거하거나 `references:` 구분 키로 분리할 수 있다. 어느 쪽이든 기능적 문제는 없다.

### 발견사항 3
- **[INFO]** spec 문서 `id: web-chat-auth-session` — 충돌 없음 (유일)
  - target 신규 식별자: frontmatter `id: web-chat-auth-session`
  - 기존 사용처: 전체 `spec/` 트리의 frontmatter `id:` 목록을 확인한 결과 `web-chat-auth-session` 은 오직 `3-auth-session.md` 에서만 사용됨. 충돌 없음.
  - 제안: 해당 없음.

### 발견사항 4
- **[INFO]** 파일 경로 `spec/7-channel-web-chat/3-auth-session.md` — 기존 관례와 일치
  - target 신규 식별자: 파일 이름 및 경로
  - 기존 사용처: `spec/7-channel-web-chat/` 디렉토리는 이미 `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `4-security.md`, `5-admin-console.md`, `_product-overview.md` 를 보유. 3번 슬롯이 비어 있었고, `_product-overview.md` 가 이 위치에 `3-auth-session.md` 를 이미 명시적으로 열거하고 있음.
  - 제안: 해당 없음. 컨벤션 준수.

## 요약

`spec/7-channel-web-chat/3-auth-session.md` 가 도입하는 식별자 중 CRITICAL 수준의 충돌은 발견되지 않는다. 문서 ID(`web-chat-auth-session`), 파일 경로, API 엔드포인트(`GET /api/hooks/:path/embed-config` — SoT 는 `4-security.md`로 이미 확립), SSE/토큰 식별자(`iext_*`, `itk_*`) 는 모두 기존 정의와 일치하거나 충돌이 없다. 주목할 사항은 같은 영역 내 `R3`~`R6` Rationale 번호가 `1-widget-app.md`·`4-security.md` 와 번호 공간에서 겹치는 점이다. 실제 크로스 참조는 파일 경로를 함께 기술하는 관행으로 이미 해소되어 있어 기능 충돌은 없으나, 번호만 보고 오독할 혼동 가능성이 남아 있어 WARNING 으로 분류한다. `eia-client.ts` 코드 파일의 이중 등재는 양쪽 spec 의 관심사가 달라 의미 충돌이 아닌 INFO 수준이다.

## 위험도

LOW
