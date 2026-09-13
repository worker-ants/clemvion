# 요구사항(Requirement) 코드 리뷰

## 발견사항

- **[WARNING]** `CODE_FIELD` 축 2 의 라운드4 왼쪽 경계 수정이 "소문자로 `code` 로 끝나는 키" 를 완전히 배제하지 못한다 — 앞에 언더스코어가 오는 스네이크케이스 키(`error_code:`, `http_code:`)는 여전히 오매칭된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의 `CODE_FIELD` 정의 (`const CODE_FIELD = new RegExp(`(?<![A-Za-z])"?code"?\\s*:\\s*"(${UPPER_SNAKE})"`, "g");`)
  - 상세: 라운드4 커밋(`6b4c03af6`)은 리뷰어 지적("`code` 로 끝나는 다른 키가 오매칭된다")에 대해 `(?<![A-Za-z])` 왼쪽 경계를 추가하고 "위험한 형태는 **전부 소문자로 `code` 로 끝나는 키**다" 라고 결론짓는다. 그러나 이 부정 lookbehind 는 알파벳만 배제하고 언더스코어(`_`)는 배제하지 않는다. 직접 재현(node 로 정규식 실행, 저장소 파일은 건드리지 않음): `{ "error_code": "SOME_TOKEN" }` → `code": "SOME_TOKEN"` 매치, `{ error_code: "SOME_TOKEN" }` → `code: "SOME_TOKEN"` 매치. 즉 "전부 소문자로 code 로 끝나는 키" 라는 커밋 메시지·주석의 결론 자체가 부정확하다 — 정확히는 "바로 앞 문자가 알파벳이 아닌, code 로 끝나는 키" 이고 `_code` 류는 여전히 위험 형태에 포함된다. 오늘 코퍼스(`codebase/frontend/src/content/docs/**/*.mdx`)에는 `_code:` 형태의 키가 없어(grep 확인) 현재 판정에 영향은 없고, 이 축은 허용목록이 없는 baseline-0 축이라 실제로 그런 키가 나타나면 (실재하지 않는 토큰이 아닌 한) 오탐이 아니라 과탐지(over-matching) 로 이어져 조용히 넘어가거나, 기준집합에 없는 값이면 build 를 fail-safe 하게 차단하는 방향이라 보안·정합성 리스크는 낮다. 다만 라운드4가 "지적은 맞았고 예시는 틀렸다" 며 경계를 **완전히 고쳤다고 결론**낸 것과 달리 경계는 **부분적으로만** 고쳐졌다 — 다음 사람이 이 주석의 "전부" 라는 표현을 믿고 재확인 없이 넘어갈 수 있다.
  - 제안: `(?<![A-Za-z])` 를 `(?<![A-Za-z_])` 로 넓히거나(단 `error_code` 같은 실제 필드명이 오늘 정말 없는지 재확인 필요), 그럴 의도가 없다면(즉 `_code` 접미사는 의도적으로 축 2 대상이라면) 주석의 "전부 소문자로 code 로 끝나는 키" 라는 문구를 "바로 앞이 알파벳이 아닌 경우" 로 정정해 다음 사람이 오독하지 않게 한다. 어느 쪽이든 최소 한 줄의 판별 fixture(`error_code` 비대상/대상 여부 명시)를 추가하는 편이 이 파일의 다른 대조군 패턴과 일관적이다.

- **[SPEC-DRIFT]** `spec/conventions/user-guide-evidence.md §2` 가 "Build-time 가드 (3건)" 으로만 서술하고 있어, 이번 PR 이 유지·확장한 `guide-identifier-existence.test.ts`(전신 `guide-error-code-existence.test.ts`, `#1330`)와 `guide-sanitized-message-parity.test.ts` 는 SoT 표·§2.1 관계표에 등재돼 있지 않다
  - 위치: `spec/conventions/user-guide-evidence.md:68-76` (`## 2. Build-time 가드 (3건)` 표와 그 앞 문단)
  - 상세: 이 두 가드는 이미 코드에 존재하고(`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`, `guide-sanitized-message-parity.test.ts`) `CHANGELOG.md`·`PROJECT.md` 가드 카탈로그에는 정확히 반영돼 있는데, 이 컨벤션 문서만 `#1330` 이전 상태(3건)에 머물러 있다. 코드가 옳고(가드가 실제로 5건 존재하며 정상 동작) spec 문서 갱신이 누락된 전형적 SPEC-DRIFT 다. **다만 이것은 이번 리뷰가 처음 발견한 것이 아니다** — `plan/in-progress/spec-draft-nullable-notation-followups.md:3252` 에 이미 "`§2` 는 '가드 3건' 이라고 세고 §2.1 관계표에도 행이 없다 → 3건 → 5건" 으로 planner 등재돼 있고, `plan/in-progress/guide-identifier-existence.md` §D #1·#2 도 동일 갭을 `--impl-prep` 단계에서 확인해 같은 planner 항목에 묶어 등재했다(developer 는 `spec/` 쓰기 권한이 없어 직접 고칠 수 없음 — 관례상 정당한 처리). 따라서 이 발견사항은 **새 조치를 요구하지 않고**, 관련 spec 반영이 아직 completed 로 넘어가지 않았다는 사실을 기록하는 용도다.
  - 제안: 코드 되돌리기 아님 — `spec/conventions/user-guide-evidence.md §2` 표에 `guide-identifier-existence.test.ts`(`impl-anchor-existence.test.ts` 옆) · `guide-sanitized-message-parity.test.ts` 두 행을 추가하고 §2.1 관계표에도 대응 행을 추가하는 것은 이미 등재된 planner 백로그(`spec-draft-nullable-notation-followups.md`) 몫이다. 새 등재 불필요.

