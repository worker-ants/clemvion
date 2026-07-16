### 발견사항

- **[WARNING]** `review/consistency/2026/07/17/00_35_59/SUMMARY.md` 가 커밋된 최종 상태에서도 "재시도 필요"·"내용 미확보" 문구를 그대로 보유 — 같은 세션에서 이미 복구된 `rationale_continuity.md` 내용과 불일치
  - 위치: `review/consistency/2026/07/17/00_35_59/SUMMARY.md` 상단 BLOCK 문구("`rationale_continuity` 는 status=`success` 로 보고됐으나 `output_file` 이 실제로 생성되지 않아... 내용 미확보 — 재시도 후 최종 확정 필요"), "Checker별 위험도" 표의 `rationale_continuity` 행("**재시도 필요**"), "권장 조치사항" #1("checker 재실행... 최종 BLOCK 판정 전 반드시 재확보")
  - 상세: 동일 세션(`00_35_59`)의 `rationale_continuity.md`(review 대상 파일 13)는 실제로는 3건의 발견사항(WARNING 1건 + INFO 2건, 위험도 LOW, Critical 0)을 담아 정상적으로 커밋에 포함돼 있다. `_retry_state.json`(파일 7)의 `_final_state_note`도 "FS-write flakiness 로 output_file 미기록 → workflow journal 에서 원문 복구·기록(내용 유실 없음). 전수 확보 후 Critical 0 확인 → BLOCK: NO 확정"이라고 명시해 이미 해소된 것으로 기록한다. 그런데 정작 사람이 가장 먼저 읽는 `SUMMARY.md` 본문·표는 이 해소 사실이 반영되지 않은 채 "재시도 필요"로 남아 있어, 같은 커밋 안의 두 파일이 서로 모순된 상태를 보고한다. 기능적으로 BLOCK 판정(NO) 자체는 맞았지만(사후에 봐도 Critical 0 이 맞으므로), 이 리뷰 산출물이 스스로 약속한 "권장 조치사항"이 이행됐는지 그 문서만 봐서는 확인 불가능하다.
  - 제안: `SUMMARY.md` 를 복구된 `rationale_continuity.md` 내용에 맞춰 갱신(위험도 LOW, "재시도 완료 — FS-write flakiness 로 인한 1회 재수집, 내용 유실 없음"으로 정정)하거나, 최소한 `_retry_state.json` 의 `_final_state_note` 를 SUMMARY 본문에도 반영.

- **[INFO]** 본 ai-review 세션(35개 파일)이 `review/consistency/**` + `spec/**` 로 스코프돼, 같은 두 커밋(`1dafe557f`, `9adb5c241`)에 포함된 `plan/**` 변경분(예: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 체크박스 `[x]` 갱신, `plan/in-progress/node-output-redesign/merge.md` L88/108 stale 표기 정정, `plan/complete/merge-p2-async-fanin.md` ADR 배너)이 본 review 대상에서 제외됐다.
  - 상세: 커밋 메시지와 `review/consistency/**` 산출물이 여러 차례 "plan 처분(1)(2)(3) 이행", "WARNING 전부 반영"을 주장하는데, 이 payload(35개 파일)만으로는 그 주장을 검증할 수 없다. `git show`로 직접 대조한 결과 해당 plan 파일 변경은 실제로 존재하며 주장과 정확히 일치했다(예: `spec-drift-ai-agent-outport-countmax.md` 처분(1)(2)(3) 모두 `[x]`로 체크되고 383 vs 485 레이어 구분·§4.2 배치 사유가 기록됨; `node-output-redesign/merge.md` L88/108 이 "P1 → P3(무기한 dormant)"로 갱신되고 신규 `(product-decision)` 항목이 UX 이슈를 승계함). 기능적 결함은 아니며, 이번 리뷰 스코프의 한계였다는 점만 기록.

### 교차검증 결과 (문제 없음 — 기록 목적)

