# 테스트(Testing) 리뷰 — `wc:boot` apiBase 스킴 검증 (mergeBootConfig)

## 사전 검증: 신규 회귀 6건이 실제로 무는가 (뮤테이션 실측)

저장소 밖 scratch 사본(`/private/tmp/.../scratchpad/webchat-mutant/channel-web-chat`, node_modules 는 메인 체크아웃 심링크)에서 `use-widget.ts` 를 직접 뮤테이션해 재현했다. 원복은 전부 `cp`(원본 → scratch)만 사용했고 `git restore`/`git checkout` 은 쓰지 않았다. 실제 워크트리 파일은 끝까지 미변경(`git status --short codebase/channel-web-chat/` 결과 clean) 확인됨.

### 1. 커밋 주장 뮤턴트 직접 재현 — CONFIRMED

`mergeBootConfig`(`use-widget.ts:236-247`)의 명시적 apiBase 재계산

```ts
merged.apiBase = (safeApiBase(boot.apiBase, "wc:boot") ??
  fromQuery.apiBase) as BootMessage["apiBase"];
```

두 줄을 지우고 `return merged;`(spread 결과 그대로)만 남기는 뮤턴트를 적용해 `use-widget.test.ts` 를 돌렸다.

결과: **정확히 claim 대로 4건 RED, 2건 GREEN.**
- RED: `덮어쓰기 차단`, `쿼리도 없고 boot 도 거절되면 undefined`, `상대 경로 boot 값도 거절`, `boot 이 apiBase 를 아예 안 보내면 쿼리 값이 그대로 산다`
- GREEN 유지: `정상 배포`, `apiBase 외 필드는 boot 이 이긴다`

### 2. "정상 배포 케이스가 GREEN 유지" — no-op 주장은 참이지만, 이 테스트 자체는 vacuous 하지 않음 (CONFIRMED, 별도 실측)

`정상 배포` 테스트(`use-widget.test.ts:70-74`)는 q/b 양쪽에 **같은** `https://api.example.com` 을 넣기 때문에, "spread-only 로 되돌리는" 뮤턴트에 대해서는 수학적으로 no-op 이다(검증 통과값과 spread 값이 우연히 같음) — 테스트 주석이 이를 정확히 인지하고 명시한다.

다만 이게 이 테스트가 **아무것도 안 잡는다**는 뜻은 아님을 별도 뮤턴트로 확인했다: `safeApiBase` 의 성공 분기(`use-widget.ts:204` 상당, `return raw;`)를 `return raw + "/";` 로 오염시키자 — 이 뮤턴트는 "정상 배포" 테스트를 포함해 4건을 RED 로 만들었다(`safeApiBaseFromQuery` 기존 테스트 2건 + `정상 배포` + `apiBase 외 필드는 boot 이 이긴다`). 즉 이 테스트는 "과도한 거부/오염 없이 정상값을 그대로 통과시키는가"라는 **다른 축**을 겨냥하며, 그 축에서는 판별력이 있다. 커밋이 주장한 특정 회귀(spread 복귀)에 대해서만 의도적으로 no-op 이고, 그 의도가 주석에 명문화돼 있다 — 좋은 설계다.

### 3. 4건이 서로 다른 축을 겨냥하는가 — 부분적으로 CONFIRMED (완전 중복은 아님)

커밋이 주장한 "전체 되돌리기" 뮤턴트 한 개에는 4건이 동시에 죽는 게 당연하다(전부 그 되돌리기의 직접 결과). 그래서 더 좁은 뮤턴트로 판별력을 재확인했다: `?? fromQuery.apiBase` → `?? undefined`(검증은 유지, 쿼리 폴백만 제거)로 바꾸면 **3건만** RED 가 되고 `쿼리도 없고 boot 도 거절되면 undefined` 는 GREEN 으로 남는다 — 이 케이스는 쿼리도 애초에 없어 기대값이 어느 쪽이든 `undefined` 이므로 폴백 로직 자체에 의존하지 않기 때문이다. 즉 4건은:
- "거절(non-http(s), 상대경로 포함) + 쿼리 있음 → 쿼리로 폴백" 축 2건
- "거절 + 쿼리 없음 → 리크 안 됨" 축 1건
- "부재(undefined) + 쿼리 있음 → 쿼리 보존, 거절과 구분" 축 1건

으로 나뉘고, 좁은 뮤턴트에서 실제로 다르게 반응한다 — 완전 중복은 아니다.

### 4. `safeApiBase` 의 `source` 인자가 실제로 관측되는가 — CONFIRMED, 관측된다

