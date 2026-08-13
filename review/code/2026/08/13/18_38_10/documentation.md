# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `chat-channel.dispatcher.spec.ts` 의 오배치 JSDoc 이 여전히 남아 있고, 이번 라운드까지 4번째 기회에서도 백로그에서 완전히 누락됐다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:703-714` (JSDoc 본문) — 실제 설명 대상인 `describe('ChatChannelDispatcher.handle — toChatChannelEvent null 의 로그 레벨 분기', ...)` 는 66줄 뒤인 `:769`. 그 사이(`:715-722`)에 무관한 두 번째 JSDoc(`makeDispatcherHarness` 용)이 끼어 있고, `:723-767` 에 `makeDispatcherHarness`/`buildDispatcherForNull` 함수 정의가 이어진다. 이 배치는 `Read` 로 현재 워킹트리 파일을 직접 열어 확인했다(diff 는 이번 세션 예산상 생략됨).
  - 상세: 이 결함은 `17_15_21/maintainability.md` INFO 1 이 처음 지적(당시 대상 코드가 이번 diff 이전 라운드에서 도입됨)했고, `RESOLUTION.md`(`17_15_21`)가 "chat-channel.dispatcher.spec.ts 스타일 항목 4건 — 이번엔 넘긴다(3라운드째 changeset 재오픈 방지)"로 묶어 의식적으로 유예했다. `18_00_11/maintainability.md` 도 같은 4건을 "다음 실질 변경 때 함께 정리할 백로그"로 재확인했다. 그런데 `18_19_33` 라운드가 바로 이 파일(`chat-channel.dispatcher.spec.ts`, 이 JSDoc 블록이 감싸는 바로 그 `describe` 안)에 새 테스트 2건을 추가하는 "실질 변경"이었음에도, `18_19_33/maintainability.md` 는 4건 중 캐스트 리터럴 1건만 재확인하고 JSDoc 배치·pass-through 래퍼·네이밍 불일치 3건은 언급하지 않았다. 이어 리뷰 루프를 닫은 커밋(`64763c5cd`)이 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 남긴 후속 체크리스트(게이트 `1188` 부근, `## \`.query()\` 반환 shape 하드닝 — 남은 후속`)에도 캐스트 리터럴 항목만 등재됐고(`grep -n "buildDispatcherForNull\|JSDoc\|make\*\|build\*" plan/in-progress/backend-lint-gate-broken-on-main.md` → 0건), 오배치 JSDoc 항목은 plan 어디에도 등재되지 않았다. 즉 "다음 실질 변경 때 정리"라던 조건이 실제로 왔는데도 놓쳤고, 그 사실조차 SoT(`plan/`)에 기록되지 않아 다음 사람은 이 항목이 존재했었다는 것 자체를 알 길이 없다.
  - 제안: `:703-714` JSDoc 블록을 실제 대상인 `:769` 의 `describe(...)` 선언 바로 위로 옮긴다. 겸사겸사 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 `.query() 반환 shape 하드닝 — 남은 후속` 절에 이 항목(과 pass-through 래퍼·네이밍 불일치)을 명시적으로 등재해, "무조치로 넘긴다"는 결정이 다음에도 추적 가능하게 남긴다.

## 확인된 양호 사항 (참고)

