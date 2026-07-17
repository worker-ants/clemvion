# Cross-Spec 일관성 Check — `spec/7-channel-web-chat/`

- 검토 모드: `--impl-done` (scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`)
- 직전 라운드: `review/consistency/2026/07/17/19_46_54/cross_spec.md` (위험도 LOW, INFO 2건).
- **실제 diff 범위 재확인**(HEAD 워크트리 `webchat-boot-single-flight-8c92b4`, `origin/main` 대비, `git diff origin/main --stat` 실측):
  - spec 변경은 **`spec/7-channel-web-chat/2-sdk.md` frontmatter 4줄 추가뿐**(19_46_54 가 이미 검토·승인한 바로 그 변경, 본문 변경 없음) — `origin/main` 대비 spec 트리 전체에서 이 파일 1개만 diff 가 있다(`git diff origin/main --stat -- 'spec/**'` 로 재확인).
  - 코드 diff 는 `codebase/channel-web-chat/src/lib/widget-state.ts`(+test) · `codebase/channel-web-chat/src/widget/use-widget.ts`(+test) 에 집중돼 있고, 전부 **`codebase/channel-web-chat/**` 내부의 client-only 변경**이다. 백엔드(`codebase/backend/**`)·다른 spec 영역이 참조하는 코드 경로는 diff 에 전혀 없다(`git diff origin/main --stat` 로 확인 — 89개 변경 파일 중 backend 코드 0건, `plan/**`·`review/**`·`CHANGELOG.md`·spec 1건 제외 전부 `codebase/channel-web-chat/**`).
- 배경(오케스트레이터 지시): 19_46_54 이후 `A-6 되돌림`·`boot 축→sessionEstablished 재설계`·`openStream 짝 게이트` 등 코드가 크게 바뀌었다는 지적에 따라, 이 구현 diff 가 **2-sdk §3(재전송)·3-auth-session §3.1·1-widget-app §3.1** 의 데이터모델·API 계약·상태전이와 정합하는지 및 타 영역 spec 과의 충돌 여부를 재검증했다.

## 검증 방법

1. `plan/in-progress/webchat-boot-single-flight.md`(439줄) 전체를 읽어 19_46_54 이후 12차례의 "거울상" 버그·수정 이력(A-6 되돌림 경위, `sessionEstablished()` 재설계, `openStream` 짝 게이트 도입 경위 포함)을 재구성했다.
2. `codebase/channel-web-chat/src/lib/widget-state.ts`(226줄)·`codebase/channel-web-chat/src/widget/use-widget.ts`(1106줄) 전문을 HEAD 워크트리 절대경로로 직접 읽었다.
3. `git diff origin/main -- <file>` 로 위 두 파일 + `CHANGELOG.md` + `spec/7-channel-web-chat/2-sdk.md` 의 **실제 +/- 라인**을 대조해, "코드가 크게 바뀌었다"는 서술이 **행동 변화**인지 **주석/JSDoc 추가**인지를 라인 단위로 구분했다.
4. 코드가 인용하는 타 spec 텍스트(`3-auth-session.md §3.1-2·§3.1-3`, `1-widget-app.md §2 Form 행`, `2-sdk.md §3(재전송)`)를 실제 spec 원문과 대조해 인용의 정확성을 확인했다.
5. `spec/5-system/14-external-interaction-api.md`(EIA)에서 `interact` 명령 계약(`cancel`/`end_conversation` 의 `reason` 필드, `409 STATE_MISMATCH` 표면별 허용 집합, `EIA-IN-09` SSE 동시연결 상한 3)을 재확인해, 이번 diff 가 다루는 "이중 스트림 방어"·"cancel/end_conversation 분기"가 EIA 계약과 충돌하지 않는지 검증했다.
6. `codebase/channel-web-chat/src/widget/components/panel.tsx` 를 열어 `[ended]` CTA("새 대화 시작")·헤더 "새 대화" 가 동일한 `actions.newChat` 을 호출하는지 확인해, ERROR 로 유도된 `[ended]` 상태에서도 B-1(best-effort cancel) 경로가 정상 작동하는지 실측했다.
7. `plan/in-progress/webchat-command-failure-is-not-termination.md` 를 읽어, 코드 주석이 언급하는 "PR 범위 밖 이월 gap"이 실제로 완결된 별도 plan 으로 분리·추적되고 있는지 확인했다.

## 발견사항

이번 라운드에서 새로 보고할 **CRITICAL/WARNING 은 없다**. 아래는 진단 과정에서 확인한 참고 사항(INFO)이다.

- **[INFO]** `12-webhook §3.2 WH-SC-01` 절 번호 인용이 현재 `12-webhook.md` 구조와 계속 어긋남 (19_46_54 에서 이월)
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §1 · `4-security.md` §1 표("webhook 호출" 행) · §Rationale R2.
  - 충돌 대상: `spec/5-system/12-webhook.md` 의 실제 구조 — `WH-SC-01`(`auth_config_id IS NULL`)은 번호 없는 `### 요구사항 > #### 인증 및 보안` 절에 있고, 실제 `### 3.2` heading 은 "기존 Trigger CRUD API"(무관 내용)다.
  - 상세: 이번 diff 는 이 세 인용 지점을 전혀 건드리지 않았다(파일 diff 없음) — 19_46_54 가 이미 "target 고유 문제가 아니라 `12-webhook.md` 리팩터 이후 갱신 안 된 전역적 pre-existing drift"(EIA `14-external-interaction-api.md:163` 도 동일 패턴)로 규명한 사안 그대로다. 재확인 결과 여전히 미해결이나 **이번 PR 범위 밖**이고 target 이 새로 만든 것도 아니다.
  - 제안: 변동 없음(19_46_54 제안 유지) — `12-webhook.md` SoT 동기화 패스에서 일괄 정정 권장. 이번 PR 을 막을 사유 아님.

- **[INFO]** (경계 확인, finding 아님) `sendCommand` 비-410 실패의 `ERROR→[ended]` 전이는 여전히 `1-widget-app.md §2` Form 행("실패 시 `error.details` 표시·재제출")과 완전히 정합하지 않음 — 단 **cross-spec 충돌이 아니라 이미 분리·추적된 impl-vs-spec 이월**임을 확인
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:707-726`(`sendCommand` else 분기 주석).
  - 상세: `git diff origin/main -- .../use-widget.ts` 로 확인한 결과 이 분기의 **실제 코드는 `origin/main` 과 100% 동일**하다(`dispatch({ type: "ERROR", ... })` 한 줄은 컨텍스트 라인이고 diff 는 그 위에 설명 주석만 추가). 즉 이 갭은 이번 PR 이 만든 것이 아니라 PR 이전부터 있던 동작이며, 코드 주석이 자인용하는 `1-widget-app.md §2` Form 행("실패 시 `error.details[{field,message,code}]` 표시·재제출")과 실제 spec 원문을 대조한 결과 인용은 정확했다. 다만 이 갭은 **두 spec 문서 간의 모순이 아니다** — `1-widget-app.md §2` 와 `3-auth-session.md §3.1-2/§3.1-3` 는 서로 완전히 정합하며(둘 다 "복원 가능한 실패는 종료가 아니다"를 일관되게 요구), 코드가 아직 그 일치된 요구를 따라잡지 못한 **impl-vs-spec 갭**이다. `plan/in-progress/webchat-command-failure-is-not-termination.md`(owner: `project-planner`, `(unstarted)`)로 이미 분리돼 결정(A/B/C 옵션)을 기다리고 있음을 확인했다 — 산문 매몰 위험(19_46_54 `plan_coherence` WARNING 이 지적했던 유형)은 해소된 상태다.
  - 제안: 없음(이미 올바르게 추적 중). 본 checker 의 역할(spec-vs-spec) 밖이라 등급 부여 대상 아님 — 참고용 기록.

## 검증 완료 — 충돌 없음 확인 항목 (19_46_54 이후 신규 검증분)

- **`widget-state.ts` reducer 행동 불변**: `RESTORED`/`BOOTED` case 에 붙은 "A-6 되돌림" 관련 diff 는 **주석/JSDoc 뿐**이고 실제 `return` 문은 `origin/main` 과 동일하다(`git diff` 로 라인 단위 확인 — 두 case 모두 `ended` 가드 없이 무조건 `phase: "streaming"` 전이, 이는 `origin/main` 부터 그랬다). 즉 이 파일의 **상태전이표(1-widget-app §3)는 코드 레벨에서 넷-제로 변경**이다.
- **`3-auth-session.md §3.1-2/§3.1-3` 재정합 확인**: PR 진행 중 한때 `sendCommand` 비-410 실패에 `teardownSession()`(storage 소거)을 추가했던 이력이 있으나(A-6 관련 시도), 이는 §3.1-3 이 명시 열거한 storage 정리 조건(SSE terminal · 복원시 200+terminal/404/복구불가 401 · 명령 410 Gone)에 없는 사유로 세션을 지우는 **spec 위반**이었고, ai-review(`18_39_11` requirement CRITICAL)가 실측 재현 후 되돌려 **origin/main 과 동일한(spec §3.1-2 "200+running→복원"에 부합하는) 최종 상태**로 수렴했다. 현재 코드는 §3.1-2/§3.1-3 요구사항과 정확히 일치한다.
- **EIA `interact` 명령 계약 재확인**: `newChat()`(B-1)의 `{ command: "cancel", reason: "user_new_chat" }`, `endConversation()`의 `{ command: "end_conversation", nodeId, reason }` / `{ command: "cancel", reason }` 모두 `14-external-interaction-api.md` §5.1 표(`end_conversation: nodeId, reason?` · `cancel: reason?`)와 필드명·선택성 일치. `endConversation()` 의 graceful/cancel 분기 조건(`state.phase==="awaiting_user_message" && pending.type==="ai_conversation" && nodeId 존재`)도 EIA `409 STATE_MISMATCH` 표면별 허용 집합("`ai_conversation`/`ai_form_render`=4종 모두" 만 `end_conversation` 허용)과 정합 — 서버가 거부할 조합을 클라이언트가 보내지 않는다.
- **EIA-IN-09 SSE 동시연결 상한(3/execution)과 "이중 EventSource" 이력의 관계**: 이번 PR 내에서 발견·수정된 "겹친 두 seed 가 각자 `openStream` 을 호출"하는 MEDIUM 결함은 `openStream = closeStream→set` 구조상 최종 상태는 항상 단일 스트림으로 수렴하는 낭비성 생성이었다(§EIA-IN-09 의 "무제한 fan-out 차단" 목적을 위협할 정도는 아니었음 — 동일 탭 내 일시적 2개는 "multi-tab 허용"(상한 3)의 여유 안에 있다). 현재는 `start()`·`applyConfig` 양쪽에 `openStream` 직전 짝 게이트(`sessionEstablished()` 재확인)가 대칭 회귀 테스트로 고정돼 있어 이중 생성 자체가 발생하지 않는다 — EIA 표면과의 충돌 가능성은 수정 전후 모두 없었음을 재확인.
- **`[ended]` CTA와 헤더 "새 대화"의 동일 경로 확인**: `panel.tsx` 를 열람해 `[ended]` 상태의 "새 대화 시작" 버튼(`wc-newchat` 클래스)과 헤더 "새 대화" 컨트롤이 **동일한 `actions.newChat`** 을 호출함을 확인했다. 이에 따라 ERROR 로 로컬 `[ended]` 진입 후(storage·`sessionRef` 는 보존됨) 사용자가 "새 대화 시작"을 누르면 `newChat()` 의 B-1 분기(`sessionRef.current` 존재 → best-effort `cancel`)가 정상적으로 이전 execution 을 정리한다 — ERROR 경로가 `teardownSession()` 을 거치지 않아도 서버측 orphan 이 방치되지 않는다(§R9-B-1 의 orphan 근원 제거 원칙이 이 경로에도 확장 적용됨을 실측 확인).
- **계층 책임**: 이번 diff 는 `codebase/channel-web-chat/**` 로만 한정돼 있어(백엔드·다른 앱 코드 0건) `0-architecture.md §R2`("클라이언트 consumer 한정, facade 미신설")·EIA §R10(단일 sink) 원칙을 그대로 유지한다. RBAC·데이터모델·요구사항 ID·엔드포인트 계약 표면 확장이 전혀 없다.
- **spec `code:` frontmatter 커버리지**: `sessionEstablished`/`bootGenRef`/`openStream` 짝 게이트가 사는 `use-widget.ts` 는 `3-auth-session.md` frontmatter 의 기존 `code:` 목록에 이미 포함돼 있고(`2-sdk.md` 는 19_46_54 검토 시점에 이미 `use-widget.ts`·`host-bridge.ts` 를 추가 완료), `1-widget-app.md` 는 `codebase/channel-web-chat/**` 와일드카드로 전체를 포괄한다 — 이번 diff 로 인한 증거 경로 공백은 없다.

## 요약

19_46_54 이후 코드가 "12차례 거울상 버그 수정"을 거칠 만큼 크게 요동쳤다는 배경 서술은 **실측 결과 정확**했으나, 그 요동은 전부 `spec/7-channel-web-chat/2-sdk.md §3(재전송)`·`1-widget-app.md §3`·`3-auth-session.md §3.1` 이 **이미 확정해 둔 동일한 계약**(마지막 `wc:boot` 적용, 세션 확립 후 재전송은 세션 불가침, `200+running`→복원)을 코드가 정확히 만족시키기 위한 client-local 동시성 버그 수정의 반복이었고, 이 계약 자체를 바꾸거나 다른 spec 영역으로 표면을 확장하지 않았다. `git diff origin/main` 실측으로 spec 텍스트 변경은 19_46_54 가 이미 승인한 `2-sdk.md` frontmatter 4줄이 전부이고(본문 무변경), `widget-state.ts` 의 상태전이표는 코드 레벨에서 순변경 0(A-6 도입 후 되돌림)이며, 실제 행동이 바뀐 것은 `use-widget.ts` 내부의 `worldGenRef`/`bootGenRef`/`sessionEstablished()`/`openStream` 짝 게이트뿐이다. 이들은 모두 **in-memory React ref** 로, 영속 엔티티·API 엔드포인트·요구사항 ID·RBAC 어느 것도 신설·변경하지 않으며 백엔드 코드는 이번 diff 에 전혀 포함되지 않았다. EIA 의 `interact` 명령 계약(`cancel`/`end_conversation` 필드·`STATE_MISMATCH` 표면 제약·`SSE 동시연결 상한 3`)과도 대조했으나 충돌 없음을 확인했다. 유일하게 눈에 띄는 항목 2건은 모두 INFO 수준으로, 하나는 19_46_54 부터 이월된 target-고유가 아닌 `12-webhook §3.2` 절 번호 drift(변동 없음, 이번 PR 무관), 다른 하나는 이번 diff 가 만들지 않은 pre-existing impl-vs-spec 갭(`ERROR→[ended]` vs Form 재제출 약속)으로 이미 별도 `project-planner` plan 으로 분리·추적 중임을 재확인한 것뿐이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 어디에서도 이번 diff 로 인한 신규 cross-spec 모순은 발견되지 않았다.

## 위험도

LOW