`mergeBootConfig` 내부 `safeApiBase(boot.apiBase, "wc:boot")` 의 `"wc:boot"` 를 `"configFromQuery"` 로 바꾸는 뮤턴트를 적용하자 `덮어쓰기 차단` 테스트 1건이 RED 됐다(`expect(warn).toHaveBeenCalledWith(expect.stringContaining("wc:boot"), ...)`, `use-widget.test.ts:81`). 나머지 5건 중 4건은 `vi.spyOn(console, "warn").mockImplementation(() => {})` 만 걸고 호출 인자를 단언하지 않아 이 축을 못 잡지만, 최소 1건이 명시적으로 잡고 있어 "아무도 모르게 잘못된 source 를 넘겨도 통과"하는 상황은 아니다.

### 5. 통합 경로(`bridge.onBoot`)가 `mergeBootConfig` 를 실제로 부르는가 — **CRITICAL 갭 발견**

diff 상 `use-widget.ts:1344` 의 호출부는 실제로 `runApplyConfig(mergeBootConfig(configFromQuery(), c as Partial<BootMessage>))` 로 바뀌어 있다(과거 `{ ...configFromQuery(), ...c } as BootMessage` 인라인 spread 대체). 그런데 **이 배선 자체를 지키는 테스트가 없다.**

실측: `mergeBootConfig` 는 그대로 두고 호출부만 옛 인라인 spread `runApplyConfig({ ...configFromQuery(), ...c } as BootMessage);` 로 되돌리는 뮤턴트(= 이번 보안 수정을 호출부에서만 조용히 무력화)를 적용해 위젯 스위트 **전체**(`src/widget/` 11개 파일, 204건)를 돌렸다 — **204/204 그대로 통과, 실패 0건.** 베이스라인(뮤테이션 전)도 동일하게 204/204 라 이 결과가 우연이 아님을 확인했다.

즉 `use-widget.test.ts` 의 6건은 **오직 `mergeBootConfig` 함수를 직접 호출**해서 검증하고, `bridge.onBoot` 콜백이 그 함수를 실제로 부른다는 사실을 검증하는 테스트는 이 저장소 어디에도 없다. `use-widget-eager-start.test.ts` 가 `messageFromHost({ type: "wc:boot", payload: {...} })` 로 실제 `wc:boot` 흐름을 광범위하게 통합 테스트하지만(grep 결과 수십 곳), 그중 악성 스킴(`javascript:`/`data:`/상대경로) `apiBase` 를 boot payload 에 실어 보내는 시나리오는 **하나도 없다**. TypeScript 컴파일도 이 뮤턴트를 잡지 못한다(`as BootMessage` 캐스트가 유효하므로 타입 에러 없음).

이 저장소가 반복적으로 겪은 "헬퍼 테스트 ≠ 호출부 테스트" 패턴(CLAUDE.md 인접 메모리: `feedback_type_guard_test_actually_runs.md`, `project_v05_result_detail_hook_registry_comove.md` 등)과 정확히 같은 형태다. 오늘 코드는 올바르게 배선돼 있지만(diff 확인됨), **그 배선을 지키는 회귀 테스트가 없어** 향후 리팩터가 `mergeBootConfig` 호출을 실수로 걷어내도(예: 편의상 인라인 병합으로 되돌리는 "정리" 커밋) 이번에 막으려던 보안 결함(쿼리 검증이 boot 값에 덮여 사라지는 문제)이 **조용히 재발**하며 전체 스위트가 초록으로 남는다.

---

## 발견사항

