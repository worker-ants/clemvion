# 변경 범위(Scope) 리뷰

리뷰 대상: webchat-polish-batch PR (Channel Web Chat — 선택 spec polish + 섹션 C 메모 batch)

---

## 발견사항

### 파일 1: `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`

- **[INFO]** allowlist·enforce 필드에 JSDoc 주석 추가
  - 위치: 두 필드 위 각 1줄 JSDoc 추가
  - 상세: plan(`webchat-polish-batch.md`) 코드 변경 항목 "EmbedConfigDto allowlist·enforce 필드 JSDoc 병기(swagger.md §1-1 패턴)"와 정확히 일치. 내용도 @ApiProperty `description` 을 그대로 발췌한 것이라 중복 표기가 의도적(swagger.md §1-1 패턴). 범위 이탈 없음.

---

### 파일 2: `codebase/channel-web-chat/src/widget/use-widget.test.ts`

- **[INFO]** 임포트 변경 + `safeApiBaseFromQuery` 단위 테스트 5케이스 추가
  - 위치: import 라인(afterEach, vi 추가, safeApiBaseFromQuery import 추가) + 새 describe 블록 28줄
  - 상세: plan 코드 변경 항목 "configFromQuery apiBase 하드닝 — safeApiBaseFromQuery … + export + 단위 5케이스"와 정확히 일치. 추가된 임포트(`afterEach`, `vi`, `safeApiBaseFromQuery`)는 신규 테스트에 모두 사용됨 — 불필요한 임포트 없음. 기존 smoke-check describe 블록 수정 없음. 범위 이탈 없음.

---

### 파일 3: `codebase/channel-web-chat/src/widget/use-widget.ts`

- **[INFO]** `safeApiBaseFromQuery` 함수 신규 추가 + export + `configFromQuery` 내 호출 교체
  - 위치: 기존 `configFromQuery` 직전에 새 함수 삽입(+18줄), `configFromQuery` 내 1줄 변경
  - 상세: plan 코드 변경 항목과 정확히 일치. 함수는 export 되어 테스트에서도 사용됨. 함수 외부(useWidget hook, 기타 callback)는 무수정. 범위 이탈 없음.

---

### 파일 4: `plan/in-progress/webchat-polish-batch.md`

- **[INFO]** 신규 plan 파일 생성
  - 상세: CLAUDE.md 규약("진행 중 작업 → plan/in-progress/<name>.md, frontmatter에 worktree 명시")에 따른 정상 산출물. 기술된 변경 항목이 실제 변경 파일들과 일치함 — 범위 이탈 없음.

---

### 파일 5~12: `review/consistency/2026/06/28/14_36_34/` 하위 파일 전체

- **[INFO]** consistency-check --impl-prep 산출물 신규 생성
  - 상세: CLAUDE.md 규약("일관성 검토 산출물 → review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/")에 따른 정상 산출물. developer SKILL --impl-prep 의무 단계의 결과물이므로 범위 이탈 아님.

---

### 파일 13: `spec/7-channel-web-chat/1-widget-app.md`

- **[INFO]** `§2 입력창` 행 텍스트 표면 정의 정밀화 (SPEC-DRIFT 해소)
  - 위치: §2 화면 구조 표 입력창 행 (1줄 수정)
  - 상세: plan spec 변경 항목 "1-widget-app §2 입력창 행 — 텍스트 표면 = ai_conversation 또는 pending=null(과도) 명시(isTextInputSurface SoT). SPEC-DRIFT 해소"와 정확히 일치. 해당 행 외 다른 섹션 무수정. 범위 이탈 없음.

---

### 파일 14: `spec/7-channel-web-chat/2-sdk.md`

- **[INFO]** §1 메서드 열거에 `resetSession` 추가 (1단어 삽입)
  - 위치: §1 메서드 나열 줄 중간
  - 상세: plan spec 변경 항목 "2-sdk §1 메서드 열거에 resetSession 추가(§1 Overview·§3 테이블과 정렬)"와 정확히 일치. 나머지 §3 테이블·§5 ChatInstance 타입 블록은 이미 resetSession을 보유하고 있어 §1 누락만 정정하는 최소 변경임. 범위 이탈 없음.

---

## 요약

전체 변경이 `plan/in-progress/webchat-polish-batch.md`에 명시된 항목과 1:1 대응한다. 코드 변경은 EmbedConfigDto JSDoc 추가, `safeApiBaseFromQuery` 신규 함수·테스트 2가지뿐이며 기존 hook 구조·외부 인터페이스를 건드리지 않는다. spec 변경은 1-widget-app §2 행 정밀화·2-sdk §1 resetSession 추가 2건이며 해당 행/열거 외 수정이 없다. 불필요한 리팩토링·기능 확장·무관 파일 수정·포맷팅 변경·불필요 임포트 정리는 전혀 발견되지 않았다. consistency-check 산출물과 plan 파일은 개발 규약상 의무 산출물로 over-scoping이 아니다.

---

## 위험도

NONE
