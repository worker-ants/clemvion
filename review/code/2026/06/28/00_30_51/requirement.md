# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [CRITICAL] system-status.e2e-spec.ts: `workspace-invitations-pruner` 큐가 MONITORED_QUEUES 에 없음
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` 87~89행 / `codebase/backend/src/modules/system-status/system-status.constants.ts`
- 상세: e2e 테스트가 `workspace-invitations-pruner` 를 `EXPECTED_QUEUE_NAMES` 에 추가했으나, 실제 `system-status.constants.ts` 의 `MONITORED_QUEUES` 에는 해당 큐가 등록돼 있지 않다. 파일에는 15개 큐만 존재하며 `WORKSPACE_INVITATIONS_PRUNER_QUEUE` import·entry 가 전무하다. 테스트 주석은 "main 에 등록됐으나 기대 목록이 stale 했던 큐" 라고 설명하지만 실제 constants 를 확인하면 사실이 아니다. 이 상태에서 e2e 를 실행하면 `expect(names).toEqual([...EXPECTED_QUEUE_NAMES].sort())` 단언이 실패한다 — 실제 API 응답에는 `workspace-invitations-pruner` 가 없는데 기대 목록에는 있으므로.
- 제안: 두 가지 선택지 중 하나. (A) `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `workspace-invitations-pruner` 큐를 실제로 추가한다(큐 구현이 main 에 존재하는지 먼저 확인). (B) `workspace-invitations-pruner` 가 main 에 아직 없는 큐라면 e2e 추가를 되돌린다. 현재 코드 상태(constants 에 없음 + 테스트에 있음)는 e2e 테스트를 broken 상태로 만든다.

---

### [WARNING] [SPEC-DRIFT] 2-sdk.md §3 resetSession 설명이 여전히 `localStorage` 를 참조
- 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` 93행
- 상세: 본 PR 의 계획(plan A-1)은 `2-sdk.md §3 resetSession`: "저장 세션(localStorage)" → sessionStorage 로 갱신한다고 체크됐으나, 실제 spec 파일에는 여전히 `"위젯이 SSE 연결을 닫고 저장 세션(localStorage)을 비운 뒤"` 라는 원문이 남아 있다. 코드(`session-store.ts`)는 올바르게 `sessionStorage` 로 전환됐고 테스트도 이를 검증하므로 **코드가 맞고 spec 이 낡은** 경우다.
- 제안: 코드 유지 + spec 반영. `2-sdk.md` 93행의 `localStorage` → `sessionStorage` 로 수정 필요. 이는 project-planner 의 spec 갱신 대상이다.

---

### [WARNING] [SPEC-DRIFT] 3-auth-session.md §3 본문이 여전히 "storage" 로만 기재(sessionStorage 미명시), §R6 Rationale 누락
- 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/3-auth-session.md` 49·54행 및 Rationale 섹션
- 상세: 본 PR 의 계획(plan A-1)은 `3-auth-session.md §3·§3.1`: storage = sessionStorage 명시(I-6 통일 포함) + **Rationale R6 신설**(defense-in-depth, N1 보존, 탭 단위 트레이드오프)이 체크됐으나, 실제 파일에는 (a) §3 본문 49행의 "iframe-origin storage", 54행의 "iframe-origin storage"가 여전히 generic "storage"로만 서술되고 "sessionStorage"가 명시되지 않았으며, (b) Rationale 에 `§R6`(sessionStorage defense-in-depth 근거)가 전혀 추가되지 않았다. `session-store.ts` 코드는 올바르게 `sessionStorage` 로 전환·주석·reference 를 갖추고 있다.
- 제안: 코드 유지 + spec 반영. `3-auth-session.md` §3 본문의 "storage" → "sessionStorage" 명시, §R6 Rationale 신설(defense-in-depth / 탭 단위 트레이드오프 / N1 복원 보존). project-planner 대상.

---

