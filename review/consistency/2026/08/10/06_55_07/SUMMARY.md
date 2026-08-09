# Consistency Check 통합 보고서 (--plan)

- 대상: `plan/in-progress/spec-data-flow-structural-followups.md` (+ 부수로
  `spec-fix-swagger-forbidden-response.md` 이동 판정) · diff-base `origin/main`
- checker 3종 실행(naming_collision · cross_spec · plan_coherence). 이번 변경이 `spec/` 표기와
  plan 위생에 한정돼 rationale/convention 은 돌리지 않았다.

## BLOCK: NO

Critical 0건. WARNING 은 전부 아래 §조치대로 이 턴에서 해소했다.

## 전체 위험도

**LOW** — 3종 모두 LOW.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | naming_collision | 내가 "순수 서술" 로 분류한 3건이 실제로는 **코드가 지금도 내보내는 문자열**이다 — `candidate-lookup.service.ts:139` fallback 라벨 · `review-workflow.ts:365` 가드 detail · `system-prompt.ts:300,434`. 바꾸면 spec 서술과 라이브 문자열이 새로 갈린다 | **보류로 전환.** 셋 다 그대로 두고 **왜 안 바꿨는지를 그 자리에 각주**로 남겼다 |
| 2 | cross_spec | `4-ai-assistant.md` 인용 프롬프트 예시가 보호 목록에서 누락돼 있다 | plan §4 보호 목록에 **명시 추가**. 이미 제외 판정이었으나 근거가 문서에 없었다 |
| 3 | cross_spec | 보호/허용 이분류가 "코드 식별자 인접" 뿐이라 `ED-AI-06~08`(보호)과 `ED-AI-39`(허용)가 같은 섹션에서 갈린다 | **실측으로 갈랐다** — 그 셀렉터의 실 UI 라벨은 `assistant.modelLabel` = "모델"/"Model" 이라 어느 표기와도 리터럴이 안 겹친다. `ED-AI-06~08` 설명문은 **교체**, `ED-AI-39` 의 필드 목록은 `review-workflow.ts` detail 과 맞춘 것이라 **보류** |
| 4 | plan_coherence | plan 의 "17건 / 4파일" 이 자기 문장과 모순 — 17은 5파일 총계, 4파일 귀속은 15 | 세 갈래(교체 11 · 보류 3 · 제외 1)로 분리해 재작성 |
| 5 | plan_coherence | `complete/` 이동 시 **spec 인입 링크 갱신 항목이 없다** — `12-workspace.md:442` 가 이 plan 을 링크 | 이동과 **동시에** 갱신 |
| 6 | plan_coherence | `spec_impact` 가 §4 가 실제로 건드린 4파일과 **전혀 겹치지 않는다** (§1~§3 것만) | 4파일 추가 |
| 7 | plan_coherence | swagger plan 의 후속 "~61개 라우트" 가 이미 `spec-sync-stop-editor-and-forbidden-routes` §2 로 **승격돼 있는데** 그 사실이 문서에 없다 | 포인터 추가 |

## 참고 (INFO)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | naming | 714 헤딩 교체는 인입 앵커 0건으로 안전 — 독립 재검증 일치 | 교체 |
| 2 | naming | `Model Config` 는 이미 저장소 전역 정본(`1-auth.md`·`2-navigation/6-config.md` 등) — 새 의미 충돌 없음 | — |
| 3 | cross_spec | `4-nodes/3-ai` §3.1 `LLM 프로바이더 관리` 헤딩·`LLM-01~07` 은 **세 번째 표기 계열**로 범위 밖 | plan 에 스코프 경계 명시 |
| 4 | cross_spec | `create-assistant-session.dto.ts` 등의 `@ApiProperty` 설명은 라이브 Swagger 라 spec-only 변경으로 안 정리됨 | 별도 backend 후속 후보로 기록 |
| 5 | plan_coherence | swagger plan 의 "resolution-applier 재호출" 후속은 원 PR 병합으로 **moot** | 취소선 + 근거 |
| 6 | plan_coherence | `plan_guard._all_checkboxes_done()` 도 코드펜스를 구분하지 않는다 | 기록(이 문서는 `[x]` 0건이라 그 훅은 발화 안 함) |

## checker 별 위험도 요약

| checker | 위험도 | 핵심 |
|---------|--------|------|
| naming_collision | LOW | 15건 위치 전수 정확 확인. **내 "순수 서술" 분류 3건을 코드 실측으로 반박** |
| cross_spec | LOW | 다른 spec 영역이 `LLM Config` 를 정본으로 쓰지 않음 확인. **실 UI 라벨 실측으로 `ED-AI-06~08` 판정을 뒤집음** |
| plan_coherence | LOW | 두 plan 의 `complete/` 이동 판정 모두 **맞음** 확인 + 이동 시 위생 3건 지적 |

## 이 라운드의 성격

**두 checker 가 같은 항목에 반대 결론을 냈고, 대상이 달라서였다.**

- naming 은 `system-prompt.ts`(LLM 에 가는 문자열)를 근거로 **보류**를 권고
- cross_spec 은 실 UI 라벨(`"모델"`)을 근거로 **통일**이 안전하다고 판정

둘 다 옳았다 — 항목마다 대응하는 문자열이 다르기 때문이다. 그래서 판정을 **건별로** 갈랐고,
보류한 셋이 실제 코드 리터럴과 1:1 대응함을 직접 확인했다.

그리고 plan_coherence 가 **앞선 세션의 실측 오류**를 확정했다 — `spec-fix-swagger-forbidden-response`
가 "미완 2건" 으로 남아 있던 이유가 코드펜스 안 예시를 센 것이었다. 펜스를 구분해 재측정하니
펜스 밖 **0건**이다.
