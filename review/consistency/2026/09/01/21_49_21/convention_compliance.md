# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 발견사항

- **[WARNING]** "층(layer)" 이 이 문서군의 확립된 "레벨/레이어" 용어와 충돌한다
  - target 위치: target 문서 `## 변경 제안` — "§Overview '적용 범위' 문단에 두 surface 를
    **층(layer)으로** 병기한다" 및 하위 불릿 `ErrorCode` — **노드 핸들러 층**의 대표 surface /
    `EngineErrorCode` — **엔진 층**의 대표 surface"
  - 위반 규약: `spec/conventions/error-codes.md` 자신 및 그 `code:` SoT
    (`codebase/backend/src/nodes/core/error-codes.ts`), 그리고 자매 SoT 문서
    `spec/5-system/3-error-handling.md §1.4` — 이 셋 모두 정확히 이 node-handler-vs-engine
    구분에 대해 이미 **"레벨" / "레이어"** 라는 용어를 확립해 쓰고 있다:
    - `error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행: `"엔진 레벨 error.code"`; `AbortError` 행:
      `"노드 레벨 error.code"`
    - `error-codes.md` §4.1 박스: `"엔진 레벨 EIA execution.failed.error.code"`,
      `"본 절의 내부 분류 문자열과 레이어가 다르다"`
    - `error-codes.ts:1-2` JSDoc: `"Canonical error-code enum for node handlers' output.error.code"`;
      `:116` `"**엔진 레이어** 에러 코드 — 노드 핸들러가 아니라 엔진 자신이…"`; `:125`
      `"레이어는 타입에 드러나고 SoT 는 하나로 남는다"`
    - `3-error-handling.md:112` `"엔진 레벨 — … **노드 출력 레이어**는 동일 타임아웃을 …"`,
      `"두 레이어 구분 SoT: conventions/error-codes.md §4"`
  - 상세: target 이 새로 도입하려는 "층" 은 세 SoT(spec convention · 구현 소스 · 자매 spec) 가
    동일 개념을 이미 부르는 이름이 아니다. `spec/` 전체에서 "층" 자체가 금지어는 아니다
    (`5-system/6-websocket-protocol.md` 표 헤더, `conventions/conversation-thread.md` "렌더 층"
    등 다른 맥락에서 이미 쓰인다) — 하지만 **이 정확한 축(엔진 vs 노드 핸들러)** 에는 이미
    "레벨"/"레이어" 가 정착해 있어, 같은 파일·같은 축에 세 번째 동의어를 얹으면 다음 사람이
    "레이어" 로 검색했을 때 이 병기 문단을 놓치거나, 반대로 "층" 이 "레이어" 와 다른 제3의
    분류축인지 헷갈릴 수 있다. `error-codes.md §4` 도입부가 이미 "형태는 같지만 정규화
    함수도 목적지 필드도 다르다 — 한쪽 표를 다른 쪽 근거로 읽으면 안 된다" 고 층위 혼동을
    명시적으로 경계하는 문서인 만큼, 이 문서 안에서 층위를 가리키는 용어 자체가 갈라지는
    것은 그 경계 취지와 정면으로 부딪힌다.
  - 제안: "층(layer)" 을 "레이어" 또는 "레벨" 로 교체해 `error-codes.ts` JSDoc(`엔진 레이어`)·
    `error-codes.md` §3/§4.1(`엔진 레벨`/`레이어`)·`3-error-handling.md:112`(`엔진 레벨`/`노드 출력
    레이어`) 와 표기를 맞출 것. 두 용어(레벨/레이어) 가 이미 혼용 중이므로 이번 병기에서 굳이
    통일할 필요는 없으나, "층" 이라는 **세 번째** 표현을 새로 얹는 것만은 피할 것.

- **[INFO]** 새 SoT 위임 불릿이 §Overview "책임 경계" 목록과 표기 스타일이 다르다
  - target 위치: target 문서 `## 변경 제안` 네 번째 불릿 — `"카탈로그 SoT([...](...))에 맡긴다"`
  - 위반 규약: `spec/conventions/error-codes.md` §Overview "책임 경계" 목록의 기존 표기 관례
    (`"**카탈로그·분류·트리거**: [`5-system/3-error-handling.md §1`](...) (SoT)."` — SoT 표기가
    링크 **뒤** 괄호로 붙는다) 및 `audit-actions.md` §Overview 도 동일 패턴.
  - 상세: target 자신도 인지하고 있듯("§Overview 는 그 위임을 이미 선언해 두었다") 이 불릿은
    기존 "책임 경계" 목록의 재확인이다. 실제 patch 작성 단계에서 문구를 넣을 때 `"카탈로그
    SoT(링크)"` 처럼 SoT 를 **앞**에 붙이면, 같은 문서 안에서 SoT 표기 위치가 두 가지 스타일로
    공존하게 된다.
  - 제안: 실제 diff 를 쓸 때는 `"…SoT 는 [`5-system/3-error-handling.md §1`](../5-system/3-error-handling.md) 에 맡긴다"` 처럼 기존 "링크 + (SoT)" 또는 "SoT 는 [링크]" 순서 중 하나로
    통일. 사소한 표기 문제이며 병합을 막을 사안은 아니다.

- **[INFO]** 문서 구조 규약(Overview/본문/Rationale) 은 준수
  - target 위치: target 문서 전체 (`## Overview` → `## 실측`/`## 변경 제안` → `## Rationale`)
  - 상세: CLAUDE.md 가 권장하는 3섹션 구성을 그대로 따르고 있고, frontmatter 의 `spec_impact` 도
    YAML 리스트(주석 포함, 파싱에는 영향 없음) 형식이라 Gate C 요건(bare string·빈 배열 금지)을
    만족한다. 별도 조치 불요 — 참고용으로만 기록.

## 요약

target 은 두 라운드(1차/2차/3차 `--spec`)의 지적을 반영해 구조적으로는 안정된 상태다 — Overview/
본문/Rationale 3섹션, SoT 위임·중복 회피 원칙 모두 기존 `error-codes.md` 의 정식 규약과 정합한다.
다만 이번에 새로 발견된 이슈는 **용어 신조어화**다: 병기 초안이 "층(layer)" 이라는 새 용어를
쓰는데, 정작 이 정확한 node-handler-vs-engine 구분에 대해서는 `error-codes.md` 자신·구현 소스
(`error-codes.ts` JSDoc)·자매 SoT 문서(`3-error-handling.md`) 가 이미 "레벨"/"레이어" 로 확립해
두었다. 규약을 직접 위반하는 CRITICAL 은 아니지만, 같은 문서가 스스로 "층위 혼동을 경계하라"고
말하는 자리에 세 번째 동의어를 심는 것은 그 취지와 어긋나는 표현이라 WARNING 으로 분류한다.
그 외 SoT 표기 스타일 관련 INFO 1건을 제외하면 규약 위반은 발견되지 않았다.

## 위험도
LOW
