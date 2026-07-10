# 유지보수성(Maintainability) 코드 리뷰 — EIA/WS continuation 명령 ↔ 대기 표면 가드

대상: `waiting-surface-guard.ts`(신규) + `execution-engine.service.ts` 확장(`resolveWaitingNodeExecutionId`
+ `assertCommandMatchesWaitingSurface`) + `park-entry-dispatch.ts`(기존) + `hooks.service.ts`
graceful catch + 관련 spec/e2e 테스트. 지시에 따라 **표면 판정 로직의 삼중(실제로는 그 이상) 정의와
drift 위험**을 중심으로 분석했다.

## 발견사항

- **[WARNING] 대기 표면(waiting surface) 분류 로직이 최소 3곳, 실질적으로 4곳에 독립 정의돼 있고, 신규 registry 대칭 테스트는 그중 2곳만 교차검증한다**
  - 위치:
    - `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts:64-76` (`resolveWaitingSurface`, 신규·pure·exported)
    - `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts:100-117` (`buildParkEntryRegistry` 의 `selects`, 기존·pure·exported)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1847-1889` (`resumeTurnRegistry` getter 내 인라인 `selects` — **private, non-exported**, `this.isCheckpointEligibleNodeType` 를 캡처하는 closure)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1705-1717` (`resumeFromCheckpoint` 내 인라인 `persistedInteractionType`/`isAiConversation` 계산 — 위 셋과 별도로 "meta.interactionType ?? flat" 규칙과 "ai_conversation‖ai_form_render" 판정을 **또 한 번** 직접 구현)
  - 상세: 새로 추가된 `waiting-surface-guard.spec.ts` 의 "registry 대칭" describe 블록은 **`resolveWaitingSurface` vs `buildParkEntryRegistry`** 두 정의만 `it.each` 로 교차검증한다. `resumeTurnRegistry`(실제로 재개 시 어떤 처리기가 선택되는지를 정하는, worker-side 의 진짜 SoT)는 이 테스트에 전혀 등장하지 않는다 — 이유는 구조적이다: `parkEntryRegistry` 는 `buildParkEntryRegistry(deps)` 라는 순수 factory 로 추출돼 selects 만 독립적으로 부를 수 있지만, `resumeTurnRegistry` 는 서비스 클래스의 private lazy getter 로 남아있고 (line 1846), 그 `ai_conversation` 항목의 `selects` 는 `this.isCheckpointEligibleNodeType(...)` 을 캡처하는 클로저라 서비스 인스턴스 없이 순수 함수로 뽑아낼 수 없다. 게다가 `ResumeTurnSelector`(resume-turn-dispatch.ts:44-60)는 `interactionType` 대신 `persistedInteractionType` 필드명을 쓰고, `buttons`/`ai_conversation` 원시 문자열 대신 파생된 `isAiConversation`/`hasResumeCheckpoint` 불리언을 쓴다 — `ParkEntrySelector`/`WaitingSurfaceSelector` 와 shape 자체가 달라 같은 테스트 데이터를 재사용할 수 없다. 즉 "표면 판정은 `dispatchResumeTurn`/`dispatchParkEntry` 의 selects 술어를 그대로 미러링한다"(`waiting-surface-guard.ts:71-73`, `execution-engine.service.ts:5227` 주석)는 설계 의도가 **문서화된 불변식일 뿐, 코드/테스트로 강제되지 않는 3번째(실질 4번째) 사본에는 적용되지 않는다.**
    - 실제 drift 시나리오: 향후 `resumeTurnRegistry` 의 `buttons` selects(`sel.persistedInteractionType === 'buttons'`, line 1864)나 `ai_conversation` 조건(line 1882-1885)을 수정하면서 `waiting-surface-guard.ts`/`park-entry-dispatch.ts` 를 갱신하지 않아도, 신규 symmetry 테스트는 여전히 **녹색**이다(두 정의는 서로 여전히 일치하므로). 이 경우:
      - publisher 가드가 worker 보다 **더 관대**해지면 → publish 는 통과하지만 `dispatchResumeTurn` 이 매칭 처리기를 못 찾아 `RESUME_CHECKPOINT_MISSING` 으로 **비동기 실패**(이 PR 이전의 실패 모드로 회귀, 정확히 plan 문서 "fail-closed" 절이 피하려던 상황).
      - publisher 가드가 worker 보다 **더 엄격**해지면 → 실제로는 정상 처리 가능한 명령이 publish 단계에서 **409 로 오거부**되는 사용자 대상 회귀.
    - 이는 이 PR 자체가 고치는 결함 클래스("동일 판단 로직이 여러 곳에 흩어져 있다가 한쪽만 갱신되며 조용히 어긋남")를 가드 코드 자신이 축소된 형태로 재도입한 것이다 — 자기참조적 위험.
  - 제안 (강도순):
    1. **구조적 단일화(권장)**: `resumeTurnRegistry`/`parkEntryRegistry` 의 `selects` 가 문자열 비교를 재구현하지 말고 `resolveWaitingSurface(sel)` 를 직접 호출하도록 바꾼다. 예:
       ```ts
       // resumeTurnRegistry
       { kind: 'form', selects: (sel) => resolveWaitingSurface(sel) === 'form', ... }
       { kind: 'buttons', selects: (sel) => resolveWaitingSurface(sel) === 'buttons', ... }
       {
         kind: 'ai_conversation',
         selects: (sel) =>
           resolveWaitingSurface(sel) === 'ai_conversation' &&
           sel.hasResumeCheckpoint &&
           this.isCheckpointEligibleNodeType(sel.node.type),
         ...
       }
       ```
       `ResumeTurnSelector`/`ParkEntrySelector` 필드명을 `WaitingSurfaceSelector`(`blockingInteraction`/`interactionType`)로 통일하면(현재 `persistedInteractionType` → `interactionType` 개명, 의미상 동일 값이므로 무손실) 셋 다 같은 인자 shape 을 공유해 이 치환이 기계적으로 가능하다. 이렇게 하면 분류 규칙의 SoT 는 물리적으로 하나가 되고, symmetry 테스트는 "판정 로직이 같은가"가 아니라 "registry 배선(순서·핸들러 매핑)이 맞는가"만 검증하면 된다 — drift 가 테스트로 막히는 게 아니라 애초에 **불가능**해진다.
    2. **차선(테스트만 보강)**: 위 리팩터를 이번 PR 범위 밖으로 미룬다면, 최소한 `resumeTurnRegistry` 의 selects 3개를 `buildResumeTurnSelectors(deps)` 같은 순수 factory 로 뽑아 `resume-turn-dispatch.ts` 에 노출하고(park-entry 의 선례 그대로), `waiting-surface-guard.spec.ts` 의 registry 대칭 블록에 세 번째 대상으로 추가해 지금 비어있는 커버리지 갭을 메운다. `hasResumeCheckpoint`/`isCheckpointEligibleNodeType` 조건은 별도 axis 이므로 `resolveWaitingSurface` 와의 비교는 "표면 매칭 시 AI 게이팅 조건을 무시하고" 비교하는 식으로 조정 필요.
    3. `resumeFromCheckpoint` 인라인 계산(line 1705-1717)도 `readPersistedInteractionType`(waiting-surface-guard.ts)을 재사용하도록 교체 — 현재는 "meta 우선, flat fallback" 규칙이 코드베이스에 최소 2벌(신규 함수 + 이 인라인 블록) 존재한다. 데이터 소스가 다르다는 이유(`context.nodeOutputCache` in-memory vs DB `outputData`)는 있으나 파싱 규칙 자체는 동일하므로 함수 재사용에 걸림돌이 아니다(`readPersistedInteractionType(outputData: unknown)` 시그니처가 이미 두 소스 모두 받아들인다).

