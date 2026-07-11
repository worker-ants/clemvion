# 유지보수성(Maintainability) 리뷰

대상: `git diff 1682777fe..HEAD` (2 commits: `964e887af` EIA getStatus context 닫힌 union화, `428134b64` spec-link-integrity 코드베이스 확장)

## 발견사항

### 관점 (1) — `WaitingContext`/`ButtonsContext`/`NodeOutputContext` 크로스패키지 동명이형(homonym)

- **[INFO]** 구조적으로는 acceptable — 다만 자동 정합 가드가 없다.
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts:118-153`(`WaitingContextBase`/`ButtonsContext`/`NodeOutputContext`/`WaitingContext`) vs `codebase/packages/sdk/src/client.ts:109-141`(동일 이름 4개 타입), 원본 SoT `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:91-143`(`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`, 이번 diff 밖 — 이미 존재).
  - 상세: 이 패턴은 이 diff 가 처음 도입한 것이 아니라 코드베이스 전반의 기존 컨벤션이다 — `ChatChannelConfig`(`codebase/backend/src/modules/chat-channel/types.ts`)류의 타입도 "SoT: backend DTO, 여기는 미러" 식 JSDoc 주석 컨벤션을 쓴다. 두 타입 정의 모두 "backend `WaitingContextBaseDto`(...) 를 미러한다" 로 명시적으로 SoT 를 밝히고 있어 우발적 동명이형이 아니라 **의도된 문서화된 미러**다. `channel-web-chat`(별도 Next.js CSR SPA)와 `packages/sdk`(독립 배포 npm 패키지)가 backend 의 NestJS/class-validator 의존성 체인을 끌어오지 않으려는 아키텍처적 이유도 합리적이다.
  - 다만 `ExecutionStatus` 선례(`frontend/src/lib/stores/execution-store.ts` vs `frontend/src/lib/api/executions.ts`)를 직접 대조해보면 이미 **실제 drift 가 발생해 있다**: `execution-store.ts` 의 `ExecutionStatus` 유니온은 `"idle" | "running" | "completed" | "failed" | "waiting_for_input"` 5값인데 `executions.ts` 쪽은 `"pending" | "running" | "completed" | "failed" | "cancelled" | "waiting_for_input"` 6값이다(`pending`/`cancelled` 유무 불일치). 이는 "SoT 주석 + 링크만으로 3-site 동기화 유지"가 이 코드베이스에서 이미 실패한 전례가 있다는 뜻이며, 이번 3-way 미러(backend DTO / widget / SDK)도 동일 리스크에 노출된다.
  - 제안: 이번 diff 자체를 되돌릴 필요는 없음(구조적 이유가 명확). 다만 backend DTO 필드가 바뀌면 widget/SDK 를 놓치지 않도록, 이 프로젝트에 이미 있는 "interaction-type-registry 3중 동반갱신" 패턴처럼 최소한의 구조적 회귀 가드(예: 3-site 의 키 집합을 비교하는 경량 유닛 테스트, 또는 JSDoc 에 "동반 갱신 대상: backend DTO / widget / SDK 3곳" 명시)를 고려. Blocking 은 아님.

### 관점 (2) — `NodeOutputContext.nodeOutput` 타입 비대칭 (widget: indexed access / SDK: `Record<string, unknown>`)

- **[INFO]** 비대칭은 justified — 단, 재사용 방식에 미세한 타입 허점이 있음.
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts:154-156`(`nodeOutput: WaitingForInputEvent["nodeOutput"]`) vs `codebase/packages/sdk/src/client.ts:127-129`(`nodeOutput: Record<string, unknown>`).
  - 상세: widget 은 `parseWaitingForInput` 이 `nodeOutput.formConfig`/`nodeOutput.conversationConfig`/인덱스 시그니처까지 실제로 소비하므로 `WaitingForInputEvent["nodeOutput"]` 재사용(단일 SoT, DRY)이 타당하다. SDK 는 `client.spec.ts` 주석대로 "SDK 는 context 를 소비하지 않는다(getStatus 반환만)"이므로 굳이 세부 필드를 알 필요가 없어 `Record<string, unknown>` 이 적절 — standalone 패키지가 위젯 전용 파싱 지식(`formConfig`/`conversationConfig` 등)을 끌어안을 이유가 없다. 이 근거는 `client.spec.ts` 쪽에는 있지만 `client.ts` 타입 선언 옆에는 없어, 향후 "왜 SDK 만 얕은 타입이냐"는 재질문이 반복될 여지는 있다(사소함, INFO).
  - **타입 허점**: `WaitingForInputEvent["nodeOutput"]` 는 소스 프로퍼티가 optional(`nodeOutput?: {...}`)이라 인덱스드 액세스 결과에 `| undefined` 가 자동 포함된다(`tsc --strict` 로 직접 검증: `{ nodeOutput: undefined }` 가 `NodeOutputContext` 에 캐스트 없이 대입 가능). 즉 `nodeOutput` 키 자체는 필수(`?` 없음)이지만 그 **값**은 `undefined` 를 허용해버려, "이 변형은 nodeOutput 이 항상 실값으로 존재한다"는 타입의 의도가 완전히 강제되지 않는다. 실무 영향은 낮음(백엔드가 실제로 undefined 를 보내지 않음)이나, 재사용형 인덱스드 액세스 타입을 가져다 쓸 때 흔히 놓치는 함정이다.
  - 제안: `NonNullable<WaitingForInputEvent["nodeOutput"]>` 로 감싸거나, 최소한 주석으로 "값은 항상 present, 인덱스드 액세스가 부수적으로 `| undefined` 를 포함함은 알고 있음"을 남기면 향후 리뷰어의 재질문을 줄일 수 있음. Blocking 은 아님.

