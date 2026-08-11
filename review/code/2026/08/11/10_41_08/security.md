# 보안(Security) Code Review

대상: 웹채팅 위젯 `sseErrorDetail` 을 `useWidget()` 내부 클로저 → module-level `export` 함수로
이동(라운드 11, 커밋 `8eb223c19`) + 그 헬퍼를 직접 겨냥하는 단위 회귀 3건 추가
(`use-widget.test.ts`). 그 외 파일은 이전 라운드(`16_09_40`~`10_24_54`) 산출물·plan 문서
갱신으로, 이번 라운드의 신규 코드 변경이 아니다.

## 재확인 대상 (a) — `sseErrorDetail` export 화 자체가 위험을 만드는가

`codebase/channel-web-chat/src/widget/use-widget.ts` 를 직접 열어 확인했다.

```ts
/** @internal — unit-test seam only. 이 헬퍼의 회귀는 `use-widget.test.ts` 가 직접 겨냥한다. */
export function sseErrorDetail(e: unknown): string {
  const target = e && typeof e === "object" ? (e as { target?: unknown }).target : null;
  const readyState =
    target && typeof target === "object" && "readyState" in target
      ? (target as { readyState: unknown }).readyState
      : null;
  return readyState === null ? "error" : `error (readyState=${String(readyState)})`;
}
```

- **구현 자체는 이번 delta 에서 변경되지 않았다.** `git show 8eb223c19` 로 diff 를 직접
  대조했다 — 이 함수는 `useWidget()` 안에서 밖으로 **위치만** 옮겨졌고(들여쓰기 0칸 오독
  방지, maintainability WARNING 반영), 본문·시그니처는 바이트 단위로 동일하다. 직전
  라운드(`10_24_54`, 그때는 module-private `function sseErrorDetail`)가 "접근 필드는
  `e.target.readyState` 하나뿐, `target.url` 에는 전혀 접근하지 않는다" 를 이미 확인해
  안전 판정을 냈고, 그 근거는 함수 본문이 그대로이므로 이번에도 유효하다.
- **`export` 가 실질적으로 넓히는 표면은 "테스트가 이 함수를 직접 import 할 수 있다" 는
  것뿐이다.** 저장소 전체(`grep -rn "sseErrorDetail"`, `.test.ts` 제외)에서 이 함수를 쓰는
  자리는 정의부(`use-widget.ts:204`)와 유일한 호출부(`use-widget.ts:500`, `openStream` 의
  `onError` 핸들러 안)뿐이다 — 다른 프로덕션 모듈이 새로 import 하지 않는다.
- **함수가 순수하고 부작용이 없다** — 인자로 받은 객체에서 `target.readyState` 한 필드만
  읽어 문자열을 조립할 뿐, I/O·상태 변경·예외 노출이 없다. 임의의 호출자가 임의의 `e` 를
  넘겨도 반환값은 `"error"` 또는 `"error (readyState=<값>)"` 형태를 벗어나지 않는다(값
  자체도 `String()` 강제 변환일 뿐 원본 객체를 그대로 노출하지 않음). export 여부와 무관하게
  이 함수가 뽑아낼 수 있는 정보의 상한은 애초에 "토큰·URL 없음" 으로 고정돼 있다.
- `@internal — unit-test seam only` JSDoc 은 TypeScript 접근제어자가 아니라 문서 수준
  경고다 — 이론적으로 다른 코드가 이 export 를 프로덕션 로직에 재사용할 여지를 완전히
  막지는 못한다. 다만 그 남용이 일어나도 함수 자체가 안전한 값만 반환하므로 보안 등급을
  올릴 사안은 아니다(INFO 수준 관찰로만 기재).

**결론: export 전환 자체는 새 위험을 만들지 않는다.** 함수 구현이 불변이고, 유일한 소비자가
여전히 같은 모듈 내부이며, 함수의 반환값 상한이 애초에 안전하게 고정돼 있기 때문이다.

## 재확인 대상 (b) — 새 단위 테스트의 토큰형 픽스처(`iext_secret` 등)가 하드코딩 시크릿인가

