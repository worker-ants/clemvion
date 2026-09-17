# Cross-Spec 일관성 검토 — 트리거 자원 정리 계약 draft

> 번들(`_prompts/cross_spec.md`)의 `spec_impact` 대상 문서 다수가 컨텍스트 예산 초과로 절단되어 있어,
> 판정은 번들이 아니라 `spec/**` 실제 파일(`1-data-model.md` · `2-navigation/1-workflow-list.md` ·
> `2-navigation/2-trigger-list.md` · `data-flow/10-triggers.md` · `data-flow/11-workflow.md` ·
> `data-flow/12-workspace.md` · `conventions/secret-store.md` · `conventions/audit-actions.md` ·
> `5-system/14-external-interaction-api.md` · `5-system/15-chat-channel.md` · migrations)을 직접 Read 해
> 수행했다.

## 발견사항

- **[WARNING]** `secret-store.md §5.3` 의 제목이 "전수 정정" 주장과 어긋나게 여전히 트리거 한 경로만 가리킨다
  - target 위치: draft `S10` — "§5.3 예시 — 순서를 뒤집는다"
  - 충돌 대상: `spec/conventions/secret-store.md` §5.3 헤딩 (`### 5.3 Trigger 삭제 시 — prefix 일괄 삭제`, 라인 331) 및 draft 자신의 Rationale "1차안은 같은 병을 문서 단위로 앓았다 … 이 개정판은 `secret-store.md` 안에서 «트리거 삭제» 를 주어로 삼은 자리를 **전수**(§2.1 표 · §5.3 예시 · §6 두 문단 · §R4)로 고친다"
  - 상세: `grep`으로 `secret-store.md` 안의 "Trigger 삭제"/"트리거 삭제" 주어 자리를 세면 §2.1 표(147행) · §5.3 헤딩(331행) · §6 헤딩+본문(388·390행) · §R4(428행) 넷이다. draft `S9`/`S10`은 §2.1 표 행, §6 헤딩("트리거 행이 없어질 때 cascade"로 개명) + 본문 두 문단, §R4 본문을 명시적으로 넓히지만, **§5.3 헤딩 문자열 자체는 그대로 "Trigger 삭제 시" 로 남는다** — 아래 코드 예시(`removeTrigger()`)의 주석은 일반화됐어도 절 제목은 여전히 "이 정리는 트리거 삭제에만 해당한다"고 읽힌다. 이는 1차 `--spec` 이 지적한 것과 같은 클래스의 결함(규칙은 넓혔는데 같은 문서 안 일부 자리가 좁게 남음)이 §5.3 하나에 재발한 것이다. §2.1/§6/§R4 가 이미 규칙을 넓혀 두어 전체 문서를 읽으면 오독 위험은 낮지만("전수" 주장 자체가 거짓이 된다는 점에서), §5.3 만 발췌 인용될 경우(예: 코드 리뷰가 이 절만 링크) 오독 가능성이 남는다.
  - 제안: §5.3 헤딩을 "5.3 트리거 행이 없어질 때 — prefix 일괄 삭제 (트리거 화면 삭제 예시)" 등으로 넓히거나, 헤딩 아래에 "이 예시는 트리거 직접 삭제 코드이며, 스케줄·워크플로·워크스페이스 삭제도 같은 규칙(§2.1/§R4)을 따른다"는 한 줄을 추가한다. 또는 Rationale 의 "전수" 표현을 "§5.3 헤딩 제외 전수"로 정정한다.

