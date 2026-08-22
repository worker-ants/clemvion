# 보안(Security) 코드 리뷰

## 리뷰 대상 요약

이번 changeset 은 **프로덕션 코드 수정이 없다**. 구성:

1. `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` — 마스킹 마커 재제출 거부 로직의 알려진 phase 경계 트레이드오프(①raw 통과 후 무관 필드의 `coerce_failed` 가 ②JSON-문자열-내부 마커 검사를 선점)를 고정하는 신규 캐너리 테스트 1건.
2. `plan/in-progress/masked-marker-test-gaps.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(갱신) — 작업 트래커 문서.
3. `review/code/2026/08/22/21_15_53/*`, `review/consistency/2026/08/22/20_57_25/*` — 선행 리뷰/consistency-check 산출물(자동 생성, 저장소 관례상 커밋 대상) + 이를 반영한 `RESOLUTION.md`.

즉 **런타임 동작을 바꾸지 않는 test-only + 문서/리뷰산출물 변경**이다.

## 발견사항

- **[INFO]** 신규 캐너리 테스트가 고정하는 트레이드오프는 보안 우회가 아니라 UX 지연
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` — `it('[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다', ...)` 블록 (신규 diff 헝크 `@@ -310,6 +310,49 @@` 내부)
  - 상세: ①(raw scalar 위치 마커 검사)가 통과한 뒤, 마커와 **무관한 필드**(`count`)의 `coerce_failed` 가 resolve 를 선점하면 ②(JSON 문자열 내부 마커 검사)가 그 요청에서 실행되지 않는다. docstring·plan 문서·spec(`1-manual-trigger.md` §6 Rationale)이 일관되게 이를 의도된 설계로 명시한다 — ①이 여전히 최소 스칼라 마커를 잡고, 사용자는 타입 오류를 고쳐 재제출할 때 결국 마커 안내를 받으므로 **영구적 우회가 아니다**. 테스트에 대조군(`count:1` → `['payload']` 잡힘)이 포함돼 있어 "애초에 ②도 못 잡는 값"으로 통과하는 vacuous 케이스가 아님을 직접 확인했다. 이 PR 은 **테스트만 추가**했으므로 새 취약점을 도입하지 않는다.
  - 제안: 조치 불요(정보성). 향후 두 phase 를 합치는 리팩터를 시도할 경우, `coerce_failed` 로 요청 전체가 reject 되어 마스킹된 원문이 DB/로그에 영속화되지 않는지 함께 검증 권장.

- **[INFO]** 테스트 fixture 의 `apiKey` 리터럴은 실제 시크릿이 아님
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` 신규 블록 내 `` const jsonWithMarker = `{"apiKey":"${VALUE_MASK_MARKER}"}`; ``
  - 상세: 값은 마스킹 마커 상수(`VALUE_MASK_MARKER`)이며 프로덕션 자격증명이 아니다. 같은 파일 내 `'sk-live-abc123'`, `'hunter2'` 같은 리터럴(`deepRedactSecrets` 검증용 기존 fixture, 예: L242-243 부근)은 이번 diff 범위 밖(unchanged)이라 하드코딩 시크릿 우려에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 산출물(`review/code/2026/08/22/21_15_53/_retry_state.json` 등)에 로컬 워크트리 절대경로 노출
  - 위치: `review/code/2026/08/22/21_15_53/_retry_state.json` 전체
  - 상세: `/Volumes/project/private/clemvion/...` 절대경로가 기록돼 있으나 사용자명·인증정보는 포함하지 않으며, harness 가 자동 생성해 `review/**` 관례에 따라 커밋되는 상태 파일이다.
  - 제안: 조치 불요.

- **[INFO]** `RESOLUTION.md` 의 수정 방식(줄 번호 → 앵커 문구 인용 교체)은 보안과 무관하지만 SoT 참조 무결성을 개선
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (해당 커밋에서 항목 제목 앵커로 교체)
  - 상세: 문서 정합성 개선일 뿐 코드 동작·접근제어에 영향 없음.
  - 제안: 조치 불요.

## 점검 관점별 결과

1. **인젝션 취약점**: 해당 없음 — 신규/변경 코드가 SQL/커맨드/경로 등을 다루는 프로덕션 로직을 포함하지 않는다. 테스트는 순수 함수 호출(`resolveTriggerParametersRejectingMasked`, `rejectedFields`)뿐.
2. **하드코딩된 시크릿**: 신규 diff 범위에 실제 시크릿 없음(마스킹 마커 상수뿐, 위 INFO 참고).
3. **인증/인가**: 변경 없음. 이번 PR 은 인증/인가 로직을 건드리지 않는다.
4. **입력 검증**: 프로덕션 검증 로직(`resolveTriggerParametersRejectingMasked`, `throwIfAny`, `findMaskedResubmissions`)은 이번 diff 에서 수정되지 않았다 — 테스트만 추가되어 기존의 알려진 트레이드오프를 회귀 테스트로 문서화·고정한다.
5. **OWASP Top 10**: 해당 사항 없음.
6. **암호화**: 해당 없음.
7. **에러 처리**: 해당 없음 — 기존 `TriggerParameterValidationException.errors[].reason` 구조를 테스트에서 소비할 뿐 새 에러 메시지 경로를 추가하지 않는다.
8. **의존성 보안**: 신규 의존성 추가 없음.

## 요약

이번 변경은 프로덕션 코드를 전혀 수정하지 않으며, 마스킹된 값 재제출 거부 가드에 대해 이미 문서(코드 docstring·spec Rationale)에만 존재하던 알려진 phase 경계 트레이드오프(무관 필드의 `coerce_failed` 가 JSON-문자열-내부 마커 검사를 한 왕복 지연시킴)를 대조군 포함 회귀 테스트로 기계적으로 고정한다. 이는 새로운 취약점을 만드는 것이 아니라 기존 동작(및 그 한계)에 대한 감시를 강화하는 긍정적 변경이다. 나머지 변경은 plan 트래커 문서 갱신과 선행 리뷰/consistency-check 자동 산출물 커밋으로, 실질 코드 표면이 없다. 하드코딩된 시크릿, 인젝션, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 등 어떤 항목에서도 실질적 발견사항이 없다.

## 위험도

NONE
