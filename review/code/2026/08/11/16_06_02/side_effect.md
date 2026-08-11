# 부작용(Side Effect) Review — webchat-apibase-scheme (라운드 4, 커밋 `4479e771b`)

오케스트레이터가 요청한 4개 확인 항목을 `git show`/실제 소스 대조/`vitest --sequence.shuffle`
실측으로 검증했다. 새 CRITICAL 없음.

## 확인 1 — `href` 복원이 내 직전 INFO(`15_50_53`)를 실제로 해소하는가

**해소됨.** `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:4259-4274`
(`it("유효 쿼리(apiBase만) + 악성 boot → 쿼리 값이 이긴다 (덮어쓰기 차단, e2e)"`)를 직접 열어
`git show 4479e771b -- '*/use-widget-eager-start.test.ts'` 와 대조했다.

- 종전(`15_50_53` 시점): `const original = window.location.search;` 로 **`search` 만** 캡처하고
  복원 시 `window.history.replaceState(null, "", original || "/")` — `pathname` 을 하드코딩
  `"/"` 로 되돌렸다. 내 지적 그대로 jsdom 기본 URL(`http://localhost:3000/`)이 우연히 `pathname
  === "/"` 라 오늘은 맞았을 뿐이다.
- 현재: `const originalHref = window.location.href;`(4261) 로 **origin+pathname+search+hash
  전체**를 캡처하고, `finally` 블록(4272-4274)에서 `window.history.replaceState(null, "",
  originalHref)` 로 **그 전체 문자열을 그대로** 되돌린다. `pathname` 이 `"/"` 가 아닌 값이었어도
  `href` 문자열 안에 보존되므로 이제는 jsdom 기본값에 기대지 않는다 — 캡처·복원 비대칭이 사라졌다.
  주석(4259-4260)도 이 근거를 명시하며 직전 라운드 지적을 인용한다.

이 파일·`use-widget.test.ts` 전체를 grep(`history\.\(replaceState\|pushState\)|window\.location`)한
결과 `window.location`/`history` 를 건드리는 코드는 이 테스트 하나뿐이라, 다른 테스트가 먼저
`pathname` 을 바꿔놓고 이 테스트가 그 값을 삼키는 상호작용 경로도 없다.

## 확인 2 — 테스트 격리 실측 (실행 순서 셔플)

`npx vitest run` 을 실제로 여러 시드로 반복 실행해 확인했다(레포를 수정하지 않고 실행만).

| 대상 | 옵션 | 결과 |
|---|---|---|
| `use-widget-eager-start.test.ts` 단독 | `--sequence.shuffle --sequence.seed=12345` | 78 passed |
| 두 파일 함께 | `--sequence.shuffle --sequence.seed=1` | 98 passed |
| 두 파일 함께 | `--sequence.shuffle --sequence.seed=42` | 98 passed |
| 두 파일 함께 | `--sequence.shuffle --sequence.seed=999` | 98 passed |

모든 시드에서 100% 통과, `location` 관련 실패·다음 테스트로의 오염 관측 없음. 구조적으로도
`try { … } finally { window.history.replaceState(null, "", originalHref); }` 라 `waitFor`/
`expect` 가 던지는 예외를 포함해 어떤 경로로 `try` 블록을 벗어나든 `finally` 는 항상 실행된다 —
assert 실패가 정리를 건너뛰는 부류의 실패 모드(이 파일이 `document.referrer` 에 대해 문서화한
문제, 게이트 250-255)에 이 테스트는 해당하지 않는다.

## 확인 3 — 나머지 두 codebase 변경이 정말 주석뿐인가

`git show 4479e771b -- 'codebase/channel-web-chat/src/widget/use-widget.ts'
'codebase/channel-web-chat/src/widget/use-widget.test.ts'` 로 hunk 단위 대조했다.

- **`use-widget.ts`**: 변경된 줄은 전부 `safeApiBase` JSDoc 블록 내부(각 줄 ` *` 로 시작).
  옛 문장 `> 첫 판은 "…" 고 적었다. **거짓이다.** spec §R0 에서 그 문장을 정정하면서 **여기(코드
  SoT)는 안 고쳤다**…` 를 `> 첫 판은 "…" 고 적었다 — **거짓이다.** 정정 이력은 `4-security.md`
  **§R7** 참고(같은 서술을 여기 되풀이하지 않는다).` 로 축약했다. `export function`/시그니처/
  실행문/호출부 어느 줄도 이 hunk 밖이며 바뀌지 않았다 — 순수 문서 텍스트 리터럴, 컴파일·런타임
  동작 무관.
