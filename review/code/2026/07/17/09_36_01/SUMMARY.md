# Code Review 통합 보고서

*검토 범위: `3b54c8727..HEAD` (커밋 `42e4346cf` 코드 fix + `31a7ce4fc` 리뷰 산출물 아카이빙). 직전 라운드 `review/code/2026/07/17/08_29_33`(Critical 2건 / Warning 7건)의 조치 커밋을 재검토하는 라운드다. 8개 reviewer(concurrency·documentation·maintainability·requirement·scope·security·side_effect·testing)만 실행됐다 — 상세는 하단 "라우터 결정" 참조.*

## 전체 위험도

**MEDIUM** — 직전 라운드가 지적한 C1/W2/W3/W4/W5 fix 는 5개 reviewer 가 각자 mutation 테스트(가드 제거 → 재실행 → 원복)로 독립 재검증해 전부 올바르게 닫혔음을 확인했다. 그러나 **4명의 reviewer(side_effect·security·requirement·concurrency)가 완전히 독립적으로 새로운 실사용 시나리오**(부팅 중 `resetSession` 레이스로 `sessionStorage` 의 이전 세션이 조용히 부활해 "새 대화" 의도가 무시되는 gap)를 찾아냈다 — 이 라운드의 핵심 실질 발견이다.

**사후 확인**: 이 SUMMARY 작성 시점에 워크트리를 재확인한 결과, 위 gap 을 포함해 이번 라운드 WARNING 대부분이 이미 커밋 `61cf83608`(코드 fix)·`591350e10`(문서 정정)로 조치·커밋되어 있었다 — 다중 sub-agent 가 같은 공유 워크트리에서 동시에 review 와 fix 를 수행하는 파이프라인 특성상, 이 SUMMARY 확정 이전에 이미 후속 조치가 반영된 상태다.

**testing.md 의 [CRITICAL] 태그는 코드 결함이 아니다** — 리뷰 파이프라인 자체가 공유 워크트리에서 여러 sub-agent 의 동시 파일 편집을 허용하는 구조적 특성으로 인해 "반복 실행 기반 flaky 판정" 방법론이 오염된 것이며(격리 worktree 60/60 무실패로 코드 자체의 결백은 재확인됨), 배포를 막는 코드 결함으로 취급하지 않는다.

