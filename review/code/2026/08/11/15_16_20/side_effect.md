# 부작용(Side Effect) Review — webchat apiBase 스킴 검증 하드닝

## 검증 방법

정적 리뷰 외에, 실제 워크트리(`codebase/channel-web-chat`)에서 관련 유닛 테스트를 직접 실행해
회귀 여부를 실측했다.

```
$ npx vitest run src/widget/use-widget.test.ts src/widget/host-bridge.test.ts
Test Files  2 passed (2) / Tests  27 passed (27)

$ npx vitest run   # channel-web-chat 전체
Test Files  23 passed (23) / Tests  448 passed (448)
```

plan 문서(`plan/complete/webchat-boot-apibase-scheme-validation.md`)가 주장하는 "448 passed" 와
일치함을 확인했다.

## 발견사항

- **[INFO]** `safeApiBaseFromQuery` → `safeApiBase(raw, source)` 개명 — 하위호환 위임은 안전하다(실측 확인)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197`(신규 `safeApiBase`), `:212-218`(`@deprecated safeApiBaseFromQuery` 위임)
  - 상세: 옛 이름의 유일한 실사용처는 `codebase/channel-web-chat/src/widget/use-widget.test.ts`(`grep -rn safeApiBaseFromQuery codebase/` 결과, 이 테스트 파일과 정의부 자신 외 호출부 없음)이고, 위임이 정확히 `safeApiBase(raw, "configFromQuery")` 를 호출하므로 시그니처·반환값이 완전히 동일하다. 경고 문구도 `` `[widget] ${source}: apiBase 가 http(s) URL 이 아니어서 무시합니다:` `` 템플릿에 `source="configFromQuery"` 를 대입하면 옛 정적 문자열과 **바이트 단위로 동일**해, `expect.stringContaining("[widget]")` 를 쓰는 옛 단언(`use-widget.test.ts:27,32`, 프롬프트 게이트 기준)이 깨지지 않는다. 실제로 `use-widget.test.ts` 27건 전부 GREEN.
  - 제안: 없음(회귀 없음).

- **[INFO]** `mergeBootConfig` 폴백 — 정상 http(s) 배포 경로에서 완전히 동일한 결과
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:236-247`(`mergeBootConfig` 정의), `:1344`(호출부 `bridge.onBoot`)
  - 상세: `boot.apiBase` 가 정상 http(s) 값이면 `safeApiBase(boot.apiBase, "wc:boot")` 가 원본을 그대로 반환하므로 `merged.apiBase = raw`가 되어, 종전 `{ ...configFromQuery(), ...c }` 스프레드가 `boot.apiBase` 로 덮어쓰던 결과와 **값이 완전히 같다**. `apiBase` 외 필드는 여전히 단순 스프레드(`{ ...fromQuery, ...boot }`)라 병합 우선순위 규칙 자체는 바뀌지 않았다(테스트 `use-widget.test.ts` "apiBase 외 필드는 boot 이 이긴다" — 프롬프트 게이트 106-113 — 로 고정). channel-web-chat 전체 스위트 448건이 이 변경 후에도 전부 GREEN.
  - 제안: 없음.

