# RESOLUTION — `review/consistency/2026/09/05/21_40_38`

**BLOCK: NO** · Critical **0** · WARNING **2** · INFO **4**. **조치 완료.**

`rationale_continuity`·`plan_coherence`·`naming_collision` 이 전부 NONE 이고, 직전 라운드들의
WARNING 이 해소 확인됐다.

## WARNING 조치

| # | 지적 | 조치 |
|---|---|---|
| 1 | `ScheduleDto.trigger` 를 키 생략형으로 선언했는데 data model 은 NOT NULL 1:1 이고 실측 호출부가 전부 채운다. §5.4 는 키 생략형에 **사유 문서화**를 요구하는데 그것도 없다 | **기본형으로 정정** + `workflow` 사유 명시 |
| 2 | `secret-store.md §1` 의 *"노출 창이 아직 닫혀 있지 않다"* 가 이 PR 로 stale 화된다 | **planner 후속 등재** (spec 쓰기) |

### W1 — 엔티티 타입이 답을 갖고 있었다

`Schedule.trigger` 는 엔티티에서 **non-optional**(`trigger: Trigger`)이고 `trigger_id` 는
NOT NULL 이다. 응답을 내는 네 경로가 전부 채운다 — `findAll`(join) · `findById`(relations) ·
`create`/`update`(저장 직후 대입, 이번 PR 이 `isActive` 조건 밖으로 뺐다). e2e 가 네 곳을
각각 단언한다.

→ `@ApiProperty` 기본형으로 바꾸고, `toResponse` 의 방어 분기도 없앴다. 관계가 로드되지
않은 채 오면 `t.id` 에서 **즉시 터진다** — 조용히 키를 빠뜨리는 것보다 낫다.

`trigger.workflow` 는 반대다 — 생성·수정 경로에서 로드되지 않는 것을 e2e 가 실증했으므로
**키 생략형이 맞다**(§5.4 기준 (b)). 그 사유를 필드 JSDoc 에 적었고, spec 본문으로 옮기는
것은 planner 후속으로 등재했다.

### W2 — 내가 쓴 문장이 내 PR 로 낡는다

*"노출 창이 아직 닫혀 있지 않다"* 는 **직전 planner 턴에서 내가 쓴 현재형 서술**이고, 이
브랜치가 바로 그 창을 닫는다. 머지되는 순간 거짓이 된다. §7.1 이 쓴 "정정 이력" 패턴을
준용하도록 후속에 적었다 — **규범(§1.1)은 그대로 둔다**(닫혔다고 규범이 사라지지 않는다).

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | `ScheduleTriggerWorkflowRefDto` JSDoc 에 내부 서사 (2라운드째) | **조치 불요.** 클래스 JSDoc 이 공개 스키마로 승격되지 않음을 선행 라운드가 실측 확인했다 |
| 2 | 래칫 fixture 가 `code:` 밖 | **이미 등재** (planner 후속) |
| 3 | fixture 배치·접미사가 기존 관례와 다름 | **의도적** — 경로 술어(`/dto/responses/`)를 통과해야 한다. 그 이유를 fixture 상단에 적어 뒀다 |
| 4 | `ScheduleTriggerRefDto` 류가 저장소 최초 "narrowed reference DTO" | 관찰 — 두 번째가 나왔다(`TriggerWorkflowRefDto`, 같은 라운드의 코드 리뷰 W1). 세 번째면 명명 규칙 문서화 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint · unit · build | **PASS** |
| e2e | **PASS** — **296** 통과 |

## 보류·후속 항목

planner 후속 2건(§1 stale 서술 · `ScheduleDto` 필드 nav-spec 문서화)을 트래커에 등재했다.