- **[INFO] `hooks.service.ts::forwardToInteractionService` 의 중첩 삼항(nested ternary)이 이전 if/else-if 대비 가독성을 다소 낮춘다**
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (diff 상 `const dto: InteractDto | undefined = update.command.kind === 'text_message' ? {...} : update.command.kind === 'button_callback' ? {...} : undefined;`)
  - 상세: 이번 변경은 `ctx` 객체 생성 중복을 제거(각 분기에서 반복 생성하던 것을 1회로 통합)한 점은 개선이나, 그 대가로 2단 중첩 삼항이 도입됐다. 분기가 2개뿐이고 각 케이스가 짧아 당장 이해에 큰 지장은 없지만, `file_upload`/`contact_share` 등 Phase 4 에서 3~4번째 분기가 추가되면 삼항 중첩이 더 깊어져 가독성이 급격히 나빠질 위험이 있다.
  - 제안: 지금 손보지 않아도 무방하나, 다음 분기 추가 시점에는 `switch (update.command.kind)` 또는 명시적 if/else-if 체인 + 조기 `return` 패턴으로 전환할 것을 권장.

- **[INFO] `waiting-surface-guard.ts`/`assertCommandMatchesWaitingSurface` 자체의 구현 품질은 양호**
  - 위치: `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts` 전체, `execution-engine.service.ts:5219-5253`(`assertCommandMatchesWaitingSurface`)
  - 상세: 순수 함수 분리(`resolveWaitingSurface`/`isCommandAllowedOnSurface`/`readPersistedInteractionType`), 매트릭스를 데이터(`SURFACE_ALLOWED_COMMANDS`)로 표현해 분기 로직과 정책을 분리한 점, `assertCommandMatchesWaitingSurface` 가 순차 guard-clause 3개로만 구성돼 중첩이 없는 점, client-safe 메시지와 `serverDetail` 분리 등은 이 프로젝트의 기존 컨벤션과 일관되고 단일 파일 내부로는 복잡도가 낮다. 위 WARNING 은 이 파일 자체의 결함이 아니라 **이 파일이 등장함으로써 늘어난 "동일 로직의 사본 개수"** 에 대한 것이다.