세 차례의 consistency-check 세션(`00_17_40`, `00_35_59`, `00_55_57`)이 제기한 실질적 WARNING들을 최종 적용된 spec diff(파일 22~35)와 line-level 로 대조한 결과, 전부 정확히 해소됨을 확인했다:
- "~180" 수치 화석 잔존 2곳(`spec/2-navigation/4-integration.md:1110`, `spec/4-nodes/3-ai/0-common.md:63`) → 파일 24·27 diff 에서 485 로 정정됨.
- D1 근거(3중 교차검증 방법론)가 Overview 에, 결과값만 Rationale 에 있던 배치 역전 → 파일 29 diff 에서 Overview 는 결론값+SoT 링크만, 방법론 전체는 §9.1 Rationale 로 이동.
- D2~D4 무각주 리터럴 인용 → 파일 24·27·28·30 diff 전부 "2026-07-17 실측" + SoT 링크 병기로 통일.
- D4 "제약 각주" 축소(규모 병기만) → 파일 22(`0-overview.md`) diff 에서 `⚠` + `AI_AGENT_TOOL_COUNT_MAX` 초과 경고 + `§4.2` 링크로 회복, Cafe24/MakeShop 대칭 적용.
- D2 배치가 §1/§2 가 아닌 §4.2 뿐이라 discoverability 부족 → 파일 28 diff 에서 `mcpServers` 필드 행(§1)에 교차링크 추가로 보강.
- `§5.6` cross-link anchor 누락 → 파일 28 diff `#42-...` note 안에 `#56-도구-allowlist` anchor 로 통일.
- `R-adr-async-fanin` naming taxonomy 파편화(WARNING) → 최종 커밋(파일 26 diff)에서 `R-wontdo-async-fanin` 으로 개명, 선례(`R-wontdo-rawws-rest` 등)에 합류.
- `spec-impl-evidence.md` 가드 서술 정정(파일 35)은 실제 `spec-link-integrity.test.ts` 소스 주석("Scope (1) applies no target filter... What plan-coherence-checker owns is link hygiene *inside* `plan/**` docs — not spec→plan links")과 대조해 정확함을 확인 — 코드가 옳고 문서 오기를 바로잡은 정당한 정정.
- `plan/{in-progress→complete}/parallel-p2-followups.md` dead 백링크 5곳(00_17_40 WARNING)은 후속 커밋 `f0f46c329`("impl-done C1/C2")에서 해소됨을 확인.
- `spec/2-navigation/1-workflow-list.md` 의 `pending_plans` 재배선(`spec-sync-workflow-list-gaps.md` → `marketplace-and-plugin-sdk.md`)은 실제로 후자 plan 문서 L61 에 해당 항목("이관 2026-07-17, `spec-sync-workflow-list-gaps` 종결분")이 정확히 추적되고 있음을 확인.

### 요약

리뷰 대상은 실제 애플리케이션 코드 변경이 아니라 consistency-check 산출물(`review/consistency/**`, 3개 세션)과 그로부터 도출된 spec 문서 정정(`spec/**`, Cafe24 카탈로그 규모 실측·allowlist 경고 명문화·Merge ADR 마감)이다. 세 세션이 제기한 CRITICAL 은 없었고 다수의 WARNING(수치 화석 잔존, Overview/Rationale 배치, 출처 표기 비일관, D4 제약 각주 축소, D2 배치, plan 체크박스·백링크 미갱신, `R-adr-*` naming taxonomy)은 이후 커밋에서 line-level 로 정확히 반영됐음을 실측 대조로 확인했다 — 의도(요구사항 ID·수치·경고 배치)와 구현(최종 spec 텍스트) 간 괴리가 없다. 유일한 실질적 결함은 `review/consistency/2026/07/17/00_35_59/SUMMARY.md` 가 같은 세션에서 이미 복구된 `rationale_continuity.md` 의 최종 상태(LOW, Critical 0)를 반영하지 못한 채 "재시도 필요" 문구를 남겨, 리뷰 산출물 자체의 반환값(보고 상태)이 실제 상태와 불일치하는 점이다 — 기능적 영향(BLOCK 판정)은 없으나 감사 기록으로서의 정합성 결함이다. 이 리뷰 세션의 파일 스코프가 관련 `plan/**` 변경을 제외한 점도 별도로 기록했으나(INFO), 독립 검증 결과 실체는 커밋 메시지 주장과 일치했다.

### 위험도
LOW