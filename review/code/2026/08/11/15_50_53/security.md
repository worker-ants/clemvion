# Security Review — webchat `apiBase` 스킴 검증, 최종 라운드 (`15_50_53`)

## 점검 배경

직전 2라운드(`15_16_20` LOW→`15_32_44` NONE)에서 이미 `safeApiBase`/`mergeBootConfig` 의
검증 로직 자체는 완성됐고 CRITICAL/WARNING 없이 수렴했다고 보고됐다. 이번 라운드의 새 델타는
커밋 `99d3e9000`으로, 실제로 `git show --stat 99d3e9000` 로 확인하면:

- `use-widget.ts` (+12/-4): **JSDoc 문단만** 수정(§R0 정정을 코드 쪽에도 반영) — 로직 변경 없음.
- `use-widget-eager-start.test.ts` (+32/0): 신규 `it()` 1건 순수 추가(기존 테스트 삭제/수정 없음).
- `webchat-boot-apibase-scheme-validation.md`(plan, complete) — 완료 노트 정정.
- `webchat-auth-session-status-reconcile.md`(plan, in-progress) — 완료 조건 표에 새 행 추가.
- `spec/7-channel-web-chat/2-sdk.md`(+2/-1), `4-security.md`(72줄, 대부분 `R0`→`R7` 재번호 이동) — 문서 동기화.

즉 이번 델타 자체는 검증 로직을 전혀 건드리지 않는다. 아래는 이 PR **전체**(3f1169ab5 →
d8abc7003 → 99d3e9000)를 마지막으로 훑어 요청받은 3가지 질문에 답한 결과다.

## 요청 항목 1 — `safeApiBase` 술어가 3라운드 내내 불변인가

**불변 확인.** 현재 `codebase/channel-web-chat/src/widget/use-widget.ts:205-218`:

```ts
export function safeApiBase(
  raw: string | null | undefined,
  source: "configFromQuery" | "wc:boot",
): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return raw;
  } catch {
    /* 파싱 불가 — 아래 경고 후 무시 */
  }
  console.warn(`[widget] ${source}: apiBase 가 http(s) URL 이 아니어서 무시합니다:`, raw);
  return undefined;
}
```

`new URL(raw)` 파싱 + `protocol === "http:" || "https:"` 화이트리스트라는 술어는 라운드 1
(`3f1169ab5`, 당시 이름 `safeApiBaseFromQuery`)부터 지금까지 **문자 그대로 동일**하다. 라운드
2(`d8abc7003`)는 `source` 파라미터를 추가해 두 호출부(쿼리/`wc:boot`)를 하나의 함수로
합쳤을 뿐 분기 로직·정규식·프로토콜 목록을 건드리지 않았고, 라운드 3(`99d3e9000`)은 이 함수
바로 위의 JSDoc 산문만 고쳤다(`git show 99d3e9000` 로 diff 확인 — 함수 본문 라인은 diff 밖).
라운드 1 security 리뷰어가 실측한 8가지 우회 시도(대소문자, 탭/공백 삽입, 백슬래시, 전각
콜론, `blob:`/`filesystem:` 등)는 이 술어가 `new URL()` 정규화 뒤에 비교하는 구조상 여전히
유효하다 — 이번 라운드에서 재실측해도 술어 자체가 안 바뀌었으므로 결론이 달라질 이유가 없다.

## 요청 항목 2 — 직접 로드 폴백 경로의 `apiBase` 는 검증되는가

**검증된다. 새 사각지대 아니다.** 문제의 코드(`use-widget.ts:1377-1381`):

```ts
// host 없이 직접 로드(샘플/개발): query param 만으로도 부팅 시도.
const fallback = configFromQuery();
if (fallback.apiBase && fallback.triggerEndpointPath) {
  runApplyConfig(fallback as BootMessage);
}
```

