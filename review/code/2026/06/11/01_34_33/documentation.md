# Documentation Review

## 발견사항

### **[INFO]** `getNotifResourceIds` · `hasSavedExpired` 헬퍼 JSDoc — 적절
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` 신규 헬퍼 함수 (diff +36~+61)
- 상세: 두 테스트 헬퍼 모두 `@returns` 포함 JSDoc 이 작성됐으며 레이블(W-3·W-4)로 SUMMARY 추적 가능. 테스트 파일임을 감안하면 문서화 수준은 양호.
- 제안: 특이사항 없음.

### **[INFO]** `isRefreshCapable` JSDoc — 충분
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` 파일 말단 (diff +451~+474)
- 상세: 함수 이름이 `isCafe24RefreshCapable` → `isRefreshCapable` 로 변경됐고 JSDoc 도 함께 갱신됐다. cafe24(배경 큐) / makeshop(in-call) 동작 차이, spec 링크(§11.2), 향후 확장 지점 모두 명시됨.
- 제안: 특이사항 없음.

### **[INFO]** `INTEGRATION_STATUS_REASONS` — `token_expired` 추가 주석
- 위치: `codebase/backend/src/modules/integrations/integration-status-reason.ts` (diff +497~+500)
- 상세: 신규 슬러그 `token_expired` 에 인라인 주석으로 (1) DB-only 네임스페이스 경계, (2) JWT REST 에러 코드·WS 이벤트와의 구분, (3) spec 참조(§11.2)가 모두 기재됐다. 혼동 방지에 필요한 설명이 선제적으로 포함됐다.
- 제안: 특이사항 없음.

### **[INFO]** `MONITORED_QUEUES` JSDoc — 갱신 지침 보강
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (diff +682)
- 상세: 기존 JSDoc 에 `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 도 함께 갱신하라는 지시가 추가됐다. 큐 추가 시 누락할 수 있는 세 번째 위치(e2e 목록)를 명시적으로 안내하는 좋은 개선이다.
- 제안: 특이사항 없음.

### **[INFO]** `system-status.constants.spec.ts` 신규 파일 JSDoc — 적절
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.spec.ts` (신규 파일)
- 상세: `describe` 블록 위에 spec 참조(§1 큐 레지스트리, data-flow §4 카탈로그)와 V-15 회귀 방지 배경이 JSDoc 으로 작성됐다. 테스트 파일에서의 문서화 기준을 충족한다.
- 제안: 특이사항 없음.

### **[INFO]** `system-status.e2e-spec.ts` — 하드코딩 숫자 제거 및 주석 갱신
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` (diff +837·+854)
- 상세: `"13개 큐"` 하드코딩 문자열을 `${EXPECTED_QUEUE_NAMES.length}개` 로 교체해 목록 길이와 설명이 자동 동기된다. 블록 주석의 `+ 13개 큐 enumerate` 문구도 `+ EXPECTED_QUEUE_NAMES 기준 큐 enumerate` 로 현행화됐다. 문서와 코드가 drift 되지 않도록 하는 구조적 개선이다.
- 제안: 특이사항 없음.

### **[INFO]** 사용자 문서(MDX) 갱신 — refresh-capable 알림 정책 반영
- 위치: `integration-management.en.mdx`, `integration-management.mdx`, `makeshop.en.mdx`, `makeshop.mdx`
- 상세: 4개 사용자 문서 모두 §11.2 변경(refresh_token 자동 갱신 provider 는 passive 알림 미발송) 을 Callout + 표 형태로 명확히 설명한다. 한국어·영어 페어가 동기화됐으며, makeshop.mdx/en.mdx 에는 "Token refresh and expiry" 전용 섹션과 FAQ 항목(`만료 알림이 안 왔는데 왜 연결이 끊겼나요?`)이 추가됐다.
- 제안: 특이사항 없음.

### **[INFO]** spec 문서(`spec/data-flow/5-integration.md`) — 알려진 구현 갭 callout 제거
- 위치: `spec/data-flow/5-integration.md` (diff -2026-06 알려진 구현 갭 callout)
- 상세: V-01·V-07 fix 로 구현 갭이 해소됐으므로 해당 경고 블록을 삭제하고 Rationale 에 "해소 이력"으로 압축 기술했다. sequenceDiagram 이 `isRefreshCapable` 구조(refresh-capable 분기 → else refresh_token 없는 provider)로 재작성됐고, state diagram 의 `status_reason=NULL` → `status_reason=token_expired` 정정, §3.2 표도 동기됐다.
- 제안: 특이사항 없음.

### **[WARNING]** `spec/data-flow/5-integration.md` Rationale 절 — "폐기된 옛 서술" 압축 표현의 가독성
- 위치: `spec/data-flow/5-integration.md` Rationale (diff -431~-441 → +(2026-06-10 V-01·V-07 fix 로 해소) 단락)
- 상세: 과거 갭 기술이 단 한 문단으로 압축됐다. 내용은 정확하나 "한때 본 문서는 … 를 기술했다. 두 갭은 모두 해소됐다"는 형태는 이력 추적에 유용하지만, "왜 null 이 아닌가" 를 처음 읽는 독자에게는 적극적 설명보다 과거 상황의 서술이 더 많은 비중을 차지할 수 있다. 실제로 현행 동작을 설명하는 §1.4 표가 SoT 이므로 치명적이지는 않다.
- 제안: Rationale 이력 단락을 "**2026-06-10 V-01·V-07 fix**: `isCafe24RefreshCapable` 이 `isRefreshCapable`(cafe24·makeshop) 로 일반화됐고, refresh_token 없는 provider 의 0d 격하에 `status_reason='token_expired'` 가 추가됐다. §1.4 가 현행 구현의 SoT." 정도로 간결하게 재작성을 고려. 현재 수준도 허용 범위 안이므로 강제 사항은 아님.

### **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` — buildTools 주석 갱신
- 위치: `spec/4-nodes/4-integration/4-cafe24.md` (diff +433 라인)
- 상세: `isCafe24RefreshCapable` → `isRefreshCapable` 로 함수명이 바뀐 것이 Rationale 텍스트에도 반영됐다. 단순 텍스트 동기이지만 spec 내 함수명 참조가 구 이름으로 남지 않아 혼동을 방지한다.
- 제안: 특이사항 없음.

