# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

- scope(`spec/conventions/`) 델타: **0개 파일** — 이 브랜치는 spec 문서를 바꾸지 않았다. 정상.
- 구현 diff: `codebase/frontend/src/lib/docs/__tests__/` 4개 파일 (rename + 확장) + `PROJECT.md` 1줄 갱신.
  - `guide-error-code-existence.test.ts` → `guide-identifier-existence.test.ts` (삭제 + 신규)
  - `guide-error-code-scan.ts` → `guide-identifier-scan.ts` (삭제 + 신규)
- 신규 도입 식별자: 함수 `scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`, 타입 `CitationAxis`(값 `"field-table"|"code-field"|"backtick"`)·`IdentifierCitation`, 상수 `GUIDE_EXTERNAL_VOCABULARY`·`EXTERNAL_VOCABULARY_CAP`, 파일 경로 `guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`.

전수 grep 결과, 위 신규 식별자·파일 경로는 저장소 어디에도 다른 의미로 이미 쓰이고 있지 않다 (`CitationAxis`·`IdentifierCitation`·`GUIDE_EXTERNAL_VOCABULARY`·`EXTERNAL_VOCABULARY_CAP`·`"backtick"` 전부 이 두 파일 안에서만 등장). 새 파일 경로도 이 디렉토리의 기존 명명 컨벤션(`<name>-existence.test.ts` + `<name>-scan.ts`, 예: `impl-anchor-existence.test.ts`/`impl-anchor-parse.ts`, `spec-frontmatter-parse.ts`)을 그대로 따른다. plan(`plan/in-progress/guide-identifier-existence.md` §명명)도 `KNOWN_DOCS_ABSENT` 와의 접두 충돌·축 라벨 `"prose"` 재사용 회피를 이미 실측·기록해 두었다 — 자체 점검이 정확하다.

## 발견사항

- **[WARNING]** 리네임이 만든 dangling 사용처 — 자매 파일의 docstring 이 옛 파일명을 여전히 가리킨다
  - target 신규 식별자: 이 diff 가 `guide-error-code-existence.test.ts` 를 삭제하고 `guide-identifier-existence.test.ts` 로 대체 (파일 경로 리네임)
  - 기존 사용처: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` — "자매 `guide-error-code-existence.test.ts` 는 **코드 토큰**의 실재를 본다. 이 가드는 **문장의 일치**를 본다 — 표면이 다르다."
  - 상세: 이 diff 는 대상 파일을 실제로 삭제·리네임했지만(`git diff` 확인), `guide-sanitized-message-parity.test.ts` 는 이 diff 의 변경 범위 밖이라 옛 이름을 그대로 인용한다. 이 인용은 (plan 등의) 역사적 서술이 아니라 "자매 가드가 무엇을 보는지" 를 안내하는 **살아있는 포인터**로 쓰였으므로, 다음 사람이 그 이름으로 파일을 찾으면 존재하지 않는다. `guide-identifier-scan.ts:9` 의 동일 옛 이름 인용은 "왜 리네임했는가" 를 설명하는 의도된 역사 서술이라 문제 없음(구분됨). `plan/complete/guide-error-code-truth.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 등의 옛 이름 언급도 전부 리네임 사실을 명시하는 역사적 문맥이라 스캔 결과 문제 없음.
  - 제안: `guide-sanitized-message-parity.test.ts:16` 의 인용을 `guide-identifier-existence.test.ts` 로 갱신 (파일명이 바뀌었을 뿐 "자매가 코드 토큰의 실재를 본다" 는 서술 자체는 유효하므로 문장 구조는 유지 가능). plan 체크리스트의 "리네임 ... 트래커 전방 참조 5곳" 항목에 이 자리가 누락된 것으로 보이므로 함께 반영 권장.

그 외 다섯 관점(요구사항 ID·엔티티/DTO·API endpoint·이벤트/메시지명·환경변수/설정키)에서는 target 이 새 항목을 도입하지 않거나(엔티티/API/이벤트/env 신규 정의 없음 — `collectEnvDeclarations` 는 기존 env 이름을 스캔만 함), 도입한 식별자가 grep 전수 대조상 충돌 없음을 확인했다.

## 요약

target 은 spec/conventions/ 를 변경하지 않는 harness 테스트 리네임·확장(에러 코드 전용 스캐너 → 식별자 전반 스캐너)이며, 새로 도입한 함수·타입·상수·파일 경로 모두 저장소 전수 검색상 기존 사용처와 실질 충돌이 없고 디렉토리 명명 컨벤션도 준수한다. 유일한 흠은 리네임 대상이던 옛 파일명을 diff 범위 밖의 자매 테스트 파일이 여전히 살아있는 참조처럼 인용하고 있는 점으로, 기능적 영향은 없으나(주석뿐) 다음 유지보수자가 존재하지 않는 파일을 찾게 만들 수 있어 WARNING 으로 등재한다.

## 위험도
LOW
