# 변경 범위(Scope) 리뷰

검토 대상: EIA/WS continuation 명령 ↔ 대기 노드 표면(waiting surface) 매트릭스 가드 구현
(파일 1~10) + 해당 작업의 `/consistency-check --impl-prep` 산출물(파일 11~17).

의도된 범위(오케스트레이터 제공):
1. 사용자가 "전체 명령 매트릭스"를 명시 선택 (form/buttons/ai_conversation 3표면 × 4명령,
   end_conversation 단독이 아님)
2. e2e-spec 의 `JWT_SECRET`/`mintInteractionToken` 을 module-level 로 hoist — 중복 제거 목적

## 발견사항

- **[INFO]** `hooks.service.ts` `forwardToInteractionService` 의 if/else-if 구조가
  `ctx`+`dto` 삼항 조립 패턴으로 재작성됨
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (파일 8) — 원래
    `if (kind==='text_message') {...interact(...)} else if (kind==='button_callback')
    {...interact(...)}` 두 블록이 각각 독립적으로 `ctx`를 생성하고 `interact()`를
    호출하던 것을, `const ctx = {...}` 공용 선언 + `dto` 삼항 계산 + 단일
    `try { await interact(ctx, dto) } catch { ... }` 로 재구성.
  - 상세: 이 재작성 자체는 신규 요구사항(표면 불일치 시 `ConflictException` graceful
    catch + warn 로그, plan 문서에 "부수" 변경으로 명시됨)을 구현하기 위한 것이다.
    catch 블록을 두 분기에 각각 중복시키지 않기 위해 `ctx`/`dto` 를 먼저 계산하고
    호출을 하나로 합친 것이므로 목적과 인과관계가 뚜렷하다. 다만 "text_message →
    submit_message, button_callback → click_button" 두 개의 독립 if-else 블록을
    삼항 dto 조립으로 합친 것은 순수 try/catch 추가보다 한 단계 더 나아간 구조
    변경이라, 각 분기에 개별 try/catch 를 추가하는 최소 diff 대안도 가능했다.
    기능적으로 동일하고(dto undefined 시 조기 return, 두 명령 매핑 유지) 회귀
    테스트(파일 7)도 함께 갱신돼 커버되므로 실질 위험은 낮다.
  - 제안: 변경 없음 권장 — 신규 catch 로직과 밀접히 결합된 정당한 최소 리팩터링으로
    판단됨. 참고용 INFO.

- **[정보 확인 — 발견 아님] e2e-spec `JWT_SECRET`/`mintInteractionToken` hoist**
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` (파일 9) — 두 번째
    `describe` 블록 내부에 있던 로컬 선언을 제거하고 파일 상단 module-level 로 이동.
  - 상세: 시크릿 문자열 값(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)과
    `mintInteractionToken` 구현이 완전히 동일하게 이동됐을 뿐 로직 변경 없음. 첫 번째
    `describe` 블록(신규 form-대기 매트릭스 e2e 테스트)이 같은 헬퍼가 필요해 hoist 가
    필요했던 것으로, 오케스트레이터가 명시한 "중복 제거 목적" 설명과 diff 가 정확히
    일치한다. 범위 이탈 아님.

- **[정보 확인 — 발견 아님] `review/consistency/2026/07/10/23_19_34/**` 신규 파일 7개
  (파일 11~17)**
  - 상세: `plan/in-progress/eia-command-waiting-surface-guard.md` 체크리스트의
    `[x] /consistency-check --impl-prep` 항목이 산출한 아티팩트. CLAUDE.md 는
    "developer 는 구현 착수 직전 consistency-check --impl-prep 의무"라 규정하고,
    산출물 저장 위치는 `review/consistency/**`(gitignore 대상 아님, 커밋 대상)로
    명시돼 있다. 즉 이번 PR 이 다루는 작업의 필수 워크플로 증적이며, 코드 스코프를
    벗어난 무관한 파일 추가가 아니다.

- **[정보 확인 — 발견 아님] 매트릭스 자체가 "4종 전부"를 다루는 것**
  - 상세: `waiting-surface-guard.ts`(파일 4)/`SURFACE_ALLOWED_COMMANDS` 가
    `form_submitted`/`button_click`/`ai_message`/`ai_end_conversation` 4종 전체와
    `form`/`buttons`/`ai_conversation` 3표면 전체의 매트릭스를 구현하고, 테스트(파일
    1·3·9)도 form/buttons/ai 세 표면 전부와 판정 불가·row 부재 케이스까지 커버한다.
    오케스트레이터가 명시한 "end_conversation 단독이 아니라 4종 전부" 의도와 정확히
    일치 — 과잉 구현(over-engineering) 아님.
  - 부수적으로 F-1(`assertNodeId` nodeId 일치 검사, chat-channel placeholder 선행
    필요)·F-2(채팅 채널 form 대기 중 자유 텍스트 graceful 안내)는 plan 문서에
    "본 PR 범위 밖" 후속 항목으로 명시적으로 분리돼 실제 코드에 구현되지 않았다 —
    오히려 스코프를 의도적으로 좁게 유지한 근거로 확인됨(over-engineering 반대 방향).

- **[정보 확인 — 발견 아님] 임포트/설정/포맷팅**
  - 신규 임포트(`ConflictException`, `InteractDto` in `hooks.service.ts`;
    `SURFACE_ALLOWED_COMMANDS` 등 in `execution-engine.service.ts`)는 모두 실제
    사용됨. 사용되지 않는 임포트 추가·정리 없음.
  - 설정 파일(package.json, tsconfig, CI 등) 변경 없음.
  - diff 전체에 의미 없는 공백/줄바꿈만 바뀐 hunk 없음 — 모든 hunk 가 실질 코드/주석
    변경과 결합돼 있음.

## 요약

핵심 구현 파일(1~9)과 plan 문서(10)는 오케스트레이터가 명시한 두 가지 의도된 범위 —
(a) form/buttons/ai_conversation 3표면 × 4명령 전체 매트릭스, (b) e2e-spec 헬퍼
module-level hoist — 를 벗어나지 않는다. `hooks.service.ts` 의 if-else→ternary+try/catch
재구성은 신규 graceful-catch 요구사항과 밀접히 결합된 정당한 범위 내 변경으로 판단되며
(순수 포맷팅이나 무관한 리팩터링이 아님), F-1/F-2 후속 항목을 의도적으로 이번 PR에서
제외한 것은 오히려 스코프 절제의 증거다. `review/consistency/**` 신규 파일 7개는 코드
스코프 이탈이 아니라 CLAUDE.md 가 강제하는 `--impl-prep` 워크플로 증적으로, 이 작업의
정당한 부산물이다. 임포트·설정·포맷팅 관점에서도 문제되는 변경은 발견되지 않았다.

## 위험도

NONE
