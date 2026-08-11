# 테스트(Testing) 리뷰 — 직전 라운드(15_16_20) CRITICAL 처분 검증(commit d8abc7003)

## 사전 검증: 직전 CRITICAL 처분을 직접 재현 (뮤테이션 실측)

저장소 밖 scratch 사본(`/private/tmp/.../scratchpad/webchat-mutant/channel-web-chat`, `node_modules` 는 실제 워크트리로 심링크)에서 `use-widget.ts` 만 뮤테이션해 재현했다. 원복은 전부 `cp`(`.bak_orig` → 원위치)만 사용, `git restore`/`git checkout` 은 쓰지 않았다. 재현 전체 과정에서 실 워크트리는 `git status --short codebase/channel-web-chat/` 결과 계속 clean 이었다(마지막에도 재확인).

먼저 scratch 사본을 최신 커밋(`d8abc7003`) 상태로 `rsync`, baseline 확인: `use-widget.test.ts` + `use-widget-eager-start.test.ts` = **97/97 PASS**, `src/widget/` 전체 = **206/206 PASS**(신규 2건 포함, 종전 204 + 2).

### Q1. 직전에 실측했던 뮤턴트가 이제 RED 인가 — **CONFIRMED, RED**

호출부(`use-widget.ts:1336`)를 옛 인라인 spread `runApplyConfig({ ...configFromQuery(), ...c } as BootMessage);` 로 되돌리는 동일 뮤턴트를 적용해 `src/widget/` 전체를 돌렸다.

결과: **1건 RED**(`use-widget-eager-start.test.ts > useWidget — wc:boot 의 apiBase 스킴 검증(호출부 배선) > 비-http(s) apiBase 를 실은 boot → 그 값으로 부팅하지 않는다`), 나머지 205건 GREEN.
```
AssertionError: expected { apiBase: "javascript:alert(1)", ... } to be null
- Expected: null
+ Received: { "apiBase": "javascript:alert(1)", ... }
```
직전 라운드가 "204/204 전부 GREEN(회귀 미검출)" 이라고 낸 그 자리가, 이제 정확히 그 뮤턴트에 반응해 RED 로 떨어진다. 처분 커밋의 주장과 일치.

### Q2. 신규 통합 2건이 vacuous 한가 — **아니다, 둘 다 실질 단언**

- **테스트 1**(`비-http(s) apiBase...`): `config === null` 뿐 아니라 `fetchMock.mock.calls.some(c => String(c[0]).includes("javascript:"))` 가 `false` 인지, `warn` 이 `"wc:boot"` 소스로 불렸는지까지 단언한다. Q1 뮤테이션에서 이 세 단언 중 `config` 단언이 먼저 걸려 RED — "우연히 `config !== null` 만 봐서 통과" 하는 구조가 아니라 실제로 악성 스킴이 살아 들어온 결과를 정확히 잡는다.
- **테스트 2**(`정상 http(s)...`): `config !== null` 뿐 아니라 `config?.apiBase === SESSION_API_BASE` 까지 단언한다(값 자체를 검증, 존재 여부만이 아니다).

둘 다 vacuous 아님.

### Q3. 두 번째 케이스(정상 http(s))가 꼭 필요한가 — **CONFIRMED, 필요. 첫 번째만으론 "boot 통째 차단" 뮤턴트를 못 잡는다**

`applyConfig`(`use-widget.ts:1220`) 최상단에 무조건 `return;` 을 심어 **모든** boot 을 통째로 막는 뮤턴트를 적용했다(테스트 자체 주석 "위 케이스만 있으면 '보이 통째로 막았다' 로도 통과한다" 가 가리키는 바로 그 형태).

실측:
- 테스트 1(`비-http(s)...`) 단독 실행 → **PASS** (config 가 애초에 계속 null 이므로, 뮤턴트 유무와 무관하게 기대와 일치 — vacuous 통과가 재현됨)
- 테스트 2(`정상 http(s)...`) 단독 실행 → **FAIL**(`expected null not to be null` — `waitFor` 타임아웃)

즉 테스트 2 가 없었다면 이 "boot 을 통째로 막는" 회귀는 이 파일에서 검출되지 않는다. 테스트 파일 주석의 자기 정당화가 실측으로 확인됐다 — 두 축이 상호 보완적이며 어느 한쪽도 잉여가 아니다.

