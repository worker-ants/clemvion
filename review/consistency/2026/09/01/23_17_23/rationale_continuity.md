# Rationale 연속성 검토 — `spec/conventions/error-codes.md` (impl-done)

## 검토 범위

target 실제 델타: `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 25줄짜리
추가(`ErrorCode` 단수 서술 → `ErrorCode`/`EngineErrorCode` 두 surface 병기). 함께 번들된
구현 diff(`spec-links.test.ts`·`stray-tool-tags.test.ts`, 225줄)는 harness 문서 가드 테스트로
본 target 의 도메인 결정과 무관해 본 검토 범위 밖으로 취급했다.

대조 자료(HEAD 워킹트리에서 직접 확인):

- `spec/conventions/error-codes.md` 현재 전문 + 기존 `## Rationale` (7개 항목)
- `plan/complete/exec-intake-followups.md` ARCH#5 ⑤ — 2026-06-14 사용자 결정("`EXEC_*` prefix
  기각, 중앙 `ErrorCode` 확장 채택")과의 관계를 다룬 기존 Rationale
- `plan/in-progress/spec-conventions-engine-error-code-surface.md` — 이 편집의 착수 근거·경위
  트래커(SoT 로 지목됨)
- `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode`/`EngineErrorCode` 실제 정의) ·
  `error-codes.spec.ts` (겹침 없음 단언)
- `git log -p` — 해당 문단을 도입한 두 커밋(`b5d2e6972`, `9c0028371`)의 커밋 메시지 본문
- 같은 세션의 선행 `rationale_continuity` 리뷰 3건(`21_39_47`/`21_49_21`/`21_56_30`) — 병기 전
  더 큰 초안(`plan/complete/spec-draft-error-code-two-surfaces.md`)에 대한 리뷰. 최종 커밋은
  그 초안보다 크게 축소됐다(목적지 필드 매핑·판단 기준·"세 번 고쳤다" 프로즈 전부 제외).

## 발견사항

