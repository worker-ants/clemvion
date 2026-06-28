# 부작용(Side Effect) 리뷰 결과

리뷰 대상: 44개 파일 변경 (review/ 산출물 35개 + spec/ 문서 9개)
Diff base: origin/main

---

## 발견사항

### - **[INFO]** review/ 산출물 파일 생성 — 의도된 파일시스템 부작용
  - 위치: `review/consistency/2026/06/28/14_49_11/`, `15_02_09/`, `15_41_51/`, `16_05_14/`, `16_48_46/` 하위 파일들 (파일 1~35)
  - 상세: 모두 새 파일 추가(new file mode)이며, 기존 파일을 수정하지 않는다. `review/` 는 프로젝트 규약상 코드 리뷰 산출물 저장 위치(`CLAUDE.md §정보 저장 위치`)이므로 의도된 기록이다. 상태 변경 없음.
  - 제안: 해당 없음.

### - **[INFO]** `_retry_state.json` 파일 내 절대 경로 하드코딩 (파일 5, 13, 21, 29)
  - 위치: `review/consistency/2026/06/28/15_02_09/_retry_state.json`, `15_41_51/_retry_state.json`, `16_05_14/_retry_state.json`, `16_48_46/_retry_state.json`
  - 상세: 각 JSON 파일이 `/Volumes/project/private/clemvion/.claude/worktrees/<worktree-name>/...` 형태의 머신 로컬 절대 경로를 하드코딩하고 있다. 서로 다른 머신이나 경로 레이아웃에서 이 상태 파일을 재사용하면 경로가 깨진다. 그러나 이 파일들은 일회성 세션 상태 추적용이며 재실행 시 재생성되므로 런타임 부작용은 없다.
  - 제안: 없음(현행 용도상 허용됨). 단, 재시도 루프에서 이 파일을 읽어 경로를 파싱하는 오케스트레이터가 있다면 다른 환경에서 파일을 찾지 못할 수 있음을 주의.

### - **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` 헤딩 변경 — 마크다운 앵커 변경 (파일 43)
  - 위치: `spec/7-channel-web-chat/5-admin-console.md` 15행
  - 상세: `## Overview (제품 정의)` → `## Overview` 로 헤딩 텍스트가 변경됐다. 마크다운 자동 앵커가 `#overview-제품-정의` → `#overview` 로 바뀐다. 이 앵커를 외부에서 직접 참조하는 링크가 있다면 깨진다. 일관성 검토(파일 1 naming_collision.md 발견사항 5)에서 grep 확인 결과 자가 참조 및 타 spec 파일에서의 직접 앵커 참조가 없음이 확인되었다.
  - 제안: 없음.

### - **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` 내부 링크 변경 — 존재하지 않던 앵커 수정 (파일 43)
  - 위치: `spec/7-channel-web-chat/5-admin-console.md` 63행, 244행
  - 상세: `[0-architecture R5](./0-architecture.md)` → `[0-architecture §R2](./0-architecture.md)` 로 참조 번호가 수정됐다. `R5` 는 실제 존재하지 않던 잘못된 앵커였으므로 링크가 이미 죽어있던 상태였다. 수정이 링크를 올바른 앵커로 교정한다. 부작용 없음.
  - 제안: 없음.

### - **[INFO]** `spec/5-system/2-api-convention.md` 공개 코드 기본값 목록 변경 (파일 38)
  - 위치: `spec/5-system/2-api-convention.md` 159행 (`code` 기본값 목록)
  - 상세: `code` 상태코드별 기본값 목록에 `413=PAYLOAD_TOO_LARGE` 가 추가됐다. 이 목록은 spec 문서이므로 코드에 직접 부작용은 없다. 그러나 `GlobalExceptionFilter` 가 이 목록을 참조해 동작하는 테스트가 있다면 413 처리 흐름이 변경된 것이 영향을 줄 수 있다. 실제 코드(filter 구현)는 이번 diff 에 포함되지 않았으며, spec 문서만 갱신된 것이다.
  - 제안: 없음(spec 문서 변경, 코드 side effect 없음).

