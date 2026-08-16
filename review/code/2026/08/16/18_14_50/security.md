# 보안 관점 리뷰 (최종 라운드)

> **이 파일은 main Claude 가 sub-agent 반환 전문으로 재영속화했다.** 해당 reviewer 는
> `output_file` 을 디스크에 남기지 못했다(worktree sub-agent write 격리). 내용 손실은 없다.

## 발견사항

- **[INFO]** `Trigger.config.interaction.triggerToken` 평문 저장을 "향후 검토" 에서 "영구 결정(비대상 예외)" 로 확정
  - 위치: `spec/conventions/secret-store.md` §1 (신규 블록, `AuthConfig.config` 비대상 절 바로 뒤) / `spec/5-system/14-external-interaction-api.md` (구 `:910` 불릿, "향후 secret store 통합 검토" 문구 교체)
  - 상세: 코드 자체는 변경되지 않았다(`triggers.service.ts:969` 의 평문 저장은 이 diff 이전부터 존재). 이번 diff 는 문서 문구를 "검토 예정" → "의식적으로 결정된 영구 예외" 로 승격한다. 근거 (a)(b)(c) 중 (a)("timing-safe 비교를 위해 평문이 필요")는 논리적으로 약하다 — 해시 저장 후 해시값끼리 timing-safe 비교(`crypto.timingSafeEqual`)해도 동일한 성능·타이밍 안전성을 얻을 수 있어, 평문 보관이 필수적인 이유는 아니다. 다만 (c)(서버 발급 랜덤 hex, 1회 노출, 유출 영향 범위가 해당 트리거로 국한)가 실질적 완화 요인이고, 문서 자체가 "이 예외를 다른 필드에 원용하지 말라"는 캐비엇을 명시해 스코프 확산을 스스로 차단하고 있다. `plan/in-progress/eia-internal-rest-error-masking.md` 를 보면 이 결정은 사용자가 직접 재가한 것으로 기록돼 있다.
  - 제안: 코드 변경이 아니므로 이번 PR 을 막을 사유는 아니다. 다만 향후 별도 항목으로 "해시 저장 + timing-safe 비교" 전환을 재검토할 가치가 있다는 점만 기록해 둔다.
  - **조치(main)**: 지적이 옳다. 근거 (a) 를 *"비용 근거이지 필요성 근거가 아니다"* 로 정정하고 **반례(해시 + `timingSafeEqual`)를 명시**했으며, 이 예외를 지탱하는 실질 근거가 (c) 임을 못박았다. spec-only 편집이라 리뷰 게이트(`codebase/**` 스코프)를 재발화시키지 않는다.

- **[INFO]** 이번 diff 는 신규 취약점이 아니라 기존 CWE-209(정보 노출을 통한 자격증명 유출) 를 닫는 보안 수정
  - 위치: `executions.service.ts` `toResponseExecution`/`toExecutionDto`/`findById`(NodeExecution 마스킹) · `background-runs.service.ts` `toNodeExecutionDto` · 신규 `shared/utils/redact-stored-error.ts`
  - 상세: `GET /api/executions/:id`(및 `chain`/`stop`/목록/`re-run`/WS `execution.snapshot`/`background-runs/:id`)가 저장된 `Execution.error`/`NodeExecution.error` 원문(자격증명 부분문자열 포함 가능)을 그대로 내보내던 것을, egress 시점에 `deepRedactSecrets` 위임으로 마스킹한다. WS 경로가 `ExecutionsService.findById` 를 재사용함을 `websocket.gateway.ts` 소스로 직접 확인했고, `NodeExecution.error`(§2.14 "복사" 관계로 인한 형제 필드 우회)까지 함께 덮는 것도 확인했다. DB 원문은 보존되고(egress-only), 마스킹 함수는 입력을 변이하지 않는 순수 복사본 반환이다.
  - 제안: 조치 불필요. 확인 완료.

- **[INFO]** `GET /api/executions/:id`·`/chain`·목록·`GET /background-runs/:id` 에 `@Roles` 게이트가 없음은 기존 설계이며 이번 diff 가 신규로 만든 것도 악화시킨 것도 아님
  - 위치: `executions.controller.ts:63`·`:293` / `background-runs.controller.ts:24` — 실제 소스 확인, `@Roles` 부재
  - 상세: `spec/2-navigation/14-execution-history.md` R-5 가 이미 이 설계를 문서화했고, 이번 diff 는 오히려 인가 부재를 보완하는 값 마스킹 통제를 추가하는 방향이다. spec 자신이 "R-5 를 과대인용하지 말 것" 캐비엇을 명시해 향후 "이미 안전하니 `@Roles` 불필요" 로 오독될 위험을 차단한다.
  - 제안: 조치 불필요.

- **[INFO]** 잔여 노출 표면(트래커에 이미 등재, 이번 PR 범위 밖) 확인
  - 위치: WS `execution.node.*` emit 의 `error` · `inputData`/`outputData` · `explore-tools.service.ts:464,484`
  - 상세: 확장 시도(값-패턴 마스킹 단순 합성)가 기존 `****9876` 접미 힌트 테스트를 깨뜨려 되돌린 이력이 `RESOLUTION.md`(`17_12_34`)에 실측 근거와 함께 기록돼 있다. 정본 트래커(spec §R17 "잔여" 불릿)에 이름과 함께 명시적으로 남아 있어 조용히 누락된 상태가 아니다.
  - 제안: 조치 불필요(별건).

## 요약

실질 코드 변경은 신규 leaf 유틸 `redact-stored-error.ts` 와 그 소비처로 국한되며, 파라미터화 쿼리·트랜잭션 경계·의존성·인증/인가 로직을 건드리지 않는다. 핵심은 종결(WS/SSE/webhook) 이벤트에만 걸려 있던 자격증명 값-패턴 마스킹을, `@Roles` 게이트가 없어 워크스페이스 멤버 전원이 접근 가능한 내부 REST 읽기 경로(및 WS `execution.snapshot`)까지 확장해 기존 CWE-209 급 정보 노출을 닫는 보안 수정이다. `Execution.error` 뿐 아니라 데이터 모델상 "복사" 관계인 `NodeExecution.error`(형제 필드 우회)까지 포함했고, DB 원문 보존·입력 비변이·null 정규화·copy-on-change 보존이 신규 유닛 테스트(캐너리 포함)로 회귀 고정돼 있다. 신규 인젝션·하드코딩 시크릿·안전하지 않은 암호화는 발견되지 않았다.

## 위험도

NONE
