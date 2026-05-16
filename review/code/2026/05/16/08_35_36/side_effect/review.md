# 부작용(Side Effect) 코드 리뷰

검토 대상: user-guide-sync-4af69c worktree 변경분 (11개 파일)
검토 관점: 의도치 않은 상태 변경, 전역 변수, 파일시스템, 시그니처/인터페이스 변경, 환경 변수, 네트워크 호출, 이벤트/콜백

---

## 발견사항

- **[INFO]** `ai.mdx` / `ai.en.mdx` — 필드 테이블에서 `conversationHistory` / `historyCount` 행 제거 후 `contextScope` 등 5개 신규 행 추가
  - 위치: `frontend/src/content/docs/02-nodes/ai.mdx` L97-103, `ai.en.mdx` L35-41
  - 상세: MDX frontmatter의 `spec` 배열에 `spec/conventions/conversation-thread.md`가 추가되어, 문서 빌드 시 이 경로 파일이 없으면 빌드가 실패할 수 있다. 그러나 해당 파일은 이미 존재하는 컨벤션 문서이므로 현재 무결하다. 필드 테이블 변경 자체는 정적 문서(MDX) 수정이므로 런타임 부작용은 없다.
  - 제안: `spec/conventions/conversation-thread.md` 경로가 실제로 존재하는지 CI 단계에서 `registry.ts` 단위 테스트로 자동 검증되는지 확인한다(plan 체크리스트에 따르면 이미 수행됨).

- **[INFO]** `integrations.mdx` / `integrations.en.mdx` — frontmatter `spec`·`code` 배열에 신규 경로 추가
  - 위치: `frontend/src/content/docs/02-nodes/integrations.mdx` L229-230, `integrations.en.mdx` L89-90
  - 상세: `spec/4-nodes/4-integration/4-cafe24.md`와 `backend/src/nodes/integration/cafe24/cafe24.schema.ts`가 `code` 배열에 추가되었다. 문서 빌드·링크 검사 도구가 이 경로를 실존 파일로 확인하지 못할 경우 빌드 오류를 유발할 수 있다. 런타임 부작용은 없다.
  - 제안: 위 두 경로의 실존 여부를 CI 단계에서 점검한다.

- **[INFO]** `variables-and-context.mdx` / `variables-and-context.en.mdx` — `$thread` 변수 표 행 및 섹션 추가
  - 위치: `frontend/src/content/docs/04-expression-language/variables-and-context.mdx` L428-471, `.en.mdx` L360-403
  - 상세: `$thread`는 표현식 엔진 내 읽기 전용 컨텍스트 변수로 문서화되었다. 문서 변경은 순수 정적 콘텐츠이며 런타임 상태를 변경하지 않는다. `$thread.text` 메모이즈 주의 Callout이 포함되어 있어 사용자 관점 부작용 안내는 적절하다.
  - 제안: 특이 없음.

- **[INFO]** `overview.mdx` / `overview.en.mdx` — Integration 카테고리 설명에 "Cafe24" 추가
  - 위치: `frontend/src/content/docs/02-nodes/overview.mdx` L336, `overview.en.mdx` L312
  - 상세: 단순 문자열 추가. 부작용 없음.
  - 제안: 특이 없음.

- **[INFO]** `plan/in-progress/user-guide-sync-2026-05-16.md` — 신규 plan 파일 생성
  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md`
  - 상세: 작업 추적 문서로, 파일시스템에 새 파일이 추가된다. 이는 의도된 동작이며 코드 실행 경로에 영향을 주지 않는다. frontmatter(`worktree`, `started`, `owner`)가 CLAUDE.md 규약에 맞게 기술되어 있다.
  - 제안: 특이 없음.

- **[INFO]** `review/consistency/2026/05/16/08_22_34/SUMMARY.md` 및 `_prompts/convention_compliance.md` — 신규 리뷰 산출물 파일 생성
  - 위치: `review/consistency/2026/05/16/08_22_34/` 하위
  - 상세: 시점 기록 성격의 review 산출물이다. 파일시스템에 새 파일이 추가되나, 코드 실행에 영향을 주는 부작용은 없다.
  - 제안: 특이 없음.

---

## 요약

이번 변경은 전적으로 **정적 문서(MDX) 및 작업 추적 파일(plan, review)** 수정으로 구성되어 있다. 전역 변수 도입, 환경 변수 조작, 네트워크 호출, 이벤트/콜백 변경, 함수 시그니처·공개 API 변경에 해당하는 코드가 존재하지 않는다. 유일하게 주목할 부분은 MDX frontmatter의 `spec`·`code` 경로 배열 확장인데, 이 경로들이 실제 파일시스템에 존재하지 않을 경우 문서 빌드 단계에서 오류를 일으킬 수 있다. plan 체크리스트에 따르면 `registry.ts` 단위 테스트로 이미 검증한 것으로 기술되어 있으므로, 현재 발견된 부작용 위험은 모두 낮은 수준이다.

---

## 위험도

NONE