- **`use-widget.test.ts`**: 변경은 1줄, 주석 텍스트만 — `// `applyConfig` 가 자기 자리에서
  실패하도록 둔다(여기서 throw 하지 않는다).` → `// 여기서 throw 하지 않는다 — `applyConfig`
  가 조용히 반환한다(진단은 `safeApiBase` 의 warn 뿐).`. 바로 아래 `expect(...)` 단언문은
  글자 하나 바뀌지 않았다(`mergeBootConfig(q(undefined), b("data:text/html,<script>")).apiBase`
  단언 동일) — 테스트가 검증하는 동작·통과 조건에 영향 없음.

두 파일 모두 이번 커밋(`4479e771b`) 범위에서는 **주석/JSDoc 텍스트만** 바뀌었다는 주장이 정확하다.

## 확인 4 — 미처분 INFO(전역 `afterEach` 안전망)를 그대로 두는 것이 맞는가

**그대로 둔 것은 합리적이다 — 새 지적으로 올리지 않는다.** 직전 라운드(`15_50_53`)에서 낸 그
INFO 는 애초에 "오늘은 안전하다(실측)"·"blocking 은 아님" 이라고 명시했고, 제안도 "이중 방어선"
목적의 **보강**이지 결함 수정이 아니었다. 이번 라운드의 처분은 그 INFO 가 지목한 실제 결함
축(캡처·복원 비대칭 → `href` 전체 캡처)만 고쳤고, 스타일 성격의 "전역 `afterEach` 에도 한 줄
추가" 제안은 미반영 상태다. 확인 2 의 실측대로 지금의 로컬 `try/finally` 는 `href` 전체를
정확히 캡처·복원하므로 **기능적으로는** 전역 안전망과 동등한 보호를 이미 제공한다(다른 테스트가
`try` 진입 전에 실패할 경로가 없다 — `originalHref` 캡처는 부작용이 없는 단순 읽기라 그 줄
자체가 던질 수 없다). 남은 차이는 "이 describe 블록에 향후 `try/finally` 를 빠뜨린 `it` 이
추가될 경우"에 대한 방어뿐인 잠재적(latent) 리스크로, 실제 회귀는 아니다. 재지적할 근거가
새로 생기지 않았으므로 카운트를 올리지 않는다.

## 그 외 점검 관점 (전역 변수·파일시스템·시그니처·인터페이스·환경변수·네트워크·이벤트)

- **전역 변수**: 신규 전역 변수 도입 없음. `originalHref` 는 `it` 콜백 로컬 변수.
- **전역 상태(`window.location`)**: 테스트 내에서 `history.replaceState` 로 일시 변경 후
  `finally` 에서 원복 — 위 확인 1·2 로 실효성 확인.
- **파일시스템 부작용**: 이 커밋은 `plan/`·`spec/` 마크다운 텍스트 편집뿐, 런타임 파일 I/O
  변경 없음. 리뷰 작업 중에도 저장소에 파일을 추가/수정하지 않았다(`git status --short` 로
  확인 — untracked 는 오케스트레이터가 미리 만든 `review/code/2026/08/11/16_06_02/` 뿐).
- **시그니처/인터페이스 변경**: 이 커밋 단독으로는 없음. `safeApiBase(raw, source)` /
  `mergeBootConfig(fromQuery, boot)` export 시그니처는 이전 커밋들에서 이미 확정·리뷰됨.
- **환경 변수**: 관련 변경 없음.
- **네트워크 호출**: 신규/변경 테스트는 `installFetch()` 로 `fetch` 를 스텁 — 실제 네트워크
  호출 없음.
- **이벤트/콜백**: `bridge.onBoot` 콜백 배선은 이 커밋에서 변경되지 않음(주석만 위쪽에서 바뀜).

## CRITICAL / WARNING

없음.

## 요약

직전 라운드 INFO 가 지적한 "e2e 테스트가 `search` 만 캡처해 `pathname` 을 잃을 수 있다"는
문제는 `href` 전체 캡처/복원으로 정확히 해소됐고(`git show` diff 대조 + 4개 시드 셔플 실행
전부 통과로 실증), `try/finally` 구조 덕에 assert 실패 경로에서도 격리가 깨지지 않는다. 나머지
두 codebase 변경(`use-widget.ts` JSDoc 축약, `use-widget.test.ts` 주석 1줄)은 hunk 단위 대조
결과 실행 코드·단언문에 영향이 없는 순수 텍스트 변경이 맞다. 미반영 상태인 "전역 `afterEach`
안전망" INFO 는 원래 non-blocking 제안이었고 현재 로컬 `try/finally` 가 기능적으로 동등한
보호를 제공하므로 그대로 두는 판단에 동의하며 재지적하지 않는다. 새 CRITICAL 없음.

## 위험도

NONE

STATUS: OK
