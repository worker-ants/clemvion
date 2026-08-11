# 유지보수성(Maintainability) Review — 재검토

직전 라운드(`review/code/2026/08/11/15_16_20/maintainability.md`)에서 낸 **WARNING**(`safeApiBaseFromQuery` `@deprecated` 위임의 "기존 호출부(테스트 포함) 호환" 근거가 실측 소비처 1곳과 어긋남)에 대한 처분(`d8abc7003`)을 확인한다.

## 리뷰 대상

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `safeApiBaseFromQuery` 삭제, `bridge.onBoot` 호출부의 불필요 캐스트 제거
- `codebase/channel-web-chat/src/widget/use-widget.test.ts` — `describe` 이름 변경 + 호출부 7곳 치환, `as never` → `Partial<BootMessage>`
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 신규 통합 테스트 2건(`wc:boot` 호출부 배선 회귀)

### 확인 항목별 결과

**1. 삭제 완결성 — 잔존 참조 0.**
`grep -rn "safeApiBaseFromQuery" codebase/` 결과 0건. `use-widget.ts:197`(구 `export function safeApiBaseFromQuery` 자리)는 `export function safeApiBase(raw, source)` 로 완전히 대체됐고, `@deprecated` 위임 함수 자체(7줄)가 삭제됐다. 남은 참조는 코드가 아니라 **역사 문서**뿐이다 — `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 "문제"/"관련" 섹션(라운드 1 이전의 원 상태를 서술)과 `spec/7-channel-web-chat/4-security.md` 의 `## Rationale` §R0(라운드 1의 반증을 "기각한 대안"으로 남긴 서술)에 옛 이름이 남아 있는데, 둘 다 **완료된 결정의 이력을 설명하는 서술**이라 삭제 대상이 아니다(오히려 지우면 "왜 바뀌었는가"가 사라진다). `spec/7-channel-web-chat/4-security.md` §1 표 자체(SoT 서술 행)는 `safeApiBase`/`configFromQuery`/`mergeBootConfig` 로 이미 갱신되어 있어 **현재형 서술에는 옛 이름이 남지 않았다**. 삭제는 완결됐다고 판단한다.

