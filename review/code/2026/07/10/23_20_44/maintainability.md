# 유지보수성 코드 리뷰 (fresh) — getStatus() 2단계 컬럼 projection, W-2/W-4 fix 검증

- diff base: `origin/main` (`git diff origin/main...HEAD`)
- 대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`),
  `interaction.service.spec.ts`
- 직전 리뷰: `review/code/2026/07/10/22_47_32/maintainability.md` — W-2(projection SoT)/W-4(Promise.all 주석) 검증

## 검증 방법

- `STATUS_PROJECTION_COLUMNS` 의 컴파일 타임 차단 주장을 실제로 재현: 로컬에서 `'outputData'` →
  `'output_data'` 로 오기해 `tsc --noEmit` 실행 → `TS2820: Type '"output_data"' is not assignable to
  type 'keyof Execution'. Did you mean '"outputData"'?` + `select` 대입부에서 2차 `TS2322` 확인 후 원복.
  RESOLUTION.md 의 주장과 정확히 일치.
- `readonly`/`as const` 불가 여부를 별도 scratchpad 파일(저장소 파일 비변경)에서 검증:
  TypeORM `FindOptionsSelectByString<Entity> = (keyof Entity)[]` (deprecated, mutable) 타입에
  `readonly [...]` 튜플을 대입하면 `TS4104: ... is 'readonly' and cannot be assigned to the mutable
  type ...` 로 실제 컴파일 에러 발생 확인. 즉 `as const`/`readonly` 생략은 **임의 선택이 아니라
  TypeORM 타입 제약에 따른 불가피한 선택**.
- 두 항목 모두 저장소 파일에 대한 임시 mutation 은 별도 scratchpad 사본에서 수행하고 즉시 원복·정리했다.
  (참고: 같은 worktree 를 공유하는 병행 리뷰어들의 산출물 디렉터리 생성이 `git status` 에서 함께 관측됨 —
  본 리뷰 대상 diff 와는 무관.)

## 발견사항

- **[INFO]** W-2 fix: `STATUS_PROJECTION_COLUMNS` — 오기(誤記) 회귀는 실제로 컴파일 타임 차단됨. **단, "DTO 신규 필드 추가 시 select 갱신 누락"은 여전히 잡지 못하며, 이 잔여 위험은 JSDoc 에 명시돼 있음 (검증 완료)**
  - 위치: `interaction.service.ts:56-73`
  - 상세: `satisfies (keyof Execution)[]` 는 배열 **원소가** `keyof Execution` 의 부분집합인지만 검증하고, 배열이 `keyof Execution` 전체(또는 DTO 가 요구하는 최소 집합)를 **포함**하는지는 검증하지 않는다 — 즉 "존재하지 않는 컬럼명"은 컴파일 에러가 되지만 "필요한 컬럼이 빠짐"은 여전히 조용히 통과한다(타입 시스템 구조상 원천적으로 불가능한 범주는 아니나 — DTO 필드와 컬럼명이 1:1 대응하지 않으므로(`updatedAt` 은 파생값) mapped-type 강제는 과설계다). 직전 리뷰가 지적한 이 잔여 위험이 이번 fix 의 JSDoc 3번째 문단("반환 DTO 에 필드를 추가할 때 이 배열도 함께 늘려야 한다 — 특히 `updatedAt` 은 ... 누락 시 '현재 시각'으로 침묵 회귀한다", `interaction.service.ts:61-62`)에 **명시적으로 경고**돼 있다. 이는 "고칠 수 없는 잔여 위험을 숨기지 않고 다음 담당자에게 인계"하는 적절한 수준의 대응이며, 이 이상(예: DTO 타입과 컬럼 리스트를 mapped type 으로 강제 결합)을 요구하는 것은 이 diff 의 범위를 넘는 과설계로 판단한다.
  - 결론: 직전 리뷰 W-2 의 핵심 우려("컬럼명 오탈자로 인한 침묵 회귀")는 실측 검증 결과 **완전히 해소**됐고, 해소 불가능한 잔여 클래스(필드 추가 시 갱신 누락)는 정직하게 문서화돼 재발 시에도 원인 추적이 빠르다. blocking 아님.

- **[INFO]** `STATUS_PROJECTION_COLUMNS` 가 `mutable` 배열로 노출 — 실질 위험은 낮으나, 왜 `readonly` 가 아닌지에 대한 주석 부재
  - 위치: `interaction.service.ts:66-73`
  - 상세: `satisfies (keyof Execution)[]` (not `as const`) 이므로 정적 타입은 `(keyof Execution)[]` — mutable. 직접 검증한 결과 이는 **TypeORM 의 deprecated 타입 `FindOptionsSelectByString<Entity> = (keyof Entity)[]` 자체가 mutable 로 선언돼 있어, `as const`/`readonly` 로 만들면 `select: STATUS_PROJECTION_COLUMNS` 대입부에서 `TS4104`(readonly → mutable 대입 불가)로 컴파일이 깨지기 때문**이다 — 즉 이번 구현이 의도적으로 회피한, 실재하는 라이브러리 타입 제약이다. 하지만 이 이유가 코드 어디에도 쓰여 있지 않다. 실질 위험도는 낮다고 판단한다 — 모듈 프라이빗 const(export 되지 않음)이고 단일 호출부(`getStatus()` 한 곳)에서만 참조되며, TypeORM 이 전달받은 `select` 옵션 배열을 내부에서 mutate 한다는 근거도 없다. 다만 문서화가 없으면, 향후 누군가 "리뷰 관행상 상수는 readonly 여야 한다"며 `as const` 를 "개선"으로 추가했다가 `TS4104` 를 만나 원인 파악에 시간을 쓸 수 있다.
  - 제안: 급하지 않음(WARNING 아님). 여유가 있다면 JSDoc 에 한 줄("TypeORM `FindOptionsSelectByString` 이 mutable 타입이라 `as const`/`readonly` 불가") 추가를 권고. `Object.freeze(STATUS_PROJECTION_COLUMNS)` 를 선언 직후 별도 statement 로 추가하면 (바인딩의 정적 타입은 그대로 유지되므로 `select` 대입은 안 깨지면서) 런타임 방어까지 얻을 수 있으나, 관측된 위험이 이론적 수준이라 이번 PR 에서 강제할 사안은 아니다.

- **[INFO]** 테스트 `BASE_COLUMNS` 독립 재기술(구현 상수 미import) — **이 선택이 옳다. import 로 바꾸면 오히려 회귀 가드가 무력화된다**
  - 위치: `interaction.service.spec.ts:761-768` (선언), `56-73`(구현 상수, export 되지 않음)
  - 상세: 직전 리뷰(W-2 권고)는 "테스트가 `STATUS_PROJECTION_COLUMNS` 를 import 해 `toEqual` 하면 진짜 단일 SoT 가 된다"고 제안했으나, 이번 fix 는 이를 채택하지 않고 독립 재기술 + `expect.arrayContaining` 대신 **정확 집합 비교**(`select.slice().sort()` vs `BASE_COLUMNS.slice().sort()`, `interaction.service.spec.ts:795`)로 강화하는 방향을 택했다. 재검토 결과 이 선택이 **기술적으로 더 낫다**: `getStatus()` 는 `select: STATUS_PROJECTION_COLUMNS` 로 상수 **레퍼런스 자체**를 그대로 전달하므로, 테스트가 그 상수를 import 해 비교하면 "소스가 상수를 전달했는가"만 동어반복적으로 검증하게 되고 — **"그 상수의 내용이 옳은가"(이번 PR 이 막으려던 바로 그 회귀 클래스, 예: 실수로 `finishedAt` 을 상수에서 지움)는 원천적으로 검출 불가능**해진다(구현과 테스트가 같은 값을 "사이좋게" 틀리면 항상 green). 독립 재기술이라야 "구현이 바뀌면 여기가 fail"(테스트 주석, `spec.ts:768`)이 실제로 성립한다. 부가로 `STATUS_PROJECTION_COLUMNS` 는 현재 export 되지 않아 import 하려면 export 표면을 테스트 편의용으로 새로 열어야 하는 비용도 있다.
  - **명확한 권고**: 현재 선택(독립 black-box 재기술)을 유지할 것. 향후 리팩터 패스에서 "중복 제거"를 이유로 이 상수를 import 하는 방향으로 "개선"하지 말 것 — 그 변경은 테스트를 약화시킨다. (직전 리뷰의 해당 권고는 본 fresh 검토로 철회한다.)

- **[INFO]** W-4 fix — `Promise.all` 주석의 "왕복 depth 2 유지, 쿼리 수 2→3" 서술, 재계산 결과 정확함
  - 위치: `interaction.service.ts:289-293`
  - 상세: PR 이전 코드는 `execution` 조회(1) → (waiting 이면) `nodeExecution` 조회(2) 로 **순차** 2회, 즉 요청 depth 2. 이번 fix 는 1단계 `execution`(얇은 projection) 조회(1) → (waiting 이면) `threadRow` + `nodeExec` 를 `Promise.all` 로 **병렬** 조회(2, 2). 순차 依存 사슬 길이(depth)는 여전히 2(1단계 → 2단계 병렬 배치)이고, 총 쿼리 수만 2→3 으로 늘었다는 서술은 실측 코드 구조와 정확히 일치한다. 추가된 1회(`threadRow`)가 PK(`id`) 단건 조회라는 서술도 정확하다(`where: { id: ctx.executionId }`). 직전 리뷰 W-4 의 부정확 지적은 이번 fix 로 완전히 해소됐다.

- **[INFO]** 컬럼별 trailing 주석 제거 — 직전 리뷰가 지적한 순서 혼동 위험이 fix 로 부수적으로 해소됨
  - 위치: `interaction.service.ts:66-73` vs 직전 리뷰 대상 코드
  - 상세: 직전 리뷰가 지적했던 `// updatedAt fallback` / `// updatedAt 우선값` 식의 원소별 trailing comment(순서 혼동 여지)는 이번 fix 에서 모듈 상수로 승격되며 배열 자체가 plain literal 로 바뀌어 **사라졌다** — 대신 우선순위 설명(`finishedAt ?? startedAt ?? new Date()`, `finishedAt` 이 먼저 언급됨)이 JSDoc 산문 한 곳으로 통합됐다. 결과적으로 직전 INFO 를 별도 조치 없이 부수적으로 해소한 셈이다. 새로운 문제 없음.

