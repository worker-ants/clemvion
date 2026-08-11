# Security Review — webchat `apiBase` 스킴 검증 (wc:boot 경로)

## 핵심 주장 검증

### 1. "검증이 무력화돼 있었다" — **사실 확인**

`git show 3f1169ab5^:codebase/channel-web-chat/src/widget/use-widget.ts` 로 종전 코드를 직접 확인:

```
runApplyConfig({ ...configFromQuery(), ...c } as BootMessage);
```

- `configFromQuery()` 는 내부에서 `safeApiBaseFromQuery(q.get("apiBase"))` 로 스킴 검증을 거친다.
- `c`(`wc:boot` postMessage payload)의 `apiBase` 필드는 **어떤 검증도 거치지 않고** spread 순서상 마지막이라 무조건 `configFromQuery().apiBase` 를 덮는다.
- 사이드카(`plan/complete/webchat-boot-apibase-scheme-validation.md`)가 밝히듯 SDK 정상 부팅은 iframe src 쿼리와 `wc:boot` 양쪽에 **동일 `apiBase`** 를 싣는다(`resolveIframeTarget` / `boot()`). 즉 정상 흐름에서도 쿼리 검증은 boot 도착 즉시 검증되지 않은 값으로 대체됐다 — "부재"가 아니라 "무력화"라는 진단이 코드로 뒷받침된다.

→ 주장 **참**. 이번 diff(`mergeBootConfig` + `safeApiBase(boot.apiBase, "wc:boot")`)가 이 무력화를 닫는다.

### 2. 새 검증(`safeApiBase`)의 우회로 — **발견 안 됨**

`new URL(raw)` 파싱 후 `url.protocol === "http:" || "https:"` 만 허용하는 방식은 정규식 프리픽스 검사와 달리 **정규화 후 값**을 비교하므로 흔한 우회 기법에 강하다. 실측(Node `new URL()`):

| 입력 | 결과 |
|---|---|
| `https:evil.com` (슬래시 없음) | `protocol=https:` — 스킴 자체는 우회 아님(여전히 https, host 값만 다를 뿐) |
| `HTTPS://Evil.com` (대문자) | `protocol=https:` — 정상 정규화, 우회 아님 |
| `java\tscript:alert(1)` (탭 삽입) | `protocol=javascript:` — **정상 거부**(파서가 탭을 제거한 뒤 스킴을 판정하므로 정규식 우회 기법이 안 통함) |
| `" javascript:alert(1)"` (선행 공백) | `protocol=javascript:` — 정상 거부 |
| `https:\\evil.com` / `https:/\evil.com` | `protocol=https:` — 여전히 https, 우회 아님 |
| `blob:https://example.com/uuid` | `protocol=blob:` — 정상 거부 |
| `filesystem:https://example.com/x` | `protocol=filesystem:` — 정상 거부 |
| `https：evil.com` (전각 콜론) | `THROW Invalid URL` → 정상 거부 |

스킴을 위장해 http(s)가 아닌 값을 http(s)로 통과시키는 사례는 없다. **다만 함수의 보장 범위는 "스킴이 http(s)인가" 뿐**이고 host/origin 은 검증하지 않는다 — 이는 기존 쿼리 경로(`safeApiBaseFromQuery`)도 동일했던 pre-existing 설계이며 이번 diff 가 그 범위를 넓히거나 좁히지 않았다(스킴 검증을 대칭으로 만들었을 뿐). `spec/7-channel-web-chat/4-security.md` R0 도 "정당한 비-http(s) 배포는 없다"만 판정 기준으로 삼았지 host 화이트리스트는 애초에 이 함수의 책임으로 정의하지 않는다.

### 3. `mergeBootConfig` 가 다른 필드의 신뢰 경계를 바꿨는가 — **아니오, 그리고 그것이 맞다**

테스트(`use-widget.test.ts` "apiBase 외 필드는 boot 이 이긴다")와 구현 모두 `apiBase` 만 특별 취급하고 나머지 필드는 `{ ...fromQuery, ...boot }` 그대로 boot 이 이긴다 — 종전과 동일.

- `triggerEndpointPath` 는 URL 스킴이 아니라 path segment 이고, 유일하게 raw fetch URL 을 만드는 자리(`use-widget.ts` `fetchEmbedConfig`)에서 `encodeURIComponent(triggerEndpointPath)` 로 인코딩된 뒤 쓰인다 — "세션 토큰이 어디로 가는지" 를 정하는 `apiBase` 와 다른 위협 프로파일이라 같은 스킴 검증이 필요하지 않다.
- `appearance.primaryColor` 는 React `style={{ background: primaryColor }}`(CSSOM 경유, 문자열 조립 아님)로만 쓰이고, `disclaimer`/`headerTitle`/`welcome` 은 JSX 텍스트 노드(`{config.disclaimer}`, `dangerouslySetInnerHTML` 미사용)로만 렌더된다 — 인젝션 표면이 아니다.

→ 비대칭 유지가 정합적. "같은 논리로 검증이 필요하다"는 근거는 찾지 못했다.

### 4. 거절 시 "그 필드만 버리고 부팅은 계속" 이 안전한가 — **안전 확인**

`applyConfig`(`use-widget.ts`) 최상단 가드:

```
const applyConfig = async (cfg: BootMessage) => {
  if (!cfg.apiBase || !cfg.triggerEndpointPath) return;
  ...
```

`apiBase` 가 `undefined` 로 흘러가면 `fetchEmbedConfig`/`isEmbedAllowed`/`EiaClient` 생성 등 **어떤 네트워크 호출도 만들어지기 전에** 조기 `return` 한다. 상대경로로 해소되거나 다른 origin 으로 요청이 나가는 코드 경로는 없다 — `stripTrailingSlash(apiBase)` 나 `new EiaClient({ apiBase: cfg.apiBase })` 호출 자체가 이 가드 뒤에 있다. `vitest run src/widget/use-widget.test.ts` 20/20 통과로 회귀도 확인.

