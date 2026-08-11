# 테스트(Testing) 리뷰 — webchat-apibase-scheme (커밋 `4479e771b`, 라운드 재검증)

이번 델타는 `codebase/**` 기준 3개 파일뿐이다:
1. `use-widget.ts` — JSDoc blockquote 축약(죽은 `§R0` 참조 제거, **주석만**)
2. `use-widget.test.ts` — 주석 한 줄 문구 정정(**주석만**)
3. `use-widget-eager-start.test.ts` — e2e 회귀의 `location.search` 캡처 → `location.href` 전체 캡처/복원(**실행 코드 변경**)

지시된 4개 확인 항목을 전부 **직접 실행/뮤테이션 실측**으로 검증했다 (scratch 사본, `git checkout`/`restore` 미사용, 원복은 `cp`/문자열 치환 후 `diff`로 원본과 바이트 동일함 확인).

## 확인 1 — `href` 복원이 `search` 복원과 동치인가? (격리 차이 실측)

**동치 아님 — `href` 전체 캡처가 구조적으로 더 정확하다.** jsdom(`JSDOM` 직접 사용)으로 독립 프로브를 만들어 세 가지 시작 URL에 대해 구(舊) 방식(`search` 만 캡처 + `original || "/"` 복원)과 신(新) 방식(`href` 전체 캡처/복원)을 비교했다:

| 시작 URL | 구 방식 복원 결과 | 신 방식 복원 결과 |
|---|---|---|
| `http://localhost:3000/` (오늘의 실제 jsdom 기본값) | `http://localhost:3000/` (**일치**) | `http://localhost:3000/` (**일치**) |
| `http://localhost:3000/embed/widget` (가상: pathname 이 root 가 아닌 경우) | `http://localhost:3000/` (**pathname 유실**) | `http://localhost:3000/embed/widget` (**일치**) |
| `http://localhost:3000/?foo=bar#frag` (가상: 기존 query+hash 존재) | `http://localhost:3000/?foo=bar` (**hash 유실**) | `http://localhost:3000/?foo=bar#frag` (**일치**) |

즉 구 방식은 `original` 이 빈 문자열일 때 `|| "/"` 폴백이 발동해 **pathname 전체를 root 로 덮어쓰고**, `hash` 는 애초에 캡처 대상이 아니라 항상 유실된다. 신 방식은 두 경우 모두 정확히 복원한다. 다만 **오늘 이 저장소의 실제 조건**(이 테스트가 파일의 마지막 `it()`이고, 같은 파일에 `location.*` 을 건드리는 다른 테스트가 없으며, jsdom 기본 URL 이 root pathname·hash 없음)에서는 구·신 두 방식이 **동일한 결과**를 낸다 — 커밋 메시지 자체가 "오늘은 jsdom 기본이 `/` 라 우연히 맞았을 뿐" 이라 서술한 바와 정확히 일치한다.

**실행 순서를 섞어 실측**: `use-widget-eager-start.test.ts` (78건)을 `--sequence.shuffle` 로 seed 1/42/999 세 번 재실행 — 매번 **78 passed**, 순서 의존 실패 없음. `grep`으로 확인한 결과 이 파일에서 `window.history.replaceState`/`location.` 을 건드리는 곳은 이 테스트 하나뿐이고, 그마저 파일의 마지막 테스트라 파일 내 순서 교란으로는 관측 가능한 차이가 안 만들어진다(예상대로). 또한 vitest 는 파일마다 독립된 jsdom 환경을 새로 만들므로(기본 `isolate: true`, `--no-isolate` 미사용 확인) 다른 파일로의 누수도 없다.

**결론**: 이번 변경은 테스트의 **의도(무엇을 검증하는가)를 바꾸지 않았다** — 세 개의 `expect` 는 그대로다. 다만 cleanup 의 **정확성(latent 격리 버그 제거)**을 개선한 방어적 수정이며, 오늘 조건에서는 관측 가능한 회귀 위험이 없다.

## 확인 2 — 세 축 판별력(스킴 무력화 · warn 제거 · 병합 우선순위 역전) 유지 여부

scratch 사본(원 저장소 밖, `node_modules` 는 절대경로 symlink)에서 각 뮤턴트를 직접 적용해 재실측했다. 원복 후 매번 `diff` 로 원본 저장소 파일과 바이트 동일함을 확인했고, 실 워크트리(`git status --short`)는 시종 clean 이었다.

- **베이스라인**: `use-widget.test.ts` + `use-widget-eager-start.test.ts` = 98 passed (뮤테이션 전/후 모두 재확인).
- **스킴 무력화** (`safeApiBase` 를 `if (!raw) return undefined; return raw;` 로 바꿔 검증을 통째로 우회) → **8건 RED** (단위 5 + e2e 2, 자매 회귀까지 연쇄).
- **warn 제거** (`console.warn(...)` 호출 삭제) → **6건 RED**.
- **병합 우선순위 역전 = 호출부만 옛 코드로 되돌리기** (`runApplyConfig(mergeBootConfig(...))` → `runApplyConfig({ ...configFromQuery(), ...c } as BootMessage)`) → **2건 RED** (`use-widget-eager-start.test.ts` 의 신규 e2e 2건). 직전 라운드 plan 노트는 "1건 RED" 라 적었는데, 이는 그 시점에 e2e 가 1건뿐이었기 때문 — 이번 라운드에서 e2e 가 3건으로 늘며 그중 2건이 이 축을 잡는다(1건 "정상 http(s) apiBase" 는 병합 순서와 무관하게 통과하는 것이 논리적으로 맞다). 수치 증가는 판별력 약화가 아니라 **강화**다.

