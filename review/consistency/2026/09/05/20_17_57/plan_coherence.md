# Plan 정합성 Check — `spec-draft-notification-secret-storage.md`

## 발견사항

- **[WARNING]** "트리거 시크릿 유출" 후속과 "§5.4 drift 배치 2단계" 후속이 같은 대상(TriggerDto·ScheduleDto)을 겨냥하는데 상호 참조가 없다 — 후자가 §1.1 을 위반하는 방향으로 "해소"될 위험
  - target 위치: `spec/conventions/secret-store.md §1.1`(신설, "비대상 등재는 저장 위치 예외이지 노출 예외가 아니다" — `notification_secret_v2`·`chat_channel_token_v2` 는 응답 DTO 에 선언되어서도 안 된다)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:615`("트리거 회전 secret 이 응답에 나간다 — 유출 차단 코드") 및 같은 파일 `:331`("§5.4 drift 배치 — 2단계: 검증자가 없는 응답 DTO 78곳")
  - 상세: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 의 `TriggerDto` 는 이미 §5.4 관련 필드(`nullable:true` 5개)를 가진 정식 DTO이고 `notificationSecretV2`/`chatChannelTokenV2` 를 선언하지 않는다. 컨트롤러(`triggers.controller.ts:78` `findOne`)는 이 DTO 로 응답을 캐스팅하지 않고 엔티티를 그대로 반환하므로, `:331` 항목("§5.4 drift 배치 2단계")이 언젠가 `TriggerDto`/`ScheduleDto` 를 `response-contract.ts` 에 배선하면 지금 이 draft 가 찾은 것과 **같은 leak** 이 "스키마에 없는 키" 위반(RED)으로 그대로 재현된다. `:331` 항목 자체가 "RED 가 나면 DTO 를 고칠지 코드를 고칠지 건별 판단" 이라고 적어 두었는데, 그 판단 지점에 `:615`/`secret-store.md §1.1` 을 참조하라는 caveat 이 없다 — 담당자가 "DTO 에 필드를 추가해 맞춘다" 를 고르면 이번에 막 세운 §1.1(선언 금지)을 정면으로 어긴다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md:331` 항목에 한 줄 caveat 추가 — "TriggerDto/ScheduleDto 도달 시 `notificationSecretV2`/`chatChannelTokenV2` 는 **선언 금지**(secret-store.md §1.1), RED 해소는 응답에서 스트립하는 쪽으로만"

- **[WARNING]** `1-data-model.md §2.8` 저장 형태 정정 후속이 체크박스 트래커 밖의 산문으로만 존재 — draft 가 `complete/` 로 이동되면 유실 위험
  - target 위치: `plan/in-progress/spec-draft-notification-secret-storage.md:203`("`1-data-model.md §2.8` 의 `notification_secret_v2` 행에 저장 형태 한 줄 (INFO#2)")
  - 관련 plan: 없음 — 이 항목이 등재된 유일한 자리가 target 자신의 `### 후속 (이 PR 밖)` 산문 bullet(`- **...**`)이고, 저장소가 실제로 완료 여부를 추적하는 형식(`- [ ]`/`- [x]` 체크박스, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 후속` 절이 쓰는 방식)이 아니다
  - 상세: 실측 — `spec/1-data-model.md:240` 의 `notification_secret_v2` 행은 아직 정정되지 않았다("Secret rotation 기간 동안 사용되는 신규 secret" 만 적고 평문/`secret://` 비대상이라는 저장 형태를 명시하지 않는다). `spec_impact` 에도 `spec/1-data-model.md` 가 없어, 이 target draft 가 `plan/complete/` 로 옮겨지는 순간 이 follow-up 을 추적할 체크박스가 어디에도 남지 않는다
  - 제안: `spec-draft-nullable-notation-followups.md` 의 `## 후속` 절(체크박스 트래커)에 `- [ ] 1-data-model.md §2.8 notification_secret_v2 행 저장 형태 명시` 를 옮겨 등재하거나, target 자신에 `## 후속` 체크박스 절을 신설해 옮긴다

- **[INFO]** target 문서 자신의 1차 반영 "후속" 항목이 2차 반영에서 정정됐는데 앞쪽이 갱신되지 않았다
  - target 위치: `plan/in-progress/spec-draft-notification-secret-storage.md:199-202`("미머지 브랜치 문구 정정 ... `claude/sweep-response-contract-5ba0ad` 에 있는 문장이라 그 브랜치에서 고친다")
  - 관련 plan: 같은 파일 `:235`(I6) — "*'미머지 브랜치라 못 고친다'* 가 부정확 — **맞다, 여기서 고쳤다**. 그 문장은 `983fd0ade` 로 이 브랜치에 이미 있었다"
  - 상세: 실측 확인 — `spec-draft-nullable-notation-followups.md:628` 의 해당 문구는 이미 "런타임으로 시행하는 유일한 코드" 로 좁혀져 있어 실질 피해는 없다(I6 의 정정이 맞다). 다만 `:199-202` 블록 자체는 취소선·갱신 없이 그대로 남아 있어, 이 파일만 부분적으로 읽는 사람에게는 여전히 "후속 작업 남음" 으로 읽힌다
  - 제안: `:199-202` 블록에 취소선 또는 "→ 2차 반영 I6 에서 해소 확인" 한 줄 추가

## 요약

핵심 결정(§7.1 정정 · `secret-store.md` 세 번째 비대상 예외 등재 · §1.1 신설)은 `chat-channel.md` R-K·`data-flow §1.5` 와 정합하고, 동일 패턴의 선례(`itk_*`, 2026-08-16 결정)와도 어긋나지 않는다 — 미해결 결정을 일방적으로 뒤집는 CRITICAL 은 없다. 다만 이 세션이 새로 세운 §1.1(응답 DTO 비선언 규범)이 이미 진행 중인 별도 후속 트랙(§5.4 drift 배치 2단계, `TriggerDto`/`ScheduleDto` 배선)과 같은 표면을 겨냥하는데 상호 참조가 빠져 있어, 그 트랙이 나중에 §1.1 을 어기는 방향(DTO 에 필드 선언)으로 "해소"될 실질적 위험이 있다. 아울러 `1-data-model.md §2.8` 후속이 체크박스 트래커 밖에 있어 draft 아카이브 시 유실 가능성이 있다. 둘 다 문서 갱신(caveat 한 줄 추가, 항목 이관)으로 해소되는 낮은 비용의 조치다.

## 위험도
LOW