### - **[INFO]** `spec/5-system/3-error-handling.md` `PAYLOAD_TOO_LARGE` 에러 코드 등재 + 기존 주석 변경 (파일 39)
  - 위치: `spec/5-system/3-error-handling.md` §1.3 44행, §1.7 137-138행
  - 상세: §1.3 에 `PAYLOAD_TOO_LARGE`(413) 신규 행이 추가됐고, §1.7 하단의 `details[]` 주석이 "Planned" → "구현" 으로 상태가 갱신됐다. 기존 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 행(§1.7)은 수정되지 않았다. 두 코드가 모두 413을 반환하는 이중 구조임을 명시하는 Rationale 도 추가됐다. spec 문서 변경으로 코드 side effect 없음.
  - 제안: 없음.

### - **[INFO]** `spec/4-nodes/7-trigger/1-manual-trigger.md` 응답 봉투 기술 변경 — "Planned" → "구현" 상태 전이 (파일 36)
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` 178행
  - 상세: `BadRequestException({ code, message, errors: [...] })` → `BadRequestException({ code, message, details })` 로 throw 인자 기술이 변경됐고, 응답 봉투도 `{ error: { code, message, requestId } }` → `{ error: { code, message, requestId, details } }` 로 갱신됐다. 또한 `toTriggerParameterErrorDetails` 헬퍼가 내부 분류 문자열을 public field code 로 정규화한다는 설명이 추가됐다. 이는 코드 구현이 이미 완료된 것을 spec 에 반영하는 것으로, spec 문서 변경이며 코드 side effect 없음.
  - 제안: 없음.

### - **[INFO]** `spec/7-channel-web-chat/4-security.md` 신규 `apiBase` 보안 정책 행 추가 (파일 42)
  - 위치: `spec/7-channel-web-chat/4-security.md` 37행 신규 행
  - 상세: `apiBase` 입력 검증 정책 행이 추가됐고 코드 SoT 로 `use-widget.ts configFromQuery`/`safeApiBaseFromQuery` 가 명시됐다. 코드는 이미 존재하는 것을 spec 이 사후 문서화한 것이다. 기존 코드의 동작 변경 없음.
  - 제안: 없음.

### - **[INFO]** `spec/data-flow/10-triggers.md` 인증 webhook 무제한 통과 표현 qualifier 추가 (파일 44)
  - 위치: `spec/data-flow/10-triggers.md` 98행
  - 상세: "인증 webhook 은 무제한 통과" → "이 Guard 를 무제한 통과한다(단 본문 크기는 ... 1MB body-parser 가 별도 게이트)" 로 qualifier 가 추가됐다. spec 문서 변경으로 코드 side effect 없음.
  - 제안: 없음.

### - **[INFO]** consistency review 세션 간 서로 다른 worktree 절대 경로 혼재 (파일 5, 13, 21, 29)
  - 위치: `_retry_state.json` 파일들의 `session_dir`, `prompt_file`, `output_file` 경로
  - 상세: `webchat-polish-batch-99e2ed` 워크트리 경로(파일 5, 13)와 `competent-mirzakhani-34a96a` 워크트리 경로(파일 21, 29) 등 서로 다른 세션 디렉토리가 포함되어 있다. 이는 각각 별도 세션에서 실행된 검토 상태 파일이 하나의 PR 에 함께 포함된 것으로, 서로 다른 세션의 상태 파일을 cross-read 하면 의도치 않은 결과가 발생할 수 있다. 그러나 이 파일들은 이미 완료된 세션의 최종 기록물이며 재실행되지 않는다.
  - 제안: 없음(이미 완료된 기록물).

---

## 요약

이번 변경 세트(44개 파일)는 review/ 산출물 35개와 spec/ 문서 9개로 구성된다. 실행 코드(`codebase/`) 변경이 전혀 없으므로 전역/공유 상태 변경, 네트워크 호출, 이벤트/콜백 변경, 환경 변수 읽기/쓰기 등의 런타임 부작용은 존재하지 않는다. spec 문서 변경 중 `5-admin-console.md` 헤딩 변경은 마크다운 앵커를 변경하지만 해당 앵커를 참조하는 외부 링크가 없음이 이미 검증됐다. `_retry_state.json` 파일들이 머신 로컬 절대 경로를 하드코딩하고 있으나 이는 일회성 세션 상태 파일 용도로 재실행 시 재생성된다. 공개 API 시그니처 변경이나 기존 함수 시그니처 변경도 없다. 전체적으로 의도치 않은 부작용이 없는 안전한 변경이다.

---

## 위험도

NONE
