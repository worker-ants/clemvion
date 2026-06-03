# 유지보수성(Maintainability) 리뷰

리뷰 대상: channel-web-chat spec 갱신 (0-architecture.md, 1-widget-app.md, 3-auth-session.md, 4-security.md, spec-impl-evidence.md) + consistency review 산출물

리뷰 일시: 2026-06-03

---

## 발견사항

### [WARNING] `1-widget-app.md` SSE 재연결 단락이 `## 3` 섹션 바디에 플랫으로 삽입돼 소제목 없음
- 위치: `/spec/7-channel-web-chat/1-widget-app.md` diff — `§3.1 채팅 종료 / 새로 시작 / 세션 지속` 테이블 아래 "SSE 재연결" 단락
- 상세: `§3.1` 테이블 바로 아래에 `**SSE 재연결(…):**` 굵은 문자로 시작하는 장문 단락이 삽입됐다. 이 단락은 5문장 이상으로 구성되고 내용적으로는 재연결 절차·버퍼 만료·폴백·미구현 TODO 를 모두 다루는데, `### 3.1.1` 또는 `### 3.1 SSE 재연결 시나리오` 하위 섹션 없이 `§3.1` 본문에 묻혀 있다. 검색·참조 시 앵커가 없어 cross-ref 가 불가능하고, `3-auth-session §3.1` 에서 `[1-widget-app §3.1](./1-widget-app.md)` 로 참조할 때 실제 착지 섹션이 표·단락이 섞인 절 전체라 독자가 원하는 내용을 찾기 어렵다.
- 제안: `**SSE 재연결…**` 단락 앞에 `### 3.1 SSE 재연결 시나리오` (또는 `### 3.1.1 …`) 소제목을 추가해 단독 앵커를 부여하고, `3-auth-session §3.1` 의 cross-ref 를 `[1-widget-app §3.1.1]` 로 갱신한다.

---

### [WARNING] `3-auth-session §3.1` 새 하위섹션이 기존 `§3` 본문 내 "새로고침 지속" 설명과 중복 기술됨
- 위치: `/spec/7-channel-web-chat/3-auth-session.md` diff — 기존 `§3` 본문 마지막 bullet (`새로고침 지속: executionId+단명 토큰…`) + 신규 `### 3.1 재로드 복원 시퀀스`
- 상세: `§3` 본문에 "새로고침 지속: `executionId`+단명 토큰을 iframe-origin storage 저장 → 재로드 시 `GET /:id`+SSE 재연결로 복원"이라는 요약 bullet 이 이미 있다. 그 바로 다음에 `### 3.1` 이 상세 절차(3단계 번호 목록)를 추가하는 구조다. 두 곳 모두 "재로드 복원"을 설명하므로 갱신 시 두 곳을 동기화해야 한다. 단일 진실 원칙 위배 가능성이 있다.
- 제안: `§3` 본문 bullet 을 "상세 절차는 §3.1" 한 줄 cross-ref 로 축약하고 실질 내용은 `§3.1` 에만 두어 중복을 제거한다.

---

### [WARNING] `4-security §2.1` env 키 기술과 `0-architecture §4` env 키 기술이 미묘하게 표현이 달라 동기화 부담 발생
- 위치: `/spec/7-channel-web-chat/4-security.md` diff(L1591-1593) vs `/spec/7-channel-web-chat/0-architecture.md` diff(L1095-1096)
- 상세: `4-security §2.1` 에 추가된 bullet 은 "`WEB_CHAT_WIDGET_ORIGINS`(콤마 구분, `main.ts` → `parseWidgetOrigins`, `common/cors/web-chat-cors.ts`)"라고 파일 경로까지 인라인 링크로 명시한다. `0-architecture §4` 에 추가된 bullet 은 동일 env 키를 기술하되 코드 경로 링크 없이 "allowlist 정책·키 SoT 는 [4-security §2·§2.1]"로만 cross-ref 한다. 두 기술 방식이 다르며, `4-security §2.1` 이 SoT 라고 명시했음에도 두 곳에서 독립적으로 env 키와 함수명을 반복 기술하면 향후 `parseWidgetOrigins` 함수 리네임 시 양쪽을 갱신해야 한다.
- 제안: `0-architecture §4` 의 env 키 bullet 에서 `parseWidgetOrigins` 와 같은 구현 세부를 제거하고 "백엔드 런타임 키 = `WEB_CHAT_WIDGET_ORIGINS` — 상세는 [4-security §2.1]" 수준으로만 남긴다. 구현 세부(함수명·파일 경로)는 SoT 인 `4-security §2.1` 한 곳에만 둔다.

---

### [WARNING] `spec-impl-evidence.md §1` 추가 라인에 인라인 설명 괄호가 기존 다른 항목과 스타일 불일치
- 위치: `/spec/conventions/spec-impl-evidence.md` diff — `- spec/7-channel-web-chat/**.md (클라이언트 채널 영역도 제품 표면(UI/SDK/API)을 약속하므로 frontmatter 의무 대상)`
- 상세: 기존 4개 항목(`spec/2-navigation/**.md` 등)은 설명 없이 경로만 나열된 형태다. 신규 추가 항목만 긴 설명 괄호를 인라인으로 달아 스타일이 불일치한다. 또한 본문 §1 에는 이미 "다음 경로의 spec 파일에 frontmatter 의무 (대상 = inclusive list):" 라는 서두 문장이 있으므로, 개별 항목의 인라인 설명은 과잉이다. Rationale 추가가 더 적절한 위치다.
- 제안: 신규 추가 행에서 인라인 괄호 설명을 제거해 `- spec/7-channel-web-chat/**.md` 만 남기고, 추가 근거(채널 영역이 제품 표면을 약속하므로)는 `## Rationale` 절에 1줄(`R-7. spec/7 영역 추가 근거`) 형태로 이동하거나, `rationale_continuity.md` 가 제안한 대로 R-1 에 합산한다.

