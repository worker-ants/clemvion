# Rationale 연속성 검토 — spec/7-channel-web-chat/ (--impl-done)

## 검토 대상

diff 는 순수 리팩토링(구조 추출) 1건뿐이다:

- `codebase/channel-web-chat/src/widget/use-session-generations.ts` (신규) — `worldGenRef`/`bootGenRef`/
  `unmountedRef` + `isStale`/`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale` 를 `use-widget.ts` 에서
  분리한 `useSessionGenerations()` 훅.
- `use-widget.ts` — 위 선언 블록 제거 + 훅 호출로 대체, 4개 `useCallback` 의 deps 배열에 `worldGenRef` 추가(ESLint
  `exhaustive-deps` 대응 — 커스텀 훅 반환 ref 는 로컬 `useRef` 와 달리 정적 안정성을 ESLint 가 추론 못 함).
- `use-session-generations.test.ts`(신규) — 축 분리 계약(축 4개 판정자) 단위 테스트.
- `use-widget-commands.test.ts` — 콜백 참조 안정성(`worldGenRef` deps 계약) 테스트 추가.

diff 안의 모든 JSDoc·주석은 `use-widget.ts` 에 있던 것을 **문언 그대로 신규 파일로 이동**했고(각 ref/판정자별
과거 결함 근거 각주 포함), 로직 변경은 없다. `spec/7-channel-web-chat/*.md` 자체는 이번 diff 에 포함되지 않았다.

## 관련 spec Rationale 대조

- `1-widget-app.md` **R7** (헤더 세션 컨트롤 — booting 게이팅)·**R9** (single-flight coalesce / "새 대화" cancel)
  가 이 staleness 축(`worldGenRef` 등)의 상위 설계 근거다. diff 는 이 축의 **의미론을 바꾸지 않고 파일 경계만
  옮겼다** — `cannotApplyConfig`/`isAttemptStale`/`beginBootAttempt`/`isStale` 의 조건식은 이동 전후 동일
  (`bootGenRef.current !== attempt.boot`, `worldGenRef.current !== attempt.world` 등 1:1 대응).
- `2-sdk.md` §3(재전송) — "위젯은 마지막 `wc:boot` 의 config 를 적용" 계약을 `beginBootAttempt`/`bootGenRef` 가
  구현한다는 근거 각주가 신규 파일에도 동일하게 보존됨.
- `sessionEstablished()` 를 이 훅에 **포함하지 않은 것**은 새 결정이 아니라 `plan/in-progress/
  webchat-usewidget-extraction.md` "1차 slice" 절의 명시적 경계 판단("boot 세대는 그 proxy 였고 두 번 구멍이
  났다" — 18_39_11·00_51_53)을 그대로 따른 것이고, 코드 주석에도 동일 근거가 재기술돼 있다. Rationale 상
  이미 확정된 축 분리(world ≠ boot ≠ `sessionEstablished`)를 유지·강화한다.

## 발견사항

검토 관점 1~4 (기각 대안 재도입 / 원칙 위반 / 무근거 번복 / 암묵 가정 충돌) 전부에서 **CRITICAL/WARNING 급 충돌
없음**. 세부:

- **[INFO] 신규 파일 상단 주석의 "9회" 집계 수치 — spec Rationale 은 아니나 근거 추적 지점**
  - target 위치: `codebase/channel-web-chat/src/widget/use-session-generations.ts:1-3` (신규 파일 헤더 주석,
    diff `+// **왜 이 묶음인가**: ... 9회, 매번 서로 반대편 구멍`)
  - 과거 결정 출처: 이 수치는 spec Rationale 이 아니라 `plan/in-progress/webchat-usewidget-extraction.md`
    §배경(line 27) 및 §1차 slice(line 73) 의 "9번(23_58_23 기준)" 서술을 그대로 인용한 것 — 새로 지어낸
    수치가 아니다. 같은 plan 문서가 과거 두 차례(라인 수) 부정확한 실측 주장을 스스로 정정한 이력이 있어
    ("정정(리뷰 후)"/"2차 정정") 수치 주장에 대한 경계가 이미 서 있는 상태.
  - 상세: Rationale 연속성 관점에서 위반은 아니다 — plan 문서와 코드 주석이 동일 수치를 공유하고, plan 문서가
    스스로 실측 오류를 두 번 자백·정정한 선례가 있어 근거 추적 가능성이 확보돼 있다. 다만 "9회"라는 집계가
    diff 만으로는 개별 사건 목록과 1:1 대조되지 않으므로(코드 주석엔 개별 사건 6~8건만 나열됨), 향후 이
    수치를 인용할 다른 문서가 생기면 근거(plan §1차 slice)를 같이 링크하는 것이 안전하다.
  - 제안: 조치 불요(BLOCK 대상 아님). 후속 slice 문서화 시 "9회"의 근거를 `plan/in-progress/
    webchat-usewidget-extraction.md` 링크로 명시하면 추적성이 더 좋아진다.

- **[INFO] deps 배열에 `worldGenRef` 추가는 동작 변경이 아니라 lint 대응**
  - target 위치: `use-widget.ts` diff — `teardownSession`/`handleEiaEvent`/seed 관련 콜백/`sendCommand` 4곳의
    `useCallback` deps.
  - 과거 결정 출처: 해당 없음(신규 Rationale 불필요 — ref 객체 identity 는 `use-session-generations.test.ts`
    "판정자 참조는 렌더 간 안정적" 테스트로 고정돼 있어 의미론적 영향 없음).
  - 상세: 원칙 위반 아님. 참고용으로만 기록.

## 요약

이번 diff 는 `plan/in-progress/webchat-usewidget-extraction.md` 가 명시한 "1차 slice(staleness 축만 분리)"
범위를 정확히 이행한 순수 구조 리팩토링이며, `spec/7-channel-web-chat/1-widget-app.md` R7·R9 및 `2-sdk.md` §3
근거로 세워진 world/boot/unmount 세 축의 의미론·경계(`sessionEstablished` 제외 포함)를 문언·로직 그대로
보존한다. 기각된 대안을 되살리거나, 합의된 원칙을 어기거나, 근거 없이 결정을 뒤집은 지점은 발견되지 않았다.
유일하게 눈에 띈 점(신규 파일 헤더의 "9회" 집계)도 fabrication 이 아니라 기존 plan 문서의 서술을 그대로
인용한 것으로 확인되어 INFO 수준에 그친다.

## 위험도

NONE
