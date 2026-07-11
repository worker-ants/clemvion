# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/spec-draft-webchat-i18n-scope.md` (spec draft, --spec)

## 발견사항

- **[WARNING]** `2-sdk.md` Rationale 신규 `### R6` 이 같은 파일 안의 기존 bare `§R6` 참조와 식별자 충돌
  - target 신규 식별자: Edit C 가 `spec/7-channel-web-chat/2-sdk.md` 의 `## Rationale` 절에 신설하는 `### R6. locale 은 reserved(삭제 대신 정직화)` 로컬 heading (기존 `R2`~`R5` 다음 번호라 파일-로컬 넘버링 규칙 자체는 정합적).
  - 기존 사용처:
    - `spec/7-channel-web-chat/2-sdk.md:108` — `"...중복 시작하지 않는다(eager-start 가드 §R6·세션 복원)."` 파일 링크 없는 **bare** `§R6` 참조.
    - 이 bare 참조가 실제로 가리키는 대상은 **`1-widget-app.md` 의 `### R6. 워크플로우 시작 — 패널 open 시(eager)`** (`spec/7-channel-web-chat/1-widget-app.md:137`, 34행의 `eager-start §R6` 자기참조와 동일 개념) — "eager-start" 라는 용어 자체가 `1-widget-app.md` 에서만 정의됨(`grep eager-start` 결과 `2-sdk.md:108` 과 `1-widget-app.md:34,209` 두 파일뿐).
    - 참고로 바로 위 `2-sdk.md:101-102` 는 같은 패턴의 `§R6` 를 `[3-auth-session §R6](./3-auth-session.md)` 로 **명시적으로 파일-한정**해 링크한다 — 108행만 그 관례를 안 따르고 파일명을 생략했다.
  - 상세: `2-sdk.md` 는 현재 로컬 Rationale 이 `R2`~`R5` 뿐이라 108행의 무한정 `§R6` 는 (지금은) 자기 파일 안에서 오독될 여지가 없었다. 그러나 target 이 같은 파일에 **진짜 로컬 `### R6`**(주제: locale reserved) 을 신설하면, 같은 문서 안에 "R6" 라는 문자열이 세 가지 다른 것을 가리키게 된다 — (1) `1-widget-app.md#R6`(eager-start, 108행이 실제로 의도하는 대상) · (2) `3-auth-session.md#R6`(sessionStorage, 101-102행이 명시 링크) · (3) `2-sdk.md` 자신의 신규 `### R6`(locale reserved). 108행은 파일명이 없으므로 독자·후속 편집자가 "가장 가까운 R6" 인 (3) 신규 로컬 heading으로 오귀속하기 쉽다 — 특히 108행이 §4(Boot config, `locale` 필드 바로 다음 절)와 인접해 있어 "locale 관련 R6" 라는 착각과 정확히 겹친다.
  - 제안: Edit C 를 적용할 때 108행의 기존 bare `§R6` 도 같은 PR 로 동시에 `[1-widget-app §R6](./1-widget-app.md)` 형태로 파일-한정 링크화한다 (101-102행이 이미 쓰는 패턴과 동일하게). side-effect 점검 대상에 이 항목을 추가해 두면 리뷰 시 누락되지 않는다. (대안: 신규 Rationale 항목 번호를 `R6` 대신 다른 표기로 바꾸는 것은 파일-로컬 순번 관례(R2→R3→R4→R5→R6) 를 깨므로 비권장 — 기존 bare 참조 쪽을 명확화하는 편이 규약과 정합적이다.)

## 요약

target 이 실제로 새로 발급하는 식별자는 사실상 `spec/7-channel-web-chat/2-sdk.md` Rationale 의 `### R6` 하나뿐이다 (Edit A/B/D 는 기존 절·필드에 문장을 덧붙이거나 이미 존재하는 비목표 리스트에 새 불릿을 추가할 뿐, 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·파일 경로를 전혀 신설하지 않는다 — 확인: `i18n-userguide.md` 에 `## 적용 범위 (Scope)` 동일 heading 부재, `_product-overview.md` §2 비목표에 EN 다국어화 관련 기존 불릿 부재, `5-admin-console.md` §4:117-118 의 `locale` 필드·앵커가 실제로 target 인용과 일치, 이 영역 어떤 파일도 markdown footnote 문법(`[^..]`)을 안 씀). 유일한 리스크는 그 `### R6` 이 같은 파일의 기존 bare `§R6` 참조(실제로는 `1-widget-app.md` 의 eager-start R6 를 가리킴)와 표면적으로 겹쳐 독자가 오귀속할 수 있다는 점이며, 이는 108행을 명시적 파일 링크로 바꾸는 1줄 수정으로 해소 가능하다. 전반적으로 target 은 신규 식별자 발급이 거의 없는 저위험 문서 정합화 draft다.

## 위험도

LOW