---

### [INFO] `1-widget-app §3.2` 테이블의 "패널 전개" 행 설명이 축약 과잉으로 의미 불명확
- 위치: `/spec/7-channel-web-chat/1-widget-app.md` diff — `§3.2` 테이블 두 번째 행 "패널 전개 | `collapsed` / `open` | `open` / `close` | 위 상태기계의 collapsed↔패널 축"
- 상세: "의미" 열이 "위 상태기계의 collapsed↔패널 축"이라고만 되어 있어, `collapsed`/`open` 상태의 실질 의미를 스스로 설명하지 않고 상위 섹션 다이어그램에 위임한다. "위 상태기계"가 가리키는 대상이 `§3` 의 다이어그램인지 `§3.2` 테이블 자체인지 모호하다. 테이블은 독립적으로 읽힐 수 있어야 한다.
- 제안: 의미 열을 "`open` = 패널 펼침(런처 클릭 또는 `open` 명령), `collapsed` = 패널 접힘. `hide` 상태에서는 무효"처럼 자기 완결적으로 기술한다.

---

### [INFO] `4-security §2.1` 신규 bullet 의 문장이 두 줄로 줄바꿈돼 다음 항목과 들여쓰기 시각 계층이 불일치
- 위치: `/spec/7-channel-web-chat/4-security.md` diff L1591-1593 (들여쓰기 2스페이스 줄바꿈)
- 상세: 기존 `§2.1` 의 다른 bullet 들은 단일 행 또는 줄바꿈 없이 기술되어 있는데, 신규 bullet 만 두 줄로 나뉘어 시각적으로 다른 계층처럼 보인다. Markdown 렌더러에 따라 두 번째 줄이 별도 단락으로 처리될 수 있다.
- 제안: 신규 bullet 을 단일 행으로 합치거나, 기존 스타일(줄바꿈 없음 또는 연속 줄바꿈 패턴)에 맞춰 통일한다.

---

### [INFO] `_retry_state.json` 에 newline 없이 파일이 끝남 (POSIX 위반)
- 위치: `review/consistency/2026/06/03/09_46_31/_retry_state.json` diff — 마지막 행 `\ No newline at end of file`
- 상세: `meta.json` 도 동일하게 파일 말미 newline 이 없다. Git diff 에서 `\ No newline at end of file` 경고가 발생하며, POSIX 규약상 텍스트 파일은 LF 로 끝나야 한다. 자동 생성 파일이지만 일관성과 diff 가독성을 위해 개선이 필요하다.
- 제안: 해당 파일을 생성하는 오케스트레이터 스크립트에서 JSON 직렬화 후 파일 말미에 `\n` 을 추가한다.

---

### [INFO] `plan_coherence.md` 의 CRITICAL 항목 bold 표시가 다른 checker 파일과 스타일 불일치
- 위치: `review/consistency/2026/06/03/09_46_31/plan_coherence.md` — 발견사항 항목 제목이 `### [CRITICAL] ...` 이고 내부 필드가 `**target 위치**:` 형태. 반면 `cross_spec.md` 와 `convention_compliance.md` 는 `- target 위치:` bullet 형태.
- 상세: 각 checker 가 독립적으로 작성되다 보니 내부 레이아웃(bold 필드 레이블 vs bullet 레이블)이 달라, SUMMARY.md 를 집계하는 입장에서 파싱/읽기 일관성이 낮다. 유지보수 비용이 누적될 수 있다.
- 제안: checker 프롬프트 템플릿에 필드 레이아웃을 명문화하거나, 적어도 이번 세션 내 checker 들이 동일 구조를 사용하도록 보정한다.

---

## 요약

이번 변경의 핵심 산출물인 spec 파일 4종(0-architecture, 1-widget-app, 3-auth-session, 4-security)과 spec-impl-evidence 는 전반적으로 의도가 명확하고 용어 일관성도 양호하다. 그러나 유지보수성 관점에서 두 가지 중요한 구조 문제가 있다. 첫째, `1-widget-app §3.1` 에 삽입된 SSE 재연결 단락이 소제목·앵커 없이 긴 테이블 절 안에 묻혀 있어 cross-ref 와 탐색이 어렵다. 둘째, `3-auth-session §3` 의 기존 요약 bullet 과 새 `§3.1` 상세 절차가 동일 내용을 두 곳에서 설명하는 중복 구조를 만들어 향후 갱신 시 동기화 부담이 생긴다. `4-security §2.1` 과 `0-architecture §4` 사이의 env 키 기술 중복도 같은 맥락의 문제다. `spec-impl-evidence §1` 의 인라인 설명 스타일 불일치는 사소하나 컨벤션 확장 시 패턴이 되면 관리 비용이 누적된다. consistency review 산출물(checker 파일 간 레이아웃 불일치, JSON 말미 newline 누락)은 자동화 파이프라인 안정성에 영향을 미칠 수 있다.

---

## 위험도

LOW

STATUS: SUCCESS
