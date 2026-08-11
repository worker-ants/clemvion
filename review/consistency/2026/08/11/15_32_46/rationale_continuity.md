# Rationale 연속성 검토 — spec/7-channel-web-chat (`apiBase` 스킴 검증 비대칭 폐기)

## 점검 배경

본 PR 은 `4-security.md` 가 종전에 "정상 임베드 경로(`wc:boot`)의 `apiBase` 는 신뢰 경계 안이라
검증 불요, host 없는 직접 로드/샘플의 쿼리 폴백만 http(s) 스킴 검증" 이라고 서술하던 **비대칭을
폐기**하고 두 입력 경로 모두 검증하도록 바꾼다. `4-security.md` 에 새 `## Rationale` 항목 `R0`
을 신설했다. 아래는 그 번복이 과거 결정·원칙과 정합하는지에 대한 검토다.

## 발견사항

### [INFO] 과거 비대칭 결정의 이력 검증 — 실제 이력과 일치, 지어낸 Rationale 아님

- target 위치: `4-security.md` `## Rationale` §R0 1~2문단 ("종전에는 쿼리 폴백에만 걸었다…")
- 과거 결정 출처: 커밋 `aba46cc90`(2026-06-28, PR #761) — `4-security.md` §1 표에 `apiBase` 입력
  검증 행을 최초 신설. 커밋 메시지: "configFromQuery apiBase 하드닝 — safeApiBaseFromQuery(…)
  … 임베드 정상경로는 postMessage라 무관". 당시 파일 실제 텍스트(`git show aba46cc90:…`)는
  "정상 임베드 경로의 `apiBase` 는 host postMessage(boot)로 주입되지만, **host 없는 직접 로드/
  샘플 경로**는 `?apiBase=` 쿼리(외부 통제 입력)로 폴백한다. 이 폴백 값은 **http(s) 스킴만
  허용**…" — orchestrator 프롬프트가 인용한 "종전 서술" 과 **문구까지 정확히 일치**한다.
- 상세: `git log -S safeApiBaseFromQuery -- codebase/channel-web-chat/src/widget/use-widget.ts`
  로 확인한 3개 커밋(`aba46cc90` 도입 → `3f1169ab5` 이번 번복(R0 신설) → `d8abc7003` 리뷰
  CRITICAL 2건 처분)만이 이 함수를 건드렸다. 즉 "비대칭을 기각한다" 는 R0 의 서술은 **실제
  존재했던 결정**을 정확히 참조하고 있으며, 이 저장소가 과거 지적받은 "지어낸 Rationale"
  패턴(`feedback_rationale_rejected_alternatives_need_history.md`)에 해당하지 않는다. 다만 그
  과거 결정은 **`## Rationale` 절이 아니라 §1 표 셀 안의 인라인 서술**로만 존재했었다 — "기각한
  대안" 이 정식 Rationale 항목이 아니었다는 점에서 R0 의 "기각한 대안 — 비대칭 유지" 표현은
  다소 formal 하게 들리지만, 내용은 실제 결정과 부합한다.
- 제안: 조치 불요. 참고로 R0 을 신설한 원 커밋(`3f1169ab5`)의 첫 서술("`apiBase` 가 없으면
  `applyConfig` 가 자기 자리에서 실패해 진단이 그쪽에 모인다")은 실측과 달라 리뷰에서 CRITICAL
  로 지적됐고, 후속 커밋(`d8abc7003`)에서 이미 정정됐다 — target 문서(현재 payload)의 R0 에는
  그 정정된 blockquote(">진단은 거절 지점에만 있다…")가 이미 반영돼 있어 stale 하지 않다.

### [INFO] 번복 근거의 실측 여부 — 코드·뮤테이션 테스트로 뒷받침됨

- target 위치: `4-security.md` §R0 "기각한 대안 — 비대칭 유지" 항목의 실측 1·2
- 과거 결정 출처: 해당 없음(신규 실측 주장 검증)
- 상세: 두 실측 주장을 워킹트리 코드로 직접 대조했다.
  1. "SDK 는 같은 값을 양쪽으로 보낸다" → `codebase/packages/web-chat-sdk/src/bridge.ts`
     `resolveIframeTarget()` 이 `new URLSearchParams({ apiBase: config.apiBase, … })` 로 iframe
     src 쿼리에 원본 `apiBase` 를 싣고, `index.ts` `boot()` 이 같은 `config` 객체를
     `bridge.post("wc:boot", config)` 로 postMessage 함 — 둘 다 검증되지 않은 원본 값. 코드로
     확인됨.
  2. "병합에서 boot 이 나중에 덮는다" → diff 의 이전 상태(`use-widget.ts`)가
     `runApplyConfig({ ...configFromQuery(), ...c } as BootMessage)` 였음을 직접 확인 — 쿼리
     검증 결과가 spread 순서상 뒤의 `c`(boot, 미검증)에 덮인다.
  둘 다 코드 사실로 확인되며, 커밋 `3f1169ab5` 본문은 추가로 "뮤테이션: 종전 동작(검증 없는
  boot 덮어쓰기) 복원 → 4건 RED" 라고 적어 assertion 이 아닌 mutation testing 으로 무력화를
  실증했다고 밝힌다.
- 제안: 조치 불요. 근거는 지어낸 서사가 아니라 실측이다.

### [INFO] `3-auth-session.md §R8`(발급-origin 바인딩)과의 정합

- target 위치: `4-security.md` §R0 말미 "이 축이 중요해진 계기는 §R8 발급-origin 바인딩이다…"
- 과거 결정 출처: `3-auth-session.md` §R8("저장 세션은 발급 `apiBase` 에 바인딩 — 재전송이
  origin 을 바꾸면 폐기")
- 상세: §R8 은 "host 입력이라 신뢰한다" 는 전제로 무언가를 완화한 바가 **없다** — 오히려
  fail-closed("판정할 수 없으면 폐기")·"레거시 세션 fail-safe 를 두지 않았다" 등 보수적 방향
  으로만 서술돼 있다. §R8 은 `apiBase` 값 *자체의 형식적 유효성*(스킴)이 아니라 "재전송 간
  origin 동일성" 만 다룬다. 따라서 이번 R0(스킴 검증 대칭화)이 §R8 이 세운 원칙과 충돌할
  여지는 없고, 오히려 §R8 이 `apiBase` 를 보안상 더 중요한 값으로 격상시켰다는 점에서 R0 의
  "그 값을 정하는 입력 경로가 둘인데 하나만 검증되는 상태를 유지할 이유가 없다" 는 논리적으로
  §R8 의 자연스러운 후속이다. R0 도 이 연결을 명시적으로 인용해 근거를 남겨 뒀다.
- 제안: 조치 불요.

### [INFO] `4-security.md` 다른 Rationale(R1~R6)과의 충돌 여부 — 없음

- target 위치: `4-security.md` §R2("빈 목록의 레이어별 비대칭은 의도된 설계"), §R5(same-origin
  동봉 위젯의 공급망 무결성 신뢰 전제)
- 과거 결정 출처: 동일 문서 §R1~R6
- 상세: R2 는 "비대칭이 항상 나쁜 것은 아니다 — 목적이 다르면 비대칭이 의도"라는 원칙을 세워
  뒀는데, 이는 R0 의 폐기와 표면상 반대 방향처럼 보일 수 있다. 그러나 R2 의 비대칭(임베드 soft
  검증 vs CORS hard 경계)은 **서로 다른 두 방어 레이어의 목적 차이**에서 오는 것이고, R0 이
  폐기한 비대칭(쿼리 vs boot 스킴 검증)은 **같은 값(`apiBase`)의 같은 위협(비-http(s) 스킴)을
  경로에 따라 다르게 취급**하던 것이라 성격이 다르다 — R2 의 원칙("목적이 다르면 비대칭 정당")
  을 R0 이 침해하지 않는다(오히려 "목적이 같은데 경로만 다르면 비대칭을 유지할 이유가 없다"는
  대구를 이룬다). R5(same-origin 동봉의 공급망 무결성 신뢰)도 R0 의 "위젯은 CDN origin 이라
  상대/프록시 경로가 host 로 해소되지 않는다" 는 논리와 같은 프레임을 공유하며 충돌하지 않는다.
  R1(CORS 분리)·R3(rate-limit fail-open)·R4(sanitize deny-by-default)·R6(공유 버킷 완화)도
  `apiBase` 스킴 검증과 직접 겹치는 invariant 를 갖지 않는다.
- 제안: 조치 불요.

### [INFO] 결정 번복 절차 자체는 이 저장소의 모범 사례에 해당

- target 위치: `4-security.md §R0` 전체 + 코드 SoT `use-widget.ts` JSDoc(`## 왜 boot 경로에도
  거는가`)
- 상세: 커밋 이력(`3f1169ab5` → `d8abc7003`)을 보면, 번복과 동시에 (a) 새 Rationale(R0)을
  작성했고, (b) 리뷰에서 "헬퍼만 지키고 호출부는 무방비"(testing CRITICAL)와 "거짓 정당화"
  (`applyConfig` 실패 지점 서술 오류, WARNING)가 지적되자 같은 세션에서 즉시 통합 회귀 테스트
  ·spec 정정을 추가해 처분했다. Rationale 연속성 관점에서 요구하는 "번복 시 새 Rationale 동반
  작성" 원칙을 정확히 지킨 사례다.
- 제안: 조치 불요.

## 요약

이 PR 이 뒤집는 과거 결정("쿼리 폴백만 http(s) 스킴 검증, `wc:boot` 은 신뢰 경계 안이라
검증 불요")은 `git log -S`로 확인한 실제 이력(커밋 `aba46cc90`, 2026-06-28)과 정확히 일치하며
지어낸 서사가 아니다. 번복 근거로 제시된 두 실측("SDK 가 `apiBase` 를 iframe 쿼리·`wc:boot`
양쪽에 싣는다", "병합이 `{ ...query, ...boot }` 순서라 boot 이 검증된 쿼리 값을 덮는다")은
코드(`bridge.ts` `resolveIframeTarget`, `index.ts` `boot()`, 옛 `use-widget.ts` 병합 로직)로
직접 확인되며, 커밋 이력상 mutation testing 으로도 뒷받침됐다. `3-auth-session.md §R8`(발급-
origin 바인딩)은 "host 를 신뢰한다"는 전제로 무언가를 완화해 둔 바가 없어 이번 대칭화와
충돌하지 않고, 오히려 `apiBase` 의 보안적 중요성을 높인 선행 결정으로서 R0 의 논리적 전제로
정합하게 인용됐다. `4-security.md` 자체의 다른 Rationale(R1~R6)이 세운 원칙(레이어 목적별
비대칭 허용, 공급망 무결성 전제 등) 중 이번 변경이 침해하는 것도 없다. 번복과 동시에 새
Rationale(R0)을 작성했고, 뒤이은 리뷰 라운드(CRITICAL 2건: 호출부 미보호 테스트, 거짓 정당화
서술)까지 같은 세션에서 처분해 spec 서술이 stale 하지 않다 — Rationale 연속성 관점에서 이
PR 은 CRITICAL/WARNING 급 문제가 없다.

## 위험도

NONE

STATUS: OK
