# 유지보수성(Maintainability) Review

## 리뷰 대상

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `safeApiBase`/`safeApiBaseFromQuery`/`mergeBootConfig` 신설·일반화, `bridge.onBoot` 배선 교체
- `codebase/channel-web-chat/src/widget/use-widget.test.ts` — `mergeBootConfig` 회귀 6케이스 추가

### 발견사항

- **[WARNING]** `safeApiBaseFromQuery` 의 `@deprecated` 위임 — 실측하면 소비처가 **테스트 파일 1곳뿐**이고, 그 테스트 파일 자체를 이번 PR 이 이미 편집한다. "기존 호출부(테스트 포함) 호환" 이라는 근거가 실측과 어긋난다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:212-218`(`@deprecated` 위임 정의). 소비처는 `codebase/channel-web-chat/src/widget/use-widget.test.ts:2`(import)와 `:19,22,26,31,36,41,46`(7회 직접 호출) 뿐 — repo 전체 grep(`grep -rln safeApiBaseFromQuery` 프로덕션 코드 대상)으로도 이 두 파일 밖 소비처는 0건이다. `channel-web-chat/package.json` 은 `"private": true`(외부 배포 패키지 아님)이므로 "외부 계약 보호용 하위호환" 논리도 적용되지 않는다.
  - 상세: 이 저장소는 바로 직전 PR(#1146, `refactor(docs-guard): 손수 짠 DFS 여섯 벌을 walkTree 하나로`)에서 정확히 같은 패턴을 WARNING 으로 지적받았다(`review/code/2026/08/11/13_51_44/maintainability.md:29-32` — `SpecMdFile` 을 "외부 호출부 6곳" 근거로 `@deprecated` 별칭으로 남겼으나 실측 소비처는 0곳). 이번 건은 그보다는 소비처가 1곳(테스트 파일) 있어 완전히 동일하진 않지만, 그 1곳이 **이 PR 자신이 같은 커밋에서 이미 손대는 파일**이라는 점에서 "위임을 남겨야 호환이 깨지지 않는다"는 정당화가 성립하지 않는다 — `import` 줄(`use-widget.test.ts:2`)에 `mergeBootConfig` 를 추가하면서 바로 옆의 `safeApiBaseFromQuery` 를 `safeApiBase(raw, "configFromQuery")` 로 바꿔치는 것도 같은 diff 안에서 가능했다.
  - 제안: 테스트의 7회 호출부를 `safeApiBase(raw, "configFromQuery")` 로 치환하고 `safeApiBaseFromQuery` export 자체(`use-widget.ts:212-218`, 7줄)를 삭제한다. 정말 외부 재사용을 예상해 남기고 싶다면 JSDoc 근거를 "테스트 포함 기존 호출부 호환"이 아니라 "이 심볼은 현재 프로덕션 소비처가 없으나 X 이유로 표면을 유지한다"처럼 실측과 일치하는 문구로 정정할 것.

- **[INFO]** `safeApiBase` 의 `source: "configFromQuery" | "wc:boot"` 파라미터 — 과설계로 보이지 않는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197-199`
  - 상세: 호출부는 정확히 둘(`configFromQuery` 내부 `:224`, `mergeBootConfig` 내부 `:244`)이고, 리터럴 값도 정확히 그 둘과 1:1 대응한다. `"wc:boot"` 는 임의 문자열이 아니라 `wc-protocol.ts` 의 `WcMessageType`(`"wc:boot" | "wc:command" | ...`)에 이미 있는 실제 프로토콜 리터럴과 동일한 어휘를 재사용한 것이라 이름이 새로 만들어진 것도 아니다. 리터럴 유니온이 있어 향후 세 번째 호출부가 생겨도(그럴 경우 `source` 오타를 컴파일 타임에 잡는다) 이점이 있고, 지금 2값이라고 `string` 으로 넓히면 그 방어가 사라진다. 과한 추상화라기보다 호출부 수에 비례한 적정 설계로 판단한다.

