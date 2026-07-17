# 코드 리뷰 SUMMARY — webchat-boot-single-flight (18_39_11)

- **범위**: `git merge-base origin/main HEAD`(=`14bc86a53`)`..HEAD` — 7파일
  (`CHANGELOG.md`, `widget-state.ts`, `widget-state.test.ts`, `use-widget.ts`,
  `use-widget-eager-start.test.ts`, `plan/in-progress/webchat-boot-single-flight.md`,
  `spec/7-channel-web-chat/2-sdk.md`)
- **페이로드 무결성**: 고정 merge-base 3-dot 전환이 유효했다 — requirement 리뷰어가 독립
  재계산해 오염 0 확인(앞선 두 라운드는 2-dot 이라 main 전진분이 내 삭제로 둔갑했다).
- **실행 리뷰어**: 7/7 (documentation · maintainability · requirement · scope · security ·
  side_effect · testing) + concurrency(추가). `agents_forced` 전원 커버.
- **위험도**: **HIGH** — CRITICAL 3건 (전부 재현 확인 후 처리 완료)

## Critical

| # | 리뷰어 | 발견 | 재현 | 처리 |
| --- | --- | --- | --- | --- |
| C1 | requirement | `sendCommand` 비-410 경로의 `teardownSession()` 이 **일시적 실패(5xx·409·form 4xx·네트워크 순단)에도 storage 를 파괴** — 서버 execution 이 살아있는데 대화 영구 유실. `3-auth-session.md` §3.1-3 의 정리 조건 열거 위반 + §3.1-2("200+running → 복원") 위반 | ✅ 단일라인 A/B 귀속 | ✅ A-6 전체 되돌림 |
| C2 | concurrency | `seedWaitingFromStatus` 가 boot 축을 몰라, **대체된 시도의 지연 `getStatus` 가 살아있는 화면을 옛 노드로 되감음**(고착) | ✅ (리뷰어는 코드추적만 — 내가 재현) | ✅ WAITING 분기만 boot 게이팅 |
| C3 | documentation | `bootGenRef` JSDoc 유실 **재발** — 같은 클래스가 심볼만 옮겨 재현 | ✅ 컴파일러 API 실측 | ✅ 순서 교정 + 재발 방지 명문화 |

### C1 상세 — 이 클래스의 8번째 거울상

실측(격리 worktree, 그 한 줄만 mutate):

| | 저장세션 | 새로고침 후 phase | executionId |
| --- | --- | --- | --- |
| 한 줄 있음 | **소거(유실)** | `collapsed` | 없음 |
| 한 줄 없음 | 보존 | `streaming` | `e1` |

`getStatus` 는 내내 `200 {status:"running"}`. 리듀서의 `RESTORED`/`BOOTED` `ended` 가드도 같은
뿌리라 함께 되돌렸다 — **그 가드가 발화 가능한 유일한 상황이 곧 spec 이 복원하라고 명시한
상황**이었다(storage 를 지우는 종료 경로는 전부 저장 세션을 함께 지우므로 `RESTORED` 자체가
오지 않는다 → `ended` 인 채 `RESTORED` 가 도달하려면 storage 생존 = 비-410 실패뿐).

A-6 이 막으려던 부작용(재전송 시 `getStatus`·SSE 재발사)은 **이미 같은 PR 의
`sessionEstablished()` 복원-스킵이 막고 있었다** — teardown 은 불필요했을 뿐 아니라 유해했다.
A-6 전체가 순변경 0 이라 CHANGELOG 에서도 제거했다.

앞선 7번의 거울상은 "가드를 어느 축에 다느냐" 였다. 이번 원인은 다르다 — **"내가 막으려는 게
진짜 막아야 할 것인가" 를 spec 에 묻지 않았다.** 리뷰어 지적대로 내 테스트의 mock 이
`{status:"running"}`(서버 생존)을 고정해 두고도 storage 소거를 단언했다. 테스트가 스스로를
반증하고 있었는데 내가 못 봤다.

## Warning

| 리뷰어 | 발견 | 처리 |
| --- | --- | --- |
| requirement·documentation (교차) | CHANGELOG 항목 1·3 이 **되돌려진 설계**를 서술(git 증거 확정) | ✅ 순변경만 남겨 재작성 |
| documentation | `2-sdk.md` `§106` 자기참조가 대상 문단(L110)과 4줄 드리프트 — 내 frontmatter 4줄이 밀어냄 | ✅ §110 로 39건 정정 (표기 취약성은 planner 이월) |
| documentation | `widget-state.ts` RESTORED 주석이 "ERROR 는 세션 정리 안 함" 을 현재형 불변식처럼 서술 | ✅ C1 처리로 재작성 |
| concurrency | `sessionEstablished()` 가 `pendingResetRef` 와 같은 전제("재전송은 endpoint 를 안 바꾼다")에 기대는데 상호 참조 없음 | ✅ JSDoc 상호 참조 |
| testing ① | `beginBootAttempt` 가 world 축까지 무효화해도 385건 통과 | ✅ C2 짝 테스트가 닫음(재확인) |
| testing ② | `cannotApplyConfig` 의 `unmountedRef` 체크 제거해도 389건 통과 | ✅ 회귀 테스트 추가 |
| side_effect·security | 재전송 시 `apiBase` 축 분리(`session-store` 가 발급 apiBase 미기록) | ⏸ 이월 — **이번 diff 무관**(선행 존재) |

## 내가 틀렸던 것 (자기 정정)

- **"중복 `getStatus` 는 수렴하므로 낮음" 이월 판단이 틀렸다.** concurrency 가 반증 —
  "수렴" 은 두 응답 내용이 같다는 전제에 기댔는데, 내 근거 테스트는 `running`/`completed`
  스냅샷(논리 노드 없음)만 봤다. `waiting_for_input` 이 **다른 노드**로 두 번 오면 수렴하지
  않는다. **호출 횟수·스트림 개수 축에서 수렴한다고 콘텐츠 축에서도 수렴하는 게 아니다.**
- **`seedWaitingFromStatus` JSDoc 에 없던 실패를 지어냈다** — "종료 확정에 boot 가드를
  달았더니 §110 위반이 났다" 고 썼으나, plan 기록은 "불필요해져 되돌렸다" 이고 mutation 상
  그 가드를 달아도 당시엔 아무 테스트도 안 깨졌다. 정정 + 그 축을 테스트로 고정.

## 검증

lint PASS(60s) · unit PASS(82s) · build PASS(137s) — 로그로 실행 확인
(frontend 5513 passed/278파일 · channel-web-chat **390 passed**/22파일).

mutation 매트릭스(전부 재확인):

| 변형 | 실패 |
| --- | --- |
| `teardownSession()` 재주입(C1 결함) | 2 (정확히 신규 회귀 2건) |
| WAITING 분기 boot 가드 제거(C2 결함) | 1 |
| 종료 확정에 boot 가드 추가(반대 방향 오판) | 1 ← **직전엔 0(무방비)** |
| `beginBootAttempt` world 병합 | 1 ← **직전엔 0(무방비)** |
| `cannotApplyConfig` 의 `unmountedRef` 제거 | 1 ← **직전엔 0(무방비)** |
| baseline | 0 |
</content>
</invoke>
