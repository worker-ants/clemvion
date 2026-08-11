# 부작용(Side Effect) Review — 리뷰 라운드 2 (직전 INFO 처분 검증)

## 검증 방법

정적 리뷰 + 실측. 직전 라운드(`15_16_20`)가 낸 side_effect INFO(`applyConfig` 조용한
early return + §R0 거짓 서술)의 처분 커밋(`d8abc7003`)을 `git show`로 정확히 뜯어보고,
실제 소스(`applyConfig`, `4-security.md §R0`, `webchat-auth-session-status-reconcile.md`)를
`Read`로 직접 대조했다. 또한 이 저장소 전체(`review/`·`plan/` 제외 코드 트리)에서
`safeApiBaseFromQuery` 잔존 참조를 전수 grep 하고, 관련 유닛 스위트 전체와 `tsc --noEmit`
을 재실행해 처분이 회귀를 만들지 않았음을 실측으로 확인했다.

```
$ grep -rn "safeApiBaseFromQuery" codebase/ packages/   → 0 hits (packages/ 자체가 없음, codebase/ 는 0)
$ grep -rn "safeApiBaseFromQuery" . (전체, node_modules 제외) → review/*.md·plan/*.md(이력 문서) 뿐, 코드 0
$ npx tsc --noEmit -p codebase/channel-web-chat  → 오류 0
$ npx vitest run (channel-web-chat 전체)         → Test Files 23 passed / Tests 450 passed (450)
```

## 발견사항

- **[INFO]** §R0 정정문 — `applyConfig` 실제 코드와 대조해 **정확함을 확인**
  - 위치: `spec/7-channel-web-chat/4-security.md` §R0(`### R0.` 헤딩 아래 "**진단은 거절 지점에만 있다.**" 인용구 단락), 대응 코드는 `codebase/channel-web-chat/src/widget/use-widget.ts` `applyConfig` 정의 내부 첫 줄(`const applyConfig = async (cfg: BootMessage) => { if (!cfg.apiBase || !cfg.triggerEndpointPath) return; ...`).
  - 상세: 정정문은 "`if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` 은 `warn`도 `dispatch`도 없이 조용히 빠진다"고 서술한다. `Read`로 해당 줄을 직접 열어 대조한 결과 문자 그대로 일치 — 그 줄 앞뒤 어디에도 `console.warn`·`dispatch` 호출이 없다. 정정문이 함께 지목한 "바로 아래 자매 분기(origin allowlist 실패)가 `BLOCKED`를 dispatch하는 것과 비대칭"도 코드와 일치한다(`if (!allowed) { dispatch({ type: "BLOCKED", reason: "origin_not_allowed" }); return; }`가 정확히 다음 블록). 직전 라운드가 지적한 거짓 서술("`applyConfig`가 자기 자리에서 실패해 진단이 그쪽에 모인다")은 이번 정정문에서 완전히 제거됐고, 새 문장이 실제 침묵 동작을 정확히 반영한다. 재발 없음.
  - 제안: 없음.

- **[INFO]** `webchat-auth-session-status-reconcile.md` 등재 — 같은 축(관측 갭) 추적 문서가 맞고, 서술도 정확함
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md`(신규 절 `## \`applyConfig\` 의 조용한 early return (2026-08-11, \`15_16_20\` side_effect INFO)`)
  - 상세: 이 plan 문서는 이미 같은 파일(`use-widget.ts`)의 여러 "관측 불가/무신호" 계열 갭을 같은 축으로 추적하고 있다 — 예: "§주기 갱신이 terminal 을 만나도 세션을 정리하지 않는다"(silent state), "§catch 분기 세대 재검사 미검증"(silent branch), "§refresh 동시 발화 경합"(silent race). 신설 절은 그 옆에 자연스럽게 들어맞고, 상단 요약표에도 새 행이 추가돼 있어 "전부 닫히면 complete로" 규약과도 맞물린다. 본문의 코드 인용(`if (!cfg.apiBase || !cfg.triggerEndpointPath) return;`)도 실제 코드와 정확히 일치하고, "이 하드닝이 도달 빈도를 넓혔을 뿐 새 침묵을 만들지 않았다"는 인과관계 서술도 §R0과 정합적으로 동일하다. 체크리스트 3항(도달 경로 전수 조사 / 신호화 / 회귀 고정)은 실행 가능한 후속 작업으로 적절히 분해돼 있다.
  - 제안: 없음.

