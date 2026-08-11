# RESOLUTION — `15_32_44` (+ consistency `15_32_46`)

CRITICAL 1 / WARNING 2 / INFO 5 **전부 처분** (커밋 `99d3e9000`).

## 이 라운드의 주제는 하나다 — **한 사실이 여러 곳에 복제돼 있고, 나는 한 곳만 고친다**

세 발견이 전부 그 형태다:

| 발견 | 복제된 사실 | 내가 고친 곳 | 안 고친 곳 |
|---|---|---|---|
| documentation CRITICAL | "apiBase 부재 시 applyConfig 가 진단한다"(거짓) | spec §R0 | **`safeApiBase` JSDoc** (= 그 spec 이 지목한 코드 SoT) |
| W1 (2명 수렴) | "이 문서의 미해결 항목 목록" | 본문 새 절 | **상단 완료 조건 표** |
| documentation INFO | 함수명 `safeApiBaseFromQuery` | 코드·spec | **완료 plan §관련** |

특히 두 번째는 그 문서가 **바로 위 문단에서** "개수를 문장에 박으면 표가 늘 때마다 조용히
거짓이 된다" 고 경고하는 자리다. **경고문이 있는 것만으로는 안 걸린다** — 재발 사실 자체를
그 표 밑에 남겼다.

## W2 (convention) — `R0` 는 관례를 어긴 유일 사례였다

checker 가 `git log -S "### R0."` 로 저장소 전체에서 이 커밋이 **유일 사용례**임을 확인했고,
Rationale 을 가진 모든 spec 이 예외 없이 R1 시작·끝에 append 한다는 것도 전수로 보였다.
`R7` 로 재번호하고 문서 끝으로 옮겼다. 기존 R1~R6 헤딩 불변 → 타 문서 4곳의 `#r6-…` 앵커 유효.

## testing INFO 처분 — **뮤테이션이 내 새 테스트를 vacuous 로 판정했다**

"유효 쿼리 + 악성 boot" e2e 를 추가하고 폴백 제거 뮤턴트를 심었더니 **그대로 통과**했다.
원인은 같은 파일의 독립 경로다:

```ts
// host 없이 직접 로드(샘플/개발): query param 만으로도 부팅 시도.
const fallback = configFromQuery();
if (fallback.apiBase && fallback.triggerEndpointPath) runApplyConfig(fallback as BootMessage);
```

쿼리에 `apiBase`+`trigger` 를 둘 다 넣으면 이 경로가 boot 과 **무관하게** 부팅해, 병합 폴백이
있든 없든 `config.apiBase` 가 같다 — **두 경로가 같은 결과를 내면 관측이 갈리지 않는다.**

쿼리에서 `trigger` 를 빼 `mergeBootConfig` 의 폴백이 **유일한 apiBase 공급원**이 되게 했다.
같은 뮤턴트가 이제 3건 → **4건 RED**.

> 이건 리뷰어가 잡아 준 게 아니라 **내가 처분하면서 스스로 뮤테이션을 돌려 발각**했다.
> "GREEN 은 증거가 아니다" 를 처분 단계에도 적용한 결과다.

## 리뷰어들이 자기 것을 정정했다

- **scope**: 직전 HIGH → LOW. 저장소 선례(`cbc0d33760`·`da078a63f4`)를 찾아 이 패턴이 이미
  반복 머지돼 있음을 확인했고, **자기 직전 리포트의 사실 오류**("`spec_impact` 가 애초에
  선언돼 있었다")도 스스로 정정했다.
- **rationale_continuity**: `git log -S` 로 비대칭 결정의 원 커밋(`aba46cc90`)을 찾아 §R0 의
  "기각한 대안" 이 실제 이력과 **문구까지 일치**함을 확인 — 지어낸 근거가 아니다.

## 검증

- channel-web-chat **451 passed**(신규 9 = 단위 6 + 통합 3), 타입 오류 0, lint 신규 0.
- 뮤테이션 누적: 병합 동작 복원 4 RED · 호출부 원복 1 RED · 폴백 제거 4 RED ·
  인자 순서 스왑 2 RED(리뷰어 실측) · `source` 상수화 2 RED(리뷰어 실측).

## 남은 절차

이번 fix 가 `codebase/**` 와 `spec/**` 를 둘 다 건드렸으므로 확인 라운드 + consistency 를
한 번 더 돈다.
