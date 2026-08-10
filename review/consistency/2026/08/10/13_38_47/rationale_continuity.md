# Rationale 연속성 검토 결과

- 대상: `spec/7-channel-web-chat` (전 영역 번들) + 구현 diff(`origin/main...HEAD`, code_areas 한정 — 실질 변경은
  `codebase/channel-web-chat/src/widget/use-widget.ts` + 동 테스트 파일의 코멘트, `openStream` 스트림-소유권 가드를
  호출부 2곳(`start()`/`applyConfig`)의 손 복제에서 `openStream()` 내부로 이동한 리팩터 1건)
- 모드: `--impl-done`

## 조사 방법

1. target 번들에 포함된 7개 spec 파일의 `## Rationale` 전체(특히 `3-auth-session.md` §R3·R4·R7·R8, `1-widget-app.md`
   §R6·R7·R9, `2-sdk.md` frontmatter 주석의 `use-session-generations.ts` "세대" 축 구분)를 diff 와 대조.
2. diff 가 인용하는 과거 결정("boot 세대 비교로 표면 되감기 방어" — 2회 기각 이력, §R7)이 재도입됐는지 실제 코드
   (`use-widget.ts` 전체, diff 범위 밖 포함)를 절대경로로 열어 확인.
3. target 이 인용하는 타 spec 의 식별자(EIA-AU-04·EIA-RL-07·EIA-IN-02·EIA-IN-12·`R-replay-unavailable`)는 예산 초과로
   번들에서 드롭됐으므로, `spec/5-system/14-external-interaction-api.md` 를 직접 열어 존재·의미가 target 서술과
   일치하는지 대조.

## 발견사항

이번 검토 범위(diff 가 실제로 건드린 코드 + 그것이 근거로 삼는 target 의 Rationale)에서 기각된 대안의 재도입,
합의 원칙 위반, 무근거 번복, invariant 우회에 해당하는 항목을 찾지 못했다. 오히려 모범적인 연속성 사례로 보인다:

- **[INFO] `openStream` 가드 이동은 새 Rationale 을 동반한 정당한 결정 갱신**
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §R7("표면 되감기 방어는 '세션 확립' 축") 마지막 두
    blockquote(`> 종전엔 이 재확인이…`, `> 근거의 성격…`) + `spec/7-channel-web-chat/2-sdk.md` frontmatter 의
    `use-session-generations.ts` 주석
  - 과거 결정 출처: 동일 §R7 자체("대안(boot 세대 비교)이 두 번 실패한 이력이 여기 있으므로, 되살리려면 위 두 구멍을
    먼저 반증해야 한다")
  - 상세: diff 는 스트림 소유권 재확인(`if (sessionEstablished()) return;`)을 `start()`·`applyConfig` 두 호출부의
    손 복제에서 `openStream()` 내부(`streamRef.current !== null` 체크, `StreamClaim` 반환)로 옮긴다. 이는 "결정 번복"
    처럼 보일 수 있으나, §R7 이 정확히 이 변경을 예상하고 사전에 "이유"·"이력"·"재도입 조건"까지 명문화해 두었다 —
    실제 코드(`use-widget.ts` 393·622·973행)를 절대경로로 열어 확인한 결과 (a) 호출부는 2곳(`start()`, `applyConfig`)
    뿐이라 리팩터 누락 지점이 없고, (b) 기각됐던 "boot 세대 비교" 축(`use-session-generations.ts` 의
    `beginBootAttempt`/`isAttemptStale`)은 여전히 **config 적용 경합에만** 쓰이고 표면 되감기 가드로 재도입되지
    않았으며, (c) `worldGenRef`/`isStale` 은 §R7 이 허용한 "종료 확정 = 세계의 사실" 축의 구현으로 별개 관심사임을
    확인했다.
  - 제안: 없음(참고용 기록). 이 패턴 — "결정을 뒤집기 전에 재도입 조건을 먼저 Rationale 에 못박아 둔다" — 은 다른
    영역에도 참고할 만한 좋은 선례로 보인다.

- **[INFO] 타 spec 인용 식별자는 예산 절단으로 번들엔 없었으나 직접 대조로 정합 확인**
  - target 위치: `3-auth-session.md` §R4(EIA §8.3·EIA-AU-04), `1-widget-app.md` §R9(EIA §3.4 EIA-RL-07·EIA-IN-02·
    EIA-IN-12), §3.1 blockquote(`R-replay-unavailable`)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §Rationale `R19`·`R-replay-unavailable`, 표
    EIA-AU-04·EIA-RL-07·EIA-IN-02·EIA-IN-12
  - 상세: 프롬프트 번들에서는 EIA 문서 전체가 "컨텍스트 예산 초과로 절단"됐다. 하지만 diff 가 이 인용들을 새로 만든
    것이 아니라(diff 범위는 코드 리팩터 1건, EIA 관련 문구는 무변경) 기존 spec 서술을 그대로 유지하는 것이라 위험이
    낮다고 판단해, `spec/5-system/14-external-interaction-api.md` 를 직접 Read 로 열어 5개 식별자 전부의 존재·의미가
    target 서술과 어긋나지 않음을 확인했다.
  - 제안: 없음(검증 완료). 향후 이 영역에 EIA 관련 Rationale 을 **신규로 추가/변경**하는 PR 이 있다면, 예산 절단으로
    자동 검토가 EIA 원문을 못 보고 지나칠 수 있으니 그 때는 수동으로 EIA §Rationale 을 직접 열어 대조할 것을 권장한다.

## 요약

이번 diff(코드 areas 한정, `use-widget.ts`/`use-widget-eager-start.test.ts` 의 `openStream` 스트림-소유권 가드 이동)는
target spec 자신의 `## Rationale`(3-auth-session.md §R7)이 사전에 근거·이력·재도입 조건을 명문화해 둔 갱신이며, 과거
두 차례 기각된 "boot 세대 비교" 대안을 재도입하지 않았고("종료 확정=세계의 사실" 축과 "표면 갱신=세션 확립" 축의 분리는
그대로 유지), 호출부 전수(2곳)를 실제 코드에서 확인해 리팩터 누락도 없다. 타 spec(EIA)에서 인용한 invariant 식별자도
직접 열람으로 정합성을 확인했다. Rationale 연속성 관점에서 CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 위험도
NONE