- **[INFO]** 별칭(`safeApiBaseFromQuery`) 완전 삭제 — 런타임 동작 불변, 외부 소비처 없음(전수 확인)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — 삭제된 자리는 `export function safeApiBase(...)` 정의(197행대) 직후였던 `@deprecated` 위임 블록(이번 diff의 `-` 줄, 새 파일엔 존재하지 않음). 치환 호출부: `codebase/channel-web-chat/src/widget/use-widget.test.ts`(`safeApiBase(...)` 호출 7곳, `grep -c` 실측 일치).
  - 상세: 직전 라운드가 지목한 "@deprecated 위임을 남긴 근거(기존 호출부 호환)가 반증됐다"는 지적에 따라 별칭 자체를 삭제하고 유일한 소비처인 테스트 파일 7곳을 신 이름으로 치환했다. 저장소 전체(`codebase/**`뿐 아니라 `.md` README·데모 포함)를 `safeApiBaseFromQuery`로 grep한 결과, 남은 참조는 전부 `review/**`·`plan/complete/**`의 과거 리뷰·완료 plan 이력 문서(이 PR이 새로 추가한 `plan/complete/webchat-boot-apibase-scheme-validation.md` 자신 포함)뿐이고, 실행되는 코드·다른 패키지(`codebase/packages/web-chat-sdk` 등)·데모·README 어디에도 없다. 이 저장소엔 `packages/` 최상위 디렉터리 자체가 없어(모노레포 구조상 `codebase/packages/`) 오탐 우려도 배제했다. `tsc --noEmit`(오류 0)·전체 유닛 스위트(450/450 GREEN) 재실행으로 컴파일·런타임 양쪽 회귀 없음을 실측 확인. 다만 이 함수는 이전에 `export`돼 있던 공개 심볼이었으므로(비록 소비처가 없었더라도) 삭제 자체는 형식상 "인터페이스 축소"에 해당한다 — 이번 실측으로는 영향이 없다.
  - 제안: 없음(참고: 향후 이 계열 함수를 다시 `export`할 필요가 생기면, 소비처 존재를 먼저 실측하고 남길 것 — 이 PR이 반복 겪은 "반증된 별칭" 패턴).

- **[INFO]** production 코드의 캐스트 제거(`c as Partial<BootMessage>` → `c`) — 타입 안전, 런타임 무영향
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `bridge.onBoot((c) => { runApplyConfig(mergeBootConfig(configFromQuery(), c)); });` (호출부, `useWidget()` 내부).
  - 상세: `IframeBridge.onBoot`의 콜백 시그니처가 `(config: BootMessage) => void`(`host-bridge.ts` `interface IframeBridge`)이므로 `c`는 이미 `BootMessage`이고, `BootMessage`는 구조적으로 `Partial<BootMessage>`(더 넓은 타입)에 캐스트 없이 대입 가능하다. `tsc --noEmit`이 오류 0으로 통과해 이 제거가 실제로 안전함을 확인했다. 캐스트는 런타임에 완전히 소거되므로 이 변경은 타입 레벨에서만 의미가 있고 실행 동작에는 아무 영향이 없다.
  - 제안: 없음.