### 보너스 실측: `mergeBootConfig` 인자 순서 스왑도 잡히는가

처분이 노린 "호출부 원복" 외에, 다른 종류의 배선 결함도 잡히는지 별도로 확인했다: `mergeBootConfig(configFromQuery(), c)` → `mergeBootConfig(c, configFromQuery())` (인자 순서 스왑). `use-widget-eager-start.test.ts` 는 query string 을 전혀 설정하지 않아 `configFromQuery().apiBase` 가 이 파일 전체에서 항상 `undefined` 이므로, 스왑 시 `boot.apiBase` 검증이 사실상 우회되고 raw 값이 새어 나갈 수 있는 경로다.

결과: **2건 모두 RED** — 테스트 1 은 `warn` 이 `"wc:boot"` 소스로 불리지 않은 것을 잡고, 테스트 2 는 `config` 가 끝내 null 로 남는 것을 잡는다. 처분이 원래 겨냥한 회귀 클래스보다 넓게 방어된다.

### Q4/Q5. `safeApiBaseFromQuery` 별칭 삭제·7건 치환이 커버리지를 줄였는가 — **줄이지 않음. 실제로 별칭 자체가 완전 삭제됐다**

`grep -rn "safeApiBaseFromQuery" codebase/channel-web-chat/` → **0건**. 커밋 메시지 초안(직전 라운드가 지적한 "거짓 정당화")과 달리, 처분 커밋은 `@deprecated` 위임을 만드는 대신 별칭 자체를 지우고 실측 소비처(테스트 7곳)를 `safeApiBase(raw, "configFromQuery")` 로 직접 치환했다. 스킴 검증 로직(accept http(s)/reject js:·data:·상대경로/빈 문자열·null 처리) 자체는 변경되지 않았고 7건 전부 그대로 존재 — 커버리지 손실 없음.

한 가지 완화된 관찰(신규 결함 아님): `safeApiBase — 쿼리 경로` describe 의 7건은 `expect(warn).toHaveBeenCalledWith(expect.stringContaining("[widget]"), ...)` 로만 검증해 `source`(`"configFromQuery"`) 텍스트 자체는 이 describe 안에서 단언되지 않는다. `source` 파라미터를 무시/고정하는 뮤턴트(`console.warn` 내부에서 `${source}` 를 상수로 치환)를 별도로 적용해 확인한 결과, 이 7건은 전부 GREEN 으로 남지만 `mergeBootConfig — 덮어쓰기 차단` 단위 테스트와 신규 통합 테스트 1(`"wc:boot"` stringContaining 단언)이 **둘 다** RED 로 잡는다 — 다른 축(boot 쪽)에서 이미 커버되므로 실질적 사각지대는 아니다. 직전 라운드 발견사항 #4(`"wc:boot"` 소스가 관측된다)가 이번 치환 이후에도 그대로 유효함을 재확인.

## 남은 커버리지 갭

- **[INFO]** "쿼리는 유효 + boot 은 악성 → 쿼리 값이 살아남는다"(원 취약점의 핵심 시나리오, `mergeBootConfig` JSDoc 이 명시적으로 서술)를 **실제 `wc:boot` postMessage 흐름 + 실제 query string** 양쪽을 동시에 통해 검증하는 end-to-end 통합 테스트는 없다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (신규 describe, `useWidget — wc:boot 의 apiBase 스킴 검증(호출부 배선)`)
  - 상세: 이 파일은 `window.location.search` 를 어디서도 설정하지 않는다(`grep -n "location.search" use-widget-eager-start.test.ts` → 0건). 따라서 `configFromQuery().apiBase` 는 이 파일의 모든 테스트에서 항상 `undefined` 이고, 신규 통합 테스트 2건 중 어느 것도 `mergeBootConfig` 의 "`??` 폴백으로 쿼리 값을 되살린다" 분기를 실제 쿼리 문자열로 밟지 않는다(그 분기는 `use-widget.test.ts` 의 `덮어쓰기 차단`/`상대 경로 boot 값도 거절` 등 6개 단위 테스트가 직접 호출로만 커버). 다만 별도로 실측한 인자 순서 스왑 뮤턴트(위 "보너스 실측")는 이 부재에도 불구하고 우연히 잡혔으므로, 현재로선 활성 사각지대라기보다 **우연에 의존한 커버리지**에 가깝다 — "덮어쓰기 방지"를 겨냥한 명시적 뮤턴트(예: `??` 를 `||` 로, 혹은 우선순위를 반대로 하는 뮤턴트)가 실제 쿼리값을 통해서만 관측 가능한 형태라면 놓칠 수 있다.
  - 제안: 우선순위 낮음(현재 CRITICAL 없음. `mergeBootConfig` 단위 레벨이 로직을, 신규 통합 2건이 배선을 각각 이미 지킨다). 필요하면 `use-widget-eager-start.test.ts` 에 `Object.defineProperty(window, "location", ...)` 또는 `history.pushState` 로 `?apiBase=https://good.example.com` 을 설정한 뒤 `boot("javascript:alert(1)")` 로 덮어쓰기 시도 → `config.apiBase === "https://good.example.com"` 을 잠그는 3번째 케이스를 추가하면 이 갭이 닫힌다.

