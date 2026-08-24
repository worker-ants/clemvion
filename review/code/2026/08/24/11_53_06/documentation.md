STATUS=success documentation review complete (target: node-output-envelope-458f05, 3회차 — 직전 두 라운드(11_05_39·11_34_04) WARNING/CRITICAL 전건 해소 확인 + 최신 커밋(`225936105`)의 INFO 2건 처리 상태 검증)
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `node-output-envelope` (3회차, `envelope.output` fail-closed allowlist)

## 리뷰 방법

이번 diff(39개 파일, `origin/main` 대비)는 누적 상태이며, 실질적으로 **직전 두 리뷰 라운드
이후 새로 추가된 것은 커밋 `225936105`(`test(ws): .failed 방향을 직접 못박는다`) 하나뿐**이다
(`git log --oneline` / `git show --stat 225936105` 로 확인). 이 커밋은 `11_34_04` documentation
라운드가 남긴 INFO 1(JSDoc 줄바꿈)과 testing 라운드가 남긴 INFO 2(`.failed` 방향 직접 증거
부재)를 겨냥한다. 나머지 37개 파일(코드 diff 본문·plan·spec·이전 두 라운드 review 산출물)은
`11_34_04` 라운드가 이미 위험도 NONE/LOW 로 상세 검토를 마쳤고, 이번 diff 에서 그 내용 자체는
바뀌지 않았으므로(그 라운드의 산출물이 이번에 커밋 대상으로 추가됐을 뿐) 재검토하지 않는다.
대신 저장소를 직접 `Read`/`grep` 하여 (1) 두 INFO 가 실제로 해소됐는지, (2) 그 해소 커밋이
plan 문서와 정합한지를 확인했다.

## 이전 라운드 INFO 처리 확인

- **`11_34_04` documentation INFO(JSDoc 줄바꿈, `websocket.service.ts:493` 135자)** — **해소
  확인**. 현재 파일에서 해당 JSDoc 블록(492~493행)은 106자/111자로 재정렬됐고, 인접 줄 관례
  (63~119자)에 맞다.
- **`11_34_04` testing INFO 2(`.failed` 방향 직접 증거 부재)** — **해소 확인**.
  `websocket.service.spec.ts` 에 `NodeEventType.NODE_FAILED` 캐너리가 신규 추가됐다
  (`it('[캐너리] \`execution.node.failed\` 의 \`envelope.output\` 도 allowlist 를 지난다', …)`).
  JSDoc 이 "왜 이 캐너리가 필요한가"(직전 라운드가 거부한 "논리적 보장 vs 직접 증거" 논법을
  스스로 재적용하지 않기 위해)를 명시하고, `error`/`output`/`output.output` 세 레벨을 함께
  단언해 WS §4.1 표 재정정(래퍼/도메인값 층 분리)과 일치시켰다. 커밋 메시지가 "`output` 배선을
  빼니 3건 RED" 로 non-vacuous 함을 재확인한 것도 그대로다.

## 발견사항

- **[WARNING]** plan 체크리스트가 커밋 메시지의 완료 선언과 어긋난다 — "TEST WORKFLOW 4단계
  PASS" 를 커밋 본문에 적었는데 그 체크박스는 여전히 미체크다
  - 위치: `plan/in-progress/node-output-envelope.md:115` (`- [ ] TEST WORKFLOW 4단계 + ratchet`)
  - 상세: 커밋 `225936105`("`test(ws): .failed 방향을 직접 못박는다`")의 본문은 *"TEST WORKFLOW
    4단계 PASS — backend **8,997 passed** / 433 suites · e2e 285 passed · ratchet 199/38
    일치"* 라고 구체적 수치까지 들어 명시적으로 완료를 선언한다. 그런데 같은 커밋이 함께 실어
    보낸 `plan/in-progress/node-output-envelope.md` 는 그대로다 — `## 작업` 체크리스트의
    `- [ ] TEST WORKFLOW 4단계 + ratchet` 항목이 여전히 미체크(`[ ]`)로 남아 있다(다른 완료
    항목 6개는 모두 `[x]`). 이 저장소는 "plan 체크박스 = 실제 상태" 를 SoT 로 삼는 관례를
    반복적으로 강조해 왔고(같은 종류의 누락이 과거 세션에서 여러 차례 지적된 이력이 있다),
    지금 이 커밋 자체가 그 상태를 문서에 반영하지 않은 사례다. 체크박스만 보고 상태를 판단하는
    다음 세션·에이전트(예: 종결 게이트, plan lifecycle 이동 판단)가 "TEST WORKFLOW 가 아직
    안 돌았다" 고 오판할 수 있다 — 실제로는 커밋 메시지에 통과 근거가 이미 있다.
  - 제안: `- [x] TEST WORKFLOW 4단계 + ratchet`(수치 포함, 이미 커밋 메시지에 있는 값 재사용)로
    동기화. 남는 미체크 항목은 `/ai-review`(이 리뷰 자체) 하나만 되도록.

## 확인했지만 문제 없음 (참고)

- `spec/5-system/6-websocket-protocol.md:188`(`execution.node.failed` 행)이 이번 라운드
  이전부터 주장해 온 *"`output` 도 함께 실린다 … 이 래퍼도 fanout 에서 같은 allowlist 를
  지난다"* 는, 이번 커밋이 추가한 `NODE_FAILED` 캐너리로 이제 **직접 증거**를 얻었다 — 문서한
  보장이 구현보다 넓다는 지적(이 프로젝트가 반복 겪은 결함 클래스)이 실제로 이 회차에서 선제
  차단됐다.
- 신규 캐너리도 기존과 같은 `describe('llmCalls strip — 외부 fanout 수신자 보호', …)` 블록
  (604~1256행) 안에 위치한다 — 새 결함이 아니라 `11_05_39` maintainability 리뷰가 이미 등재해
  둔 describe 배치 이슈의 연장이며, 그 트래커가 이미 소유하고 있다.
- 테스트 전용 변경(코드 로직 변경 없음)이므로 CHANGELOG·API 문서 추가 갱신 불요 — 기존 판단
  유지.
- plan 문서에 `## 체크리스트` 형태의 별도 하단 섹션은 없다(`## 작업` 하나뿐) — "체크박스 두 곳
  동기화" 류 결함은 해당 없음.

## 요약

이번 라운드의 실질 diff 는 직전 두 라운드가 남긴 INFO 2건(JSDoc 줄바꿈, `.failed` 방향 직접
증거 부재)을 정확히 겨냥해 해소한 커밋 하나뿐이고, 둘 다 재확인 결과 실제로 해소돼 있다 —
특히 `.failed` 캐너리 추가는 "문서한 보장이 구현보다 넓으면 안 된다"는 이 저장소의 핵심
원칙을 스스로 적용한 좋은 사례다. 다만 그 해소 커밋 자체가 본문에서 "TEST WORKFLOW 4단계
PASS" 를 구체적 수치로 선언했음에도 plan 체크리스트의 해당 항목을 `[x]` 로 동기화하지 않아,
plan 을 SoT 로 참고하는 후속 판단에 오정보를 남긴다(WARNING 1건). Critical 급 결함은 없다.

## 위험도

LOW
