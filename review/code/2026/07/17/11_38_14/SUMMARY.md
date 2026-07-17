# Code Review 통합 보고서

*검토 범위: `50aa872cd..HEAD` — 직전 라운드 `09_36_01` 의 조치 커밋(그 자체는 미리뷰 상태였다). 델타는 5파일(codebase 3 + review/plan 2). 변경 성격(위젯 훅의 비동기 staleness 가드)에 맞춰 3개 reviewer 실행 — 상세는 하단 "라우터 결정".*

## 전체 위험도

**MEDIUM** — 직전 라운드가 4인 독립으로 지적한 gap 의 fix(`pendingResetRef` + `newChat()` 재생)와 `isStale` 추출은 3인이 각자 검증해 **동작이 올바름을 확인**했다(재진입 안전·연타 coalesce·가드 강도 보존). 그러나 **side_effect·testing 이 독립적으로 같은 잔여 결함**을 찾았고 **testing 이 실측 재현**했다 — 그 fix 자신이 도입한 `pendingResetRef` 가 **부팅 시도에 스코프되지 않아**, 차단된(BLOCKED) 부팅 중 도착한 리셋 의도가 소비되지 않고 남아 **무관한 다음 부팅이 정상 세션을 조용히 폐기**한다. C1-b 가 막은 것과 같은 "유령 리셋" 클래스가 다른 진입 경로로 남아 있었다. 활성 결함이나 fix 는 1줄이며 회귀 테스트로 고정 가능해 CRITICAL 로 올리지 않는다.

**워크트리 위생**: 이번 라운드는 3인 모두 지침대로 공유 워크트리를 읽기 전용으로 다루고 mutation 은 `git worktree add --detach` 격리 환경에서 수행 후 제거했다. 직전 라운드의 측정 오염(공유 트리 동시편집 → 15% 산발 실패 → CRITICAL 오진)이 **재발하지 않았다**.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용/테스트 — **2인 독립 발견**(side_effect·testing), **testing 이 실측 재현** | `pendingResetRef` 가 "이번 부팅 시도"에 스코프되지 않아 **무관한 이후 부팅에서 오발동**한다. 플래그는 `teardownSession()` 의 부팅-전 분기에서 set 되고 **오직** `applyConfig` 의 `configRef.current = cfg` 직후에서만 소비되는데, 그 소비 지점 **앞**에 `if (!allowed) { dispatch(BLOCKED); return; }` 조기 return 이 있고 이 경로는 플래그를 건드리지 않는다. 이 컴포넌트 인스턴스 동안 `applyConfig` 가 1회만 불린다는 **암묵 전제**가 깨져 있다 — host 는 iframe 재생성 없이 `wc:boot` 를 재전송해 config 를 갱신할 수 있고(`spec/7-channel-web-chat/2-sdk.md:106` 명문화), `codebase/frontend/src/components/web-chat/live-preview.tsx` 가 실제로 그렇게 한다(draft 변경 시 `postBoot()` 재전송, iframe 재마운트 없음). `blocked` 는 렌더만 null 로 만들 뿐 훅을 언마운트하지 않아 ref 가 그대로 산다. **재현(testing, 격리 worktree)**: ①1차 boot 이 allowlist 불일치로 BLOCKED ②그 창에 `resetSession` 도착 → 플래그 set ③무관한 정상 세션이 storage 에 존재 ④2차 boot 이 허용돼 정상 진행 → **`phase=streaming, exec=NEW2, hookPosts=1`, 정상 세션이 덮임**. 2차 boot 의 host 는 리셋을 요청한 적이 없다. | `use-widget.ts` — 플래그 set(`teardownSession` 부팅-전 분기) · BLOCKED 조기 return · 소비 블록(`applyConfig`); 테스트 갭: `use-widget-eager-start.test.ts` 에 BLOCKED/`pendingResetRef` 관련 테스트 0건 | (a) BLOCKED dispatch 직전 명시 폐기, 또는 (b) 플래그를 부팅 시도/세대에 스코프. + 회귀 테스트. **→ 조치됨**(RESOLUTION §W1): `applyConfig` **진입 시** 플래그를 지워 "이 시도의 await 구간에 도착한 요청만 유효" 로 스코프. 회귀 테스트 + mutation 검증 완료. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 제안 |
|---|----------|----------|------|
| 1 | 동시성 — concurrency | `pendingResetRef` 소비 시 `NEW_CHAT` dispatch 가 논리적으로 2회 발생한다(부팅 중 `newChat()` 의 dispatch + config 확립 후 replay 의 dispatch). 리듀서의 `NEW_CHAT` 이 `...initialState` 무조건·멱등 대입이라 **상태 오염은 없고** 여분 렌더 수준. | 조치 불요. |
| 2 | 테스트 — testing | C1-b 회귀 테스트의 3단 단언이 **군더더기가 아님을 실증** — "저장소만 지우고 `newChat()` 재생은 생략" 하는 절반-mutation 이 3번째 단언(새 대화 실제 시작)만 독립적으로 죽였다. | 참고. |

