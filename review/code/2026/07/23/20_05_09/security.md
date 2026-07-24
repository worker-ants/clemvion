### 발견사항

- **[INFO]** 이번 diff 는 실행 코드 변경이 없는 순수 문서(plan/spec/consistency-review 산출물) 변경 — 통상적인 보안 취약점 클래스(인젝션·인증/인가·입력검증·암호화·에러 노출)가 적용될 표면이 없음
  - 위치: 변경 파일 12개 전부 — `plan/in-progress/node-output-redesign/form.md`, `plan/in-progress/presentation-thread-optout-drift.md`, `review/consistency/2026/07/23/19_48_09/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`, `spec/4-nodes/6-presentation/0-common.md`, `spec/conventions/conversation-thread.md`
  - 상세: 확장자 기준 `.md`(9) / `.json`(2, `_retry_state.json`·`meta.json`)만 포함되며 `codebase/**` 하위 `.ts`/`.tsx`/`.js` 소스는 하나도 포함되지 않음. JSON 2건은 세션 경로·타임스탬프·checker 이름 나열뿐으로 자격증명·토큰류 문자열 없음(직접 확인).
  - 제안: 해당 없음(조치 불필요).

- **[INFO]** `plan/in-progress/node-output-redesign/form.md` 의 신규 각주가 `form.handler.ts:44` 의 `config: { ...rawConfig }` spread 패턴을 재확인하며, 형제 handler(carousel 등)의 "future credential-shaped fields can't slip in via spread" 코멘트를 인용함 — 이 spread 패턴 자체는 자격증명류 필드가 향후 config 에 추가될 경우 client-visible 출력/ConversationThread 로 유출될 수 있는 이론적 경로이나, **이번 diff 는 그 코드(`form.handler.ts`)를 변경하지 않고 문서화만 함**
  - 위치: `plan/in-progress/node-output-redesign/form.md:156-161` (D1 재검토 각주), `plan/in-progress/presentation-thread-optout-drift.md:56-59`("비목표" 항목에서 developer 범위로 명시 분리)
  - 상세: `spec/conventions/node-output.md §7 D1`(diff 밖, 참조만)이 "config echo 는 명시 enumeration 의무화"를 요구하는 이유가 정확히 이 우려(스프레드가 예기치 않은 필드를 그대로 client/thread 로 전파) 때문임을 문서 스스로 인용하고 있다. 이번 변경은 실 코드를 고치지 않고 "developer 후속 task 로 분리한다"는 방침만 pin 했으므로 신규 보안 회귀는 아니며, 기존에 이미 존재하던 코드 상태(`{ ...rawConfig }`)를 있는 그대로 재확인·문서화한 것뿐이다.
  - 제안: 이번 PR 범위에서 조치 불필요. 다만 후속 developer 작업(별건, 이미 문서에 pin됨)에서 `form.handler.ts` 의 raw config echo 를 명시 enumeration 으로 전환할 때, 다른 4개 handler 와 동일하게 "credential-shaped fields" 배제를 코드 리뷰 체크리스트에 포함시킬 것을 권고(정보 제공 목적, 이번 diff 의 결함 아님).

- **[INFO]** `spec/4-nodes/6-presentation/0-common.md §4.6` 개정이 서술하는 opt-out 게이트(`ConversationThreadService.appendInternal` / `isOptedOut`)는 fail-open 이 아니라 "명시 `true` 설정 시에만 skip"하는 기본값 `false`(안전측 기본값) 구조로 서술됨 — 문서 서술만으로는 보안 결함 없음
  - 위치: `spec/4-nodes/6-presentation/0-common.md:159-168`(필드 표 + 두 층위 표), `spec/conventions/conversation-thread.md:189-194`(대칭 보강 각주)
  - 상세: 기본값 `false`(즉 기본 동작은 thread 에 push — 데이터 은닉이 기본이 아님)이고, opt-out 은 노드 설정자가 명시적으로 `true` 를 넣어야 발동한다. 이는 "실수로 민감 인터랙션이 노출"되는 방향이 아니라 반대(설정 없으면 계속 기록됨)이므로 권한/기밀성 결함으로 볼 근거가 없다. 다만 이 필드가 presentation 5노드 schema 에 미선언 상태로 `.passthrough()` 를 통해서만 수동 설정 가능하다는 사실 자체는 순수 UI affordance 갭이며 보안 이슈는 아니다(문서가 정확히 그렇게 분류함).
  - 제안: 해당 없음.

### 요약

리뷰 대상 12개 파일 전부가 `.md`/`.json` 문서(plan 정정, spec 서술 정밀화, consistency-check 산출물)이며 `codebase/**` 소스 변경이 전혀 없다. 인젝션·하드코딩 시크릿·인증/인가·입력검증·암호화·에러 노출·의존성 취약점 등 코드 실행 경로에 결부된 보안 관점은 적용할 표면이 없다. 유일하게 눈에 띄는 보안 인접 맥락은 `form.handler.ts` 의 `{ ...rawConfig }` config-echo spread 가 (다른 4개 handler 대비) "credential-shaped fields" 유출 이론적 경로로 지목된 기존 이슈를 문서가 재확인한 것인데, 이번 diff 는 그 코드를 건드리지 않고 developer 후속 task 로 명시 분리해 두었으므로 이번 변경 자체의 결함은 아니다. JSON 산출물(`meta.json`, `_retry_state.json`)에도 자격증명·토큰 유출 없음을 직접 확인했다.

### 위험도
NONE
