# 보안(Security) 코드 리뷰

## 리뷰 대상 요약

이번 변경은 **프로덕션 코드 수정이 없고**, 다음만 포함한다.

1. `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` — 마스킹된 값(`VALUE_MASK_MARKER` 등) 재제출 거부 로직에 대한 **신규 단위 테스트 1건** 추가 (기존 테스트 353건 전후 문맥 불변).
2. `plan/in-progress/masked-marker-test-gaps.md` — 신규 작업 트래커 문서.
3. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 기존 트래커 문서의 상태 갱신(체크박스 flip·근거 교체 주석 추가).
4. `review/consistency/2026/08/22/20_57_25/*` — `/consistency-check` 산출 리포트 8개 파일(자동 생성, 메타데이터/서술만 포함).

즉 이번 diff 는 **런타임 동작을 바꾸지 않는 test-only + 문서(plan/review artifact) 변경**이다. 아래는 그럼에도 보안 관점에서 점검한 결과다.

## 발견사항

- **[INFO]** 신규 테스트가 다루는 보안 가드(마스킹 마커 재제출 거부)의 **알려진 커버리지 갭을 의도적으로 고정**하는 방향
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:327` (`it('[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다', ...)`)
  - 상세: 이 신규 테스트는 `throwIfAny`(raw phase, ①)가 통과한 뒤 **마커와 무관한 필드**(`count`)의 `coerce_failed` 가 resolve phase(②, JSON 문자열 내부 마커 검사)를 선점하여 마스킹된 마커가 **그 요청에서는 검사되지 않는 채로 넘어가는** 케이스를 캐너리로 고정한다. docstring 과 plan 문서(`plan/in-progress/masked-marker-test-gaps.md`) 모두 이를 "보안 우회가 아니라 UX 지연"이라고 명시한다 — ①(raw scalar 검사)이 성공했다는 것은 최소 스칼라 위치의 명시적 마커는 여전히 잡힌다는 뜻이고, 사용자는 타입 오류를 고쳐 재제출할 때 결국 마커 안내를 받게 되므로 **영구적 우회는 아니다**. 다만 "무관한 필드의 유효성 오류가 존재하는 요청"에서는 JSON-문자열-내부-마커가 **그 왕복에서는** 서버에 그대로 저장/처리될 수 있다는 뜻이므로, 이 트레이드오프가 실제로 안전한지(예: coerce 실패로 요청 자체가 전부 reject 되어 값이 저장되지 않는지, 아니면 부분적으로 반영되는지)는 상위 `resolveTriggerParametersRejectingMasked`/`throwIfAny` 구현(변경분 없음)을 통해 재확인할 가치가 있다. 이번 PR 은 **테스트만 추가**했고 동작을 바꾸지 않았으므로 새로운 취약점을 도입하지는 않는다 — 기존에 존재하던 알려진 트레이드오프를 회귀 테스트로 문서화·고정한 것뿐이다.
  - 제안: 코드 변경 사항 없음(정보성). 다음에 이 트레이드오프를 없애려는 시도(두 phase 통합)가 있을 경우, `coerce_failed` 로 요청 전체가 reject 되어 마스킹된 원문이 DB/로그에 영속화되지 않는지를 함께 검증하는 것을 권장.

- **[INFO]** 테스트 fixture 에 자격증명 유사 리터럴 사용 (신규 diff 범위 밖, 참고용)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:333` (`` const jsonWithMarker = `{"apiKey":"${VALUE_MASK_MARKER}"}`; ``)
  - 상세: 실제 시크릿이 아니라 마스킹 마커 상수(`VALUE_MASK_MARKER`)를 값으로 채운 JSON 문자열이며, 프로덕션 시크릿·API 키가 하드코딩된 것이 아니다. 동일 파일의 기존(비변경) 테스트에도 `'sk-live-abc123'`, `'hunter2'` 같은 명백한 fixture 값이 있으나 이는 diff 범위 밖이며 `deepRedactSecrets`(마스커) 가 자격증명 패턴을 실제로 치환하는지 검증하기 위한 의도된 테스트 입력이다. 시크릿 유출 아님.
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/2026/08/22/20_57_25/*` 산출물의 경로 노출
  - 위치: `review/consistency/2026/08/22/20_57_25/_retry_state.json` 전체
  - 상세: 로컬 워크트리의 절대 경로(`/Volumes/project/private/clemvion/...`)가 그대로 기록되어 있다. 사용자명·비밀 정보는 포함하지 않으며, 이 파일은 harness 가 자동 생성하는 리뷰 파이프라인 상태 파일로 저장소 관례(`review/**`)에 부합한다. 보안 문제 아님.
  - 제안: 조치 불요.

## 점검 관점별 결과

1. **인젝션 취약점**: 해당 없음 — 신규/변경 코드가 사용자 입력을 SQL/커맨드/경로 등으로 전달하는 프로덕션 로직을 포함하지 않는다. 테스트는 순수 함수 호출뿐.
2. **하드코딩된 시크릿**: 신규 diff 범위에 실제 시크릿 없음(위 INFO 참고, fixture 값과 마스킹 마커 상수뿐).
3. **인증/인가**: 변경 없음. 인증/인가 로직 자체는 이번 PR 에서 건드리지 않았다.
4. **입력 검증**: 프로덕션 검증 로직(`resolveTriggerParametersRejectingMasked`, `throwIfAny`)은 이번 diff 에서 수정되지 않았다 — 테스트만 추가되어 기존 동작(알려진 트레이드오프 포함)을 문서화·고정한다.
5. **OWASP Top 10**: 해당 사항 없음.
6. **암호화**: 해당 없음.
7. **에러 처리**: 해당 없음 — `TriggerParameterValidationException.errors[].reason` 등 기존 에러 구조를 테스트에서 소비할 뿐 새로운 에러 메시지 경로를 추가하지 않는다.
8. **의존성 보안**: 신규 의존성 추가 없음.

## 요약

이번 변경은 프로덕션 코드를 전혀 수정하지 않고, 마스킹된 값 재제출 거부 가드에 대한 단위 테스트 1건 추가와 plan/consistency-report 문서 갱신으로 구성된다. 신규 테스트는 이미 알려져 있고 docstring/plan 문서에 명시된 "무관한 필드의 타입 오류가 JSON-문자열-내부 마커 검사를 한 왕복 지연시키는" 트레이드오프를 회귀 테스트로 고정하는 것으로, 이는 새로운 취약점을 만드는 것이 아니라 기존 동작(및 그 한계)을 기계적으로 감시 가능하게 만드는 긍정적인 변경이다. 하드코딩된 시크릿, 인젝션, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 등 어떤 항목에서도 실질적 발견사항이 없다.

## 위험도

NONE
