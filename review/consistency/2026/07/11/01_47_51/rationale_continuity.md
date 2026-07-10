# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-waiting-surface-guard.md` (변경 1c `## Rationale` 신규 항목 — "대기 표면 ↔ 명령 매트릭스 publisher 사전 검증")

## 검증 대상 특정 질의에 대한 결론 (선요약)

1. **PR #637 fail-closed 선례 실재 여부 — 실재함, 방향도 정확.**
   `git log --all --oneline | grep 637` → `1a6bbe739 fix(execution-engine): assertSameWorkspace fail-open→fail-closed (W-6 워크스페이스 격리 강화) (#637)`.
   spec 상 근거는 `spec/5-system/4-execution-engine.md` L1593 (`## Rationale` "C-1 god-class strangler-fig 분할" 항의 "sub-workflow workspace 격리 fail-closed" bullet)과 `spec/4-nodes/2-flow/1-workflow.md:77`. 두 곳 모두 "sub-workflow 진입점의 `assertSameWorkspace` 를 fail-open(누락 시 로그 후 통과)→fail-closed 로 전환, 착수 전 프로덕션 3 호출처 전수 trace 로 안전 확정" 이라는 동일 서술이며, draft 의 "publish 전 동기 거부가 waiting_for_input 을 보존해 복구 가능성이 높다" 논지와 방향이 일치한다.
   draft 의 부가 주장 "프로젝트의 fail-open 선례는 인프라 가용성 한정" 도 `spec/` 전역 `fail-open` grep 결과와 부합한다 — 현재 spec 에 남아있는 fail-open 패턴은 전부 Redis/DB 미가용·rate-limit backstop 류(`spec/5-system/12-webhook.md` 공개 webhook throttle, `spec/5-system/14-external-interaction-api.md` blacklist/idempotency, `spec/7-channel-web-chat/4-security.md` §R3, `spec/data-flow/15-external-interaction.md` 등)이고, PR #637 은 오히려 "인프라 가용성이 아닌 케이스의 fail-open 은 안전이 입증되면 fail-closed 로 전환한다"는 선례다. 인용은 지어낸 것이 아니라 실제 이력에 근거하며, 인용 방향도 정확하다.

2. **§10.9 button_click invariant 인용 — 절 자체는 실재하나, draft 의 "정상 수신" 서술이 과장돼 있음 (WARNING, 아래 발견사항 1).**

## 발견사항

