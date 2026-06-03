# 신규 식별자 충돌 검토

**대상 문서**: `plan/in-progress/spec-draft-channel-web-chat-gaps.md`

---

## 발견사항

### [INFO] W1~W5 요구사항 ID — 리뷰 내부 레이블, spec 정식 ID 아님
- target 신규 식별자: `W1`, `W2`, `W3`, `W4`, `W5` (plan draft 내부 섹션 레이블)
- 기존 사용처: `review/consistency/2026/06/02/00_56_06/SUMMARY.md` — 다른 검토 세션(cafe24 install throttle 관련)의 WARNING 항목 레이블 `W1`~`W5` 로 이미 사용됨
- 상세: 두 용도 모두 리뷰/plan 내부 참조 레이블이며 spec 정식 요구사항 ID 가 아니다. spec 문서에 `W1`~`W5` 식별자가 기재되는 것은 아니고 plan draft 와 리뷰 문서 내에서만 쓰인다. 범위와 수명이 달라 실제 충돌은 없지만, 같은 기호가 다른 맥락에서 같은 세션 안에서 혼용되면 참조 혼선 가능.
- 제안: target draft 는 이미 "본 보고서 항목 그룹을 가리킨다"고 명시했으므로 현 상태로 허용 가능. 다만 생성되는 spec 변경이 정식 요구사항 ID 를 도입한다면 `WC-NF-01` 등 영역 prefix 를 부여하는 것이 혼선 차단에 유리.

---

### [INFO] `§3.1` 섹션 번호 — `1-widget-app.md` 기존 섹션과 재사용
- target 신규 식별자: `1-widget-app §3.1` 에 신규 하위 섹션 "SSE 재연결 시나리오" 추가 (W1)
- 기존 사용처: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md:61` — `### 3.1 채팅 종료 / 새로 시작 / 세션 지속` 이 이미 존재
- 상세: target W1 은 `§3.1 표 아래 절차 문단 추가` 라고 명시하고 있어 기존 `### 3.1` 섹션에 내용을 삽입하는 방식이다. 섹션 번호가 새로 생기는 것이 아니라 기존 절에 내용을 보강하는 것이므로 섹션 ID 충돌은 없다.
- 제안: target 의 "§3.1 표 아래 절차 문단 추가"가 기존 `### 3.1 채팅 종료 / 새로 시작 / 세션 지속` 이미 존재하는 절이라는 점을 plan에서 명확히 명시하고 있으므로 혼선 없음. 이상 없음.

---

### [INFO] `§3.1 재로드 복원 시퀀스` — `3-auth-session.md` 신규 하위섹션 ID
- target 신규 식별자: `3-auth-session §3` 아래 `### 3.1 재로드 복원 시퀀스(per_execution)` 신설 (W2)
- 기존 사용처: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/3-auth-session.md:36` — 현재 `## 3. 세션 시퀀스 (per_execution)` 다음에 하위 섹션 없이 본문만 있음
- 상세: `3-auth-session.md §3` 에는 현재 하위 절이 없으므로 `### 3.1` 이 충돌 없이 신설 가능. 단 `1-widget-app §3.1` 과 숫자가 동일하나 파일이 달라 앵커 충돌 없음.
- 제안: 충돌 없음. 신설 가능.

---

