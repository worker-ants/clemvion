# RESOLUTION — `00_26_17` (`--impl-done spec/conventions/`, BLOCK: NO)

자기-반증형 소정정 예외가 요구하는 사후 게이트. **BLOCK: NO** — 5조건 충족을 checker 가
실측으로 확인했다(convention_compliance). CRITICAL 0 · WARNING 1.

## WARNING 1 — 내가 인용을 **지어냈다**

`node-output-allowlist.ts` 의 주석이 chat-channel 4키를 두고
*"§R17 이 정의한 **「렌더에 필요한 키」** 에 해당한다"* 라고 적었는데, **§R17 에 그 표현은
없다** — `grep -c` 결과 **0건**(실측).

이건 서술 부정확이 아니라 **없는 문장을 SoT 에 귀속시킨 것**이다. 이 저장소가 Rationale
에서 반복해 겪은 형태와 같고(*"기각된 대안을 지어내면 checker 가 잡는다"*), 실제로
checker 가 잡았다. 게다가 **`22_26_33` 부터 2라운드째** 지적이라 이번에 WARNING 으로
격상됐다 — 내가 그때 SUMMARY 의 집계 표만 보고 개별 checker 리포트를 안 읽은 결과다.

**고친 방식**: 없는 인용을 지우고 **§R17 이 실제로 하는 일**을 적었다 — 그 표가 이 넷을
`wire 전용 (chat-channel 렌더러)` 라는 **별도 갈래**에 둔 것. 그리고 사실관계를 뒤집어
명시했다: 이 넷은 **§R17 이 정의한 키가 아니라** `NodeHandlerOutput` 계약 밖의
**별개 carve-out** 이고, 위젯 4키와 마찬가지로 타입이 아니라 리터럴 테스트가 지킨다.

**형제 스윕**: `§R17` 과 큰따옴표가 같이 나오는 자리를 `codebase/backend/src` 전체에서
훑었다. 나머지 4곳(`redact-stored-error.ts` ×2 · `execution-response.dto.ts` ·
`background-run-response.dto.ts` · `interaction.service.spec.ts`)이 인용한
*"내부 읽기 경로"*(3건) · *"표면 제약"*(3건)은 **§R17 에 실재한다**(실측). 지어낸 것은
내가 이번 PR 에 넣은 하나뿐이다.

## INFO

- **#4** — `conversation-thread.md` frontmatter `code:` 에 `websocket.service.ts` 누락.
  **이번 턴에 안 고쳤다**: 자기-반증형 소정정 예외는 *"내가 쓴 문장의 정정"* 에만 열리고
  **frontmatter 메타데이터 추가는 그 범위가 아니다**. 예외를 만능 통행증으로 넓히지 않기
  위해 정본 트래커에 planner 항목으로 등재했다.
- **#2·#3** (`node-output.md` Principle 0 각주 · `egress-masking.md` §2 순서) — 둘 다
  이미 정본 트래커에 planner 소관으로 등재돼 있다(checker 도 그렇게 확인).
- **#6** — 조건②(예고·트리거 vs API 계약) 경계가 미묘하다는 기록. checker 판정은
  **예고/상태-고지 쪽**으로 확정. 이 세션의 판단과 일치하고, §R17 의 *"같은 강도다"* 를
  API 계약으로 보아 planner 턴으로 돌린 것과도 일관된다.
- **#1·#5·#7** — 기록 목적 / 기존 구조 / harness 예산 갭(세션 범위 밖).