- **[INFO]** 새 Overview 병기 문단에 대응하는 `## Rationale` 항목이 없다 — 단, 의도적 설계로
  확인됨
  - target 위치: `spec/conventions/error-codes.md` §Overview "적용 범위" 아래 신설 두 문단
    ("대표 surface 는 둘이다" / "경계는 비대칭이다")
  - 과거 결정 출처: 없음(신규 결정 아님) — 다만 CLAUDE.md 정보 저장 원칙("결정의 배경·근거 →
    해당 spec 문서 끝의 `## Rationale`")과 대조
  - 상세: 이 문단을 도입한 두 커밋(`b5d2e6972`, `9c0028371`)의 메시지에 "`--spec` 6라운드가
    실재 오류를 4번 잡았고, 최종판은 분류(목적지 필드 매핑·판단 기준)를 **아예 하지 않는다**"는
    명시적 설계 결정이 적혀 있으나, 이 근거는 spec 파일 안이 아니라 **커밋 메시지와
    `plan/in-progress/spec-conventions-engine-error-code-surface.md`** 에만 있다. 그 plan
    파일 자체가 "규약 문서에 판단 기준을 쓰면 그 형태가 규약으로 굳는데, 근거인 ARCH#5 ⑤ 가
    스스로 '의식적 이탈'·'해석의 여지가 있다'고 유보를 남긴 상태라 승격시키지 않는다"고
    분명히 밝히고 있어 — **이것은 결정의 무근거 번복이 아니라 "왜 판단 기준을 쓰지 않기로
    했는가"에 대한 근거가 있는 의도적 축소**다. `error-codes.md` 자체의 기존 Rationale
    ("왜 SoT 를 분리하는가" 등)과도 충돌하지 않는다(목적지 매핑을 `3-error-handling.md §1`
    로 위임하는 기존 원칙과 정합).
  - 제안: 현재도 결함은 아니나, 이 plan(`spec-conventions-engine-error-code-surface.md`)이
    `complete/` 로 이동한 뒤에도 "왜 두 문단만 있고 판단 기준·목적지 매핑이 없는가"를 spec
    자체에서 추적하려면, `error-codes.md` `## Rationale` 에 한 줄짜리 포인터("두 surface 의
    존재만 기술하고 판단 기준은 의도적으로 유보 — 근거는 `exec-intake-followups.md` ARCH#5 ⑤")
    를 추가하는 편이 향후 grep/자동 스캔에 더 견고하다.

## 정합성 확인 (문제 없음, 참고용)

- **2026-06-14 결정 재도입 아님**: `4-execution-engine.md` §Rationale 이 기각한 것은
  "값 레벨 prefix(`EXEC_*`, 이중 표기)"이고, target 신설 문단은 값 문자열을 하나도 바꾸지
  않는다(존재·자매 관계·키 disjoint 서술만). 재도입도 무근거 번복도 아니다 — 이는
  `exec-intake-followups.md` ARCH#5 ⑤ 에 이미 명시적으로 검증돼 있고, target 문구가 그
  경계("기각된 것은 값 레벨 prefix 뿐")를 정확히 좇는다.
- **선례 이탈은 유보 상태로 남겨 둠**: `RETRY_*` 선례("레이어가 달라도 한 enum 유지")와
  `EngineErrorCode` 신설(자매 const)이 형태상 어긋난다는 점은 ARCH#5 ⑤ 가 스스로 "의식적
  이탈"이라 인정한 유보 사항이다. target 은 이 유보를 규약 수준 결정으로 승격시키지 않고
  "존재"만 서술해 유보를 그대로 보존한다 — 원칙 위반이 아니라 원칙 존중이다.
- **사실 관계 실측 검증**: "같은 파일에 `ErrorCode`/`EngineErrorCode` 자매 const"
  (`error-codes.ts:8,147`), "키 겹침 없음 — 테스트로 고정"(`error-codes.spec.ts:59-60`
  `overlap` 단언), "`WORKER_HEARTBEAT_TIMEOUT` 이 `EngineErrorCode` 멤버"(`:160`) 모두
  코드와 대조해 정확함을 확인했다. 지어낸 실측이나 과장된 인용이 없다.
- **§3 historical-artifact 레지스트리와 충돌 없음**: 새 문단이 "이 병기는 새 규칙이 아니라
  기존 실무의 명문화"라 서술하는데, §3 의 `WORKER_HEARTBEAT_TIMEOUT` 행은 이미
  `EngineErrorCode` 소속 코드를 다루고 있었으므로(이름의 부정확성 논의) 이 서술은 기존
  레지스트리 내용과 모순되지 않는다.
- **"대표 surface 는 둘" 서술이 향후 확장을 봉쇄하지 않음**: 문구는 현재 상태를 기술할 뿐
  "정확히 둘로 고정"이라 규정하지 않는다. `plan/in-progress/spec-conventions-engine-error-code-surface.md`
  가 세 번째 자매 const(`WsErrorCode`) 가능성을 열어 둔 것과 충돌하지 않는다.

## 요약

target 은 `error-codes.md` §Overview 에 `EngineErrorCode` 를 두 번째 대표 surface 로 병기하는
소규모(25줄) 추가로, 2026-06-14 확정 Rationale(`EXEC_*` prefix 기각)을 재도입하지 않고 값
문자열도 바꾸지 않는다. `RETRY_*` 선례와의 형태적 이탈은 `exec-intake-followups.md` ARCH#5 ⑤
가 이미 "의식적 이탈·유보"로 기록해 둔 것을 그대로 존중하며, target 은 그 유보를 규약 수준
결정으로 승격시키지 않도록 의도적으로 서술 범위를 좁혔다(존재·자매 관계·키 disjoint 만,
목적지 필드 매핑·판단 기준은 각각 기존 SoT 문서·별도 planner 항목으로 위임). 이 축소 자체의
근거는 spec 본문이 아니라 커밋 메시지와 in-progress plan 트래커에만 있어 완전한 결함은
아니지만 발견 가능성이 낮다는 INFO 1건을 남긴다. CRITICAL/WARNING 급 재도입·원칙 위반·
암묵적 invariant 우회는 발견되지 않았다.

## 위험도

LOW
