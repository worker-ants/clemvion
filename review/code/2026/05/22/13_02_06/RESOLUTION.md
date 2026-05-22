# RESOLUTION — 13_02_06

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C1 (requirement: spec §2.3.1 / NAV-TR-10 부재) | false positive | — | Phase 1 commit 295df543 에서 이미 추가됨. grep 확인: `spec/2-navigation/2-trigger-list.md:66` §2.3.1 필드 권한 매트릭스 존재, `spec/2-navigation/_product-overview.md:65` NAV-TR-10 존재. 리뷰어 오탐. |
| W2 (security: ExternalInteractionCard RBAC 가드 누락) | 코드 | c2525155 | `canEdit = useHasRole("editor")` 추가, Edit 버튼에 `canEdit && !editing` 조건 적용 |
| W6 (side-effect: ExternalInteractionCard window.location.reload) | 코드 | c2525155 | `onSaved` prop 추가, `handleSave` 내 `window.location.reload()` → `onSaved()` 교체 |
| W7/W8 (side-effect/maintainability: mutationFn 내 window.confirm + USER_CANCELLED) | 코드 | c2525155 | confirm 로직을 `handleSaveClick()` 으로 분리. mutationFn 은 순수 API 호출만 담당. USER_CANCELLED 매직스트링 제거 |
| W10 (api-contract: WebhookConfigCard PATCH config 전체 spread) | 코드 | c2525155 | `trigger.config` 전체 spread 제거 → `configPatch` 변경 필드만 전송 |
| W13 (requirement: OverviewCard saveDisabled trim 비교 누락) | 코드 | c2525155 | `nameValue === trigger.name` → `nameValue.trim() === trigger.name` |
| W14 (requirement: WebhookConfigCard cancelEdit stale closure) | 코드 | c2525155 | `setAuthTypeValue(authType)` / `setHmacHeaderValue(hmacHeader)` → `trigger.config?.authType` / `trigger.config?.hmacHeader` 직접 참조 |
| W11a (testing: schedule 거부 테스트 details.disallowed 미검증) | 코드 | c2525155 | `expect.arrayContaining(['endpointPath'])` 단언 추가. 복수 거부 필드 조합 케이스 추가. name 허용 테스트에 `triggerRepo.save` 호출 검증 추가 |
| INFO-22 (user_guide_sync: controller swagger schedule 제한 미기술) | 코드 | c2525155 | `@ApiOperation.description` + `@ApiBadRequestResponse.description` 에 schedule PATCH 제한 문구 추가 |
| INFO-9 (ExternalInteractionCard "본 PR" 주석) | 코드 | c2525155 | window.location.reload 교체로 자연 소거됨 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4384 passed)
- e2e   : 통과 (98/98)

## 보류·후속 항목

- W1 (security: hmacSecret/bearerToken 응답 마스킹): 커밋 메시지에서 별 plan 분리 명시됨. 민감 변경 가드 적용 — TriggerDto 에 `@Exclude()` 또는 getter 재정의. 프로덕션 배포 차단 요건.
- W5 (security: endpointPath @Matches 검증): UpdateTriggerDto 변경 필요. 별 plan 분리.
- W11b/c (testing: 복수 거부 필드 케이스·save 호출 검증 외 나머지): W11a 에서 disallowed 단언·복수 케이스·save 호출 검증 처리됨. 프론트엔드 단위 테스트(W12)는 별 plan.
- W12 (testing: frontend drawer 단위 테스트): OverviewCard/WebhookConfigCard/ScheduleConfigurationCard 신규 단위 테스트. 별 plan.
- W9 (maintainability: CardEditActions 추출): 큰 리팩토링. 별 plan.
- I-21 (api-contract: RESOURCE_CONFLICT 매핑): data-model UNIQUE 추가 선행 필요. spec PR 체크리스트 항목.
