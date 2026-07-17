# 동시성(Concurrency) Review — 2026-07-17 13_03_59

**대상**: `codebase/channel-web-chat/src/widget/use-widget.ts`(`pendingResetRef` 폐기를 `bootGenRef`(부팅 시도 세대) 소유권 조건으로 재구성) + `use-widget-eager-start.test.ts`(회귀 테스트 1건 추가: "겹친 부팅의 결과가 갈릴 때, 차단된 쪽이 살아있는 쪽의 리셋을 지우지 않는다"). orchestrator 가 지정한 4개 질의(①`bootGenRef`/`worldGenRef` 축 상호작용 ②성공 경로 무가드 판단 반증 — 특히 3+ 겹침 전 순열 ③`!cfg.apiBase` 조기 return 미가산 판단 ④회귀 테스트 3건의 커버리지 공백)에 집중했다.

**검증 방법**: 정적 추적(전수 상태-전이 심볼릭 실행)으로 가설을 세우고, `git worktree add --detach`(공유 트리 밖, `/private/tmp/.../scratchpad/concurrency-probe-wt`)로 격리한 환경에서 `node_modules` 를 공유 worktree 실제 디렉터리 symlink 로 부트스트랩해 **실측(PROBE/CONTROL 테스트 추가 → vitest 실행 → 결과 관찰 → 즉시 원복)**으로 확정했다. 베이스라인 43/43 통과 확인 → PROBE 추가(44 tests, 1 failed 43 passed) → CONTROL 추가(45 tests, 1 failed 44 passed, 다른 43건 전원 무영향) 확인 후 `git worktree remove --force` 로 제거, 공유 워크트리는 `git status --short`(review 산출물 디렉터리 외 변경 없음) · `git diff --stat`(대상 두 소스 파일 diff 없음) 로 무오염 재확인했다.

## 발견사항