`fallback`은 `configFromQuery()`의 반환값이고, `configFromQuery`(`use-widget.ts:221-228`)
내부에서 `apiBase` 필드는 반드시 `safeApiBase(q.get("apiBase"), "configFromQuery")`를 거쳐
채워진다(`use-widget.ts:224`). 즉 이 폴백 경로는 **`mergeBootConfig`가 신설되기 전부터
이미 검증된 값만 흘렸다** — `wc:boot` 경로만 무검증이었던 것이지, 쿼리 단독 폴백 경로는 최초
커밋(구 `safeApiBaseFromQuery`)부터 지금까지 한 번도 무검증이었던 적이 없다. `fallback.apiBase`가
스킴 거절로 `undefined`가 되면 `if` 조건 자체가 거짓이라 `runApplyConfig`가 호출되지 않고,
설령 호출되더라도 `applyConfig`(`use-widget.ts:1229`) 최상단의
`if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` 가 이중으로 막는다. 라운드 1 security
리뷰어(`review/code/2026/08/11/15_16_20/security.md`)와 requirement 리뷰어
(`review/code/2026/08/11/15_16_20/requirement.md`)가 이미 같은 결론을 각자 독립적으로
실측했고, 이번 라운드 재확인에서도 동일하다.

## 요청 항목 3 — 두 경로(boot 병합·직접 로드 폴백) 모두 검증을 거치는가

**둘 다 거친다.** `grep -n "apiBase" use-widget.ts` 로 `applyConfig`에 전달되는 `BootMessage`가
만들어지는 지점을 전수 확인하면 정확히 두 곳뿐이다:

1. `bridge.onBoot` 콜백(`use-widget.ts:1343-1345`): `runApplyConfig(mergeBootConfig(configFromQuery(), c))`
   — `mergeBootConfig`(`use-widget.ts:236-247`)가 `boot.apiBase`를 `safeApiBase(boot.apiBase, "wc:boot")`로
   검증하고, 거절/부재 모두 쿼리가 준 이미 검증된 값으로 되돌린다(`??` 폴백).
2. 직접 로드 폴백(`use-widget.ts:1377-1381`): `configFromQuery()`가 이미 `safeApiBase(..., "configFromQuery")`로
   검증한 값을 그대로 사용.

`applyConfig`로 들어가는 `cfg: BootMessage`의 `apiBase`가 이 두 생성 지점 밖에서 조립되는
경로는 없다(`cfg.apiBase`의 실제 소비처는 `use-widget.ts:865`(세션 바인딩 기록), `:1204`
(`EiaClient` 생성), `:1236`(`isEmbedAllowed`), `:1259`(`loadSession` 발급-origin 대조) —
전부 `:1229`의 조기 `return` 가드 **뒤**에 있어 미검증 값이 도달할 수 없다).

## 그 외 관찰 (INFO, 새 표면 아님)

- **[INFO]** `safeApiBase`는 스킴만 검증하고 host/origin은 검증하지 않는다 — 라운드 1부터
  문서화된 설계 결정(`spec/7-channel-web-chat/4-security.md` §R7, `4-security.md:39`)이며
  이번 라운드가 넓히거나 좁히지 않았다.
- **[INFO]** `wc:boot` 필드 중 `apiBase` 만 스킴 검증 대상이고 `triggerEndpointPath`(encode 후
  path segment로만 소비) 등 나머지 필드는 여전히 boot 우선 — 위협 프로파일이 다르므로 비대칭
  유지가 합당하다는 판단도 라운드 1~2에서 이미 검토됐고 이번 델타가 건드리지 않았다.
- **[INFO]** `applyConfig`의 조기 `return`이 `console.warn`/`dispatch` 없이 조용히 빠지는
  선재 갭은 `plan/in-progress/webchat-auth-session-status-reconcile.md`(diff 게이트 25행,
  `> | §applyConfig 조용한 early return | ...`)에 이미 등재돼 있다 — 이번 커밋은 그 문서의
  "완료 조건" 표에 행을 추가했을 뿐 갭 자체를 새로 만들거나 넓히지 않았다(도달 빈도만 넓혔다는
  서술은 라운드 1부터 일관).

## 결론 — 3라운드 대비 보안 표면 증감

**증감 없음.** `safeApiBase`의 검증 술어는 문자 그대로 불변이고, boot 경로(신규 하드닝
대상이었던 곳)와 직접 로드 폴백 경로(원래도 검증돼 있던 곳) 둘 다 현재 코드에서 검증을
거친다. 이번 델타(`99d3e9000`)는 JSDoc/spec 산문 정정 + 판별력 있는 테스트 1건 추가일 뿐
런타임 로직을 전혀 바꾸지 않아, 표면이 넓어지거나 좁아질 여지 자체가 없었다. 새로 도입된
CRITICAL/WARNING 은 없다.

## 위험도

NONE

STATUS: OK
