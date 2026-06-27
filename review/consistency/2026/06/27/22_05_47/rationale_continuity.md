# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
Diff base: `107b7617c`
Target: `spec/5-system/`

---

## 발견사항

### [INFO] `saveMemories` 옵션 객체 계약 가드가 spec Rationale 에 미기재

- **target 위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` 진입부에 `typeof args !== 'object' || args === null` 검사 추가 (I3 review W-1)
- **과거 결정 출처**: `spec/5-system/17-agent-memory.md § Rationale > 의미기반 dedup 임계 0.85 (AGM-09)` — "dedup 탐색 실패는 graceful 하게 INSERT 로 진행(저장 경로를 막지 않음)"
- **상세**: 새 가드는 dedup Rationale 의 "graceful fallback" 원칙이 적용되는 비즈니스 오류 경로(탐색 실패 → INSERT 진행)와 달리, 호출자가 잘못된 타입 인자를 넘기는 프로그래밍 계약 위반을 명시적으로 `throw` 해 조기 실패시킨다. 이는 "저장 경로를 막지 않음" 원칙과 카테고리가 다른 방어적 코딩 패턴이라 원칙 위반은 아니다. 그러나 spec Rationale 에 이 동작이 언급되지 않아, 향후 읽는 개발자가 "graceful 원칙과 왜 충돌하지 않는가"를 코드 주석(`// 옵션 객체 계약 가드`)에서만 파악해야 한다.
- **제안**: `spec/5-system/17-agent-memory.md §3` 또는 `§ Rationale > 전용 큐 + scope 단위 직렬화` 인근에 "프로그래밍 계약 위반(포지셔널 인자 혼용)은 graceful fallback 대상이 아니며 즉시 throw 한다" 한 줄을 추가해 dedup graceful 원칙과의 범위 경계를 명시한다.

---

### [INFO] 이전 리뷰(21_39_37)의 WARNING 미해소 — `information-extractor.md` watermark 키 이름 미동기 (잔존)

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` l.163, l.684 — 각각 `증분 watermark(\`lastExtractionTurnSeq\`)` 표기 유지
- **과거 결정 출처**: `spec/5-system/17-agent-memory.md § Rationale > 증분 추출 watermark (AGM-08)` — I12 확정으로 canonical 키를 `_resumeState.memoryState.lastExtractionTurnSeq` 로 갱신 (하위호환 폴백 병기)
- **상세**: 이전 리뷰(diff-base `8c5fdf2`, 21_39_37)에서 WARNING 으로 지적된 사항이 현 diff(`107b7617c` → HEAD)에서도 미해소된 채 잔존한다. `plan/in-progress/ai-context-memory-followup-v2.md` 하단에 `- [ ] 3-information-extractor.md l.163·l.684: watermark 참조 lastExtractionTurnSeq → memoryState.lastExtractionTurnSeq` 로 추적 중이다. 이번 diff 범위(코드 파일만 변경)에서 spec 파일 갱신이 없어 그대로 열려있다. 런타임 영향은 `readExtractionWatermark` 의 하위호환 폴백이 커버하고, 새 추가 테스트(`agent-memory-injection.spec.ts` — primitive memoryState fallback 검증)가 그 폴백을 명시적으로 보호한다.
- **제안**: plan 의 체크박스를 이행해 `3-information-extractor.md` l.163/l.684 를 `memoryState.lastExtractionTurnSeq` (canonical) + `구 평면 키 폴백` 병기로 갱신한다.

---

## 요약

이번 diff(`107b7617c` → HEAD)에서 spec 파일은 변경되지 않았으며, 코드 변경은 두 가지다: (1) `saveMemories`에 포지셔널 인자 오용을 감지하는 런타임 계약 가드 추가, (2) `readExtractionWatermark` 의 `memoryState` 원시값 오염 방어 테스트 추가. (1) 은 `spec/5-system/17-agent-memory.md` Rationale 이 명시한 dedup graceful 원칙의 "비즈니스 오류" 범위 밖의 프로그래밍 계약 위반 가드라 원칙 충돌 없이 defense-in-depth 역할을 한다. (2) 는 AGM-08 하위호환 폴백 Rationale 을 직접 검증하는 테스트라 Rationale 에 부합한다. 명시적으로 기각된 대안의 재도입, 합의된 invariant 위반, 근거 없는 결정 번복은 없다. 이전 리뷰의 WARNING(information-extractor 키 이름 미동기)은 plan 에 추적 중이며 미해소 잔존 — 추가 INFO 로 기재한다.

## 위험도

NONE
