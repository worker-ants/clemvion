# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 가 여전히 누락
  - 위치: `spec/4-nodes/4-integration/1-http-request.md:1-7` (frontmatter `code:` 배열). 실제 코드: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (§4 step 9 — 리다이렉트 5홉 + 홉마다 SSRF 재검증을 구현)
  - 상세: 이번 PR 이 `http-redirect.ts` 를 직접 수정(파일 7·8)했고 신규 spec 파일까지 만들었는데, 그 파일을 구현 증거로 삼는 `1-http-request.md` frontmatter `code:` 목록에는 여전히 이름이 없다(`spec/conventions/spec-impl-evidence.md` §2.1 위반 소지). `spec/` 쓰기는 developer 권한 밖이라 이 PR 이 직접 고칠 수 없고, 증거 목록 누락은 자기-반증형 소정정 대상도 아니다. 이미 1라운드 코드리뷰(`review/code/2026/09/20/09_35_16` WARNING 5)와 `--impl-prep` consistency check(`review/consistency/2026/09/20/09_06_34` convention_compliance WARNING 2)가 각각 잡아 `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 백로그에 정확히 등재돼 있다. 새로 발견한 결함이 아니라 현재도 미해소 상태임을 재확인.
  - 제안: 조치 불요(developer 스코프 밖) — `project-planner` 턴에서 `code:` 에 `http-redirect.ts` 추가.

- **[INFO]** spec 에러 코드 표에 "SSRF 가드의 비판정 오류 → `INTEGRATION_CALL_FAILED`" 트리거가 등재돼 있지 않음
  - 위치: `spec/4-nodes/4-integration/0-common.md:85`(§4.2 표), `spec/4-nodes/4-integration/1-http-request.md:339`(§4.2 표), `spec/4-nodes/4-integration/2-database-query.md:344`(§6.2 표)
  - 상세: 이번 PR 이 네 호출부(`http-request.handler.ts`, `database-query.handler.ts`, `database-connection-tester.ts`, `http-redirect.ts`)에 "가드가 판정(`SsrfBlockedError`) 아닌 오류를 던지면 `INTEGRATION_CALL_FAILED`/`DB_CONNECT_FAILED` 로 분류한다"는 새 동작을 넣었지만, 위 세 표는 여전히 종전 트리거 목록만 나열한다. 모순은 아니고(코드는 실제로 공통 §4.2 의 기존 `INTEGRATION_CALL_FAILED` 코드를 재사용) 완전성 갭이다. developer 자신이 `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 backlog 항목, `1-http-request.md` frontmatter 항목과 같은 단락)에 planner 후속 작업으로 정확히 등재했고, `--impl-prep` consistency check(`review/consistency/2026/09/20/09_06_34` cross_spec INFO 1)도 동일하게 지적했다.
  - 제안: 조치 불요(developer 스코프 밖, 이미 등재됨) — `--impl-done` 이후 `project-planner` 턴에서 세 표에 한 줄씩 추가.