### 검증되어 문제 없음으로 확인된 사항

- **`pendingResetRef` 재생 경로의 재진입 안전성** (side_effect·concurrency 각자 확인): `applyConfig` 가 `configRef`/`clientRef` 를 세팅한 뒤 replay 분기 `return` 까지는 **await 이 하나도 없는 단일 동기 구간**이라 다른 콜백이 끼어들 수 없다. `applyConfig` 가 캡처한 `gen` 은 replay 이후 다시 참조되지 않는다(복원 분기와 상호 배타적 early return).
- **부팅 중 `resetSession` 연타** (concurrency): boolean 이라 자연 coalesce. 격리 worktree 에서 3연타 진단 테스트로 `hookPosts === 1` 실측, 그 진단 테스트 자체도 mutation 으로 유효성 검증.
- **조기 return 으로 건너뛴 것 중 필요한 것 없음** (side_effect).
- **`isStale(gen)` 추출은 순수 동작 보존** (3인 전원 확인): `gen` 이 파라미터로 전달돼 클로저 캡처가 아니므로 캡처 시점·비교 대상이 원본 인라인 패턴과 동치(8개 호출부 전수 대조). testing 이 `isStale`→항상 `false` mutation 으로 **7건 실패 / 365 passed** 를 재현해 RESOLUTION 주장과 일치 확인.
- **C1-b 회귀 테스트의 검출력** (testing): 3가지 mutation(플래그 미설정 / 소비블록 제거 / 절반수정)으로 40건 중 정확히 1건만 실패.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | LOW | ISSUES=0. 재진입 안전성·연타 coalesce·`isStale` 동치를 각각 실측/전수 대조로 확인. INFO 1건(중복 `NEW_CHAT` dispatch, 멱등이라 무해). |
| side_effect | MEDIUM | `isStale` 동작 보존 확인. `pendingResetRef` 미소비 경로(WARNING#1)를 코드 추적으로 발견 — `wc:boot` 재전송이 spec 명문화 + 실제 구현임을 근거로 제시. |
| testing | MEDIUM | WARNING#1 을 **격리 worktree 에서 실측 재현**(정상 세션이 덮이는 구체적 수치 제시). C1-b·`isStale` 의 검출력을 mutation 으로 독립 재검증. |

## 라우터 결정

- router 미실행. 델타가 **위젯 훅의 비동기 staleness 가드 + 그 테스트**에 국한(codebase 3파일: `use-widget.ts`·`use-widget-eager-start.test.ts` 및 문서 주석)이라, 그 성격에 직접 대응하는 3개 reviewer 를 main 이 선별 실행했다.
  - **실행(3명)**: `concurrency`(비동기 재진입·세대 가드), `side_effect`(플래그 수명·조기 return 부작용), `testing`(회귀 검출력·mutation)
  - **미실행(11명)**: `security`·`requirement`·`scope`·`maintainability`·`documentation` 등. 직전 라운드(`09_36_01`)가 이 델타의 **직전 상태**를 8인으로 검토했고, 이번 델타는 그 지적에 대한 국소 fix 라 판단.
  - **한계 명시**: 이 선별은 router 의 의미 기반 판단이 아니라 main 의 수동 결정이다. 특히 `security`(세션 폐기·storage 부활 축)와 `requirement`(spec §3.1 정합)는 이 델타와 무관하지 않으므로, 미실행이 곧 "그 관점에서 깨끗함"을 뜻하지 않는다.
