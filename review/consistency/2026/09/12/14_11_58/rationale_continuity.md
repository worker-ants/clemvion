# Rationale 연속성 검토 — spec-update-chat-channel-adapter-status.md

## 검토 대상 요약

target: `plan/in-progress/spec-update-chat-channel-adapter-status.md` (SPEC-DRIFT draft).
`spec/conventions/chat-channel-adapter.md` frontmatter `pending_plans` 주석과 §1.1.2 "제거 조건"
콜아웃을, "`code` 선언 계약은 미구현" → "구현 완료(v1 provider 3종), 삭제 판정만 별도 추적"으로
정정하는 안.

## 발견사항

### [INFO] 프론트매터 주석의 "아래 첫 항목" 참조가 파일 단위 링크에 의존

- target 위치: `plan/in-progress/spec-update-chat-channel-adapter-status.md` §"제안 변경 1" After
  블록 (`spec/conventions/chat-channel-adapter.md:6-7` 대상)
- 과거 결정 출처: 없음 (신규 참조 표현 방식에 대한 제안)
- 상세: "그 판정은 아래 첫 항목(`CCA §1.1.2 의 401/403 fallback 제거 판정`)이 추적한다"는 문장은
  `pending_plans` 리스트의 **첫 파일 경로**(`spec-draft-nullable-notation-followups.md`)를
  가리키는데, 그 파일은 수백 개 항목을 담은 공용 followups 트래커이고 인용된 항목 제목은 그 안의
  한 checkbox(2812행)일 뿐이다. 항목 제목을 인용부호로 명시했으므로 실제 추적 실패 위험은 낮지만,
  "아래 첫 항목"이라는 서수 표현은 `pending_plans` 리스트의 배열 순서에 암묵적으로 결합돼 있어
  향후 그 리스트 순서가 바뀌면(예: 완료된 항목이 빠지고 재정렬) 문장이 조용히 틀린 것을 가리키게
  된다.
- 제안: "아래 `pending_plans` 첫 엔트리인 `spec-draft-nullable-notation-followups.md` 안의
  `CCA §1.1.2 의 401/403 fallback 제거 판정` 항목"처럼 파일명을 직접 명시해 서수 의존을 제거.
  cosmetic 수준이라 이 draft 를 막을 사유는 아님.

## 교차검증 (참고 — 위반 없음을 확인한 항목)

아래는 발견사항이 아니라, target 이 기존 Rationale 과 실제로 정합함을 확인한 근거다 (반증 시도가
전부 실패했음을 기록):

1. **R-CC-23 의 "제거 조건" 게이트 준수** — `chat-channel-adapter.md` §1.1.2 는 "v1 provider 3종이
   모두 `code` 를 부착하면 이 fallback 은 **삭제 후보**다. 조건만 적고 추적하지 않으면 한시적
   예외가 영구 예외가 되므로, 그 판정을 별 후속 항목으로 추적한다"고 명시(188~190행, 현재 파일
   기준). target 의 §1.1.2 After 안은 "조건 충족"만 선언하고 "**삭제 판정 자체는 아직 하지
   않았다**"며 그 판정을 `spec-draft-nullable-notation-followups.md`(2812행, 실존 확인)로
   위임한다 — Rationale 이 요구한 절차(조건 충족 ≠ 자동 삭제, 별도 판정 필수)를 정확히 따른다.
   기각된 대안을 재도입하거나 게이트를 우회하는 지점 없음.

2. **`status: partial` 유지 = `spec-impl-evidence.md §3.1` 전이 규칙 준수** — 그 컨벤션은
   "`partial` → `implemented`: **마지막** `pending_plans` 가 `complete/` 로 이동한 commit 안에서
   승격"이라고 규정한다. `chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md` /
   `chat-channel-visual-ssr-png.md` 3개는 여전히 미완료(실존 확인됨)이므로 target 은 `status`
   승격을 시도하지 않고 `partial` 을 유지한다 — 조기 승격으로 가드를 무력화하는 시도 없음.

3. **실측 근거 검증** — `git blame` 상 frontmatter 주석 2줄의 author 는 `8964a7114`(planner 턴),
   `git log` 상 `a4f943f4b`/`455d1526f` 커밋이 실재하며 `TELEGRAM_CREDENTIAL_REJECTED_STATUSES` /
   `SLACK_CREDENTIAL_REJECTED_ERRORS` / `DISCORD_CREDENTIAL_REJECTED_STATUSES` 3개 상수가 각 provider
   adapter 파일에 실재함을 grep 으로 확인. `spec/5-system/2-api-convention.md:355` ·
   `spec/conventions/swagger.md:291` 의 502 카탈로그 행도 이미 같은 커밋(`8964a7114`)에서 등재돼
   있어 R-CC-23 이 요구한 "완결 조건"(카탈로그 신설)이 이미 충족된 상태 — target 이 별도로
   손대지 않는 것이 맞다(중복 작업 방지).

4. **R-CCA-9 "기각한 대안" 재도입 없음** — target 은 "message 접두사로 분기" 또는 "status 숫자
   파싱" 등 R-CCA-9 가 명시 기각한 방식으로 되돌아가지 않는다. 오히려 그 결정(선언형 `code`
   property)의 실제 구현 완료를 서술할 뿐이다.

5. **CLAUDE.md "자기-반증형 소정정" 예외 미적용 판단이 옳음** — 대상 문장(frontmatter 주석)의
   작성자가 developer 가 아니라 planner 커밋(`8964a7114`)이므로 조건 1이 성립하지 않는다는
   원본 발견사항의 판단을 재확인(`git blame` 재실측 일치). target 이 이 정정을 developer 단독
   처리가 아니라 **plan draft로 남겨 planner 턴에 위임**한 것은 그 판단과 일관된 행동이다.

## 요약

target 은 `spec/conventions/chat-channel-adapter.md` 의 상태 서술(frontmatter·§1.1.2)을 실제
구현(commit `a4f943f4b`/`455d1526f`)에 맞춰 정정하는 순수 사실 갱신이며, 관련 Rationale
(`R-CC-23`, `R-CCA-9`, `spec-impl-evidence.md §3.1`)이 요구하는 절차 — 제거 조건 충족과 삭제
판정의 분리, `pending_plans` 완결 전 `status` 미승격 — 를 정확히 지킨다. 기각된 대안의 재도입,
합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다. 유일한 지적은 참조
표현의 서수 의존(cosmetic INFO)뿐이다.

## 위험도

NONE
