# RESOLUTION — `10_24_54`

Critical 0 / Warning 6 **전부 처분**. 처분 커밋: `8eb223c19`.

## W1 (testing) — `sseErrorDetail` 에 직접 회귀 부재 → **고침**

내가 그 헬퍼를 만들면서 **회귀를 안 붙였다.** 통합 회귀는 "토큰이 안 나온다" 만 보므로,
`readyState` 추출을 통째로 `return "error"` 로 뭉개도 위젯 75건이 전부 GREEN 이었다 —
**없애려던 결함(진단 정보 0)이 그대로 돌아와도 아무도 모른다.**

두 축은 서로 다른 테스트가 잡아야 한다. `use-widget.test.ts` 에 단위 회귀 3건:
`readyState` 를 담는가 / `target.url` 이 있어도 토큰·URL 을 안 담는가 / `readyState` 부재 시
문자열은 여전히 반환하는가. **뮤테이션 RED 확인**(testing 이 지목한 그 뮤턴트).

헬퍼를 `export` 로 바꾸고 `@internal — unit-test seam only` 를 달았다(이 저장소의 기존 관례).

## W2 (maintainability) — 헬퍼 배치 → **고침**

`useWidget()` **안에** 선언됐는데 들여쓰기가 0칸이라 module-level 로 오독되고, 하필
`openStream` 의 JSDoc(437-458)과 그 정의(479) **사이에** 끼어 읽는 흐름을 끊었다. 이 파일은
순수 헬퍼를 훅 위 module scope 에 두는 컨벤션(`fetchEmbedConfig`·`isEmbedAllowed`)이 있어
그 자리로 옮겼다.

## W3 (maintainability) — 주석 밀도 → **부분 고침**

지적이 맞다 — 719/1358줄(52.9%). "지역 변수 말고 `sessionRef.current` 를 읽어라" 가 **네 곳에
전문 복제**돼 있었고, 그중 한 곳은 이미 "위 주석 참조" 포인터를 쓰는데 나머지가 안 따랐다.
두 곳을 포인터로 축약했다.

"가드를 한쪽에만" 모티프(6회)·뮤테이션 생존 메모(4회)는 **지우지 않았다** — 리뷰어도 지점별
근거가 있다고 판단했고, 이 브랜치에서 그 형태가 실제로 여덟 번 재발했다. 다만 "다음 라운드가
늘리면 통합 검토" 라는 리뷰어 조건에는 동의한다.

## W4 (requirement) — spec 인용 오류 → **고침**

`4-security.md §5` 는 프라이버시 절이고, 에러 문구 정책은 **§1 표의 "에러 메시지 노출" 행**이다.
선행 오류(`b9acf02c7` 부터 존재)지만 **이번에 내가 한 곳 더 늘렸으므로** 두 곳 다 정정했다.

## W5 (side_effect) — stale 가드 비대칭 → **불변식 명시 + 등재**

`start()`/`sendCommand` 의 catch 는 `isStale(gen)` 부터 묻는데 `runApplyConfig` 는 안 묻는다.
**구조적으로 못 묻는다** — `attempt` 토큰이 `applyConfig` 안에서 발급돼 이 클로저에 없다.

**리뷰어도 나도 재현 경로를 찾지 못했다**: `applyConfig` 안의 모든 `await` 는 자체 try/catch·
반환값으로 닫혀 있고, 유일한 실제 throw(EventSource 동기 실패)는 checkpoint 2 **직후 동기
구간**에서만 일어난다. 즉 안전성이 가드가 아니라 **"checkpoint 뒤엔 동기 구간만 온다"는 규율**에
기댄다.

가드를 넣으려면 `applyConfig` 가 `attempt` 를 밖으로 내보내야 하고 그건 범위 밖 구조 변경이다.
대신 **그 규율을 코드 주석에 명시**하고, 깨지는 조건("checkpoint 2 뒤에 `await` 추가")을
트리거로 plan 에 등재했다 — 조건 없는 등재는 유실과 같다는 지난 라운드 교훈을 따른다.

## W6 (scope) — SUMMARY 집계표 불일치 → **인정, 이번 SUMMARY 에서 교정**

`10_02_22/SUMMARY.md` 의 reviewer별 Warning 수 합이 본문 W1~W7 나열과 어긋났다. 지난 산출물을
사후 편집하지 않고(기록이므로) 이번 SUMMARY 에서 **집계와 나열이 일치하는지 확인한 뒤** 썼다.

## 검증

- 위젯 vitest **439 passed** (23 files, +3).
- harness/doc guards **1032 passed / 1128 subtests**.
- `tsc --noEmit` **0 errors**.
- 뮤테이션 **누적 16종** — 이번 1종 추가, RED 확인.

## 수렴 판정

**이 라운드로 수렴으로 본다.** 근거는 "발견 0" 이 아니라 **발견의 성격**이다 — 동작 CRITICAL 이
0 이고(라운드 6 이후 처음), 남은 6건이 커버리지·배치·밀도·인용·재현불가 구조 비대칭이다.
security·documentation 이 NONE 을 냈고 requirement 는 `implemented` 판정이 **더 정당해졌다**고
적었다. 라운드를 더 도는 것이 이 시점에 더 낫다는 근거가 없다.
