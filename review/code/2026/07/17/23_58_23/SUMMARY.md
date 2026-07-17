# 코드 리뷰 SUMMARY — webchat-boot-single-flight (23_58_23)

직전 라운드(`18_39_11`) CRITICAL 3건 fix + 문서 정합에 대한 **후속 검증 라운드**.

- **범위**: `git merge-base origin/main HEAD`(=`29aa918a6`, origin/main 과 일치)`..HEAD` — 28파일.
  scope·requirement 리뷰어가 3-dot=2-dot 대조로 페이로드 오염 0 독립 확인.
- **실행 리뷰어**: 8명 (forced 7: documentation·maintainability·requirement·scope·security·
  side_effect·testing + concurrency 추가). `agents_forced` 전원 커버.
- **위험도**: **CRITICAL** — 신규 CRITICAL 1건(3인 독립 재현), 처리 완료.

## Critical (신규)

| 리뷰어 | 발견 | 재현 | 처리 |
| --- | --- | --- | --- |
| **concurrency · requirement · side_effect** (3인 독립) | 직전 fix 가 `seedWaitingFromStatus` 세 호출부 중 `applyConfig` 만 boot 토큰으로 보호 — **`start()`(eager 부팅)는 무방비**라 같은 화면 되감기(+ EventSource 이중 생성)가 재현 | ✅ 3인 모두 실제 코드(mutation 아님) + 진단 패치로 확인 | ✅ `start()` 가 읽기전용 boot 스냅샷 전달 |

세 리뷰어가 **각자 독립**으로 실제 `useWidget()` 훅으로 재현했다(EventSource 이중 생성까지). 이는
직전 라운드(`18_39_11`) concurrency 리뷰의 INFO 결론("같은 fix 가 이 경로도 닫는다 — 별도 수정
불필요")을 정면 반증한다 — 내가 그 INFO 를 믿고 `start()` 를 안 건드린 게 구멍이었다.

**fix** (`7cfbf2557`): `start()` 가 진입 시점 `bootGenRef.current` 를 **읽기전용 스냅샷**으로 잡아
`seedWaitingFromStatus(client, session, { boot: bootAtStart })` 로 넘긴다. `start()` 는 부팅 시도가
아니므로 `beginBootAttempt()` 로 세대를 올리지 않는다(applyConfig 의 supersede 카운팅 오염 방지).
종료 확정 분기는 그대로 world 축만(WAITING 분기에만 있는 `if (attempt && ...)` 가드라 자동 상속),
`outcome !== "continue"` 조기 return 이 두번째 openStream 도 함께 막는다. `replay_unavailable`
폴백은 여전히 생략 — 스트림이 이미 열려 있어야 발화하므로 복원 분기와 상호배타(side_effect 확인).

## Warning (전부 처리 — 문서/테스트 정합, 런타임 무영향)

| 리뷰어 | 발견 | 처리 |
| --- | --- | --- |
| documentation | 테스트 주석 3곳이 **되돌려진 C1 메커니즘** 서술(직전 RESOLUTION 이 "fix" 표시했으나 CHANGELOG 만 고침) | ✅ 실제 동작(checkpoint 1=boot 전용, 종료 확정=대체 시도가 world 축으로)으로 재작성 |
| documentation | plan 서술이 "§106→§3(재전송) 39건" 이라는 **일어난 적 없는 단계** 기록(일괄 치환이 과거형 서술 덮어씀) | ✅ 실제 2단계(§106→§110 39건 → §110→§3 41건)로 정정 |
| testing | 새로고침 복원 테스트가 주석("SSE 재연결")을 단언 안 함 | ✅ 새 EventSource 생성 단언 추가 |
| maintainability | `useEiaSession` 분리 이월이 산문으로만 남아 묻힐 위험(형제 항목은 분리됨) | ✅ 별도 plan `webchat-usewidget-extraction.md` 분리 |
| maintainability | JSDoc 인접성 방어가 "경고 주석" 절차적 뿐(구조적 강제 없음) | ⏸ 분리 plan 에 구조적 가드 검토 기록(범위 밖) |
| scope | `use-widget.ts` cleanup 의 공백-only 빈 줄 | ✅ 제거 |
| security·side_effect | 재전송 시 `apiBase` 축 분리 | ⏸ 이월 — **선행 결함**(security 리뷰어가 "악화 안 됨" 확인) |

## 검증된 것 (문제 없음)

- **A-6 되돌림** (requirement·security·side_effect·scope): spec `3-auth-session.md` §3.1-2/§3.1-3 과
  line-level 정합. security 가 격리 worktree 실측(4겹 토큰 경계)으로 stale 토큰 위험 없음 확인.
  A-6 은 브랜치 시작 전 기준선과 바이트 동일한 복귀(순변경 0).
- **concurrency 이중 정책** (concurrency·requirement): "종료=world만 / 표면=world+boot" 는
  `attempt` 를 전달하는 호출부 범위 안에서 정확. 양방향 mutation 재확인, N-way 카운터 불변식 성립.
- **`bootGenRef` JSDoc** (documentation): `ts.getJSDocCommentsAndTags()` 로 10심볼 전수 1개 확인.
- **`§3(재전송)` 표기** (scope·documentation): `2-sdk.md:93` `## 3` 을 정확히 가리킴, 순수 표기 정정.

## 검증 (fix 후)

tsc 통과 · **391 passed**(22 파일, 재현 테스트 +1) · JSDoc 10심볼 전수 부착 · trailing ws 0.
mutation: `start()` boot 스냅샷 인자 제거 → 정확히 신규 재현 테스트만 실패(n1). 전체 스택은 RESOLUTION 참조.
</content>
