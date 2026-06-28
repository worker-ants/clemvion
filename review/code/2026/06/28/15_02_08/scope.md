# 변경 범위(Scope) 리뷰

리뷰 대상: Channel Web Chat — 선택 spec polish + 섹션 C 메모 batch (`webchat-polish-batch`)
일시: 2026-06-28 15:02:08

---

## 발견사항

### 코드 파일

#### `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`

- **[INFO]** `allowlist`·`enforce` 필드 JSDoc 주석 2줄 추가
  - 위치: 두 필드 직전 각 1줄 `/** ... */` 블록
  - 상세: `plan/in-progress/webchat-polish-batch.md` 코드 변경 항목 "EmbedConfigDto allowlist·enforce 필드 JSDoc 병기(swagger.md §1-1 패턴)"와 정확히 1:1 대응. 기존 `@ApiProperty({ description })` 내용을 그대로 JSDoc 에 병기하는 방식은 swagger.md §1-1 컨벤션 상 의도된 중복이므로 불필요한 변경이 아님. 나머지 클래스 구조·필드·데코레이터 전혀 무수정.
  - 제안: 없음. 범위 이탈 없음.

#### `codebase/channel-web-chat/src/widget/use-widget.ts`

- **[INFO]** `safeApiBaseFromQuery` 신규 함수 추가 (+21줄) + `configFromQuery` 내 1줄 교체
  - 위치: 기존 `configFromQuery` 함수 직전 삽입 + line `const apiBase = q.get("apiBase") ?? undefined` → `safeApiBaseFromQuery(q.get("apiBase"))` 교체
  - 상세: plan 코드 변경 항목 "configFromQuery apiBase 하드닝 — `safeApiBaseFromQuery`(http(s) 스킴만 허용, javascript:/data:/상대경로 거름) + export + 단위 5케이스"와 정확히 일치. 신규 함수가 `export`된 것도 테스트 접근성 확보 목적으로 plan 에 명시. `useWidget` hook 본체·기타 callback 등 연관 코드 무수정. 불필요한 리팩토링·포맷팅 변경 없음.
  - 제안: 없음. 범위 이탈 없음.

#### `codebase/channel-web-chat/src/widget/use-widget.test.ts`

- **[INFO]** import 라인 변경 + `safeApiBaseFromQuery` 테스트 describe 블록 추가 (+37줄)
  - 위치: import에 `afterEach`, `vi`, `safeApiBaseFromQuery` 추가 + 새 describe 블록
  - 상세: plan 코드 변경 항목 "단위 5케이스" 추가와 정확히 일치. 추가된 import 3개 (`afterEach`, `vi`, `safeApiBaseFromQuery`)는 신규 테스트 블록에서 전부 사용되며 불필요한 import 없음. 기존 smoke-check describe 블록 무수정.
  - 제안: 없음. 범위 이탈 없음.

### Spec 파일

#### `spec/7-channel-web-chat/1-widget-app.md`

- **[INFO]** §2 화면 구조 표 "입력창" 행 1줄 수정
  - 위치: §2 테이블 입력창 행 전체 (`awaiting_user_message + ai_conversation 표면` → 텍스트 표면 + SoT `isTextInputSurface` 명시)
  - 상세: plan spec 변경 항목 "1-widget-app §2 입력창 행 — 텍스트 표면 = ai_conversation 또는 pending=null(과도) 명시, SPEC-DRIFT 해소"와 1:1 일치. 해당 행 외 다른 섹션·헤딩·내용 무수정.
  - 제안: 없음. 범위 이탈 없음.

#### `spec/7-channel-web-chat/2-sdk.md`

- **[INFO]** §1 메서드 목록에 `resetSession` wc:command 전용 명시 행 추가 + §3 설명 보강 (+3줄)
  - 위치: §1 스니펫 로더 메서드 목록 단락 끝 1줄 추가 + §3 `resetSession` 설명 블록 마지막 1줄 보강
  - 상세: plan spec 변경 항목 "2-sdk resetSession 정정 — §1 ClemvionChat 메서드 목록에서 resetSession 제거(wc:command 전용, npm 미노출) + §1·§3 에 명시"와 정확히 일치. 추가는 최소 범위에 국한되어 있으며 나머지 §3 내용·§5 ChatInstance 타입 블록 무수정.
  - 제안: 없음. 범위 이탈 없음.

