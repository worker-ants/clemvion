# 테스트(Testing) Review — webchat `wc:boot` apiBase 스킴 검증, 3번째 라운드(99d3e9000)

## 지시된 재현 작업 — 직접 뮤테이션으로 판정

scratch 사본(`/private/tmp/.../scratchpad/testing-review-mutate`, node_modules 는 기존
설치본을 symlink)에서 `codebase/channel-web-chat/src/widget/{use-widget.ts,use-widget.test.ts,
use-widget-eager-start.test.ts}` 를 대상으로 실제 뮤테이션·실행을 재현했다. **원본 워크트리는
`git status --porcelain` 로 무변경 확인**(위 세 파일 diff 0).

### 1. 폴백 제거 뮤턴트(`?? fromQuery.apiBase` 삭제) → 4건 RED 인가, e2e 포함되는가

`mergeBootConfig` 의

```ts
merged.apiBase = (safeApiBase(boot.apiBase, "wc:boot") ??
  fromQuery.apiBase) as BootMessage["apiBase"];
```

를

```ts
merged.apiBase = safeApiBase(boot.apiBase, "wc:boot") as BootMessage["apiBase"];
```

로 바꿔 `vitest run use-widget.test.ts use-widget-eager-start.test.ts` 를 돌리면 **정확히 4건
RED**:

- `use-widget.test.ts` — `mergeBootConfig` describe 3건(**덮어쓰기 차단** / 상대 경로 boot 거절 /
  boot 이 apiBase 안 보내면 쿼리 값이 산다)
- `use-widget-eager-start.test.ts` — **`유효 쿼리(apiBase만) + 악성 boot → 쿼리 값이 이긴다
  (덮어쓰기 차단, e2e)`** 1건 (신규 e2e)

plan(`plan/complete/webchat-boot-apibase-scheme-validation.md:42`) 의 "4건 RED" 주장과 정확히
일치하고, 신규 e2e 가 그 4건에 **포함된다**는 진단도 실측 확인됨.

### 2. 첫 판 형태(`&trigger=t1` 추가)로 되돌리면 그 e2e 가 GREEN 이 되는가

같은 폴백-제거 뮤턴트를 켠 채로 신규 e2e(`use-widget-eager-start.test.ts:4260`)의 쿼리 문자열만

```ts
window.history.replaceState(null, "", `?apiBase=${encodeURIComponent(SESSION_API_BASE)}`);
```

에서

```ts
window.history.replaceState(null, "", `?apiBase=${encodeURIComponent(SESSION_API_BASE)}&trigger=t1`);
```

로 되돌려 그 테스트만 단독 실행(`-t "유효 쿼리"`)하면 **`1 passed`(GREEN)** — 뮤턴트가 살아있는데도
통과한다. `use-widget.ts:1377-1381` 의 "host 없이 직접 로드" 폴백

```ts
const fallback = configFromQuery();
if (fallback.apiBase && fallback.triggerEndpointPath) {
  runApplyConfig(fallback as BootMessage);
}
```

이 `trigger` 가 쿼리에 있으면 `mergeBootConfig`/`bridge.onBoot` 경로와 **완전히 무관하게** 같은
`apiBase` 값으로 부팅해 버려 관측이 갈리지 않는다는 진단이 **정확히 재현됐다**. 처분(쿼리에서
`trigger` 를 뺌)이 이 vacuousness 를 실제로 없앴다는 것도 확인 — `trigger` 없는 현재 쿼리에서는
`fallback.triggerEndpointPath` 가 `undefined` 라 `if` 조건이 거짓이 되어 폴백이 아예 발동하지
않고, `mergeBootConfig` 경로만이 유일 공급원이 된다.

### 3. 신규 e2e 가 다른 축에서도 판별력이 있는가

이 한 뮤턴트만 잡는지 확인하려고 **서로 다른 축의 뮤턴트 3종**을 추가로 넣어 봤다(전부 scratch,
매번 원본에서 `cp` 로 리셋):

