# Rationale 연속성 검토 결과

검토 대상: `spec/7-channel-web-chat/` (impl-done, diff-base=`origin/main`)
실제 diff: `spec/7-channel-web-chat/1-widget-app.md` 만 변경 (§3.1 "SSE 재연결" 문단 — `execution.replay_unavailable`
소비 배선 완료 + terminal 스냅샷 예외 추가). 나머지 5개 파일(`0-architecture.md`·`2-sdk.md`·`3-auth-session.md`·
`4-security.md`·`5-admin-console.md`)은 origin/main 대비 텍스트 변경 없음(코드/공유 함수는 같은 작업 세션에서 변경됨 — 아래 참조).

## 발견사항

- **[WARNING]** `3-auth-session.md` §3.1 "v1 구현 현황(부분)" 콜아웃이 이번 작업으로 부분적으로 stale 해짐 — "200+종료 REST 분기"는 이제 구현됐는데 여전히 "미구현(Planned)"으로 단일 문장에 묶여 있음
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1, 62번째 줄의 콜아웃 —
    > "아래 2단계의 **200+종료·404·복구불가 401 REST 분기와 `401 → 낙관적 refresh 1회` 는 여전히 미구현(Planned)** —
    > 그 외 status·오류는 `catch` soft-fail 후 SSE 로 진행하며, **종료는 SSE terminal 이벤트(버퍼 5분 내 replay)로 도달한다**."
  - 과거 결정 출처: 이 콜아웃 자체는 `spec/7-channel-web-chat/3-auth-session.md`(2026-07-09, PR #874, commit `f7c708842`)가
    확정한 "구현 현황 안내" — Rationale 은 아니지만 §Overview 가 "…재로드 401 낙관적 refresh(§R4) 등의 결정 근거는 Rationale"
    이라 지칭하는 R4 결정("낙관적 refresh 1회 후 종료")의 **구현 상태 표시**로 기능한다.
  - 상세: 이번 작업(같은 브랜치의 code 커밋 `fb0e77deb` "replay_unavailable 폴백의 terminal 상태 처리")이 `use-widget.ts`
    `seedWaitingFromStatus` — **§3.1 재로드 복원 경로와 §3.1 replay_unavailable 폴백이 공유하는 동일 함수** — 에
    `status ∈ {completed,failed,cancelled}` 검사를 추가해 `finalizeEnded`(storage 정리 + `[ended]` 전이 +
    host `conversationEnded` 통지)로 분기하도록 만들었다(코드 확인: `use-widget.ts:413-416`). 커밋 메시지 자체가
    "세 호출부(start·**restore**·replay 폴백)가 모두 보호받는다"고 명시해 재로드 복원 경로까지 이 분기의 수혜자임을
    자인한다. 즉 3-auth-session.md §3.1 2단계 목록의 **"200 + status ∈ {completed/failed/cancelled} → storage 정리 후
    [ended]" 항목은 이미 구현됐다** — 콜아웃의 "여전히 미구현" 서술과 실제 코드가 어긋난다. (반면 같은 문장이 묶어 지칭하는
    **404·401 낙관적 refresh 분기는 실제로 아직 없다** — `seedWaitingFromStatus` 의 `catch` 블록은 모든 non-2xx 를 구분 없이
    soft-fail 처리하며(`eia-client.ts` `getStatus` 가 404/401 모두 `EiaError` throw), `applyConfig` 복원 경로에도 별도
    404/401 분기가 없음을 확인했다. 이 부분만은 콜아웃이 여전히 정확하다.) 부수적으로 §3.1-3 "storage 정리 책임" 트리거
    열거("종료 수신·200+terminal·404·복구불가 401 확인·410 Gone 수신")도 이번에 새로 생긴 다섯 번째 트리거
    ("`execution.replay_unavailable` 수신 후 `getStatus` 가 terminal 로 확인") 를 명시적으로 포함하지 않는다 — 동작은
    기존 정책과 일치하지만 열거가 최신화되지 않았다.
    이 클래스의 문제(구현이 따라잡았는데 "Planned" 라벨이 안 지워짐)는 처음이 아니다 — 같은 대상 문서(`1-widget-app.md`)
    §R8 이 정확히 이 패턴을 지적한 전례가 있다: "한때 기록됐던 '…은 사실이 아니었다… 존재하지 않는 제약을 `Planned` 로
    남기면 후속 작업자가 이미 있는 변환기를 중복 구현하고, 진짜 제약이 가려진다." §3.1 표 자체도 "옛 §3.1 'Planned'
    host-API 드레인 제약 해소"라는 문구로 같은 패턴을 자체 교정한 전례가 있다(§R9 인접). 이번 3-auth-session.md 콜아웃은
    그 교정이 아직 적용되지 않은 잔여 사례로 읽힌다 — Rationale 자체를 위반한 것은 아니지만, 문서 정합성에 대한 프로젝트
    자신의 기존 원칙(§R8)과 거리가 있다.
  - 제안: `3-auth-session.md` §3.1 콜아웃을 "200+terminal 분기는 구현됨(`seedWaitingFromStatus` 공유 — start·restore·
    replay_unavailable 폴백 3경로 모두 적용, 2026-07-17 `fb0e77deb`), 404·`401→낙관적 refresh` 는 여전히 Planned" 로
    분리 갱신한다. 동시에 §3.1-3 storage 정리 책임 열거에 "`execution.replay_unavailable` 수신 후 `getStatus` 가
    terminal 확인 시" 항목을 추가해 `1-widget-app.md` §3.1 신규 문단과의 cross-reference 를 명시한다.