- **[INFO]** 테스트 헬퍼 `as never` → `Partial<BootMessage>` — **테스트 의미(런타임 단언) 불변, 컴파일 타임 안전망만 회복**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts` — `const q = (apiBase?: string): Partial<BootMessage> => ({ apiBase, triggerEndpointPath: "/t" });` / `const b = (...)` 동형(`describe("mergeBootConfig — ...")` 블록 상단), 및 그 아래 `apiBase 외 필드는 boot 이 이긴다` 테스트의 인라인 객체 리터럴에서 `as never` 캐스트 두 곳 제거.
  - 상세: `git show d8abc7003`로 정확히 대조한 결과, 헬퍼가 반환하는 **객체 리터럴 자체(`{ apiBase, triggerEndpointPath: "/t" }`)는 바이트 단위로 그대로**이고 바뀐 것은 함수 반환 타입 주석뿐이다(`as never` 제거 + `: Partial<BootMessage>` 명시). `as never`는 TypeScript 구조적 타입 검사를 **완전히 끄는** 캐스트라 어떤 형태의 객체를 넣어도 컴파일이 통과했는데(직전 라운드가 testing INFO로 지목), `Partial<BootMessage>`로 좁히면 실제로 `BootMessage`의 필드 구조(예: `apiBase`/`triggerEndpointPath`가 `string`이어야 함)를 검사한다. 이 변경은 **런타임에 실행되는 값이나 `expect(...)` 단언 대상에는 아무 영향이 없다** — 같은 인자, 같은 함수 호출, 같은 반환값 검증. `tsc --noEmit` 오류 0·해당 파일의 전 테스트(`use-widget.test.ts`) GREEN으로 컴파일·런타임 둘 다 확인. 즉 "테스트 의미"를 바꾼 것이 아니라 "이 테스트가 무엇을 컴파일 타임에 실수로 통과시킬 수 있었는가"의 사각지대를 좁힌 것 — 순수한 개선이며 새 위험은 없다.
  - 제안: 없음.

## 점검 관점별 요약

1. **의도치 않은 상태 변경**: 없음. §R0 정정·plan 등재는 문서 변경이고 런타임 상태와 무관. 코드 변경(별칭 삭제·캐스트 제거)은 순수 구조적 리팩터로 상태 변경 로직 자체엔 손대지 않았다(`applyConfig`의 조기 return 로직도 이번 diff에서 변경되지 않음 — 정정문이 서술만 고쳤다).
2. **전역 변수**: 없음.
3. **파일시스템 부작용**: `plan/complete/*.md`·`plan/in-progress/*.md`·`spec/**.md` 신규/수정은 이번 처분이 **의도한** 문서 산출물이고, 발견된 리뷰 지적(spec 서술 부정확·미등재 갭)에 정확히 대응한다. 예상 밖의 파일 변경은 없음.
4. **시그니처 변경**: `safeApiBaseFromQuery(raw)` export 완전 제거 — 저장소 전체 grep으로 소비처 0건 확인, `tsc`·전체 스위트 GREEN. `bridge.onBoot` 콜백 내부의 캐스트 제거는 시그니처가 아니라 호출 표현식 변경이며 무해.
5. **인터페이스 변경**: `safeApiBaseFromQuery`가 공개 export 목록에서 사라진 것은 형식상 인터페이스 축소이지만, 이 저장소 안에서 실제 소비처가 없음을 전수 확인했으므로 이번 변경 시점 기준 영향 없음.
6. **환경 변수**: 관련 없음.
7. **네트워크 호출**: 관련 없음. `applyConfig`의 조기 return 로직 자체는 이번 라운드에서 변경되지 않았다(서술만 정정).
8. **이벤트/콜백**: `bridge.onBoot` 콜백이 호출하는 인자가 `mergeBootConfig(configFromQuery(), c)`로 동일 — 캐스트만 제거됐다. 콜백 등록·발화 시점·횟수 불변.

## 새 CRITICAL

**없음.** 새 WARNING도 없음. 직전 라운드가 지적한 두 항목(§R0 거짓 서술, 미등재 선재 갭)은 이번 처분에서 실측 대조 결과 **정확하게** 정정·등재됐다. 부작용 관점에서 새로 도입된 위험도 없다(별칭 삭제·캐스트 제거·타입 안전망 회복 모두 런타임 동작 불변을 실측 확인).

## 요약

이번 라운드는 직전 side_effect INFO의 처분(`d8abc7003`)을 검증하는 것이 핵심이었다. §R0 정정문("진단은 거절 지점에만 있다" + 자매 분기 비대칭 명시)을 `applyConfig` 실제 코드와 대조한 결과 정확했고, 선재 갭은 같은 축(`use-widget.ts` 관측 불가 계열)을 이미 추적하던 `webchat-auth-session-status-reconcile.md`에 정확한 코드 인용과 함께 등재됐다. 부수적으로 이뤄진 별칭(`safeApiBaseFromQuery`) 완전 삭제는 저장소 전체 grep으로 소비처가 0건임을 확인했고(과거 리뷰/plan 이력 문서 제외), production 코드의 불필요한 캐스트 제거와 테스트 헬퍼의 `as never`→`Partial<BootMessage>` 전환도 각각 타입 레벨 개선일 뿐 런타임 동작·테스트 단언 대상에는 변화가 없다. `tsc --noEmit`(오류 0)과 channel-web-chat 전체 유닛 스위트(450/450 GREEN, 커밋 메시지 주장과 실측 일치)로 회귀 없음을 확인했다.

## 위험도

NONE
STATUS: OK
