# Rationale 연속성 검토

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope 명목상 `spec/5-system/` 이나 실제 spec 델타는 0개 파일 (코드 전용 PR, 정상).
- 구현 diff: `origin/main...HEAD` 기준 32개 파일 — `codebase/backend/src/modules/{triggers,schedules,integrations,alerts,knowledge-base}` 의 응답 DTO/서비스/컨트롤러, `repo-guards/__tests__/swagger-dto-contract-guard.ts`, `shared/testing/{response-contract.ts,schedule-trigger-ref.ts}`, 다수 e2e 스펙.
- 프롬프트 번들이 예산 절단으로 diff 본문과 `spec/5-system/*.md` 대부분을 생략했으므로, 워킹트리를 절대경로/`git -C`로 직접 열어 diff 전문과 관련 Rationale(§5.4 응답-계약, `secret-store.md` §1.1, `2-trigger-list.md` R-8/R-12, `1-data-model.md`, `data-flow/10-triggers.md` 등)을 대조했다.
- 배경: 이 브랜치는 `#1288`(응답 vs DTO 선언 대조 검증자 신설)과 `#1289`/`#1290`(§5.4 검증자 등재, `notification_secret_v2` 노출 금지 규범 신설)의 직계 후속 스윕이며, 각 커밋이 직전 리뷰 산출물(`review/code/**`, `review/consistency/**`)을 인용하며 스스로의 결정 이력을 코드 주석에 남기는 형태다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

### 확인된 정합 사례 (참고용, 비차단)

- **`TRIGGER_RESPONSE_STRIP_COLUMNS` + `deleteSecretColumns`** (`codebase/backend/src/modules/triggers/triggers.service.ts`): `notificationSecretV2`/`chatChannelTokenV2`를 응답 경계에서 컬럼째 제거하며, 컬럼 주석이 "왜 `select: false`가 아닌가"를 명시적으로 설명한다. 이는 `spec/conventions/secret-store.md` §1.1(2026-09-05 신설)이 정확히 요구하는 처방과 일치한다 — "엔티티를 그대로 반환하는 경로에서는 응답 경계에서 지운다. `select: false`는 회전 승격/정리 스윕이 fail-silent 해지므로 쓰지 않는다"는 문장을 코드가 그대로 이행한다. §1.1 자신이 "유출을 닫는 코드 수정은 `plan/in-progress/spec-draft-nullable-notation-followups.md`가 추적한다"고 적어 둔 갭을 이 diff가 닫는 관계다 — 번복이 아니라 예고된 폐색.
- **`IntegrationDto.appUrl` 신규 필드**: `install_token` 자체는 별도 필드로 노출하지 않고 `appUrl` 문자열 하나만 계산해 반환한다. `2-navigation/4-integration.md` Rationale("install_token 자체는 별도 필드로 노출하지 않는다 — 중복/식별자 분산/동기화 부담")과 정확히 부합.
- **§5.4 "필드별 근거 명시" 요구**를 코드 주석에서 각 필드마다 (a)/(b) 기준을 인용해 충족 (`TriggerDto.workflow`, `ScheduleTriggerRefDto.workflow` 모두 "키 생략형 — 기준 (b)"로 명시).
- **`findOptionalNullableResponseFields` 래칫 신설**: `#1287`(cb17f0870 "§5.4 금지 조합을 내가 넓혔다")에서 예고된 "동결, 확대 금지"를 코드 가드로 집행 — 결정과 집행의 시차가 있었을 뿐 번복이 아니다.
- **`ScheduleTriggerRefDto`/`TriggerWorkflowRefDto` 필드 비대칭**(`id` 유무)을 "의도적으로 다르다"고 명시하고 "한쪽을 다른 쪽으로 갈아 끼우지 말 것"이라 경고 — 향후 누군가 통합하려는 시도에 대한 선제적 Rationale.
- `rerankScoreThreshold`(`double precision`) 등 신규 노출 필드는 `numeric`/`decimal` 문자열-표현 규약(§api-convention 검증 층 인접 규칙) 대상이 아닌 타입이라 `number` 선언이 타당 — 인접한 "numeric은 문자열" 규약(commit e83617a4a)과 충돌 없음.

기각된 대안 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 사례는 발견되지 않았다. 오히려 이 diff는 다수 지점에서 "왜 이전 대안(예: `select: false`, 조기 return, 단일 strip 목록)을 쓰지 않는가"를 명시적으로 재확인하며 기존 Rationale을 강화하는 방향으로만 움직였다.

## 요약

이 브랜치(`sweep-response-contract-5ba0ad`)는 spec을 변경하지 않는 코드 전용 스윕이며, 검토 대상 32개 파일의 diff는 `spec/5-system/2-api-convention.md` §5.4(응답 부재 표현·검증 층)와 `spec/conventions/secret-store.md` §1.1(비밀 컬럼 응답 노출 금지), `spec/2-navigation/2-trigger-list.md`·`4-integration.md`의 기존 Rationale을 정확히 준수·집행하는 후속 작업으로 확인됐다. 각 변경은 코드 주석에서 직전 리뷰 라운드(`review/code/**`, `review/consistency/**`)를 인용하며 "왜 이 대안이 아닌가"를 스스로 밝히고 있어, 기각된 대안의 무단 재도입이나 합의 원칙의 우회 정황이 없다. Rationale 연속성 관점에서 이 PR은 차단 사유가 없다.

## 위험도

NONE