- **[INFO]** 기준집합(basis)이 `codebase/channel-web-chat`(임베드형 웹채팅 위젯 SPA) 의 소스 코드와 `.env.example` 을 포함하지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:34-48` (`envExampleTexts`, `sourceTexts` 구성부)
  - 상세: `sourceTexts` 는 `codebase/backend/src`·`codebase/packages` 만, `envExampleTexts` 는 `codebase/backend/.env.example`·`codebase/frontend/.env.example` 만 읽는다. `codebase/channel-web-chat/.env.example` 과 그 소스는 기준집합에 없다. 실측 결과 오늘 유저 가이드(`content/docs/06-integrations-and-config/web-chat*.mdx`)에는 그쪽 도메인의 UPPER_SNAKE 백틱 인용이 0건이라(grep 확인) 현재 판정에는 영향이 없지만, `composeTexts` 가 이번 라운드에 "이름/문서가 약속한 범위보다 넓다" 로 이미 한 번 지적·수정된 것과 대칭적으로, 이쪽은 "기준집합이 다루는 코드베이스 범위" 가 암묵적으로 backend+packages+frontend(.env만) 로 좁게 정의돼 있다는 사실이 코드 어디에도 명시적으로 설명돼 있지 않다(왜 frontend 소스는 명시적으로 제외한다고 주석에 적으면서 channel-web-chat 은 언급조차 없는지).
  - 제안: 즉각 조치 불요. 다음에 웹채팅 위젯 관련 가이드 절이 이 문서군에 추가되고 그 안에 위젯 전용 env 변수/식별자가 인용되면 기준집합 확장이 필요할 수 있다는 점을 스캐너 JSDoc 의 "무엇을 넣고 무엇을 뺐는지" 서술에 한 줄 추가하는 정도로 충분.

## 요약

이번 diff 의 핵심(`guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`)은 트래커 항목("가이드가 적는 식별자가 실재하는지 세는 가드가 없다")이 요구한 두 축(에러 코드 + 환경변수) 을 완전히 구현하고, 자신을 만들게 한 과거 결함(`MCP_INSECURE_URL_ALLOWED` 오기)을 3갈래 회귀 테스트로 재현해 실제로 잡는다는 것을 실측으로 증명한다. 베이스라인 0·허용목록 4강제·축별 대조군·vacuity floor·과거 결함 재현까지 이 저장소가 확립한 가드 작성 패턴을 충실히 따르며, 26개 테스트가 전부 통과한다(직접 재실행 확인). 이미 4라운드에 걸친 `/ai-review`+`--impl-done` 사이클로 Critical 은 한 번도 남지 않았고 라운드4가 남은 WARNING(축 2 왼쪽 경계) 을 실측과 함께 고쳤다. 다만 그 라운드4 수정 자체가 "전부 소문자로 code 로 끝나는 키" 라고 결론 내린 것과 달리 언더스코어 선행 키(`error_code:` 류)는 여전히 매칭되는 잔여 경계 갭이 있음을 직접 재현으로 확인했다 — 오늘 코퍼스에는 영향이 없는 latent 갭이라 CRITICAL 은 아니지만 커밋 주석의 "전부" 라는 단정이 근거보다 넓다. `spec/conventions/user-guide-evidence.md §2` 의 가드 인벤토리가 3건에서 갱신되지 않은 SPEC-DRIFT 도 확인했으나, 이는 이미 developer 권한 밖 planner 백로그로 정확히 등재돼 있어 이번 리뷰가 요구하는 추가 조치는 없다. 전체적으로 요구사항 충족도는 높고 잔여 항목은 모두 낮은 비용의 후속 정리 수준이다.

## 위험도

LOW
