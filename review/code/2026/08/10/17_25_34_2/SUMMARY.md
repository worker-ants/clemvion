# ai-review SUMMARY — `17_25_34_2` (forced 7 전원 실행)

대상: `claude/webchat-reload-rest-branches` vs `origin/main`.

## 집계

| reviewer | Critical | Warning | Info | 위험도 |
|---|---|---|---|---|
| security | 0 | 0 | 1 | NONE |
| scope | 0 | 0 | 6 | NONE |
| testing | 0 | 0 | 3 | NONE |
| side_effect | 0 | 0 | 2 | NONE |
| maintainability | 0 | 1 | 3 | LOW |
| requirement | 0 | 1 | 1 | LOW |
| documentation | **2** | 2 | 1 | **HIGH** |
| **합계** | **2** | **4** | **17** | **HIGH** |

여기에 **직전 라운드(`17_15_33_2`)의 requirement 리포트가 뒤늦게 착지**해 CRITICAL 1건이
추가됐다. 그 라운드 SUMMARY 는 이미 커밋된 뒤였으므로 본 라운드에서 함께 처분한다.

## Critical

### C1 (17_15_33_2 requirement, 뒤늦은 착지) — `refresh_deferred` 가 약속한 복구가 존재하지 않는다

`SeedOutcome` JSDoc 이 "세션은 살아 있고 **갱신은 기대할 수 있다**" 고 적었는데 코드를 따라가면
그 보장이 성립하지 않았다. 두 지점이 비어 있었다:

- `useTokenRefresh` 의 성공 경로는 토큰만 교체하고 `openStream` 을 부르지 않는다. `openStream`
  호출부는 `start()`·`applyConfig` 두 곳뿐이고 둘 다 boot 시점 1회성이라 되돌아오지 않는다.
- 실패 경로(`.catch()`)는 `console.warn` 만 하고 **재예약을 하지 않는다** → 한 번 더 실패하면
  갱신 사이클 자체가 죽는다.

즉 두 경우 모두 위젯은 스피너에 머물고 자동 탈출구가 없다. **오케스트레이터가 직접 코드를 열어
재확인했고 사실이다.**

### C2 (documentation) — CHANGELOG 가 세 번째 갈래를 통째로 감춘다

`refresh_deferred` 도입 이후 CHANGELOG 가 한 번도 갱신되지 않아 "성공 아니면 종료" 두 갈래만
서술한다(`refresh_deferred` grep 0건). 실제로는 네트워크 오류 경로가 별도로 존재하고, 그 경로가
바로 C1 의 고착 지점이었다.

### C3 (documentation) — 직전 라운드가 documentation WARNING 2건을 "확인" 으로 유실시켰다

`17_15_33_2` 의 RESOLUTION 은 "WARNING 2 전부 처분" 이라 주장했으나, documentation reviewer 의
WARNING 2건(CHANGELOG `3-state` 잔존 / spec 재판정 노트의 자기제거 체크리스트 부재)은 논의도
반영도 없이 넘어갔고 HEAD 기준 둘 다 미해결이었다. **이 저장소의 기록된 재발 형태**다 —
"미룬 항목은 그 턴에 `plan/` 에 적어라".

## Warning

| # | reviewer | 내용 |
|---|---|---|
| W1 | requirement | **SPEC-DRIFT** — §3.1-2·§R4 가 세 번째 갈래(`refresh_deferred`)를 문서화하지 않는다(두 라운드 연속 지적) |
| W2 | maintainability | RESOLUTION 이 "동등 뮤턴트 근거를 JSDoc 에 남겼다" 고 적었으나 실제 JSDoc 엔 그 문구가 없다 |
| W3 | documentation | `CHANGELOG.md:199` 가 `SeedOutcome` 을 여전히 3-state 로 서술 |
| W4 | documentation | spec 의 "frontmatter 재판정 대기" 노트에 자기제거 체크리스트가 없다 |

## 긍정 확인 (재판정 통과)

- **side_effect**: "`refresh_deferred` 가 종전 대비 악화는 아니다" 판단을 소스·git 이력으로
  재검증 → **유효**. UI 증상은 동일하고 네트워크·내부상태는 현재 경로가 우위(거부된 토큰으로
  `EventSource` 를 열지 않아 `streamRef` 오염·`sessionEstablished()` 오판이 없다).
- **testing**: "`refresh_deferred`→`stale` 뮤턴트가 2건 RED" 주장을 repo 밖 scratch 사본
  뮤테이션으로 재현 확인. 같은 경로를 검증하는 추가 미보강 케이스는 없음(전수).
- **scope**: 산출물(SUMMARY/RESOLUTION)의 처분 주장 3건을 `git show` 로 재검증 → 커밋과 일치.
  이 브랜치가 한 번 CRITICAL 을 낸 "산출물-커밋 불일치" 재발 없음.
- **maintainability**: `shouldAbortAfterSeed` 추출이 두 호출부에 정확히 적용됐고 옛 리터럴
  중복 잔존 없음. 화이트리스트→블랙리스트 뮤턴트의 동등성 판단도 타당.

## 이 라운드의 성격

라운드 6까지 오면서 발견의 성격이 **동작 → 구조 → 문서** 로 이동해 수렴 신호로 읽었는데,
뒤늦게 착지한 리포트가 **동작 CRITICAL** 을 들고 왔다. 수렴 판정을 "이번 라운드에 뭐가
나왔나" 로만 하면 안 된다는 실례다 — 늦게 오는 리포트가 있으면 그것도 라운드의 일부다.

공통 원인도 한 줄로 정리된다: **내가 문서에 쓴 보장이 구현보다 넓었다.** C1·C2·W1 은 전부
그 한 문장의 다른 얼굴이고, C3 는 그것을 잡을 기회를 내가 흘렸다는 기록이다.

## RISK: HIGH
## CRITICAL_COUNT: 3
## WARNING_COUNT: 4
