# Plan 정합성 검토 — spec-draft-cross-audit-doc-batch.md (V-18 재검증 라운드)

## 발견사항

- **[WARNING] 문서 말미 종합 `## Rationale` 이 V-18 정정 이전의 "종결" 프레이밍을 그대로 남김 — 자기모순**
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` 라인 77 (`## Rationale`), 대비 라인 40-47 (`## V-18` 섹션 본문)
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §V-18(라인 119-125, 옵션 "코드 구현 재개" vs "보류(spec 명시)")
  - 상세: 이번 라운드에서 §V-18 섹션 헤딩("보류 + spec v1 범위 명시")과 본문("재검증(정정)": getStatus 는 호출하되 waiting_for_input 성공 케이스만 처리, 200/404/401/네트워크 오류는 soft-fail, "초기 '정합' 판단은 오판" 명시적 인정, "V-18 갭은 실재한다")은 직전 라운드(19_19_53) CRITICAL 을 정확히 반영해 정정됐다. 그러나 문서 말미 종합 `## Rationale` 라인 77 은 여전히 "V-18 은 stale audit finding 재검증 종결" 이라는 옛 프레이밍을 그대로 두고 있다 — 이는 "갭이 실재하지 않아 조치 불요로 닫힌다(종결)"는 뜻으로 읽히며, 바로 위 §V-18 섹션이 말하는 "갭은 실재하고, 완전 구현은 보류한 채 v1 부분 범위만 spec 에 정직하게 명시한다"(= 결정 보류이지 종결이 아님)와 모순된다. 리뷰어/후속 소비자가 종합 Rationale 만 훑으면 "V-18 은 이미 해결된 오탐이었다"고 오독할 위험이 있다 — 정확히 직전 라운드가 지적한 오류 패턴(코드 재확인 없이 "정합/종결"로 요약)이 요약 문단에서 재발했다.
  - 제안: 라인 77 을 "V-18 은 갭이 실재함을 재확인 — 구현 보류 결정 하에 §3.1 에 v1 부분 범위(waiting-seed 전용, 200/404/401 REST 분기·401 낙관적 refresh 는 Planned)를 정직하게 명시" 등으로 §V-18 본문과 정합하도록 정정. "종결"이라는 단어는 코드 구현 완료 또는 spec 자체를 완전히 하향한 경우에만 쓰고, 본 건처럼 "보류 + 부분 범위만 spec 명시"인 경우는 사용하지 않는다.

- **[INFO] V-18 재검증 결과는 코드(`use-widget.ts`)·직전 CRITICAL 지적과 정확히 일치 — 본문 서술 자체는 정합**
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` 라인 40-47
  - 관련 plan: `spec-code-cross-audit-2026-06-10.md` §V-18(라인 119-125, "권장: 보류+spec 명시" — 잔여 미결 목록 라인 46 "V-12·V-13·V-18"), `review/consistency/2026/07/05/19_19_53/plan_coherence.md` (직전 CRITICAL)
  - 상세: `codebase/channel-web-chat/src/widget/use-widget.ts` 를 라인 단위로 재확인한 결과 target 서술이 정확하다 — `seedWaitingFromStatus`(라인 219-245)는 `status.status === "waiting_for_input"` 성공 케이스만 dispatch 하고 그 외(200+종료·404·401·네트워크 오류)는 `catch { console.warn(...) }` 로 soft-fail 한다. `applyConfig`(라인 415-438, 복원 진입점)는 `seedWaitingFromStatus` 호출 결과와 무관하게 무조건 `openStream(saved, "0")` 을 호출한다(라인 434-435). spec `spec/7-channel-web-chat/3-auth-session.md §3.1`(라인 60-76)이 규정하는 200/404/401 REST 3분기·`401 → 낙관적 refresh 1회`(§R4, 라인 89-93)는 코드에 존재하지 않는다 — target 의 "미구현" 판단과 일치. 이번 정정은 cross-audit plan 이 제시한 두 옵션 중 "보류(spec 명시)" 를 채택했고, 이는 cross-audit plan 라인 124 의 "권장" 과도 일치한다. 또한 같은 세션에 진행 중인 `spec-sync-structural-followups.md` 라인 65(`seedWaitingFromStatus` 의 `console.warn` 을 "정확히 기술"로 재확인)와도 상충 없이 정합한다 — 두 plan 모두 이 함수가 soft-fail 전용이라는 동일 결론에 도달했다.
  - 제안: 조치 불요(위 WARNING 정정 후 문서 전체가 일관됨).

## 요약
직전 라운드(19_19_53)가 지적한 CRITICAL — V-18 을 "정합 확인, 변경 불요"로 근거 없이 종결 처리한 것 — 은 이번 라운드에서 섹션 본문 수준(라인 40-47)에서는 정확히 해소됐다. `use-widget.ts` 를 라인 단위로 재확인한 결과 target 의 새 서술("getStatus 는 호출하되 waiting_for_input 성공 케이스만 처리, 나머지는 soft-fail, applyConfig 는 결과 무관하게 SSE 오픈, 200/404/401 분기·401 refresh 는 미구현")은 코드와 정확히 일치하며, cross-audit plan 이 제시한 "보류(spec 명시)" 옵션을 정합하게 채택했다("잔여: V-12·V-13·V-18" 미결 목록과도 모순 없음, 같은 세션의 spec-sync-structural-followups.md 재확인과도 정합). 다만 문서 말미의 종합 `## Rationale`(라인 77)이 "V-18 은 stale audit finding 재검증 종결"이라는 옛(사전-정정) 프레이밍을 그대로 남겨 §V-18 본문("갭은 실재한다", "보류")과 자기모순을 일으킨다 — 이는 CRITICAL 급은 아니지만(미해결 결정을 실제로 우회하는 것이 아니라 요약 문구의 잔재), 정정 없이 병합되면 다음 소비자가 다시 "이미 해결된 문제"로 오독할 위험이 있어 WARNING 으로 등재한다.

## 위험도
LOW
