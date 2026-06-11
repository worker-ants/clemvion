# 변경 범위(Scope) 리뷰

## 발견사항

### **[INFO]** `code.handler.ts` — `classifyCodeNodeError` + `LEGACY_TO_NORMALIZED` + `RE_*` 블록 재배치
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` 전체 diff
- 상세: diff에서 파일 하단에 있던 `RE_*`, `LEGACY_TO_NORMALIZED`, `classifyError` 삭제(-) 후 파일 중간(`syntaxCheck` 직후, `CodeHandler` 클래스 선언 이전)에 재선언(+)으로 등장한다. 이는 plan `code-node-isolated-vm-followups.md` INFO 항목("모듈 상수 선언을 파일 상단으로 이동")의 완료 표시가 `**(완료, PR errcode-wiring)**` 으로 기재된 것과 일치하므로 의도된 변경이다. 그러나 이 재배치는 plan W4(기능 무관 가독성 리팩터) 항목이며, W4는 이번 PR에서 아직 `[ ]` 미체크 상태로 남아 있다. INFO 항목 완료 노트에서만 이 이동이 언급되어 추적이 혼재되어 있다. 기능·행동 변화 없음.
- 제안: 허용 범위 내의 변경이나, plan W4 체크박스와 INFO 항목 간 추적 정합 확인 권고.

### **[INFO]** `code.handler.ts` — `LEGACY_TO_NORMALIZED` 타입 강화 및 fallthrough 기본값 변경
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `LEGACY_TO_NORMALIZED` 상수 선언부 및 `failure()` 메서드
- 상세: `Record<string, string>` → `Readonly<Record<string, ErrorCodeValue>>` 타입 변경, `Object.freeze` 추가, `?? errorCode` → `?? ErrorCode.CODE_EXECUTION_FAILED` 기본값 변경이 함께 수행되었다. 이는 plan `code-node-isolated-vm-followups.md` INFO 항목("LEGACY_TO_NORMALIZED fallthrough … `Object.freeze`/`as const satisfies` 적용")에 명시된 항목과 일치한다. 범위 이탈이 아니며 plan에 사전 등재된 변경이다. 다만 타입 강화와 `classifyError` rename, `INTERNAL_CODES` 등재가 같은 커밋에 묶여 있어 단위가 약간 넓다. 기능 영향 없음.
- 제안: 없음. plan에 명시된 항목이므로 허용.

### **[INFO]** `execution-failure-classifier.ts` — `HTTP_BLOCKED` 추가 (W1 계획에 없었으나 논리적 확장)
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` `INTERNAL_CODES` Set
- 상세: plan W1 항목 원문은 "`CODE_MEMORY_LIMIT`" 추가만 명시했다. 이번 PR에서 `HTTP_BLOCKED`도 함께 등재되었고, plan 완료 노트에서 "HTTP_BLOCKED 도 함께 등재(전 인증 SSRF 차단)"로 이유를 밝히고 있다. spec §3.1 매핑 표가 이미 두 코드를 internal로 열거 중이므로 논리적으로 연관된 미완 항목을 한 커밋에서 처리한 것이다. `http-ssrf-all-auth-followups.md`의 별도 체크 항목("HTTP_BLOCKED enum 참조화")과도 정합한다. 범위 초과보다는 연관 항목 번들링에 가깝다.
- 제안: 허용 범위. plan 노트에 사후 기재가 완료되어 추적 가능하다.

### **[INFO]** `error-codes.ts` — 주석 2줄 추가 (SoT 참조 및 opt-out env 언급)
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `HTTP_BLOCKED` 항목 주석
- 상세: `http-safety.ts` SoT 참조 및 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 언급이 추가되었다. 코드 값 자체 변경 없음. `http-ssrf-all-auth-followups.md`의 "`HTTP_BLOCKED` enum 참조화" 항목에 "`error-codes.ts` 주석에 http-safety SoT·opt-out env 추가"로 명시되어 있다. 범위 내.

### **[INFO]** review 디렉터리 파일들(SUMMARY.md, 각 reviewer md, meta.json, _retry_state.json) 포함
- 위치: `review/code/2026/06/12/00_21_47/` 하위 파일들
- 상세: 이번 PR에 이전 리뷰 세션의 산출물이 포함되어 있다. 이는 프로젝트 규약(CLAUDE.md "plan 체크박스 = 실제 상태 — review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋")에 따른 의도된 포함이다. 범위 이탈 아님.

## 요약

이번 PR(errcode-wiring)의 변경 범위는 plan 체크리스트(W1 classifier 등재, W2 rename, INFO LEGACY_TO_NORMALIZED 강화, http-ssrf-all-auth-followups HTTP_BLOCKED enum 참조화)에 모두 대응되며, 의도하지 않은 기능 추가·무관 파일 수정·불필요한 리팩터링은 발견되지 않는다. 다만 (1) `classifyCodeNodeError` 함수 선언 위치 이동과 모듈 상수 재배치가 plan W4(기능 무관 가독성 항목)와 INFO 항목에 이중 기재되어 추적이 약간 혼재하는 점, (2) W1에 명시되지 않았던 `HTTP_BLOCKED` 등재가 추가된 점이 있으나, 둘 다 plan 완료 노트에 사후 근거가 명시되어 있고 spec과 정합한다. 포맷팅·임포트·설정 파일 범위 이탈은 없다.

## 위험도

NONE