- **[INFO]** 주석 밀도 — 이번 fix 라운드에서 순증가는 미미, 기존 판단(비차단) 유지
  - 위치: `getStatus()` 전체 `interaction.service.ts:264-394` (131 lines)
  - 상세: 대략 라인 수 기준 주석 비중은 이전 라운드와 유사(≈24%, 함수 로직 자체는 diff 로 변경되지 않았고 W-4/INFO 대응은 기존 주석 문구를 정밀화한 것뿐). `STATUS_PROJECTION_COLUMNS` JSDoc(8줄)이 신규 추가됐으나 파일 내 형제 상수 `SSE_SEQ_PLACEHOLDER` 의 JSDoc(4줄)보다 길다는 점은, 이 상수가 설명하는 위험(컴파일 차단 메커니즘 + 잔여 위험 + 의도적 제외 이유 3가지)이 `SSE_SEQ_PLACEHOLDER` 보다 실제로 더 많기 때문으로 비례적이라 판단한다. `getStatus()` 자체의 인지 부하는 직전 리뷰 판단(YAGNI, 비차단)에서 변동 없음 — 분기·중첩 구조가 이번 fix 로 늘지 않았다.
  - 결론: 추가 조치 불필요.

- **[INFO]** 신규 테스트 헬퍼(`selectOf`, `whereOf`)·`THREAD` vs `DURABLE_THREAD` — 경미한 fixture 중복, 이번 PR 에서 정리할 필요는 없음
  - 위치: `interaction.service.spec.ts:755-771`(헬퍼), `545-567`(`DURABLE_THREAD`, 기존), `773-787`(`THREAD`, 신규), `817-833`(`threadWithSecret`, 신규)
  - 상세: `selectOf`/`whereOf` 는 mock 호출 인자에서 `select`/`where` 를 뽑아내는 얇은 타입 캐스팅 헬퍼로, 파일에 이미 있던 `r.context as {...}` 캐스팅 관행(`spec.ts:646, 673`)과 스타일이 일치해 새로운 이탈이 아니다. 이름·범위(새 `describe` 블록 지역 함수)도 적절하다. 반면 `DURABLE_THREAD`(2-turn, 기존)·`THREAD`(1-turn, 신규)·`threadWithSecret`(1-turn+secret, 신규)는 셋 다 `{id, nextSeq, turns, totalChars}` 동일 shape 를 매번 손으로 다시 타이핑한다 — `makeThread(turns, overrides?)` 팩토리로 뽑으면 중복이 줄지만, 세 fixture 가 서로 다른 `describe` 블록에서 각기 다른 목적(전자는 위젯 wire 포맷 회귀 다건 재사용, 후자 둘은 이번 PR 이 신설한 projection/마스킹 단일 목적 검증)으로 쓰이고 있어 결합 강도를 낮게 유지하는 편이 오히려 안전할 수 있다. 우선순위 낮음.
  - 제안: 이번 PR 에서 처리할 필요 없음(YAGNI) — 향후 4번째 유사 fixture 가 추가되는 시점에 `makeThread()` 추출을 고려.

