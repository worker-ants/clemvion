# Rationale 연속성 검토 — `spec/conventions/error-codes.md` (impl-done)

## 검토 범위

target 실제 델타(`git diff origin/main...HEAD -- spec/conventions/error-codes.md`)는
§Overview "적용 범위" 문단 뒤에 붙는 25줄(순수 추가 두 문단): `ErrorCode` 단수 서술 →
`ErrorCode`/`EngineErrorCode` 두 surface 병기. **이 파일 자체의 텍스트는 이전 검토 라운드
(`23_17_23`)와 완전히 동일**하다 — 이번 라운드에서 새로 번들된 구현 diff(4개 파일/327줄)는
① `error-codes.ts` 최상단 JSDoc 보강(엔진도 일부 코드를 발행한다는 점을 명문화, 직전 라운드
INFO#2 제안의 반영), ② `spec-links.test.ts`/`stray-tool-tags.test.ts`(신규)/`tree-walk.ts` —
harness 문서 가드 테스트로 `error-codes.md` 의 도메인 결정과 무관하다.

대조 자료(HEAD 워킹트리에서 직접 확인):

- `spec/conventions/error-codes.md` 현재 전문 + 기존 `## Rationale`(7개 항목, 첫 절부터
  "그 2분법에 없던 제3상태를 §5 표 등급 B 로 명문화했다" 까지)
- `plan/complete/exec-intake-followups.md` ARCH#5 ⑤(1~168행 직접 Read) — 2026-06-14
  `4-execution-engine.md §Rationale` 확정 결정("`EXEC_*` prefix 기각, 중앙 `ErrorCode`
  확장 채택")과의 관계를 다루는 상세 서술. 이 문단 자체가 **이미 한 차례 rationale_continuity
  WARNING(`21_34_02`)을 받아 정정된 이력**을 명시하고 있다.
- `plan/in-progress/spec-conventions-engine-error-code-surface.md` — 이 편집의 착수 근거 트래커
- `codebase/backend/src/nodes/core/error-codes.ts`(`ErrorCode`/`EngineErrorCode` 실 정의) ·
  `error-codes.spec.ts`(9~46행, 두 enum 이 별도 `describe` 블록으로 독립 검증됨 — 자매 const·
  겹침 없음 주장과 실측 일치)
- `spec/conventions/spec-impl-evidence.md` §4.2(126~136행) + `plan/in-progress/harness-review-gate-followups.md:174-181`
  — 신규 `stray-tool-tags.test.ts` 가드의 §4.2 SoT 표 미등재 상태와 그 유예 사유

## 발견사항

- **[INFO]** 새 Overview 병기 문단에 대응하는 `## Rationale` 항목이 여전히 없음(전 라운드
  INFO 이월, 미해결이나 결함 아님)
  - target 위치: `spec/conventions/error-codes.md` §Overview "적용 범위" 아래 신설 두 문단
    ("대표 surface 는 둘이다" / "경계는 비대칭이다")
  - 과거 결정 출처: 없음(신규 결정 아님) — CLAUDE.md 정보 저장 원칙("결정의 배경·근거 → 해당
    spec 문서 끝의 `## Rationale`")과 대조
  - 상세: 이 문단을 도입한 근거(exec-intake-followups.md ARCH#5 ⑤ 의 "왜 판단 기준·목적지
    매핑을 spec 본문에 안 넣었는가")는 spec 파일 안이 아니라 plan/커밋 메시지에만 있다. 이는
    직전 라운드(`23_17_23`)에서 이미 동일하게 지적됐고, 이번 라운드까지 spec 파일 자체는
    한 글자도 바뀌지 않아 미해결 상태가 그대로 이월됐다. 근거 자체(ARCH#5 ⑤ 가 "의식적
    이탈·해석 여지" 를 스스로 명시)는 견고하므로 **결정의 무근거 번복은 아니다**.
  - 제안: 변경 없음(전 라운드와 동일) — `## Rationale` 에 "두 surface 의 존재만 기술, 판단
    기준은 의도적 유보 — 근거 `exec-intake-followups.md` ARCH#5 ⑤" 한 줄 포인터를 추가하면
    향후 grep/자동 스캔에 더 견고해진다. 필수는 아니다.

- **[INFO]** 신규 `stray-tool-tags.test.ts`(build 차단 가드)가 `spec-impl-evidence.md §4.2`
  SoT 표("build 차단 **4건**")에 미등재 — 참고용 재확인, target(`error-codes.md`) 밖 이슈
  - target 위치: 해당 없음(codebase diff, `spec/conventions/` 스코프 밖 파일)
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §4.2` 서두("본 절이 규약 SoT")
  - 상세: §4.2 는 스스로를 지식저장소·plan 무결성 build 가드의 닫힌 SoT 로 선언하는데, 실제로는
    build 를 막는 가드가 5건째다. 다만 이는 `plan/in-progress/harness-review-gate-followups.md:174-181`
    에 명시적 사유("이 PR 에 spec 축이 이미 과하게 묶여 있어 이번엔 안 함")와 재개 신호("다음
    harness 가드 추가 시 함께")로 이미 추적되고 있어 **무근거 번복이 아니라 의도된 유예**다.
    target(`error-codes.md`) 자체와는 무관한 별개 파일이라 이 checker 의 1차 범위 밖이지만,
    같은 세션의 plan_coherence 가 이미 이 항목을 다뤘을 가능성이 높으므로 중복 지적을 피하기
    위해 참고로만 남긴다.

## 정합성 확인 (문제 없음, 직접 재검증)

- **2026-06-14 결정 재도입 아님**: `4-execution-engine.md §Rationale` 이 기각한 것은 "값
  레벨 `EXEC_*` prefix(이중 표기)" 다. target 신설 두 문단은 코드 값 문자열을 하나도 바꾸지
  않는다(존재·자매 관계·키 disjoint 서술만) — 재도입도 무근거 번복도 아니다.
- **선례 이탈은 유보 상태로 정확히 보존됨**: `RETRY_*` 선례("레이어가 달라도 한 enum 유지")와
  `EngineErrorCode` 신설(자매 const)의 형태적 어긋남은 ARCH#5 ⑤ 가 스스로 "의식적 이탈"이라
  기록한 유보다. target 은 이를 규약 수준 결정으로 승격시키지 않고 "존재"만 서술 — 원칙 위반
  아님.
- **사실관계 실측 재검증(이번 라운드 독립 확인)**: `error-codes.spec.ts` 를 직접 Read —
  `ErrorCode`/`EngineErrorCode` 가 별도 `describe` 블록(9행/46행)으로 독립 검증되어 자매
  const·겹침 없음 서술과 일치. `grep "대표 surface" spec/` 전수 확인 결과 다른 spec 문서에
  "대표 surface"(단수/복수) 관련 상충 서술 없음.
- **§3 historical-artifact 레지스트리와 충돌 없음**: 새 문단의 "이 병기는 새 규칙이 아니라
  기존 실무의 명문화" 서술은 §3 의 `WORKER_HEARTBEAT_TIMEOUT` 행(이미 `EngineErrorCode`
  멤버를 다룸)과 정합.
- **동반 코드 diff(`error-codes.ts` JSDoc)도 target 의 Rationale 과 충돌 없음**: 신규
  JSDoc(1~11행)은 "엔진도 일부 코드를 발행한다"는 target 문서의 §Overview 서술을 소스에
  거울처럼 반영할 뿐 새 결정을 내리지 않는다.

## 요약

target(`spec/conventions/error-codes.md`)은 이전 라운드(`23_17_23`) 검토 이후 텍스트가 전혀
바뀌지 않았고, 그 라운드가 이미 exec-intake-followups.md ARCH#5 ⑤(2026-06-14 결정과의 관계,
`RETRY_*` 선례 이탈의 의식적 유보)를 근거로 LOW 위험을 확정한 상태다. 이번 라운드에서 새로
번들된 구현 diff(error-codes.ts JSDoc 보강, harness 문서 가드 3파일)를 독립적으로 재검토한
결과 target 의 도메인 결정과 충돌하는 신규 사실은 없으며, 기각된 대안의 재도입·합의 원칙
위반·무근거 번복·invariant 우회 중 어느 것도 발견되지 않았다. `## Rationale` 포인터 부재
INFO 1건(이월, 결함 아님)과 `spec-impl-evidence.md §4.2` SoT 표 미등재(target 밖, 이미 별도
plan 에 추적됨) 참고 INFO 1건만 남긴다.

## 위험도

LOW
