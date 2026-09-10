# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-trigger-canary-nav.md`

검토 모드: spec draft (`--spec`) · 대상 변경안: A(`2-trigger-list.md §3` 註 교체) · B(`2-trigger-list.md` `code:`) · C(`3-schedule.md` `code:` 확장) · D(`14-external-interaction-api.md §7.1` 인벤토리 보강)

## 발견사항

- **[WARNING]** D 가 고치는 문장의 쌍둥이가 `secret-store.md §1` 에도 있고, D 는 거기는 안 고친다
  - target 위치: 변경안 D (`14-external-interaction-api.md §7.1`, 종전 `:934-936` 교체)
  - 충돌 대상: `spec/conventions/secret-store.md:69-72` (§1, `Trigger.notification_secret_v2` 비대상 등재 하단의 "정정 (2026-09-08)" 블록)
  - 상세: EIA §7.1 의 "종전" 문장과 `secret-store.md §1` 의 해당 블록은 **문구가 사실상 동일한 복사본**이다 — 둘 다 `#1291` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 인용하고 "스케줄 조인 축은 `shared/testing/schedule-trigger-ref.ts` 가 같은 목록으로 단언한다" 라고 **한 축만** 열거한다(실측: `grep -rn "schedule-trigger-ref.ts" spec/` → 이 두 자리뿐). D 는 EIA §7.1 쪽만 "두 축이 각각 같은 목록으로 부재를 단언한다 — 스케줄 조인 축은 `schedule-trigger-ref.ts`, 트리거 직접 축은 `trigger-workflow-ref.ts`" 로 보강하고, `secret-store.md` 쪽 사본은 그대로 둔다. D 자신이 적은 문제의식("열거가 불완전하면 다음 사람이 직접 축엔 정적 스트립만 있다고 읽는다")이 고쳐지지 않은 `secret-store.md` 쪽에는 그대로 남는다 — 즉 이 PR 이 끝나면 **같은 사실을 말하는 두 자리가 완전성 수준에서 갈라진다**(하나는 두 축 열거, 하나는 한 축만).
  - 제안: `secret-store.md §1` 의 해당 블록에도 동일하게 `trigger-workflow-ref.ts` 를 추가하거나, 최소한 "상세 인벤토리는 EIA §7.1 참조" 로 위임해 두 자리가 다시 갈라지지 않게 한다. `secret-store.md` 는 이 draft 의 `spec_impact` 에 없으므로 이번 PR 범위 밖이면 최소한 plan 에 후속으로 남겨야 한다(그렇지 않으면 "이미 처리됨" 으로 오인되기 쉬운 자리 — 같은 문구가 두 곳에 있다는 사실 자체가 다음 사람에게 안 보인다).

