# Rationale 연속성 검토 — spec/5-system (impl-done)

## 검토 조건
- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- scope(`spec/5-system`) 델타: **0개 파일** — 이 브랜치는 spec 을 바꾸지 않았다. 코드 전용 PR 이므로 정상이며, 그 자체로 CRITICAL 근거 아님.
- 구현 diff: 30개 파일 / 2003줄 (schedules/triggers 응답 DTO·서비스·컨트롤러, `response-contract.ts`, `swagger-dto-contract-guard.ts`, 다수 e2e-spec 에 계약 대조 배선).
- 코드는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`, 현재 세션 CWD 와 동일)에서 `git diff origin/main...HEAD` 로 직접 확인했다.

## 발견사항

없음. 이번 diff 는 `spec/5-system/2-api-convention.md` §5.4(부재 표현 `null` vs 키 생략)와 `spec/conventions/secret-store.md` §1.1/§5.5(SS-SE-01)의 기존 Rationale 을 **위반하지 않고 오히려 그 원칙을 확장 적용**한다. 세부 대조:

- **§5.4 기본형/키 생략형 선택 기준**: `IntegrationDto`·`KnowledgeBaseDto`·`AlertRuleDto`·`TriggerDto` 에 새로 선언된 필드(예: `appUrl`, `mallId`, `documentCount`, `chatChannelHealth` 등)는 전부 "엔티티 컬럼이라 상시 존재" 근거로 `@ApiProperty({ nullable: true })` 기본형을 썼다 — §5.4 규칙과 일치. `ScheduleDto.trigger`/`TriggerDto.workflow` 의 키 생략형(`@ApiPropertyOptional`)도 "생성 경로에서는 관계가 로드되지 않는다"는 근거를 코드 주석에 명시해 §5.4 의 "그 필드를 문서화하는 절에 사유를 명시" 요구를 충족한다(코드 JSDoc 이 사유의 소재지인 것은 §5.4 "검증 층" 절이 이미 "판정 규칙의 상세 표는 코드의 JSDoc 이 단일 진실" 이라고 명시해 정합적이다).
- **§5.4 가 금지하는 `@ApiPropertyOptional({nullable:true})` + `field?: T|null` 조합**: 이 PR 의 diff 안에서 이 금지 조합을 새로 쓴 필드는 없다(전부 `@ApiProperty(...)` 기본형). CHANGELOG(`Unreleased — 트리거 회전 secret...`)는 오히려 "이 커밋의 첫 판이 그 실수를 했다가 같은 PR 안에서 자체 발견·정정했다"고 기록하고, `swagger-dto-contract-guard.ts` 에 그 조합을 잡는 **세 번째 정적 축**(`findOptionalNullableResponseFields`)을 신설해 기존 두 검증자의 사각지대를 좁혔다 — §5.4 "검증 층" 절이 요구하는 "선언과 실제가 같아야 한다"는 취지를 강화하는 방향이며 기존 결정을 뒤집지 않는다.
- **`allowMissing` 신설(`response-contract.ts`)**: JSDoc 이 스스로 "정당한 용례는 spec 본문에 Planned 로 이미 적힌 갭뿐" 이라 제한을 걸었고, 실제 유일한 사용처(`workflow-crud.e2e-spec.ts` 의 `formatVersion`)는 `spec/2-navigation/1-workflow-list.md:153` 의 기존 "포맷 버전 협상은 미구현 (Planned)" 서술을 정확히 인용한다(확인함) — 근거 날조 없음.
- **트리거/스케줄 secret 유출 수정** (`notificationSecretV2`·`chatChannelTokenV2`·`config.interaction.triggerToken` strip): `secret-store.md §1.1`·§5.5(SS-SE-01)이 이미 정한 "응답 노출 금지" 원칙을 그대로 적용해 누락된 두 표면(컬럼 유출·스케줄 조인 유출)을 닫은 것이다 — 새 원칙 도입이 아니라 기존 원칙의 미적용 구멍을 메운 것.
- **`sanitizeChatChannelForResponse` → `sanitizeForResponse` 리네임**: 어떤 spec 문서도 이 메서드명을 직접 인용하지 않아(grep 확인) 문서-코드 drift 없음.
- **`§5.3 410 기본값 없음`·`§10.4 재연결 위임`·`비-페이징 {data:{items}} 유지`·`conversationThread 키 생략`** 등 이번 세션에 새로 추가된 Rationale 항목들은 이번 diff 의 코드 변경 범위(schedules/triggers 응답 계약, secret strip)와 겹치지 않는다 — 충돌 여지 없음.

## 요약
이 PR 은 `spec/5-system` 을 전혀 수정하지 않았고(델타 0), 구현 변경은 §5.4(부재 표현 선언 규칙)와 secret-store §1.1/§5.5 의 기존 합의를 위반하는 대신 **그 적용 범위를 넓히고 사각지대를 검증자로 메우는** 방향이다. PR 자체 내에서 한 차례 §5.4 금지 조합(`ApiPropertyOptional`+`nullable:true`)을 실수로 도입했으나, 같은 PR 안에서 자체 발견해 정정하고 회귀 방지용 정적 가드까지 추가했다는 이력이 코드 주석·CHANGELOG 에 정직하게 남아 있어, 오히려 "결정 번복 시 새 Rationale 동반" 원칙을 잘 지킨 사례로 판단한다. Rationale 연속성 관점에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도
NONE