- **[CRITICAL]** `bridge.onBoot` → `mergeBootConfig` 배선을 지키는 회귀 테스트 부재 — 헬퍼만 테스트되고 호출부는 무방비
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1344` (호출부), `codebase/channel-web-chat/src/widget/use-widget.test.ts:64-114` (`mergeBootConfig` describe, 호출부는 검증 안 함)
  - 상세: 실측(뮤테이션) — 호출부를 옛 인라인 spread(`{ ...configFromQuery(), ...c } as BootMessage`)로 되돌려 `mergeBootConfig` 를 완전히 우회해도 위젯 스위트 204건이 전부 그대로 통과한다. 즉 "이번에 고친 보안 결함(쿼리 검증이 `wc:boot` 값에 덮여 사라짐)이 호출부 리팩터로 재발"하는 시나리오에 대해 이 저장소의 어떤 테스트도 경보를 울리지 않는다. `use-widget-eager-start.test.ts` 가 `wc:boot` 통합 흐름을 광범위히 다루지만 악성 스킴 `apiBase` 를 boot payload 에 실어 검증하는 케이스는 없다.
  - 제안: `use-widget-eager-start.test.ts`(또는 신규 통합 스펙)에, 실제 `createIframeBridge`/`messageFromHost` 경유로 `wc:boot` 페이로드에 `apiBase: "javascript:alert(1)"` 등 비-http(s) 값을 실어 보내고, 위젯이 실제 fetch/EIA 클라이언트 호출에 그 값을 쓰지 않는지(예: `fetchEmbedConfig`/`EiaClient` 생성에 전달된 `apiBase` 를 spy 로 관측)를 최소 1건 잠그는 통합 테스트 추가 권장. 이렇게 하면 `mergeBootConfig` 자체가 아니라 **그 함수가 실제로 호출된다는 사실**을 지킨다.

- **[INFO]** 테스트 헬퍼(`q`/`b`)의 `as never` 캐스트가 타입 안전망을 완전히 우회
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts:67-68` (`const q = (apiBase?: string) => ({ apiBase, triggerEndpointPath: "/t" }) as never;`)
  - 상세: `Partial<BootMessage>` 를 만족하는 리터럴이라 `as never` 없이도(또는 `as Partial<BootMessage>` 정도로) 타입이 통과할 가능성이 높다. `never` 캐스트는 대상 타입과의 구조적 정합을 전부 무시하므로, 향후 `BootMessage` 필드명이 바뀌어도(예: `apiBase` → `apiBaseUrl`) 이 헬퍼는 컴파일 에러 없이 조용히 틀린 객체를 만들어낼 수 있다.
  - 제안: `as Partial<BootMessage>` 로 좁혀서 최소한의 구조적 타입 체크를 살리는 편이 안전. (낮은 우선순위 — 현재는 필드명이 실제 타입과 일치해 위험이 낮음.)

- **[INFO]** `mergeBootConfig` 양쪽 모두 `apiBase` 부재/빈 문자열 조합 미테스트
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts:64-114` (`mergeBootConfig` describe 전체)
  - 상세: `q(undefined)+b(undefined)`(둘 다 없음) 나 boot 쪽 `apiBase: ""`(빈 문자열) 케이스는 `mergeBootConfig` 레벨에서 직접 단언되지 않는다. 다만 `safeApiBase` 내부의 `!raw` 조기 return 은 `safeApiBaseFromQuery` describe(`use-widget.test.ts:39-43`)에서 이미 커버되고 있어 실제 위험은 낮다.
  - 제안: 우선순위 낮음 — 필요하면 `mergeBootConfig(q(undefined), b(undefined)).apiBase` 가 `undefined` 임을 1줄 추가해 진리표를 완성할 수 있다.

## 요약

신규 회귀 6건은 커밋 메시지 주장대로 정확히 4건 RED/2건 GREEN 으로 재현됐고, "정상 배포 GREEN 유지"는 해당 뮤턴트에 대해서만 의도된 no-op 이며 다른 축(성공 경로 오염)에서는 판별력이 있음을 별도 뮤테이션으로 확인했다. `safeApiBase` 의 `source` 인자도 최소 1개 단언이 실제로 관측한다. 4건의 신규 테스트는 완전히 중복되지 않고 (거절+쿼리있음/거절+쿼리없음/부재+쿼리있음) 서로 다른 조합을 커버한다 — 좁힌 뮤턴트로 확인. 다만 가장 중요한 갭은 **`mergeBootConfig` 라는 헬퍼 자체는 잘 테스트됐지만, 그 헬퍼를 실제로 부르는 `bridge.onBoot` 호출부(`use-widget.ts:1344`)를 지키는 테스트가 전무**하다는 점이다 — 실측으로 확인(호출부를 옛 취약 코드로 되돌려도 204/204 스위트가 그대로 초록). 이는 이 저장소가 반복적으로 지적받아 온 "헬퍼 테스트 ≠ 호출부 테스트" 패턴의 재발이며, 이번 보안 수정(쿼리 검증이 `wc:boot` 값에 덮여 사라지는 결함)이 향후 무방비로 재발할 수 있는 유일한 경로다.

## 위험도

MEDIUM — 오늘 코드는 올바르게 배선돼 있어 현재 시점 활성 결함은 아니지만, 그 배선을 지키는 회귀 테스트가 전무해 보안 관련 리팩터 재발 시 조용히 되돌아갈 수 있는 구조적 갭(CRITICAL 발견 1건)이 확인됐다.

STATUS: OK
