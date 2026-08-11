# 보안(Security) Review — `4479e771b` (라운드 4, 델타 한정)

## 점검 범위와 방법

직전 3라운드(`15_16_20`/`15_32_44`/`15_50_53`)가 전부 NONE 으로 수렴했고, 이번 델타(`4479e771b`)는
diff 상 (1) JSDoc 주석 2곳(죽은 `§R0` 앵커 → `§R7`, `applyConfig` 침묵 서술 정정), (2)
`use-widget.test.ts` 주석 1줄, (3) `use-widget-eager-start.test.ts` 의 `location.search` →
`location.href` 캡처 전환(테스트 정리 복원 정확도) 뿐이다. 오더가 지정한 대로 코드를 다시 열어
검증 술어·배선 4자리가 여전히 불변인지 실측했고, spec `§1` 신규 서술이 보안 판단에 영향을 주는지
분석했다.

## 배선 4자리 실측 (모두 불변 확인)

`codebase/channel-web-chat/src/widget/use-widget.ts` 를 직접 읽어 확인:

1. **`safeApiBase`** (`use-widget.ts:204-217`) — `http:`/`https:` 스킴만 통과시키고 그 외(파싱 불가,
   `javascript:`/`data:`/상대경로 등)는 `console.warn` 후 `undefined` 반환. 로직 자체는 이번 델타에서
   손대지 않았다(JSDoc 본문의 `§R0`→`§R7` 참조 정정만).
2. **`configFromQuery`** (`use-widget.ts:220-227`) — `q.get("apiBase")` 를 그대로 `safeApiBase(raw,
   "configFromQuery")` 에 넘겨 검증한다. 우회 경로 없음.
3. **`mergeBootConfig`** (`use-widget.ts:235-246`) — `boot.apiBase` 를 `safeApiBase(boot.apiBase,
   "wc:boot")` 로 먼저 검증하고, 거절·명시적 `undefined` 양쪽 다 `fromQuery.apiBase`(이미 검증된 값)로
   폴백한다(`??`). spread 에 맡기지 않는다는 주석대로 실제 대입도 명시적 계산이다.
4. **호출부 배선** — `bridge.onBoot((c) => { runApplyConfig(mergeBootConfig(configFromQuery(), c)); })`
   (`use-widget.ts:1342-1344`)와 **직접 로드 폴백** `const fallback = configFromQuery(); if
   (fallback.apiBase && fallback.triggerEndpointPath) runApplyConfig(fallback as BootMessage);`
   (`use-widget.ts:1376-1380`) 둘 다 검증된 헬퍼만 거쳐 `runApplyConfig` 에 들어간다. `{ ...q, ...c }`
   같은 옛 인라인 spread 로 되돌아간 흔적 없음.

네 자리 모두 라운드 1~3 에서 확립된 형태 그대로이며, 이번 델타는 이 배선을 건드리지 않았다(주석/테스트
정리만). **회귀 없음.**

## spec `§1` 신규 서술("정상 임베드에서 두 경로가 순차 발동")의 보안 영향 분석

`spec/7-channel-web-chat/4-security.md:39` 가 이번에 명확히 한 사실: SDK 의 `resolveIframeTarget`
이 iframe src 쿼리에 `apiBase`/`trigger` 를 싣고, 위젯 마운트 시 `configFromQuery()` 기반 직접-로드
폴백(`use-widget.ts:1376-1380`)이 **host 유무와 무관하게** 그 값으로 먼저 부팅을 시도한 뒤, 이어서
도착하는 `wc:boot` postMessage 가 `mergeBootConfig` 로 그 config 를 대체한다. 즉 정상 임베드에서
`runApplyConfig` 가 **순차로 두 번** 불릴 수 있다는 서술이다.

이것이 보안 판단을 바꾸는지 확인한 결과 — **바꾸지 않는다. 새 표면이 아니다**:

- **두 값의 출처가 같다.** 정상 임베드에서 iframe 쿼리의 `apiBase` 와 `wc:boot` 의 `apiBase` 는 둘 다
  host 가 SDK 에 넘긴 **같은 `config.apiBase`** 에서 파생된다(`resolveIframeTarget`/`boot()` 가 같은
  `config` 를 두 채널로 보낸다는 것은 이미 문서화 리뷰어가 소스로 확인함). 즉 순차 발동은 "독립된
  두 신뢰 수준의 입력이 경쟁"하는 것이 아니라, 같은 신뢰 경계 안의 값이 두 채널로 두 번 도착하는
  것이다.
