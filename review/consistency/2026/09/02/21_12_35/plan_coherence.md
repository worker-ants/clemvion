# Plan 정합성 검토 — `spec-draft-change-password-code-alignment.md`

## 발견사항

- **[CRITICAL]** 착수 근거로 인용한 plan 의 "사용자 결정" 이 그 plan 문서 어디에도 기록돼 있지 않고, 실제 채택안이 그 plan 의 A/B/C 결정 메뉴 어디에도 해당하지 않는다
  - target 위치: 머리말 인용문 — `> 착수 근거: auth-change-password-oauth-only-code-split.md 의 사용자 결정(2026-09-02) — 선택지 1 "형제와 완전 정렬".` / 결정 ① 전체(신규 코드 0, `PASSWORD_NOT_SET` 신설 명시적 기각)
  - 관련 plan: `plan/in-progress/auth-change-password-oauth-only-code-split.md` — `## 선택지` 표(A 현상유지 / B `PASSWORD_NOT_SET` 신설·권장 / C 메시지만 분기) · `## 할 일` (`- [ ] 사용자 결정 — A / B / C 택일 (B 권장)` 등 전항목 `- [ ]` 미체크, "결정 기록" 절 자체가 없음 — `ai-agent-tool-connection-rewrite.md` 처럼 `## 결정 기록` 절을 두는 관례와 대비된다)
  - 상세: 실제로 파일을 읽어 확인한 결과(1) `auth-change-password-oauth-only-code-split.md` 는 옵션을 **A/B/C** 로만 나눈다. "선택지 1" 이라는 표기도, "형제와 완전 정렬" 이라는 문구도 이 파일에 없다. (2) target 이 실제로 고른 방안 — 기존 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 를 **재사용**하고 신규 코드를 만들지 않음 — 은 A(현상유지)도 C(메시지만 분기)도 아니고, **B 도 아니다**: B 는 명시적으로 *"미설정 조건만 신규 401 코드로 분리"* (`PASSWORD_NOT_SET` 신설)를 제안하는데 target 결정 ①은 바로 그 신설을 "이 작업이 없애려던 문제를 키운다" 며 거부한다. 즉 채택안은 plan 이 준비해 둔 3택 어디에도 속하지 않는 **네 번째 합성안**이다. (3) plan 의 `## 할 일` 항목은 전부 `(B 인 경우)` 로 조건화돼 있어, target 이 진행하는 변경(결정①·②·③, 변경안 #1~#12)은 이 체크리스트의 어느 조건 분기에서도 트리거되지 않는다 — plan 파일만 읽는 독자에게는 이 wire-code 변경이 **여전히 미승인**으로 보인다. (4) 같은 사실을 `spec/conventions/error-codes.md:82` §3 `INVALID_PASSWORD` 행과 `ws-token-expired-socket-lifetime-impl.md:78-80` 도 "미설정 조건 분리 여부는 **미결**" 이라고 명시적으로 적어 두고 있다 — 세 문서(§3 행·체크리스트·target 자신이 링크한 plan) 모두 "미결" 을 가리키는데 target 은 이미 해결된 것처럼 진행한다.
  - 제안: `auth-change-password-oauth-only-code-split.md` 를 **target 과 같은 턴/커밋**에서 갱신하되(이미 target 변경안 #13 이 이를 계획하고 있음), 단순 "체크박스 전환" 이 아니라 **옵션 표 자체를 수정**해야 한다 — 실제 채택안이 B 의 변형이 아니라 별개 안이라는 점을 명시(예: 표에 "D. 기존 형제 코드 재사용(신규 코드 0)" 행 추가 또는 B 항목을 채택안으로 재작성)하고 `## 결정 기록` 절을 신설해 "왜 B(권장안)를 거부했는가" 를 남긴다. 그래야 다음 사람이 §5 "두 번째 B 사례" 개수를 셀 때나 이 결정의 이력을 추적할 때 오독하지 않는다.

- **[WARNING]** target 의 plan 변경 항목(#13)이 "체크박스 전환" 으로만 서술돼 옵션 표 갱신 필요성을 놓칠 위험
  - target 위치: `## 변경안` > **plan** 표 #13 — `사용자 결정(선택지 1) 기록 + 체크박스 전환. 구현까지 끝나면 complete/ 이동`
  - 관련 plan: `plan/in-progress/auth-change-password-oauth-only-code-split.md` `## 할 일`
  - 상세: 위 CRITICAL 항목과 직결된다. "체크박스 전환" 이라는 표현은 A/B/C 중 하나를 고르는 절차를 연상시키지만, 실제로는 그중 어떤 체크박스를 켜도 실제 결정 내용(신규 코드 0)을 정확히 반영하지 못한다. developer/planner 가 이 문구만 보고 기계적으로 "B ✅" 로 표시하면, B 의 핵심 내용(`PASSWORD_NOT_SET` 신설)과 실제 구현(신설 없음)이 어긋난 채로 plan 이 "완료" 처리될 위험이 있다.
  - 제안: #13 서술에 "옵션 표를 채택안에 맞게 재작성" 을 명시적으로 추가.

- **[INFO]** `error-codes.md` 동시 편집 대상인 인접 in-progress plan 미인용
  - target 위치: `## 변경안` > spec 표 #9~#11 (`error-codes.md §3`/§5 편집)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` — 같은 파일(`error-codes.md`)의 `§Overview` 를 대상으로 하는 별도 in-progress 편집이며, 이 문서 자신이 "나란히 가는 plan" 절을 두어 `spec-update-node-cancellation-shutdown-classification.md §3` 과의 동시 편집 충돌 가능성을 이미 명시하는 관례를 따르고 있다.
  - 상세: target 이 손대는 절(§3·§5)과 `spec-conventions-engine-error-code-surface.md` 가 손대는 절(§Overview)은 겹치지 않아 실질 충돌 가능성은 낮지만, 이 저장소는 같은 파일을 겨누는 plan 간 "나란히 가는 plan" 상호 인용을 관례로 정착시켰다(위 파일 자체가 그 관례의 예). target 에는 그런 인용이 없다.
  - 제안: 낮은 우선순위 — 필요시 target 또는 `auth-change-password-oauth-only-code-split.md` 에 한 줄 교차 인용을 추가.

## 요약

target 의 spec draft 는 실측·설계 논리 자체는 탄탄하지만(형제 코드 재사용으로 신규 근접 명명을 막는다는 논거는 plan 의 권장안 B 보다 오히려 더 낫다), 그 정당성의 근거로 인용한 `auth-change-password-oauth-only-code-split.md` 의 "사용자 결정" 이 해당 plan 파일에 전혀 기록돼 있지 않고, 실제 채택안이 그 plan 이 준비해 둔 A/B/C 결정 메뉴 어디에도 속하지 않는다는 것이 핵심 결함이다. plan 의 `## 할 일` 체크리스트는 전부 "(B 인 경우)" 로 조건화돼 있어 target 이 진행하는 변경 어느 것도 그 체크리스트를 트리거하지 않으며, `error-codes.md §3` 행과 `ws-token-expired-socket-lifetime-impl.md` 체크리스트 모두 이 질문을 여전히 "미결" 로 명시한다. target 자신도 plan 갱신(#13)을 변경안에 포함시켜 두었으므로 완전한 무단 우회는 아니지만, 그 갱신 계획이 "체크박스 전환" 수준으로만 서술돼 있어 실제로는 옵션 표 자체를 재작성해야 하는 사실을 놓칠 위험이 크다.

## 위험도

HIGH
