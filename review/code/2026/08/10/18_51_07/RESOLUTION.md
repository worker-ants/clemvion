# RESOLUTION — `18_51_07`

Critical 2 / Warning 5 **전부 처분**. 처분 커밋: `bd4e5b35f`.

## C1·C2·W1·W2·W5 — redaction 을 진입점 전부에 → **고침**

`openStream` 진입점 셋을 모두 덮었다.

| 진입점 | 종전 | 처분 |
|---|---|---|
| `resumeDeferredStream` | redact 됨(직전 라운드) | 유지 |
| `start()` → `errMessage()` | **원문 그대로 warn** | `redactToken` 적용 |
| `applyConfig` | **try/catch 없음 → unhandled rejection** | catch 추가 + redact |
| SSE `onError` | **원본 Event 를 통째로 warn**(`e.target.url`) | 이벤트 타입만 남김 |

`applyConfig` 는 **호출부가 둘**(bridge boot · 직접 로드 폴백)이었다. 처음엔 bridge 쪽만 고쳤고,
`grep` 으로 두 번째를 찾아 `runApplyConfig` 헬퍼로 묶었다 — **이 fix 자체가 "한쪽만" 을 한 번
반복했다는 뜻**이라 그 사실을 헬퍼 JSDoc 에 적었다.

SSE `onError` 는 문자열 redaction 이 원천적으로 닿지 않는 벡터라 접근이 다르다. 진단에 필요한
것은 "어떤 종류의 실패인가" 뿐이므로 `e.type` 만 남긴다.

**W2**(나머지 `console.warn` 에 방어적 redact 미적용)는 **적용하지 않았다.** 그 경로들은 Bearer
헤더 방식이라 토큰이 문자열에 실릴 수 없다 — 근거 없이 전면 적용하면 "왜 여기 redact 가 있나" 를
다음 사람이 해석해야 하고, 실제 노출면과 방어의 대응이 흐려진다. **토큰이 URL 에 실리는 유일한
지점은 `openStream` 하나**라는 사실이 이 판단의 근거다(maintainability 도 같은 근거로
`redactToken` 의 배치를 정당하다고 판정했다).

**회귀는 진입점별로 걸었다** — 한 경로만 고정하면 그게 바로 다음 "한쪽만" 이다.
- `start()` 경로: 스트림 오픈 실패 시 로그에 토큰 없음 + `token=<redacted>` 존재.
- SSE `onError`: `target.url` 을 들고 오는 원본 이벤트를 주입해 로그에 토큰 없음.

**뮤테이션 2종 RED**: `errMessage` 의 redaction 제거 / `onError` 가 원본 이벤트를 다시 찍게 복원.

**테스트 자체의 vacuity 도 한 번 발각됐다** — `start()` 회귀를 처음 썼을 때 `config` 확립을
기다리지 않고 `open()` 을 불러 `start()` 가 `!cfg` 로 조기 return 했다. 로그가 비어 실패로
드러났고(단언이 "token= 을 포함" 이라 빈 로그를 못 통과), 그 이유를 주석에 남겼다.

## W3 (testing) — 자매 파일의 같은 취약 형태 → **고침(결합 제거)**

`use-token-refresh.test.ts` 의 백오프 테스트가 스케줄 5초 vs 검증 여유 5초로 원 CRITICAL 과
자릿수가 같았다. 리뷰어는 재현에 실패했지만 **"재현 실패는 부재의 증거가 아니다"** 가 맞다 —
원 CRITICAL 도 특정 조건에서만 났다.

마진을 넓히는 대신 **결합 자체를 없앴다**: 이 파일은 `waitFor` 폴링을 쓰지 않고 전부
`advanceTimersByTimeAsync` 로 시계를 직접 몰기 때문에 `shouldAdvanceTime: true` 가 **애초에
불필요**했다. 그 옵션 하나를 지우면 실경과시간 결합이 0 이 된다(21/21 통과).

리뷰어의 (a)(수동 reject 제어)보다 근본적이다 — (a)는 arming 시점만 결정론적으로 만들고 그
뒤 전진 구간의 드리프트는 남는다.

## W4 (maintainability) — defer 가 발견될 경로가 없다 → **고침**

`shouldAbortAfterSeed` JSDoc(정확히 "다섯 번째 갈래" 를 논하는 자리)에 breadcrumb 을 달았다 —
꼬리 블록이 함께 늘어나야 한다는 사실 + plan 경로. **그 plan 제목이 "frontmatter 재판정" 이라
우연히 열어볼 이유가 없다**는 지적이 정확했고, 같은 파일의 다른 항목은 이미 같은 형식의
breadcrumb 을 쓰고 있어 비일관적이라는 점도 맞다.

## 전제 정정 — 내가 쓴 위협 모델이 틀렸다

`redactToken` JSDoc 에 "공개 사이트에 임베드되는 위젯이라 그 콘솔은 **호스트 페이지의 다른
스크립트도 읽을 수 있다**" 고 적었는데 **틀렸다.** 위젯은 cross-origin iframe 이라 호스트 realm 의
스크립트가 이 realm 의 `console` 을 패치하거나 읽을 수 없다.

실제 노출면은 더 좁다 — devtools 를 여는 사람, 콘솔을 수집하는 브라우저 확장, 버그 리포트에
첨부되는 콘솔 덤프·스크린샷, 그리고 위젯을 same-origin 에 임베드하는 배포. **좁아졌다고 단명
자격증명을 로그에 남길 이유는 없으므로 방어는 그대로 두되, 근거를 사실로 고쳤다.**

security reviewer 도 내 서술을 이어받아 같은 문장을 썼다 — 틀린 전제가 리뷰어를 통해 증폭되는
경로를 여기서 끊는다.

## 검증

- 위젯 vitest **435 passed** (23 files, +2).
- `tsc --noEmit` **0 errors**.
- harness/doc guards **1032 passed / 1128 subtests**.
- 뮤테이션 **누적 14종** — 이번 라운드 2종 추가, 전부 RED.
