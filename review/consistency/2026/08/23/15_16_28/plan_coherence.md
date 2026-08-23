# 발견사항

- **[WARNING]** `spec/` 직접 편집으로 생성된 권한-경계 결정이 여전히 미해결인 채 코드가 이미 랜딩했다
  - target 위치: `spec/5-system/` 자체는 이번 diff 에서 무변경이지만, 이번 PR 이 유일하게 건드린 spec 파일은 target 번들 밖의 `spec/conventions/egress-masking.md §3`(직접 열어 diff 확인 — "예고는 틀렸다" 정정 10줄 추가)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 321행 `- [ ] **developer 의 자기-예측 반증형 spec 소정정 — 권한 경계를 정한다**` (2026-08-23 등재, `14_23_44` scope W2) ↔ 같은 파일 333행에서 방금 `[x]` 로 종결된 *"`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합"*
  - 상세: CLAUDE.md 는 `developer` 를 `spec/` **read-only** 로 명시하고 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 을 규정한다. 이번 PR 에서 developer 턴이 `--impl-prep` 게이트만 거친 채 `egress-masking.md §3` 을 직접 고쳤다(자신이 앞서 남긴 예고 문장이 실측으로 반증돼 방치하면 규약 문서에 "지금은 거짓인 지시문" 이 남기 때문). 내용은 재검증 결과 정확하고(§1 좌표계 표 소비처 심볼이 실제로 무변경임을 `redact-stored-error.ts`/`executions.service.ts` diff 로 직접 확인) 5개 consistency checker + 9개 code reviewer 가 전원 타당 판정했지만, **되돌리지 않고 그대로 랜딩**했다. 대신 "이 편집을 예외로 명문화할지, 앞으로도 planner 턴을 강제할지" 를 판단할 권한-경계 결정 항목을 트래커에 새로 등재해 열어 뒀다. 즉 **결정이 내려지기 전에 그 결정이 다루는 행위(spec 직접 편집)가 이미 실행·커밋된 상태**다 — 내용의 정확성과는 별개로, 절차상 "먼저 하고 나중에 경계를 묻는" 순서가 이번 PR 로 확정 전례가 됐다. 향후 PR 이 같은 패턴("내가 예고한 걸 내가 반증하니 괜찮다")을 근거로 삼을 위험이 남는다.
  - 제안: 이 PR 을 되돌릴 필요는 없다(내용 정확성은 이미 다중 검증됨). 다만 planner 턴에서 이 321행 항목을 **가급적 빨리** 처리해 (a) 이런 자기-반증형 소정정을 예외로 문서화(예: CLAUDE.md 권한표에 "본인이 등재한 예고 문장의 실측 반증 정정"만 narrow exception 으로 명시)하거나 (b) 향후엔 이런 정정도 반드시 `--spec` 게이트(=planner 턴)를 거치도록 강제해 이번 건이 유일한 예외였음을 명문화할 것을 권한다. 결정이 늦어질수록 "선례" 로 인용되는 범위가 넓어진다.

## 확인했으나 문제 없음 (참고)

- target 4개 완전 번들 spec(`2-api-convention.md`·`3-error-handling.md`·`12-webhook.md`·`13-replay-rerun.md`)에는 "결정 필요"·"미결"·"TBD" 류의 열린 결정 마커가 없음을 grep 으로 확인 — target 자체가 미해결 결정을 우회한 사례는 없다.
- 절단된(컨텍스트 예산 초과) `spec/5-system/14-external-interaction-api.md` 를 직접 열어 §R17 인접 서술(1480~1580행)을 확인한 결과, "표면 여섯 · 컬럼 둘" 서술과 `toResponseExecution`/`toExecutionDto`/`redactStoredDataForResponse`/`redactStoredErrorForResponse` 심볼 인용이 이번 리팩터 이후에도 여전히 정확하다(두 함수는 이름·시그니처 무변경, 새 헬퍼가 내부에서 그대로 호출). 코드 diff 와 대조해 drift 없음을 확인.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 체크박스 카운트(열림 26개)가 PR 자체가 주장하는 "종결 1건 + 신규 등재 1건 = 순증감 0, 단 26→25→26 경유" 서술과 실측이 일치.
- `plan/in-progress/**` 전역에서 통합 대상 심볼(`redactStoredFieldsForResponse`·`redactNodeExecutionRow`·`maskIfPresent`·`toResponseExecution`·`toExecutionDto`)을 인용하는 다른 진행 중 plan 은 없음 — 이번 리팩터가 다른 plan 의 후속 항목을 무효화하거나 새로 요구하는 사례는 발견되지 않았다.
- 직전 impl-prep 라운드(`13_55_36`)의 plan_coherence WARNING("§1 표 무변경 근거가 트래커에 안 남는다")은 이번 diff 에서 `spec-sync-external-interaction-api-gaps.md` 333행 블록쿼트에 실측 근거가 그대로 기록돼 해소 확인됨.

# 요약

이번 PR(`masking-gate-consolidation`)은 스스로 정본 트래커 항목을 정확히 집행하고, 자신이 남긴 예고(§1 표 stale화)를 실측으로 반증해 문서를 정정하는 등 plan 위생 관리가 매우 꼼꼼하다. target 인 `spec/5-system/` 자체는 이번 diff 에서 변경되지 않았고, 완전 번들된 4개 spec 파일에는 미해결 결정과 충돌하는 서술이 없다. 다만 이 PR 이 유일하게 건드린 spec 파일(`spec/conventions/egress-masking.md`)은 CLAUDE.md 가 명시한 "구현 중 spec 변경은 planner 위임" 규칙을 developer 턴이 `--impl-prep` 게이트만으로 우회한 사례이며, PR 은 그 경계 판단 자체를 트래커에 새 미해결 항목으로 등재해 열어 뒀다 — 즉 "결정되기 전에 결정 대상 행위가 먼저 실행된" 순서다. 내용 정확성은 다중 리뷰로 검증됐으므로 되돌릴 사안은 아니지만, 이 미해결 항목이 방치되면 향후 유사 사례의 암묵적 선례가 될 위험이 있어 WARNING 으로 기록한다.

# 위험도
LOW