- **[WARNING] §10.9 button_click invariant를 "정상 수신"으로 과대 인용 — fail-closed 우선 원칙과 내부 긴장**
  - target 위치: `plan/in-progress/spec-draft-waiting-surface-guard.md` 변경 1c, "왜 `form`/`buttons` 는 엄격, `ai_conversation`/`ai_form_render` 는 4종 모두 허용인가" 단락 — "AI 표면은 이미 이종 명령을 정상 수신하도록 설계됐다 … + stale `button_click` 의 graceful re-park invariant([Presentation §10.9])" 부분.
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md` §10.9 "`'button_click'` AI conversation 내 미도달 invariant" (L412). 원문: "`processAiResumeTurn` 는 위 표의 4 케이스 중 실제로는 `ai_end_conversation`/`ai_message`/`form_submitted` 3 케이스만 수신하도록 설계됐다 … 현재 UI 는 AI conversation 대기 중 … 버튼을 표시·라우팅하지 않으므로 본 경로로 `'button_click'` action 이 **도달하지 않는 자연 invariant**가 성립한다 … 만약 향후 UI 변경으로 도달하게 되면 `else` 분기 (**warn log + no-op park**) 가 graceful degradation 으로 동작한다."
  - 상세: §10.9는 `button_click`이 AI 표면에서 "정상 수신·처리"되는 계약을 정의한 것이 아니라 정반대로 (a) 현재는 그 경로에 **도달하지 않는다**는 사실과 (b) 혹시 도달해도 매칭 없이 **경고 로그 + no-op 재파킹으로 조용히 버려진다**(클릭 내용은 소비되지 않고 아무 처리도 일어나지 않음)는 방어적 fallback을 문서화한다. draft 는 이를 실제로 정상 처리되는 `form_submitted`(AI Agent §6.2 step 2.c, 3케이스 중 하나 — 이 인용은 정확)와 같은 층위로 묶어 "AI 표면은 이미 이종 명령을 정상 수신하도록 설계됐다"고 서술하고, 이를 근거로 "여기서 좁히면 두 계약이 깨진다"고 결론짓는다.
    이 결론은 인용된 근거와 어긋난다 — ai_conversation/ai_form_render 표면에서 `button_click` 을 publisher 단계(§7.5.1)에서 선차단해도 §10.9 가 실제로 보장하는 실질(실행이 죽지 않고 데이터 손상 없이 유지됨)은 깨지지 않는다. 오히려 §10.9 자체가 "만약 도달하면"이라는 가정형 방어 코드이며, 같은 신규 Rationale 항목이 다른 bullet("왜 fail-closed")에서 명시한 원칙 — "publish 전 동기 거부가 `waiting_for_input` 을 보존해 복구 가능성이 높다", PR #637 fail-closed 선례 — 을 button_click 케이스에도 동일하게 적용하면 오히려 **강화**되는 방향이다. 즉 같은 Rationale 항목 내에서 "표면 판정 불가 행"에는 fail-closed 원칙을 적용하면서, `button_click`(ai 표면)에는 반대로 "기존 no-op fallback 보존"을 이유로 fail-open 상당의 방임을 택해, 원칙 적용이 비대칭적이다. 이는 지어낸 기각 대안은 아니지만(§10.9 인용 자체는 실재), 근거 텍스트가 뒷받침하지 않는 결론("정상 수신" · "계약이 깨진다")을 이끌어낸 과대 해석에 해당한다.
  - 제안: (a) "정상 수신하도록 설계됐다" 문구를 정정 — "3종(`ai_end_conversation`/`ai_message`/`form_submitted`)은 명시 매칭·처리되고, `button_click`은 (현재는 도달하지 않는 자연 invariant이며) 도달 시 경고 로그 후 조용히 폐기되는 graceful no-op으로 보호된다"로 사실관계를 분리 서술. (b) 그럼에도 `button_click`을 ai 표면에서 publisher 레벨 선차단하지 않는 이유를 별도로 명시 — 예: "표면 판정은 이미 캐시된 `meta.interactionType`을 신뢰하는 단일 게이트로 충분하고, `processAiResumeTurn`의 기존 방어 코드가 안전망으로 병존해도 무해하다(이중 방어, 성능/복잡도상 새 코드 추가 불요)" 같은 **자체 근거**를 세워야, "계약이 깨진다"는 인용 오류에 기대지 않고도 permissive 설계를 정당화할 수 있다.

- **[INFO] "자매 게이트 `dispatchResumeTurn` 도 fail-closed(`RESUME_CHECKPOINT_MISSING`)" 표현의 소재 정밀화 제안**
  - target 위치: 변경 1c, "왜 fail-closed" 단락 첫 문장.
  - 상세: `RESUME_CHECKPOINT_MISSING` 은 `spec/5-system/4-execution-engine.md` §7.5 rehydration 단계에서 `NodeExecution.outputData` 부재/손상 시 발생하는 코드이며 (§7.5, §3-error-handling.md L135 등에서 확인), 엄밀히는 `dispatchResumeTurn`(표면별 turn 핸들러 라우팅) 자체가 아니라 그 **앞 단계인 rehydration**의 실패 코드다. "자매 게이트"라는 비유 자체는 크게 틀리지 않지만(같은 재개 파이프라인 안에서 fail-closed로 종결한다는 점은 사실), `dispatchResumeTurn`의 결정이라고 읽힐 수 있는 문구는 소재를 한 단계 앞으로 옮겨("rehydration 단계도 …") 정정하면 더 정확하다. rationale 연속성 위반은 아니며 정밀도 제안 수준.

## 요약

target 의 신규 Rationale 항목은 대체로 실제 이력에 근거한다 — 특히 지시된 두 핵심 인용 중 **PR #637 fail-closed 선례는 git 이력·spec 양쪽에서 실재가 확인**되며 인용 방향(비-인프라 가용성 케이스의 fail-open 을 안전이 입증되면 fail-closed 로 전환하는 선례)도 정확하다. `EIA-IN-13`, EIA §5.1 `STATE_MISMATCH` 기존 표, REST `/continue` 의 form-only 본문 계약(`data-flow/3-execution.md:174`), `interaction-type-registry.md §1.1` 의 내부 4값↔외부 3값 매핑 등 다른 인용들도 모두 실측 확인되어 "지어낸 기각 대안"은 발견되지 않았다. 다만 **§10.9 button_click invariant 인용은 실재하는 절이지만 그 내용을 "정상 수신"으로 과장 해석**했고, 이 과장이 "좁히면 두 계약이 깨진다"는 결론을 뒷받침하는 데 쓰이면서 같은 Rationale 항목 안의 fail-closed 우선 원칙(§7.5.1 전체 기조, PR #637 선례)과 비대칭을 이룬다 — WARNING 으로 정정을 권고한다. 이 정정은 draft 의 기술적 결정(퍼미시브 4종 허용) 자체를 뒤집을 필요 없이, 근거 문구만 사실에 맞게 재서술하거나 별도의 자체 근거를 보강하면 해소된다.

## 위험도

LOW — CRITICAL 급 위반(기각된 대안 재도입, invariant 직접 위반) 없음. WARNING 1건은 병합 전 문구 정정을 권고하되 차단 필요는 없음.