- **[WARNING]** `bootGenRef` 소유권은 "나보다 나중에 진입한 시도가 있는가" 만 묻는다 — "나보다 먼저 진입했지만 아직 살아있는(resolve 못 한) 시도가 있는가" 는 아무도 묻지 않는다. 그 결과 **소유권자(최신 진입) 가 BLOCKED 로 먼저 resolve 하고, 비소유권(이전 진입) 가 ALLOWED 로 나중에 resolve** 하는 조합에서 정당한 리셋이 다시 소실된다 — **4번째 거울상, 실측 재현 확인**
  - 위치: `use-widget.ts:750-768`(BLOCKED 분기 — `if (bootGenRef.current === bootGen) pendingResetRef.current = false;`, L765) · `:769-808`(성공 경로 — 세대 검사 없이 `pendingResetRef.current` 를 그대로 신뢰, L779) · `:229-263`(`teardownSession`, pre-boot no-op 분기 L252-255 · world bump L259)
  - **질의 ①·② 에 대한 직접 반증**: `worldGenRef` 자기치유가 성립하려면 "누군가 `pendingResetRef` 를 건드리는 모든 지점이 그 즉시 `worldGenRef` 도 함께 bump 한다"는 불변식이 전제돼야 하는데, **BLOCKED 분기의 소유권 폐기(L765)는 이 불변식을 깬다** — `pendingResetRef` 는 지우지만 `worldGenRef` 는 올리지 않는다(코드 주석 스스로 "이 분기는 `worldGenRef` 를 올리지 않는다" 고 명시 — 정확히 그 사실이 구멍이다). 그래서 이 분기가 실행된 뒤에도 **다른(이전 진입) 살아있는 시도는 여전히 non-stale 상태**로 남고, 그 시도가 나중에 resolve 하면 `isStale(gen)` 체크(L749)를 무사히 통과해 config 를 확립한 뒤 이미 `false` 가 된 `pendingResetRef` 를 보고 리셋을 건너뛴다.
  - **재현 시퀀스** (boot#1 = bootGen 1, cfg 는 최종 ALLOWED 로 resolve · boot#2 = bootGen 2(소유권자), cfg 는 최종 BLOCKED 로 resolve):
    1. boot#1 진입(`gen1` 캡처=0), `await isEmbedAllowed(cfg1)` suspend.
    2. `resetSession` 도착 — `configRef.current` 아직 null → `pendingResetRef.current = true`.
    3. boot#2 진입(`bootGenRef.current`→2), `gen2` 캡처(=0), `await isEmbedAllowed(cfg2)` suspend.
    4. **boot#2(소유권자) 가 먼저 resolve**: `isStale(0)`→false. `allowed2=false` → BLOCKED 분기: `bootGenRef.current(2) === bootGen(2)` → **true(자신이 소유권자)** → `pendingResetRef.current = false` 로 폐기, `BLOCKED` dispatch, return. **이 시점에 boot#1 은 아직 살아있다.**
    5. boot#1 이 뒤이어 resolve: `isStale(0)`→false(4번이 `worldGenRef` 를 건드리지 않았으므로). `allowed1=true` → `configRef.current=cfg1` 확립 → `pendingResetRef.current` 확인 시 **이미 `false`**(4번이 지움) → `newChat()` **미실행** → `loadSession(cfg1)` 으로 **구 세션 그대로 복원**.
    6. 결과: host 가 명시적으로 요청한 "새 대화" 가 완전히 소실되고 리셋 요청 시점의 구 세션이 그대로 이어진다.
  - **실측(격리 worktree, 코드 미수정 — probe 테스트만 추가 후 실행·즉시 원복)**:

    | 시나리오 | resolve 순서 | `hookPosts` | `sessionStorage` | `state.phase` |
    |---|---|---|---|---|
    | **PROBE**: 소유권자(bootGen2)=BLOCKED 먼저, 비소유권(bootGen1)=ALLOWED 나중 | 2 → 1 | **0**(타임아웃) | `{"executionId":"old",...}` 그대로 | `streaming`(구 세션이 그대로 이어짐) |
    | **CONTROL**: 동일 outcome 배정, resolve 순서만 자연 순서(진입 순서)로 되돌림 | 1 → 2 | **1** | `fresh` | `streaming`(정상 새 대화) |

    CONTROL 은 자연 순서(비소유권 ALLOWED 가 먼저 소비 → `worldGenRef` bump → 나중에 오는 소유권자 BLOCKED 판정은 `isStale` 에 걸려 자기 소유권 체크에 도달조차 못함)에서는 정상 작동함을 재확인하고, **순서만 뒤집은 PROBE 만 실패**시켜 원인이 정확히 "소유권자의 BLOCKED 폐기가 아직 살아있는 비소유권 시도를 보호하지 못한다"는 점을 순서-대조로 입증한다. 두 probe 추가 후 전체 파일 실행 결과 **기존 43건은 전원 그대로 통과**(collateral 없음), PROBE 1건만 실패.
  - **커밋된 3건과의 관계 — 정확히 "거울상"이지 "재발견" 이 아니다**: 이번 라운드가 새로 커밋한 "겹친 부팅의 결과가 갈릴 때..." 테스트(`use-widget-eager-start.test.ts:2269`)는 스스로 "이 조건 **하나만** 정확히 고정한다" 고 명시하는데, 그 하나는 정확히 아래 표의 **왼쪽 열**이다. 이번 발견은 **오른쪽 열**(outcome 배정과 resolve 순서를 모두 반전) 로, 커밋된 테스트가 원천적으로 검증하지 않는 별개 조합이다:

    | | 커밋된 테스트(12_34_03 fix 대상, 해결됨) | 이번 발견(미해결) |
    |---|---|---|
    | bootGen=1(먼저 진입) | BLOCKED | **ALLOWED** |
    | bootGen=2(나중 진입=소유권자) | ALLOWED | **BLOCKED** |
    | 먼저 resolve 하는 쪽 | bootGen=1(BLOCKED, **비**소유권) | bootGen=2(BLOCKED, **소유권자**) |
    | 소유권 체크 결과 | 비소유권 → 폐기 안 함 → 안전 | 소유권자 → **폐기함** → 위험 |

  - **질의 ② 부연 — 3개 이상 겹침에서도 동일 메커니즘, 새 실패 모드 없음**: boot#1(ALLOWED)·boot#2(ALLOWED)·boot#3(BLOCKED, 소유권자) 세 개가 겹치고 #3 이 가장 먼저 resolve 하는 경우를 심볼릭으로 추적했다. `bootGenRef.current` 는 세 시도가 모두 진입한 시점에 3 으로 고정되므로 **소유권은 항상 #3 하나뿐**(resolve 순서와 무관하게 결정)이고, #3 의 BLOCKED 폐기가 `pendingResetRef` 를 지운 뒤에도 `worldGenRef` 는 안 바뀌므로 #1·#2 는 여전히 non-stale 로 남아 각자 `configRef.current`/`clientRef.current` 를 순서대로 덮어쓰며 실행된다(단 어느 쪽도 `newChat` 을 다시 트리거하지 않음 — 이미 지워졌으므로). 즉 3+ 겹침은 **동일한 구멍을 반복 노출**시킬 뿐, 새로운 실패 축을 추가하지 않는다 — 다만 "먼저 확립된 config 를 나중 것이 조용히 덮어쓴다" 는 **이미 별도로 인지·이월된**(JSDoc 의 "겹친 시도 중 어느 config 가 최종 적용되는가" 갭, INFO#3) 문제가 함께 겹쳐 나타난다. N=2 가 이 결함의 최소 재현이며 실측도 N=2 로 충분히 확정된다.
  - **실사용 도달 가능성**: `host-bridge.ts:51-55`(`bootCb?.(data.payload)` — in-flight 여부와 무관하게 무조건 호출, 직렬화 없음, 직접 재확인)와 결합하면, 겹친 두 `wc:boot` 의 embed-config 조회 중 **나중에 보낸 쪽(신규 트리거)이 먼저 도착한 쪽(이전 트리거)보다 먼저 resolve** 하는 것은 서버측 조회 지연에 좌우되는 흔한 레이스이지 이례적 조건이 아니다. 이는 이전 라운드들이 반복 지목한 것과 **동일한 트리거 계열**(관리자 라이브 미리보기가 `triggerEndpointPath` 를 전환하는 도중 리셋 버튼을 누름)이며, 이번 라운드 자체가 "차단 판정이 먼저 옴" 이 실사용에서 특이 사건이 아님을 전제로 커밋한 테스트와 대칭적인 전제를 공유한다.
  - **손상 범주**: 이전 3라운드의 형제 결함과 동일 — host 가 명시적으로 요청한 "새 대화" 가 조용히 무시되고 구 세션이 이어짐. 탭-스코프 `sessionStorage` 내 문제로 cross-user/cross-tenant 유출은 아니며, crash·deadlock·영구 데이터 손상도 아니다(사용자가 리셋을 재시도하면 복구 가능). 이 손상 등급은 이 파일의 지난 세 라운드가 동일 형태의 결함에 일관되게 WARNING(전체 MEDIUM)을 매긴 전례와 부합한다 — 본 보고서도 그 캘리브레이션을 유지한다(반복 발생 자체가 심각도를 자동으로 올리는 근거는 아니라고 판단).
  - **방법론 노트**: RESOLUTION 의 mutation 매트릭스(BLOCKED 폐기 제거/세대 조건 제거/entry-clear 재도입 3종)는 "커밋된 3개 테스트가 **현재 fix 로직**의 각 구성요소를 정확히 지키는가" 를 증명할 뿐, "**현재 fix 로직 자체가 완전한가**" 를 증명하지 않는다 — mutation 은 기존 코드의 완화/제거만 탐색하고, 이번 발견처럼 코드를 전혀 건드리지 않고 **입력(resolve 순서 × outcome 배정)만 바꾸는** 조합은 애초에 그 매트릭스의 탐색 공간 밖이다. 따라서 "3건의 mutation-kill 로 세 방향이 동시에 닫혔다" 는 RESOLUTION 의 주장은 **"규정된 3개 방향은 정확히 닫혔다"** 로 읽어야 하며, "이 결함 클래스 전체가 닫혔다" 로 일반화할 수 없다.
  - **제안**: 이번 라운드에서 **또 다른 국소 패치를 얹지 말 것**을 강하게 권고한다 — 4번의 라운드에 걸쳐 국소 패치가 매번 반대편 구멍을 만든 전례가 이번에도 반복될 위험이 매우 크다(이번 소유권 조건 자체가 "구조적 해법" 으로 제시됐음에도 그렇다). 대신:
    1. 이 정확한 조합(소유권자=BLOCKED 가 먼저 resolve, 비소유권=ALLOWED 가 생존)을 INFO#3(single-flight 부재) backlog 에 **네 번째 named 인스턴스**로 명시 추가 — 위 PROBE 재현 스텝을 템플릿으로 남겨 다음 라운드가 바로 회귀 테스트화할 수 있게 할 것.
    2. 다음에 이 메커니즘을 구조적으로 다시 설계할 때는, "내가 최신 진입인가"(bootGen 동등성 비교) 대신 **"나 말고 아직 살아있는(미resolve) 시도가 있는가"** 를 직접 답하는 근거(예: in-flight 카운터 — `applyConfig` 진입 시 증가, 모든 종료 분기(BLOCKED reject·config 확립·필드누락 조기 return 제외)에서 감소, BLOCKED 분기는 감소 후 카운터가 0 일 때만 `pendingResetRef` 폐기)로 교체하는 방향을 권고한다. "최신 진입" 은 "유일한 생존자" 의 근사치일 뿐이며, 이번 4개 라운드가 보여주듯 resolve 순서가 진입 순서를 배신할 수 있는 한 그 근사는 어느 한쪽에서 항상 깨진다.
    3. `use-widget.ts:757-760` 주석("자기치유... 여기엔 성립하지 않는다")과 `:169-171`(`bootGenRef` JSDoc)의 "소유권을 명시한 뒤에야 세 방향이 동시에 닫혔다" 서술에, 이번에 확인된 네 번째(미해결) 방향이 있다는 단서를 추가할 것을 권고한다 — 코드 변경 없이 주석 정확도만 개선하는 것이므로 최소-변경 원칙과 충돌하지 않는다.

- **[INFO]** 질의 ③ 확인 — `!cfg.apiBase || !cfg.triggerEndpointPath` 조기 return 이 세대를 올리지 않는 판단은 **정확하며, 단순한 보수적 선택이 아니라 하중을 지는 설계**
  - 위치: `use-widget.ts:741`(조기 return) · `:743`(`bootGen` 캡처, 조기 return **뒤**) · `:253`(set) · `:765`(BLOCKED 폐기) · `:779-780`(소비)
  - 상세: `pendingResetRef` 를 건드리는 지점은 파일 전체에서 이 3곳뿐(grep 전수 확인, 12_34_03 side_effect 의 grep 결과와 일치). 필드-누락 조기 return(`:741`)은 `bootGen` 캡처(`:743`)보다 **앞**이라 이 실행 경로는 `bootGenRef`/`pendingResetRef` 어느 쪽과도 원천적으로 상호작용할 수 없다. 나아가, 만약 이 분기가 세대를 올리도록 바뀐다면 그 "가짜 소유권자" 는 **자신의 소유권 체크 코드에 다시는 도달하지 않는다**(이미 return 했으므로) — 그 결과 `bootGenRef.current` 가 그 죽은 시도를 가리킨 채로 남아, 이후 실제(필드가 온전한) BLOCKED 시도가 도착해도 `bootGenRef.current !== bootGen` 이 되어 **아무도 다시는 폐기 조건을 만족하지 못하는 "소유권 유기(orphaned ownership)" 상태**가 발생할 수 있다 — 이는 정확히 11_38_14 가 고치려던 유령 리셋과 같은 형태의 결함을 다른 경로로 재도입한다. 즉 "세대를 안 올린다" 는 게으른 생략이 아니라, 올렸을 때 생기는 **더 나쁜** 결과(체크를 절대 실행하지 않는 유령 소유자)를 피하기 위한 필수 선택이다.
  - 제안: 없음(판단 확인됨). 위 WARNING 의 제안 3 과 함께, 이 "조기 return 은 소유권에 참여하지 않는다" 는 불변식도 향후 리팩터 시 재검토 대상으로 명시해 두면 좋다(예: in-flight 카운터 도입 시 이 분기가 카운터를 증가시키지 않아야 한다는 대응 규칙이 자동으로 따라옴).

- **[INFO]** 질의 ①·④ 종합 — 안전/위험 조합 전수 스윕(2-부팅 기준, `pendingResetRef=true` 인 gap 을 가정)
  - `worldGenRef`/`bootGenRef` 두 축은 **서로 모순되거나 직접 충돌하지 않는다** — 각자 담당 질문(전자: "이 gen 캡처 이후 세계가 바뀌었나", 후자: "나보다 늦게 진입한 시도가 있나")에 대해 항상 자기 일관된 답을 준다. 문제는 축간 **모순**이 아니라 **합집합 공백** — 두 축의 보호 범위를 합쳐도 "폐기가 안전한가" 라는 실제 질문(=다른 생존 시도가 없는가)을 항상 덮지 못한다.
  - A=bootGen1(먼저 진입), B=bootGen2(나중 진입=소유권자)로 8가지 조합을 추적한 결과:

    | outcome(A,B) | 먼저 resolve | 결과 | 근거 |
    |---|---|---|---|
    | BLOCKED,BLOCKED | A | 안전(둘 다 세션 미확립) | A=비소유권 폐기 안 함, B=소유권자 폐기(정당) |
    | BLOCKED,BLOCKED | B | 안전 | B=소유권자 폐기(정당, A 도 어차피 BLOCKED) |
    | BLOCKED,ALLOWED | A | **안전 — 커밋된 테스트(`:2269`)** | A=비소유권 폐기 안 함 → B(소유권자,ALLOWED)가 정상 소비 |
    | BLOCKED,ALLOWED | B | 안전(world-gen 자기치유) | B 소비+bump → A 는 `isStale` 에 걸려 BLOCKED 로직 도달 못 함 |
    | ALLOWED,BLOCKED | A | 안전(world-gen 자기치유) | A 소비+bump → B 는 `isStale` 에 걸려 소유권 체크 도달 못 함 |
    | ALLOWED,BLOCKED | B | **위험 — 위 WARNING, 실측 재현** | B=소유권자 폐기(world-gen 무bump) → A 는 살아있는 채로 나중에 도착, 이미 지워진 플래그를 봄 |
    | ALLOWED,ALLOWED | A | 안전 — 커밋된 테스트(`:2197`) | A 소비+bump → B stale |
    | ALLOWED,ALLOWED | B | 안전 — probe 로 확인(비커밋, 아래 참고) | B 소비+bump → A stale |

    8개 중 **정확히 1개**(ALLOWED,BLOCKED 조합에서 소유권자=B 가 먼저 resolve)만 위험하며, 이것이 이번 WARNING 의 재현 시퀀스다. 3개 이상 겹침은 위에서 설명한 대로 동일 메커니즘의 반복이라 새 조합을 추가하지 않는다.
  - 제안: 없음(분석 결과 통합 — 위 WARNING·다음 INFO 참조).

- **[INFO]** 질의 ④ — 회귀 테스트 3건(+본 라운드 신규 1건)의 잔여 커버리지 공백 목록
  - **미해결(활성 결함, 위 WARNING)**: outcome(A=ALLOWED,B=BLOCKED), B(소유권자) 먼저 resolve — 어떤 커밋된 테스트도 커버하지 않음.
  - **회귀-안전망 공백(현재 안전하나 고정하는 커밋 테스트 없음, 기능 결함 아님)**: `ALLOWED,ALLOWED` 조합에서 B 가 먼저 resolve 하는 순서 역전 — 12_34_03 testing 라운드가 probe 로 안전을 이미 확인했고, 본 리뷰도 별도 probe(CONTROL 테스트와 별개로 표에 반영)로 사실 관계를 재확인했으나 커밋된 테스트는 없다(기존 이월 사항, 신규 지적 아님).
  - **기존 이월(본 델타 범위 밖, 재확인만)**: 3회 이상 연속 BLOCKED 체인 · cross-endpoint 재부팅 · `live-preview.tsx` 상위 레이어 테스트 부재(12_04_49 testing 이 이미 지목) — 본 리뷰의 심볼릭 추적(3-way 조합)은 이 중 "3+ 체인" 이 안전함을 뒷받침하는 근거를 추가했을 뿐 새로 검증하지는 않았다.
  - 제안: 위 WARNING 제안 1 과 통합 — 다음 회귀 테스트 배치 시 이 문서의 8-조합 표를 그대로 테스트 매트릭스 설계에 사용할 것을 권고.

- **[INFO]** 그 외 동시성 점검 관점 8종 중 나머지 — 이번 델타와 무관하게 깨끗함
  - **데드락/락 기반 동기화/스레드 세이프티**: JS 단일 스레드 협조형 실행 모델이라 전통적 락·데드락 개념은 해당 없음. 세대 카운터(`worldGenRef`/`bootGenRef`)가 그 대체 관용구(낙관적 버전 비교)로 기능하며, 위 WARNING 은 그 관용구의 **판별 조건 범위** 문제이지 락 오용이 아니다.
  - **원자성**: 각 `applyConfig` 재개(await 뒤 첫 동기 구간)는 다음 await(또는 return)까지 run-to-completion 으로 실행되며, 실측(코드 추적)상 `newChat()`→`resetSessionRefs()`→`teardownSession()`(world bump)→`dispatch`→`start()`(2번째 world bump, 첫 await 전까지)가 **중간에 다른 `applyConfig` 재개가 끼어들 수 없이 통째로** 실행됨을 확인했다 — 개별 소비/폐기 시퀀스 자체의 원자성은 보장된다. 문제는 원자성 위반이 아니라 "그 원자적 단위가 지켜야 할 전제조건(소유권 판별)이 불완전하다" 는 것이다.
  - **async/await**: await 누락 없음 — `applyConfig` 의 두 await(`isEmbedAllowed`, `seedWaitingFromStatus`) 모두 직후 `isStale` 재검증이 있다(L749, L804). 이번 결함은 "재검증 누락" 이 아니라 "재검증에 쓰는 판별식(`bootGenRef` 동등성)이 답해야 할 질문과 실제로 필요한 질문이 어긋난다" 는, 이 파일의 지난 3라운드(재검증 자체의 누락/비대칭)와는 다른 성격의 문제다.
  - **이벤트 루프**: 블로킹 호출·콜백 지옥 없음. Promise 체인은 대체로 평탄하고(2단 이내 중첩), `fetch`/`EventSource` 는 전부 비동기 논블로킹.
  - **리소스 풀링**: 명시적 스레드/커넥션 풀 없음(브라우저 `fetch`/`EventSource`). 다만 여러 겹친 ALLOWED 시도가 각자 `clientRef.current = new EiaClient(...)` 로 덮어쓸 수 있어 이전 `EiaClient` 인스턴스가 참조를 잃는 경로가 있으나, 이는 이미 이월된 "no single-flight" 갭(INFO#3)의 표현이며 `EiaClient` 자체가 영속 커넥션을 보유하지 않는 얇은 fetch 래퍼로 보여 실질적 리소스 누수로 보이진 않는다 — 새 리소스-풀링 결함으로 독립 제기하지 않는다.

## 요약

이번 라운드의 `bootGenRef` 소유권 도입은 질의 ①·④ 관점에서 **정확히 목표한 3방향(유령 리셋 / 리셋 소실 / 12_34_03 혼합 순서)을 mutation-kill 로 검증 가능하게 고정**했고, 질의 ③(`!cfg.apiBase` 조기 return 미가산)도 단순 보수적 선택이 아니라 "세대를 올리면 죽은 소유자가 생겨 더 나쁜 유령-리셋류 결함이 재도입된다" 는 근거 있는 정확한 판단임을 확인했다. 그러나 질의 ②(성공 경로 무가드 판단)는 **격리 워크트리 실측으로 반증된다**: `worldGenRef` 자기치유는 "`pendingResetRef` 를 건드리는 모든 지점이 그 즉시 `worldGenRef` 도 함께 bump 한다" 는 불변식에 의존하는데, BLOCKED 분기의 소유권 폐기는 (설계상 의도적으로) 그 불변식을 깬다. 그 결과 **소유권자(최신 진입)가 BLOCKED 로 먼저 resolve 하고 비소유권(이전 진입, 아직 살아있음)이 ALLOWED 로 나중에 resolve 하는 조합**에서 리셋이 다시 소실됨을 PROBE/CONTROL 순서-대조 실측(43개 기존 테스트 전원 무영향, PROBE 만 실패)으로 확정했다 — 이는 커밋된 "혼합 순서" 테스트가 고정하는 조합의 정확한 거울상이며, RESOLUTION 이 주장하는 "소유권을 명시한 뒤 세 방향이 동시에 닫혔다" 는 서술을 완전히는 뒷받침하지 못하는 **네 번째, 아직 열린 방향**이다. 3개 이상 겹침으로 확장해도(심볼릭 추적) 새 실패 축은 나타나지 않고 동일 메커니즘이 반복될 뿐이므로 N=2 실측이 최소이자 충분한 반증이다. 손상 범주는 이전 3라운드와 동일(탭-스코프 세션 오배정, cross-user 유출 아님, 복구 가능)하므로 심각도 캘리브레이션은 이 파일의 기존 전례를 따라 WARNING/전체 MEDIUM 을 유지했다 — 다만 4번째 반복 재현이라는 사실 자체가 "이 메커니즘에 대한 국소 패치는 구조적으로 이 클래스를 소거할 수 없다" 는, 이미 세 번 확인된 결론을 다시 한번 강화한다. 이번 라운드에서 추가 국소 패치를 얹기보다, 이 구체적 조합(과 재현 스텝)을 INFO#3 backlog 에 명시 추가하고 "최신 진입" 대신 "생존 시도 유무"(in-flight 참조 카운트 등)를 직접 묻는 방향으로 다음 구조 설계를 권고한다.

## 위험도

MEDIUM
