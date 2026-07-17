# RESOLUTION — 18_39_11

리뷰어 7/7(+concurrency) 완료. **CRITICAL 3건 전부 실측 재현 후 fix.** WARNING 은 처리 또는
근거 있는 이월. 남은 미해결 Critical/Warning 없음.

## 처리 커밋

| 커밋 | 내용 |
| --- | --- |
| `79e9876cd` | C1 — A-6 되돌림(일시적 명령 실패가 살아있는 대화를 영구 파괴) + C3 bootGenRef JSDoc |
| `1e820c710` | C2 — 대체된 부팅의 지연 `getStatus` 가 화면을 되감던 결함 |
| `fdaa06e98` | testing 블라인드 스팟 ② 회귀 고정 + 문서 정합(CHANGELOG·§110·JSDoc 상호참조) |
| `a4eac304b` | (선행) `sessionEstablished()` 명명 — maintainability |

## 각 발견의 처분

### CRITICAL

1. **requirement — 비-410 명령 실패의 storage 파괴** → **fix**. spec `3-auth-session.md`
   §3.1-3 은 정리 조건을 명시 열거하고 §3.1-2 는 "200+running → 복원" 을 명시한다. 코드가
   조용히 그 열거를 넘었다. 단일라인 A/B 로 귀속 확정 후 A-6 전체(teardown + 리듀서
   `RESTORED`/`BOOTED` 가드) 되돌림. 순변경 0 이라 CHANGELOG 에서도 제거.
   - 리뷰어가 제시한 두 선택지 중 **(a) 코드를 좁힌다** 를 택했다. (b)"에러=영구종료" 를
     제품 정책으로 명문화하는 길은 spec 변경이라 developer 트랙 밖이다(CLAUDE.md). 현
     코드가 명시 조항을 위반 중이므로 되돌리는 쪽이 conformance 회복이고, 반대 정책을
     원한다면 planner 가 spec 을 바꾼 뒤 코드를 다시 넓히면 된다.
2. **concurrency — `seedWaitingFromStatus` 의 boot 축 미인지** → **fix**. 리뷰어가 "실측하진
   않았다" 고 명시해 직접 재현(`최종화면노드=n1 | 기대=n2`) 후 처리. WAITING 분기만
   `cannotApplyConfig` 게이팅, 종료 확정 분기는 world 축 유지(두 정책을 JSDoc 표로 명문화)
   + 양방향 회귀 테스트.
3. **documentation — `bootGenRef` JSDoc 유실 재발** → **fix**. `ts.getJSDocCommentsAndTags()`
   로 10개 심볼 전수 재실측(전부 1개). 블록에 재발 방지 경고 명문화 — 같은 클래스가 두 번
   (`pendingResetRef`←`bootGenRef` 삽입, `bootGenRef`←`unmountedRef` 삽입) 재발했으므로.

### WARNING

- **CHANGELOG 항목 1·3 stale**(requirement·documentation 교차) → **fix**. 재작성.
- **`§106` 자기참조 드리프트**(documentation) → **fix**. 39건 §110 정정. 표기 자체의 취약성
  (행-번호 clause-id)은 spec 규약 변경이라 **planner 이월**.
- **`widget-state.ts` RESTORED 주석 stale**(documentation) → **fix**(C1 처리로 재작성).
- **`sessionEstablished()` 불변식 상호참조 없음**(concurrency) → **fix**.
- **testing 블라인드 스팟 ①②** → **fix**(①은 C2 짝 테스트가 닫음, ②는 신규 회귀 추가).
  둘 다 mutation 재확인 — 직전 0건 → 이제 각 1건.
- **`apiBase` 축 분리**(side_effect·security 교차) → **이월**. `session-store` 가 발급
  apiBase 를 기록하지 않는 **선행 결함**이며 이번 diff 가 만들지 않았다(재전송 시 복원하던
  종전에도 `clientRef` 만 새 apiBase 로 바뀌었다). 세션에 발급 origin 을 기록하고 불일치 시
  폐기하는 설계가 필요해 별도 트랙.
- **`useEiaSession` 분리**(maintainability) → **이월**. `useWidget()` 872줄·`useCallback` 26개.
  이번 PR 범위 밖이나 사고 이력(이 클래스 8회)이 근거임을 plan 에 기록.

### INFO

- `establishConfig` 의 `clientRef` 무조건 재구성(requirement) — 오늘 무해, `apiBase` 축 이월과
  함께 재검토 대상으로 기록.
- `unmountedRef` StrictMode 래치(side_effect·concurrency 독립 재현) — 이미 `aba381ac8` 로
  해소·검증됨. 이번 라운드에 회귀 테스트도 추가(블라인드 스팟 ②).

## 이월 (신규)

- **`ERROR` → `phase: "ended"` 자체가 `1-widget-app.md` §2 Form 의 "실패 시 재제출" 약속과
  어긋난다** — 이 PR 이전부터의 gap(A-6 이 "재시도 불가" 를 "영구 소실" 로 격상시켰던 것을
  되돌렸을 뿐). "비-410 실패는 종료인가" 는 제품 결정이고 spec §3.1-3·§2 명문화가 필요하므로
  **project-planner 트랙**.
- **`§NNN` 행-번호 clause-id 취약성** — 이번에 실제로 깨졌다. 안정적 앵커 도입은 spec 규약
  변경이라 planner 트랙.

## 검증

lint PASS(60s) · unit PASS(82s) · build PASS(137s).
frontend 5513 passed(278파일) · channel-web-chat **390 passed**(22파일).
mutation 매트릭스 6종 — SUMMARY.md 참조. 무방비였던 3개 축이 이번에 전부 고정됐다.
</content>
</invoke>