- **[INFO] 테스트 헬퍼(`armWaitingSurface`/`armStaticFormSurface`) 팩토링은 양호, e2e `JWT_SECRET` 중복 제거도 개선**
  - 위치: `execution-engine.service.spec.ts` 신규 `표면 매트릭스 가드 (§7.5.1)` describe 블록, `execution-park-resume.e2e-spec.ts`
  - 상세: 표면별 mock 조합을 짧은 단일 목적 헬퍼로 뽑아 8개 테스트 케이스의 중복을 최소화했고, 두 describe 블록에 중복 정의돼 있던 `JWT_SECRET`/`mintInteractionToken` 을 파일 상단 단일 정의로 통합해 기존 중복을 오히려 줄였다. 별도 조치 불필요.

## 요약

이번 변경의 핵심 신규 모듈(`waiting-surface-guard.ts`)과 그 소비처(`assertCommandMatchesWaitingSurface`)
자체는 순수 함수 분리·짧은 함수·guard-clause 위주 저복잡도·데이터 기반 매트릭스 등 유지보수성 원칙을 잘
지킨다. 다만 지시받은 핵심 우려대로, "대기 노드가 어떤 인터랙션 표면인가"를 판정하는 로직이 최소 3곳
(`waiting-surface-guard.ts` / `park-entry-dispatch.ts` / `execution-engine.service.ts` 의
`resumeTurnRegistry`)에, 넓게 보면 4곳(`resumeFromCheckpoint` 인라인 계산 포함)에 독립적으로 존재하며,
신규 registry 대칭 테스트는 그중 서로 필드 shape 이 같은 두 곳(신규 가드 vs `parkEntryRegistry`)만
교차검증한다. 실질적 worker-side SoT 인 `resumeTurnRegistry` 는 private getter + `this`-bound 클로저로
남아있어 구조적으로 대칭 테스트 대상에서 빠졌다 — 이는 "테스트로 충분히 막히는가"라는 질문에 대해
**아니오**에 가깝다: 세 번째 정의만 단독으로 드리프트하면 현재 테스트 스위트는 여전히 통과한다. 이 PR
이 고치는 결함 클래스(다중 사본 중 하나만 갱신되며 조용히 어긋남)를 가드 스스로 축소된 형태로 재도입할
위험이 있으므로, `resolveWaitingSurface` 를 물리적 단일 SoT 함수로 삼아 나머지 두(세) 곳이 그것을
직접 호출하도록 리팩터링(구조적 단일화)하거나, 최소한 `resumeTurnRegistry` 의 selects 를 순수 factory
로 추출해 대칭 테스트 대상에 포함시킬 것을 권장한다. 그 외 항목은 경미한 스타일 제안(INFO) 수준이다.

## 위험도

MEDIUM