종합하면 실제 남은 활성 코드 결함은 없으나, 이번 라운드가 여러 reviewer 의 교차검증으로 실질적인 신규 gap 을 찾아내고 그 처리 상태(일부 의도적 보류 포함)를 남겼다는 점에서 MEDIUM 으로 판정한다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 인프라/리뷰 파이프라인 — **코드 결함 아님** | (testing) `npx vitest run` 반복 실행 기반 비결정성(C2) 재현 방법론이 리뷰 파이프라인 자체의 결함으로 오염됨 — 공유 worktree 에서 60회 중 9회(15%) 실패했으나, 격리 worktree(`git worktree add --detach`)에서 동일 커밋 60회 실행 시 0회 실패. 순수 리듀서 단위테스트(비동기·타이머 전혀 없음)가 "타이밍"으로 실패하는 것은 코드 레이스로는 불가능 — `git status` 로 실시간 관찰한 결과 다른 프로세스가 리뷰 도중 같은 소스 파일을 동시 편집 중이었음을 직접 확인(신규 주석이 "본 라운드"를 인용, phantom 임시 테스트 파일 생성·삭제 흔적 포착). concurrency.md 도 동일 현상을 별도로 직접 목격해 WARNING 으로 기록. | 리뷰 실행 환경 — 공유 워크트리 `.claude/worktrees/funny-mahavira-50d003`(앱 코드 아님). 대조군: `review/code/.../08_29_33/RESOLUTION.md` C2 절 | 코드 조치 불요 — `worldGenRef` 게이팅 자체에 async 레이스가 있다는 증거 없음(격리 60/60 무실패). 향후 flaky 판정은 `git worktree add --detach <scratch> <commit>` 격리 환경에서 수행하도록 오케스트레이터 절차화 권장. **사후 확인: 이미 조치·종결됨** — `08_29_33/RESOLUTION.md` 가 원인 규명을 반영해 "미해결 이월 → 종결"로 갱신됨(커밋 `591350e10`). |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 세션 위생/상태관리 — **4명 독립 발견**(side_effect·security·requirement·concurrency) | `teardownSession()` 의 C1 조기 return(`if (!configRef.current) return;`)이 "메모리 상 활성 세션 없음"과 "`sessionStorage` 에 이미 남아있는 이전 세션"을 혼동한다. 재현: 부팅 중(`isEmbedAllowed()` 왕복 중, `configRef.current===null`) host 가 `resetSession` 을 보내면 `teardownSession()` 이 조기 return 되어 `clearSession()`·`worldGenRef` 증가가 스킵되고, 이어 `applyConfig()` 완료 후 `loadSession()` 이 지워지지 않은 옛 세션을 그대로 복원(`RESTORED` dispatch 가 직전 `NEW_CHAT` 을 가드 없이 덮어씀) — host 가 명시적으로 요청한 "새 대화"가 조용히 무시되고 옛 대화(PII 포함 가능)가 이어진다. C1 fix 자체가 "영구 정지"를 막는 대가로 새로 연 창이며, 4명 모두 크로스오리진 공격은 아니라고 판단(부모 프레임 자신만 트리거 가능)하되 "라이브 미리보기"·공용 단말 재사용 시나리오에서 실질적으로 도달 가능하다고 평가. | `use-widget.ts` `teardownSession()`(조기 return) · `applyConfig()`(`loadSession`) · `newChat()`; `widget-state.ts` `case "RESTORED"`(가드 없음) | `pendingResetRef` 류 지연 플래그로 부팅 중 reset 의도를 기록하고, `applyConfig()` 가 config 확립 직후 `loadSession` 이전에 소비. **사후 확인: 이미 조치됨** — `pendingResetRef` 가 정확히 이 설계로 구현·커밋(`61cf83608`), 전용 회귀 테스트 추가(eager-start 36→40). |
| 2 | 문서 정확성/리듀서 불변식 — **3명 독립 발견**(documentation·maintainability·requirement) | "`ended` 를 벗어나는 유일한 액션은 `START`" 라는 코드 주석·테스트명·`RESOLUTION.md` "(전수 확인)" 단언이 부정확 — documentation 은 `NEW_CHAT`(대화 종료 후 "새 대화"라는 가장 흔한 흐름)을, maintainability·requirement 는 `RESTORED`/`BOOTED`(둘 다 `state.phase` 검사 없이 무조건 `"streaming"` 전이, 리듀서 직접 실행으로 반증)를 각각 반례로 제시. 현재 caller 그래프상 `ended` 에서 이 두 액션이 도달하지 않아 활성 버그는 아님. | `widget-state.ts` `case "WAITING"`(가드) vs `case "RESTORED"`/`"BOOTED"`(무조건 전이); `widget-state.test.ts`(테스트명); `08_29_33/RESOLUTION.md` §W4 | 주석/RESOLUTION 문구를 "현재 caller 규율 기준"으로 한정하거나 가드 확대. **사후 확인: 부분 조치됨** — `61cf83608` 이 주석을 "가드 범위는 WAITING 뿐 — RESTORED/BOOTED/USER_MESSAGE 도 무조건 전이하므로 리듀서 레벨 불변식은 아직 없다"로 정확히 정정하고 `NEW_CHAT`/`START` 재개 2경로를 `it.each` 로 고정. 가드 확대 자체는 "실패 사례 없어 후속"으로 **의도적 보류**. |
| 3 | 문서 정확성 — **3명 독립 발견**(documentation·maintainability·requirement) | `08_29_33/RESOLUTION.md` 자체 검증 수치 3건이 같은 off-by-one 패턴으로 실측과 불일치: `widget-state` 테스트 수 "31→33"(`it(` 리터럴만 계수, `it.each` 미반영 — 실측 37→39), W2 mutation 표 "7→8→9"(실측 6→7→8), C2 "flush 12곳"(실측 11곳 — JSDoc 예시 코드가 grep 카운트 오염). 질적 결론은 3건 모두 옳고 영향 없음 — 감사 문서의 수치 정확도 문제. maintainability 는 W2 표를 재계산해 "정확하다"고 교차검증했으나 이는 오판(requirement 가 맞음) — 교차검증도 항상 신뢰할 수 없음을 보여주는 사례. | `08_29_33/RESOLUTION.md` "검증" 절·§W2 표·§C2 | 실측(vitest 실행·`git diff` 라인 카운트)으로 재산정. **사후 확인: 이미 조치됨** — `591350e10` 이 세 수치를 모두 정정하고 "vitest·git diff 실행 결과만 authoritative" 원칙을 명문화. |
| 4 | 테스트 유지보수성 — maintainability 단독 | 신규 회귀 테스트가 **공식 spec 불변식 ID `"C1"`**(`spec/7-channel-web-chat/1-widget-app.md` 이 "보류 메시지 큐"로 명시, 5개 파일 참조)을 무관한 의미(이번 라운드 "Critical #1")로 재사용 — 같은 파일에 `"C1:"` 제목 3개가 서로 다른 두 주제를 가리켜 `grep`/spec-coverage 도구 혼동 위험. | `use-widget-eager-start.test.ts`(신규) vs 기존 spec 불변식 C1 테스트 2건 | 라벨을 서술형으로 변경. **사후 확인: 이미 조치됨** — `61cf83608`("테스트 라벨 충돌 해소")가 신규 제목을 서술형으로 바꾸고 라운드 참조를 리드 주석으로 이관. |
| 5 | 코드 유지보수성 — maintainability 단독 | `worldGenRef` 세대 캡처→재검증 관용구가 4개 함수에 9곳 이상 손으로 복제됨 — 이번 라운드가 고친 W2(catch 분기 recheck 누락) 자체가 이 복제 누락에서 비롯됐음에도, fix 는 관용구를 구조화하지 않고 2곳을 또 손으로 추가. | `use-widget.ts`(capture 4곳, recheck 8곳) + `use-token-refresh.ts`(1곳) | 최소 `isStale(gen)` named predicate 추출. **사후 확인: 이미 조치됨** — `61cf83608` 이 `isStale` 도입해 전 지점 치환, mutation 검증(무력화 시 7건 실패 → 복원 40/40)까지 기록. |
| 6 | 테스트 품질 — testing 단독 | W2 신규 회귀 테스트가 관련된 두 가드(catch 분기 세대검사 / `applyConfig` 재검증)가 동일 `gen` 을 비교하는 중복 검사라, **어느 한쪽만 제거해도** 그린으로 남는다(양쪽 다 제거해야 실패) — 가드 a **개별**을 회귀 잠금하지 못한다. | `use-widget.ts`(가드 a / 가드 b); `use-widget-eager-start.test.ts` W2 테스트 | `seedWaitingFromStatus` 직접 호출 단위 테스트로 catch 분기만 독립 검증하거나, RESOLUTION 문구를 "상호 대체 가능한 중복 방어"로 정정. **사후 확인: 조치 여부 미확인**(잔여 가능성, 활성 버그 아님). |
| 7 | 테스트 일관성 — testing 단독 | "고정 횟수 microtask flush 는 취약하므로 선제 제거" 방침이 **같은 커밋에서 신규 추가된** W5 테스트(`use-token-refresh.test.ts`)에는 적용되지 않아 그 관용구가 새로 유입됨 — 현재는 단일 microtask 홉이라 안전하나 향후 await 홉 추가 시 회귀 가능. `flushAsync` 가 파일 로컬이라 공유 유틸 부재가 원인. | `use-token-refresh.test.ts`(W5) vs `use-widget-eager-start.test.ts`(`flushAsync`) | `flushAsync` 로 교체하거나 공유 테스트 유틸로 추출. **사후 확인: 이미 조치됨** — 실제 코드로서의 `await Promise.resolve()` 없음, `61cf83608` 이 "W5 테스트가 도입했던 고정 microtask flush 도 제거"라 명시. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 제안 |
|---|----------|----------|------|
| 1 | 테스트 커버리지 — **2명**(concurrency·side_effect) | `useTokenRefresh` 의 cross-hook 계약("소유자가 언마운트 cleanup 에서 `worldGenRef` 를 올린다")이 실제 `unmount()` + `refreshToken()` in-flight 를 하나의 테스트로 잇지 않음 — 구성요소 각각은 개별 검증되고 코드 추적으로 조합 안전성도 확인(두 cleanup 모두 동기 함수라 run-to-completion 으로 microtask 이전에 완료)했으나 종단 테스트는 부재. 활성 버그 아님. | (선택) W3 와 대칭으로 "refreshToken in-flight 중 언마운트" 케이스 추가. |
| 2 | 문서 정확성 — documentation | `worldGenRef` 최상위 JSDoc "왜 하나로 합쳤나" 가 "종전 3종" 이라 서술하는데 이번에 통합된 4번째 축(`useTokenRefresh` 의 `cancelledRef`)을 미반영(인접 주석·CHANGELOG 에는 정확히 기록되어 정보손실은 아님). | 짧은 back-reference 추가. **현재도 "3종" — 미조치.** |
| 3 | 유지보수성 — maintainability | 동일 인과 서사(C1·W2)가 코드 주석·테스트 리드·`RESOLUTION.md`·plan 에 3~4중 반복 — 재발 이력(4라운드 연속)을 고려하면 국소 컨텍스트는 정당하나 향후 4곳 동기화 부담. | 코드 주석은 최소치만, 전체 서사는 RESOLUTION/plan 을 SoT 로 참조. 차단 사유 아님. |
| 4 | 문서 정확성 — requirement | "신규 테스트 6건 전부 mutation 검증" 표현이 6번째("START 는 ended 를 벗어나는 유일한 경로")에는 엄밀히 부적합 — 대응하는 "제거하면 실패하는 가드"가 없는 정상 경로 회귀 고정이라 실질 mutation 대상은 5건. | "5건은 가드-제거 mutation, 1건은 정상 경로 고정"으로 구분 서술. |
| 5 | 세션 위생(carryover) — security | `ended` 최후 방어선이 `WAITING` 에만 있고 `AI_MESSAGE`(SSE `execution.message`)에는 없음 — 이론상 동형. `closeStream()` 이 먼저 호출되고 `EventSource.close()` 이후 이벤트 미발화가 브라우저 명세상 보장되어 실거래 위험 낮음(테스트 더블 한계로 실증 불가). 이번 diff 범위 밖. | 조치 불요. 일괄 적용은 후속 검토(WARNING#2 와 동일 축). |
| 6 | 보안 — security | `host-bridge.ts` 의 `hostOrigin` 미확정 구간에서 `wc:command` 가 origin 검증 없이 처리됨 — 최상단 `e.source !== parent` 가드가 있어 크로스오리진 스푸핑 벡터는 아님. 이번 diff 범위 밖 기존 파일. | 조치 불요. WARNING#1 수정 시 "resetSession 이 boot 보다 먼저 도착" 극단 케이스 고려 권장. |
| 7 | 코드 구조 — side_effect | `teardownSession()` 조기 return 의 국소 안전성은 코드 추적으로 확인되나 **수작업 grep 감사**로만 성립 — 향후 `configRef.current = null` 대입을 도입하는 기능이 생기면 조용히 회귀 가능. | `configRef.current` 를 null 로 되돌리는 코드가 생기면 이 조기 return 조건도 재검토해야 함을 JSDoc 에 한 줄 남길 것. |
| 8 | 감사 절차 — requirement | "85회 재현 실패"(20+37+8+20) 주장은 자체 일관성이 있고 본 리뷰의 20회 추가 실행(0건 실패)도 방향 일치하나, 원 실행의 로그·아티팩트가 보존되지 않아 횟수 자체의 완전한 독립 감사는 불가. | 향후 반복실행 검증은 로그/아티팩트 보존. |

### 검증되어 문제 없음으로 확인된 사항 (요약)

- **scope**: 21개 변경 파일 중 코드/plan 8개 + 리뷰 산출물 13개(별도 커밋으로 위생적 분리). 직전 라운드 Critical 2 / Warning 7 전부에 1:1 매핑되는 변경만 존재, `import` 변경·순수 포맷팅 hunk·스코프 이탈 0건.
- **security**: 인젝션·하드코딩 시크릿·입력검증·암호화·의존성 보안 전 카테고리 이상 없음. `useTokenRefresh` 세대검사가 옛 토큰의 storage 잔존·스트림 오남용을 완전히 차단함을 코드 추적으로 확인.
- **documentation**: `CHANGELOG.md` 항목4 정정(옛 "유령 표면을 그리지 않는다" 주장 제거 + 항목5 인수인계)이 코드와 정확히 일치함을 확인.
- **maintainability**: `worldGenRef` "무효화 지점 셋" 주장이 grep 전수 확인 결과 정확. 변경 파일에 TODO/FIXME/HACK 없음, lint/build/전체 vitest clean.
- **requirement**: `spec/7-channel-web-chat/1-widget-app.md §3.1` 이 이미 명문화한 계약과 diff 가 정합 — spec 본문 갱신 불요(SPEC-DRIFT 아님). `configRef.current` 확립 후 재-null 대입 0곳(grep 전수 확인).
- **concurrency**: 전통적 mutex/데드락 축은 단일 스레드 브라우저 React 훅에 해당 없음. `flushAsync()` 전환은 고정 횟수 `await Promise.resolve()` 안티패턴에 대한 견고한 개선으로 확인.
- **side_effect**: 전역변수·환경변수·파일시스템·시그니처·네트워크·이벤트 축 전부 이상 없음. `useTokenRefresh` 시그니처 변경의 blast radius 완전 봉쇄 확인(호출자 전부 갱신, strict superset 보호범위).
- **testing**: 신규 회귀 테스트 5건(C1·W3·W5·W4×2)이 mutation 검증으로 실제 버그 포착력 실증(특히 W3 는 직전 라운드의 "0건 실패" 관측을 뒤집음). `flushAsync` 치환은 검증력을 약화시키지 않고 negative-assertion 테스트를 강화.

## 사후 검증 참고 — 라이브 워크트리 재확인

concurrency.md 가 리뷰 도중 직접 목격한 대로, 이 SUMMARY 작성 시점의 워크트리는 8개 reviewer 의 `prompt_file` 스냅샷(커밋 `31a7ce4fc`) 이후 진행된 후속 커밋을 포함한다:

- `61cf83608` `fix(web-chat): C1 픽스가 남긴 부팅-리셋 소실 gap 봉합 + 세대 가드 isStale 승격` — WARNING #1·#4·#5·#7 및 #2(부분: 주석 정정)를 코드로 조치.
- `591350e10` `docs(review): ai-review 09_36_01 산출물 + RESOLUTION 정정(C2 원인 확정, 정량 오류 3건)` — WARNING #3 정정 및 Critical #1 의 원인 규명·종결을 `08_29_33/RESOLUTION.md` 에 반영.

즉 본 라운드에서 실질적으로 **미확인 상태로 남은 항목은 WARNING #6(W2 이중가드 개별 고정력 부재)**, **WARNING #2 의 `RESTORED`/`BOOTED` 확장(의도적 보류, 활성 버그 아님)**, **INFO #2(JSDoc "3종"→"4종")** 정도다. 이는 이 파이프라인이 SUMMARY 확정 이전에 개별 reviewer 산출물을 근거로 fix 를 착수·커밋할 수 있는 구조임을 보여준다(testing.md CRITICAL 이 지적한 "공유 워크트리 동시 편집"과 동일 메커니즘의 순기능적 발현).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | LOW | C1/W2/W3/W4/W5 재검토 전부 정상 종결 확인. sessionStorage 부활 gap(WARNING#1) 관측 + 형제 리뷰어의 라이브 수정 교차검증. 공유 워크트리 동시쓰기 직접 목격(코드 아닌 인프라). |
| documentation | LOW | CHANGELOG 항목4 정정 정확성 확인. RESOLUTION 수치 오기(WARNING#3) + "ended 유일 액션" 주석 부정확(WARNING#2, `NEW_CHAT` 반례) 발견. |
| maintainability | LOW | `worldGenRef` JSDoc "무효화 지점 셋" 정확성 확인. 테스트라벨 `"C1"` 충돌(#4) + 세대가드 9곳 손복제(#5) + RESOLUTION 수치(#3 기여) 발견. |
| requirement | MEDIUM | RESOLUTION 4개 단언 표본 mutation 검증. sessionStorage gap(#1) 상세 재현 + 리듀서 비대칭 반증(#2 기여) + 수치 off-by-one(#3 기여). |
| scope | LOW | 스코프 이탈 없음 — 21개 파일 전 항목이 직전 라운드 지적에 1:1 매핑, 커밋 위생 모범적. |
| security | LOW | sessionStorage gap(#1) 독립 발견 + 위협모델 평가(크로스오리진 아님, 세션위생 이슈). `useTokenRefresh` 세대검사 안전성 검증 완료. |
| side_effect | MEDIUM | sessionStorage gap(#1)을 6단계 재현 시나리오로 가장 상세히 기술. `useTokenRefresh` 시그니처 blast radius 봉쇄 확인 + cross-hook 암묵계약의 구조적 특성 지적. |
| testing | MEDIUM | C2 재현(60회 중 9회)했으나 근본원인은 리뷰 파이프라인의 동시편집(CRITICAL#1, 코드결함 아님, 격리 60/60 무실패로 코드 무죄 재확인) + W2 이중가드 개별고정 실패(#6) + flushAsync 비일관(#7). |

## 발견 없는 에이전트

해당 없음 — 실행된 8개 reviewer 전원이 최소 1건 이상 제시했다.

## 권장 조치사항

1. **(검증 권장)** WARNING#1 의 fix(`pendingResetRef`, `61cf83608`)와 신규 회귀 테스트가 4명이 지적한 시나리오(부팅 중 reset + 사전 저장된 유효 세션)를 실제로 mutation 검증까지 통과하는지 명시적으로 재확인할 것.
2. WARNING#2 잔여 — `RESTORED`/`BOOTED` 에 `ended` defense-in-depth 확대 여부를 결정하고, 현재의 의도적 보류를 추적 문서에 명시적 후속 항목으로 고정할 것(활성 버그 아니므로 긴급하지 않음).
3. WARNING#6 — W2 회귀 테스트가 두 가드 중 하나만 있어도 통과하는 점: `seedWaitingFromStatus` 단위 테스트 분리 또는 RESOLUTION 문구를 "상호 대체 가능한 중복 방어"로 정정. 조치 여부가 확인되지 않은 유일한 실질 WARNING.
4. 리뷰 파이프라인 구조 개선 — (a) flaky 판정은 격리 worktree 에서 수행하도록 절차화, (b) SUMMARY 확정 이전에 fix 가 공유 워크트리에 반영되는 현재의 레이스가 의도된 설계인지 정책 차원 점검.
5. (경미) `worldGenRef` 최상위 JSDoc 의 "3종 무효화 트리거" 를 4번째 축(`cancelledRef`)까지 반영해 갱신.

## 라우터 결정

- `routing_status=pending` (router 미완료 — `_routing_decision.json` 부재). 이번 라운드는 표준 fallback("전체 reviewer 실행")을 따르지 않고 **등록 14개 중 8개만 실행**됐다(`_prompts/` 에는 14개가 모두 준비돼 있었으나 산출물은 8개).
  - **실행(8명)**: `concurrency`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
  - **제외(6명)**: 아래 표. `meta.json`/`_retry_state.json` 에 명시적 스킵 사유 기록 없음 — 다만 `agents_forced_reasons` 가 실행된 8명 중 7명에 대해 "소스 코드 변경(위젯 상태관리·훅) 또는 문서 변경 시 항상 적용" 강제 사유를 명시하고 있어, 이번 diff 가 순수 프론트엔드 위젯 훅/리듀서 + 문서 변경에 국한된 점을 고려하면 미실행 6개는 관련성이 낮아 보인다 — 단 라우터가 그렇게 판단했다는 확인된 근거는 아니며, 형식적 스킵 결정이 기록되지 않은 것 자체는 개선 여지다.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 실행 기록 없음 — router 미완료로 인한 미실행 추정(패키지/의존성 변경 없음) |
  | database | 실행 기록 없음 — 미실행 추정(DB 스키마/쿼리 변경 없음) |
  | api_contract | 실행 기록 없음 — 미실행 추정(API 계약 변경 없는 순수 프론트엔드 diff) |
  | performance | 실행 기록 없음 — 미실행 추정 |
  | user_guide_sync | 실행 기록 없음 — 미실행 추정(사용자 가이드 영향 문서 변경 없음) |
  | architecture | 실행 기록 없음 — 미실행 추정(구조 변경이 아닌 국소 fix) |