## 발견사항

- **[INFO]** `safeApiBase` 는 스킴(http/https)만 검증하고 host/origin 은 검증하지 않는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `safeApiBase` 함수(diff 게이트 197~210행).
  - 상세: apiBase 가 "세션 토큰이 어디로 전송되는지" 를 정하는 값이 된 이상(§R8 발급-origin 바인딩), 스킴만 통과하면 임의의 `https://attacker.example.com` 도 유효한 값으로 받아들여진다. 다만 이는 이번 diff 가 만든 표면이 아니라 쿼리 경로부터 있던 pre-existing 설계이고, `wc:boot` 값의 신뢰 모델("host SDK 계약")과 §R8(발급 이후 origin 불일치 시 세션 폐기)이 별도 계층으로 이를 완화한다. 새로 넓어진 공격 표면은 아니므로 CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: 조치 불요(설계 결정, R0 rationale 로 이미 명문화됨). 향후 host origin 을 사전에 알 수 있는 배포 모델(워크스페이스 allowlist 등)이 생기면 `safeApiBase` 에 host 검증을 얹는 확장을 고려할 수 있다는 정도로 backlog 참고.

- **[INFO]** `wc:boot` 의 host origin pinning 은 사전 allowlist 가 아니라 TOFU(첫 메시지 발신 origin 을 그대로 신뢰)다.
  - 위치: `codebase/channel-web-chat/src/widget/host-bridge.ts` — `createIframeBridge` 의 `onMessage`(`if (!hostOrigin) hostOrigin = e.origin;`). **이 파일은 이번 diff 대상이 아니다** — 게이트 인용 불가, 함수명으로 기재.
  - 상세: `4-security.md` §1 표는 "postMessage 양방향 `event.origin` 화이트리스트 검증"이라 적지만, 실제로는 사전에 알려진 host origin 목록과 대조하는 것이 아니라 **iframe 을 로드한 부모 window(`e.source === parent`)가 보낸 첫 `wc:boot` 의 origin 을 그 자리에서 채택**하는 방식이다. `wc:boot` 값이 "host SDK 계약이라 신뢰 경계 안"이라는 이번 PR/R0 의 전제 자체는, 임의 페이지가 위젯 iframe 을 자기 페이지에 심어 자신의 `wc:boot` 을 보낼 수 있다는 임베드 위젯의 본질적 설계(공개 챗봇, soft 임베드 검증)와 일관된다 — 즉 "누가 boot 을 보내든 그 페이지가 곧 host"라는 모델이라 모순은 아니다. 다만 R0 rationale 문구가 "host 신뢰 경계 안" 을 강한 사전 인증처럼 읽힐 여지가 있어, 향후 §R8/R0 근거를 재검토할 사람을 위해 참고로 남긴다. 이번 diff 의 결함은 아니다.
  - 제안: 조치 불요. 문서 정합성만 필요하면 별도 후속(이 PR 범위 밖).

새 **CRITICAL/WARNING 없음** — `git show` 로 확인한 종전 코드 대비, 이번 diff 는 실제로 존재하던 검증 무력화(주장 1)를 닫았고, 새 검증(`safeApiBase`)에서 스킴-레벨 우회는 발견되지 않았으며(주장 2), 다른 필드의 신뢰 경계는 의도한 대로 불변이고(주장 3), 거절 시 필드 드롭이 조기 `return` 가드로 안전하게 처리된다(주장 4). 회귀 테스트 20/20 통과.

## 요약

이번 PR 은 실제로 존재하던 보안 결함(`wc:boot` 이 검증된 쿼리 `apiBase` 를 무조건 덮어써 스킴 검증을 무력화)을 `git show` 로 직접 재현·확인했고, `mergeBootConfig` + `safeApiBase(raw, source)` 로 두 입력 경로에 대칭적인 http(s) 스킴 검증을 걸어 이를 닫았다. 새 검증 로직은 실제 URL 파서(`new URL()`)를 사용해 탭/공백/대소문자/백슬래시 등 흔한 스킴 위장 기법에 견고함을 노드 실측으로 확인했고, `blob:`/`filesystem:` 등도 정상 거부된다. 거절 시 "그 필드만 버리고 부팅 계속"이라는 설계는 `applyConfig` 상단의 `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` 가드로 실제 네트워크 호출 이전에 안전하게 차단되며, undefined `apiBase` 가 상대경로로 해소되거나 다른 origin 으로 요청이 새는 경로는 발견되지 않았다. 다른 `BootMessage` 필드(`triggerEndpointPath` 등)는 여전히 boot 이 이기는 비대칭이 유지되나, 이 필드들은 apiBase 와 달리 URL 스킴/목적지를 결정하지 않고 각자 안전한 소비 경로(encodeURIComponent, React 텍스트/style)를 갖고 있어 확장이 불필요하다고 판단된다. 남은 관찰(스킴만 검증하고 host 는 검증하지 않음, host origin pinning 이 TOFU 방식)은 이번 diff 가 만든 새 표면이 아니라 pre-existing 설계이자 spec R0/§R8 이 이미 문서화한 트레이드오프이므로 INFO 로만 기록한다.

## 위험도

LOW — 새로 도입된 CRITICAL/WARNING 은 없다. 이번 diff 는 실제 존재하던 검증 무력화를 닫는 하드닝이며, 남은 항목은 pre-existing 설계 범위에 대한 참고 정보(INFO) 뿐이다.

STATUS: OK