## 종합 권고 — 이번 PR 에서 할 것 / 하지 말 것 (YAGNI)

**할 필요 없음 (이미 충분/ 이번 PR 범위 초과)**:
- `STATUS_PROJECTION_COLUMNS` 를 테스트가 import 하도록 바꾸는 것 — 위 3번째 항목 근거로 **하지 말 것**(회귀 가드 약화).
- `loadWaitingSurface()` 등 메서드 추출 — 분기/중첩 불변, 직전 리뷰 판단 유지.
- 2컬럼 `['id','conversationThread']` 인라인 select 를 상수로 재승격 — 파일 관행(2컬럼=인라인, 3개 기존 호출부와 일관)과 맞고, `updatedAt` fallback 류의 침묵 회귀 위험도 없어 승격 실익이 낮다.
- `THREAD`/`DURABLE_THREAD`/`threadWithSecret` 통합 팩토리 — 결합도 상승 대비 이득 낮음.

**선택 사항 (원한다면, 비차단)**:
- `STATUS_PROJECTION_COLUMNS` JSDoc 에 "TypeORM `FindOptionsSelectByString` 이 mutable 타입이라 `readonly`/`as const` 불가" 한 줄 추가 — 향후 "readonly 로 개선"하려는 시도의 시행착오를 예방.
- (선택) `Object.freeze(STATUS_PROJECTION_COLUMNS)` 별도 statement 추가로 런타임 방어 — 관측된 위험이 이론적 수준이라 필수 아님.