### [WARNING] [SPEC-DRIFT] 4-security.md §1 `토큰 노출` 행이 sessionStorage 탭 종료 소거 명시 누락
- 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md` 37행
- 상세: 본 PR 의 계획(plan A-1)은 `4-security.md §1 토큰 노출 row`: "sessionStorage 저장 → 탭 종료 자동 소거(3-auth-session §R6 cross-ref)" 로 갱신한다고 체크됐으나, 실제 파일의 `토큰 노출` 행은 여전히 `"per_execution 단일 → 클라이언트에 장기 비밀 없음"` 만 기재돼 있다. sessionStorage·탭 종료 소거 언급이 없다. 코드는 이미 sessionStorage 로 전환돼 있으므로 코드가 맞고 spec 이 낡은 경우다.
- 제안: 코드 유지 + spec 반영. `4-security.md §1` `토큰 노출` 행에 "sessionStorage 저장 → 탭 종료 자동 소거(3-auth-session §R6)" 추가. project-planner 대상.

---

### [WARNING] `use-widget.ts errMessage` 주석이 `4-security §5` 를 참조하나 §5 는 Privacy/Data Processing 섹션
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `GENERIC_ERROR_MESSAGE` 상수 정의 블록 주석 (`W1·4-security §5`)
- 상세: 코드 주석이 `4-security §5` 를 에러 일반화의 근거로 인용하고 있으나, `4-security.md §5` 는 "프라이버시 / 데이터 처리 책임 경계"(배포자 책임, disclaimer 제공)를 다루는 섹션이다. UI 에러 메시지 일반화 / 내부 정보 비노출 정책은 `4-security.md` 어느 §에도 명시돼 있지 않다. `4-security.md §1` 보안 정책 요약 표에 에러 메시지 정책 행이 없고, 별도 섹션도 없다. 따라서 (a) spec 참조가 잘못 됐거나 (b) 해당 보안 정책이 spec 에 아직 정의되지 않은 상태다. 어느 쪽이든 코드 주석의 spec cross-ref 가 잘못된 §를 가리킨다.
- 제안: project-planner 에게 `4-security.md` 에 "에러 메시지 일반화 / 내부 정보 비노출" 정책 행(예: `§1` 보안 정책 표의 새 행 또는 별도 항목)을 신설하도록 위임. 코드 주석의 `4-security §5` → 신설 §(예: `§1`) 로 교정. 현재로선 spec 항목이 없으므로 코드가 올바른 방향이나 참조 §가 오기(誤記).

---

### [INFO] `use-widget-eager-start.test.ts` W8 테스트 주석 상태기계 설명 미세 불일치
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 919행
- 상세: W8 테스트 주석 `// 첫 open → 500 실패 → ERROR phase.` 뒤에 `await waitFor(() => expect(result.current.state.phase).toBe("ended"))` 가 따라온다. 주석은 "ERROR phase" 를 언급하지만 실제 단언은 "ended" 를 기다린다. 주석 의도는 "ERROR → ended" 전이를 설명하는 것으로 보이나, 독자에게 "ERROR phase 가 있다"는 오해를 줄 수 있다.
- 제안: 주석을 `// 첫 open → 500 실패 → [ended] 전이.` 또는 `// 첫 open → 500 실패 → ERROR dispatch → [ended].` 로 교정하면 명확해진다. 비차단.

---

### [INFO] `session-store.ts loadSession` — `expiresAt` 미존재 시 무기한 유효 처리
- 위치: `codebase/channel-web-chat/src/lib/session-store.ts` 420행
- 상세: `if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now())` — `expiresAt` 가 없으면 만료 체크를 건너뛰어 세션이 무기한 유효로 간주된다. `PersistedSession` 인터페이스상 `expiresAt: string` 은 필수 필드이나 런타임에서 직렬화된 JSON 이 손상돼 필드가 없을 수 있다. 현재 webhook 응답이 항상 `expiresAt` 을 포함하므로 실운영 영향은 낮다.
- 제안: `!parsed.expiresAt` 케이스를 "만료 처리" 또는 "null 반환"으로 명시하면 방어적. 비차단.

---

## 요약

핵심 구현 변경(localStorage → sessionStorage 전환, `errMessage` 일반화)은 코드 레벨에서 올바르게 수행됐다. 테스트도 이를 적절히 검증한다. 그러나 두 가지 심각한 문제가 존재한다. 첫째, `system-status.e2e-spec.ts` 에 추가된 `workspace-invitations-pruner` 가 실제 `system-status.constants.ts` `MONITORED_QUEUES` 에 없어 e2e 테스트가 실패할 것으로 판단된다(CRITICAL). 둘째, 계획(plan A-1)에서 체크된 spec 갱신 3건(`2-sdk.md resetSession`, `3-auth-session.md sessionStorage 명시 + §R6`, `4-security.md §1 토큰 노출 행`)이 실제 spec 파일에 반영되지 않아 코드·spec 간 drift 가 남아 있다(SPEC-DRIFT WARNING 3건). `errMessage` 의 `4-security §5` 참조도 현재 spec §5 내용과 다른 섹션을 가리키므로 정정이 필요하다.

## 위험도

CRITICAL