| 뮤턴트 | 축 | 결과 | 신규 e2e 포함? |
|---|---|---|---|
| `safeApiBase` 스킴 검사 자체를 무력화(`return raw` 로 축약) | 검증 로직 | 8건 RED | 포함(+기존 e2e 1건 "비-http(s) apiBase..." 도 RED) |
| `console.warn(...)` 호출 라인만 제거(판정 로직은 그대로) | 진단/관측성 | 6건 RED | 포함 — `expect(warn).toHaveBeenCalledWith(...)` 단언이 걸림 |
| `merged.apiBase = fromQuery.apiBase ?? safeApiBase(boot.apiBase, ...)` (우선순위 역전) | 병합 순서 | 3건 RED | 포함 — `??` 단락평가로 `safeApiBase(boot.apiBase,...)` 자체가 안 불려 warn 단언이 걸림 |

세 축 모두에서 신규 e2e(`유효 쿼리(apiBase만) + 악성 boot`)가 RED 로 떨어졌다. 특히 우선순위 역전
뮤턴트는 `apiBase` **값** 자체는 우연히 같게 나오는데(양쪽 다 `fromQuery.apiBase` 가 truthy라
단락평가로 그대로 반환), 신규 e2e 의 `warn` 단언이 "boot 값이 실제로 검증을 거쳤는지"를 별도로
잡아낸다 — `use-widget.test.ts:109-116` 의 `apiBase 외 필드는 boot 이 이긴다` 유닛 테스트도 같은
뮤턴트를 독립적으로 잡는다(우선순위 검증을 겸하는 부수 효과, 의도한 설계인지는 불명이나 실효는
있다). **결론: 처분 전 첫 판(폴백-제거 뮤턴트 하나만 잡던 형태)과 달리, 처분 후 신규 e2e 는
검증 로직·진단·병합 순서 세 축에 걸쳐 실제 판별력을 가진다.** 단일 뮤턴트만 잡는 vacuous 형태가
아니다.

### 4. 남은 커버리지 갭

- **[INFO]** "host 없이 직접 로드" 폴백(`use-widget.ts:1377-1381`)이 **쿼리 자체의 악성
  `apiBase`** 를 실제로 거르는지를 end-to-end(진짜 `window.location.search` → `URLSearchParams` →
  비-export 함수 `configFromQuery()`)로 검증하는 테스트가 없다. 현재 `configFromQuery: ...`
  source 라벨은 `use-widget.test.ts:16-49` 에서 `safeApiBase(raw, "configFromQuery")` 를 **직접**
  호출해 문자열 리터럴로만 검증하고, `configFromQuery()` 자체(비-export, private)는 boot 경로(신규
  e2e, `trigger` 없는 유효 쿼리)나 위 폴백 경로 그 어느 e2e 에서도 **악성 쿼리 apiBase** 로는
  타지 않는다. `?apiBase=javascript:alert(1)&trigger=t1` 형태로 폴백이 스킵되고 `console.warn`이
  `"[widget] configFromQuery: ..."`로 찍히는 것을 e2e 로 고정하는 자리가 비어 있다. 이 경로 자체는
  이 PR 이 새로 만든 것이 아니라 선행 PR(`webchat-session-apibase-binding`) 의 하드닝이라 이번
  delta 의 결함은 아니지만, `safeApiBaseFromQuery`→`safeApiBase` 리네이밍 대상이 된 함수이므로
  같은 리뷰 사이클에서 언급해 둔다. 위험도는 낮음(로직 자체는 `safeApiBase` 유닛 테스트로 이미
  방어됨, 갭은 "배선"에만 있음).
- **[INFO]** `mergeBootConfig` 유닛 테스트의 `q()`/`b()` 픽스처(`use-widget.test.ts:70-71`)는
  `Partial<BootMessage>` 를 직접 리터럴로 만들어 `safeApiBase` 검증을 거치지 않은 값을
  `fromQuery.apiBase` 자리에 넣을 수 있다(실제 프로덕션 경로에서는 `configFromQuery()` 가 항상
  먼저 걸러 이런 입력이 물리적으로 발생하지 않는다). `mergeBootConfig` 함수 자체의 "이미 오염된
  `fromQuery.apiBase` 를 받으면 어떻게 되는가"는 이론적으로만 미검증 — 실사용 경로 보호에는
  영향 없어 낮은 우선순위.
