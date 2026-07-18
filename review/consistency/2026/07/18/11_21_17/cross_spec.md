# Cross-Spec 일관성 검토 — `spec/conventions/interaction-type-registry.md`

## 검토 범위 확인

target 문서의 실제 미커밋 변경분(working tree vs `HEAD`)을 우선 확인했다:

```
git diff HEAD -- spec/conventions/interaction-type-registry.md
```

변경은 4곳, 전부 **동일 패턴의 용어 치환**이다 — 서술 텍스트 내 "grep" / "코드 grep" / "grep 가드" / "grep 검증" 을
"AST(코드 리터럴) 스캔" / "AST 가드" 로 정정. 다른 어떤 구조(테이블 행, 값 목록, 앵커, 링크, 코드 경로)도 바뀌지 않았다.
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임을 정의하는 문장은 이번 diff 에 하나도 없다.

이 정정은 근거가 있다 — `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 를 직접
읽으면 `import ts from "typescript"` 로 실제 TS AST 파싱을 수행하며(정규식/grep 아님), 이는 PR #972
("정규식 → TS AST 리터럴")로 이미 전환된 실제 구현과 일치한다. 즉 이번 변경은 문서를 코드 사실에 맞춰 정정한
것으로, 새 사실을 도입하지 않는다.

## 발견사항

없음 (No cross-spec conflict candidates found).

교차 검증한 항목과 결과:

- **동일 개념(REGISTRY_SITES/SOURCE_REGISTRY_SITES AST 가드)을 참조하는 타 spec** —
  `spec/conventions/conversation-thread.md` §system_error 단락은 이미 "frontend AST 가드
  (`interaction-type-exhaustiveness.test.ts`)" 라는 동일 표현을 쓰고 있어 target 의 이번 정정과
  일치한다(오히려 이번 정정 전에는 target 자신만 "grep" 이라는 낡은 표현을 써 conversation-thread.md 와
  **불일치**했고, 이번 diff 가 그 불일치를 해소했다).
- `spec/` 전체에서 "grep" 을 이 registry/AST 가드 맥락으로 사용하는 잔여 문서를 검색했으나
  (`user-guide-evidence.md`, `data-hydration-surfaces.md`, `2-navigation/13-user-guide.md` 의 "grep" 언급은
  전혀 다른 가드(`impl-anchor-existence.test.ts`, `hydration-coverage.test.ts`)를 가리키는 무관한 항목이었다.
- **§1 WaitingInteractionType 4값 / EIA 3값 매핑, §2 ConversationTurnSource 7값/5값, §3 PresentationType 5값,
  §4 endReason 패키지 SoT** — 모두 이번 diff 의 대상이 아니며, 값 목록·표 구조·SoT 파일 경로는 변경 전과
  바이트 단위로 동일. 별도로 backend/frontend 실제 코드(`execution-engine.service.ts`,
  `execution-store.ts`)를 grep 해 4값 정의가 여전히 doc 서술과 일치함을 확인했다 — 이번 diff 로 인한
  신규 drift 없음.
- `NodeExecution.interaction_data.interactionType` (수행된 user action 기록, `form_submitted`/`button_click`/
  `button_continue`) 과 target 의 `WaitingInteractionType`(대기 종류, `form`/`buttons`/`ai_conversation`/
  `ai_form_render`) 이 이름만 같고 별개 enum 이라는 점은 `spec/1-data-model.md` §2.14 NodeExecution 항목이
  이미 명시적으로 disambiguate 해 두었다 — 기존에 해소된 항목이며 이번 target 변경과 무관.
- HEAD 커밋(463aee139, PR #975 `ResumableNodeHandler` 제네릭화)이 이 target 파일을 실제로는 건드리지
  않았음을 `git show 463aee139 -- spec/conventions/interaction-type-registry.md` (빈 출력)으로 확인 —
  target 변경은 그 PR 과 독립된 순수 편집.

## 요약

target 문서의 실질 변경분은 "grep" → "AST(코드 리터럴) 스캔/AST 가드" 라는 4곳의 용어 정정뿐이며,
엔티티·필드·엔드포인트·요구사항 ID·상태 머신·RBAC·계층 책임 등 Cross-Spec 충돌이 발생할 수 있는 어떤
구조도 변경하지 않는다. 오히려 이 정정은 `conversation-thread.md` 가 이미 쓰고 있던 "AST 가드" 표현과
target 자신의 나머지 본문(예: §1.2 규칙 3 "등록된 AST(코드 리터럴) 스캔 대상 파일")이 이미 쓰고 있던
용어에 잔여 4곳을 맞춘 것으로, 문서 내부·문서 간 용어 일관성을 개선하는 방향이다. 실제 테스트 코드
(`interaction-type-exhaustiveness.test.ts`, `import ts from "typescript"`)를 대조해 이 정정이 사실과
부합함을 확인했다. 다른 영역(execution-engine, conversation-thread, ai-agent, node-output, data-model)의
관련 서술과 대조했을 때 새로 발생한 데이터 모델/API/요구사항 ID/상태 전이/RBAC/계층 책임 충돌은 없다.

## 위험도

NONE