- `common/utils/assert-row-array.ts`/`assert-row-array.spec.ts` 의 TSDoc 은 이번 diff 전체에서 가장 두드러지는 문서 품질을 보인다 — "왜 타입 단언이 검증이 아닌지", "왜 메시지를 호출부가 주는지", "정규식 카운트의 사각지대(`let`/구조분해/체이닝, `FILES` 2개 한정)"를 모두 명시적으로 적어 뒀고, 이번 PR 의 마지막 두 커밋(`64763c5cd`, `860a727b7`)이 스스로 쓴 근거 인용(세션 ID, `ts-jest` 버전, `scripts/check-backend-typecheck-ratchet.py` 경로)을 재차 실측해 정정했다 — 실제로 `package.json` 의 `ts-jest: ^29.2.5`, `.github/workflows/backend-checks.yml:147` 의 `check-backend-typecheck-ratchet.py` 배선, `integration-oauth.service.ts:593,803` 의 `consumeOAuthState` 호출부를 직접 grep 해 대조한 결과 모두 정확하다.
- `execution-engine.service.ts`/`executions.service.ts` 의 4개 `assertRowArray` 호출부 인라인 주석(admission 트랜잭션 롤백, `lockNonTerminalExecutionRow` 진단용 fail-closed, `updateExecutionStatus` 종결 이벤트 유실, `computeChainDepth` RR-PL-05 우회)은 각 지점의 실제 코드 동작과 line-level 로 정확히 일치한다 — "네 곳을 동질로 뭉치지 않고 실패 방향을 각각 적는다"는 설계 의도가 주석에도 그대로 반영돼 있다.
- `admitExecutionOrDefer` top-level docstring 이 `throw` 갈래를 계약에 명시(`:2861` 부근, "throw 도 계약의 일부다")하도록 확장돼, `17_15_21/documentation.md` INFO("반환값 3가지만 열거, throw 미언급")가 실제로 해소됐다.
- 신규 공개 API·REST 엔드포인트·환경변수·설정 옵션이 없어 README·API 문서·설정 문서 갱신은 불필요하다. `common/utils/` 디렉터리에는 원래 README/index 가 없어(기존 20여 개 유틸 전부 동일 패턴) 신규 파일 추가로 인한 문서 구조 갱신 의무도 없다.
- `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `export` 로 넓히면서 "왜 export 인지" 한 줄이 자매 상수 `MAX_EXECUTION_PATH_ROWS` 와 달리 없는 비대칭은 여전히 남아 있으나(`executions.service.ts:64`), `14_01_46`→`17_15_21`→`18_19_33` 세 라운드가 동일 근거("소비처가 정의부·내부·테스트뿐")로 의식적으로 유예해 왔고 값 변경도 없어 재차 WARNING 으로 올리지 않는다(INFO 로만 재확인).
- CHANGELOG 미등재는 이미 `18_00_11`/`18_19_33` 라운드가 "관측된 인시던트가 아닌 방어적 하드닝(정상 postgres 드라이버 계약 위반이라는 극단적 edge case)"이라는 근거로 검토를 마쳤고, 이 저장소의 실제 `CHANGELOG.md` 항목들(예: 캐시 키 충돌·fail-open 관측성 등 실제 사용자 영향이 있는 항목)과 성격이 다르다는 구분이 타당하다.

## 요약

이번 diff(누적 10커밋, `origin/main...HEAD`)의 핵심 신규 문서는 `common/utils/assert-row-array.{ts,spec.ts}` 로, TSDoc·테스트 JSDoc 모두 설계 근거·한계·인용 출처를 실측 검증까지 거쳐 정확하게 서술한다 — 특히 이 PR 자신이 직전 라운드에서 지적받은 "근거 세션 오귀속" WARNING 을 두 커밋에 걸쳐 실제로 재검증하며 정정한 이력 자체가 문서 정확성 관점에서 모범적이다. 프로덕션 코드(`execution-engine.service.ts`, `executions.service.ts`)의 인라인 주석도 4개 가드 지점의 실패 방향을 각각 정확히 서술하고, `admitExecutionOrDefer` docstring 도 `throw` 갈래를 계약에 반영해 앞선 INFO 를 해소했다. 유일한 실질 WARNING 은 새로 발견한 것이 아니라 3라운드째 살아 있는 기존 결함(`chat-channel.dispatcher.spec.ts` 의 오배치 JSDoc)이 이번에 리뷰 루프가 닫히면서 `plan/` 백로그 등재 대상에서 조용히 빠졌다는 점이다 — 코드 자체의 결함이라기보다 "미룬 항목을 SoT 에 적어 둔다"는 이 저장소의 규율이 이번엔 부분적으로만(캐스트 리터럴 항목만) 지켜졌다는 문서-추적성 결함이다. README·API 문서·설정 문서·예제 코드는 이번 diff 범위에서 해당 사항이 없다.

## 위험도

LOW