- **[WARNING]** 워크플로 삭제의 신규 트랜잭션·행 잠금 메커니즘이 `data-flow/11-workflow.md` 에는 워크스페이스(S7)와 대칭적으로 문서화되지 않는다
  - target 위치: draft `D6` ("워크플로 삭제는 지금 명시 트랜잭션도 행 잠금도 없으므로 둘 다 새로 둔다") 및 `S6` ("`spec/data-flow/11-workflow.md §3.1` — FK 파급 표의 `trigger` 행 끝에 덧붙임")
  - 충돌 대상: `spec/data-flow/12-workspace.md` §1.10 + §2.1 (draft `S7`), 그리고 `spec/data-flow/11-workflow.md` §2.1 "Schema 매핑"(라인 145-165, `workflow` sink 의 생성·복제·활성 토글·버전 커밋 행만 있고 **삭제 행 자체가 없음**)
  - 상세: `D6`은 워크플로·워크스페이스 삭제 둘 다에 "부모 행을 잠근 뒤 같은 트랜잭션에서 트리거를 열거"하는 **동일한 새 메커니즘**을 요구한다고 명시한다. 그런데 `변경안`에서 워크스페이스 쪽(`S7`)은 §1.10(액션 표, "트랜잭션 전에 외부 자원 해제 → 워크스페이스 row 를 잠근 뒤 같은 트랜잭션에서 트리거 열거 → 커밋 뒤 secret 삭제") 과 §2.1(Postgres 매핑 표에 신규 `secret_store` 행) **양쪽**에 명시적으로 기록되는 반면, 워크플로 쪽(`S6`)은 §3.1 FK 파급 표의 `trigger` 행 끝에 "정리는 이 CASCADE 앞뒤로 앱이 한다 — 미구현 (Planned)" 한 줄만 덧붙인다. 워크플로는 원래 §2.1(Schema 매핑) 에 "삭제" sink 자체가 없어(생성·복제·토글·버전 커밋만 있음) `D6`이 요구하는 "새 트랜잭션 + `workflow` row 잠금 + 트리거 열거"라는 구체적 메커니즘이 `data-flow/11-workflow.md` 어디에도 정식으로 자리 잡지 못한다. 트리거 목록 `§4.3`(draft `S2`)이 "워크플로·워크스페이스 삭제는 … 부모 행을 잠근 뒤 같은 트랜잭션에서 열거한다"고 일반 규칙으로 적어 SoT 노릇을 하므로 치명적 모순은 아니지만, `data-flow/11-workflow.md` 만 단독으로 읽으면 워크플로 삭제에 새 트랜잭션/락이 생긴다는 사실이 드러나지 않아 — 같은 결정이 적용되는 두 자매 문서의 상세도가 비대칭이다.
  - 제안: `S6`에 `data-flow/11-workflow.md §2.1`(Schema 매핑) 신규 "workflow | 삭제 | 트랜잭션 + `pessimistic_write` 행 잠금 + 트리거 enumerate — 미구현 (Planned)" 행을 추가해 `S7`과 대칭을 맞추거나, 비대칭이 의도적이라면(예: §2.1 에 원래 "삭제" sink 자체가 없어 신설 자체가 스코프 밖) Rationale 에 그 이유를 한 줄 남긴다.

- **[INFO]** 지연된 `secret_store` 정리(D4/D6, 커밋 뒤)가 향후 audit 로깅을 추가할 경우 `workspace_id` FK 함정을 밟을 수 있다
  - target 위치: draft `D4`/`D6`/`D7` 창3 (행 삭제 커밋과 비밀 정리 사이의 시점차)
  - 충돌 대상: `spec/data-flow/12-workspace.md` Rationale "`workspace.deleted` 감사 제외 (구조적 제약)" — "삭제 후 기록하면 FK 대상이 사라져 INSERT 가 위반된다"
  - 상세: 이미 문서화된 구조적 제약에 따르면 `audit_log.workspace_id` 는 `workspace(id)` 에 `ON DELETE CASCADE` FK 를 가지므로, 워크스페이스 삭제 커밋 **이후** 그 `workspace_id` 를 참조하는 어떤 `audit_log` INSERT 도 FK 위반으로 실패한다. draft 의 `secret_store` 정리 자체는 `secret_store` 에 FK 가 없어(V063) 이 함정에 걸리지 않지만(직접 충돌은 아님), T2(개발 트래커 신설 항목)가 이 지연 정리 단계에 감사 로그(예: "정리 완료" 기록)를 추가하고 그 로그가 이미 삭제된 `workspace_id` 를 참조하면 같은 함정에 빠진다. draft 는 이 단계에 대해 audit 를 언급하지 않으므로 지금 당장의 모순은 아니다.
  - 제안: T2 구현 노트(또는 이 draft의 D7 창3 설명)에 "이 지연 정리 단계는 `workspace_id` 를 참조하는 audit 를 남기지 않는다(또는 `resource_id`/`trigger_id` 기준으로만 남긴다)"는 한 줄을 추가해 향후 구현자가 이 구조적 제약을 재발견하는 비용을 줄인다.

## 검증하여 충돌 없음을 확인한 주요 항목 (기록)

