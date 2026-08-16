# RESOLUTION — `17_12_34`

**리뷰어 14명 전원 실행** (forced 7 ⊆ 14). **CRITICAL 0 · WARNING 6** — 전부 조치했다.

> `agents_forced` = `documentation · maintainability · requirement · scope · security ·
> side_effect · testing` 7명. 라우터 결정을 신뢰하는 대신 **14명 전수**를 띄웠다 —
> forced 커버리지가 구조적으로 보장되고, 라우터 산출 파일명 불일치(기존 결함)에도 걸리지 않는다.

## WARNING 처리

| # | Reviewer | 발견 | 조치 |
|---|---|---|---|
| 1 | performance | `nodeExecutions` **uncapped 배열에 무조건 spread** — 자매 `reconcilePreParkWaitingStatus` 의 copy-on-change 관례를 이 배열 위에서만 깸 | **수정.** `ne.error == null ? ne : {...}` 로 `error` 있는 행만 복제 |
| 2 | maintainability | `as Execution` 캐스트가 새 함수의 정직한 `\| null` 반환을 지움 → 이후 `.error` null-check 누락을 컴파일러가 침묵 | **수정.** `ResponseExecution` 명시 타입 신설, 무단 단언 제거 |
| 3 | side_effect | `stop()` 반환이 엔티티 참조 → 마스킹 복사본으로 **암묵 변경** | **문서화.** JSDoc 에 계약 변경 명시 + **실측**(관계는 애초에 로드되지 않아 응답에서 사라지는 필드 없음) |
| 4 | testing | JSDoc 이 약속한 *"레거시 문자열·숫자 통과"* 가 테스트로 고정 안 됨 | **수정.** 문자열/숫자 케이스 2건 추가 |
| 5 | documentation | `CHANGELOG.md` 미갱신 — 같은 계열 직전 6커밋(#1171~#1177)이 전부 지킨 "wire 변화" 관행 | **수정.** `## Unreleased` 항목 추가 |
| 6 | documentation | plan 체크박스 *"정본 트래커 I1·D 닫기"* 가 `[ ]` 인데 같은 diff 에서 이미 닫힘 | **수정.** `[x]` + stale 사유 |
| 7 | requirement | *"표면 전수"* 주장이 실제로 전수가 아님 — workflow-assistant LLM 도구가 같은 두 컬럼을 **더 약한** 마스킹으로 내보냄 | **아래 별항** |

## #7 — 고치려다 되돌렸다 (실측이 처방을 반증)

발견 자체는 맞다. `explore-tools.service.ts:464`·`:484` 는 `maskSensitiveFields`(**키 이름**
기반)만 걸고, 그 함수는 `typeof value !== 'object'` 면 그대로 반환해 **`error.message` 안의
`Bearer …` 를 통과**시킨다.

**처방(값-패턴 마스킹 합성)을 실제로 적용해 봤더니 기존 테스트가 RED 였다.**
`maskSensitiveFields` 는 자격증명 키를 `****9876` 처럼 **접미 힌트를 남긴다** — 어떤 키가
가려졌는지 식별하게 하는 의도된 UX 다. 값-패턴 마스킹을 겹치면 그게 `***` 로 덮인다.

**테스트를 내 변경에 맞춰 고치는 대신 변경을 되돌렸다.** 두 마스킹 의미 중 이 표면에서
무엇이 우선인지는 별도 결정이고, 이 PR 이 조용히 정할 일이 아니다. 대신:

- 정본 트래커에 **결정 항목으로 등재**(실측 근거 + "단순 합성은 답이 아니다" 반증까지)
- **spec §R17 의 주장을 좁혔다** — *"내부 읽기 경로"* 총칭 대신 `ExecutionsService` 4경로 +
  `BackgroundRunsService` **열거**로 바꾸고, 잔여 ③ 으로 이 표면을 이름과 함께 적었다

> 이 세션에서 *"표면 전수"* 가 틀린 것이 **세 번째**다(트래커의 한 줄 → WS snapshot →
> `nodeExecutions[]` → assistant). 그래서 총칭을 버리고 **열거**로 바꿨다.

## 검증

- 영향 스위트 **29 suites / 535 tests PASS**
- `tsc --noEmit` — 변경 파일 오류 0. (신설 `ResponseExecution` 이 `getChain`·`stop`·
  `toResponseExecution` 3곳의 낡은 선언을 **실제로 드러냈다** — 타입이 제 역할을 한 증거)
- TEST WORKFLOW 4스테이지 재수행 결과는 아래 plan 체크리스트 참조

## INFO (조치 안 함 — 사유 기록)

- **architecture**: 응답 마스킹이 framework 강제(interceptor)가 아니라 호출부 명시 호출에
  의존 — 저장소 전반 관용이고 이 PR 이 가능한 최선의 완화(단일 관문 + 뮤테이션 + 백로그화)를
  취했다는 리뷰어 판단에 동의. 저장소 차원 장기 리스크로 별도 추적할 사안
- **maintainability INFO**: `buildSingleQB` mock 헬퍼가 한 파일에 두 번 정의 — 테스트 가독성
  항목이고 이번 diff 가 만든 중복이 아니다(선존 + 내 신규 describe 가 지역 정의를 따랐다)
- **security/api_contract INFO**: 엔티티-spread 응답 패턴, WS `execution.node.*` 잔여,
  `triggerToken` 평문 — 전부 이미 트래커 등재 범위 밖 항목
- **user_guide_sync INFO**: `run-debug-flow-change` 회색지대 — 가이드 문서에 "마스킹 안 됨"
  서술이 없어 이번 변경으로 틀려지는 지점이 없고, 직전 동종 PR(#1177)도 같은 판정
