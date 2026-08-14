# RESOLUTION — `23_17_57` (+ consistency `--impl-done` `23_18_06`)

ai-review **CRITICAL 0 / WARNING 6** · consistency **BLOCK: NO / WARNING 2**.
두 게이트가 **독립적으로 같은 결함**(§6.4 blockquote 자기모순)에 수렴했다.

## W1 / consistency W1 — 같은 문서 안에서 한 곳만 고쳤다

**조치 완료.** §6 필드 표(`:572`)는 이 PR 로 "전 경로 object" 로 고쳤는데, **같은 파일**
§6.4 blockquote(`:792`)는 *"현행 일부 경로에서 string · 당분간 양쪽을 방어"* 로 남아
자기모순이었다. 게다가 그 blockquote 가 *"필드 집합 표의 `error` 행 참조"* 라며 자신을
정정된 표로 되돌리고 있었다.

**이건 이 세션의 반복 형태다** — "고쳤다" 를 쓰는 시점에 자매를 전수로 세지 않았다.

**그래서 전수 grep 을 했더니 체커가 지목한 것보다 많았다:**

| 위치 | 체커가 지목했나 |
|---|---|
| `14-external-interaction-api.md:792` (§6.4 blockquote) | ✅ |
| `spec-sync-external-interaction-api-gaps.md` | ✅ |
| `spec-draft-eia-notification-payload-contract.md` (2곳) | ✅ |
| `node-output-redesign/README.md:372` | ❌ **전수 grep 으로 발견** |
| `spec/conventions/chat-channel-adapter.md:161` | ❌ **2차 grep 에서 추가 발견** |

다섯 곳이었고, **한 번의 grep 으로도 다 안 나왔다**(표현이 조금씩 달라 2차 grep 이 필요했다).
체커 목록을 그대로 집행했으면 둘이 남았다.

> **중요한 뉘앙스 — 체커가 먼저 경고했고 그게 옳았다**: "wrap 제거 완료" 로 잘못 flip 하지
> 말라고 했다. dispatcher 의 문자열 분기는 **레거시 큐 이벤트 흡수용으로 의도적 유지**다.
> 제거하면 그 창 동안 사용자가 CCH-ERR-* 안내를 못 받는 silent skip 으로 되돌아간다
> (2026-05-25 에 고친 바로 그 회귀다). 다섯 곳 전부 그 구분을 명시해 고쳤다.

## W3 — 컨슈머가 정규화를 손으로 재구현했고, 그 안에 캐스팅이 있었다

**조치 완료.** dispatcher 가 세 분기로 정규화를 다시 짰고 object 분기는
`errorRaw as typeof error` 로 **헬퍼의 필드별 타입가드를 통째로 우회**했다.

**캐스팅은 검증이 아니다** — 이 브랜치가 프런트엔드에서 정확히 그 실수로 렌더 크래시를
냈고(직전 라운드 CRITICAL), 같은 것을 백엔드 컨슈머에도 두고 있었다.

`execution-engine → chat-channel` import 가 이미 있어 역방향은 순환이 된다. 그래서
**헬퍼를 `shared/utils/` 로 승격**했다 — 직전 PR(#1169)이 `strip-external-only-fields` 에
쓴 것과 같은 선례다. 이제 producer 4곳과 consumer 1곳이 같은 함수를 부른다.

## W4 — 네 emit 중 하나만 값이 안 걸려 있었다

**조치 완료.** `failFirstSegmentSetup` 의 emit 은 `objectContaining({status})` 만 봐서
`error` 자리를 바꿔도 GREEN 이었다(리뷰어가 뮤테이션으로 실측). 값 단언 추가 후 **리뷰어와
같은 뮤턴트**(`toTerminalErrorPayload('MUTATED')`)로 RED 확인.

## W2 — secret 마스킹: 조치 없음 (리뷰어도 동의)

리뷰어가 **pre-existing 임을 직접 대조로 확인**하고 백로그 등재 사실까지 인용했다
(`spec-sync-external-interaction-api-gaps.md`). 트래킹 유실 없음 재확인.

## W5·W6 — breaking change 통지

CHANGELOG 는 직전 라운드에 작성됐고 리뷰어가 해소 확인. **PR 본문에도 같은 문구를 싣는다**
— 이 저장소는 URL 버전 세그먼트를 쓰지 않아 문서가 유일한 통지 경로다.

## INFO 넘김

| # | 처분 |
|---|---|
| 1·2·3·7·8·9·15·16·20·22 | positive finding (직전 CRITICAL 닫힘·prototype pollution 없음·3층위 정합 등) |
| 4 (wire 타입 2중 선언) | W3 으로 **부분 해소**(헬퍼는 하나가 됐다). 타입 선언 통일은 모듈 경계 대가로 유지 |
| 5·21 (`execution.cancelled` 미통일) | 범위 밖, 세 층위(코드·plan·spec)에 일관 기록됨 — 은폐 아님 |
| 6 (emit 경계 `payload: unknown`) | 직전 CRITICAL 의 **근본 원인**이다. 증상만 재동기화했다는 리뷰어 지적이 맞다 → discriminated payload union 을 별건 등재 |
| 17 (프런트 3중 반복 관용구) | 의도적 일관성. 네 번째가 생기면 `extractErrorMessage` 추출 |
| 18 (프런트 "object인데 message 없음" 미고정) | 헬퍼가 `message: ''` 로 흡수하므로 크래시 경로 아님. 차단 아님 |
| 19 (주석의 `null` vs `""` 혼용) | 대입값과 다운스트림 표현이 실제로 다르다 — 주석이 그 차이를 말하는 중이라 유지 |

## 검증

- 백엔드 **424 suites / 8674 passed** · lint `--max-warnings 0` · 타입 **199**(래칫 동일)
- chat-channel **514 tests** (헬퍼 승격 후 재실행)
- W4 판별력: 리뷰어와 동일 뮤턴트로 RED 확인
- stale 문구 전수 grep 2회 — 남은 것 0
