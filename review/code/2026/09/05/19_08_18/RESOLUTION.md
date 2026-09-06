# RESOLUTION — `review/code/2026/09/05/19_08_18`

전체 위험도 **HIGH** · Critical **1** · WARNING **6** · INFO **10**. **Critical + 실질
WARNING 전건 조치 완료.**

## Critical — vacuity 를 막으려고 세운 가드가 자기 vacuity 를 갖고 있었다

| # | 지적 | 조치 |
|---|---|---|
| 1 | 래칫의 `[대조군] 술어가 실제로 그 조합을 집는다` 가 **존재하지 않는 fixture** 를 참조. 경로 필터가 파일을 열기 전에 걸러 항상 `[]` → **항상 통과** | **실제 fixture 로 교체** |

**지적이 맞고, 이 세션에서 같은 병의 반복이다.** 테스트 이름은 "집는다" 인데 본문은 "스킵된다"
를 확인하고 있었고, 참조하는 파일조차 없었다. 내가 그 자리에 *"픽스처 경로가
`dto/responses/` 를 포함하지 않으므로 스킵된다 — 그것 자체가 판정의 증거다"* 라고 적어
**스스로를 납득시켜 두었다.**

조치:

1. `src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` 신설 —
   위반 **2형태**(데코레이터 이름으로 만든 것 · `required: false` 인자로 만든 것)와
   **준수 2형태**를 한 파일에 담았다.
2. 양성 대조군을 `expect(found.map(field))` 로 바꿔 **무엇을 집었는지** 단언한다. 준수
   형태를 집지 않는 것도 별도로 단언한다.
3. 래칫의 프로덕션 스캔 범위를 `src/modules` 로 좁혔다 — 실제 응답 DTO 36개 파일이 전부
   그 아래임을 실측했고, 그래야 fixture 가 베이스라인을 오염시키지 않는다. 그 무오염
   자체도 테스트로 고정했다.

**판별력 실측**: 술어를 `if (false && ...)` 로 죽인 뮤턴트에 양성 대조군이 RED
(종전 판은 이 뮤턴트에 GREEN 이었다).

## WARNING 조치

| # | 지적 | 조치 |
|---|---|---|
| 1 | `POST /api/schedules` 를 `isActive:false` 로 부르면 트리거는 생성됐는데 응답에서 `trigger` 키가 사라진다 | **고쳤다.** `saved.trigger` 대입을 `if (isActive)` 밖으로 |
| 2 | `TRIGGER_RESPONSE_STRIP_COLUMNS` JSDoc 이 새 상수에 밀려 대상 선언에서 분리됨 | **이동.** 위치 참조("위 목록")도 **이름 참조**로 바꿨다 — 순서가 바뀌면 낡는다 |
| 3 | rename 전 옛 JSDoc 이 새 블록과 나란히 잔존, "단일 진실" 서술이 3벌이 된 지금 부정확 | **병합.** 옛 블록의 유효한 내용(spec 인용·`hasBotToken`·"새 객체 반환")은 살렸다 |
| 4 | signing strip 테스트가 `secretRef` 만 채우고 `secret` 까지 단언 → vacuous | **fixture 에 평문 `secret` 추가** |
| 5 | `PATCH /api/schedules/:id` 만 계약 대조 누락 | **추가** — `update()` 의 trigger 대입 로직이 `findOne` 과 다르다 |
| 6 | 스케줄 `trigger` 축소가 breaking change | **조치 불요** — 이전 라운드에서 처분·문서화됨 |

### W1 — 응답 형태가 요청 값에 따라 갈리고 있었다

`saved.trigger = savedTrigger` 가 `registerJob` 을 위해 `if (isActive)` **안에** 있었다.
그래서 `isActive: false` 로 만들면 트리거 행은 존재하는데 응답에서만 키가 사라졌고, 그
사실이 어디에도 적혀 있지 않았다. 대입을 조건 밖으로 옮겨 **생성 사실과 응답이 일치**하게
했다.

### W3 — 사고를 한 번 냈다

옛 JSDoc 제거를 정규식으로 시도했다가 **메서드 본문까지 삼켰다**(`this.sanitizeForResponse
is not a function` 으로 unit 이 즉시 잡았다). `git checkout HEAD --` 로 되돌리고 **정확
문자열 앵커**로 다시 했다. 여러 줄 블록 삭제에 `.*?` + 룩어헤드를 쓰면 경계를 넘는다.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | 정화가 선언적 메타데이터가 아니라 수기 목록 3벌에 의존 | **조치 불요(추적 중)** — 이번에 두 번 재발했다는 사실은 JSDoc 에 적었다. 세 번째면 `@Sensitive()` 류로 승격 |
| 2 | `consecutiveNetworkFailures` | **이미 등재** |
| 3 | 3-커밋 시퀀스가 규약대로 작동한 사례 | 확인 기록 |
| 4 | import 두 줄 분리 | 조치 불요(사소) |
| 5 | 테스트 전용 module-level 캐시 | 조치 불요 — 격리·오류처리 확인됨 |
| 6 | 조기 return 제거로 **항상 새 객체** 반환 | **JSDoc 에 명시** — "호출부는 참조 동일성을 전제하지 말 것" |
| 7 | config 정화가 얕은 복사 | 조치 불요 — 기존 패턴 답습. 세 번째 재발 시 `structuredClone` |
| 8 | strip 필터 루프 중복 | 조치 불요 — 두 축의 후처리가 다르다(`hasBotToken` 주입) |
| 9 | 지역 변수 `t` | 조치 불요(이월) |
| 10 | DTO 배경 주석 반복 | 조치 불요(이월) |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`19:24:20`) |
| unit | **PASS** (`19:25:35`) |
| build | **PASS** (`19:27:20`) |
| e2e | **PASS** — 295 통과 (`19:30:16`) |

## 보류·후속 항목

이 라운드가 새로 만든 후속은 없다. INFO#1·#7 은 "세 번째 재발 시" 조건부라 등재하지 않는다.
