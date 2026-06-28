# 신규 식별자 충돌 검토

검토 모드: `--impl-prep`, 범위 `spec/5-system/`  
검토 대상 변경: `spec/7-channel-web-chat/4-security.md`(R6 신설), `spec/5-system/12-webhook.md`(WH-SC-05 갱신), `spec/5-system/1-auth.md`(Rationale 2.3.B m-3 보강)

---

## 발견사항

### [INFO] `R6` 식별자는 `7-channel-web-chat/` 내 파일별 로컬 번호 — 범-파일 충돌 없음

- target 신규 식별자: `spec/7-channel-web-chat/4-security.md §R6` (공개 webhook IP 미식별 — 단일 공유 버킷 완화 한도)
- 동일 폴더 내 기존 R6:
  - `spec/7-channel-web-chat/1-widget-app.md §R6` — "워크플로우 시작 — 패널 open 시(eager)"
  - `spec/7-channel-web-chat/3-auth-session.md §R6` — "토큰 저장 — sessionStorage"
  - `spec/7-channel-web-chat/5-admin-console.md §R6` — "위젯 동봉(co-deploy)"
  - `spec/5-system/14-external-interaction-api.md §R6` — "Notification 실패 시 자동 비활성화 금지"
- 상세: Rn 번호는 각 파일 내 Rationale 섹션의 로컬 순번이며, 전체 spec 에서 전역 고유 식별자로 취급되지 않는다. 파일 간 동일 번호가 복수 존재하는 것은 이미 확립된 패턴(`4-security.md` 내 R1-R5, `14-external-interaction-api.md` 내 R1-R10 등)이다. 교차 참조는 항상 파일 경로를 명시하는 앵커(`[4-security R6](../7-channel-web-chat/4-security.md#r6-...)`) 형식을 쓰고 있어 혼동이 없다.
- 제안: 현 패턴 유지. 특별한 조치 불필요.

---

### [INFO] `UNIDENTIFIED_IP_BUCKET` 상수 — 기존 sentinel 과 명명 충돌 없음

- target 신규 식별자: `UNIDENTIFIED_IP_BUCKET` (TypeScript export 상수, `public-webhook-quota.service.ts` — 아직 구현 전)
- 기존 sentinel 상수:
  - `UNREADABLE_KEY = '__unreadable'` (`codebase/backend/src/modules/integrations/services/credentials-transformer.ts:33`) — 자격증명 복호화 실패 마커, 다른 도메인
  - `NONE_SENTINEL = '__none__'` (`codebase/backend/src/nodes/ai/text-classifier/text-classifier.schema.ts:152`) — 텍스트 분류기 예약어, 다른 도메인
- 상세: `UNIDENTIFIED_IP_BUCKET` 는 네이밍이 독자적이며 기존 두 sentinel 과 충돌하지 않는다. 도메인(IP rate-limit), 파일 위치(`hooks/`), 값 형태(문자열 버킷 키)가 모두 다르다. 구현 시 `public-webhook-quota.service.ts`에서 export 하는 형태가 spec(`4-security.md §R6`, `12-webhook.md §6`)과 일치한다.
- 제안: 현 명칭 그대로 구현. 참고로 plan 문서(`webhook-public-ip-failopen-hardening.md`)에 예시 값 `'__no_client_ip__'`가 언급됐지만 실제 값 선택은 구현 자유도 사항이며 충돌 우려가 없다. Redis 키 패턴 `wh:rl:min:{sentinel}` / `wh:rl:hour:{sentinel}` 도 기존 `wh:rl:` 네임스페이스 하위이므로 기존 키와 범주적으로 일관성이 있다.

---

### [INFO] `D-12` 백로그 ID — 기존 사용처와 의미 충돌 없음

- target 신규 식별자: `D-12` (plan 백로그 아이템 식별자, spec `4-security.md §R6` 및 `1-auth.md Rationale 2.3.B`에 참조)
- 기존 사용처: `plan/in-progress/webhook-hardening-cleanup.md:35`, `plan/in-progress/webhook-spec-pointer-cleanup.md:51`, `plan/in-progress/webhook-public-ip-failopen-hardening.md:7`에서 동일 의미로 지칭됨
- 상세: D-12는 이번 작업이 신설한 식별자가 아니라 이전 hardening cleanup plan 에서 백로그로 분류·추적해온 아이템이다. 모든 참조가 동일 의미("공개 webhook IP 미식별 fail-open 강화")를 가리키므로 충돌이 없다.

---

### [INFO] WH-SC-05 요구사항 ID — 기존 ID 재사용, 새 ID 충돌 없음

- target 변경: `spec/5-system/12-webhook.md WH-SC-05` 텍스트 갱신 (IP 미식별 공유 버킷 동작 추가)
- 상세: ID 자체는 신규 부여가 아닌 기존 요구사항 업데이트다. 동일 표 내 `WH-SC-01`~`WH-SC-09` 시리즈에서 새 번호를 추가하지 않았으므로 ID 충돌 없음.

---

## 요약

이번 spec 변경(`7-channel-web-chat/4-security.md §R6 신설`, `12-webhook.md WH-SC-05 갱신`, `1-auth.md Rationale 2.3.B 보강`)이 도입하는 새 식별자는 `R6`(per-file 로컬 번호), `UNIDENTIFIED_IP_BUCKET`(TypeScript 상수), `D-12`(백로그 참조)이다. `R6`는 파일별 로컬 Rationale 번호 체계에서 이미 복수 파일에 동일 번호가 공존하는 확립된 패턴으로 전역 충돌이 아니다. `UNIDENTIFIED_IP_BUCKET`은 기존 sentinel 상수(`UNREADABLE_KEY`, `NONE_SENTINEL`)와 명명·도메인·파일 위치가 모두 다르며, `D-12`는 기존 plan 문서에서 동일 의미로 추적해온 식별자다. 신규 API 엔드포인트·이벤트명·환경변수·파일 경로의 추가는 없다. 구현 차단 요인이 될 CRITICAL 또는 WARNING 수준의 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