### 관점 (3) — "discriminator 아닌 키 존재로 분기" JSDoc 위치·명확성

- **[INFO]** 위치·명확성 모두 우수 — 향후 discriminator 를 추가하려는 개발자가 반드시 마주칠 자리에 있다.
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts:159-167`(`WaitingContext` 타입 선언 바로 위) / `codebase/packages/sdk/src/client.ts:131-138`(동일 위치) / 원본 `responses.dto.ts:145-151`(`ExecutionStatusDto` 클래스 바로 위, `context` 필드 선언 위 `:190` 에도 재차 경고).
  - 상세: 세 곳 모두 "판별자 없는 닫힌 2-variant union"이라는 문구로 시작해, `WaitingContext = ButtonsContext | NodeOutputContext` **바로 위**(union 정의 자리)에 있다. 향후 개발자가 "discriminated union 이 아니니 리팩터해서 discriminator 를 추가하자"고 시도한다면 정확히 이 union 선언을 편집하게 되므로, 주석을 놓칠 가능성이 낮다. 게다가 이번 diff 가 추가한 회귀 테스트(`eia-events.test.ts` `"union 은 키 존재로 분기 — interactionType 은 판별자가 아님(회귀 가드)"`, `client.spec.ts` `"키 존재로 분기 — buttons 도 nodeOutput 변형으로 fallthrough 타입된다"`)가 "discriminator 였다면 tsc red" 라는 실행 가능한 근거까지 남겨, 문서 주석보다 강한 컴파일-타임 가드 역할을 한다. 문서+테스트 이중 방어로 우수한 사례.

### 관점 (4) — `spec-links.ts` 신규 함수 네이밍·중복

- **[WARNING]** `findBrokenSpecLinksInSources` 가 `findBrokenLinks` 와 로직 스켈레톤을 거의 그대로 복제.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:167-236`(기존 `findBrokenLinks`) vs `:292-340`(신규 `findBrokenSpecLinksInSources`).
  - 상세: 두 함수 모두 "파일 목록 순회 → `extractLinks` → path/anchor 분리 → `path.resolve` → 존재하지 않으면 DEAD push → 존재하면 `slugCache` 로 heading slug 대조해 ANCHOR push → 마지막에 `source`/`line` 기준 정렬" 이라는 동일 골격을 ~40줄 그대로 반복한다. 차이는 오직 (a) 순수 동일-파일 앵커(`target.startsWith("#")`) 처리 유무, (b) `SPEC_MD_TARGET_RE` 로 대상 필터링 유무, (c) 앵커 검사 게이트가 `.md` 확장자 조건부(`findBrokenLinks`) vs 무조건(신규, 이미 필터로 `.md` 만 통과했으므로) 뿐이다. `slugCache` 선언·`violations.sort(...)` 마무리 블록은 문자 그대로 동일하다.
  - 이런 clone-and-tweak 패턴은 향후 DEAD/ANCHOR 판정 로직을 한쪽만 고치고 다른 쪽을 놓칠 위험(더블 메인터넌스)을 만든다. 예: `decodeAnchor` 적용 누락, 정렬 기준 변경, external-link 판정 로직 변경 등이 한쪽에만 반영되기 쉬움.
  - 제안: 공통 코어(예: `resolveLinkViolations(files: SpecMdFile[], opts: { checkSelfAnchor: boolean; targetFilter: (pathPart: string) => boolean })`)로 추출하고 `findBrokenLinks`/`findBrokenSpecLinksInSources` 를 얇은 wrapper 로 만들면 ~40줄 중복이 사라진다. 테스트 인프라 코드라 당장 blocking 은 아니지만, 이번 PR 에서 발생한 신규 중복이라 지금 정리하는 편이 이후 3번째 변형이 생기기 전에 저렴하다.
