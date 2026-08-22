# 문서화(Documentation) 리뷰 결과

### 발견사항

- **[WARNING]** `plan/in-progress/masked-marker-test-gaps.md` 의 트래커 줄 번호 인용 2건이 **같은 PR 이 그 파일을 편집한 후 시점 기준으로 틀렸다** — 병합된 최종 파일을 열어 인용된 줄을 보면 엉뚱한 내용이 나온다.
  - 위치: `plan/in-progress/masked-marker-test-gaps.md:73` (`- [x] ① phase 경계 회귀 테스트 추가 → **트래커 L868 항목 종결**`)
  - 상세: 인용된 `트래커 L868` 은 base 커밋(`923b5892e`, 이 PR 착수 전)의 `spec-sync-external-interaction-api-gaps.md` 에서는 실제로 `throwIfAny` phase 경계 항목이었다(`git show 923b5892e:... | grep`로 확인). 그러나 이 PR 자신이 그 파일도 함께 편집해 항목들이 밀렸고, **병합된 최종 파일에서 L868 은 무관한 다른 항목**(`PR #1194 머지 시 흡수` 노트, "마커 리터럴을 산문으로 재기술한 지점" 항목의 일부)을 가리킨다. 실제 `throwIfAny` 항목은 최종 파일 `spec-sync-external-interaction-api-gaps.md:888` 에 있다(`grep -n "throwIfAny.*phase 경계 트레이드오프" spec-sync-external-interaction-api-gaps.md` → `888:`).
  - 제안: `L868` → `L888` 로 갱신하거나, PR 자체 편집으로 줄 번호가 밀리는 구조적 문제를 피하려면 줄 번호 대신 체크리스트 항목의 앵커 문구(`` `throwIfAny` 의 phase 경계 트레이드오프 미검증 ``)로 인용을 바꾼다.

- **[WARNING]** 같은 파일의 두 번째 줄 번호 인용도 동일한 원인으로 틀렸다.
  - 위치: `plan/in-progress/masked-marker-test-gaps.md:75` (`- [x] ② 유예 근거 교체 (트래커 L826-827) · ③ 실측값 141줄 갱신 · ...`)
  - 상세: `트래커 L826-827` 은 base 커밋 시점엔 "세 번째 소비처가 생기면 그때" 근방이었으나(`git show 923b5892e:...`에서 L827), 이 PR 이 바로 위 항목(`ExecutionsService.reRun` 137→141줄 실측 갱신)에 3줄을 추가로 삽입하면서 밀렸다. **병합된 최종 파일에서 `L826-827` 은 실제로 ③(`ExecutionsService.reRun` 실측 갱신) 노트의 일부**(`spec-sync-external-interaction-api-gaps.md:826-828`)이고, ② "유예 근거 교체" 본문은 `L831-832` 에 있다(`grep -n` 으로 확인: `830: ~~세 번째 소비처가 생기면 그때.~~` / `831: > **유예는 유지하되 근거를 교체한다...**`). 즉 이 한 줄 안에서 ②와 ③에 붙은 줄 번호가 사실상 뒤바뀐 것처럼 읽힌다.
  - 제안: `L826-827` → `L831-832` 로 정정한다. 이 PR 이 같은 파일을 여러 항목에 걸쳐 동시 편집하므로, 편집 후 시점 기준으로 `grep -n`/`sed -n` 재확인 없이 base 파일 기준 줄 번호를 그대로 옮기면 이런 어긋남이 재발한다 — 커밋 직전 최종 파일을 대상으로 재검증하는 것을 권장.

- **[INFO]** 새로 추가된 테스트의 JSDoc 블록(`reject-masked-resubmission.spec.ts:313-326`)은 품질이 좋다 — 트레이드오프의 방향, "RED 면 버그가 아니라 결정 신호" 라는 의도, `{@link resolveTriggerParametersRejectingMasked}` 및 `throwIfAny` docstring 참조가 실제 소스(`reject-masked-resubmission.ts:77-90` `throwIfAny` JSDoc)와 정확히 일치함을 직접 대조 확인했다. 대조군/실험군 인라인 주석(`reject-masked-resubmission.spec.ts:335`, `340`)도 vacuous 테스트 방지 의도를 명확히 설명한다. 별도 조치 불요, 참고로 기록.

- **[INFO]** 이번 PR 은 `spec_impact: none` 순수 테스트+plan 문서 변경이며 신규 API·환경변수·설정·공개 함수 시그니처 변경이 없다. README/API 문서/CHANGELOG 업데이트는 불필요하다는 판단이 맞다(실제로 `CHANGELOG.md` 에는 선행 PR 의 마커 거부 기능 항목만 있고 이번 PR 은 그 기능의 회귀 테스트 추가일 뿐).

- **[INFO]** `review/consistency/2026/08/22/20_57_25/**` 6개 파일(SUMMARY.md·_retry_state.json·convention_compliance.md·cross_spec.md·meta.json·naming_collision.md·plan_coherence.md·rationale_continuity.md)은 orchestrator 가 생성한 감사 산출물로, 프로젝트 컨벤션상 `review/consistency/**` 에 그대로 커밋되는 것이 정상이다. 저자가 직접 작성한 문서가 아니므로 독스트링/README 관점의 리뷰 대상에서 제외했다.

### 요약

이번 PR 은 순수 테스트 추가 + plan 문서 정리로, 신규 JSDoc(`reject-masked-resubmission.spec.ts` 의 새 캐너리 테스트 블록)는 소스의 실제 트레이드오프 설명과 정확히 일치하고 `{@link}` 참조도 유효해 품질이 높다. 다만 `plan/in-progress/masked-marker-test-gaps.md` 의 트래커 줄 번호 인용 2건(`L868`, `L826-827`)이 **같은 PR 자신의 편집으로 줄이 밀린 뒤 시점** 기준으로는 틀려, 병합된 최종 파일을 열어 확인하면 엉뚱한 항목을 가리킨다 — 이 조직이 반복적으로 겪어 온 "줄 인용 stale화" 패턴의 재발이다. README·API 문서·CHANGELOG·설정 문서 관점에서는 이번 diff 범위에 해당 사항이 없어 추가 조치가 필요 없다.

### 위험도
LOW