- **두 채널 모두 동일하게 검증된다.** 이 PR 의 핵심이 바로 그 대칭화였다 — 검증 술어(1)에서 확인한
  대로 쿼리·boot 양쪽 다 `safeApiBase` 를 거친다. 순차 발동 자체가 검증을 우회할 경로를 열지 않는다.
- **먼저 뜬 시도는 staleness 가드로 무력화된다.** `applyConfig` 는 `beginBootAttempt`/`worldGenRef`
  기반 attempt 토큰으로 세대를 추적하고(`use-widget.ts:1233` 부근, `isAttemptStale`), 뒤에 오는
  `wc:boot` 유래 `runApplyConfig` 가 새 세대를 열면 먼저 시작된 쿼리 유래 시도는 `isAttemptStale`
  가드로 자기 진행을 멈춘다(이 저장소가 이미 "종료/staleness 가드" 스위트로 회귀 고정해 둔 매커니즘 —
  이번 델타가 신설한 것도 아니고 손댄 것도 아니다). 따라서 "먼저 부팅한 뒤 나중에 대체되는 창"이
  토큰/세션을 잘못된 origin 에 흘리는 방식으로 악용되려면, 그 대체 로직 자체가 별도로 깨져야 하는데
  이번 델타는 그 로직을 건드리지 않았다.
- **origin 불일치 방어가 별도 축으로 이미 있다.** 두 채널이 다른 `apiBase` 를 실었다고 가정해도(예:
  악성 host 가 두 채널에 다른 값을 심는 시나리오), `4-security.md` §R8/저장 세션의 발급-origin
  바인딩(`loadSession(path, apiBase)`)이 옛 origin 토큰을 새 origin 으로 넘기지 않고 폐기·재시작한다.
  즉 순차 발동이 만드는 "먼저 뜬 세션이 나중 세션에 자격을 흘리는" 시나리오는 스킴 검증과는 별개 축인
  origin 바인딩이 이미 막는 설계다.

결론적으로 이 서술 추가는 **동작을 바꾼 것이 아니라 기존에 이미 그렇게 동작하던 것을 정확히 문서화한
것**이다(cross_spec 이 잡은 것은 "쿼리 경로 = 샘플 전용" 이라는 **오서술**이지 새 동작이 아니다). 보안
관점에서 위험도를 올리는 사실이 아니라, 오히려 "쿼리 경로를 dev-only 로 오인해 검증/코드를 제거하면
정상 임베드가 깨진다"는 **하드닝 유지 근거**를 강화하는 서술이다.

## 발견사항

없음. 억지로 만들 만한 자리가 보이지 않는다.

- 참고(비-발견, INFO 수준 관찰): `use-widget.ts:1376` 의 코드 주석 `// host 없이 직접 로드(샘플/개발):
  query param 만으로도 부팅 시도.` 는 이번에 spec 이 명확히 한 "정상 임베드에서도 이 경로가 먼저
  발동한다"는 사실과 어긋나는 인상을 준다. 다만 이는 문서 정확성 문제(문서화/유지보수성 리뷰어 영역)이지
  보안 결함이 아니다 — 검증 배선은 이 주석의 진위와 무관하게 두 경로 모두에 대칭 적용돼 있다.

## 요약

배선 4자리(`safeApiBase`/`mergeBootConfig`/`configFromQuery`/직접 로드 폴백)를 코드로 재확인한 결과
라운드 1~3 에서 확립된 형태가 그대로 유지되고 있고, 이번 델타(주석 2곳 + 테스트 1줄)는 이 배선에
손대지 않았다. spec `§1` 에 새로 추가된 "정상 임베드에서 두 경로가 순차 발동한다"는 서술은 실제
동작(이전부터 존재하던 동작)을 정확히 기술한 것일 뿐 새로운 코드 변경이 아니며, 두 채널이 같은 신뢰
경계의 같은 값을 나르고 양쪽 다 동일한 스킴 검증을 거치며, 순서가 뒤바뀌어도 attempt staleness
가드와 별도의 발급-origin 바인딩(§R8)이 각각 독립적으로 방어하므로 새로운 공격 표면을 만들지 않는다.

## 위험도

NONE
STATUS: OK