- **[INFO]** 트래커가 아직 존재하지 않는 `plan/complete/ssrf-catch-instanceof.md` 를 선인용
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (SSRF 가드 소비자 넷 항목, "**2026-09-20 해소**" 문구가 `plan/complete/ssrf-catch-instanceof.md` 를 인용) / `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트 마지막 3항목(`/ai-review 수렴`, `--impl-done`, `트래커 해소 · 이 plan complete/ 로`)
  - 상세: 트래커 항목은 `[x]` 로 체크돼 "해소"라고 서술하며 `plan/complete/ssrf-catch-instanceof.md` 를 근거로 인용하지만, 실제로 그 경로는 아직 존재하지 않는다(`plan/in-progress/ssrf-catch-instanceof.md` 로만 존재, `git mv` 안 됨). 같은 plan 자신의 체크리스트도 리뷰 수렴·`--impl-done`·이동 3항목이 미체크 상태다. 시점상 이름(dangling forward reference)이며, 직전 라운드 리뷰(`review/code/2026/09/20/10_09_56` INFO 10)가 이미 지적했고 RESOLUTION.md 가 "이번 라운드가 수렴하면 마무리 커밋에서 셋을 함께 닫는다"고 명시했다 — 새 결함이 아니라 아직 그 마무리 커밋 전이라 남아 있는 상태.
  - 제안: 조치 불요(이미 계획됨) — 이번 리뷰가 Critical/Warning 없이 수렴하면 마무리 커밋에서 plan 체크리스트 3항목 완료 + `plan/complete/` 실제 이동으로 서술과 상태를 일치시킬 것.

- **[INFO]** 알려진 host/IP 마스킹 비대칭 잔여 — `http-connection-tester.ts` 의 `describeFailure`→`clampMessage` 경로
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:148-152`(catch 블록, `message: clampMessage(describeFailure(err))`)
  - 상세: 판정(`SsrfBlockedError`) 분기는 host/IP 를 제거한 고정 일반화 문구(`SSRF_BLOCKED_CLIENT_MESSAGE`)를 쓰는데, 이 catch-all 경로는 `sanitizeMessage` 없이 `clampMessage` 만 거쳐 원문 메시지가 그대로 나간다. 코드 확인 결과 이 경로가 실제로 받을 수 있는 유일한 비판정 오류(`isBlockedHostname` 의 `TypeError`, `http-safety.ts:132` `hostname.toLowerCase()`)는 host/IP 를 담지 않는 런타임 표준 메시지라 즉시 유출은 없음을 직접 확인했다 — tracker(`plan/in-progress/spec-draft-nullable-notation-followups.md`, 신규 항목)에 "이 PR 이 만든 자리가 아니라 그대로 뒀다"고 정확히 등재돼 있다.
  - 제안: 조치 불요(이미 트래커에 등재, 세 곳 고정 문구 vs `sanitizeMessage` 확장 중 택1은 전 노드 오류 문구에 영향을 주는 별도 결정으로 미룸).

## 확인된 양호 사항 (참고)

- `http-redirect.ts` 의 `outboundBlockReason`/`followRedirectsSafely` JSDoc(19-56행)이 이번 diff 가 바꾼 throw 계약("판정만 사유가 된다 / 던지는 것 둘")을 정확히 반영하도록 갱신돼 있음을 소스에서 직접 확인 — 직전 라운드(2라운드) WARNING 2 로 지적됐던 JSDoc-코드 불일치가 `fff0d14bf` 커밋으로 실제로 고쳐졌다.
- `database-connection-tester.ts:145-146` 의 "§위 JSDoc" 참조 방향 오기(직전 라운드 INFO 8)도 실제로 정정돼 있음을 확인.
- `http-request.handler.ts:364-379` 의 `toLogError(err)` 중복 호출(직전 라운드 INFO 1) 및 `database-query.handler.ts:265-279` 의 `err instanceof Error ? … : …` 중복 표현(직전 라운드 WARNING 4) 모두 `const` 로 한 번만 계산해 재사용하도록 실제로 고쳐져 있음을 확인 — 주석·리뷰 서술과 코드가 일치한다.
- 신규 테스트(파일 1, 3, 5, 7, 9)마다 "왜 이 방식으로 mock 하는지", "왜 이 순서로 검증하는지"를 설명하는 JSDoc 블록/인라인 주석이 붙어 있어 인라인 주석 항목에서 특히 우수함(예: `http-connection-tester.spec.ts:241-245` 의 타임아웃 신호 생성 순서 설명, `database-query.handler.spec.ts:10-11` 의 mock 전략 설명).
- README/CHANGELOG/환경변수 문서화 대상은 없음 — 순수 에러 분류 리팩터이며 새 공개 API·설정·엔드포인트가 없다.

## 요약

이번 PR 은 이미 두 차례 리뷰 라운드를 거치며 문서화 관점 발견사항(JSDoc-코드 불일치, 주석 방향 오기, 중복 표현)이 실제 커밋으로 정확히 해소됐음을 소스 대조로 확인했다. 남은 항목은 전부 developer 스코프 밖(spec frontmatter·에러 코드 표는 planner 소관)이거나 마무리 커밋에서 처리하기로 이미 명시적으로 계획된 것들이며, 신규로 발견된 문서화 결함은 없다. 다만 `1-http-request.md` frontmatter `code:` 목록의 `http-redirect.ts` 누락과 spec 에러 코드 표 3곳의 완전성 갭은 이 PR 이 병합되는 시점 기준으로도 여전히 미해소 상태이므로, 병합 직후 planner 턴에서 반드시 마무리해야 한다.

## 위험도

LOW