`use-widget.test.ts` 의 신규 `describe("sseErrorDetail — 토큰 없이 진단 정보만", ...)` 블록은
`"https://api.test/stream?token=iext_secret"` 을 픽스처로 쓴다. 판정 근거:

- **`iext_` 접두는 spec 이 정의한 실제 토큰 family 이름**([`spec/5-system/14-external-interaction-api.md`](../../../../../spec/5-system/14-external-interaction-api.md) EIA-AU-02, `spec/1-data-model.md:638`)이지만, 뒤에 붙는 값(`secret`, `x`,
  `stale`, `prev`, `fresh` 등)은 **실제 JWT 형태(헤더.페이로드.서명)가 전혀 아닌 임의
  플레이스홀더 문자열**이다. 서명 키(`INTERACTION_JWT_SECRET`)나 실제 발급 로직과 무관하고,
  이 문자열을 그대로 프로덕션 EIA 엔드포인트에 제출해도 검증에 통과할 수 없다 — 유효한
  자격증명이 아니다.
- **저장소 전체에 걸쳐 이미 확립된 관례**다. `grep -rn "iext_"` 로 확인한 결과 같은 패턴
  (`iext_x`, `iext_prev`, `iext_stale`, `iext_fresh` 등)이 `use-widget-eager-start.test.ts`
  등 기존 테스트 수십 곳에 이미 쓰이고 있다 — 이번 delta 가 새로 도입한 관행이 아니라
  기존 컨벤션을 따른 것이다.
- **`redactToken`/`isTerminalAuthError` 를 겨냥한 `eia-client.test.ts` 의 `iext_secret`
  픽스처는 이번 delta 의 변경분이 아니다.** `git log -S "redactToken" -- .../eia-client.test.ts`
  로 확인한 결과 그 테스트는 이전 커밋(`38b49780e`)에서 도입됐고, 이번 라운드(`8eb223c19`)
  diff 는 이 파일을 건드리지 않는다 — 조립 프롬프트에 포함된 것은 diff-base 가
  `origin/main` 이라 누적 diff 로 잡힌 것뿐이다.
- **실제 시크릿(서명 키·API 키·DB 비밀번호 등) 패턴 정규식 스캔**(`sk-...`, `api[_-]?key=`,
  `BEGIN ... PRIVATE KEY` 등)을 이 branch 의 `codebase/` 전체 diff 에 돌려도 매치가 없었다.

**결론: 토큰형 픽스처는 실제 자격증명이 아니라 redaction 로직을 검증하기 위한 의도적
"토큰처럼 생긴 무해한 문자열"이며, 저장소 전체 관례와 일치한다. 하드코딩 시크릿으로
분류하지 않는다.** 오히려 이 문자열이 출력에 **나타나지 않아야 한다**는 것 자체가 테스트의
단언 대상이라, redaction 회귀 방지 목적에 부합한다.

## 발견사항

없음. (신규 CRITICAL/WARNING/INFO 없음 — 위 재확인 두 건 모두 안전 확인으로 종결)

## 요약

이번 delta 는 `sseErrorDetail` 을 `useWidget()` 클로저에서 module-level `export` 함수로
옮긴 것이 유일한 보안 관련 변경이다. 함수 본문은 이동 전후 완전히 동일하며(직접 diff 대조),
`e.target.readyState` 한 필드만 읽고 URL·토큰에는 전혀 접근하지 않는 순수 함수라 export 로
공개 표면이 넓어져도 노출 가능한 정보의 상한이 바뀌지 않는다. 유일한 소비자도 여전히 같은
모듈 내부(`openStream` 의 `onError`)이고, 테스트 외 다른 프로덕션 모듈이 이 export 를
가져다 쓰지 않는다. 새 단위 테스트가 쓰는 `iext_secret` 류 토큰형 문자열은 spec 이 정의한
접두(`iext_`)를 흉내내되 실제 서명·발급 로직과 무관한 플레이스홀더로, 저장소 전반에 이미
쓰이던 관례이자 redaction 동작을 검증하기 위한 의도적 픽스처다 — 실제 자격증명 유출이
아니다. 직전 라운드(`10_24_54`)의 NONE 판정을 흔들 요소가 이번 delta 에 없으므로 판정을
유지한다.

## 위험도

NONE
