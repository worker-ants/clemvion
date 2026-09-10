# Rationale 연속성 검토 — `spec-draft-integration-dto-pointer.md`

## 검토 범위

target: `plan/in-progress/spec-draft-integration-dto-pointer.md` (`4-integration.md §9.1` `GET /:id` 행에 §2.10 포인터 + 경계 문장 + `consecutiveNetworkFailures` 캐비엇을 추가하는 planner 턴 draft).

대조한 Rationale: `spec/1-data-model.md ## Rationale`(특히 "install_token 형식", `User` 방어 항), `spec/2-navigation/4-integration.md ## Rationale`(특히 "자동 갱신 통합을 attention 술어에서 제외", "Cafe24 App URL 상세 페이지 표시", "alert_rule 을 §2.25 로 등재"[`1-data-model.md`], "WorkflowVersion.snapshot 구성 서술 정정"[`1-data-model.md`]). 그 외 번들에 포함된 `0-overview.md`·`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` Rationale 은 target 과 직접 접점 없음(교차 확인만 수행).

실제 코드(`codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 145~172행) 와 `spec/1-data-model.md §2.10`, `spec/2-navigation/4-integration.md §9.1`(현재 원문), `plan/in-progress/spec-draft-nullable-notation-followups.md`(원출처 트래커 항목 · `consecutiveNetworkFailures` 노출-중단 검토 항목)를 직접 열어 target 의 사실 주장(5필드 위치·FE 참조 0곳·§2.10 5/5 보유)을 대조 — 전부 일치.

## 발견사항

- **[WARNING]** 새 경계 문장의 "왜" 서술이 spec 의 `## Rationale` 이 아니라 plan draft 에만 남는다
  - target 위치: `plan/in-progress/spec-draft-integration-dto-pointer.md` §"왜 'derived 는 위 둘뿐이고' 를 앞세우나" / §"왜 §2.10 을 복제하지 않나" / §"왜 §9.4 가 아닌가" / §"캐비엇을 §9.1 에 두는 것의 비용" (35~121행), 체크리스트 128행("`§9.1` `GET /:id` 행에 경계 + 포인터 + 캐비엇")
  - 과거 결정 출처: `spec/2-navigation/4-integration.md ## Rationale` 의 "Cafe24 App URL 상세 페이지 표시" 항(646~650행) — 거의 동형 결정(§9.1 에 `appUrl` derived 필드를 추가하면서 "왜 `install_token` 을 별도 필드로 안 두는가"를 Rationale 에 명문화)과 "연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식" 항의 "**§9.1 표 비고에 명시한 이유**" 문단(402행) — "이 규모면 별도 절 대신 표 비고 + Rationale 한 항"이라는 배치 판단 자체를 Rationale 로 남기는 것이 이 문서의 일관된 관례다
  - 상세: target 이 처방하는 변경(§9.1 GET /:id 행에 경계 문장 + 포인터 + 캐비엇 추가) 은 사소한 오탈자 수정이 아니라, "왜 derived 주장을 좁히는지" · "왜 §2.10 을 복제하지 않는지" · "왜 §9.4 가 아닌지" · "캐비엇 유지 비용을 감수하는 이유" 등 **결정의 배경·근거**를 담고 있다. 이 정보는 CLAUDE.md 의 "정보 저장 위치" 표가 명시하는 SoT 위치("결정의 배경·근거" → "해당 spec 문서 끝의 `## Rationale`") 이자, `4-integration.md` 자신의 Rationale 절이 유사 규모의 모든 결정(§9.1 derived 필드 추가 2건, §9.1 비고 배치 판단 1건)에 대해 실제로 지켜온 관례다. target 의 체크리스트에는 `4-integration.md`에 새 `## Rationale` 항목을 추가하는 항목이 없다 — plan 문서(`plan/in-progress/...`)는 완료 후 `plan/complete/`로 이동해 정보 성격이 "작업 추적"으로 바뀌고, spec Rationale 만큼 "다음 검토자가 §9.1 을 볼 때 자동으로 마주치는" SoT 위치가 아니다. 이 상태로 커밋되면, 다음에 §9.1 문구를 다시 손대려는 사람(예: `consecutiveNetworkFailures` 제거 시)이 "왜 이 경계 문장이 이 형태인지"를 spec 안에서 찾지 못하고 plan 히스토리를 뒤져야 한다.
  - 제안: `4-integration.md ## Rationale` 에 (예) "IntegrationDto §9.1 derived-필드 주장 경계 명시" 소제목으로 짧은 항목을 추가 — target 문서의 "왜 앞세우나" / "왜 복제 안 하나" / "왜 §9.4 아닌가" 3문단을 요약해 옮기고, `consecutiveNetworkFailures` 캐비엇의 유지 비용(제거 시 §9.1 문장도 동반 삭제) 을 명시한다. 이는 이미 체크리스트 130행의 "자매 트래커 보강" 항목과 짝을 이루는 자연스러운 추가 항목이며, 새 결정을 만드는 것이 아니라 이미 target 이 써 놓은 근거를 SoT 위치로 옮기는 것이라 비용이 낮다.

## 확인했으나 문제 없음으로 판정한 항목 (참고)

- **기각된 대안 재도입 여부**: 없음. target 이 §2.10 에 필드를 복제하지 않고 포인터로 가리키는 접근은 오히려 `1-data-model.md ## Rationale`("alert_rule 을 §2.25 로 등재" — "컬럼이 어딘가엔 적혀 있다는 것은 SoT 아니다"·"WorkflowVersion.snapshot" — "중복 서술하지 않고 가리키기만 한다")가 세운 **단일 SoT·비-복제** 원칙을 그대로 따른다.
- **합의된 원칙 위반 여부**: 없음. `spec/1-data-model.md §2.10` 말미의 "**응답 DTO 전용 derived 필드**" 문단이 이미 "`autoRefresh` 는 §2.10 표 밖의 API 전용 필드이며 정의는 §9.1 이 SoT" 라는 **상호 포인터 구조**를 선언하고 있다. target 이 제안하는 "derived 둘은 §9.1 소유, 나머지 다섯은 §2.10 소유" 분리는 이 기존 구조와 대칭이며 새 원칙이 아니라 기존 분업의 연장이다.
- **결정의 무근거 번복 여부**: 없음. target 은 §9.1 의 기존 문장("다음 두 derived 필드를 포함한다")을 삭제·반박하지 않고 **참인 문장으로 유지**한 채 그 뒤에 경계를 추가한다(100~102행에서 스스로 이 점을 명시). `consecutiveNetworkFailures` 캐비엇도 이미 코드 주석(`integration-response.dto.ts` 165~171행)과 `spec-draft-nullable-notation-followups.md`(1264~1267행)에 있는 "FE 미소비·제거는 별도 트래커" 결정을 그대로 재진술할 뿐 새 결정을 만들지 않는다.
- **암묵적 가정 충돌 여부**: 없음. `consecutiveNetworkFailures` 를 "health 판정의 내부 카운터"로 묘사하는 것은 `spec/2-navigation/4-integration.md ## Rationale` 의 "연결 테스트 endpoint 를 `/store` 에서 `/apps` 로 전환" 항의 "**transport 실패 카운터 제외**" 단락 및 `spec/1-data-model.md §2.10` 의 `consecutive_network_failures` 행 서술과 정확히 일치한다. `spec/5-system/2-api-convention.md §5.4` 의 null-vs-키생략 규칙과도 무관(target 은 이 필드의 wire 표현을 바꾸지 않는다).
- **사실 정합성**: `origin/main`(`5873b9678`) 기준 5필드가 `integration-response.dto.ts` 145~172행에 실재, `1-data-model.md §2.10` 이 5/5 를 보유, `consecutiveNetworkFailures` 코드 주석이 "FE 미참조·wire 변경이라 별도 트래커" 를 이미 명시 — target 의 재측정 결과와 전부 일치.

## 요약

target 은 §9.1 의 참인 문장("두 derived 필드")을 지우지 않고 그 뒤에 경계·포인터·캐비엇을 덧붙이는 좁은 편집이며, `1-data-model.md`·`4-integration.md` 양쪽 Rationale 이 이미 세운 "단일 SoT + 상호 포인터, 복제 금지" 원칙을 위반 없이 따르고 있다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회는 발견되지 않았다. 다만 target 문서 자체가 담고 있는 풍부한 "왜" 서술(derived 경계를 앞세우는 이유·§2.10 비복제 이유·§9.4 아닌 이유·캐비엇 유지 비용)이 이 저장소가 `4-integration.md ## Rationale`에서 유사 규모 결정마다 지켜온 관례(예: "Cafe24 App URL 상세 페이지 표시", "§9.1 표 비고에 명시한 이유")를 따르지 않고 plan draft 에만 남을 위험이 있어, 이를 WARNING 으로 기록한다.

## 위험도

LOW