세 축 모두 여전히 살아있고, 이번 커밋의 주석 전용 변경(파일 1·2)은 이 판별력에 아무 영향을 주지 않았다.

## 확인 3 — 폴백 제거 뮤턴트 (`?? fromQuery.apiBase` 삭제) → 여전히 4건 RED인가

`merged.apiBase = (safeApiBase(boot.apiBase, "wc:boot") ?? fromQuery.apiBase) as BootMessage["apiBase"];` 를 `merged.apiBase = safeApiBase(boot.apiBase, "wc:boot") as BootMessage["apiBase"];` 로 되돌려 실측:

```
× use-widget.test.ts > mergeBootConfig ... > **덮어쓰기 차단** — 비-http(s) boot 값이 검증된 쿼리 값을 덮지 못한다
× use-widget.test.ts > mergeBootConfig ... > 상대 경로 boot 값도 거절 — 위젯은 CDN origin 이라 host 로 해소되지 않는다
× use-widget.test.ts > mergeBootConfig ... > boot 이 apiBase 를 아예 안 보내면 쿼리 값이 그대로 산다 (거절과 부재를 가른다)
× use-widget-eager-start.test.ts > ... > 유효 쿼리(apiBase만) + 악성 boot → 쿼리 값이 이긴다 (덮어쓰기 차단, e2e)
Tests  4 failed | 94 passed (98)
```

정확히 **4건 RED** — plan(`webchat-boot-apibase-scheme-validation.md`)의 서술과 일치. 회귀 상태 없이 유지된다.

## 확인 4 — 파일 1·2가 주석뿐인가 (실행 코드 무변경)

- `use-widget.ts`: `git show 4479e771b` diff 를 직접 확인 — 변경분은 JSDoc blockquote 4줄 축약뿐이다(`> 첫 판은 ... §R0 에서 정정하면서 ... 여기(코드 SoT)는 안 고쳤다 (ai-review ... CRITICAL)` → `> 첫 판은 ... — 거짓이다. > 정정 이력은 4-security.md §R7 참고`). 코드 라인·시그니처·로직은 0줄 변경.
- `use-widget.test.ts`: 변경분은 `mergeBootConfig` describe 블록의 주석 한 줄(`// applyConfig 가 자기 자리에서 실패하도록 둔다` → `// 여기서 throw 하지 않는다 — applyConfig 가 조용히 반환한다`)뿐이다. 해당 `it()` 의 `expect(...)` 단언은 diff 전후로 문자 그대로 동일함을 `Read` 로 직접 대조 확인. `mergeBootConfig` 6건 단위 테스트 구성(정상 배포/덮어쓰기 차단/거절+부재/상대경로 거절/부재-폴백/비-apiBase 우선순위)도 그대로다.

두 파일 모두 **실행 가능한 코드/단언 변화 0줄** — 테스트 관점에서 회귀 위험이 원천적으로 없다.

## 발견사항

억지로 만든 발견 없음. 다음은 순수 참고용 INFO이며 blocking 아니다.

- **[INFO]** `use-widget-eager-start.test.ts` 의 `console.warn` 스파이는 이 describe 블록에 로컬 `afterEach` 가 없지만, 파일 최상단(`use-widget-eager-start.test.ts:243~249`)의 전역 `afterEach(() => { ...; vi.restoreAllMocks(); })` 가 모든 `vi.spyOn` 을 자동 복원하므로 실질적 격리 문제 없음. 확인차 기록.
- **[INFO]** `location.href` 복원 로직은 오늘 조건(이 테스트가 파일의 유일한 `location` 조작 지점이자 마지막 테스트, jsdom 기본 URL 이 root)에서는 구 방식과 관측 결과가 동일하다 — 즉 이번 수정은 **현재 관측 가능한 버그를 고친 것이 아니라, 향후 이 describe 블록에 pathname/hash 가 다른 상태에서 도는 테스트가 추가되거나 파일 순서가 바뀔 때를 대비한 선제 하드닝**이다. 이미 커밋 메시지·인라인 주석에 정확히 그렇게 명시돼 있어 별도 조치 불요.

## 요약

이번 델타는 사실상 문서/주석 정리(파일 1·2, 실행 코드 0줄 변경)와 e2e 테스트 하나의 cleanup 로직 강화(파일 3, `search`+fallback → `href` 전체 캡처/복원)로 구성된다. `href` 복원은 `search` 복원과 동치가 아니라 — 독립 jsdom 프로브로 실측한 결과 pathname 이 root 가 아니거나 hash 가 있는 경우 구 방식은 상태를 유실시키는 반면 신 방식은 정확히 복원한다 — 이며, 오늘의 실제 조건(root pathname, 파일 내 유일한 location 조작 지점, 파일별 격리된 jsdom)에서는 두 방식이 우연히 같은 결과를 내므로 회귀 위험은 없다. 이 저장소가 반복 겪어온 "판별력 있는 테스트인가"를 검증하는 세 축(스킴 무력화 8 RED·warn 제거 6 RED·호출부 병합 우선순위 역전 2 RED)과 폴백 제거 뮤턴트(정확히 4 RED)를 scratch 사본에서 직접 재실행해 모두 여전히 캐치됨을 확인했다. `--sequence.shuffle` 3회 재실행(78/78 passed)으로 파일 내 순서 의존 실패도 없음을 확인했다. 전체 스위트도 451 passed 로 plan 의 최종 수치와 일치한다. 새 CRITICAL/WARNING 없음.

## 위험도

NONE

STATUS: OK