- **[INFO]** `mergeBootConfig` 를 `use-widget.ts` 에 그대로 둔 것은 이 파일이 과거에 확정한 "God hook 분리" 경계와 충돌하지 않는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:236-247`(`mergeBootConfig`), 같은 파일의 `sseErrorDetail`(`:263-270`)·`shouldAbortAfterSeed`(`:142-144`)가 선례.
  - 상세: `plan/complete/webchat-usewidget-split.md`(B1 God hook 분리)의 추출 기준은 **ref/타이머/effect 를 가진 상태형 hook 로직**(`use-token-refresh.ts`·`use-pending-message-queue.ts`)이었고, "쿼리 문자열을 검증/병합하는 순수 함수"는 대상이 아니었다 — 실제로 `sseErrorDetail`·`shouldAbortAfterSeed`·`safeApiBase`(변경 전부터) 같은 순수 헬퍼는 그 분리 이후에도 계속 이 파일에 남아 있다. `mergeBootConfig` 도 `useRef`/`useCallback` 등 hook 상태에 전혀 의존하지 않는 순수 함수라 같은 카테고리다. 다만 파일이 이미 1425줄이고 이번 PR 로 apiBase 관련 순수 헬퍼(`safeApiBase`/`safeApiBaseFromQuery`/`configFromQuery`/`mergeBootConfig`, 총 4개, `use-widget.ts:166-247`)가 한 군데 뭉쳐 있다는 점에서, `boot-config.ts` 같은 별 모듈로 뽑아내는 것도 다음 확장 시점의 후보로 남겨둘 만하다 — 지금 이 PR 규모(순 추가 약 40줄)에서 강제할 결함은 아니다.

- **[INFO]** `safeApiBase` JSDoc 자체는 이 파일의 기존 문서화 밀도에 비춰 과하지 않지만, `wc:boot` 확대 근거 단락이 테스트 파일의 신규 `describe` JSDoc 과 거의 동일한 내용으로 중복된다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:172-192`("## 왜 boot 경로에도 거는가" 단락) vs `codebase/channel-web-chat/src/widget/use-widget.test.ts:51-63`(`describe` 위 JSDoc)
  - 상세: 두 블록 모두 "SDK 는 apiBase 를 양쪽(쿼리+boot)으로 보낸다" · "병합이 `{...query, ...boot}` 라 boot 이 나중에 덮는다" · "그래서 쿼리 검증이 무력화된다" 라는 동일한 2단 논증을 각자 다른 문장으로 반복한다. 서로를 가리키는 교차 참조가 없다. 이 파일은 같은 성격의 중복(TDZ 우회 근거가 `:1142`·`:1444-1446` 두 곳에 반복 서술된 것)을 이전 라운드에서도 INFO 로 지적받은 이력이 있다(`review/code/2026/07/17/01_42_44/maintainability.md:15-17`) — 이번 것도 그때와 같은 등급(INFO)으로 본다. `safeApiBase` JSDoc 자체의 길이(함수 본문 14줄 대비 주석 약 30줄)는 `SeedOutcome`(`:84-111`)·`shouldAbortAfterSeed`(`:113-141`) 등 이 파일에 이미 존재하는 훨씬 긴 "왜" 문서화와 같은 밀도이고, 보안 결정의 근거·과거 비대칭의 실제 무력화 경로·참조 파일(`bridge.ts`/`index.ts`)까지 구체적으로 추적 가능해 정보 밀도가 낮지 않다 — 이 저장소가 반복 지적받는 "의미 없는 주석 비대화"와는 다르다고 판단한다. 다만 병합 순서 논증처럼 **동작이 바뀌면 두 파일을 모두 고쳐야 하는 서술**은 한쪽이 다른 쪽을 참조하도록 정리하면 drift 위험이 준다.
  - 제안: 둘 중 한쪽(예: 테스트 파일)의 논증 단락을 "자세한 근거는 `safeApiBase`/`mergeBootConfig` JSDoc 참고" 로 축약하고 교차 참조만 남긴다.

- **[INFO]** `bridge.onBoot` 콜백의 `c as Partial<BootMessage>` 캐스팅은 불필요해 보인다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1344`
  - 상세: `onBoot(cb: (config: BootMessage) => void)`(`host-bridge.ts:27`) 시그니처상 `c` 는 이미 `BootMessage` 이고, `BootMessage` 는 구조적으로 `Partial<BootMessage>` 의 서브타입이라 별도 단언 없이도 `mergeBootConfig(configFromQuery(), c)` 로 대입 가능하다. 동작에 영향은 없으나 불필요한 타입 단언은 "여기 뭔가 안 맞는 게 있어 캐스팅했다"는 오해를 줄 수 있다.
  - 제안: `c as Partial<BootMessage>` → `c` 로 단순화(선택적).

- **[INFO]** 테스트 fixture 헬퍼 `q`/`b` 가 `as never` 로 반환 타입을 지운다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts:67-68`, `:108-109`
  - 상세: `{ apiBase, triggerEndpointPath: "/t" } as never` 는 `BootMessage` import 없이 `Partial<BootMessage>` 자리에 끼워 넣기 위한 총체적 타입 소거다. 같은 파일 스위트(`use-widget-eager-start.test.ts:2492`)와 `i18n/context.test.tsx:25`에도 동일 관용구가 있어 이 코드베이스에서 낯선 패턴은 아니지만(일관성 관점에서는 문제 없음), fixture 필드명 오타(`triggerEndpointPath` → `triggerEndpoint` 등)를 컴파일 타임에 잡아주지 못한다는 트레이드오프가 있다. 새 CRITICAL 은 아니고, 기존 컨벤션을 따른 선택으로 본다.

새 CRITICAL 은 없다.

### 요약

핵심 변경(`safeApiBase` 일반화 + `mergeBootConfig` 신설)은 함수 길이·중첩·매직넘버·복잡도 면에서 깨끗하고, 순수 함수를 `use-widget.ts` 에 남긴 것도 이 파일이 과거에 확정한 "상태형 hook 만 분리한다"는 God-hook 경계와 어긋나지 않는다. 유일하게 실체가 있는 지적은 `safeApiBaseFromQuery` 의 `@deprecated` 위임인데, 실측하면 소비처가 이 PR 이 이미 편집 중인 테스트 파일 1곳뿐이라 "기존 호출부 호환" 근거가 약하다 — 바로 직전 PR(#1146)이 같은 클래스의 문제로 WARNING 을 받은 전례가 있어 같은 기준으로 WARNING 처리했다. 나머지(`source` 파라미터 설계, JSDoc 길이, boot 확대 근거의 프로덕션/테스트 파일 간 중복, 불필요한 타입 단언, `as never` fixture)는 전부 INFO 급 관찰이며, 특히 JSDoc 길이 자체는 이 파일의 기존 문서화 밀도와 일치해 "정당화되지 않는 주석 비대화"로 보지 않는다.

### 위험도

LOW

STATUS: OK