- **[INFO]** 선재 결함 수정(`boot.apiBase === undefined` 가 쿼리 값을 지우던 문제) — 의존 코드/테스트 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:241-245`(주석 + `merged.apiBase =` 계산)
  - 상세: 옛 스프레드는 `boot` 객체가 `apiBase` **키를 명시적으로(값이 undefined 라도) 가지고 있으면** 쿼리 값을 지웠다(JS 스프레드는 값이 아니라 own-enumerable-key 존재로 덮어쓴다). 이 동작에 의존하는 코드/테스트가 있는지 `codebase/channel-web-chat/src/widget/*.test.ts` 전수(`use-widget-eager-start.test.ts`·`host-bridge.test.ts`·`demo-*.test.ts` 등)를 grep 했으나 `boot(undefined)`/`apiBase: undefined` 형태의 "명시적 undefined 로 쿼리를 지운다"를 전제한 자리는 없었다 — 전부 유효한 `apiBase` 문자열(`SESSION_API_BASE`, `"http://api.test/api"`, `"a"` 등)을 채워 쓴다. `host-bridge.test.ts` 는 `apiBase: "a"`(비-http(s))를 쓰지만 이 파일은 `createIframeBridge`(순수 브리지, `host-bridge.ts`) 단위 테스트라 `mergeBootConfig`/`safeApiBase` 를 전혀 거치지 않는다(브리지 계층엔 apiBase 검증 로직 자체가 없음, `host-bridge.ts:44-51` 확인) — 이 diff 의 영향권 밖이다.
  - 제안: 없음. (참고: 새 회귀 테스트 5건 중 "boot 이 apiBase 를 아예 안 보내면 쿼리 값이 그대로 산다" 케이스가 이 수정 자체를 고정한다.)

- **[INFO]** `applyConfig` 의 `apiBase: undefined` 처리 — 이 diff 밖의 기존 조기 return, 관측 가능한 실패 신호가 없다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1229` — `const applyConfig = async (cfg: BootMessage) => { if (!cfg.apiBase || !cfg.triggerEndpointPath) return; ...` (직접 `Read` 로 확인. 이번 diff 두 hunk 어디에도 이 줄은 포함돼 있지 않다 — 프롬프트의 "전체 파일 컨텍스트" 도 파일 크기 제한으로 이 구간 이전에 잘려 있어 별도로 원본을 열어 확인함.)
  - 상세: `mergeBootConfig` 가 boot 값을 거절하고 쿼리 폴백도 없으면 `cfg.apiBase` 는 `undefined` 가 되고, `applyConfig` 는 **아무 `dispatch` 도 없이** 조기 `return` 한다. 몇 줄 아래의 자매 분기 — origin allowlist 실패(`isEmbedAllowed`) — 는 `dispatch({ type: "BLOCKED", reason: "origin_not_allowed" })` 로 사용자(host)가 관측 가능한 상태를 남기는 것과 **비대칭**이다. `4-security.md` §R0 신설 문구(프롬프트 게이트 198-199, `spec/7-channel-web-chat/4-security.md`)는 "apiBase 가 결국 없으면 applyConfig 가 자기 자리에서 실패해 진단이 그쪽에 모인다"고 적었는데, 실제로 그 "자기 자리"에는 `console.warn` 도 `dispatch` 도 없다 — 유일한 진단은 그보다 앞서 `safeApiBase` 내부에서 이미 찍힌 `console.warn` 뿐이고, `applyConfig` 자체는 완전히 침묵한다. 다만 이 조기 return 은 **이번 diff 가 만든 코드가 아니라 기존 코드**이고(쿼리 전용 검증 시절에도 쿼리가 거절되면 같은 경로를 탔다), 이번 하드닝은 이 기존의 "침묵 실패" 경로가 트리거되는 **입력 표면을 넓혔을 뿐**이다(종전엔 이 경로에 도달하려면 boot 이 명시적 undefined 키를 보내는 선재 버그가 필요했는데, 이제는 정상적으로 "boot 이 악성/오설정 apiBase 를 보내는" 경우도 이 경로를 탄다). CRITICAL 로 볼 근거(관측된 회귀·데이터 손상·크래시)는 없지만, 이 파일 자체가 반복적으로 문서화해 온 "silent hang" 패턴(`pendingResetRef`/`teardownSession` JSDoc 참조)과 같은 모양이라 표시해 둔다.
  - 제안: 이번 diff 범위는 아니므로 이 PR 에서 고칠 필요는 없다. 다만 후속으로 이 분기에도 `console.warn` 또는 `dispatch({ type: "ERROR", ... })` 를 추가해 "boot 은 왔는데 apiBase/trigger 가 없어 조용히 아무 일도 안 일어난다"는 상태를 관측 가능하게 만드는 편이 이 파일의 기존 컨벤션(다른 실패 분기는 전부 dispatch 를 남긴다)과 일치한다. plan/spec 후속 티켓으로 남기는 것을 권장.

- **[INFO]** `mergeBootConfig` 반환 타입과 `as BootMessage["apiBase"]` 캐스트 — 기존 패턴의 연장, 새 위험 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:236-246`
  - 상세: `BootMessage.apiBase` 는 `string`(필수, `host-bridge.ts:8`)인데 `mergeBootConfig` 는 실제로 `undefined` 를 반환할 수 있다(회귀 테스트 "쿼리도 없고 boot 도 거절되면 undefined" 로 명시적으로 검증됨). `as BootMessage["apiBase"]` 캐스트로 타입 체커를 우회하는데, 이는 종전 `{ ...configFromQuery(), ...c } as BootMessage` 의 전체-객체 캐스트와 같은 계열의 "타입에게 거짓말"이라 새로 도입된 위험 등급은 아니다. 실행 경로는 위 `applyConfig` 의 `!cfg.apiBase` 런타임 가드가 실제로 커버한다.
  - 제안: 없음(참고용 기록).

- **[INFO]** `bridge.onBoot` 콜백 인자 캐스트(`c as Partial<BootMessage>`) — 불필요하지만 무해
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1344`
  - 상세: `IframeBridge.onBoot` 시그니처(`host-bridge.ts:24`)가 이미 `c: BootMessage` 로 타입을 확정하므로, `BootMessage` 는 구조적으로 `Partial<BootMessage>` 에 캐스트 없이도 대입 가능하다(더 넓히는 방향의 안전한 대입). `as` 캐스트가 새로운 타입 오류를 숨기지는 않는다 — 스타일상 잉여일 뿐 부작용 없음.
  - 제안: 없음.

## 점검 관점별 요약

1. **의도치 않은 상태 변경**: 없음. `safeApiBase`/`mergeBootConfig` 모두 순수 함수(인자만 읽고 새 객체를 만들어 반환). 유일한 side effect 는 `console.warn`(기존과 동일 채널, 문구 포맷도 동일).
2. **전역 변수**: 없음. 새 전역 변수·모듈 top-level mutable state 없음.
3. **파일시스템 부작용**: 없음. `sessionStorage`(`saveSession`/`loadSession`) 경로는 이 diff 가 건드리지 않음.
4. **시그니처 변경**: `safeApiBaseFromQuery` 시그니처는 보존(위임)됨. 새 시그니처 `safeApiBase(raw, source)` 는 신규 export 라 기존 호출부에 영향 없음(호출부는 전부 이 diff 안에서 함께 갱신됨, `configFromQuery` 내부 호출 포함).
5. **인터페이스 변경**: `mergeBootConfig` 신규 export, `safeApiBaseFromQuery` deprecated 유지 — 둘 다 additive. `BootMessage` 인터페이스 자체는 변경 없음.
6. **환경 변수**: 관련 없음.
7. **네트워크 호출**: 없음. `applyConfig`/`fetchEmbedConfig` 호출 여부·타이밍은 이 diff 로 바뀌지 않는다(자세한 근거는 위 "applyConfig" 항목).
8. **이벤트/콜백**: `bridge.onBoot` 콜백이 호출하는 함수가 `runApplyConfig({ ...configFromQuery(), ...c })` 에서 `runApplyConfig(mergeBootConfig(configFromQuery(), c))` 로 바뀌었을 뿐, 콜백 등록·발화 횟수·타이밍은 그대로다.

새 CRITICAL 은 없다. WARNING 도 없다 — 실측(전체 스위트 448/448 GREEN, 옛 이름 실사용처 전수 확인, 선재 버그 의존 코드 전수 확인)으로 뒷받침되는 항목들은 모두 회귀 없음으로 판정했고, 유일하게 남긴 지적(`applyConfig` 침묵 조기 return)은 이번 diff 가 만든 새 코드가 아니라 기존 코드의 기존 동작이라 INFO 로 등급을 매겼다.

## 요약

이번 변경은 `wc:boot` 경로의 `apiBase` 를 쿼리 경로와 동일한 http(s) 스킴 검증에 태우는 하드닝이다. 개명(`safeApiBaseFromQuery`→`safeApiBase`)은 얇은 위임과 문자열까지 동일한 경고 포맷으로 하위호환을 지켰고(실사용처 전수 확인 완료), `mergeBootConfig` 는 정상 http(s) 배포 경로에서 종전 스프레드와 동일한 결과를 내면서 `boot.apiBase` 가 명시적 `undefined` 일 때 쿼리 값을 지우던 선재 버그까지 함께 고쳤다 — 이 선재 버그에 의존하는 코드나 테스트는 저장소 전수 검색으로 존재하지 않음을 확인했다. 전체 유닛 스위트(448건)를 직접 실행해 회귀가 없음을 실측으로 확인했다. 유일하게 남기는 관찰은 diff 범위 밖의 기존 `applyConfig` 조기 return(apiBase 부재 시 무신호 중단)이 이번 하드닝으로 도달 빈도가 늘었다는 점인데, 이는 설계상 의도된 fail-closed 이고 CRITICAL 급 부작용은 아니다.

## 위험도

LOW
STATUS: OK
