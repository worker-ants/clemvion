# Rationale 연속성 검토 — spec-update-assistant-masking.md

## 발견사항

- **[WARNING]** §4.1.1 실행-조회 도구 "기획 결정 메모" 표가 갱신 대상에서 빠져 있다
  - target 위치: `plan/in-progress/spec-update-assistant-masking.md` "## 고칠 두 곳 → 1." 및 하단 체크리스트 `- [ ] §4.1.1 마스킹 규칙 + Rationale`
  - 과거 결정 출처: `spec/3-workflow-editor/4-ai-assistant.md` `## Rationale` → "Workflow AI Assistant — 실행 조회 도구(get_workflow_executions / get_execution_details) 기획 결정 메모" § "확정된 결정 사항" 표, 1429번째 줄:
    `| 민감 필드 마스킹 | maskSensitiveFields 공통 유틸 재귀 적용 (...). 원본은 DB 에 그대로 남김 | 채팅 창에 그대로 렌더되므로 최소 안전 기본값 필수. 기존 유틸 재사용 |`
  - 상세: target 이 고치겠다고 명시한 곳은 (a) 요구사항 본문 §4.1.1 (259번째 줄, `ED-AI-37` 정본)과 (b) EIA §R17 "잔여③" 두 곳뿐이다. 그러나 같은 spec 파일(`4-ai-assistant.md`) 안에 **또 다른 Rationale 결정 기록**이 있다 — ED-AI-35~38 을 도입할 때 작성된 "확정된 결정 사항" 표로, "민감 필드 마스킹" 행의 근거를 명시적으로 **"기존 유틸 재사용"**이라고 적어 두었다. `maskSensitiveFields` 단독에서 `deepRedactSecrets` 중첩으로 바뀌면 이 근거 문구는 더 이상 사실이 아니게 된다. target 의 "고칠 두 곳" 목록에 이 표가 포함되는지 불명확하다 — "§4.1.1 마스킹 규칙 + Rationale" 이라는 체크리스트 항목명이 요구사항 본문(§4.1.1)만을 가리키는 것으로 읽힐 수 있어, 실행 시 이 결정 메모 표를 빠뜨리면 같은 spec 파일 안에서 "확정된 결정: 기존 유틸 재사용" (구) vs "§4.1.1: deepRedactSecrets 중첩" (신) 두 서술이 충돌한 채 남는다. 이는 "결정의 무근거 번복"(과거 결정을 뒤집으면서 그 결정이 적힌 자리를 갱신하지 않음)에 해당할 위험이다.
  - 제안: planner 턴 실행 시 §4.1.1 요구사항 본문뿐 아니라 line 1429 표의 "민감 필드 마스킹" 행(결정/근거 칸)도 함께 갱신하거나, 최소한 그 행에 "2026-08-23 결정으로 대체 — §4.1.1 및 새 Rationale 참조" 각주를 남겨 두 서술이 정본-미러 관계임을 명시한다.

- **[INFO]** `deepRedactSecrets` 의 기존 "잔여 갭(의도)" 이 새 표면에도 그대로 상속됨을 명시하면 재발견 비용을 줄인다
  - target 위치: `plan/in-progress/spec-update-assistant-masking.md` "## 고칠 두 곳 → 1." (§Rationale 트레이드오프 서술 예정 지점)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` R17 § "잔여 갭(의도)" (line 1501): `SECRET_LEAK_PATTERNS` 는 자격증명을 겨냥하므로 **자격증명 없는 연결 문자열·내부 호스트명·사설 IP·스택 프래그먼트는 통과**한다.
  - 상세: target 이 `explore-tools.service.ts` 에 `deepRedactSecrets` 를 그대로 재사용하므로, 이 문서가 이미 "의도된 잔여 갭"으로 기록한 한계(자격증명 없는 connection string 등은 여전히 통과)가 workflow-assistant LLM 도구 표면에도 그대로 이전된다. 새로 작성할 §4.1.1 Rationale 에 이 사실을 한 줄이라도 교차 참조해두지 않으면, 이후 "LLM 채팅창에 사설 IP/호스트명이 그대로 보인다"는 지적이 마치 새로운 결함처럼 재조사될 수 있다(이 저장소가 반복해서 겪은 실패 형태 — R17 자신이 "whack-a-mole" 우려에 이미 답한 사례가 있음).
  - 제안: 새 Rationale 문단에 "`deepRedactSecrets` 의 알려진 잔여 갭(§R17 참조)이 이 표면에도 동일하게 적용된다"는 한 문장을 추가.

- **[INFO]** §R17 "잔여③" 취소선 처리 형식을 문서 기존 관행과 맞추도록 명시
  - target 위치: `plan/in-progress/spec-update-assistant-masking.md` "## 고칠 두 곳 → 2."
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` R17, "~~잔여 ①~~ 해소(2026-08-16)" / "~~잔여 ②~~ 해소(2026-08-20) ..." (line 1546, 1549) — 이 문서 자체가 이미 확립한 "잔여 N 항목을 닫을 때는 `~~잔여 N~~ 해소(날짜)` 형태로 취소선 + 해소 사유를 남긴다"는 관행이 있다.
  - 상세: target 은 "취소선 + 결정으로 덮는다"라고만 서술해 구체적 포맷을 특정하지 않았다. 잔여①·②가 이미 확립한 포맷(`~~잔여 N~~ 해소(YYYY-MM-DD)`)과 다른 형태로 잔여③을 닫으면, 같은 R17 절 안에서 표기 관행이 갈린다.
  - 제안: 잔여①·②와 동일하게 `~~잔여 ③~~ 해소(2026-08-23)` 형태를 그대로 재사용하도록 실행 시 명시.

## 요약

target plan(`spec-update-assistant-masking.md`)은 EIA §R17 "잔여③"이 명시적으로 열어 둔 결정("어느 의미가 우선하는지는 별도 결정")을 사용자 결정으로 닫는 것으로, 과거 경고("값-패턴 마스킹을 단순 합성하면 안 된다")를 무근거로 뒤집는 것이 아니라 — 원문 경고를 지우지 않고 보존한 채(취소선), 왜 지금은 다른 선택을 하는지(유출 차단 우선, 실측 RED 이력 포함)를 새 Rationale 로 남기겠다고 명시적으로 계획하고 있다. `git log -S` / 코드(`3aaa4cd19`) / 테스트(`explore-tools.service.spec.ts`) / 자매 트래커(`spec-sync-external-interaction-api-gaps.md`, `17_12_34` W1) 교차 확인 결과 이 결정 이력은 실제이며 조작되지 않았다. 새 포맷 `"***"` 는 `@workflow/masked-markers` 의 `VALUE_MASK_MARKER` 와도 일치해 기존 시스템 invariant(공유 마스킹 마커 SoT)에 오히려 더 잘 정렬된다. 유일한 실질 리스크는 같은 spec 파일 안에 있는 **또 다른** Rationale 결정 기록(§4.1.1 도입 당시 "확정된 결정 사항" 표, "기존 유틸 재사용" 근거)이 target 의 명시적 갱신 대상 목록에서 빠져 있어, 실행 단계에서 누락되면 한 spec 파일 안에 서로 모순되는 두 Rationale 서술이 공존할 수 있다는 점이다.

## 위험도

LOW