#### `spec/7-channel-web-chat/4-security.md`

- **[INFO]** §1 보안 정책 요약 표에 `apiBase 입력 검증` 행 신설 (+1줄)
  - 위치: §1 보안 정책 표 중간 신규 행 1개 삽입
  - 상세: plan spec 변경 항목 "4-security §1 apiBase 입력 검증 행 신설 — ai-review SPEC-DRIFT #1 해소"와 정확히 일치. `safeApiBaseFromQuery` 코드가 spec 에 명세 없이 구현된 것을 ai-review에서 지적하여 신설한 보완 항목이다. 삽입 위치가 기존 보안 정책 표 내부에 국한되며 다른 섹션 무수정.
  - 제안: 없음. 범위 이탈 없음.

#### `spec/7-channel-web-chat/5-admin-console.md`

- **[INFO]** `## Overview (제품 정의)` → `## Overview` 헤딩 정규화 (+`§2·§R1` 링크 수정 2곳)
  - 위치: 18행 헤딩 텍스트 변경 + 60·244행 `[0-architecture R5]` → `[0-architecture §R2]`
  - 상세: plan spec 변경 항목 "5-admin-console Overview 표준 정렬" 및 "§2 `[0-architecture R5]` → `§R2` 정정"과 정확히 일치. 헤딩 수식어 제거 및 잘못된 Rationale 참조 번호 교정이며 내용 변경 없음.
  - 제안: 없음. 범위 이탈 없음.

### 플랜/리뷰 산출물 파일

#### `plan/in-progress/webchat-polish-batch.md` (신규)

- **[INFO]** 신규 plan 파일 생성
  - 상세: CLAUDE.md 규약 "진행 중 작업 → `plan/in-progress/<name>.md`, frontmatter 에 `worktree` 명시"에 따른 필수 산출물. 기술된 변경 항목이 실제 변경 파일들과 1:1 대응하며, spec/code 변경 범위가 plan 에 명시된 것 외로 확장된 것이 없음.
  - 제안: 없음.

#### `review/code/2026/06/28/14_49_11/` 하위 파일들 (신규)

- **[INFO]** `/ai-review` (14_49_11) 1차 리뷰 산출물
  - 상세: CLAUDE.md 규약 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"에 따른 필수 산출물. 개발자 SKILL의 리뷰 의무 단계 결과물이므로 over-scoping이 아님.
  - 제안: 없음.

#### `review/consistency/2026/06/28/14_36_34/` 하위 파일들 (신규)

- **[INFO]** `/consistency-check --impl-prep` 산출물
  - 상세: CLAUDE.md 규약 "일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"에 따른 필수 산출물. developer SKILL --impl-prep 의무 단계의 결과물이므로 범위 이탈 아님.
  - 제안: 없음.

#### `review/consistency/2026/06/28/14_49_11/` 하위 파일들 (신규)

- **[INFO]** `/consistency-check --impl-done` 산출물
  - 상세: 동일. --impl-done 단계 의무 산출물.
  - 제안: 없음.

---

## 요약

전체 34개 변경 파일이 `plan/in-progress/webchat-polish-batch.md`에 명시된 항목과 완전히 1:1 대응한다. 코드 변경은 `EmbedConfigDto` JSDoc 병기와 `safeApiBaseFromQuery` 신규 함수·테스트 추가 2건이며, 기존 hook 구조·외부 API 인터페이스를 건드리지 않는다. spec 변경은 `1-widget-app §2` 입력창 행 정밀화, `2-sdk` resetSession wc:command 전용 명시, `4-security §1` apiBase 검증 행 신설, `5-admin-console` 헤딩 정규화·링크 수정 4건이며 각 변경이 해당 섹션/행에 국한된다. 불필요한 리팩토링, 기능 확장, 무관 파일 수정, 포맷팅 변경, 불필요한 import 추가/삭제, 의도하지 않은 설정 파일 변경은 전혀 발견되지 않았다. plan·review·consistency 산출물은 개발 규약상 의무 산출물로 over-scoping에 해당하지 않는다.

---

## 위험도

NONE