### **[INFO]** plan 문서 — 작업 이력 및 추적 가능성 우수
- 위치: `plan/complete/integration-expiry-fixes.md`, `plan/complete/spec-update-integration-expiry-diagram.md`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md`
- 상세: 세 plan 문서가 V-01·V-07·V-15 각 fix 의 결정 배경, 커밋 ID, 체크리스트 완료 여부, 후속 백로그를 명확히 기록한다. spec-update plan 은 Before/After 코드 예시를 포함해 변경 의도가 명확하다.
- 제안: 특이사항 없음.

### **[INFO]** `spec/2-navigation/4-integration.md` 및 `spec/1-data-model.md` — 변경 범위 확인
- 위치: 파일 14·15 (diff 내용은 prompt 에서 일부만 확인, 나머지는 system-status e2e 및 data-flow 파일로 정황 추론)
- 상세: `spec/1-data-model.md` 의 변경은 `token_expires_at` 컬럼 설명 갱신으로 추정되며(diff 내용상 install_token 관련 필드 설명), `spec/2-navigation/4-integration.md` §11 은 §11.1·§11.2 의 현행화가 포함된 것으로 plan 문서를 통해 확인됨. 두 문서의 구체적 diff 전체는 읽지 못했으나 plan 체크리스트에서 "--impl-done 통과"가 확인됨.
- 제안: 특이사항 없음.

---

## 요약

이번 변경은 문서화 관점에서 전반적으로 높은 품질을 보인다. 백엔드 코드(`isRefreshCapable`, `token_expired`, `MONITORED_QUEUES`) 의 JSDoc이 구현 변경과 함께 동기됐고, 사용자 문서(4개 MDX)는 §11.2 알림 정책을 한국어·영어 양쪽에 일관되게 반영했다. spec 문서(`data-flow/5-integration.md`)는 구현 갭 callout을 제거하고 sequenceDiagram·state diagram·§3.2 표를 모두 현행화해 단일 진실이 유지됐다. 테스트 파일에도 의도와 spec 참조가 인라인 주석으로 기재됐으며, plan 문서는 결정 배경과 커밋 이력을 추적 가능하게 보존한다. 유일한 경미한 개선 여지는 `spec/data-flow/5-integration.md` Rationale의 "폐기된 옛 서술" 단락이 이력 중심으로 서술돼 처음 독자에게 다소 장황할 수 있다는 점이나, 현행 SoT인 §1.4 표가 있으므로 실용적 문제는 없다.

---

## 위험도

LOW

STATUS: SUCCESS
