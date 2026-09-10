# RESOLUTION — `review/code/2026/09/10/23_55_23` (2라운드)

**CRITICAL 0 / WARNING 6 / INFO 12.** 1라운드의 CRITICAL fix 를 검토받기 위한 라운드다
(`--route=all`, reviewer 14명 전원, `forced_missing` 0 · `unfinished` 0).

`security` 가 **두 CRITICAL(R-CC-10 우회 · `inboundSigningRef` fail-open) 이 실제로 닫혔음을
소스로 검증**했고 위험도를 LOW 로 내렸다.

## 조치 항목

| # | 등급 | 사안 | 처분 |
|---|---|---|---|
| 1 | WARNING | **동시 PATCH 가 `trigger.config` 를 잃을 수 있다** — 방금 닫은 fail-open 이 동시성 경로로 재발 가능 | **후속 등재** — 사전 존재 설계(CCH-SE-01 2단계 커밋). 아래 §수렴 예외 |
| 2 | WARNING | **user-guide 4파일이 사실과 다르다** — 필드명(`botTokenRef`→실제 `botToken`)·`details.field` 형식 둘 다 오기 | **수정** — ko/en 4파일 |
| 3 | WARNING | `details.field` 가 값의 형태에 따라 flat/중첩으로 갈리는데 내 `[실측]` 이 **한 갈래만 쟀다** | **수정** — 테스트를 두 갈래로 분리 + Swagger 서술 + **트래커 인계 정정** |
| 4 | WARNING | `mode` 문자열 판별자가 DTO 타입과 컴파일 타임에 상관 안 됨 | **수정** — 오버로드 2개로 타입 레벨 결속 |
| 5 | WARNING | `null` 케이스가 `botToken` 에만 있고 `inboundSigningPlaintext` 에 없다 | **수정** — 두 필드 × 두 값 **4조합** |
| 6 | WARNING | `setupChatChannel` 이 186줄로 6~8관심사 | **후속 등재** — reviewer 자신이 *"즉시 차단 사유 아님"* |
| INFO 1–12 | INFO | 사전 존재 결함 · 기존 설계 · 타입 위치 · e2e 배선 갭 등 | 조치 불요 / 기존 등재 |

## #3 이 이 라운드의 핵심이다 — 내가 넘긴 실측이 과했다

1라운드에서 `[실측] 차단 5필드의 details.field 는 전부 중첩 경로다` 를 쓰고, 그 결론을
**트래커에 "확정" 으로 인계**했다. 그런데 그 테스트는 `'x'.repeat(40)` — **비어있지 않은
값만** 썼다.

`requirement` 가 저장소를 건드리지 않는 프로브로 실측한 결과, 같은 논리적 위반이 **값의
형태에 따라 두 갈래**로 갈린다:

| 보낸 값 | 어디서 거부 | `details.field` | `details` 형태 |
|---|---|---|---|
| 비어있지 않은 문자열 | 전역 `CustomValidationPipe` | **중첩** `chatChannel.botToken` | **배열** |
| `null` · `''` | `@IsEmpty()` **통과** → 서비스 가드 | **flat** `botToken` | **단일 object** |

**직접 재확인했다** — 새 케이스 `[실측] 값이 null/빈 문자열이면 DTO 를 통과한다`가
네 조합 모두 `toBeNull()`(통과)로 GREEN 이다.

**세 곳을 고쳤다**: (a) 테스트를 두 갈래로 분리하고 원 케이스 제목에 *"비어있지 않은 값일
때"* 를 박았다, (b) 컨트롤러 Swagger 가 무조건 중첩이라 서술하던 것을 갈림으로, (c)
**트래커 인계를 표로 정정**했다 — planner 가 한쪽만 보고 spec 을 고치면 반대 갈래에서
틀린 문서가 된다.

> 이것은 *"실측했다"* 가 틀린 **여덟 번째** 사례이고 형태는 **측정 범위**다. 한 갈래만
> 재고 전체로 일반화했다.

## #2 — 사용자가 읽는 문서가 틀려 있었다

네 파일(ko/en × telegram·triggers)이 *"`config.chatChannel.botTokenRef` 를 직접 변경하면
400 (`details.field='botTokenRef'`)"* 이라 안내한다. **필드명도 형식도 틀렸다** —
사용자가 실제로 보낼 수 있는 공개 필드는 `botToken` 이고(`botTokenRef` 는 입력 필드였던
적이 없다), 값이 비어있지 않으면 `details.field` 는 `chatChannel.botToken` 이다.

`git blame` 상 2026-05-23 부터 있던 **사전 존재 오류**지만, 이 PR 이 정확히 그 동작을 처음
구현하고 실측값을 코드에 정본으로 남긴 자리라 PROJECT.md `backend-api-change` 매트릭스
target (b) 가 **같은 턴 동반 갱신**을 요구한다. `codebase/frontend/**` 는 developer 권한
안이므로 이 PR 에서 고쳤다.

## 수렴 예외 — #1·#6

developer SKILL §ISSUE FIX 정책의 (a)(b)(c) 를 인용해 등재로 갈음한다:

- **(a) 동작 결함이 아니다** — #1 은 **사전 존재 설계**(CCH-SE-01 의 best-effort 2단계 커밋)
  이고 이 diff 가 만든 것이 아니다. reviewer 도 *"범위 밖이면 후속 등재"* 로 열어 뒀다.
  #6 은 reviewer 자신이 *"즉시 차단 사유는 아님 — 다음에 손댈 때"* 로 분류했다.
- **(b) fix 자체가 새 라운드를 강제한다** — 트랜잭션/advisory lock 도입은 `update()` 와
  자매 `rotateChatChannelBotToken()` 의 read-modify-write 구간을 함께 바꿔야 하고, 그
  범위는 이 PR(두 CRITICAL 닫기)을 훨씬 넘는다.
- **(c) 근거를 함께 남긴다** — 등재 사유는 *"비용"* 이 아니라 **수렴**이다. 발견의 성격이
  1R(동작: fail-open) → 2R(측정 범위·문서·구조)로 **이동**했고, 이 라운드에서 고친 넷은
  전부 `codebase/` 를 건드렸으므로 한 라운드를 더 돌아 확인한다.

등재 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (중앙 트래커).

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** |
| unit | **PASS** — triggers 모듈 **207** |
| build | **PASS** |
| e2e | **통과** — 305 |

타입체크 ratchet 2종 재실행 — backend 197건/36파일 · frontend 52건/15파일, baseline 일치.

## 보류·후속 항목

위 §수렴 예외의 #1·#6, 그리고 INFO 중 `botToken` 의 `@MinLength(1)` 부재(생성 경로,
스코프 밖)는 중앙 트래커에 등재했다.