- **[WARNING]** `collectCodebaseSources` 의 반환 타입이 `SpecMdFile[]` — 이름이 내용과 불일치.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:260`(`export function collectCodebaseSources(root: string): SpecMdFile[]`).
  - 상세: `SpecMdFile` 인터페이스(`:117-120`)는 원래 "markdown 파일" 을 위한 이름(`Spec` + `Md` + `File`)인데, `collectCodebaseSources` 는 `.ts`/`.tsx` 소스 파일 목록을 이 타입으로 반환한다. 구조(`{ absPath, relPath }`)는 재사용 가능하지만, 타입 이름 자체가 "이 값은 markdown 파일이다"라고 잘못 암시한다. `findBrokenSpecLinksInSources` 내부에서 `const files = collectCodebaseSources(root)` 로 받은 뒤 `f.absPath`/`f.relPath` 를 쓰는 코드만 보면 "왜 소스코드 목록이 `SpecMdFile` 이지?" 하는 순간적 혼란을 줄 수 있다.
  - 제안: 구조 재사용은 유지하되 이름만 일반화(`RepoFile`/`SourceFile` 로 rename 하고 `SpecMdFile` 을 그 alias 로 두거나, 반대로 `type SpecMdFile = RepoFile` 로 정리). 작은 리네임이라 비용은 낮음. Blocking 은 아니나 다음에 이 타입을 세 번째 스캐너가 재사용할 때 혼란이 누적되기 전에 정리 권장.

### 관점 (5) — `SPEC_MD_TARGET_RE`/`CODEBASE_SOURCE_ROOTS`/`CODEBASE_SKIP_DIRS` 가독성

- **[INFO]** 세 상수 자체는 이름·정규식 모두 읽기 쉽다. `SPEC_MD_TARGET_RE = /(^|\/)spec\/.+\.md$/` 는 바로 위 주석("A relative link whose path part targets a spec markdown file")과 함께 있어 왜 이 형태(`(^|\/)` 로 경로 세그먼트 경계를 강제)인지 이해하기 쉽다. `CODEBASE_SKIP_DIRS`(`node_modules`/`dist`/`build`/`.next`)도 자명하다.
- **[WARNING]** `CODEBASE_SOURCE_ROOTS` 가 `codebase/frontend/src` 를 누락 — 가드의 실효 커버리지 공백.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:250-254`.
  - 상세: `CODEBASE_SOURCE_ROOTS = ["codebase/backend/src", "codebase/channel-web-chat/src", "codebase/packages"]` 로 `codebase/frontend/src` 가 빠져 있고, 이를 설명하는 주석이 없다. 그런데 프런트엔드에는 실제로 이 가드가 잡으려는 것과 똑같은 클래스의 링크가 존재한다 — 예: `codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx:130` 의 `[Spec AI Common §11](../../../../../../spec/4-nodes/3-ai/0-common.md)` (수동 `../` depth 카운팅). 이 링크는 현재는 우연히 유효(파일·앵커 모두 존재 확인함)하지만, 향후 이 파일이 이동하거나 `../` depth 가 틀리게 편집돼도 이 가드가 전혀 잡아내지 못한다 — 정확히 이 PR 의 목적("hand-counted `../` depth 가 조용히 drift")이 프런트엔드에서만 무방비로 남는다. `codebase/frontend` 는 파일 수 기준 이 monorepo 에서 가장 큰 애플리케이션 영역이라 공백의 실질 리스크가 작지 않다.
  - 제안: `codebase/frontend/src` 를 `CODEBASE_SOURCE_ROOTS` 에 추가하거나(가장 단순한 수정), 의도적으로 제외한 것이라면 이유(예: "프런트엔드는 별도 plan/추후 PR 로 커버 예정")를 상수 옆 주석으로 남길 것. 현재는 근거 없는 스코프 축소로 읽혀 다음 리뷰어가 반복 재질문할 소지가 크다.

