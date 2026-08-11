# 보안(Security) Review — 2026/08/11 15_32_44

대상: `d8abc7003` 델타(직전 라운드 `15_16_20` 대비) — 통합 회귀 2건 추가
(`use-widget-eager-start.test.ts`), `@deprecated` 별칭 `safeApiBaseFromQuery` 삭제,
spec `4-security.md` §R0 문장 정정, `use-widget.test.ts` 테스트 캐스트 좁힘(`as never` →
`Partial<BootMessage>`).

## 확인 절차

1. **표면 증감** — `use-widget.ts` 의 실제 검증 로직(`safeApiBase`/`mergeBootConfig`/호출부
   `runApplyConfig(mergeBootConfig(configFromQuery(), c))`)은 이번 델타에서 **변경되지
   않았다**(직전 라운드에서 이미 배선 완료). 이번 델타는 그 위의 별칭 제거·테스트·문서만 건드린다.
2. `safeApiBaseFromQuery` 잔존 참조를 저장소 전체(`codebase/`, `spec/`, `packages/` 포함)에서
   `grep` — **코드에는 0건**. `review/`·`plan/` 의 과거 리포트/plan 문서에만 남아 있고(역사
   기록이므로 정상), 소비 경로는 없다. → 별칭 삭제가 어떤 검증도 우회하지 않았다.
3. `mergeBootConfig`/`safeApiBase` 소비처를 grep — `use-widget.ts` 본체(정의 2곳 + 호출부
   1곳)와 `use-widget.test.ts`(단위 테스트)뿐. 이중 정의·shadow 없음.
4. 신규 통합 테스트 2건을 `use-widget-eager-start.test.ts` 실제 소스(`applyConfig`,
   1220~1296행)와 대조해 뮤테이션적으로 추적:
   - **음성 케이스**(`javascript:alert(1)` boot): `mergeBootConfig` 가 정상 동작하면
     `merged.apiBase === undefined` → `applyConfig` 1221행 `if (!cfg.apiBase || ...) return;`
     에서 **조용히** 빠져 `fetch` 호출 자체가 없다(`config` 는 `null` 유지).
     **회귀(호출부를 옛 spread `{ ...configFromQuery(), ...c }` 로 되돌리는 뮤턴트)를 가정하면**
     `cfg.apiBase = "javascript:alert(1)"` 가 truthy 라 early-return 을 통과 →
     `isEmbedAllowed` → `fetchEmbedConfig` → `stripTrailingSlash(apiBase)` 뒤
     `` fetch(`${base}/api/hooks/.../embed-config`) `` 를 **그 악성 문자열을 base 로 실은 채**
     호출한다 → `fetchMock.mock.calls` 에 `"javascript:"` 를 포함한 호출이 실제로 잡힌다.
     즉 `fetchMock.mock.calls.some(...includes("javascript:"))` 단언과 `config` 단언
     **둘 다** 뮤턴트에서 깨지는 것을 소스 추적으로 확인했다 — vacuous 아님.
   - **양성 케이스**(정상 http(s) boot): `config.apiBase === SESSION_API_BASE` 를 직접
     단언 — 검증이 "boot 을 통째로 막는" 형태로 과도해지는 뮤턴트를 가른다(음성 케이스
     단독으로는 못 잡는 축).
   → 두 테스트가 서로 다른 축(과소 차단/과다 차단)을 겨냥하며 둘 다 실측 가능한 방어를
     단언한다.
5. PR 전체(파일 1~7)를 재훑어 잔여 표면 확인 — `safeApiBase` 의 스킴 화이트리스트(`http:`/
   `https:` 만 통과, `try/catch` 로 파싱 불가 시 안전하게 거부)는 직전 라운드에서 8가지
   형태로 우회 불가가 실측됐고 이번 델타가 그 술어를 건드리지 않았다. spec §R0 정정
   (`applyConfig` 의 조용한 early-return이 "여기서 진단이 뜬다"는 이전 서술이 거짓이었음을
   바로잡음)은 **문서 정확성 개선**이며 동작 변경이 아니다. 그 조용한 early-return 자체는
   이미 `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 별도 항목으로
   등재돼 있고 이번 델타가 새로 만든 침묵이 아니다(도달 빈도만 넓혔다는 서술도 동일 문서에
   기록됨) — 별도 발견으로 중복 등재하지 않는다.

## 발견사항

없음. 이번 델타는 보안 표면을 넓히지도 좁히지도 않는(코드 동작 불변) 정리 작업이며, 신규
통합 테스트는 소스 추적상 실제 방어(스킴 검증 우회 차단)를 단언한다. 별칭 삭제는 저장소
전체에서 소비처 0건을 확인해 검증 우회 경로를 만들지 않았다.

## 요약

`safeApiBase`/`mergeBootConfig` 의 실제 검증 로직은 직전 라운드에서 이미 완성돼 있었고,
이번 델타(`d8abc7003`)는 그 위에 (a) 호출부 배선을 실제로 지키는 통합 회귀 2건 추가,
(b) 소비처가 0건으로 확인된 `@deprecated` 별칭 삭제, (c) spec 문서의 거짓 서술 정정,
(d) 테스트 타입 캐스트 좁히기만 수행한다. 넷 다 방어 로직 자체를 건드리지 않으며, 신규
테스트는 실제 호출부(`bridge.onBoot` → `mergeBootConfig`)를 우회하는 뮤테이션에 대해
소스 코드 추적으로 검증 가능한 방식으로 반응한다(config 미확립 + `fetchEmbedConfig` 가
악성 문자열을 실은 네트워크 호출을 만들지 않음, 둘 다 관측 가능). 별칭 삭제 후 저장소
전체에 `safeApiBaseFromQuery` 잔존 참조가 없어 어떤 경로의 검증도 사라지지 않았다.

## 위험도

NONE
STATUS: OK