### [INFO] `WEB_CHAT_WIDGET_ORIGINS` 환경변수 — spec 미등재, 코드에서 구현됨
- target 신규 식별자: `WEB_CHAT_WIDGET_ORIGINS` (W5, `0-architecture.md §4` 및 `.env.example` 에 명시 대상)
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/common/cors/web-chat-cors.ts:108` 및 `/Volumes/project/private/clemvion/codebase/backend/src/main.ts:152` — 코드에서 이미 `process.env.WEB_CHAT_WIDGET_ORIGINS` 로 사용 중. `.env.example` 에는 아직 미등재. `spec/` 어디에도 해당 ENV key 미기재.
- 상세: 코드에서 이미 사용 중인 변수를 spec 과 `.env.example` 에 뒤늦게 명시하는 것이므로 환경변수 이름 자체의 충돌은 없다. 다른 ENV key 가 동일 역할을 이미 점하고 있지 않다.
- 제안: 충돌 없음. target 의 조치가 spec-코드 동기화에 해당하므로 그대로 진행.

---

### [INFO] `INCLUDE_PREFIXES` 에 `spec/7-channel-web-chat/` 추가 — 기존 배열 확장
- target 신규 식별자: `"spec/7-channel-web-chat/"` prefix 를 `INCLUDE_PREFIXES` 배열에 추가 (W3)
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:47-53` — 현재 `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/conventions/` 5개 prefix 등재. `spec/7-channel-web-chat/` 미등재.
- 상세: 기존 `INCLUDE_PREFIXES` 에 없는 새 값이므로 배열 내 중복 없음. `spec/6-brand.md` 는 `EXCLUDE_BASENAMES` 에 포함되어 있고 `spec/6-*` 폴더가 없어 `spec/7-*` 가 `spec/6-*` 와 충돌할 여지 없음.
- 제안: 충돌 없음. W3 의 `_product-overview.md` underscore 제외 기준도 기존 `base.startsWith("_")` 가드로 자동 적용되므로 추가 처리 불요.

---

### [INFO] `blocked` 상태 enum — `1-widget-app §2` 신규 명기
- target 신규 식별자: `blocked` (4-a, `1-widget-app §2` 상태 다이어그램에 명기)
- 기존 사용처: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md:65-68` — §3 임베드 검증에서 "렌더 거부 + 시작 차단" 행위가 기술되어 있으나 `blocked` enum 이름은 명시되지 않음. `2-sdk.md:46` 에 "먼저 `show`" 라는 간접 언급만 있음.
- 상세: target 은 `blocked` 를 `1-widget-app §2` 에 상태 다이어그램 enum 으로 추가하고, `2-sdk §R4` 에 1줄 추가하려 한다. 기존 코드나 spec 에 동일 이름으로 다른 의미가 사용된 곳은 없다.
- 제안: 충돌 없음. `blocked` enum 명기로 `4-security §3-①` 과 명시적 1:1 cross-ref 가 완성되어 오히려 일관성 향상.

---

### [INFO] `## Rationale` 섹션 — `4-security.md` 에 신설
- target 신규 식별자: `4-security.md` 말미에 `## Rationale` 절 신설 (W4)
- 기존 사용처: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md` — 현재 `## Rationale` 섹션 없음. 다른 spec 7 파일(`0-architecture.md`, `3-auth-session.md`)은 Rationale 절 존재.
- 상세: spec 컨벤션 상 `## Rationale` 은 표준 섹션명이고, 해당 파일에 아직 없는 것을 추가하는 것이므로 충돌 없음.
- 제안: 충돌 없음. 컨벤션에 부합.

---

## 요약

target 문서가 도입하는 신규 식별자(W1~W5 내부 레이블, `WEB_CHAT_WIDGET_ORIGINS` ENV key, `spec/7-channel-web-chat/` INCLUDE prefix, `blocked` 상태 enum, `## Rationale` 절, `§3.1 재로드 복원 시퀀스` 하위섹션)는 모두 기존 사용처와 의미 충돌이 없다. 환경변수 `WEB_CHAT_WIDGET_ORIGINS` 는 코드에 이미 구현된 이름이며 spec 에 뒤늦게 등재되는 것이므로 역방향 충돌도 없다. `W1~W5` 레이블이 이전 리뷰 세션(2026-06-02)에서 다른 맥락으로 쓰였으나 리뷰 내부 참조라 scope 가 분리되어 있어 실질 혼선은 없다. 전체적으로 신규 식별자 충돌 위험 없음.

## 위험도

NONE
