STATUS=success plan_coherence review complete — 0 CRITICAL, 2 WARNING

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` 체크리스트의 "성능 실측" 항목이 실제로는
  완료됐는데 여전히 미체크 상태다 — 같은 세션에서 두 번째로 재발한 "체크박스 = 실제 상태"
  위반
  - target 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:370-384`
    (`stripDeep` JSDoc "## 비용 (실측)" 섹션, 커밋 `5df89cda6`)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:150-151`
    ("### 처분 (실제 상태)" 체크리스트 마지막 항목)
  - 상세: plan 은 "- [ ] 성능 실측 — 재귀 순회 비용을 옛 shallow 와 A/B. 리뷰 종료 후 수행"
    이라고 여전히 미해결로 적어 두고 있다. 그런데 후속 커밋 `5df89cda6`
    (`fix(security): strip 구현이 __proto__ 를 오염시켰다 + 지연 할당·깊이 상한`)의
    W2 항목("유예하되 실측했다")이 실제로 이 A/B 측정을 수행했다 — 8턴 payload, N=3000,
    옛 depth-1 0.0112ms → 재귀 0.0314ms/emit(2.80배, +20.2µs)이고, 수치가 코드 JSDoc 에
    그대로 남아 있다(`websocket.service.ts:374-379`). 즉 target(코드)은 이미 진행됐는데
    plan 문서만 뒤처졌다. 같은 plan 파일에서 정확히 같은 패턴(결정이 내려졌는데 체크리스트가
    미정 상태로 남음)이 직전 라운드(`10_32_29` plan_coherence WARNING)에서 지적되어
    커밋 `a9574f823` 로 이미 한 번 수정됐다 — 그 직후 커밋(`5df89cda6`)에서 같은 종류의
    drift 가 다시 생겼다. 이 plan 을 나중에 읽는 사람은 "성능은 아직 측정 안 됨" 으로
    오인해 불필요한 재측정을 시도하거나, 이미 문서화된 트레이드오프 결정(두 pass 를
    합치지 않기로 한 근거)을 다시 검토할 위험이 있다.
  - 제안: `spec-draft-eia-62-waiting-payload.md:150` 을 `[x]` 로 바꾸고, 실측 수치
    (2.80배, +20.2µs)와 근거 커밋(`5df89cda6`)을 한 줄 추가할 것.

- **[WARNING]** 보안 수정이 명시한 "이미 전송된 데이터에 대한 운영 판단 필요"가 CHANGELOG
  에만 남고 어떤 plan 에도 추적 항목으로 등재되지 않았다
  - target 위치: `CHANGELOG.md` "Unreleased — (보안) 외부 fanout 의 `llmCalls` strip 이
    depth-1 이라 raw 프롬프트가 새고 있었다" 섹션의 "> 영향 범위: 이 경로로 나간 데이터는
    **이미 전송된 것**이다 … 운영 판단이 필요하다" 문단 (커밋 `5df89cda6`)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` "### 처분 (실제 상태)"
    체크리스트 — 이 운영 판단 항목이 목록에 없음
  - 상세: 이번 보안 패치는 과거 emit(`execution.waiting_for_input`)이 `stripExternalOnlyFields`
    의 depth-1 한계로 인해 이미 외부(SSE/webhook/chat-channel)로 raw LLM 프롬프트·대화
    이력을 흘려보냈다는 사실을 확정했고, CHANGELOG 는 "해당 워크스페이스의 프롬프트/대화
    이력 민감도에 따라 운영 판단이 필요하다" 고 명시한다. 그러나 이 판단을 누가·언제·
    어떻게 내릴지를 추적하는 plan 항목이 없다 — `spec-draft-eia-62-waiting-payload.md` 의
    "처분 (실제 상태)" 체크리스트는 이름 충돌·성능 실측·spec addendum 세 잔여만 담고 이
    항목은 빠져 있다. 이 저장소엔 동일 패턴의 선례가 있다
    (`review/code/2026/07/09/11_08_21/RESOLUTION.md` W6 — "실 데이터의 잔존 malformed
    config.parameters 정리 마이그레이션 (배포 전 조회 → 운영 판단)" 을 명시적 체크리스트
    항목으로 등재) — 그때는 "운영 판단 필요" 를 CHANGELOG/코드 주석에만 남기지 않고 plan
    에 추적 가능한 항목으로 만들었다. 지금은 그 절차가 누락돼, CHANGELOG 를 읽지 않는 한
    이 결정 대기 항목의 존재 자체가 plan 문서군에서 보이지 않는다.
  - 제안: `spec-draft-eia-62-waiting-payload.md` (또는 신규 plan) 에 "이미 유출된
    turnDebug/llmCalls 데이터에 대한 사후 대응(통합자 통지·로그 삭제 요청 등) — 운영 판단
    필요" 항목을 명시적으로 추가해 추적할 것.

### 요약

target 코드(`websocket.service.ts` 의 depth-agnostic strip 패치, 커밋 `81f2c60d6`/`5df89cda6`)
자체는 plan 이 "결정 필요" 로 남겨 둔 항목(이름 충돌)을 우회하지 않았고, spec/5-system 에
직접 손대지도 않아 CRITICAL 급 충돌은 없다. 직전 라운드(`10_32_29`)가 지적한 3건의
체크박스-실제상태 불일치는 커밋 `a9574f823` 로 정확히 해소됐다. 다만 그 직후 커밋
(`5df89cda6`)이 새로 완료한 성능 실측이 다시 plan 체크리스트에 반영되지 않아 같은 drift
패턴이 재발했고, 이 커밋이 스스로 밝힌 "이미 전송된 데이터의 운영 판단 필요" 라는 새 결정
대기 항목은 이 저장소의 선례(W6 패턴)와 달리 plan 에 전혀 등재되지 않았다. 둘 다 "다음
세션이 이미 끝난 일을 다시 조사하거나, 있는 줄도 모르는 운영 판단을 놓치는" 위험으로
이어지는 문서 동기화 갭이다.

### 위험도

MEDIUM