**2. 치환이 테스트 가독성을 해쳤는가 — 소폭의 반복이 생겼으나 감내할 수준.**
`describe("safeApiBase — 쿼리 경로", ...)`(`use-widget.test.ts:16`)로 이름을 바꾼 것은 이 파일의 기존 네이밍 컨벤션(`"함수명 — 설명"`, 예: `:65` `mergeBootConfig — boot 의 apiBase 도 스킴 검증을 거친다`, `:127`(구 `sseErrorDetail — 토큰 없이 진단 정보만`))과 정확히 일치하고, 바로 아래 `mergeBootConfig` describe 와 "쿼리 경로 vs boot 경로"로 대칭을 이뤄 오히려 구조가 더 명확해졌다.
다만 두 번째 인자 `"configFromQuery"` 리터럴이 7개 `it()` 각각에 반복된다(`use-widget.test.ts:20,23,27,32,37,42,47`). 바로 아래 `mergeBootConfig` describe(`:65-117`)는 같은 상황(반복되는 fixture 인자)을 로컬 헬퍼 `q`/`b`(`:70-71`)로 추출해 반복을 없앴는데, 이 블록은 그 패턴을 쓰지 않았다 — 같은 파일 안에서 두 개의 해법이 공존한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts:16-50`(전체 블록), 대조군 `:65-71`(`mergeBootConfig` 의 `q`/`b` 헬퍼)
  - 상세: 이 반복이 이해를 해치는 정도는 아니다 — 문자열이 짧고(`"configFromQuery"`), 각 `it()` 이 자기 완결적이라 테스트 하나만 복사해 다른 파일로 옮겨도 그대로 읽힌다는 이점도 있다(로컬 헬퍼로 감쌌다면 그 이점이 없다). WARNING 이 요구한 처분(별칭 삭제 + 직접 치환)은 정확히 이행됐고, 이 반복은 그 처분의 **부작용**이지 새로 만든 결함은 아니다.
  - 제안(선택적, 이 라운드의 필수 처분 대상 아님): `const q = (raw: string | null) => safeApiBase(raw, "configFromQuery");` 같은 로컬 래퍼로 7회 반복을 줄이면 바로 아래 블록과 스타일이 통일된다. 다만 위에서 언급한 자기완결성 트레이드오프가 있어 강제할 사안은 아니다.

**3. 신규 통합 테스트 2건의 위치·JSDoc — 파일 관례와 일치.**
`use-widget-eager-start.test.ts` 는 최상위 `describe("useWidget — <주제>", ...)` 블록들을 시간순으로 이어 붙이는 구조다(`grep` 확인: `:258` eager 시작 §R6 → `:1490` 종료(endConversation) → `:1857` 버퍼 만료 재동기화 → `:2050` 종료/staleness 가드 → 이번에 추가된 `:4216` `wc:boot` 스킴 검증). 새 블록은 그 마지막 자리(파일 최말단)에 형제 `describe` 로 추가됐고 이름도 `"useWidget — wc:boot 의 apiBase 스킴 검증(호출부 배선)"` 로 동일 네이밍 패턴을 따른다 — 위치·네이밍 모두 관례와 일치한다.
JSDoc 길이(11줄, `use-widget-eager-start.test.ts:4204-4215`)도 이 파일의 기존 밀도와 같은 급이다 — 예컨대 `PHASE_SCHEDULE_MS` 설명 블록(13줄, `:137-148`)이나 개별 `it()` 하나에 붙는 10~14줄짜리 "왜" 주석들(`:589-599`, `:646-656`, `:712-721`)과 대등하며, 이번 것은 그 분량으로 **2개 테스트**를 커버해 오히려 테스트당 밀도는 낮다. 내용도 "헬퍼만 지키고 호출부는 무방비였다"는 이번 라운드 고유의 근거(ai-review `15_16_20` testing CRITICAL 인용, 실측 수치 "204건")를 담고 있어, `use-widget.ts`/`use-widget.test.ts` 에 있는 "왜 boot 경로에도 거는가"(보안 근거) JSDoc 과는 내용이 겹치지 않는다 — 새로운 중복을 만들지 않았다.

**4. 직전 라운드 INFO 잔여 4건 — 이번 fix 의 영향.**
- `source: "configFromQuery" | "wc:boot"` 파라미터 설계(INFO) — 변경 없음. 이번 fix 는 이 설계를 그대로 유지했고, 삭제된 것은 그 설계를 우회하던 별도 함수(`safeApiBaseFromQuery`)뿐이다. 여전히 과설계로 보지 않는다.
- `mergeBootConfig` 를 `use-widget.ts` 에 남긴 배치(INFO) — 변경 없음. 이번 fix 의 범위 밖.
- `safeApiBase` JSDoc "왜 boot 경로에도 거는가" 단락과 `mergeBootConfig` describe JSDoc(`use-widget.test.ts:52-64`)의 내용 중복(INFO) — 변경 없음. 이번 fix 의 diff 는 이 블록들을 건드리지 않았다(치환 대상은 `safeApiBaseFromQuery` describe 뿐). 여전히 유효한 관찰이지만 이번 라운드의 처분 대상은 아니었다.
- `bridge.onBoot` 콜백의 불필요한 캐스트(INFO, "선택적" 제안) — **해소됨.** `use-widget.ts:1336` 이 `runApplyConfig(mergeBootConfig(configFromQuery(), c as Partial<BootMessage>))` 에서 `runApplyConfig(mergeBootConfig(configFromQuery(), c))` 로 바뀌어 캐스트가 완전히 사라졌다. 선택 사항이었음에도 함께 처리됐다.
- (부수적으로, WARNING 처분 커밋 메시지에 언급된) 테스트 fixture `as never` → `Partial<BootMessage>`(`use-widget.test.ts:70-71,111-112`) — 이 항목은 직전 라운드에서 "새 CRITICAL 아님, 기존 컨벤션을 따른 선택"으로 이미 INFO 조차 아니었던 관찰인데, 이번 fix 가 구조적 타입 검사를 되살리는 방향으로 선제 개선했다. 요구되지 않은 개선이라 가점 요인으로만 기록한다.

새 CRITICAL 은 없다. 새 WARNING 도 없다.

### 요약

직전 라운드 WARNING(거짓 근거로 남긴 `@deprecated` 별칭)은 요구한 대로 정확히 처분됐다 — 별칭은 완전히 삭제됐고 코드 내 잔존 참조는 0건이며(역사 문서에 남은 옛 이름은 완료 이력 서술이라 문제 없음), 테스트 호출부 7곳은 `safeApiBase(raw, "configFromQuery")` 로 치환됐다. `describe` 이름도 파일의 기존 "함수명 — 설명" 컨벤션과 정확히 맞아떨어진다. 유일한 트레이드오프는 리터럴 `"configFromQuery"` 가 7개 `it()` 에 반복되는 것인데, 바로 아래 블록이 쓰는 로컬 헬퍼 패턴과 스타일이 갈리긴 하나 가독성을 해칠 정도는 아니라 INFO 로만 남긴다. 신규 통합 테스트 2건은 위치·네이밍·JSDoc 밀도 모두 이 파일의 기존 관례와 일치하고 내용 중복도 없다. 직전 라운드 INFO 4건 중 3건은 이번 fix 의 범위 밖이라 그대로 유효하고(변경 없음), 1건(불필요 캐스트)은 요청받지 않았음에도 해소됐다. 종합적으로 이번 처분은 깨끗하며 유지보수성 관점에서 추가 조치가 필요한 새 결함은 없다.

### 위험도

NONE

STATUS: OK