- `spec/1-data-model.md:791` / `spec/conventions/secret-store.md:428` 의 `TriggersService.delete()` (존재하지 않는 메서드) — draft `S8`/`S9`이 정확히 이 두 곳만 겨냥하며, `V063` 마이그레이션 주석의 세 번째 자리는 의도적으로 비대상 처리(T3) — 전수 일치 확인(`grep` 결과 2곳 + migration 주석 1곳, 총 3곳 모두 계정됨).
- `spec/2-navigation/1-workflow-list.md:108` "연결된 트리거/스케줄도 함께 **비활성화**" — `trigger.workflow_id NOT NULL … ON DELETE CASCADE`(`V001` 확인)와 모순되며, 같은 주장을 하는 다른 spec 자리는 repo 전체에 0건(`grep` 확인) — draft `S1`의 단독 수정으로 충분.
- `spec/2-navigation/2-trigger-list.md §3/§4.3/§4.4` 의 현재 문면이 draft의 실측 인용과 정확히 일치 — draft `S2`~`S4`의 삽입 위치(§4.3 표 뒤, §4.4 불릿 교체, §3 불릿 뒤)가 실제 문서 구조와 충돌 없이 들어맞는다.
- `spec/data-flow/10-triggers.md §1.4` 표(3열: 이벤트/Schedule/Trigger)에 draft `S5`가 추가하는 신규 행의 열 구성이 기존 행들과 정확히 대응.
- `spec/data-flow/11-workflow.md §3.1` FK 파급 표에 이미 `trigger` 행이 있고(CASCADE, 락 미경유 서술 포함) draft `S6`은 그 행 끝에 덧붙이는 형태 — 표 구조와 충돌 없음.
- `spec/data-flow/12-workspace.md §1.10/§2.1` 현재 문면이 draft 실측 인용과 정확히 일치, draft `S7`의 삽입 위치도 자연스럽다.
- `spec/conventions/audit-actions.md` 레지스트리의 `trigger.deleted`(구현)·`workspace.deleted`(구조적 제외)·"짝 리소스는 호출된 엔드포인트 쪽만 기록"이라는 기존 원칙이 draft `D2`의 "CASCADE 삭제는 `trigger.deleted` 를 새로 만들지 않는다"는 판단과 상충하지 않는다.
- `spec/5-system/15-chat-channel.md` `CCH-AD-03`("Trigger disable/삭제 시 teardownChannel() 자동 호출")은 정리 시점(비밀 vs 외부 자원, 커밋 전/후)을 규정하지 않으므로 draft가 이를 "비대상"으로 판정한 것은 타당 — 요구사항 문면과 새 규칙 사이에 직접 모순 없음.
- `spec/5-system/14-external-interaction-api.md §7.1`, `EIA-AU-07`, `data-flow/15-external-interaction.md`의 `Trigger.config.interaction.triggerToken` 관련 서술("trigger 삭제 시 소멸")은 JSONB 필드가 행과 함께 사라지는 것이라 4경로 모두 자동으로 성립 — 새 규칙과 무관하며 충돌 없음.
- `secret-store.md §1/§1.1/§2/§3.4` (URI scheme, 응답 비노출, `SecretResolver` 인터페이스, 백엔드 swap 근거) — draft가 인용하는 근거(§3.4 인터페이스 추상화, 워크스페이스 단위 삭제 미지원)가 실제 원문과 정확히 일치.
- `secret-store.md §6` 제목 앵커(`#6-trigger-삭제-시-cascade`)를 인용하는 자리가 `spec/`·`codebase/`·`plan/` 전체에 0건이라는 draft의 주장을 `grep`으로 재확인 — 제목 변경(S10)이 깨는 링크 없음.
- `V001__initial_schema.sql` 의 `trigger.workspace_id`/`trigger.workflow_id` 둘 다 `ON DELETE CASCADE` — data-model·trigger-list·data-flow 세 문서의 서술이 마이그레이션과 정확히 일치.

## 요약

이 draft는 1차 `--spec` 이 지적한 두 CRITICAL(같은 문서 안 부분 수정으로 인한 자기모순, 미뤄 둔 원자성 항목과의 인용 없는 충돌)을 대체로 해소했다. `secret-store.md`, `1-data-model.md`, `2-navigation/{1-workflow-list,2-trigger-list}.md`, `data-flow/{10-triggers,11-workflow,12-workspace}.md`, `conventions/audit-actions.md`, `5-system/{14-external-interaction-api,15-chat-channel}.md`, 그리고 `V001__initial_schema.sql`을 직접 대조한 결과, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 차원에서 새로운 CRITICAL 충돌은 발견되지 않았다. 다만 (1) `secret-store.md §5.3` 헤딩이 "전수 정정" 주장에도 불구하고 여전히 트리거 단일 경로만 가리키는 잔여 좁은 표기, (2) 워크플로·워크스페이스라는 대칭적인 두 CASCADE 삭제 경로 중 워크스페이스 쪽(`data-flow/12-workspace.md`)만 새 트랜잭션/락 메커니즘이 정식 문서화되고 워크플로 쪽(`data-flow/11-workflow.md`)은 한 줄 pointer 로 남는 비대칭이 있어, 두 건 모두 WARNING으로 기록한다. 지연된 secret 정리 단계와 기존에 문서화된 `audit_log.workspace_id` CASCADE FK 제약의 상호작용은 현재는 충돌하지 않지만 향후 구현 시 재발 가능한 함정이라 INFO로 남긴다.

## 위험도

LOW
