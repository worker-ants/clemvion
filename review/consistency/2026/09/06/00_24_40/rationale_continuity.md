# Rationale 연속성 검토

## 검토 범위와 방법

- target: `spec/5-system/` (impl-done, diff-base `origin/main`)
- **scope 델타 0개 파일** — 이 브랜치는 `spec/5-system/` 을 직접 수정하지 않았다(`git diff origin/main...HEAD --name-only -- spec/` 실측 0건). 따라서 본 검토는 코드 diff(HEAD, codebase/ 31파일)가 `spec/5-system/2-api-convention.md §5.4`(부재 표현·DTO 선언 3형태·검증 층)와 `spec/conventions/secret-store.md §1.1`(민감 필드 응답 노출 금지)에 이미 확정된 Rationale/invariant 를 위반하는지를 코드 직접 대조로 확인했다.
- 프롬프트 예산 절단으로 `spec/5-system/` 17개 파일 본문·`<git diff>` 섹션이 생략돼 있어, `1-auth.md`·`2-api-convention.md` 전체 본문과 diff 대상 코드(`triggers.service.ts`, `schedules.controller.ts`/`.service.ts`, `response-contract.ts`, `swagger-dto-contract-guard.ts`, 신규 응답 DTO 5종, `CHANGELOG.md`)를 워크트리에서 절대경로 `git diff`/`grep`으로 직접 확인했다.
- **직전 라운드(`review/consistency/2026/09/06/00_01_16/rationale_continuity.md`, NONE)와의 차분**: 그 이후 추가된 커밋은 `e018a176f` 1개(`sanitizeForResponse` 5책임 분해 + `IntegrationDto.appUrl` JSDoc 정정)뿐이며, 이번 검토는 그 델타를 포함해 재확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** §5.4 신규 "금지 조합" 축(`optional+nullable`)의 소급 면제가 spec 원문이 아니라 유추 적용임 — 직전 라운드 대비 미해소, 재확인
  - target 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 의 `findOptionalNullableResponseFields`/`EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건 래칫 베이스라인)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4` "소급 적용 대상 아님" 문단 + `plan/in-progress/spec-draft-nullable-notation-followups.md:239-240` "§5.4 의 소급 면제 조항 … 은 유추 적용이다(`--spec` INFO#1)"
  - 상세: `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 78건 래칫은 §5.4 의 "새 규칙 도입 이전에 규약을 지켰던 필드는 즉시 강제하지 않는다"는 비소급 원칙을, spec 문면이 명시하지 않은 **금지 조합(선언 형태의 조합) 축**까지 유추 확장한 것이다. spec 문언(§5.4 "표현 선택과 DTO 선언 형태 양쪽 모두")과 모순되지는 않으나, 이 축이 원 조항이 겨냥한 사례(표현 선택 백로그)와 동일한지는 spec 텍스트만으로 확정할 수 없다. 다만 이는 **신규 위반이 아니라 이미 `--spec` 리뷰(INFO#1)에서 식별·수용된 유추**이며, 이번 diff 는 그 유추를 코드 가드로 구현했을 뿐이다.
  - 제안: spec 정정 의무 없음(plan 에 이미 유추임이 명시돼 있고 방향 전환도 없음). 다음에 §5.4 를 편집할 기회에 "DTO 선언 형태의 *조합* 위반도 비소급 대상"이라는 한 줄을 보태면 이 항목은 닫힌다 — 비긴급.

## 정합성이 확인된 주요 지점 (참고용, 위반 아님)

- **§5.4 부재 표현 규칙 준수**: `TriggerDto`(`chatChannelHealth` 등 7종 + `workflow?`)·`ScheduleDto`(`trigger`, 종전 키 생략 → 필수·상시 존재로 번복)·`IntegrationDto`(`appUrl` 등 6종)·`KnowledgeBaseDto`(7종)·`AlertRuleDto`(2종) 신규 필드는 전부 §5.4 표의 두 형태(상시 존재 → `@ApiProperty({nullable:true})`, 선택적 부가 컨텍스트 → `@ApiPropertyOptional()` + 기준 (a)/(b) 명시)를 근거 주석과 함께 따른다. `ScheduleDto.trigger` 의 번복은 실측(4개 응답 경로 전부 채움 확인)과 새 Rationale(코드 주석 + `review/consistency/2026/09/05/21_40_38` W1 인용)을 동반해 "결정의 무근거 번복" 에 해당하지 않는다. `IntegrationDto.appUrl` 은 첫 판을 키 생략형으로 적었다가 e2e 계약 대조로 반증되어 §5.4 기본형으로 재정정한 사례이며 그 경위가 코드 주석에 남아 있다.
- **secret-store.md §1.1 준수**: `triggerToken`·`notificationSecretV2`·`chatChannelTokenV2`·`notification.signing.{secret,secretRef}` 는 secret-store.md §1.1 이 열거한 세 비대상 필드(및 그 ref)와 정확히 일치하며, `TriggersService.sanitizeForResponse` 가 4축(`config.chatChannel`/`config.interaction`/`config.notification.signing`/엔티티 컬럼)에서 모두 스트립한다. `select: false` 를 쓰지 않은 이유(로테이션 스윕이 fail-silent 로 깨진다)도 secret-store.md §1.1 이 명시한 근거와 동일 문구로 코드에 남아 있다 — 컬럼 수준 은닉이라는 **기각된 대안**을 재도입하지 않았다.
- **§5.4 "검증 층" 구조 위반 없음**: 신규 축(`findOptionalNullableResponseFields`)은 3번째 검증자를 신설한 것이 아니라 spec §5.4 "검증 층" 표에 이미 등재된 `swagger-dto-contract-guard.ts`(선언↔선언, 정적) 내부에 축을 추가한 것이다. §5.4 가 "판정 규칙 상세는 코드 JSDoc 이 단일 진실, spec 에 옮기면 drift 소스만 는다" 고 명시적으로 위임하므로 spec 미갱신은 결함이 아니다.
- **`IntegrationDto.appUrl` JSDoc 정정(직전 라운드 이후 신규, `e018a176f`)**: "cafe24 Private 전용" → "Cafe24 Private + MakeShop ShopStore" 로 정정한 내용이 `spec/2-navigation/4-integration.md §9.1`(`GET /api/integrations/:id` 행, `appUrl` derived 필드 설명)과 정확히 일치함을 직접 대조 확인했다 — spec 은 이미 두 갈래를 옳게 적고 있었고 코드 주석만 낡아 있던 것을 실측으로 바로잡은 사례라 "무근거 번복" 이 아니다.
- **자기 반증형 소정정 패턴 형태 일치**: `contractForDto` JSDoc 의 "worker 단위"→"테스트 파일 단위" 캐시 격리 정정은 실측 인용(`review/code/2026/09/05/21_40_37` W2)과 함께 이뤄졌다 — CLAUDE.md 의 자기반증 원칙과 형태가 같다(단, `spec/` 문서가 아니라 코드 JSDoc이라 그 조항의 직접 적용 대상은 아님).
- **PR 내부 자기 교정도 은폐 없이 기록됨**: "§5.4 금지 조합"을 이 브랜치 초판이 스스로 어겼다가(17개 필드) 같은 세션에서 되돌린 이력이 `CHANGELOG.md`·plan 파일·신규 래칫 가드 세 곳에 모두 남아 있어, "결정의 무근거 번복" 이 아니라 감사 가능한 자기 교정이다.

## 요약

이 브랜치는 `spec/5-system/2-api-convention.md §5.4`(부재 표현·DTO 선언 3형태·검증 층)와 `spec/conventions/secret-store.md §1.1`(민감 필드 응답 노출 금지)에 이미 확정된 Rationale을 정확히 그 문면대로 구현·확장하는 코드 전용 PR(spec/5-system 델타 0)이다. 트리거/스케줄 응답의 비밀 필드 스트립을 4축(JSONB 3곳 + 엔티티 컬럼)으로 완성하고(`sanitizeForResponse`), `ScheduleDto.trigger` 필수화·`IntegrationDto.appUrl` 등 신규 DTO 필드의 null-vs-omission 선택은 전부 §5.4 기준 (a)/(b)에 근거를 남기며, 과거에 기각된 대안(`select: false` 컬럼 숨김 — fail-silent 우려로 명시 배제, DTO 선언으로 시크릿 노출을 "합법화"하는 경로 — plan 이 명시적으로 금지)을 재도입하지 않았다. 직전 라운드(00:01:16) 이후 추가된 유일한 커밋(`e018a176f`)도 리팩터링 + spec 과 일치하도록 낡은 코드 주석을 바로잡은 것으로, 새로운 Rationale 위반을 만들지 않았다. Rationale 연속성 관점에서 위반 사례는 발견되지 않았고, 유일한 INFO는 직전 라운드부터 이어지는 낮은 우선순위 항목(§5.4 신규 축의 비소급 면제가 spec 문언이 아니라 plan 문서의 유추라는 점을 spec 에 한 줄 명문화하면 좋겠다는 제안)이다.

## 위험도
NONE