## 요약

직전 리뷰의 W-2(projection SoT/침묵 회귀)와 W-4(Promise.all 주석 부정확) 지적은 이번 fix 로 **실측 검증상 완전히 해소**됐다 — 컬럼명 오기는 실제로 `TS2820`/`TS2322` 컴파일 에러로 차단되고(직접 재현 확인), `Promise.all` 주석의 "왕복 depth 2 유지·쿼리 수만 2→3" 서술도 실제 코드 흐름과 정확히 일치한다(직접 재계산 확인). 남은 잔여 항목은 모두 INFO 수준으로, 그중 가장 의미 있는 것은 (1) "DTO 필드 추가 시 select 갱신 누락"이라는 원천적으로 완전히 막을 수는 없는 잔여 위험이 JSDoc 에 정직하게 문서화돼 있다는 점(양호), (2) 테스트가 구현 상수를 import 하지 않고 독립 재기술한 선택이 겉보기엔 "SoT 중복"처럼 보이지만 실제로는 이 PR 이 막으려는 회귀 클래스를 검출하기 위한 **의도적으로 옳은 설계**라는 점(직전 리뷰 권고를 본 리뷰가 정정)이다. `readonly` 미적용은 TypeORM 타입 제약에 따른 불가피한 선택임을 직접 검증했으나 그 근거가 코드에 남아있지 않은 점은 사소한 문서화 공백으로, 실질 위험도는 낮아 비차단이다. Blocking 사유 없음.

## 위험도

NONE