- **[INFO]** (직전 라운드 발견사항 재확인, 신규 아님) `safeApiBase — 쿼리 경로` 7건은 `source` 인자 텍스트를 직접 단언하지 않는다. 위 Q4/Q5 절 참고. `mergeBootConfig` 쪽 테스트가 이미 커버하므로 조치 불요.

## 발견사항

새 CRITICAL 없음. 직전 라운드 CRITICAL("`bridge.onBoot` → `mergeBootConfig` 배선을 지키는 테스트 부재")은 커밋 `d8abc7003` 의 신규 통합 2건으로 **실측 확인된 방식으로 해소**됐다 — 원 뮤턴트(호출부 원복)로 RED, 관련 없는 정상 배포 뮤턴트로는 GREEN, "boot 통째 차단" 뮤턴트는 두 번째 테스트가 단독으로 잡음, 인자 순서 스왑까지 부수적으로 방어됨을 모두 직접 재현으로 확인했다.

- **[INFO]** end-to-end "쿼리 값이 악성 boot 값을 이긴다" 시나리오는 실제 query string 을 통해서는 아직 통합 테스트되지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (신규 describe 전체)
  - 상세/제안: 위 "남은 커버리지 갭" 절 참고.

## 요약

직전 라운드(`15_16_20`)가 실측으로 지적한 CRITICAL("호출부를 옛 인라인 spread 로 되돌려도 위젯 스위트 204/204 전부 GREEN")을, 처분 커밋 `d8abc7003` 의 신규 통합 2건이 실제로 막는지 동일한 뮤턴트로 재현했다 — **이제 정확히 1건이 RED 로 떨어진다**(206건 중). 두 신규 테스트는 vacuous 하지 않고(각각 config 값·fetch 인자·warn 인자를 구체적으로 단언), 서로 보완적이다 — "boot 을 통째로 막는" 별도 뮤턴트로 검증한 결과 테스트 2("정상 http(s)...")가 없으면 그 회귀는 검출되지 않는다는 테스트 파일 자신의 주석 그대로 확인됐다. 부수적으로 `mergeBootConfig` 인자 순서 스왑 뮤턴트도 두 테스트 모두에 의해 잡히는 것을 확인해 방어 범위가 처분이 원래 겨냥한 것보다 넓음을 실증했다. `safeApiBaseFromQuery` 별칭은 위임이 아니라 완전 삭제됐고(0 참조 확인) 7개 단위 테스트의 치환은 스킴 검증 로직 커버리지를 그대로 보존한다. 유일한 잔여 갭은 INFO 수준으로, "유효 쿼리 + 악성 boot" 조합을 실제 query string 을 통해 end-to-end 로 검증하는 3번째 통합 케이스가 없다는 점이다(현재는 단위 레벨에서만 커버되고, 우연한 뮤턴트 테스트로는 부수적으로 잡혔다) — 활성 결함은 아니며 저우선순위 보강 항목이다.

## 위험도

NONE — 직전 라운드 CRITICAL 은 실측으로 해소 확인. 신규로 제기할 CRITICAL/WARNING 없음. INFO 1건(저우선순위 보강 제안)만 잔존.

STATUS: OK