### 그 외 일반 관찰 (양호)

- `codebase/backend/src/modules/chat-channel/types.ts` 등 3개 backend 파일의 diff 는 전부 `../` depth 정정(순수 링크 경로 수정)으로, 이번에 추가된 codebase-source 가드가 실제로 존재하던 drift 를 잡아낸 증거다 — 가드의 가치를 뒷받침한다.
- `codebase/channel-web-chat/src/widget/use-widget.ts` 의 변경은 `as WaitingForInputEvent` 캐스트를 제거하고 정적 타입 체크로 대체한 순수 개선이며, `WaitingForInputEvent` import 는 다른 곳(`:149`)에서 계속 쓰이므로 dead import 도 아니다.
- `eia-events.test.ts`/`client.spec.ts` 의 신규 테스트들은 함수 길이·중첩 모두 적절하고, 기존 파일의 `describe`/`it` 네이밍·한국어 주석 컨벤션과 일관된다.
- 신규 함수(`collectCodebaseSources`, `findBrokenSpecLinksInSources`)는 개별적으로는 각각 24줄/48줄로 길지 않고 중첩도 얕아(스택 기반 DFS + 단일 for 루프) 순환 복잡도 문제는 없음 — 위 (4)의 지적은 "중복" 문제이지 "복잡도" 문제는 아님.

## 요약

이번 diff 는 EIA `getStatus.context` 를 위젯·SDK 양쪽에서 `as` 캐스트 없는 닫힌 2-variant union 으로 정밀화하고, 그 타입 계약("판별자 아닌 키 존재로 분기")을 컴파일 타임 테스트로 고정했으며, 부수적으로 발견된 backend JSDoc 의 `../` 경로 drift 를 잡아내는 codebase-source 링크 가드를 신설했다. 타입 설계·문서화(특히 discriminator 경고의 위치와 회귀 테스트)는 이 규모의 크로스패키지 미러 작업치고 상당히 신중하며, 기존 코드베이스의 "SoT 주석 + 미러" 컨벤션과도 일관된다. 다만 (a) 신설된 `findBrokenSpecLinksInSources`/`collectCodebaseSources` 가 기존 `findBrokenLinks`/`collectSpecMarkdown` 의 스켈레톤을 상당 부분 복제하고 있어 공통 코어로 추출할 여지가 뚜렷하며, (b) 반환 타입 `SpecMdFile[]` 을 소스코드 파일에 재사용한 네이밍이 혼란을 줄 수 있고, (c) 정작 파일 수가 가장 많은 `codebase/frontend/src` 가 신설 가드의 스캔 대상에서 근거 없이 빠져 있어 가드의 실효 커버리지에 공백이 있다. 세 항목 모두 blocking 은 아니지만, 가드 신설이라는 작업의 취지(spec-link drift 방지)를 고려하면 (c) 는 비교적 이른 시일 내 후속 조치가 바람직하다.

## 위험도

LOW