- **[INFO]** EIA §7.1 이 인용하는 두 헬퍼가 EIA 자신의 `code:` 에는 없다
  - target 위치: 변경안 D
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` (라인 6-24 부근, `trigger-workflow-ref*.ts`/`schedule-trigger-ref*.ts` 미등재)
  - 상세: §5.4 검증 층 절 자체가 "그 검증자는 양쪽 문서의 `code:` 에 모두 등재돼 있다 — 한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다" 는 원칙을 이미 명시했고(`2-api-convention.md`/`swagger.md` 가 `response-contract*.ts`/`swagger-probe*.ts`/`user-secret-absence*.ts` 를 양쪽 다 등재해 이 원칙을 실제로 지킨다), B/C 도 같은 원칙으로 헬퍼를 각 도메인 문서의 `code:` 에 추가한다. D 가 편집하는 EIA §7.1 문단은 이제 이 두 헬퍼를 "`notification_secret_v2` 가 응답에 안 나간다" 는 단언의 근거로 명시적으로 인용하는데, 정작 EIA 문서의 `code:` 는 둘 다 갖고 있지 않다(EIA `code:` 는 `triggers.service.ts`·`TRIGGER_RESPONSE_STRIP_COLUMNS` 도 갖고 있지 않다). 이는 D 이전부터 있던 gap이라 CRITICAL 은 아니지만, D 가 "인용을 늘리는" 방향으로 편집하면서 같은 논리를 자기 문서의 `code:` 에는 적용하지 않는 비대칭이 새로 두드러진다.
  - 제안: 이 PR 범위로 끌어들일 필요는 없으나, `spec_impact` 후속 메모에 "EIA `code:` 에 두 ref 헬퍼(또는 `triggers.service.ts`) 등재 검토" 를 남기는 편이 다음 사람의 추적성에 낫다.

## 점검 관점별 확인 결과

1. **데이터 모델 충돌** — 없음. A/B/C/D 모두 기존 `Trigger`/`TriggerDto`/`ScheduleDto` 필드 정의를 바꾸지 않는다. `TRIGGER_SECRET_COLUMNS = ['notificationSecretV2', 'chatChannelTokenV2']` 가 `trigger-workflow-ref.ts`·`schedule-trigger-ref.ts` 양쪽에서 실측상 동일함을 코드로 직접 확인했다(`codebase/backend/src/shared/testing/{trigger-workflow-ref,schedule-trigger-ref}.ts`) — D 의 "같은 목록으로 부재를 단언한다" 는 새 주장은 사실과 부합한다.
2. **API 계약 충돌** — 없음. §3(트리거)·§4(스케줄) 의 endpoint·응답 shape 서술은 이번 변경으로 바뀌지 않는다. A 가 다루는 것은 "언제 `workflow` 키가 붙는가" 에 대한 **테스트 커버리지 기술**이지 새 계약 도입이 아니다.
3. **요구사항 ID 충돌** — 없음. 신설 `R-17` (`2-trigger-list.md`) 은 해당 문서에서 미사용 ID이며(`R-1`~`R-16` 확인, `R-17` 중복 없음), 타 문서의 Rationale ID 와도 네임스페이스가 겹치지 않는다(Rationale ID 는 문서-local).
4. **상태 전이 충돌** — 해당 없음. 이번 변경은 상태 머신을 다루지 않는다.
5. **권한·RBAC 모델 충돌** — 해당 없음. A/B/C/D 는 RBAC 표·역할 게이트를 건드리지 않는다.
6. **계층 책임 충돌** — 없음. plan 이 스스로 "3번(`PROJECT.md`)은 developer 소유라 이 턴에서 처리하지 않는다" 고 정확히 갈랐고(`.claude/skills/developer/SKILL.md:33` vs `project-planner/SKILL.md` 경로표 실측), `spec/` 전용 변경만 이번 턴에 남겨 역할 경계를 지켰다.

## 핵심 검증 — "특히 봐 달라" 4항목

1. **A 의 신규 주장 "§5.4 는 어느 경로에서 생략되는가를 규정하지 않는다" — §5.4 원문과 대조**: 일치한다. `2-api-convention.md §5.4` 원문을 직접 읽었다 — 이 절이 규정하는 것은 (i) `null` vs 키 생략 중 **표현 선택 기준** ((a)/(b) 두 갈래 + "그 필드를 문서화하는 절에 사유를 명시") 과 (ii) 그 표현에 맞는 **DTO 선언 형태**(`@ApiPropertyOptional()` + `field?: T` vs `@ApiProperty({nullable:true})` + `field: T | null`) 뿐이다. "키 생략" 정의 자체가 "present-when-available — 값이 있을 때만 동봉" 이라 **어느 구체적 엔드포인트/분기에서 채우고 어디서 비우는가는 §5.4 소관이 아니라 구현 사실**이다. A 의 문장은 이 구조를 정확히 짚었고 CRITICAL 요소는 없다.
2. **A 가 교체하는 문단이 같은 blockquote 의 다른 두 문단(§5.4 판정 근거 · `id`/`name` 비대칭)을 훼손하는지**: 훼손하지 않는다. 실제 저장소 원문(`spec/2-navigation/2-trigger-list.md:174-186`)을 대조한 결과, draft 의 "종전" 인용은 4-문단 blockquote 중 **세 번째 문단의 뒷부분**("구현은 그 재조회에 …" 부터 끝까지)만이고, 앞의 "이 '생성 응답에만' 은 한 번 거짓이었다…" 도입부는 그대로 남는다. 두 번째 문단("(b) 의 판정 근거는 … 부재는 생성 응답에만 있고 … 채워진다")은 새 문장("PATCH 만 일반/chatChannel 두 케이스" = 부재는 생성에만)과 내용이 정합하고, 네 번째 문단(`id`/`name` 참조 비대칭)은 전혀 손대지 않는다. 두 문단 모두 훼손되지 않는다.
3. **D 의 새 열거가 `15-chat-channel.md`·`secret-store.md` 등 인접 문서와 충돌하는지**: `15-chat-channel.md` 와는 직접 충돌 없음(본문에 `TRIGGER_SECRET_COLUMNS`/두 ref 헬퍼를 언급하지 않아 접점이 없다). **`secret-store.md` 와는 충돌은 아니지만 완전성 비대칭이 새로 생긴다** — 위 WARNING 참조. 두 문서 다 "사실이 아닌 것"을 말하게 되지는 않지만(둘 다 여전히 참), D 편집 후 한쪽만 "두 축" 을 알고 다른 쪽은 "한 축" 만 아는 상태가 되어 D 자신이 경계한 실패 모드("열거가 불완전하면 다음 사람이 축이 하나뿐이라고 읽는다")가 `secret-store.md` 쪽에 그대로 재현된다.
4. **C 의 범위 확장이 다른 spec 의 `code:` 관례와 어긋나는지**: 어긋나지 않는다. `2-api-convention.md`(`:15-16,18`)와 `swagger.md`(`:10-11,13`)가 이미 동일한 `shared/testing/<name>*.ts` glob 패턴으로 검증자 헬퍼(소스+`.spec.ts`)를 `code:` 에 등재하는 선례이며, §5.4 자체가 "검증자는 양쪽 문서의 `code:` 에 모두 등재" 라는 원칙을 명문화했다. C 가 `schedule-trigger-ref*.ts` 를 `3-schedule.md` 의 `code:` 에 추가하는 것은 이 선례·원칙과 정확히 같은 패턴이고, 실측(`schedule-trigger.e2e-spec.ts:12` 의 `import { expectNarrowedScheduleTriggerRef } from '../src/shared/testing/schedule-trigger-ref'`)도 draft 의 근거와 일치한다. `spec-impl-evidence.md` 의 `code:` 글로브 가드(R-1, "글로브 허용")도 이런 확장을 제약하지 않는다. 트래커 범위를 넘는 것은 사실이지만 그 자체가 다른 spec 의 `code:` 관례와 충돌하는 것은 아니다 — 오히려 관례를 더 철저히 따르는 방향이다.

## 요약

이번 draft(A/B/C/D)는 `#1308` 착지 이후 `spec/` 쪽 잔여 5건 중 4건을 다룬다. 핵심 우려였던 "§5.4 원문과의 모순 가능성"(A)과 "인접 blockquote 훼손"(A)은 모두 실측 대조 결과 문제없음으로 확인됐다 — A 의 새 문장은 §5.4 가 실제로 규정하는 범위(표현 선택 기준 + DTO 선언 형태)를 정확히 벗어나지 않는 선에서 "어느 경로가 채우는가는 구현 사실" 이라고 말하고 있다. B/C 는 기존 `code:` glob 관례(§5.4 "양쪽 문서 등재" 원칙, `2-api-convention.md`/`swagger.md` 선례)와 부합하며 실제 import 관계로도 뒷받침된다. D 는 정확한 사실(두 ref 헬퍼가 같은 비밀 컬럼 목록을 단언한다)을 추가하지만, **같은 "종전" 문구의 쌍둥이가 `secret-store.md §1` 에도 있는데 그쪽은 고치지 않아** 두 문서 사이에 새로운 완전성 비대칭이 생긴다 — CRITICAL 은 아니지만 D 자신의 문제의식이 인접 문서에는 그대로 남는 WARNING 이다. 전체적으로 CRITICAL 급 cross-spec 모순은 발견되지 않았다.

## 위험도

LOW