- **[INFO]** `1-widget-app.md` 신규 문단이 storage 정리 책임의 SoT(`3-auth-session.md` §3.1-3)를 직접 인용하지 않음
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1, "SSE 재연결" 문단의 blockquote —
    "이 경우 위젯은 표면 시드 대신 **세션 정리 + `[ended]` 전이 + host `conversationEnded` 통지**를 수행한다."
  - 과거 결정 출처: `spec/7-channel-web-chat/3-auth-session.md` §3.1-3 "storage 정리 책임"(이 절이 정리 트리거 목록의
    SoT임을 자임) · 같은 문서 §R6 "storage 정리 책임(§3.1-3)은 불변" (invariant 로 명시).
  - 상세: 새 문단의 "세션 정리"는 실질적으로 §3.1-3 이 정의하는 것과 동일한 storage-cleanup 액션이며 코드로도
    `finalizeEnded`→`teardownSession` 공유 경로로 확인된다(충돌 아님). 다만 같은 정책을 다른 문서에서 다시 산문으로
    설명하면서 SoT 문서로 명시적으로 되짚지 않아, 향후 두 서술이 독립적으로 drift 할 여지(§R6 이 스스로 "불변"이라
    강조한 대상)를 열어 둔다. 위 WARNING 항목의 §3.1-3 갱신과 함께 처리하면 자연히 해소된다.
  - 제안: 위 WARNING 의 §3.1-3 갱신 시, `1-widget-app.md` 의 해당 문장에 `([3-auth-session §3.1-3](./3-auth-session.md))`
    cross-reference 를 추가해 SoT 를 명시한다.

## 요약

이번 target diff(`1-widget-app.md` §3.1 — `execution.replay_unavailable` 소비 배선 완료 + terminal 스냅샷 예외)는
Rationale 연속성 관점에서 건전하다: 기각된 대안을 재도입한 곳이 없고, EIA `R-replay-unavailable`(신호 후 연결 유지·
재전송 없음)과 정확히 정합하는 새 예외를 도입하면서 그 근거를 인라인으로 충실히 서술했으며, origin/main 이 이미
"이벤트 기반 감지로의 교체는 클라이언트 측 후속(TODO)"이라 명시했던 항목을 그대로 이행한 것이라 결정 번복도 아니다.
`0-architecture.md`/`2-sdk.md`/`4-security.md`/`5-admin-console.md` 의 기존 Rationale(R1~R10 계열)과도 충돌하지 않으며,
EIA §R10 단일 sink 정책·EIA-NF-03·EIA-RL-07 등 인용된 cross-spec invariant 도 정확히 반영됐다(코드로 교차 검증 완료).
유일한 흠은 같은 작업 세션에서 공유 함수(`seedWaitingFromStatus`)가 변경되면서 `3-auth-session.md` §3.1 의 "구현
현황(부분)" 콜아웃 중 "200+종료 REST 분기 미구현" 서술이 stale 해진 것 — 이는 이 프로젝트가 §R8 에서 이미 한 번 자체
교정한 것과 동일한 클래스의 문제(구현이 문서를 추월했는데 "Planned" 라벨이 남음)라 재발 방지 차원에서 반영을 권고한다.

## 위험도

LOW