- **[INFO]** 쿼리에 `apiBase`+`trigger` 가 모두 있고 동시에 `wc:boot` 메시지도 도착하는 "폴백과
  boot 이 둘 다 발동" 조합(`runApplyConfig` 이중 호출)은 테스트되지 않는다. 이 PR 이 바꾼 표면이
  아니라 선재 동작이며, 신규 e2e 가 의도적으로 `trigger` 를 뺀 것도 바로 이 조합을 피해 판별력을
  확보하려는 선택이었다(위 2번 참조) — 별도 결함이 아니라 참고용으로만 남긴다.

## 부수 관찰 (이번 diff 범위 밖)

- **[INFO]** 실제 워크트리에 `codebase/channel-web-chat/src/widget/__leak_probe.test.ts`,
  `__leak_probe2.test.ts` 두 개의 **untracked** 파일이 있다(`git status --porcelain` 확인,
  `__leak_probe2.test.ts` 는 `use-widget-eager-start.test.ts` 전체 사본으로 보인다). 이번 review
  payload(`meta.json` 대상 파일 목록)에는 없고 리뷰 대상 diff 도 아니라 이 델타의 결함은 아니지만,
  `vitest.config.ts` 의 `include: ["src/**/*.{test,spec}.{ts,tsx}"]` 패턴에 걸려 로컬에서
  전체 스위트를 돌리면 중복 실행될 수 있다. 병렬로 도는 다른 리뷰어가 "뮤테이션은 저장소 밖
  scratch 사본에서만" 규약을 어기고 실 워크트리에 흔적을 남겼을 가능성이 있어 보인다 — 내가 만든
  파일은 아니며(scratch 밖으로 파일을 쓴 적 없음, 위 검증 명령 참조), 병합 전 정리 권장.

## 회귀 테스트 유효성

`use-widget.test.ts:16-49` 의 `safeApiBase — 쿼리 경로` describe(구
`safeApiBaseFromQuery`)는 함수 시그니처만 바뀌었을 뿐(`source` 인자 추가) 단언 내용은 100% 보존돼
있어 회귀 유효성 문제 없음. `mergeBootConfig` describe 6건 + 신규 e2e 3건(비-http boot 거절 /
정상 http boot 통과 / 유효 쿼리+악성 boot 덮어쓰기 차단) 모두 clean 실행(98 passed, scratch
재현) 확인.

## 새 CRITICAL

**없음.** 직전 라운드(`15_16_20`/`15_32_44`)가 지적한 vacuous e2e 는 이번 delta(`99d3e9000`)에서
실제로 해소됐다 — 뮤테이션 재현으로 확인. `trigger` 를 쿼리에서 뺀 처분이 정확히 그 vacuousness
의 원인(직접 로드 폴백과의 관측 뒤섞임)을 없앴고, 결과 테스트는 단일 뮤턴트가 아니라 검증
로직·진단(warn)·병합 우선순위 세 축에서 독립적으로 판별력을 가진다.

## 요약

지시된 4가지 재현을 모두 scratch 사본에서 직접 뮤테이션으로 수행했다. (1) 폴백 제거 뮤턴트는
정확히 4건 RED 를 내고 그중 1건이 신규 e2e 다 — plan 의 주장과 실측이 일치한다. (2) 첫 판 형태로
되돌리면(`&trigger=t1` 추가) 같은 뮤턴트가 살아있어도 그 e2e 가 GREEN 이 되는 것을 재현해, 개발자의
자체 진단("host 없이 직접 로드 폴백이 관측을 가린다")이 정확했음을 확인했다. (3) 신규 e2e 는 이
한 뮤턴트에만 반응하는 vacuous 테스트가 아니라, 스킴 검증 무력화·진단(warn) 누락·병합 우선순위
역전이라는 서로 다른 세 축의 뮤턴트에서도 독립적으로 RED 로 떨어져 실질적 판별력을 가진다. (4)
남은 갭은 전부 INFO 급이며 이 PR 의 핵심 변경(`wc:boot` 스킴 검증) 자체와는 무관하거나(직접 로드
폴백의 쿼리측 악성 apiBase e2e 배선 미검증 — 선행 PR 소관) 실사용 경로에 물리적으로 도달하지
않는 이론적 갭(오염된 `fromQuery.apiBase` 를 받는 `mergeBootConfig` 유닛 방어)이다. 새 CRITICAL
없음.

## 위험도

NONE

STATUS: OK
