# RESOLUTION — 23_58_23

리뷰어 8명(forced 7 + concurrency) 완료. 신규 CRITICAL 1건(3인 독립 재현) 실측 재현 후 fix.
WARNING 전부 처리 또는 근거 있는 이월. 남은 미해결 Critical/Warning 없음.

## 처리 커밋

| 커밋 | 내용 |
| --- | --- |
| `7cfbf2557` | CRITICAL — `start()` 의 지연 seed 를 boot 축 스냅샷으로 보호(세번째 되감기 경로) |
| `a2cd6ebb7` | WARNING 정합 — 되돌려진 메커니즘 주석·이월 분리·테스트 단언·trailing ws |

## 각 발견의 처분

### CRITICAL — `start()` 무방비 (concurrency·requirement·side_effect 3인 독립)

**fix**. 세 리뷰어가 각자 실제 코드로 재현(EventSource 이중 생성까지). 나도 재현
테스트(실제 훅, EventSource 개수 단언)로 재확인 후 `start()` 가 읽기전용 boot 스냅샷을
`seedWaitingFromStatus` 에 넘기도록 fix. mutation: 그 인자 제거 → 정확히 신규 테스트만 실패(n1).

- **왜 직전 라운드에 놓쳤나**: 18_39_11 concurrency 리뷰의 INFO 가 "start() 는 world 축만 필요,
  같은 fix 가 이 경로도 닫는다 — 별도 수정 불필요" 로 종결했고 내가 그걸 믿었다. `start()` 가
  `attempt` 를 안 넘기면 WAITING 분기의 `if (attempt && cannotApplyConfig(attempt))` 가 단락돼
  가드가 통째로 스킵된다는 걸 놓친 것이다. **이 클래스의 9번째 거울상** — JSDoc 이 스스로
  "start() 는 world 축만 필요" 라고 근거를 적어 뒀는데 그게 반증됐다. 관련 JSDoc 2곳 정정.
- **반대 구멍 점검**(착수 전): 새 boot 이 무효(`!apiBase`)면 bootGen 미증가 → start 스냅샷 유효 →
  정상 dispatch / BLOCKED 면 위젯이 blocked 라 skip 무해 / 새 boot 없으면 스냅샷 일치 → start
  승리. "start 가 이겨야 하는데 skip" 케이스 없음. 종료 확정 분기는 world 축 유지(자동 상속).

### WARNING

- **테스트 주석이 되돌려진 C1 메커니즘 서술**(documentation) → **fix**. 직전 RESOLUTION 이 이
  위치를 "fix" 표시했으나 실제론 CHANGELOG 만 고치고 테스트 주석은 놓쳤다(documentation 리뷰어가
  `git log -L` 로 추적). 실제 동작으로 재작성 — checkpoint 1 이 boot 축 전용이라 2차 config 가
  1차 world 증가에 안 밀리고, 종료 확정은 대체된 1차가 world 축으로 그대로 한다.
- **plan 의 일어난 적 없는 단계**(documentation) → **fix**. 일괄 치환이 과거형 서술을 덮어써
  "§106→§3(재전송) 39건" 을 만들었다. 실제 2단계로 정정.
- **새로고침 복원 테스트의 SSE 단언 갭**(testing) → **fix**. 새 EventSource 생성 단언 추가.
- **`useEiaSession` 산문 이월**(maintainability) → **fix**. 별도 plan 분리
  (`webchat-usewidget-extraction.md`, owner developer, unstarted) — 형제 항목과 동일 처분.
- **JSDoc 인접성 절차적 방어**(maintainability) → **이월**. 구조적 가드(lint/test) 검토를 분리 plan 에
  기록. 이번 PR 범위 밖(리팩토링 트랙).
- **trailing whitespace 빈 줄**(scope) → **fix**. 제거.
- **`apiBase` 축 분리**(security·side_effect) → **이월**. 선행 결함(session-store 가 발급 apiBase
  미기록). security 리뷰어가 격리 worktree 실측으로 "이번 되돌림이 악화시키지 않음" 확인.

### INFO (조치 불요)

- A-6 되돌림이 브랜치 시작 전 기준선과 바이트 동일(security·side_effect 확인) — 순변경 0.
- N-way 카운터 불변식(concurrency): checkpoint 1 을 통과할 수 있는 attempt 는 임의 시점 최대 1개.

## 검증 (fix 후, 최종 코드 `a2cd6ebb7` 기준)

- tsc: **통과**
- vitest(channel-web-chat): **391 passed**(22 파일) — 재현 테스트 +1
- JSDoc 10심볼 전수 부착(`ts.getJSDocCommentsAndTags()`), trailing ws 0
- mutation: `start()` boot 스냅샷 인자 제거 → 정확히 신규 재현 테스트만 실패(n1); 복원 시 통과

전체 스택(lint/unit/build/e2e)은 push 전 TEST WORKFLOW 로 재실행한다 — 아래 [검증 갱신] 참조.

## [검증 갱신] — TEST WORKFLOW (push 직전)

전체 스택 재실행(최종 코드 기준):

- lint: **PASS** (59s)
- unit: **PASS** (65s) — backend **8225 passed** · frontend **5576 passed**(280파일) ·
  channel-web-chat **391 passed**(22파일)
- build: **PASS** (137s)
- e2e: **통과** (305s, `make e2e-test-full`) — 로그로 양쪽 확인: backend jest
  `Tests: 256 passed` + playwright `Running 51 tests` → **`51 passed (1.5m)`**.
  면제 불가(변경 set 에 `channel-web-chat/src/**` 실제 `.ts` 포함).
</content>
